// Shared saved copies and one shared spending limit, kept in Vercel Blob so every server copy sees the same thing.
// Files starting with "_" are not public routes.
//
// Why: Vercel runs several copies of each data function at once, and each copy used to keep its own count of calls to
// a source. Together they could go over a source's free limit. Now:
//  - State bill lists are downloaded on a schedule (api/refresh.js) and saved here. Visits read the saved copy.
//  - Every call to Open States, from any copy, first takes a turn from one shared count, kept here.
// If no store is connected (BLOB_READ_WRITE_TOKEN isn't set), on() is false and the functions work as before,
// with a separate limit in each copy.
// Saved copies are public files: they hold only official information that is already public.

let sdk = null;
const lib = () => sdk || (sdk = require("@vercel/blob"));
const on = () => !!process.env.BLOB_READ_WRITE_TOKEN;

// Read a saved JSON file. Returns { data, etag, at } or null if it doesn't exist yet.
async function read(path) {
  if (!on()) return null;
  const r = await lib().get(path, { access: "public", useCache: false });
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  const text = await new Response(r.stream).text();
  return { data: JSON.parse(text), etag: r.blob.etag, at: new Date(r.blob.uploadedAt).getTime() };
}

// Save a JSON file. With an etag, the save happens only if nobody else changed the file since it was read.
// With etag "new", it happens only if the file doesn't exist yet.
function write(path, data, etag) {
  return lib().put(path, JSON.stringify(data), {
    access: "public", contentType: "application/json; charset=utf-8", addRandomSuffix: false,
    allowOverwrite: etag !== "new", cacheControlMaxAge: 60, ...(etag && etag !== "new" ? { ifMatch: etag } : {})
  });
}
const conflict = e => e && (e.name === "BlobPreconditionFailedError" || /precondition|already exists/i.test(String(e.message)));
const busy = (why) => Object.assign(new Error("busy: " + why), { busy: true, why });

// The shared count. caps: { perMinute, perDay } for the source in all, and { useMinute, useDay } for this use
// ("refresh" for scheduled downloads, "items" for talk-it-through pages), so one use can't crowd out the other.
// Throws an error with busy: true and why: "minute" | "day" | "pause" when there's no turn left.
async function take(name, use, caps) {
  const path = `limits/${name}.json`;
  for (let tries = 0; tries < 5; tries++) {
    const now = new Date(), minute = now.toISOString().slice(0, 16), day = now.toISOString().slice(0, 10);
    const cur = await read(path);
    const s = cur ? cur.data : {};
    if (s.day !== day) { s.day = day; s.d = 0; s.useDay = {}; }
    if (s.minute !== minute) { s.minute = minute; s.m = 0; s.useMinute = {}; }
    s.useDay = s.useDay || {}; s.useMinute = s.useMinute || {};
    if (Date.now() < (s.pauseUntil || 0)) throw busy("pause");
    if (s.d >= caps.perDay || (caps.useDay && (s.useDay[use] || 0) >= caps.useDay)) throw busy("day");
    if (s.m >= caps.perMinute || (caps.useMinute && (s.useMinute[use] || 0) >= caps.useMinute)) throw busy("minute");
    s.d++; s.m++; s.useDay[use] = (s.useDay[use] || 0) + 1; s.useMinute[use] = (s.useMinute[use] || 0) + 1;
    try { await write(path, s, cur ? cur.etag : "new"); return; }
    catch (e) { if (!conflict(e)) throw e; }   // someone else took a turn at the same moment; read again and retry
  }
  throw busy("minute");
}

// After a source says "too many requests", every copy waits.
async function pauseAll(name, ms) {
  const path = `limits/${name}.json`;
  for (let tries = 0; tries < 3; tries++) {
    const cur = await read(path); const s = cur ? cur.data : {};
    s.pauseUntil = Math.max(s.pauseUntil || 0, Date.now() + ms);
    try { await write(path, s, cur ? cur.etag : "new"); return; } catch (e) { if (!conflict(e)) return; }
  }
}

module.exports = { on, read, write, take, pauseAll };
// For tests: use a stand-in for the store.
module.exports._setLib = l => { sdk = l; };
