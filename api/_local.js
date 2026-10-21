// Local meetings from a government's own public agenda system. Shared by the scheduled download (api/refresh.js) and
// Open Now (api/open.js). Nothing here is written or reworded; titles and links come straight from the agenda system.
const https = u => { const v = String(u || "").replace(/^http:\/\//i, "https://"); return /^https:\/\/[^\s"<>]+$/.test(v) ? v : null; };
// How often each government's list is refreshed by the schedule.
const LOCAL_EVERY = 3 * 3600e3, LOCAL_RETRY = 30 * 60e3;

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = n => String(n).padStart(2, "0");
const dayIn = (d, tz) => d.toLocaleDateString("en-CA", { timeZone: tz || "UTC" });
const longDate = iso => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const decode = s => String(s || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
// Keep only meetings from today through 30 days out, in the government's own time zone.
const inWindow = (iso, tz) => { const now = new Date(); return iso >= dayIn(now, tz) && iso <= dayIn(new Date(now.getTime() + 30 * 864e5), tz); };
const meeting = (feed, id, body, iso, read, act) => ({
  id, level: "local", kind: "Local meeting", title: `${body}, ${longDate(iso)}`, who: feed.name, summary: "",
  opened: null, closes: null, meets: iso, read: read || feed.calendar, act: act || read || feed.calendar, actLabel: "Meeting page and agenda",
  source: `${feed.name} agendas`, localId: feed.id, countyId: feed.countyId || null, placeId: feed.placeId || null, townId: feed.townId || null, state: feed.state
});

// Granicus: the "agenda feed" the system publishes for subscribers (ViewPublisherRSS.php?view_id=N&mode=agendas).
// Item titles read "City Council - Oct 27, 2026". Only the feed is read; the system's pages ask not to be crawled.
function parseGranicusFeed(xml, feed) {
  const out = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = m[1];
    const title = decode((item.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    const link = https(decode((item.match(/<link>([\s\S]*?)<\/link>/) || [])[1]));
    const dm = title.match(/^(.*?)\s+-\s+([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s+(\d{4})\s*$/);
    if (!dm || !MONTHS[dm[2].toLowerCase().slice(0, 4)] && !MONTHS[dm[2].toLowerCase().slice(0, 3)]) continue;
    const mo = MONTHS[dm[2].toLowerCase().slice(0, 4)] || MONTHS[dm[2].toLowerCase().slice(0, 3)];
    const iso = `${dm[4]}-${pad(mo)}-${pad(dm[3])}`;
    if (!inWindow(iso, feed.tz)) continue;
    const key = (link || title).replace(/[^a-z0-9]/gi, "").slice(-24);
    out.push(meeting(feed, `gr-${feed.id}-${iso}-${key}`, dm[1].trim(), iso, link, link));
  }
  return out.sort((a, b) => a.meets.localeCompare(b.meets)).slice(0, 50);
}

// CivicPlus (CivicEngage) Agenda Center: the public page lists each body's agendas, with the meeting date in each
// agenda's id ("10202026-602" is October 20, 2026).
function parseCivicPlusPage(html, feed) {
  const out = [], host = `https://${feed.host}`;
  const sections = String(html).split(/<div[^>]+class="[^"]*\blisting\b[^"]*"/).slice(1);
  for (const sec of sections) {
    const body = decode((sec.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1]) || "Meeting";
    for (const r of sec.matchAll(/<a[^>]+id="(\d{8})-(\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const d = r[1], id = r[2], iso = `${d.slice(4, 8)}-${d.slice(0, 2)}-${d.slice(2, 4)}`;
      if (!inWindow(iso, feed.tz)) continue;
      const title = decode(r[3]) || body;
      const read = `${host}/AgendaCenter/ViewFile/Agenda/_${d}-${id}`;
      out.push(meeting(feed, `cp-${feed.id}-${d}-${id}`, title.startsWith(body) ? title : `${body}: ${title}`, iso, read, `${host}/AgendaCenter`));
    }
  }
  return out.sort((a, b) => a.meets.localeCompare(b.meets)).slice(0, 50);
}

// Upcoming public meetings from a local government's own agenda system, next 30 days. getJSON fetches JSON;
// getText (optional) fetches a page or feed as text, needed for Granicus and CivicPlus.
async function localMeetings(feed, getJSON, getText) {
  if (feed.system === "granicus") {
    if (!getText) throw new Error("granicus needs a text fetcher");
    return parseGranicusFeed(await getText(`https://${feed.host}/ViewPublisherRSS.php?view_id=${encodeURIComponent(feed.viewId)}&mode=agendas`), feed);
  }
  if (feed.system === "civicplus") {
    if (!getText) throw new Error("civicplus needs a text fetcher");
    return parseCivicPlusPage(await getText(`https://${feed.host}/AgendaCenter`), feed);
  }
  // Dates are counted in the government's own time zone, so tonight's meetings aren't dropped early.
  const day = d => d.toLocaleDateString("en-CA", { timeZone: feed.tz || "UTC" });
  const now = new Date(), until = new Date(now.getTime() + 30 * 864e5);
  const q = `$filter=EventDate+ge+datetime'${day(now)}'+and+EventDate+le+datetime'${day(until)}'&$orderby=EventDate&$top=50`;
  const list = await getJSON(`https://webapi.legistar.com/v1/${feed.client}/events?${q}`);
  return (Array.isArray(list) ? list : []).map(e => {
    const body = String(e.EventBodyName || "Meeting").replace(/^[\s*]+/, "").replace(/\s+/g, " ").trim();
    const date = String(e.EventDate || "").slice(0, 10);
    return {
      id: `lg-${feed.client}-${e.EventId}`, level: "local", kind: "Local meeting",
      title: `${body}, ${new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`,
      who: feed.name, summary: [e.EventTime ? `Meets at ${e.EventTime}` : "", e.EventAgendaStatusName ? `Agenda: ${String(e.EventAgendaStatusName).toLowerCase()}` : ""].filter(Boolean).join(" · "),
      opened: null, closes: null, meets: date, read: https(e.EventAgendaFile) || https(e.EventInSiteURL) || feed.calendar,
      act: https(e.EventInSiteURL) || feed.calendar, actLabel: "Meeting page and agenda", source: `${feed.name} agendas`,
      localId: feed.id, countyId: feed.countyId || null, placeId: feed.placeId || null, townId: feed.townId || null, state: feed.state
    };
  });
}


// Which local feeds are due for a download, most out of date first. index: { feedId: { at, errAt } }.
const SYSTEMS = ["legistar", "granicus", "civicplus"];
function dueLocal(index, now, feeds) {
  return feeds.filter(f => SYSTEMS.includes(f.system))
    .map(f => ({ f, e: index[f.id] || {} }))
    .filter(({ e }) => !(e.errAt && now - e.errAt < LOCAL_RETRY))
    .filter(({ e }) => !e.at || now - e.at >= LOCAL_EVERY)
    .sort((a, b) => (a.e.at || 0) - (b.e.at || 0))
    .map(x => x.f);
}
module.exports = { localMeetings, dueLocal, parseGranicusFeed, parseCivicPlusPage, SYSTEMS, LOCAL_EVERY, LOCAL_RETRY };
