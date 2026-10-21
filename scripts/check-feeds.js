// Checks registry/local-feeds.json: every entry has what Civic Accord needs, and nothing it shouldn't.
// Runs in the automatic checks (no network). With --live, also asks each Legistar client for its next meetings,
// so a volunteer can check a new entry before opening a pull request:  node scripts/check-feeds.js --live
const fs = require("fs"), path = require("path");
const file = path.join(__dirname, "..", "registry", "local-feeds.json");
const live = process.argv.includes("--live");
const STATES = /^(A[KLRZ]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|PR|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY]|GU|AS|MP)$/;
const LEVELS = ["county", "city", "town", "township", "school"];
const SYSTEMS = ["legistar"];
const problems = [];
const bad = (id, msg) => problems.push(`${id || "(no id)"}: ${msg}`);

let data;
try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { console.error("local-feeds.json is not valid JSON: " + e.message); process.exit(1); }
if (!Array.isArray(data.feeds)) { console.error('local-feeds.json needs a "feeds" list.'); process.exit(1); }

const ids = new Set();
for (const f of data.feeds) {
  const id = f.id;
  if (!id || !/^[a-z]{2}-[a-z0-9-]+$/.test(id)) bad(id, 'id must look like "hi-maui-county": state code, dash, lowercase letters, digits, dashes');
  if (ids.has(id)) bad(id, "duplicate id"); ids.add(id);
  if (!f.name) bad(id, "name is missing");
  if (!STATES.test(f.state || "")) bad(id, "state must be a two-letter code");
  if (id && f.state && id.slice(0, 2) !== String(f.state).toLowerCase()) bad(id, "id must start with the state code");
  if (!LEVELS.includes(f.level)) bad(id, `level must be one of ${LEVELS.join(", ")}`);
  if (!SYSTEMS.includes(f.system)) bad(id, `system must be one of ${SYSTEMS.join(", ")} (readers for other systems are planned)`);
  const geo = [f.countyId, f.placeId, f.townId].filter(Boolean);
  if (!geo.length) bad(id, "one of countyId, placeId, or townId is needed (the Census GEOID, so only residents can respond)");
  if (f.countyId && !/^\d{5}$/.test(f.countyId)) bad(id, "countyId must be the 5-digit Census county GEOID (state + county)");
  if (f.placeId && !/^\d{7}$/.test(f.placeId)) bad(id, "placeId must be the 7-digit Census place GEOID (state + place)");
  if (f.townId && !/^\d{10}$/.test(f.townId)) bad(id, "townId must be the 10-digit Census county-subdivision GEOID");
  if (f.level === "county" && !f.countyId) bad(id, "a county feed needs countyId");
  if ((f.level === "city") && !f.placeId) bad(id, "a city feed needs placeId");
  if ((f.level === "town" || f.level === "township") && !f.townId) bad(id, "a town or township feed needs townId");
  if (f.system === "legistar" && !/^[a-z0-9-]+$/.test(f.client || "")) bad(id, 'client must be the Legistar client name (the part before ".legistar.com")');
  if (!/^https:\/\//.test(f.calendar || "")) bad(id, "calendar must be an https link to the government's own meeting calendar");
  if (!f.tz || !/^[A-Za-z_]+\/[A-Za-z_]+$/.test(f.tz)) bad(id, 'tz must be an IANA time zone, for example "America/Chicago"');
  else { try { new Date().toLocaleDateString("en-CA", { timeZone: f.tz }); } catch (e) { bad(id, `tz "${f.tz}" is not a known time zone`); } }
  const allowed = ["id", "name", "state", "level", "countyId", "placeId", "townId", "system", "client", "calendar", "note", "tz", "source"];
  for (const k of Object.keys(f)) if (!allowed.includes(k)) bad(id, `unexpected field "${k}"`);
}

async function checkLive() {
  const { localMeetings } = require("../api/_local.js");
  const getJSON = async (url) => { const r = await fetch(url, { headers: { "User-Agent": "CivicAccord/1.0 (+https://civicaccord.org)" }, signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`); return r.json(); };
  for (const f of data.feeds) {
    try { const items = await localMeetings(f, getJSON); console.log(`${f.id}: ${items.length} meeting${items.length === 1 ? "" : "s"} in the next 30 days${items[0] ? ` (first: ${items[0].title})` : ""}`); }
    catch (e) { bad(f.id, `live check failed: ${e.message}`); }
  }
}

(async () => {
  if (live) await checkLive();
  if (problems.length) { console.error("local-feeds.json has problems:\n- " + problems.join("\n- ")); process.exit(1); }
  console.log(`OK: ${data.feeds.length} local feed${data.feeds.length === 1 ? "" : "s"} checked${live ? " (live)" : ""}.`);
})();
