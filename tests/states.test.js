// State bills: which latest actions mean a bill is finished, and which legislative session counts as open.
const test = require("node:test"), assert = require("node:assert");
const { stateEnded, stateOutcome } = require("../api/_final.js");
const { stateBills } = require("../api/_states.js");

test("common ways legislatures record a bill becoming law are treated as finished", () => {
  ["Approved P.L.2025, c.123.", "Assigned PA 12'25 with immediate effect", "Published 7-4-2025", "Effective on 9/1/25",
   "Public Act . . . 104-0012", "Chapter No. 2025-123", "Secretary of State Chapter 12", "Governor: Acts of Assembly Chapter text (CHAP0123)",
   "Ch. SL 2025-12", "Governor signed", "Pocket vetoed by Governor"].forEach(t => {
    assert.strictEqual(stateEnded(t, false), true, t); assert.strictEqual(stateOutcome(t, null, null), "final", t); });
  ["Approved placed on Third Reading", "Referred to Committee on Effective Government", "Amendment failed", "Passed House", "Approved by committee", "Public hearing scheduled"]
    .forEach(t => assert.strictEqual(stateEnded(t, false), false, t));
  assert.strictEqual(stateOutcome("Vetoed by Governor", null, null), "vetoed");
});

async function pick(sessions) {
  const out = {}, calls = [];
  await stateBills("k", "TX", out, async u => { calls.push(u); return { results: [], pagination: { total_items: 0, max_page: 1 } }; }, async () => sessions);
  const m = (calls[0] || "").match(/session=([^&]+)/); return { out, session: m ? decodeURIComponent(m[1]) : null };
}
test("an old special session with no end date isn't treated as running; the regular session comes first", async () => {
  const y = new Date().getUTCFullYear(), ago = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
  let r = await pick([{ identifier: "s", name: "Special Session", start_date: ago(400), end_date: null }, { identifier: "r", name: "Regular", start_date: ago(600), end_date: ago(450) }]);
  assert.strictEqual(r.out.inSession, false);
  r = await pick([{ identifier: "r", name: `${y} Regular`, start_date: ago(200), end_date: null }, { identifier: "s1", name: "Special Session 1", start_date: ago(10), end_date: null }]);
  assert.strictEqual(r.session, "r");
  const out2 = {}, calls2 = [];
  await stateBills("k", "TX", out2, async u => { calls2.push(u); return { results: [], pagination: { total_items: 0, max_page: 1 } }; },
    async () => [{ identifier: "r", name: `${y} Regular`, start_date: ago(200), end_date: null }, { identifier: "s1", name: "Special Session 1", start_date: ago(20), end_date: null }]);
  assert.ok(calls2.some(u => /session=s1/.test(u)), "the special session is read too");
  r = await pick([{ identifier: "x", name: "x", start_date: null, end_date: null }]);
  assert.match(r.out.quiet, /couldn't confirm/);
});
