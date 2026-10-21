// Current state legislators for a whole state, from Open States' nightly public CSV files (no key, no rate limit).
// The browser filters to its own districts, so no district or address is ever sent here. Party is never returned.
const { canonical, memo, publicError } = require("./_shared");
const TTL = 12 * 3600 * 1000;
const STATES = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA PR RI SC SD TN TX UT VT VA WA WV WI WY".split(" "));
function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift() || [];
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] || ""])));
}
const okEmail = e => /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(e || "") ? e : null;
const okUrl = u => /^https:\/\/\S+$/.test(u || "") ? u : null;
const load = st => memo("people-" + st, TTL, () => fetchState(st));
async function fetchState(st) {
  const r = await fetch(`https://data.openstates.org/people/current/${st.toLowerCase()}.csv`, { headers: { "User-Agent": "CivicAccord/1.0 (+https://civicaccord.org)" } });
  if (!r.ok) throw new Error(String(r.status));
  const data = parseCSV(await r.text()).map(p => ({
    name: p.name, chamber: p.current_chamber, district: p.current_district,
    title: p.current_chamber === "upper" ? "Senator" : p.current_chamber === "lower" ? "Representative" : "Member",
    email: okEmail(p.email), phone: p.capitol_voice || p.district_voice || null,
    url: okUrl((p.links || "").split(";")[0].trim()) || okUrl((p.sources || "").split(";")[0].trim())
  })).filter(p => p.name && p.district);
  return data;
}
module.exports = async (req, res) => {
  const st = String((req.query && req.query.state) || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  const out = { state: st, legislators: [], errors: [], fetchedAt: new Date().toISOString(),
    source: { label: "Open States, current legislators (published nightly)", url: "https://open.pluralpolicy.com/data/legislator-csv/" } };
  if (canonical(req, res, "/api/people", { state: STATES.has(st) ? st : "" })) return;
  if (!STATES.has(st)) out.errors.push("Unknown state");
  else { try { out.legislators = await load(st); } catch (e) { out.errors.push(publicError("State legislators", e)); } }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", out.errors.length ? "public, s-maxage=300" : "public, s-maxage=86400, stale-while-revalidate=604800");
  res.status(200).send(JSON.stringify(out));
};
