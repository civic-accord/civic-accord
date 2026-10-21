// Topic matching, against a small hand-checked set. Add a row whenever someone reports a wrong topic.
const test = require("node:test"), assert = require("node:assert");
const T = require("../lib/topics.js");
const ids = it => T.match(it).map(m => m.id);
const CASES = [
  // [item, should include, should not include]
  [{ title: "Great Lakes Pilotage Rates-2027 Annual Review", who: "Homeland Security Department, Coast Guard", summary: "The Coast Guard proposes new base rates for pilotage, which support national defense and commerce." }, ["transport"], ["veterans"]],
  [{ title: "Relating to agriculture", who: "Hawaii Legislature", summary: "" }, ["agriculture"], []],
  [{ title: "Benefits rule", who: "Department of Veterans Affairs", summary: "" }, ["veterans"], []],
  [{ title: "Airworthiness Directives; The Boeing Company Airplanes", who: "Federal Aviation Administration", summary: "" }, ["transport"], ["environment", "world"]],
  [{ title: "Safety Zone; Hudson River", who: "Coast Guard", summary: "" }, ["transport"], ["water"]],
  [{ title: "Program rule", who: "Agency", summary: "This rule changes how schools report. Schools must file each year." }, ["education"], []],
  [{ title: "Program rule", who: "Agency", summary: "This rule changes rules for landlords." }, ["housing"], []],
  [{ title: "Readiness rule", who: "Agency", summary: "The Secretary of Defense would set readiness standards." }, ["veterans"], []],
  [{ title: "Claims rule", who: "Agency", summary: "This is a defense against fraudulent claims." }, [], ["veterans"]],
];
CASES.forEach(([it, yes, no], i) => test(`case ${i + 1}: ${it.title}`, () => {
  const got = ids(it);
  yes.forEach(y => assert.ok(got.includes(y), `expected ${y} in ${got}`));
  no.forEach(n => assert.ok(!got.includes(n), `did not expect ${n} in ${got}`));
}));
