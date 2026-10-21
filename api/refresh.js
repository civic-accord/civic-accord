// Scheduled download of state bill lists. Vercel runs this on a schedule (see "crons" in vercel.json); visitors can't.
// Each run downloads the lists that are most out of date, at a steady pace, and saves them (see _store.js).
// Open Now then reads the saved copies, so visits never call Open States for these lists.
//
// How often each list is refreshed:
//  - while a legislature is in session: every 3 hours when the day's share of calls allows. When many legislatures are
//    in session, each list is fetched with fewer pages (down to the 20 most recently active bills) and, if needed,
//    less often, so that every list still gets refreshed. The page always says how many bills there are in all.
//  - otherwise: about once a day to see whether a session has started, and every 6 hours in the 2 days before a
//    session is due to start;
//  - a list that failed to download waits 30 minutes before another try, and the last good copy stays up.
// Every call takes a turn from the shared Open States limit, so all copies together stay under the free limits.
// If the day's share runs out, the run stops and lists show their real (older) download time.
const crypto = require("crypto");
const { getJSON: get, publicError, onlyRead, openStatesCaps } = require("./_shared");
const { STATE_NAMES, stateBills } = require("./_states");
const store = require("./_store");

const H = 3600e3, BASE_EVERY = 3 * H, SOON_EVERY = 6 * H, QUIET_EVERY = 20 * H, RETRY_AFTER = 30 * 60e3;
const START_BY = 150e3;   // start no new state after 2.5 minutes
const CALL_BY = 240e3;    // make no new call after 4 minutes; the function may run for 5
const TARGET_PER_DAY = 8; // refreshes a day for each list in session, if the share allows

const soon = (e, now) => e.nextStart && Date.parse(e.nextStart + "T00:00:00Z") - now < 2 * 24 * H;

// How many pages to fetch per in-session list, and how often, given the day's share of calls.
function pace(index, codes, dailyShare, now = Date.now()) {
  const nIn = Math.max(1, codes.filter(st => index[st] && index[st].inSession).length);
  // About one session check per state a day, and 4 a day for each legislature due to open within 2 days.
  const nSoon = codes.filter(st => index[st] && !index[st].inSession && soon(index[st], now)).length;
  const left = Math.max(nIn, dailyShare - codes.length - 1 - nSoon * 3);
  const pages = Math.max(1, Math.min(3, Math.floor(left / (nIn * TARGET_PER_DAY))));
  const every = Math.max(BASE_EVERY, Math.ceil(24 * H * nIn * pages / left));
  return { pages, every };
}

// Which lists are due, most out of date first. index: { XX: { at, inSession, errAt, nextStart } }.
function due(index, now, codes, inEvery = BASE_EVERY) {
  return codes.map(st => ({ st, e: index[st] || {} }))
    .filter(({ e }) => !(e.errAt && now - e.errAt < RETRY_AFTER))
    .filter(({ e }) => !e.at || now - e.at >= (e.inSession ? inEvery : soon(e, now) ? SOON_EVERY : QUIET_EVERY))
    .sort((a, b) => (a.e.at || 0) - (b.e.at || 0))
    .map(x => x.st);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const sameSecret = (got, want) => { const a = Buffer.from(String(got)), b = Buffer.from(String(want)); return a.length === b.length && crypto.timingSafeEqual(a, b); };

const handler = async (req, res) => {
  if (onlyRead(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  // Only Vercel's scheduler knows this secret. Anyone else gets "no".
  const secret = process.env.CRON_SECRET;
  if (!secret || !sameSecret(req.headers.authorization || "", `Bearer ${secret}`)) return res.status(401).json({ ok: false });
  if (!store.on() || !process.env.OPENSTATES_API_KEY) return res.status(503).json({ ok: false, why: "No saved-copy store or no Open States key connected." });

  const start = Date.now(), done = [], failed = [];
  const lockId = await store.lock("refresh", 300e3);
  if (!lockId) return res.status(200).json({ ok: true, skipped: "Another run is still working." });
  let stop = null;
  // Take turns from the shared limit. If this minute's turns are used, wait for the next minute, unless that would run
  // past the time limit; if the day's are used, stop.
  const getJSON = async (url, headers) => {
    for (;;) {
      if (Date.now() - start > CALL_BY) { stop = stop || "time"; throw Object.assign(new Error("out of time"), { busy: true }); }
      try { return await get(url, headers, null, "refresh"); }
      catch (e) {
        if (!e.busy) throw e;
        if (e.why === "day") { stop = "day"; throw e; }
        const wait = e.why === "pause" ? 30e3 : 61e3 - (Date.now() % 60e3);
        if (Date.now() - start + wait > CALL_BY) { stop = stop || "time"; throw e; }
        await sleep(wait);
      }
    }
  };

  try {
    const codes = Object.keys(STATE_NAMES);
    const saved = await store.read("states/index.json");
    const index = (saved && saved.data) || {};
    const savedIds = await store.read("states/ids.json");
    const ids = (savedIds && savedIds.data && savedIds.data.ids) || {};
    const { pages, every } = pace(index, codes, openStatesCaps("refresh").useDay);
    for (const st of due(index, Date.now(), codes, every)) {
      if (stop || Date.now() - start > START_BY) break;
      const e = index[st] = index[st] || {};
      // Session dates are kept with the index and checked again about once a day (every 6 hours when a session is near).
      const loadSessions = async fetchSessions => {
        if (e.sessions && e.sessionsAt && Date.now() - e.sessionsAt < (soon(e, Date.now()) ? SOON_EVERY : QUIET_EVERY)) return e.sessions;
        e.sessions = await fetchSessions(); e.sessionsAt = Date.now(); return e.sessions;
      };
      const o = { pages };
      try {
        const items = await stateBills(process.env.OPENSTATES_API_KEY, st, o, getJSON, loadSessions);
        const at = Date.now();
        await store.write(`states/${st}.json`, { at: new Date(at).toISOString(), items, quiet: o.quiet || null, partial: o.partial || null, cut: !!o.cut });
        e.at = at; e.inSession = !!o.inSession; e.nextStart = o.nextStart || null; delete e.errAt;
        // A list cut short (the source was busy partway) is tried again soon.
        if (o.cut) e.at = at - every + RETRY_AFTER;
        // Remember which bills are in a downloaded list (see item.js).
        for (const id of Object.keys(ids)) if (ids[id] === st) delete ids[id];
        for (const it of items) ids[it.id] = st;
        done.push(st);
      } catch (err) {
        if (!stop) { e.errAt = Date.now(); failed.push(st); publicError(`Scheduled download ${st}`, err); }
      }
      // Saved after every state, so progress (including session dates just fetched) is kept even if the run stops.
      await store.write("states/index.json", index);
      await store.write("states/ids.json", { ids });
    }
    res.status(200).json({ ok: true, refreshed: done, failed, pages, everyHours: +(every / H).toFixed(1), stoppedBecause: stop, seconds: Math.round((Date.now() - start) / 1000) });
  } catch (err) {
    publicError("Scheduled download", err);
    res.status(500).json({ ok: false });
  } finally {
    await store.unlock("refresh", lockId);
  }
};
module.exports = handler;
module.exports.due = due;
module.exports.pace = pace;
