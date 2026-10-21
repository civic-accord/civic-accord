// Scheduled downloads of local meeting lists.
const test = require("node:test"), assert = require("node:assert");
const { dueLocal, LOCAL_EVERY, LOCAL_RETRY } = require("../api/_local.js");
const feeds = [{ id: "a", system: "legistar" }, { id: "b", system: "legistar" }, { id: "c", system: "other" }];
const H = 3600e3, now = 100 * H;

test("a feed never downloaded is due; only legistar feeds are considered", () => {
  assert.deepStrictEqual(dueLocal({}, now, feeds).map(f => f.id), ["a", "b"]);
});
test("a feed refreshed within 3 hours is not due; the most out of date comes first", () => {
  const index = { a: { at: now - LOCAL_EVERY + 1 }, b: { at: now - 2 * LOCAL_EVERY } };
  assert.deepStrictEqual(dueLocal(index, now, feeds).map(f => f.id), ["b"]);
  const both = { a: { at: now - 5 * H }, b: { at: now - 4 * H } };
  assert.deepStrictEqual(dueLocal(both, now, feeds).map(f => f.id), ["a", "b"]);
});
test("a feed that just failed waits 30 minutes before another try", () => {
  assert.deepStrictEqual(dueLocal({ a: { errAt: now - LOCAL_RETRY + 1 } }, now, feeds).map(f => f.id), ["b"]);
  assert.deepStrictEqual(dueLocal({ a: { errAt: now - LOCAL_RETRY } }, now, feeds).map(f => f.id), ["a", "b"]);
});
