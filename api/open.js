// Civic Accord "Open now" feed. Pulls items that are open for public input straight from official sources.
// No AI touches this data. Every item carries its source and when it was fetched.
// Federal Register needs no key. Congress.gov and Open States activate when their free keys are set as
// environment variables (CONGRESS_API_KEY, OPENSTATES_API_KEY). Responses are cached at the edge and refreshed every few hours.
const FR = "https://www.federalregister.gov/api/v1/documents.json";
const STATE_NAMES = {AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",PR:"Puerto Rico",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"};

const { canonical, memo, asOf, onlyRead, publicError, getJSON: get } = require("./_shared");
// Open States' free tier allows 10 requests a minute. Each server copy stays at 8 or fewer.
const LIMITS = { "v3.openstates.org": 8 };
const getJSON = (url, headers) => get(url, headers, LIMITS);
const LOCAL = require("../registry/local-feeds.json").feeds;
const https = u => { const v = String(u || "").replace(/^http:\/\//i, "https://"); return /^https:\/\/[^\s"<>]+$/.test(v) ? v : null; };

// Upcoming public meetings from a local government's own agenda system (Legistar's public data service), next 30 days.
async function localMeetings(feed) {
  const day = d => d.toISOString().slice(0, 10);
  const now = new Date(), until = new Date(now.getTime() + 30 * 864e5);
  const q = `$filter=EventDate+ge+datetime'${day(now)}'+and+EventDate+le+datetime'${day(until)}'&$orderby=EventDate&$top=50`;
  const list = await getJSON(`https://webapi.legistar.com/v1/${feed.client}/events?${q}`);
  return (Array.isArray(list) ? list : []).map(e => {
    const body = String(e.EventBodyName || "Meeting").replace(/^[\s*]+/, "").replace(/\s+/g, " ").trim();
    const date = String(e.EventDate || "").slice(0, 10);
    return {
      id: `lg-${feed.client}-${e.EventId}`, level: "local", kind: feed.level === "county" ? "County council meeting" : "City council meeting",
      title: `${body}, ${new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`,
      who: feed.name, summary: [e.EventTime ? `Meets at ${e.EventTime}` : "", e.EventAgendaStatusName ? `Agenda: ${String(e.EventAgendaStatusName).toLowerCase()}` : ""].filter(Boolean).join(" · "),
      opened: null, closes: null, meets: date, read: https(e.EventAgendaFile) || https(e.EventInSiteURL) || feed.calendar,
      act: https(e.EventInSiteURL) || feed.calendar, actLabel: "How to testify (meeting page)", source: `${feed.name} agendas`,
      localId: feed.id, countyId: feed.countyId || null, placeId: feed.placeId || null, state: feed.state
    };
  });
}

async function federalRules() {
  const today = new Date().toISOString().slice(0, 10);
  const fields = ["title","abstract","agencies","comments_close_on","html_url","comment_url","regulations_dot_gov_url","document_number","publication_date"];
  const items = [];
  for (let page = 1; page <= 5; page++) {
    const q = new URLSearchParams({ "conditions[type][]": "PRORULE", "conditions[comment_date][gte]": today, per_page: "200", order: "newest", page: String(page) });
    fields.forEach(f => q.append("fields[]", f));
    const j = await getJSON(`${FR}?${q}`);
    (j.results || []).forEach(d => {
      // An online comment form exists only when the Federal Register links one. Otherwise the notice itself explains
      // how to comment (often by email or mail), and the button says so instead of promising a form.
      const form = d.comment_url || d.regulations_dot_gov_url || null;
      items.push({
        id: "fr-" + d.document_number, level: "federal", kind: "Proposed rule", title: d.title,
        who: (d.agencies || []).map(a => a.name).filter(Boolean).join(", "),
        summary: d.abstract || "", opened: d.publication_date, closes: d.comments_close_on,
        read: d.html_url, act: form || d.html_url, commentForm: !!form,
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
  const ENDED = /became (public|private) law|signed by (the )?president|vetoed by (the )?president|pocket vetoed|failed of passage|failed to pass/i;
  const AGREED = /agreed to/i, SIMPLE = /^(HRES|SRES)$/i;
  return (j.bills || []).filter(b => { const t = (b.latestAction && b.latestAction.text) || "";
    return !(ENDED.test(t) || (SIMPLE.test(String(b.type)) && AGREED.test(t))); }).map(b => ({
    id: `us-${b.type}${b.number}-${b.congress}`.toLowerCase(), level: "federal", kind: "Bill in Congress",
    title: `${b.type} ${b.number}: ${b.title}`, who: b.originChamber ? `${b.originChamber}` : "Congress",
    summary: b.latestAction ? `Latest action (${b.latestAction.actionDate}): ${b.latestAction.text}` : "",
    opened: b.introducedDate || null, closes: null,
    read: `https://www.congress.gov/bill/${ordinal(b.congress)}-congress/${BILL_PATH[String(b.type).toUpperCase()] || "house-bill"}/${b.number}`,
    act: null, actLabel: null, source: "Congress.gov"
  }));
}

async function stateBills(key, st, out) {
  const name = STATE_NAMES[st]; if (!name) return [];
  const body = st === "DC" ? "D.C. Council" : `${name} legislature`;
  const H = { "X-API-KEY": key };
  const today = new Date().toISOString().slice(0, 10);
  // 1. Is the legislature in session? Ask Open States for its sessions.
  // Session dates change rarely, so they are remembered for a day and a busy minute never wastes this call.
  const jur = await memo("jur-" + st, 24 * 3600e3, () => getJSON(`https://v3.openstates.org/jurisdictions/${encodeURIComponent(name)}?include=legislative_sessions`, H));
  const sessions = (jur.legislative_sessions || []).filter(x => x.start_date);
  const active = sessions.filter(x => x.start_date.slice(0, 10) <= today && (!x.end_date || x.end_date.slice(0, 10) >= today))
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  if (!active.length) {
    const next = sessions.filter(x => x.start_date.slice(0, 10) > today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
    out.quiet = `The ${body} isn't in session right now, so no bills are moving.` + (next ? ` Its next session, ${next.name}, starts ${new Date(next.start_date.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}.` : " Bills appear here as soon as the next session opens.");
    return [];
  }
  // 2. Bills from the current session that are still moving.
  // A bill is finished only when its latest action says the bill itself ended. Words like "failed" or "tabled" alone
  // aren't enough: "Amendment failed" or "Motion tabled" happen on bills that are still moving.
  const BILL_END = [
    /^(signed|approved) by (the )?governor/i, /^became law/i, /^became effective/i, /^chaptered/i, /^enacted/i,
    /^act( no\.)? ?\d+/i, /^session law/i, /^(vetoed|veto sustained)/i, /^filed with(out)? (the )?governor'?s signature/i,
    /^indefinitely postponed/i, /\bdied in committee\b/i,
    /^signed chap/i, /^approval memo/i, /^veto memo/i  // New York: governor signed (chapter) or vetoed
  ];
  // "Failed", "died", and "withdrawn" end a bill only when they're about the bill itself, not an amendment, a motion,
  // or a step like "Withdrawn from committee", which moves a bill forward.
  const ABOUT_PART = /amendment|motion|from committee|from the committee|report|reconsider/i;
  const done = b => {
    const t = String(b.latest_action_description || "").trim();
    if (BILL_END.some(re => re.test(t))) return true;
    if (/^(bill )?(failed|died|dead|withdrawn)\b/i.test(t) && !ABOUT_PART.test(t)) return true;
    // "Adopted" ends a resolution, but on a bill it usually means a committee report or amendment was adopted.
    const isResolution = (b.classification || []).some(c => /resolution/i.test(c));
    if (isResolution && /^(resolution )?adopted\b/i.test(t) && !ABOUT_PART.test(t)) return true;
    return false;
  };
  const PAGES = 3; // Up to 60 most recently active bills. The free tier allows 10 requests a minute; results are cached 6 hours.
  let results = [], total = null;
  for (let page = 1; page <= PAGES; page++) {
    const q = new URLSearchParams({ jurisdiction: name, session: active[0].identifier, sort: "latest_action_desc", per_page: "20", page: String(page) });
    let j;
    // If a later page is refused (for example, the source is busy), keep what we already have instead of failing.
    try { j = await getJSON(`https://v3.openstates.org/bills?${q}`, H); } catch (e) { if (page === 1) throw e; out.cut = true; break; }
    results.push(...(j.results || []));
    const pg = j.pagination || {};
    if (total === null && typeof pg.total_items === "number") total = pg.total_items;
    if (!pg.max_page || page >= pg.max_page) break;
  }
  const checked = results.length;
  results = results.filter(b => !done(b));
  if (total !== null && total > checked) out.partial = `Showing bills from the ${checked} most recently active of ${total.toLocaleString("en-US")} in this session, leaving out ones that are finished. See every bill on the ${body}'s website.`;
  if (!results.length) out.quiet = `No bills are moving in the ${body} right now. New bills appear here as soon as they're filed.`;
  return results.map(b => ({
    id: "os-" + b.id, level: "state", kind: "Bill in the " + body,
    title: `${b.identifier}: ${b.title}`, who: b.from_organization ? b.from_organization.name : name + " Legislature",
    summary: b.latest_action_description ? `Latest action (${String(b.latest_action_date).slice(0, 10)}): ${b.latest_action_description}` : "",
    opened: b.first_action_date ? String(b.first_action_date).slice(0, 10) : null, closes: null, read: b.openstates_url, act: null, actLabel: null, source: "Open States"
  }));
}

module.exports = async (req, res) => {
  if (onlyRead(req, res)) return;
  let st = String((req.query && req.query.state) || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  if (!STATE_NAMES[st]) st = "";
  if (canonical(req, res, "/api/open", { state: st })) return;
  const out = { fetchedAt: new Date().toISOString(), items: [], sources: [], notConnected: [], errors: [] };
  const run = async (label, short, url, fn) => { try { const it = await fn(); out.items.push(...it); out.sources.push({ label, url, count: it.length }); } catch (e) { out.errors.push(publicError(short, e)); } };
  await run("Federal Register: proposed rules open for public comment", "Federal rules", "https://www.federalregister.gov/developers/documentation/api/v1", () => memo("fr", 3 * 3600e3, federalRules));
  if (process.env.CONGRESS_API_KEY) await run("Congress.gov: the 100 most recently updated bills, leaving out finished ones", "Bills in Congress", "https://api.congress.gov/", () => memo("congress", 3 * 3600e3, () => congressBills(process.env.CONGRESS_API_KEY)));
  else out.notConnected.push({ label: "Bills in Congress", how: "Needs a free Congress.gov API key", url: "https://api.congress.gov/sign-up/" });
  if (st) {
    if (process.env.OPENSTATES_API_KEY) await run(`Open States: bills still moving in the ${STATE_NAMES[st]} legislature`, "State bills", "https://docs.openstates.org/api-v3/", async () => { const r = await memo("st-" + st, 6 * 3600e3, async () => { const o = {}; const items = await stateBills(process.env.OPENSTATES_API_KEY, st, o); return { items, quiet: o.quiet, partial: o.partial, shortLife: !!o.cut }; }); if (r.shortLife) out.shortLife = true; if (r.quiet) out.quiet = r.quiet; if (r.partial) out.partial = r.partial; return r.items; });
    else out.notConnected.push({ label: `Bills in the ${STATE_NAMES[st]} legislature`, how: "Needs a free Open States API key", url: "https://open.pluralpolicy.com/accounts/profile/" });
  }
  // Show when the oldest list here was really fetched, in case a saved copy is being used while a source is down.
  for (const feed of LOCAL.filter(f => st && f.state === st && f.system === "legistar")) {
    await run(`${feed.name}: public meetings in the next 30 days`, "Local meetings", feed.calendar, () => memo("lg-" + feed.id, 3 * 3600e3, () => localMeetings(feed)));
  }
  const times = ["fr", "congress", st && "st-" + st].filter(Boolean).map(asOf).filter(Boolean);
  if (times.length) out.fetchedAt = new Date(Math.min(...times)).toISOString();
  const shortLife = out.shortLife; delete out.shortLife;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", out.errors.length || shortLife ? "public, s-maxage=120" : "public, s-maxage=21600, stale-while-revalidate=172800");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).send(JSON.stringify(out));
};
