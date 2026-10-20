// State legislators for a district, from Open States. Only district numbers are sent, never an address.
// Party is never returned. Cached for a day.
const NAMES = {AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",PR:"Puerto Rico",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"};
const clean = v => String(v || "").replace(/[^A-Za-z0-9 .\-]/g, "").slice(0, 40);
async function people(key, name, chamber, district) {
  const q = new URLSearchParams({ jurisdiction: name, org_classification: chamber, district, per_page: "10" });
  q.append("include", "offices"); q.append("include", "links");
  const r = await fetch(`https://v3.openstates.org/people?${q}`, { headers: { "X-API-KEY": key, "User-Agent": "CivicAccord/1.0" } });
  if (r.status === 429) throw new Error("busy");
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json();
  return (j.results || []).map(p => {
    const phone = (p.offices || []).map(o => o.voice).find(Boolean) || null;
    const site = (p.links || []).map(l => l.url).find(u => /^https:\/\//.test(u || "")) || null;
    return { name: p.name, title: (p.current_role && p.current_role.title) || (chamber === "upper" ? "Senator" : "Representative"),
      chamber, district: (p.current_role && p.current_role.district) || district,
      email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email || "") ? p.email : null, phone, url: site || p.openstates_url || null };
  });
}
module.exports = async (req, res) => {
  const st = clean(req.query.state).toUpperCase().slice(0, 2), name = NAMES[st];
  const out = { state: st, legislators: [], errors: [], source: { label: "Open States", url: "https://open.pluralpolicy.com/" } };
  const key = process.env.OPENSTATES_API_KEY;
  if (!name || !key) out.errors.push(!name ? "Unknown state" : "State legislator lookup isn't connected");
  else for (const [chamber, d] of [["lower", clean(req.query.lower)], [st === "NE" || st === "DC" ? "legislature" : "upper", clean(req.query.upper)]]) {
    if (!d) continue;
    try { out.legislators.push(...await people(key, name, chamber, d)); }
    catch (e) { out.errors.push(e.message === "busy" ? "The free data source is busy. Try again in a minute." : `Couldn't look up the ${chamber === "upper" ? "senate" : "house"} district (${e.message})`); }
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", out.errors.length ? "public, s-maxage=120" : "public, s-maxage=86400, stale-while-revalidate=604800");
  res.status(200).send(JSON.stringify(out));
};
