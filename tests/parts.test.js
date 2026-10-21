// Official summaries: short provisions are kept, lead-ins stay attached, headings are counted and disclosed.
const test = require("node:test"), assert = require("node:assert");
const { partsFrom } = require("../api/item.js");
const texts = r => r.parts.map(p => p.text);

test("a short provision stays (plain-text bullets)", () => {
  const r = partsFrom("This bill:\n• Repeals the tax.\n• Establishes a new reporting requirement for all employers.");
  assert.deepStrictEqual(texts(r), ["Repeals the tax.", "Establishes a new reporting requirement for all employers."]);
  assert.ok(r.parts.every(p => p.lead === "This bill:"));
});
test("a short provision stays (HTML list) and the lead-in is attached", () => {
  const r = partsFrom("<p>This bill:</p><ul><li>bans X;</li><li>funds Y.</li></ul>");
  assert.deepStrictEqual(texts(r), ["bans X;", "funds Y."]);
  assert.strictEqual(r.parts[0].lead, "This bill:");
});
test("a short sentence outside a list stays", () => {
  assert.deepStrictEqual(texts(partsFrom("<p>Repeals the tax.</p>")), ["Repeals the tax."]);
});
test("headings and titles are left out and counted", () => {
  const r = partsFrom("<p><strong>Invasive Species Act</strong></p><p>TITLE I--FARMS</p><p>(Sec. 101) This section bans X.</p>");
  assert.deepStrictEqual(texts(r), ["(Sec. 101) This section bans X."]);
  assert.strictEqual(r.headings, 2);
});
test("nested list: inner items keep the nearest lead-in", () => {
  const r = partsFrom("<p>A state with a payment error rate that is</p><ul><li>at least 6% must contribute 5%,</li><li>10% or greater must contribute 15%.</li></ul>");
  assert.strictEqual(r.parts.length, 2);
  assert.ok(r.parts.every(p => p.lead === "A state with a payment error rate that is"));
});
test("background is attached, not voted on", () => {
  const r = partsFrom("<p>(Sec. 2) This section changes the plan.</p><p>As background, the plan started in 2018.</p>");
  assert.strictEqual(r.parts.length, 1);
  assert.match(r.parts[0].background, /^As background/);
  const c = partsFrom("Existing law requires the department to inspect cargo.\n\nThis bill would establish a program.");
  assert.strictEqual(c.parts.length, 1);
  assert.match(c.parts[0].background, /^Existing law/);
});
test("exact repeats are counted, not shown twice", () => {
  const r = partsFrom("<p>This section bans X.</p><p>This section bans X.</p>");
  assert.strictEqual(r.parts.length, 1);
  assert.strictEqual(r.repeats, 1);
});
test("long summaries disclose the display limit", () => {
  const r = partsFrom(Array.from({ length: 40 }, (_, i) => `<p>Provision number ${i} does a thing.</p>`).join(""));
  assert.strictEqual(r.parts.length, 30);
  assert.strictEqual(r.more, true);
  assert.strictEqual(r.shownOf, 40);
});
test("state summaries without a final period are kept", () => {
  assert.deepStrictEqual(texts(partsFrom("Appropriates funds for invasive species control")), ["Appropriates funds for invasive species control"]);
  assert.deepStrictEqual(texts(partsFrom("Relates to the sale of raw milk")), ["Relates to the sale of raw milk"]);
});
test("California-style and short lines inside paragraphs are kept", () => {
  assert.deepStrictEqual(texts(partsFrom("<p>This bill would require the department to report by 2028</p>")), ["This bill would require the department to report by 2028"]);
  assert.deepStrictEqual(texts(partsFrom("<p>Requires reporting</p>")), ["Requires reporting"]);
});
test("a bullet on the very first line, and numbered lines, are list items", () => {
  assert.deepStrictEqual(texts(partsFrom("• Repeals the tax.\n• Funds the program.")), ["Repeals the tax.", "Funds the program."]);
  assert.deepStrictEqual(texts(partsFrom("1. Repeals the tax.\n2. Funds the program.")), ["Repeals the tax.", "Funds the program."]);
});
test("hyphenated words aren't mistaken for bullets", () => {
  assert.deepStrictEqual(texts(partsFrom("A well-known risk-based approach is used.")), ["A well-known risk-based approach is used."]);
});
test("if everything looks like a heading, nothing is left out", () => {
  assert.deepStrictEqual(texts(partsFrom("<p><strong>Relating to agriculture</strong></p>")), ["Relating to agriculture"]);
});
