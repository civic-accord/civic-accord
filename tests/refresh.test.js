// Scheduled downloads and the shared Open States limit.
const test = require("node:test"), assert = require("node:assert");
const store = require("../api/_store.js");
const { openStatesCaps } = require("../api/_shared.js");
const { due, pace } = require("../api/refresh.js");

// A stand-in for the saved-copy store: keeps files in memory and checks version tags like the real one.
// lag: how many reads return the previous version, to act like a slow-to-update copy.
function fakeStore() {
  const files = new Map(); let n = 0;
  return {
    files,
    get: async (path, o) => {
      assert.strictEqual(o.access, "private"); assert.strictEqual(o.useCache, false);
      const f = files.get(path); if (!f) return null;
      return { statusCode: 200, stream: new Response(f.body).body, blob: { etag: f.etag, uploadedAt: f.at } };
    },
    put: async (path, body, o) => {
      await new Promise(r => setTimeout(r, Math.random() * 5));
      const f = files.get(path);
      if (f && o.allowOverwrite === false) throw new Error("This blob already exists");
      if (o.ifMatch && (!f || f.etag !== o.ifMatch)) { const e = new Error("Precondition failed"); e.name = "BlobPreconditionFailedError"; throw e; }
      files.set(path, { body, etag: '"e' + (++n) + '"', at: new Date() });
    }
  };
}
async function withStore(fn) {
  const before = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = "test";
  const fake = fakeStore(); store._setLib(fake);
  try { await fn(fake); } finally { if (before === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = before; }
}

test("lists due for download: never downloaded first, then oldest; in session every 3 hours, otherwise daily", () => {
  const now = Date.parse("2026-10-21T12:00:00Z"), h = 3600e3;
  const index = {
    CA: { at: now - 4 * h, inSession: true },
    NY: { at: now - 1 * h, inSession: true },
    HI: { at: now - 10 * h, inSession: false },
    ID: { at: now - 21 * h, inSession: false },
    PA: { at: now - 5 * h, inSession: true, errAt: now - 10 * 60e3 },
    NE: { at: now - 4 * h, inSession: false, nextStart: "2026-10-22" }
  };
  assert.deepStrictEqual(due(index, now, ["CA", "NY", "HI", "ID", "PA", "TX", "NE"]), ["TX", "ID", "CA", "NE"]);
});

test("pace: few legislatures in session get 3 pages every 3 hours; many get fewer pages, and every list still refreshes", () => {
  const codes = Array.from({ length: 52 }, (_, i) => "S" + i), share = openStatesCaps("refresh").useDay;
  const few = {}; codes.slice(0, 5).forEach(c => few[c] = { inSession: true });
  assert.deepStrictEqual(pace(few, codes, share), { pages: 3, every: 3 * 3600e3 });
  const many = {}; codes.slice(0, 46).forEach(c => many[c] = { inSession: true });
  const p = pace(many, codes, share);
  assert.strictEqual(p.pages, 1);
  // Calls a day stay within the share: one session check per state plus in-session lists at this pace.
  assert.ok(52 + 46 * p.pages * (24 * 3600e3 / p.every) <= share + 1, JSON.stringify(p));
});

test("caps: downloads, listed bills, and unlisted addresses each have their own share, and together stay under the daily limit", () => {
  const r = openStatesCaps("refresh"), i = openStatesCaps("items"), u = openStatesCaps("unlisted");
  assert.strictEqual(r.perDay, 450);
  assert.strictEqual(r.useDay + i.useDay + u.useDay, r.perDay);
  assert.ok(u.useDay <= 25);
  assert.ok(r.useMinute < r.perMinute && u.useMinute < r.perMinute);
});

test("one shared count across copies: the minute cap holds even when calls arrive at the same moment", () => withStore(async fake => {
  const caps = { perMinute: 8, perDay: 450, useMinute: 6, useDay: 290 };
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => store.take("openstates", "refresh", caps)));
  const ok = results.filter(r => r.status === "fulfilled").length;
  assert.ok(ok >= 1 && ok <= 6, `took ${ok} turns`);
  const s = JSON.parse(fake.files.get("limits/openstates.json").body);
  assert.strictEqual(s.m, ok); assert.strictEqual(s.useMinute.refresh, ok);
  await store.take("openstates", "items", { ...caps, useMinute: 8, useDay: 160 });
}));

test("the day cap stops further calls with a clear reason", () => withStore(async fake => {
  const day = new Date().toISOString().slice(0, 10);
  fake.files.set("limits/openstates.json", { body: JSON.stringify({ day, d: 450, useDay: { refresh: 290 } }), etag: '"x"', at: new Date() });
  await assert.rejects(store.take("openstates", "items", { perMinute: 8, perDay: 450 }), e => e.busy && e.why === "day");
}));

test("a file with no version tag is never saved over", () => withStore(async fake => {
  fake.files.set("limits/openstates.json", { body: "{}", etag: "", at: new Date() });
  await assert.rejects(store.take("openstates", "items", { perMinute: 8, perDay: 450 }), /no version tag/);
}));

test("only one scheduled run works at a time", () => withStore(async () => {
  const a = await store.lock("refresh", 60e3), b = await store.lock("refresh", 60e3);
  assert.ok(a); assert.strictEqual(b, null);
  await store.unlock("refresh", a);
  assert.ok(await store.lock("refresh", 60e3));
}));
