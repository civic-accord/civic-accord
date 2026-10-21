// Current members of Congress, slimmed from the public-domain congress-legislators dataset.
// One small cached file instead of every visitor downloading the full dataset. Party is never returned.
const { canonical, memo, onlyRead, fetchWithTimeout, publicError } = require("./_shared");
module.exports = async (req, res) => {
  if (onlyRead(req, res)) return;
  if (canonical(req, res, "/api/congress", {})) return;
  const out = { fetchedAt: new Date().toISOString(), members: [], errors: [],
    source: { label: "congress-legislators (public domain)", url: "https://github.com/unitedstates/congress-legislators" } };
  try {
    out.members = await memo("members", 12 * 3600 * 1000, async () => {
      const r = await fetchWithTimeout("https://unitedstates.github.io/congress-legislators/legislators-current.json", { headers: { "User-Agent": "CivicAccord/1.0" } });
      if (!r.ok) throw new Error(String(r.status));
      const all = await r.json();
      return all.map(p => { const t = p.terms[p.terms.length - 1];
        return { name: p.name.official_full || [p.name.first, p.name.last].join(" "), type: t.type, state: t.state, district: t.district ?? null, cls: t.class ?? null,
          url: /^https:/.test(t.url || "") ? t.url : null, contact: /^https:/.test(t.contact_form || "") ? t.contact_form : null, phone: t.phone || null }; });
    });
  } catch (e) { out.errors.push(publicError("Members of Congress", e)); }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", out.errors.length ? "public, s-maxage=300" : "public, s-maxage=43200, stale-while-revalidate=604800");
  res.status(200).send(JSON.stringify(out));
};
