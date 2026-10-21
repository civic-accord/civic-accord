// Release 1: issue status and next action, "changed since you last looked", office names, and records kept on the device.
const test = require("node:test"), assert = require("node:assert");
const I = require("../lib/issue.js"), O = require("../lib/offices.js"), { make } = require("../lib/records.js");
const at = iso => new Date(iso);

function memStore() { const m = new Map(); return {
  getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k),
  key: i => [...m.keys()][i] ?? null, get length() { return m.size; }, _m: m }; }

const bill = (over = {}) => ({ id: "os-ocd-bill/00000000-0000-0000-0000-000000000001", kind: "Bill in the Hawaii legislature", level: "state",
  title: "HB 1: Example", status: { date: "2027-01-22", text: "Referred to AGR" }, actions: [{ date: "2027-01-22", text: "Referred to AGR" }],
  parts: [{ text: "Funds inspections." }], links: { text: "https://example.gov/hb1" }, source: { label: "Open States" }, ...over });
const rule = (over = {}) => ({ kind: "Proposed rule", level: "federal", title: "Rule", closes: "2026-11-03", links: { comment: "https://www.regulations.gov/x" }, parts: [], ...over });
const meeting = (over = {}) => ({ kind: "Local meeting", level: "local", title: "Council: meeting", meets: "2026-10-28", links: { comment: "https://maui.legistar.com/x" }, parts: [], ...over });

test("status: open rule, closed rule, upcoming and past meetings, bill in progress, final decision", () => {
  const now = at("2026-10-21T12:00:00");
  assert.strictEqual(I.stageOf(rule(), now).key, "comment-open");
  assert.strictEqual(I.stageOf(rule({ closes: "2026-10-20" }), now).key, "comment-closed");
  assert.strictEqual(I.stageOf(meeting(), now).key, "meeting-upcoming");
  assert.strictEqual(I.stageOf(meeting({ meets: "2026-10-01" }), now).key, "meeting-held");
  assert.strictEqual(I.stageOf(bill(), now).key, "in-progress");
  assert.strictEqual(I.stageOf(bill({ final: { date: "2027-06-01", text: "Signed by the governor" } }), now).key, "final");
});

test("next action: a closed comment period never says 'Comment by'", () => {
  const now = at("2026-10-21T12:00:00");
  const closed = rule({ closes: "2026-10-20" });
  assert.doesNotMatch(I.nextAction(closed, I.stageOf(closed, now), true, now).text, /comment officially/i);
  const open = rule();
  assert.match(I.nextAction(open, I.stageOf(open, now), true, now).text, /Comment officially by November 3, 2026/);
  const today = rule({ closes: "2026-10-21" });
  assert.match(I.nextAction(today, I.stageOf(today, now), true, now).text, /today/);
  assert.strictEqual(I.nextAction(bill(), I.stageOf(bill(), now), false, now).anchor, "follow");
  assert.strictEqual(I.nextAction(bill(), I.stageOf(bill(), now), true, now).anchor, "tell");
});

test("changed since you last looked: each kind of change is listed once, with a reason", () => {
  const t0 = at("2026-10-21T12:00:00"), base = I.snapshot(bill(), "2026-10-21T10:00:00Z", t0), later = "2026-10-23T10:00:00Z", t1 = at("2026-10-23T12:00:00");
  const same = I.compare(base, bill(), later, t1);
  assert.strictEqual(same.result, "no-change"); assert.strictEqual(same.changes.length, 0);
  const moved = bill({ status: { date: "2027-02-03", text: "Passed second reading" }, actions: [{ date: "2027-02-03", text: "Passed second reading" }, { date: "2027-01-22", text: "Referred to AGR" }] });
  const c = I.compare(base, moved, later, t1);
  assert.strictEqual(c.result, "changed"); assert.strictEqual(c.changes.length, 1);
  assert.match(c.changes[0].text, /New official action on February 3, 2027: Passed second reading/); assert.ok(c.changes[0].why);
  const fin = I.compare(base, bill({ final: { date: "2027-06-01", text: "Signed by the governor" } }), later, t1);
  assert.deepStrictEqual(fin.changes.map(x => x.kind), ["final"]);
  const sum = I.compare(base, bill({ parts: [{ text: "Funds inspections and research." }] }), later, t1);
  assert.deepStrictEqual(sum.changes.map(x => x.kind), ["summary"]);
});

test("no false updates: a failed check is 'unavailable', and data no newer than the baseline is 'not refreshed'", () => {
  const t0 = at("2026-10-21T12:00:00"), base = I.snapshot(bill(), "2026-10-21T10:00:00Z", t0);
  assert.strictEqual(I.compare(base, null, null, t0).result, "unavailable");
  const moved = bill({ actions: [{ date: "2027-02-03", text: "Passed" }] });
  assert.strictEqual(I.compare(base, moved, "2026-10-21T10:00:00Z", t0).result, "not-refreshed");
  assert.strictEqual(I.compare(base, moved, "2026-10-21T09:00:00Z", t0).result, "not-refreshed");
});

test("deadlines and meetings: set, moved, passed, and coming up within 7 days", () => {
  const t0 = at("2026-10-21T12:00:00"), base = I.snapshot(rule(), "2026-10-21T10:00:00Z", t0);
  const moved = I.compare(base, rule({ closes: "2026-11-10" }), "2026-10-22T10:00:00Z", at("2026-10-22T12:00:00"));
  assert.deepStrictEqual(moved.changes.map(x => x.kind), ["deadline"]);
  const passed = I.compare(base, rule(), "2026-11-04T10:00:00Z", at("2026-11-04T12:00:00"));
  assert.deepStrictEqual(passed.changes.map(x => x.kind), ["closed"]);
  const soon = I.compare(base, rule(), "2026-10-28T10:00:00Z", at("2026-10-28T12:00:00"));
  assert.strictEqual(soon.result, "no-change"); assert.deepStrictEqual(soon.soon.map(x => x.kind), ["deadline"]);
  const mb = I.snapshot(meeting(), "2026-10-21T10:00:00Z", t0);
  assert.deepStrictEqual(I.compare(mb, meeting({ meets: "2026-11-04" }), "2026-10-22T10:00:00Z", at("2026-10-22T12:00:00")).changes.map(x => x.kind), ["meeting"]);
  assert.deepStrictEqual(I.compare(mb, meeting(), "2026-10-29T10:00:00Z", at("2026-10-29T12:00:00")).changes.map(x => x.kind), ["held"]);
});

test("share text has only public facts: no view, name, or address", () => {
  const t = I.shareText(bill(), "2026-10-21T10:00:00Z", I.stageOf(bill(), at("2026-10-21T12:00:00")), "https://civicaccord.org/item.html?id=os-ocd-bill/x");
  assert.match(t, /no votes are counted yet/i); assert.match(t, /Open States/); assert.match(t, /October 21, 2026/);
  assert.doesNotMatch(t, /\b(support|oppose)\b/i); assert.doesNotMatch(t, /\bI\b/);
});

test("office names are seats, stable across officeholders", () => {
  assert.strictEqual(O.house("HI", "2"), "us/house/hi-2");
  assert.strictEqual(O.house("AK", "at-large"), "us/house/ak-al");
  assert.strictEqual(O.house("WY", 0), "us/house/wy-al");
  assert.strictEqual(O.senate("HI", 1), "us/senate/hi/class-1");
  assert.strictEqual(O.stateSeat("ID", "lower", "19A"), "id/lower/19a");
  assert.strictEqual(O.stateSeat("NE", "legislature", "5"), "ne/legislature/5");
  assert.strictEqual(O.agency("Environmental Protection Agency"), "us/agency/environmental-protection-agency");
  ["us/house/hi-2", "id/lower/19a", "local/hi-maui-county"].forEach(id => assert.ok(O.valid(id), id));
});

test("records: follow with a baseline, sent records are labeled reported by you, and export warns first", () => {
  const s = memStore(), R = make(s), now = at("2026-10-21T12:00:00");
  const b = bill(), base = I.snapshot(b, "2026-10-21T10:00:00Z", now);
  assert.ok(R.follow({ id: b.id, title: b.title, kind: b.kind, level: b.level }, base, now));
  assert.ok(R.isFollowing(b.id)); assert.strictEqual(R.follows()[0].baseline.dataAt, "2026-10-21T10:00:00Z");
  const rec = R.addSent({ issue: { id: b.id, title: b.title, version: base.version }, office: { id: "hi/lower/13", name: "State Representative, district 13", holder: "Example Person" },
    channel: "email", message: "Dear Representative, please support HB 1.", sentOn: "2026-10-21" }, now);
  assert.strictEqual(rec.status.delivery, "reported-by-you"); assert.strictEqual(rec.status.response, "none-recorded"); assert.strictEqual(rec.status.participation, "individual");
  assert.strictEqual(R.sentFor(b.id).length, 1);
  const ex = R.exportData(now);
  assert.match(ex.notice, /private messages/); assert.match(ex.notice, /name and town/); assert.ok(ex.data["civicaccord-records"]);
  assert.ok(!JSON.stringify(ex).includes("civicaccord-verified"));
  R.unfollow(b.id); assert.ok(!R.isFollowing(b.id));
});

test("import: merges without duplicates, keeps what's here, and rejects anything that isn't an export", () => {
  const a = memStore(), A = make(a), now = at("2026-10-21T12:00:00"), b = bill();
  A.follow({ id: b.id, title: b.title }, I.snapshot(b, "2026-10-21T10:00:00Z", now), now);
  A.addSent({ issue: { id: b.id, title: b.title }, office: { name: "Office" }, message: "Hi", sentOn: "2026-10-21" }, now);
  a.setItem("civicaccord-topics", JSON.stringify(["water"]));
  const file = JSON.stringify(A.exportData(now));
  const z = memStore(), Z = make(z); z.setItem("civicaccord-topics", JSON.stringify(["roads"]));
  const r1 = Z.importData(file);
  assert.deepStrictEqual([r1.follows, r1.sent, r1.kept], [1, 1, 1]);
  assert.strictEqual(z.getItem("civicaccord-topics"), JSON.stringify(["roads"]));
  const r2 = Z.importData(file);
  assert.deepStrictEqual([r2.follows, r2.sent], [0, 0]); assert.strictEqual(Z.allSent().length, 1);
  assert.throws(() => Z.importData("{}"), /isn't a Civic Accord export/);
  assert.throws(() => Z.importData("not json"), /isn't a Civic Accord export/);
  const evil = JSON.stringify({ format: "civic-accord-records", version: 1, data: { "civicaccord-verified": "{\"x\":1}", "other-key": "1" } });
  Z.importData(evil); assert.strictEqual(z.getItem("civicaccord-verified"), null); assert.strictEqual(z.getItem("other-key"), null);
});

test("records report when the browser isn't saving data", () => {
  const broken = { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => {}, key: () => null, length: 0 };
  const R = make(broken);
  assert.strictEqual(R.available(), false); assert.strictEqual(R.follow({ id: "us-hr1-119" }, null), false);
});

test("finished bills: the bill itself ended, not an amendment or a motion", () => {
  const { stateEnded, congressEnded } = require("../api/_final.js");
  assert.ok(stateEnded("Signed by the Governor", false));
  assert.ok(stateEnded("Became law without signature", false));
  assert.ok(!stateEnded("Amendment failed", false));
  assert.ok(!stateEnded("Withdrawn from committee", false));
  assert.ok(stateEnded("Adopted", true)); assert.ok(!stateEnded("Adopted", false));
  assert.ok(stateEnded("Act 236, 6/30/2025", false));
  assert.ok(stateEnded("Transmitted", false, ["executive-signature"]));
  assert.ok(!stateEnded("Committee report adopted", false, ["withdrawal"]));
  assert.ok(congressEnded("Became Public Law No: 119-12.")); assert.ok(!congressEnded("Referred to the Committee on Agriculture."));
});

test("import keeps only known baseline fields with real dates", () => {
  const z = memStore(), Z = make(z);
  const evil = { v: 1, follows: { "us-hr1-119": { issue: { id: "us-hr1-119", title: "HR 1" }, since: "x", baseline: { seenAt: "2026-10-01T00:00:00Z", closes: "garbage", extra: "<script>", version: "v1" } } }, sent: [] };
  Z.importData(JSON.stringify({ format: "civic-accord-records", version: 1, data: { "civicaccord-records": JSON.stringify(evil) } }));
  const b = Z.follows()[0].baseline;
  assert.strictEqual(b.closes, null); assert.ok(!("extra" in b)); assert.strictEqual(b.version, "v1");
});

test("import skips other settings that carry markup or a made-up state", () => {
  const z = memStore(), Z = make(z);
  Z.importData(JSON.stringify({ format: "civic-accord-records", version: 1, data: {
    "civicaccord-records": JSON.stringify({ v: 1, follows: {}, sent: [] }),
    "civicaccord-topics": JSON.stringify({ picked: ['x" style="position:fixed'], skipped: false }),
    "civicaccord-geo": JSON.stringify({ state: "../packs/x" }),
    "civicaccord-districts": JSON.stringify({ state: "HI", cd: "2", sldl: "13" }) } }));
  assert.strictEqual(z.getItem("civicaccord-topics"), null);
  assert.strictEqual(z.getItem("civicaccord-geo"), null);
  assert.deepStrictEqual(JSON.parse(z.getItem("civicaccord-districts")), { state: "HI", cd: "2", sldl: "13" });
});

test("import restores notes and practice votes with quotes and angle brackets", () => {
  const z = memStore(), Z = make(z);
  const notes = JSON.stringify({ "us-hr1-119": 'She said "fund it" & x < y > z' });
  const votes = JSON.stringify({ "us-hr1-119": { 'Funds the "Rapid Response" program.': 0 } });
  const r = Z.importData(JSON.stringify({ format: "civic-accord-records", version: 1, data: {
    "civicaccord-records": JSON.stringify({ v: 1, follows: {}, sent: [] }), "civicaccord-learn-notes": notes, "civicaccord-item-votes": votes,
    "civicaccord-signer": JSON.stringify({ name: "Pat O'Neil", town: "Coeur d'Alene" }) } }));
  assert.strictEqual(z.getItem("civicaccord-learn-notes"), notes);
  assert.strictEqual(z.getItem("civicaccord-item-votes"), votes);
  assert.ok(z.getItem("civicaccord-signer")); assert.strictEqual(r.skipped, 0); assert.strictEqual(r.other, 3);
});

test("a failed action list is never reported as a new action; a veto is not a final decision", () => {
  const t0 = at("2026-10-21T12:00:00");
  const base = I.snapshot(bill({ actions: null }), "2026-10-21T10:00:00Z", t0);
  assert.strictEqual(I.compare(base, bill(), "2026-10-22T10:00:00Z", at("2026-10-22T12:00:00")).result, "no-change");
  const v = bill({ vetoed: { date: "2027-06-01", text: "Vetoed by the Governor." } });
  assert.strictEqual(I.stageOf(v, t0).key, "vetoed"); assert.match(I.stageOf(v, t0).detail, /override/);
  assert.deepStrictEqual(I.compare(I.snapshot(bill(), "2026-10-21T10:00:00Z", t0), v, "2026-10-22T10:00:00Z", t0).changes.map(x => x.kind), ["vetoed"]);
});

test("a deadline that passed is noticed even when the source has no newer data", () => {
  const base = I.snapshot(rule(), "2026-10-21T10:00:00Z", at("2026-10-21T12:00:00"));
  const c = I.compare(base, rule(), "2026-10-21T10:00:00Z", at("2026-11-05T12:00:00"));
  assert.strictEqual(c.result, "changed"); assert.deepStrictEqual(c.changes.map(x => x.kind), ["closed"]);
});

test("outcomes: vetoes, overrides, resolutions, and motions", () => {
  const F = require("../api/_final.js");
  assert.strictEqual(F.stateOutcome("Vetoed by Governor", ["bill"]), "vetoed");
  assert.strictEqual(F.stateOutcome("Veto sustained", ["bill"]), "final");
  assert.strictEqual(F.stateOutcome("Adopted", ["concurrent resolution"]), null);
  assert.strictEqual(F.stateOutcome("Adopted", ["resolution"]), "final");
  assert.strictEqual(F.stateOutcome("Amendment failed", ["bill"]), null);
  assert.strictEqual(F.congressOutcome("HR", "Vetoed by President."), "vetoed");
  assert.strictEqual(F.congressOutcome("HR", "Pocket Vetoed by President."), "final");
  assert.strictEqual(F.congressOutcome("HRES", "On motion to refer Agreed to without objection."), null);
  assert.strictEqual(F.congressOutcome("SCONRES", "Received in the House. Agreed to in House with an amendment."), null);
});

test("adopted House resolutions stay finished; failed overrides are final; line-item vetoes aren't vetoes", () => {
  const F = require("../api/_final.js");
  assert.strictEqual(F.congressOutcome("HRES", "Motion to reconsider laid on the table Agreed to without objection."), "final");
  assert.strictEqual(F.congressOutcome("HR", "Override of veto failed in House."), "final");
  assert.strictEqual(F.stateOutcome("Line-item veto", ["bill"], ["executive-veto-line-item"]), null);
});
