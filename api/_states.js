// State bills from Open States, shared by Open Now (api/open.js) and the scheduled download (api/refresh.js).
// Files starting with "_" are not public routes.
const { memo } = require("./_shared");
const { stateEnded, simpleResolution } = require("./_final");
const STATE_NAMES = {AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",PR:"Puerto Rico",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"};

// getJSON is passed in, so each caller applies its own limit.
async function stateBills(key, st, out, getJSON, loadSessions) {
  const name = STATE_NAMES[st]; if (!name) return [];
  const body = st === "DC" ? "D.C. Council" : `${name} legislature`;
  const H = { "X-API-KEY": key };
  const today = new Date().toISOString().slice(0, 10);
  // 1. Is the legislature in session? Ask Open States for its sessions.
  // Session dates change rarely, so they are remembered for a day and a busy minute never wastes this call.
  // A caller may keep session dates itself (the scheduled download saves them); otherwise they're remembered in this copy.
  const fetchSessions = async () => ((await getJSON(`https://v3.openstates.org/jurisdictions/${encodeURIComponent(name)}?include=legislative_sessions`, H)).legislative_sessions || [])
    .map(x => ({ identifier: x.identifier, name: x.name, start_date: x.start_date, end_date: x.end_date, classification: x.classification || null }));
  const all = loadSessions ? await loadSessions(fetchSessions) : await memo("jur-" + st, 24 * 3600e3, fetchSessions);
  const sessions = all.filter(x => x.start_date);
  // A regular session with no end date counts as open only if no later regular session has started since.
  const started = sessions.filter(x => x.start_date.slice(0, 10) <= today).sort((a, b) => b.start_date.localeCompare(a.start_date));
  const special = x => x.classification === "special" || /special|extraordinary/i.test(`${x.name || ""} ${x.identifier || ""}`);
  // A special session with no end date counts only in its first 60 days (special sessions are short).
  const daysSince = d => (Date.parse(today + "T00:00:00Z") - Date.parse(d.slice(0, 10) + "T00:00:00Z")) / 864e5;
  const active = started.filter(x => x.end_date ? x.end_date.slice(0, 10) >= today
      : special(x) ? daysSince(x.start_date) <= 60
      : !started.some(y => !special(y) && y.start_date > x.start_date))
    // The regular session first, so its bills aren't hidden by a special session running at the same time.
    .sort((a, b) => (special(a) - special(b)) || b.start_date.localeCompare(a.start_date));
  out.inSession = active.length > 0;
  // When the next session starts, so a scheduled download can check more often as that day nears.
  const upcoming = sessions.filter(x => x.start_date.slice(0, 10) > today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  out.nextStart = upcoming ? upcoming.start_date.slice(0, 10) : null;
  if (!sessions.length) {
    out.inSession = false;
    out.quiet = `We couldn't confirm whether the ${body} is in session: its session dates aren't in the open data yet. See the ${body}'s website for bills.`;
    return [];
  }
  if (!active.length) {
    const next = sessions.filter(x => x.start_date.slice(0, 10) > today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
    out.quiet = `The ${body} isn't in session right now, so no bills are moving.` + (next ? ` Its next session, ${next.name}, starts ${new Date(next.start_date.slice(0, 10) + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}.` : " Bills appear here as soon as the next session opens.");
    return [];
  }
  // 2. Bills from the current session that are still moving.
  // A bill is finished only when its latest action says the bill itself ended. Words like "failed" or "tabled" alone
  // aren't enough: "Amendment failed" or "Motion tabled" happen on bills that are still moving.
  const done = b => stateEnded(b.latest_action_description, simpleResolution(b.classification));
  const PAGES = out.pages || 3; // Up to 60 most recently active bills (the scheduled download may ask for fewer when many legislatures are in session). The free tier allows 10 requests a minute; results are cached 6 hours.
  let results = [], total = null;
  // When a special session runs alongside the regular one, both are read (the second with one page), so neither is hidden.
  const reading = active.slice(0, 2);
  for (let si = 0; si < reading.length; si++) {
    const pages = si === 0 ? PAGES : 1;
    for (let page = 1; page <= pages; page++) {
      const q = new URLSearchParams({ jurisdiction: name, session: reading[si].identifier, sort: "latest_action_desc", per_page: "20", page: String(page) });
      let j;
      // If a later call is refused (for example, the source is busy), keep what we already have instead of failing.
      try { j = await getJSON(`https://v3.openstates.org/bills?${q}`, H); } catch (e) { if (si === 0 && page === 1) throw e; out.cut = true; break; }
      results.push(...(j.results || []));
      const pg = j.pagination || {};
      if (page === 1 && typeof pg.total_items === "number") total = (total || 0) + pg.total_items;
      if (!pg.max_page || page >= pg.max_page) break;
    }
  }
  if (reading.length > 1) results.sort((a, b) => String(b.latest_action_date || "").localeCompare(String(a.latest_action_date || "")));
  const checked = results.length;
  results = results.filter(b => !done(b));
  if (total !== null && total > checked) out.partial = `Showing bills from the ${checked} most recently active of ${total.toLocaleString("en-US")} in ${reading.length > 1 ? "these sessions" : "this session"}, leaving out ones that are finished. See every bill on the ${body}'s website.`;
  if (!results.length) out.quiet = `No bills are moving in the ${body} right now. New bills appear here as soon as they're filed.`;
  return results.map(b => ({
    id: "os-" + b.id, level: "state", kind: "Bill in the " + body,
    title: `${b.identifier}: ${b.title}`, who: b.from_organization ? b.from_organization.name : name + " Legislature",
    summary: b.latest_action_description ? `Latest action (${String(b.latest_action_date).slice(0, 10)}): ${b.latest_action_description}` : "",
    opened: b.first_action_date ? String(b.first_action_date).slice(0, 10) : null, closes: null, read: b.openstates_url, act: null, actLabel: null, source: "Open States"
  }));
}

module.exports = { STATE_NAMES, stateBills };
