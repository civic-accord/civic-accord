// The published consensus rule.
const test = require("node:test"), assert = require("node:assert");
const { consensusLabel, shareText } = require("../lib/consensus.js");
test("common ground needs every counted group at 70% or more", () => assert.strictEqual(consensusLabel([[34, 2, 2], [30, 3, 2]]), "common"));
test("a group under 10 votes doesn't count", () => assert.strictEqual(consensusLabel([[9, 0, 0], [30, 0, 0]]), "forming"));
test("divides groups: one at 70%+, another under 50%", () => assert.strictEqual(consensusLabel([[30, 2, 2], [3, 20, 2]]), "split"));
test("69.5% is not rounded up to 70%", () => assert.strictEqual(consensusLabel([[139, 61, 0], [30, 0, 0]]), "forming"));
test("a pass counts as not agreeing (6 agree + 4 pass = 60%)", () => assert.strictEqual(consensusLabel([[6, 0, 4], [10, 0, 0]]), "forming"));
test("share of registered voters", () => { assert.strictEqual(shareText(0, 100), "0%"); assert.strictEqual(shareText(74, 860868), "under 0.01%"); });
