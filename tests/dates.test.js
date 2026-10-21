// Deadlines: a past date is never "open" or "closing soon", and dates are judged in the right time zone.
const test = require("node:test"), assert = require("node:assert");
const D = require("../lib/dates.js");
const at = iso => new Date(iso);

test("yesterday is closed and not 'within a week'", () => {
  const now = at("2026-10-21T18:00:00Z");
  assert.strictEqual(D.isClosed("2026-10-20", now, "America/Boise"), true);
  assert.strictEqual(D.closesSoon("2026-10-20", now, "America/Boise"), false);
  assert.strictEqual(D.label("2026-10-20", now, "America/Boise"), "Closed");
});
test("today says 'Closes today' and counts as within a week", () => {
  const now = at("2026-10-21T18:00:00Z");
  assert.strictEqual(D.label("2026-10-21", now, "America/Boise"), "Closes today");
  assert.strictEqual(D.closesSoon("2026-10-21", now, "America/Boise"), true);
});
test("7 days out is within a week; 8 is not", () => {
  const now = at("2026-10-21T18:00:00Z");
  assert.strictEqual(D.closesSoon("2026-10-28", now, "America/Boise"), true);
  assert.strictEqual(D.closesSoon("2026-10-29", now, "America/Boise"), false);
});
test("time zones: 9 p.m. in Boise is already tomorrow in UTC, but still today in Boise", () => {
  const now = at("2026-10-22T03:00:00Z"); // Oct 21, 9 p.m. Mountain
  assert.strictEqual(D.today(now, "America/Boise"), "2026-10-21");
  assert.strictEqual(D.isClosed("2026-10-21", now, "America/Boise"), false);
  assert.strictEqual(D.isClosed("2026-10-21", now, "UTC"), true);
});
test("Hawaiʻi evening and Eastern deadlines", () => {
  const now = at("2026-10-22T08:30:00Z"); // Oct 21, 10:30 p.m. in Honolulu; Oct 22, 4:30 a.m. Eastern
  assert.strictEqual(D.label("2026-10-21", now, "Pacific/Honolulu"), "Closes today");
  assert.strictEqual(D.isClosed("2026-10-21", now, "America/New_York"), true);
});
test("no date means no deadline", () => {
  assert.strictEqual(D.daysLeft(null), null);
  assert.strictEqual(D.isClosed(undefined), false);
  assert.strictEqual(D.closesSoon(""), false);
});
