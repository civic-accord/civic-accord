// Scheduled download of state bill lists. Vercel runs this on a schedule (see "crons" in vercel.json); visitors can't.
// Each run downloads the lists that are most out of date, at a steady pace, and saves them (see _store.js).
// Open Now then reads the saved copies, so visits never call Open States for these lists.
//
// How often each list is refreshed:
//  - while a legislature is in session: when its saved list is 3 hours old or more, oldest first;
//  - otherwise: once a day, to see whether a session has started;
//  - a list that failed to download waits 30 minutes before another try, and the last good copy stays up.
// Every call takes a turn from the shared Open States limit, so all copies together stay under the free limits.
// If the day's share runs out, the run stops and lists show their real (older) download time until the next day.
const { getJSON: get, publicError, onlyRead } = require("./_shared");
const { STATE_NAMES, stateBills } = require("./_states");
const store = require("./_store");

const IN_SESSION_EVERY = 3 * 3600e3, QUIET_EVERY = 20 * 3600e3, RETRY_AFTER = 30 * 60e3, SESSIONS_EVERY = 20 * 3600e3;
const RUN_FOR = 240e3; // stop starting new work after 4 minutes; the function may run for 5

// Which lists are due, most out of date first. index: { XX: { at, inSession, errAt } }.
function due(index, now, codes) {
  return codes.map(st => ({ st, e: index[st] || {} }))
    .filter(({ e }) => !(e.errAt && now - e.errAt < RETRY_AFTER))
    .filter(({ e }) => !e.at || now - e.at >= (e.inSession ? IN_SESSION_EVERY : QUIET_EVERY))
    .sort((a, b) => (a.e.at || 0) - (b.e.at || 0))
    .map(x => x.st);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const handler = async (req, res) => {
  if (onlyRead(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  // Only Vercel's scheduler knows this secret. Anyone else gets "no".
  const secret = process.env.CRON_SECRET;
  if (!secret || String(req.headers.authorization || "") !== `Bearer ${secret}`) return res.status(401).json({ ok: false });
  if (!store.on() || !process.env.OPENSTATES_API_KEY) return res.status(503).json({ ok: false, why: "No saved-copy store or no Open States key connected." });

  const start = Date.now(), done = [], failed = [];
  let stop = null;
  // Take turns from the shared limit. If this minute's turns are used, wait for the next minute; if the day's are, stop.
  const getJSON = async (url, headers) => {
    for (;;) {
      try { return await get(url, headers, null, "refresh"); }
      catch (e) {
        if (!e.busy || e.why === "day") { if (e.why === "day") stop = "day"; throw e; }
        if (Date.now() - start > RUN_FOR) { stop = "time"; throw e; }
        await sleep(e.why === "pause" ? 30e3 : 61e3 - (Date.now() % 60e3));
      }
    }
  };

  const saved = await store.read("states/index.json");
  const index = (saved && saved.data) || {};
  for (const st of due(index, Date.now(), Object.keys(STATE_NAMES))) {
    if (stop || Date.now() - start > RUN_FOR) break;
    const e = index[st] = index[st] || {};
    // Session dates are kept with the index and checked again about once a day.
    const loadSessions = async fetchSessions => {
      if (e.sessions && e.sessionsAt && Date.now() - e.sessionsAt < SESSIONS_EVERY) return e.sessions;
      e.sessions = await fetchSessions(); e.sessionsAt = Date.now(); return e.sessions;
    };
    const o = {};
    try {
      const items = await stateBills(process.env.OPENSTATES_API_KEY, st, o, getJSON, loadSessions);
      const at = Date.now();
      await store.write(`states/${st}.json`, { at: new Date(at).toISOString(), items, quiet: o.quiet || null, partial: o.partial || null, cut: !!o.cut });
      e.at = at; e.inSession = !!o.inSession; delete e.errAt;
      // A list cut short (the source was busy partway) is tried again soon.
      if (o.cut) e.at = at - IN_SESSION_EVERY + RETRY_AFTER;
      done.push(st);
    } catch (err) {
      if (stop) break;
      e.errAt = Date.now(); failed.push(st); publicError(`Scheduled download ${st}`, err);
    }
    await store.write("states/index.json", index);
  }
  res.status(200).json({ ok: true, refreshed: done, failed, stoppedBecause: stop, seconds: Math.round((Date.now() - start) / 1000) });
};
module.exports = handler;
module.exports.due = due;
