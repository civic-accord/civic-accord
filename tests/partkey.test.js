// Saved practice votes follow the exact text they were cast on.
const test = require("node:test"), assert = require("node:assert");
const { partKey, versionKey } = require("../lib/partkey.js");

test("inserting a paragraph doesn't move other parts' names", () => {
  const before = [{ text: "Bans X." }, { text: "Funds Y." }];
  const after = [{ text: "A new first paragraph." }, ...before];
  assert.deepStrictEqual(before.map(partKey), after.slice(1).map(partKey));
  assert.notStrictEqual(versionKey(before), versionKey(after));
});
test("editing a provision gives it a new name, so an old vote isn't applied to it", () => {
  assert.notStrictEqual(partKey({ text: "Funds Y." }), partKey({ text: "Funds Y and Z." }));
});
test("the same words under a different lead-in are a different part", () => {
  assert.notStrictEqual(partKey({ text: "funds Y.", lead: "This bill:" }), partKey({ text: "funds Y.", lead: "This title:" }));
});
test("spacing and capitals don't change the name", () => {
  assert.strictEqual(partKey({ text: "Funds  Y." }), partKey({ text: "funds y." }));
});
