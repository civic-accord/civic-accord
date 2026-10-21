// Which state a federal item is about, from its official title only.
const test = require("node:test"), assert = require("node:assert");
const P = require("../lib/place.js");

test("a state program revision names its state", () => {
  assert.deepStrictEqual(P.statesNamed("Public Water System Supervision Program Revision for the State of Arkansas"), ["AR"]);
  assert.deepStrictEqual(P.statesNamed("Air Plan Approval; North Carolina; Charlotte-Rock Hill Area Maintenance Plan for the 2008 8-Hour Ozone NAAQS"), ["NC"]);
});
test("a nationwide rule names no state", () => {
  assert.deepStrictEqual(P.statesNamed("Revisions to the Office of Hearings and Appeals Procedural Regulations for the DOE Contractor Employee Protection Program"), []);
});
test("Kansas is not found inside Arkansas, and Virginia is not found inside West Virginia", () => {
  assert.deepStrictEqual(P.statesNamed("Approval of Air Quality Implementation Plans; Arkansas"), ["AR"]);
  assert.deepStrictEqual(P.statesNamed("Approval of Air Quality Implementation Plans; West Virginia"), ["WV"]);
});
test("Washington counts only as the state, not the city", () => {
  assert.deepStrictEqual(P.statesNamed("Notice of Meeting in Washington, DC"), ["DC"]);
  assert.deepStrictEqual(P.statesNamed("Air Plan Approval; State of Washington; Regional Haze"), ["WA"]);
});
test("a postal abbreviation after a comma names the state", () => {
  assert.deepStrictEqual(P.statesNamed("Safety Zone; Red Bull Flugtag, Intercoastal Waterway, Biscayne Bay, Miami, FL"), ["FL"]);
  assert.deepStrictEqual(P.statesNamed("Special Local Regulation; Ohio River, Louisville, KY"), ["OH","KY"]);
  assert.deepStrictEqual(P.statesNamed("Rules on IN-house review"), []);
});
test("Hawaiʻi with an ʻokina is found", () => {
  assert.deepStrictEqual(P.statesNamed("Endangered Species: Hawaiʻi Plants"), ["HI"]);
});
test("about another state only when none of the named states is mine", () => {
  assert.strictEqual(P.aboutAnotherState("Air Plan Approval; North Carolina", "HI"), true);
  assert.strictEqual(P.aboutAnotherState("Air Plan Approval; North Carolina", "NC"), false);
  assert.strictEqual(P.aboutAnotherState("Air Plan Approval; North Carolina and Hawaii", "HI"), false);
  assert.strictEqual(P.aboutAnotherState("A nationwide rule", "HI"), false);
  assert.strictEqual(P.aboutAnotherState("Air Plan Approval; North Carolina", null), true);
});
