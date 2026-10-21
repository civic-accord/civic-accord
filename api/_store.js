// Shared saved copies and one shared spending limit, kept in a private Vercel Blob store so every server copy sees the
// same thing. Files starting with "_" are not public routes.
//
// Why: Vercel runs several copies of each data function at once, and each copy used to keep its own count of calls to
// a source. Together they could go over a source's free limit. Now:
//  - State bill lists are downloaded on a schedule (api/refresh.js) and saved here. Visits read the saved copy.
//  - Every call to Open States, from any copy, first takes a turn from one shared count, kept here.
// If no store is connected (BLOB_READ_WRITE_TOKEN isn't set), on() is false and the functions work as before,
// with a separate limit in each copy.
// Files are private and read without any cache, so every copy sees the latest count. They hold only public information.

// The store's own library retries a failed call up to 10 times with growing waits, which could hold a visitor for
// minutes. Here a call is tried twice at most and gives up after 5 seconds.
if (!process.env.VERCEL_BLOB_RETRIES) process.env.VERCEL_BLOB_RETRIES = "1";
const WAIT_MS = 5000;

let sdk = null;
const lib = () => sdk || (sdk = require("@vercel/blob"));
const on = () => !!process.env.BLOB_READ_WRITE_TOKEN;

// Read a saved JSON file. Returns { data, etag, at } or null if it doesn't exist yet.
async function read(path) {
  if (!on()) return null;
  const r = await lib().get(path, { access: "private", useCache: false, abortSignal: AbortSignal.timeout(WAIT_MS) });
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  const text = await new Response(r.stream).text();
  return { data: JSON.parse(text), etag: r.blob.etag || "", at: new Date(r.blob.uploadedAt).getTime() };
}

// Save a JSON file. With an etag, the save happens only if nobody else changed the file since it was read.
// With etag "new", it happens only if the file doesn't exist yet. With no etag, it replaces the file.
function write(path, data, etag) {
  return lib().put(path, JSON.stringify(data), {
    access: "private", contentType: "application/json; charset=utf-8", addRandomSuffix: false,
    allowOverwrite: etag !== "new", abortSignal: AbortSignal.timeout(WAIT_MS),
    ...(etag && etag !== "new" ? { ifMatch: etag } : {})
  });
}
const conflict = e => e && (e.name === "BlobPreconditionFailedError" || /precondition|already exists/i.test(String(e.message)));
const busy = (why) => Object.assign(new Error("busy: " + why), { busy: true, why });
const jitter = () => new Promise(r => setTimeout(r, 20 + Math.random() * 120));

// A change made only if nobody else changed the file at the same moment; otherwise read again and retry.
// change(state) edits the state in place and returns a result, or throws to stop. A file read with no version tag is
// never saved over. Returns undefined if every try collided.
async function update(path, change, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const cur = await read(path);
    if (cur && !cur.etag) throw new Error("store gave no version tag");
    const s = cur ? cur.data : {};
    const result = change(s);
    if (result === false) return false;
    try { await write(path, s, cur ? cur.etag : "new"); return result === undefined ? true : result; }
    catch (e) { if (!conflict(e)) throw e; await jitter(); }
  }
  return undefined;
}

// The shared count. caps: { perMinute, perDay } for the source in all, and { useMinute, useDay } for this use
// ("refresh" for scheduled downloads, "items" for talk-it-through pages of listed bills, "unlisted" for others),
// so one use can't crowd out another. Throws an error with busy: true and why: "minute" | "day" | "pause" when
// there's no turn left.
async function take(name, use, caps) {
  const ok = await update(`limits/${name}.json`, s => {
    const now = new Date(), minute = now.toISOString().slice(0, 16), day = now.toISOString().slice(0, 10);
    if (s.day !== day) { s.day = day; s.d = 0; s.useDay = {}; }
    if (s.minute !== minute) { s.minute = minute; s.m = 0; s.useMinute = {}; }
    s.useDay = s.useDay || {}; s.useMinute = s.useMinute || {};
    if (Date.now() < (s.pauseUntil || 0)) throw busy("pause");
    if (s.d >= caps.perDay || (caps.useDay && (s.useDay[use] || 0) >= caps.useDay)) throw busy("day");
    if (s.m >= caps.perMinute || (caps.useMinute && (s.useMinute[use] || 0) >= caps.useMinute)) throw busy("minute");
    s.d++; s.m++; s.useDay[use] = (s.useDay[use] || 0) + 1; s.useMinute[use] = (s.useMinute[use] || 0) + 1;
  });
  if (!ok) throw busy("minute");
}

// After a source says "too many requests", every copy waits.
async function pauseAll(name, ms) {
  try { await update(`limits/${name}.json`, s => { s.pauseUntil = Math.max(s.pauseUntil || 0, Date.now() + ms); }, 3); } catch (e) { /* best effort */ }
}

// A lock so two scheduled runs never work at the same time. It expires on its own if a run stops without letting go.
async function lock(name, ms) {
  const id = Math.random().toString(36).slice(2);
  const got = await update(`locks/${name}.json`, s => { if (s.until && s.until > Date.now()) return false; s.until = Date.now() + ms; s.id = id; }, 3);
  return got ? id : null;
}
async function unlock(name, id) {
  try { await update(`locks/${name}.json`, s => { if (s.id !== id) return false; s.until = 0; }, 3); } catch (e) { /* expires anyway */ }
}

module.exports = { on, read, write, update, take, pauseAll, lock, unlock };
// For tests: use a stand-in for the store.
module.exports._setLib = l => { sdk = l; };
