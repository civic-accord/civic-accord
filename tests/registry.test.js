// Local governments from real Census answers (fields copied from the Census geocoder).
const test = require("node:test"), assert = require("node:assert");
global.window = {}; require("../lib/registry.js"); const R = window.CA_REG;
const g = (sub, place) => ({ geographies: { States: [{ STATE: sub.STATE, NAME: "X" }], "County Subdivisions": [sub], ...(place ? { "Incorporated Places": [place] } : {}) } });
test("town and village both govern (Ossining, NY)", () => {
  const n = R.normalize(g({ GEOID: "3611955541", STATE: "36", NAME: "Ossining town", BASENAME: "Ossining", FUNCSTAT: "A", LSADC: "43" }, { GEOID: "3655530", STATE: "36", NAME: "Ossining village", BASENAME: "Ossining", FUNCSTAT: "A", LSADC: "47" }));
  assert.strictEqual(n.township.label, "Town of Ossining");
  assert.strictEqual(n.place.label, "Village of Ossining");
});
test("a borough that repeats as a subdivision is shown once (State College, PA)", () => {
  const n = R.normalize(g({ GEOID: "4202773808", STATE: "42", NAME: "State College borough", BASENAME: "State College", FUNCSTAT: "F", LSADC: "21" }, { GEOID: "4273808", STATE: "42", NAME: "State College borough", BASENAME: "State College", FUNCSTAT: "A", LSADC: "21" }));
  assert.strictEqual(n.township, null);
});
test("a New Jersey township with no city", () => {
  const n = R.normalize(g({ GEOID: "3400712280", STATE: "34", NAME: "Cherry Hill township", BASENAME: "Cherry Hill", FUNCSTAT: "A", LSADC: "44" }));
  assert.strictEqual(n.township.label, "Cherry Hill Township");
  assert.strictEqual(n.place, null);
});
test("districts saved for matching include county, place, and town IDs", () => {
  const n = R.normalize(g({ GEOID: "2612553980", STATE: "26", NAME: "Milford charter township", BASENAME: "Milford", FUNCSTAT: "A", LSADC: "49" }, { GEOID: "2653960", STATE: "26", NAME: "Milford village", BASENAME: "Milford", FUNCSTAT: "A", LSADC: "47" }));
  const d = R.districtsOf(n);
  assert.strictEqual(d.townId, "2612553980"); assert.strictEqual(d.placeId, "2653960");
});
