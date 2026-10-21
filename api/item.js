// One open item (a bill in Congress, a state bill, or a proposed federal rule), built only from official material.
// The parts people weigh in on are copied word for word from the official summary. Nothing is written or rewritten here,
// by people or by AI. Costs come only from official estimates. Party is never returned.
const { canonical, memo, asOf, onlyRead, publicError, getJSON: get } = require("./_shared");
// Open States' free key allows 10 calls a minute in all. With a saved-copy store connected, every copy shares one count
// (see _shared.js and _store.js). Without one, each copy keeps its own: Open Now 8, item pages 2.
// Calls a minute from each server copy, per source. Congress.gov and the Federal Register have generous limits, but
// capping them stops anyone from using item pages to flood those sources or use up the Congress.gov key.
const LIMITS = { "v3.openstates.org": 2, "webapi.legistar.com": 20, "api.congress.gov": 30, "www.federalregister.gov": 30 };
const getJSON = (url, headers, use) => get(url, headers, LIMITS, use || "items");
const store = require("./_store");
const { stateOutcome, congressOutcome } = require("./_final");
const MAX_ACTIONS = 20;
// With a saved-copy store connected, a state bill that's in a downloaded list draws from the main share of the shared
// Open States limit. Any other state bill address draws from a small separate share, so a bot trying random addresses
// can't use up the day's calls for everyone else.
async function stateUse(id) {
  if (!store.on()) return "items";
  try { const r = await memo("saved-ids", 5 * 60e3, () => store.read("states/ids.json")); return r && r.data && r.data.ids && r.data.ids[id] ? "items" : "unlisted"; }
  catch (e) { return "unlisted"; }
}

// Recent Congresses only (the 117th on), and Federal Register document numbers in their published forms.
const CONGRESS_ID = /^us-(hr|s|hres|sres|hjres|sjres|hconres|sconres)([1-9]\d{0,4})-(11[7-9]|12\d|13\d)$/;
const STATE_ID = /^os-ocd-bill\/[0-9a-f-]{36}$/;
const RULE_ID = /^fr-(?:[A-Z]\d{1,2}-)?(?:\d{4}-)?\d{4,6}$/;
const LOCAL_ID = /^lg-([a-z0-9]{2,40})-(\d{1,8})$/;
const LOCAL = require("../registry/local-feeds.json").feeds;
const BILL_PATH = { hr: "house-bill", s: "senate-bill", hres: "house-resolution", sres: "senate-resolution", hjres: "house-joint-resolution", sjres: "senate-joint-resolution", hconres: "house-concurrent-resolution", sconres: "senate-concurrent-resolution" };
const ordinal = n => { n = Number(n); const t = n % 100, o = n % 10; return n + (t >= 11 && t <= 13 ? "th" : o === 1 ? "st" : o === 2 ? "nd" : o === 3 ? "rd" : "th"); };
const MAX_PARTS = 30;

// Official summaries come as simple HTML or plain text. Turn them into separate, verbatim parts.
function decode(s) {
  return String(s).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
// Each part keeps its official lead-in (for example "This bill:") when it's an item in a list, so it reads in context.
// Headings and very short lines (under 25 characters) and exact repeats are left out; the page says so.
// What gets left out, and why (the page says how many):
//  - headings: lines in all capitals ("TITLE I--AGRICULTURE"), or blocks marked up as headings or set entirely in bold
//    ("<p><strong>Invasive Species Act</strong></p>"). Length or missing punctuation never removes a line:
//    "Repeals the tax." and "Appropriates funds for invasive species control" both stay.
//  - exact repeats.
// Plain-text summaries that use bullets ("• Repeals the tax.") or numbers ("1. ...") are read as lists, like HTML lists.
// If every line would be left out, nothing is left out.
function partsFrom(text) {
  if (!text) return { parts: [], more: false, dropped: 0, headings: 0, repeats: 0 };
  const LI = "\u0001";
  const HD = "\u0002";
  const src = ("\n" + String(text)).replace(/\r/g, "")
    .replace(/\n[ \t]*(?:[•·▪◦‣*]|-(?=[ \t])|\d{1,2}[.)](?=[ \t]))[ \t]+/g, "\n\n" + LI)   // plain-text bullets and numbers become list items
    .replace(/<h\d[^>]*>/gi, HD)                                                           // marked-up headings
    .replace(/<p[^>]*>\s*<(strong|b)>([\s\S]*?)<\/\1>\s*(?=<\/p>)/gi, (m, t, inner) => HD + inner)   // a paragraph that is all bold
    .replace(/<li[^>]*>/gi, LI);
  const blocks = src.split(/<\/p>|<br\s*\/?>|<\/li>|<\/h\d>|<\/ul>|<\/ol>|<ul[^>]*>|<ol[^>]*>|\n\s*\n/i)
    .map(b => { const li = b.includes(LI), hd = b.includes(HD); return { li, hd, t: decode(b.replace(/[\u0001\u0002]/g, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() }; })
    .filter(b => b.t);
  const seen = new Set(), parts = [], dropped = []; let lead = null, headings = 0, repeats = 0, pendingBg = [];
  const addBg = (p, t) => { p.background = p.background ? p.background + "\n\n" + t : t; };
  const allCaps = t => /[A-Z]/.test(t) && t === t.toUpperCase();
  const isHeading = b => !b.li && (b.hd || allCaps(b.t)) && !/^(this|the) (bill|act|section|title|resolution|rule)\b/i.test(b.t);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i], next = blocks[i + 1];
    if (!b.li) lead = null;
    // A line that introduces a list ("This bill:", "A state with a payment error rate that is") travels with each list item.
    if (!b.li && next && next.li && !isHeading(b)) { lead = b.t; continue; }
    if (isHeading(b)) { headings++; dropped.push(b.t); continue; }
    if (seen.has((lead || "") + "|" + b.t)) { repeats++; continue; }
    seen.add((lead || "") + "|" + b.t);
    // "As background, ..." explains the part before it; "Existing law ..." (as in California's digest) explains the part after it.
    // Both are shown with that part, not voted on separately.
    if (/^as background\b/i.test(b.t) && parts.length) { addBg(parts[parts.length - 1], b.t); continue; }
    if (/^(under )?(existing|current) law\b|^the [a-z ]*constitution (requires|provides)|^statutory provisions\b/i.test(b.t)) { pendingBg.push(b.t); continue; }
    const part = b.li && lead ? { text: b.t, lead } : { text: b.t };
    if (pendingBg.length) { pendingBg.forEach(t => addBg(part, t)); pendingBg = []; }
    parts.push(part);
  }
  if (pendingBg.length && parts.length) pendingBg.forEach(t => addBg(parts[parts.length - 1], t));
  // If everything looked like background, nothing is hidden: show it all as parts.
  else if (pendingBg.length) pendingBg.forEach(t => parts.push({ text: t }));
  if (!parts.length && dropped.length) { dropped.forEach(t => parts.push({ text: t })); headings = 0; }
  return { parts: parts.slice(0, MAX_PARTS), more: parts.length > MAX_PARTS, shownOf: parts.length, dropped: headings + repeats, headings, repeats };
}
// Official links sometimes still use http://; upgrade them, then accept only https.
const httpsOnly = u => { const v = String(u || "").replace(/^http:\/\//i, "https://"); return /^https:\/\/[^\s"<>]+$/.test(v) ? v : null; };
const noParty = n => String(n || "").replace(/\s*\[[^\]]*\]\s*/g, " ").replace(/\s+/g, " ").trim();

async function congressItem(m, key) {
  const [, type, number, congress] = m;
  const base = `https://api.congress.gov/v3/bill/${congress}/${type}/${number}`;
  const k = `format=json&api_key=${encodeURIComponent(key)}`;
  const detail = (await getJSON(`${base}?${k}`)).bill || {};
  let summary = null;
  try {
    const s = await getJSON(`${base}/summaries?${k}`);
    const list = (s.summaries || []).slice().sort((a, b) => String(b.updateDate || b.actionDate).localeCompare(String(a.updateDate || a.actionDate)));
    summary = list[0] || null;
  } catch (e) { /* no summary yet */ }
  // The bill's official actions, newest first (one more call, remembered with the rest of this answer).
  let actions = [];
  try {
    const a = await getJSON(`${base}/actions?${k}&limit=50`);
    actions = (a.actions || []).map(x => ({ date: x.actionDate ? String(x.actionDate).slice(0, 10) : null, text: String(x.text || "").trim() }))
      .filter(x => x.text).sort((x, y) => String(y.date).localeCompare(String(x.date)));
    const seen = new Set(); actions = actions.filter(x => { const key = x.date + "|" + x.text; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, MAX_ACTIONS);
  } catch (e) { actions = null; }   // unknown, not "none": Following never treats a failed call as a change
  const latest = detail.latestAction || null, ltext = latest ? String(latest.text || "") : "";
  const outcome = congressOutcome(type, ltext);
  const page = `https://www.congress.gov/bill/${ordinal(congress)}-congress/${BILL_PATH[type]}/${number}`;
  const { parts, more, dropped, headings, repeats, shownOf } = partsFrom(summary && summary.text);
  const title = `${String(type).toUpperCase()} ${number}: ${detail.title || ""}`.trim();
  return {
    kind: "Bill in Congress", level: "federal", jurisdiction: { name: "U.S. Congress" }, title,
    status: latest ? { date: latest.actionDate || null, text: ltext } : null,
    final: outcome === "final" ? { date: latest.actionDate || null, text: ltext } : null,
    vetoed: outcome === "vetoed" ? { date: latest.actionDate || null, text: ltext } : null, actions, actionsBy: "Congress.gov",
    introduced: detail.introducedDate || null, topic: detail.policyArea && detail.policyArea.name || null,
    sponsors: (detail.sponsors || []).map(p => ({ name: noParty(p.fullName), role: "Sponsor" })),
    summary: summary ? { by: "Congressional Research Service (nonpartisan, part of the Library of Congress)", version: summary.actionDesc || null, date: summary.actionDate || null } : null,
    parts, partsMore: more, partsDropped: dropped, partsHeadings: headings, partsRepeats: repeats, partsTotal: shownOf,
    partsNote: parts.length ? null : "The Congressional Research Service hasn't published a summary of this bill yet. It usually does within a few weeks. Until then, you can weigh in on the bill as a whole.",
    whole: title,
    costs: (detail.cboCostEstimates || []).map(c => ({ title: decode(c.title || "CBO cost estimate"), date: c.pubDate ? String(c.pubDate).slice(0, 10) : null,
      url: httpsOnly(c.url), description: partsFrom(c.description).parts.map(p => p.text).join(" ") || null, by: "Congressional Budget Office" })).filter(c => c.url),
    costNote: "Only official estimates are shown. The Congressional Budget Office estimates the cost of many bills once a committee acts on them.",
    links: { official: page, text: page + "/text", comment: null },
    source: { label: "Congress.gov", url: "https://www.congress.gov/" }
  };
}

async function stateItem(id, key, use) {
  const ocd = id.slice(3);
  const q = ["abstracts", "sponsorships", "documents", "versions", "sources", "actions"].map(x => "include=" + x).join("&");
  const b = await getJSON(`https://v3.openstates.org/bills/${ocd}?${q}`, { "X-API-KEY": key }, use);
  // Use only the most recent summary the legislature posted, so earlier versions don't repeat. A "summary" that only repeats the title isn't one.
  const abstracts = (b.abstracts || []).map(a => a.abstract).filter(a => a && a.trim() && a.trim() !== String(b.title || "").trim());
  const latest = abstracts.length ? abstracts[abstracts.length - 1] : "";
  const { parts, more, dropped, headings, repeats, shownOf } = partsFrom(latest);
  const stateCode = ((String((b.jurisdiction || {}).id || "").match(/\/(?:state|district|territory):([a-z]{2})\//) || [])[1] || "").toUpperCase() || null;
  const name = (b.jurisdiction && b.jurisdiction.name) || "State";
  const body = name === "District of Columbia" ? "D.C. Council" : `${name} legislature`, Body = name === "District of Columbia" ? "D.C. Council" : `${name} Legislature`;
  const title = `${b.identifier || ""}: ${b.title || ""}`.trim();
  const docs = (b.documents || []).filter(d => /fiscal note|fiscal impact|fiscal estimate|cost estimate/i.test(d.note || ""));
  const latestVersion = (b.versions || []).slice(-1)[0];
  const sourceUrl = httpsOnly(((b.sources || [])[0] || {}).url);
  // Official actions, newest first. Open States lists them oldest first.
  const acts = (b.actions || []).map(a => ({ date: a.date ? String(a.date).slice(0, 10) : null, text: String(a.description || "").trim(),
    by: a.organization && a.organization.name ? String(a.organization.name) : null, labels: Array.isArray(a.classification) ? a.classification : [] })).filter(a => a.text);
  const lastAct = acts.length ? acts[acts.length - 1] : null;
  const outcome = stateOutcome(b.latest_action_description, b.classification, lastAct && lastAct.text === String(b.latest_action_description || "").trim() ? lastAct.labels : null);
  return {
    kind: `Bill in the ${body}`, level: "state", jurisdiction: { name: Body, state: name, stateCode }, title,
    status: b.latest_action_description ? { date: String(b.latest_action_date || "").slice(0, 10) || null, text: b.latest_action_description } : null,
    final: outcome === "final" ? { date: String(b.latest_action_date || "").slice(0, 10) || null, text: b.latest_action_description } : null,
    vetoed: outcome === "vetoed" ? { date: String(b.latest_action_date || "").slice(0, 10) || null, text: b.latest_action_description } : null,
    actions: acts.slice().reverse().slice(0, MAX_ACTIONS).map(({ date, text, by }) => ({ date, text, by })), actionsBy: "Open States",
    introduced: b.first_action_date ? String(b.first_action_date).slice(0, 10) : null, topic: null,
    sponsors: (b.sponsorships || []).filter(s => s.primary).map(s => ({ name: s.name, role: "Sponsor" })),
    summary: latest ? { by: `The summary posted by the ${body} (collected by Open States)`, version: null, date: null } : null,
    parts, partsMore: more, partsDropped: dropped, partsHeadings: headings, partsRepeats: repeats, partsTotal: shownOf,
    partsNote: parts.length ? null : `The ${body} hasn't published a summary of this bill that Open States carries. You can weigh in on the bill as a whole, and read the official text for the details.`,
    whole: title,
    costs: docs.map(d => ({ title: d.note || "Fiscal note", date: d.date ? String(d.date).slice(0, 10) : null, url: httpsOnly(((d.links || [])[0] || {}).url), description: null, by: body })).filter(c => c.url),
    costNote: `Only official estimates are shown. Many legislatures publish a fiscal note for bills that spend or raise money; not every bill has one.`,
    links: { official: sourceUrl || httpsOnly(b.openstates_url), text: httpsOnly(latestVersion && ((latestVersion.links || [])[0] || {}).url), comment: null },
    source: { label: "Open States", url: "https://openstates.org/" }
  };
}

async function ruleItem(id) {
  const num = id.slice(3);
  const fields = ["title", "abstract", "action", "agencies", "comments_close_on", "comment_url", "regulations_dot_gov_url", "html_url", "publication_date", "type"];
  const q = fields.map(f => "fields[]=" + f).join("&");
  const d = await getJSON(`https://www.federalregister.gov/api/v1/documents/${encodeURIComponent(num)}.json?${q}`);
  const { parts, more, dropped, headings, repeats, shownOf } = partsFrom(d.abstract);
  const form = httpsOnly(d.comment_url) || httpsOnly(d.regulations_dot_gov_url);
  return {
    kind: "Proposed rule", level: "federal", jurisdiction: { name: (d.agencies || []).map(a => a.name).filter(Boolean).join(", ") || "Federal agency" }, title: d.title || num,
    status: d.comments_close_on ? { date: d.comments_close_on, text: "Official comments close on this date." } : null,
    closes: d.comments_close_on || null, actions: d.publication_date ? [{ date: d.publication_date, text: `Published in the Federal Register${d.action ? " (" + d.action + ")" : ""}` }] : [], actionsBy: "Federal Register",
    introduced: d.publication_date || null, topic: null, sponsors: [],
    summary: d.abstract ? { by: "The agency's official summary in the Federal Register", version: d.action || null, date: d.publication_date || null } : null,
    parts, partsMore: more, partsDropped: dropped, partsHeadings: headings, partsRepeats: repeats, partsTotal: shownOf,
    partsNote: parts.length ? null : "This notice has no official summary. You can weigh in on the proposal as a whole.",
    whole: d.title || num,
    costs: [], costNote: "The Federal Register's data doesn't include cost figures. Some proposed rules include a cost analysis in the notice itself; read the full notice.",
    links: { official: httpsOnly(d.html_url), text: httpsOnly(d.html_url), comment: form || httpsOnly(d.html_url), commentForm: !!form },
    source: { label: "Federal Register", url: "https://www.federalregister.gov/" }
  };
}

// A local meeting: the parts are the agenda items that have legislation attached, with their official titles, word for word.
async function localItem(m) {
  const [, client, eventId] = m;
  const feed = LOCAL.find(f => f.client === client);
  const base = `https://webapi.legistar.com/v1/${client}/events/${eventId}`;
  const e = await getJSON(base);
  let items = [];
  try { items = await getJSON(`${base}/eventitems`); } catch (x) { items = []; }
  const seen = new Set(), parts = [];
  (Array.isArray(items) ? items : []).sort((a, b) => (a.EventItemAgendaSequence || 0) - (b.EventItemAgendaSequence || 0)).forEach(i => {
    const t = String(i.EventItemTitle || "").replace(/\s+/g, " ").trim();
    if (!i.EventItemMatterId || !t || seen.has(t)) return;
    seen.add(t); parts.push({ text: t, ref: i.EventItemMatterFile || null });
  });
  const body = String(e.EventBodyName || "Meeting").replace(/^[\s*]+/, "").replace(/\s+/g, " ").trim();
  const date = String(e.EventDate || "").slice(0, 10);
  const page = httpsOnly(e.EventInSiteURL) || feed.calendar;
  return {
    kind: "Local meeting", level: "local",
    jurisdiction: { name: feed.name, state: feed.state, countyId: feed.countyId || null, placeId: feed.placeId || null, townId: feed.townId || null }, title: `${body}: meeting`,
    status: e.EventAgendaStatusName ? { date: null, text: `Agenda ${String(e.EventAgendaStatusName).toLowerCase()}` } : null,
    meets: date || null, meetsTime: e.EventTime || null, introduced: null, topic: null, sponsors: [], actions: [], actionsBy: `${feed.name} agendas`, office: { id: `local/${String(feed.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`, name: feed.name },
    summary: { by: `The meeting agenda posted by the ${feed.name}`, version: null, date: null }, partsFrom: "the official agenda",
    parts: parts.slice(0, MAX_PARTS), partsMore: parts.length > MAX_PARTS, partsDropped: 0,
    partsNote: parts.length ? null : "This meeting's agenda has no items with legislation attached yet. Read the agenda for what's being discussed.",
    whole: `${body}: meeting`,
    costs: [], costNote: "Agenda data doesn't include cost figures. Staff reports in the agenda packet often do; read the agenda.",
    links: { official: page, text: httpsOnly(e.EventAgendaFile) || page, comment: page, commentLabel: "Meeting page and agenda" },
    source: { label: `${feed.name} agendas`, url: feed.calendar }
  };
}

const handler = async (req, res) => {
  if (onlyRead(req, res)) return;
  const raw = String((req.query && req.query.id) || "").trim();
  const id = CONGRESS_ID.test(raw.toLowerCase()) ? raw.toLowerCase() : raw;
  const lm = id.match(LOCAL_ID);
  const valid = CONGRESS_ID.test(id) || STATE_ID.test(id) || RULE_ID.test(id) || !!(lm && LOCAL.some(f => f.client === lm[1]));
  if (canonical(req, res, "/api/item", { id: valid ? id : "" })) return;
  const out = { fetchedAt: new Date().toISOString(), id, item: null, errors: [] };
  if (!valid) out.errors.push("This item address isn't one Civic Accord recognizes.");
  else {
    try {
      let label = "This item", fn;
      if (CONGRESS_ID.test(id)) {
        label = "Bills in Congress";
        if (!process.env.CONGRESS_API_KEY) throw Object.assign(new Error("no key"), { nokey: true });
        fn = () => congressItem(id.match(CONGRESS_ID), process.env.CONGRESS_API_KEY);
      } else if (STATE_ID.test(id)) {
        label = "State bills";
        if (!process.env.OPENSTATES_API_KEY) throw Object.assign(new Error("no key"), { nokey: true });
        fn = async () => stateItem(id, process.env.OPENSTATES_API_KEY, await stateUse(id));
      } else if (lm) { label = "Local meetings"; fn = () => localItem(lm); }
      else { label = "Federal rules"; fn = () => ruleItem(id); }
      // An address that doesn't exist at the source is remembered for 12 hours, so made-up addresses can't keep spending the free limits.
      const guarded = async () => { try { return await fn(); } catch (e) { if (e.status === 404) return { notFound: true }; throw e; } };
      try { out.item = await memo("item-" + id, 12 * 3600e3, guarded); if (out.item && out.item.notFound) { out.item = null; out.errors.push("This item wasn't found at the official source."); } const at = asOf("item-" + id); if (at) out.fetchedAt = new Date(at).toISOString(); }
      catch (e) { out.errors.push(publicError(label, e)); }
    } catch (e) { out.errors.push("This source isn't connected yet."); }
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", out.errors.length ? "public, s-maxage=120" : "public, s-maxage=21600, stale-while-revalidate=86400");
  res.status(200).send(JSON.stringify(out));
};
module.exports = handler;
module.exports.partsFrom = partsFrom;
