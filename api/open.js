// Civic Accord "Open now" feed. Pulls items that are open for public input straight from official sources.
// No AI touches this data. Every item carries its source and when it was fetched.
// Federal Register needs no key. Congress.gov and Open States activate when their free keys are set as
// environment variables (CONGRESS_API_KEY, OPENSTATES_API_KEY). Responses are cached at the edge and refreshed every few hours.
const FR = "https://www.federalregister.gov/api/v1/documents.json";

const { canonical, memo, asOf, isStale, onlyRead, publicError, getJSON: get } = require("./_shared");
const { STATE_NAMES, stateBills } = require("./_states");
const { CONGRESS_ENDED } = require("./_final");
const store = require("./_store");
// Open States' free tier allows 10 requests a minute. Each server copy stays at 8 or fewer.
const LIMITS = { "v3.openstates.org": 8 };
const getJSON = (url, headers) => get(url, headers, LIMITS);
const LOCAL = require("../registry/local-feeds.json").feeds;
const https = u => { const v = String(u || "").replace(/^http:\/\//i, "https://"); return /^https:\/\/[^\s"<>]+$/.test(v) ? v : null; };

// Upcoming public meetings from a local government's own agenda system (Legistar's public data service), next 30 days.
async function localMeetings(feed) {
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

async function federalRules() {
  // Federal comment deadlines are normally end of day Eastern time, so "today" is counted in Eastern time.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const fields = ["title","abstract","agencies","comments_close_on","html_url","comment_url","regulations_dot_gov_url","document_number","publication_date"];
  const items = [];
  for (let page = 1; page <= 5; page++) {
    const q = new URLSearchParams({ "conditions[type][]": "PRORULE", "conditions[comment_date][gte]": today, per_page: "200", order: "newest", page: String(page) });
    fields.forEach(f => q.append("fields[]", f));
    const j = await getJSON(`${FR}?${q}`);
    (j.results || []).forEach(d => {
      // An online comment form exists only when the Federal Register links one. Otherwise the notice itself explains
      // how to comment (often by email or mail), and the button says so instead of promising a form.
      // The Federal Register often lists these links as http://; they're upgraded to https:// here, because pages
      // only show https links.
      const form = https(d.comment_url) || https(d.regulations_dot_gov_url) || null;
      items.push({
        id: "fr-" + d.document_number, level: "federal", kind: "Proposed rule", title: d.title,
        who: (d.agencies || []).map(a => a.name).filter(Boolean).join(", "),
        summary: d.abstract || "", opened: d.publication_date, closes: d.comments_close_on,
        read: https(d.html_url), act: form || https(d.html_url), commentForm: !!form,
        actLabel: form ? "Comment officially" : "How to comment (in the notice)", source: "Federal Register"
      });
    });
    if (!j.next_page_url) break;
  }
  // A correction (document number "C1-…") repeats a rule that's already listed. Keep one card per rule.
  const have = new Set(items.map(i => i.id));
  return items.filter(i => { const m = /^fr-C\d+-(.+)$/.exec(i.id); return !(m && have.has("fr-" + m[1])); });
}

const BILL_PATH = { HR: "house-bill", S: "senate-bill", HRES: "house-resolution", SRES: "senate-resolution", HJRES: "house-joint-resolution", SJRES: "senate-joint-resolution", HCONRES: "house-concurrent-resolution", SCONRES: "senate-concurrent-resolution" };
const ordinal = n => { n = Number(n); const t = n % 100, o = n % 10; return n + (t >= 11 && t <= 13 ? "th" : o === 1 ? "st" : o === 2 ? "nd" : o === 3 ? "rd" : "th"); };
async function congressBills(key) {
  const j = await getJSON(`https://api.congress.gov/v3/bill?format=json&sort=updateDate+desc&limit=100&api_key=${encodeURIComponent(key)}`);
  // Leave out bills that are finished: law, vetoed, failed, or a one-chamber resolution already agreed to.
  const ENDED = CONGRESS_ENDED;
  const AGREED = { test: t => (/agreed to/i.test(t) && !/motion to (refer|table|recommit|reconsider)|with an amendment|with amendments/i.test(t)) || /motion to reconsider laid on the table agreed to/i.test(t) }, SIMPLE = /^(HRES|SRES)$/i, CONCURRENT = /^(HCONRES|SCONRES)$/i;
  // A concurrent resolution is finished once the second chamber agrees to it. Its latest action then names that chamber
  // (for example, "Received in the Senate, considered, and agreed to" for a House concurrent resolution).
  const secondChamberAgreed = b => { const t = (b.latestAction && b.latestAction.text) || "", type = String(b.type).toUpperCase();
    return CONCURRENT.test(type) && AGREED.test(t) && (type === "HCONRES" ? /Senate/i.test(t) : /House/i.test(t)) && !/message on/i.test(t); };
  return (j.bills || []).filter(b => { const t = (b.latestAction && b.latestAction.text) || "";
    return !(ENDED.test(t) || (SIMPLE.test(String(b.type)) && AGREED.test(t)) || secondChamberAgreed(b)); }).map(b => ({
    id: `us-${b.type}${b.number}-${b.congress}`.toLowerCase(), level: "federal", kind: "Bill in Congress",
    title: `${b.type} ${b.number}: ${b.title}`, who: b.originChamber ? `${b.originChamber}` : "Congress",
    summary: b.latestAction ? `Latest action (${b.latestAction.actionDate}): ${b.latestAction.text}` : "",
    opened: b.introducedDate || null, closes: null,
    read: `https://www.congress.gov/bill/${ordinal(b.congress)}-congress/${BILL_PATH[String(b.type).toUpperCase()] || "house-bill"}/${b.number}`,
    act: null, actLabel: null, source: "Congress.gov"
  }));
}

module.exports = async (req, res) => {
  if (onlyRead(req, res)) return;
  let st = String((req.query && req.query.state) || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  if (!STATE_NAMES[st]) st = "";
  if (canonical(req, res, "/api/open", { state: st })) return;
  const out = { fetchedAt: new Date().toISOString(), items: [], sources: [], notConnected: [], errors: [] };
  let savedAt = null, maxAge = 21600;
  // Each source reports when its list was really fetched, and whether a refresh just failed (so an older list is shown).
  // meta lets a source report its own download time (saved copies of state lists carry theirs).
  const run = async (label, short, url, fn, key, meta) => { try { const it = await fn(); out.items.push(...it); out.sources.push({ label, url, count: it.length, at: meta && meta.at ? meta.at : key && asOf(key) ? new Date(asOf(key)).toISOString() : null, stale: meta && "stale" in meta ? meta.stale : !!(key && isStale(key)) }); } catch (e) { out.errors.push(publicError(short, e)); } };
  await run("Federal Register: proposed rules open for public comment", "Federal rules", "https://www.federalregister.gov/", () => memo("fr", 3 * 3600e3, federalRules), "fr");
  if (process.env.CONGRESS_API_KEY) await run("Congress.gov: the 100 most recently updated bills, leaving out finished ones", "Bills in Congress", "https://www.congress.gov/", () => memo("congress", 3 * 3600e3, () => congressBills(process.env.CONGRESS_API_KEY)), "congress");
  else out.notConnected.push({ label: "Bills in Congress", how: "Needs a free Congress.gov API key", url: "https://api.congress.gov/sign-up/" });
  if (st) {
    // With a saved-copy store connected, state lists come from the scheduled download (api/refresh.js). Visits call
    // Open States for a list only if it hasn't been downloaded yet or the store can't be read, and then only within
    // the shared limit.
    if (process.env.OPENSTATES_API_KEY && store.on()) { const meta = {}; await run(`Open States: bills still moving in the ${STATE_NAMES[st]} legislature`, "State bills", "https://openstates.org/", async () => {
      const r = await memo("saved-st-" + st, 5 * 60e3, () => store.read(`states/${st}.json`)).catch(() => null);
      // Not downloaded yet (for example, right after the store is connected): fetch it now, taking turns from the same
      // shared limit as everything else, and remember it in this copy for 6 hours.
      if (!r) { const live = await memo("st-" + st, 6 * 3600e3, async () => { const o = {}; const items = await stateBills(process.env.OPENSTATES_API_KEY, st, o, (u, h) => get(u, h, LIMITS, "items")); return { items, quiet: o.quiet, partial: o.partial, shortLife: !!o.cut }; });
        meta.at = asOf("st-" + st) ? new Date(asOf("st-" + st)).toISOString() : null; meta.stale = isStale("st-" + st);
        if (live.quiet) out.quiet = live.quiet; if (live.partial) out.partial = live.partial; out.shortLife = true; return live.items; }
      const d = r.data, age = Date.now() - Date.parse(d.at);
      // A list more than 36 hours old isn't shown: bills on it may have been signed or vetoed since.
      if (!(age <= 36 * 3600e3)) { out.quiet = "This list is out of date, so it isn't shown. It's being downloaded again; check back in a few hours."; out.shortLife = true; return []; }
      meta.at = d.at;
      // Lists in session are refreshed every few hours; others about daily. Older than that means downloads are behind.
      const staleIn = (d.items.length ? 12 : 30) * 3600e3 - age;
      meta.stale = staleIn <= 0;
      // This answer is cached only until the list would become out of date.
      if (!meta.stale) maxAge = Math.min(maxAge, Math.max(120, Math.floor(staleIn / 1000)));
      if (d.quiet) out.quiet = d.quiet; if (d.partial) out.partial = d.partial; if (d.cut) out.shortLife = true;
      return d.items; }, null, meta);
      if (meta.at) savedAt = Date.parse(meta.at); }
    else if (process.env.OPENSTATES_API_KEY) await run(`Open States: bills still moving in the ${STATE_NAMES[st]} legislature`, "State bills", "https://openstates.org/", async () => { const r = await memo("st-" + st, 6 * 3600e3, async () => { const o = {}; const items = await stateBills(process.env.OPENSTATES_API_KEY, st, o, getJSON); return { items, quiet: o.quiet, partial: o.partial, shortLife: !!o.cut }; }); if (r.shortLife) out.shortLife = true; if (r.quiet) out.quiet = r.quiet; if (r.partial) out.partial = r.partial; return r.items; }, "st-" + st);
    else out.notConnected.push({ label: `Bills in the ${STATE_NAMES[st]} legislature`, how: "Needs a free Open States API key", url: "https://open.pluralpolicy.com/accounts/profile/" });
  }
  // Keep the feed light on phones: summaries are cut at a word near 700 characters. The full summary is on each item's
  // own page (talk it through) and the official page.
  out.items = out.items.map(i => i.summary && i.summary.length > 700 ? { ...i, summary: i.summary.slice(0, 700).replace(/\s+\S*$/, "") + "…", summaryCut: true } : i);
  // Show when the oldest list here was really fetched, in case a saved copy is being used while a source is down.
  for (const feed of LOCAL.filter(f => st && f.state === st && f.system === "legistar")) {
    await run(`${feed.name}: public meetings in the next 30 days`, "Local meetings", feed.calendar, () => memo("lg-" + feed.id, 3 * 3600e3, () => localMeetings(feed)), "lg-" + feed.id);
  }
  const times = ["fr", "congress", st && !savedAt && "st-" + st, ...LOCAL.filter(f => st && f.state === st).map(f => "lg-" + f.id)].filter(Boolean).map(asOf).concat(savedAt ? [savedAt] : []).filter(Boolean);
  if (times.length) out.fetchedAt = new Date(Math.min(...times)).toISOString();
  // A list kept only because a refresh failed is cached briefly, so the next visit tries again soon.
  const shortLife = out.shortLife || out.sources.some(x => x.stale); delete out.shortLife;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", out.errors.length || shortLife ? "public, s-maxage=120" : `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge >= 21600 ? 3600 : 60}`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).send(JSON.stringify(out));
};
