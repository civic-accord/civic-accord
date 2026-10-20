// Civic Accord "Open now" feed. Pulls items that are open for public input straight from official sources.
// No AI touches this data. Every item carries its source and when it was fetched.
// Federal Register needs no key. Congress.gov and Open States activate when their free keys are set as
// environment variables (CONGRESS_API_KEY, OPENSTATES_API_KEY). Responses are cached at the edge and refreshed every few hours.
const FR = "https://www.federalregister.gov/api/v1/documents.json";
const STATE_NAMES = {AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",PR:"Puerto Rico",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"};

async function getJSON(url, headers) {
  const r = await fetch(url, { headers: { "User-Agent": "CivicAccord/1.0 (+https://civicaccord.org)", ...(headers || {}) } });
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`);
  return r.json();
}

async function federalRules() {
  const today = new Date().toISOString().slice(0, 10);
  const fields = ["title","abstract","agencies","comments_close_on","html_url","comment_url","regulations_dot_gov_url","document_number","publication_date"];
  const items = [];
  for (let page = 1; page <= 5; page++) {
    const q = new URLSearchParams({ "conditions[type][]": "PRORULE", "conditions[comment_date][gte]": today, per_page: "200", order: "newest", page: String(page) });
    fields.forEach(f => q.append("fields[]", f));
    const j = await getJSON(`${FR}?${q}`);
    (j.results || []).forEach(d => items.push({
      id: "fr-" + d.document_number, level: "federal", kind: "Proposed rule", title: d.title,
      who: (d.agencies || []).map(a => a.name).filter(Boolean).join(", "),
      summary: d.abstract || "", opened: d.publication_date, closes: d.comments_close_on,
      read: d.html_url, act: d.comment_url || d.regulations_dot_gov_url || d.html_url,
      actLabel: "Comment officially", source: "Federal Register"
    }));
    if (!j.next_page_url) break;
  }
  return items;
}

async function congressBills(key) {
  const j = await getJSON(`https://api.congress.gov/v3/bill?format=json&sort=updateDate+desc&limit=100&api_key=${encodeURIComponent(key)}`);
  return (j.bills || []).map(b => ({
    id: `us-${b.type}${b.number}-${b.congress}`.toLowerCase(), level: "federal", kind: "Bill in Congress",
    title: `${b.type} ${b.number}: ${b.title}`, who: b.originChamber ? `${b.originChamber}` : "Congress",
    summary: b.latestAction ? `Latest action (${b.latestAction.actionDate}): ${b.latestAction.text}` : "",
    opened: b.introducedDate || null, closes: null,
    read: `https://www.congress.gov/bill/${b.congress}th-congress/${b.originChamber === "Senate" ? "senate" : "house"}-bill/${b.number}`,
    act: null, actLabel: null, source: "Congress.gov"
  }));
}

async function stateBills(key, st) {
  const name = STATE_NAMES[st]; if (!name) return [];
  const q = new URLSearchParams({ jurisdiction: name, sort: "updated_desc", per_page: "50" });
  const j = await getJSON(`https://v3.openstates.org/bills?${q}`, { "X-API-KEY": key });
  return (j.results || []).map(b => ({
    id: "os-" + b.id, level: "state", kind: "Bill in the " + (b.jurisdiction && b.jurisdiction.name ? b.jurisdiction.name : name) + " legislature",
    title: `${b.identifier}: ${b.title}`, who: b.from_organization ? b.from_organization.name : name + " Legislature",
    summary: b.latest_action_description ? `Latest action (${b.latest_action_date}): ${b.latest_action_description}` : "",
    opened: b.first_action_date || null, closes: null, read: b.openstates_url, act: null, actLabel: null, source: "Open States"
  }));
}

module.exports = async (req, res) => {
  const st = String((req.query && req.query.state) || "").toUpperCase().slice(0, 2);
  const out = { fetchedAt: new Date().toISOString(), items: [], sources: [], notConnected: [], errors: [] };
  const run = async (label, url, fn) => { try { const it = await fn(); out.items.push(...it); out.sources.push({ label, url, count: it.length }); } catch (e) { out.errors.push(`${label}: ${e.message}`); } };
  await run("Federal Register: proposed rules open for public comment", "https://www.federalregister.gov/developers/documentation/api/v1", federalRules);
  if (process.env.CONGRESS_API_KEY) await run("Congress.gov: recently active bills", "https://api.congress.gov/", () => congressBills(process.env.CONGRESS_API_KEY));
  else out.notConnected.push({ label: "Bills in Congress", how: "Needs a free Congress.gov API key", url: "https://api.congress.gov/sign-up/" });
  if (st) {
    if (process.env.OPENSTATES_API_KEY) await run(`Open States: recently active bills in ${STATE_NAMES[st] || st}`, "https://docs.openstates.org/api-v3/", () => stateBills(process.env.OPENSTATES_API_KEY, st));
    else out.notConnected.push({ label: `Bills in the ${STATE_NAMES[st] || st} legislature`, how: "Needs a free Open States API key", url: "https://open.pluralpolicy.com/accounts/profile/" });
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=10800, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).send(JSON.stringify(out));
};
