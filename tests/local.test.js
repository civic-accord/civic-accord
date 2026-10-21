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

// Readers for other agenda systems, on captured samples. Dates are chosen relative to "now" so the 30-day window holds.
const { parseGranicusFeed, parseCivicPlusPage } = require("../api/_local.js");
const soon = n => { const d = new Date(Date.now() + n * 864e5); return d; };
const mon = d => d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
const iso = d => d.toISOString().slice(0, 10);
const mmddyyyy = d => iso(d).slice(5, 7) + iso(d).slice(8, 10) + iso(d).slice(0, 4);

test("Granicus agenda feed: title carries the body and date; link is kept; past and far-off items are dropped", () => {
  const a = soon(6), b = soon(45), c = soon(-3);
  const xml = `<rss><channel><title>City of Eagle, ID: City Council View (Agenda Feed)</title>
    <item><title>City Council - ${mon(a)} ${a.getUTCDate()}, ${a.getUTCFullYear()}</title><link>https://eagle-id.granicus.com/AgendaViewer.php?view_id=10&amp;event_id=1</link><pubDate>x</pubDate></item>
    <item><title>Planning &amp; Zoning - ${mon(b)} ${b.getUTCDate()}, ${b.getUTCFullYear()}</title><link>https://eagle-id.granicus.com/AgendaViewer.php?view_id=10&amp;event_id=2</link></item>
    <item><title>City Council - ${mon(c)} ${c.getUTCDate()}, ${c.getUTCFullYear()}</title><link>https://eagle-id.granicus.com/AgendaViewer.php?view_id=10&amp;event_id=3</link></item>
    <item><title>No date here</title><link>https://eagle-id.granicus.com/x</link></item></channel></rss>`;
  const feed = { id: "id-eagle", name: "Eagle City Council", state: "ID", placeId: "1623410", system: "granicus", host: "eagle-id.granicus.com", viewId: "10", calendar: "https://eagle-id.granicus.com/ViewPublisher.php?view_id=10", tz: "UTC" };
  const out = parseGranicusFeed(xml, feed);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].meets, iso(a));
  assert.ok(out[0].title.startsWith("City Council, "));
  assert.strictEqual(out[0].read, "https://eagle-id.granicus.com/AgendaViewer.php?view_id=10&event_id=1");
  assert.strictEqual(out[0].placeId, "1623410");
});

test("CivicPlus Agenda Center: body from the section heading, date from the agenda id, link to the agenda", () => {
  const a = soon(4), old = soon(-10);
  const html = `<div id="cat2" class="listing listingCollapse noHeader"><h2>City Council</h2><table><tr class="catAgendaRow"><td>
      <h3 class="noMargin" id="h4${mmddyyyy(a)}-602"><strong><abbr>Oct</abbr> 20, 2026</strong></h3>
      <p><a id="${mmddyyyy(a)}-602" href="/AgendaCenter/ViewFile/Agenda/_${mmddyyyy(a)}-602?html=true">City Council Regular Session at 7 p.m.</a></p></td></tr>
      <tr class="catAgendaRow"><td><p><a id="${mmddyyyy(old)}-590" href="/x">City Council Regular Session</a></p></td></tr></table></div>
    <div id="cat9" class="listing listingCollapse"><h2>Planning Commission</h2><table><tr><td><p><a id="${mmddyyyy(a)}-603" href="/y">Regular meeting at 6 p.m.</a></p></td></tr></table></div>`;
  const feed = { id: "mo-nevada", name: "Nevada City Council", state: "MO", placeId: "2951932", system: "civicplus", host: "nevadamo.gov", calendar: "https://nevadamo.gov/AgendaCenter", tz: "UTC" };
  const out = parseCivicPlusPage(html, feed);
  assert.strictEqual(out.length, 2);
  assert.strictEqual(out[0].title, `City Council Regular Session at 7 p.m., ${new Date(iso(a) + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`);
  assert.strictEqual(out[0].read, `https://nevadamo.gov/AgendaCenter/ViewFile/Agenda/_${mmddyyyy(a)}-602`);
  assert.ok(out[1].title.startsWith("Planning Commission: Regular meeting"));
});
