// Scheduled downloads and the shared Open States limit.
const test = require("node:test"), assert = require("node:assert");
const store = require("../api/_store.js");
const { openStatesCaps } = require("../api/_shared.js");
const { due } = require("../api/refresh.js");

// A stand-in for the saved-copy store: keeps files in memory and checks etags like the real one.
function fakeStore() {
  const files = new Map(); let n = 0;
  return {
    files,
    get: async path => { const f = files.get(path); if (!f) return null; return { statusCode: 200, stream: new Response(f.body).body, blob: { etag: f.etag, uploadedAt: f.at } }; },
    put: async (path, body, o) => {
      const f = files.get(path);
      if (f && o.allowOverwrite === false) { const e = new Error("This blob already exists"); throw e; }
      if (o.ifMatch && (!f || f.etag !== o.ifMatch)) { const e = new Error("Precondition failed"); e.name = "BlobPreconditionFailedError"; throw e; }
      files.set(path, { body, etag: "e" + (++n), at: new Date() });
    }
  };
}

test("lists due for download: never downloaded first, then oldest; in session every 3 hours, otherwise daily", () => {
  const now = Date.parse("2026-10-21T12:00:00Z"), h = 3600e3;
  const index = {
    CA: { at: now - 4 * h, inSession: true },
    NY: { at: now - 1 * h, inSession: true },
    HI: { at: now - 10 * h, inSession: false },
    ID: { at: now - 21 * h, inSession: false },
    PA: { at: now - 5 * h, inSession: true, errAt: now - 10 * 60e3 }
  };
  assert.deepStrictEqual(due(index, now, ["CA", "NY", "HI", "ID", "PA", "TX"]), ["TX", "ID", "CA"]);
});

test("caps: scheduled downloads leave room for talk-it-through pages every minute and every day", () => {
  const r = openStatesCaps("refresh"), i = openStatesCaps("items");
  assert.strictEqual(r.perMinute, 8); assert.ok(r.useMinute < r.perMinute);
  assert.strictEqual(r.perDay, 450); assert.strictEqual(r.useDay + i.useDay, r.perDay);
  assert.ok(r.perDay < 500);
});

test("one shared count across copies: the minute cap holds even when calls arrive at the same moment", async () => {
  process.env.BLOB_READ_WRITE_TOKEN = "test";
  const fake = fakeStore(); store._setLib(fake);
  const caps = { perMinute: 8, perDay: 450, useMinute: 6, useDay: 290 };
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => store.take("openstates", "refresh", caps)));
  const ok = results.filter(r => r.status === "fulfilled").length;
  assert.ok(ok <= 6, `took ${ok} turns`);
  const s = JSON.parse(fake.files.get("limits/openstates.json").body);
  assert.strictEqual(s.m, ok); assert.strictEqual(s.useMinute.refresh, ok);
  // Talk-it-through pages still get the rest of the minute.
  await store.take("openstates", "items", { ...caps, useMinute: 8, useDay: 160 });
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

test("the day cap stops further calls with a clear reason", async () => {
  process.env.BLOB_READ_WRITE_TOKEN = "test";
  const fake = fakeStore(); store._setLib(fake);
  const day = new Date().toISOString().slice(0, 10);
  fake.files.set("limits/openstates.json", { body: JSON.stringify({ day, d: 450, useDay: { refresh: 290 } }), etag: "x", at: new Date() });
  await assert.rejects(store.take("openstates", "items", { perMinute: 8, perDay: 450 }), e => e.busy && e.why === "day");
  delete process.env.BLOB_READ_WRITE_TOKEN;
});
