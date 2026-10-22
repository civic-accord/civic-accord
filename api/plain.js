// A plain-language version of one item, written by AI on request, once per version of the official text, then saved
// and served to everyone the same. It is an aid for reading. It is never part of what anyone votes on and never sent
// to an office. The exact instructions given to the AI are public in api/_plain.js.
//
// Protections: only items Civic Accord already lists can be asked for; one version per item text (a new official
// text gets a new version); a shared daily cap on new versions (PLAIN_PER_DAY, default 300); the saved copy is served
// from the edge for hours. Without an ANTHROPIC_API_KEY, the function says the feature isn't available.
const crypto = require("crypto");
const { canonical, memo, onlyRead, publicError } = require("./_shared");
const { loadItem, normalizeId, isValidId } = require("./item");
const { writePlain, PROMPT } = require("./_plain");
const store = require("./_store");

const PER_DAY = Math.max(1, parseInt(process.env.PLAIN_PER_DAY || "300", 10) || 300);
const MIN_CHARS = 80;

function officialText(item) {
  const parts = (item.parts || []).map(p => [p.lead, p.text].filter(Boolean).join(" ")).filter(Boolean);
  return parts.length ? parts.join("\n") : String(item.whole || "");
}
const versionOf = (item, text) => crypto.createHash("sha256").update(`${item.title}\n${text}`).digest("hex").slice(0, 16);

async function takeDaily() {
  if (!store.on()) return true;
  const ok = await store.update("limits/plain.json", s => {
    const day = new Date().toISOString().slice(0, 10);
    if (s.day !== day) { s.day = day; s.n = 0; }
    if (s.n >= PER_DAY) return false;
    s.n++;
  });
  return ok !== false && ok !== undefined;
}

module.exports = async (req, res) => {
  if (onlyRead(req, res)) return;
  const id = normalizeId(String((req.query && req.query.id) || "").trim());
  if (canonical(req, res, "/api/plain", { id: isValidId(id) ? id : "" })) return;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  const fail = (status, why, extra) => { res.setHeader("Cache-Control", "public, s-maxage=120"); res.status(status).send(JSON.stringify({ ok: false, why, ...(extra || {}) })); };
  if (!isValidId(id)) return fail(404, "This item address isn't one Civic Accord recognizes.");
  if (!process.env.ANTHROPIC_API_KEY) return fail(503, "Plain-language versions aren't available yet.", { notConfigured: true });
  try {
    const loaded = await loadItem(id);
    if (!loaded.item) return fail(404, loaded.errors[0] || "This item wasn't found.");
    const item = loaded.item, text = officialText(item);
    if (text.length < MIN_CHARS) return fail(200, "The official text is too short to need a plain-language version.", { tooShort: true });
    const version = versionOf(item, text);
    const path = `plain/${id}.json`;
    // Saved for this exact text? Serve it.
    const saved = store.on() ? await memo("plain-saved-" + id, 10 * 60e3, () => store.read(path)).catch(() => null) : null;
    if (saved && saved.data && saved.data.version === version) {
      res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
      return res.status(200).send(JSON.stringify({ ok: true, ...saved.data }));
    }
    // Otherwise write one, within the day's cap, once per server copy per version.
    const made = await memo("plain-" + id + "-" + version, 24 * 3600e3, async () => {
      if (!(await takeDaily())) throw Object.assign(new Error("daily cap"), { status: 503, capped: true });
      const { text: plain, model } = await writePlain(item.title, text);
      const data = { id, version, model, at: new Date().toISOString(), text: plain, words: plain.split(/\s+/).length, promptSha256: crypto.createHash("sha256").update(PROMPT).digest("hex").slice(0, 16) };
      if (store.on()) { try { await store.write(path, data); } catch (e) { console.error("[plain] save failed", e && e.message); } }
      return data;
    });
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    res.status(200).send(JSON.stringify({ ok: true, ...made }));
  } catch (e) {
    if (e && e.capped) return fail(503, "Today's limit for new plain-language versions is used up. Saved ones still show. Try again tomorrow.", { capped: true });
    if (e && e.notConfigured) return fail(503, "Plain-language versions aren't available yet.", { notConfigured: true });
    return fail(502, publicError("Plain-language version", e));
  }
};
