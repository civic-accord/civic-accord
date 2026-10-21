// Shared helpers for Civic Accord's read-only data functions. Files starting with "_" are not public routes.
// Goal: no visitor, script, or bot can make these functions hammer the public data sources.

// 1. One address per answer. Extra or misspelled query strings would each get their own saved copy at the edge,
//    and each would run the function again. Instead, anything that isn't the exact expected address is sent to it.
//    Returns true if it answered with a redirect.
function canonical(req, res, path, params) {
  const want = new URLSearchParams();
  Object.keys(params).sort().forEach(k => { if (params[k]) want.set(k, params[k]); });
  const target = path + (String(want) ? "?" + want : "");
  // Compare what was asked for, not its spelling in the address, so this can never send someone in a loop.
  const got = new URL(String(req.url || "/"), "https://x").searchParams;
  const same = [...got.keys()].length === [...want.keys()].length && [...want.keys()].every(k => got.getAll(k).length === 1 && got.get(k) === want.get(k));
  if (same) return false;
  res.setHeader("Location", target);
  res.setHeader("Cache-Control", "public, s-maxage=86400");
  res.status(308).send("");
  return true;
}

// 2. Remember answers in this server copy, share one in-flight request among everyone asking at the same moment,
//    and remember failures for a short time so a struggling source isn't retried on every visit.
//    If a refresh fails but an earlier good answer exists (up to a day old), keep using it; asOf() tells its real age.
//    An answer may carry "shortLife: true" (for example, a list cut short because a source was busy); it is kept only briefly.
const MEMO = new Map();
const SHORT = 120e3, STALE_MAX = 24 * 3600e3;
function memo(key, ttlMs, fn, failMs = SHORT) {
  const hit = MEMO.get(key), now = Date.now();
  if (hit) {
    if (hit.pending) return hit.pending;
    if (hit.good && now - hit.good.at < (hit.good.short ? SHORT : ttlMs)) return Promise.resolve(hit.good.value);
    if (hit.failAt && now - hit.failAt < failMs) {
      if (hit.good && now - hit.good.at < STALE_MAX) return Promise.resolve(hit.good.value);
      return Promise.reject(hit.error);
    }
  }
  const pending = Promise.resolve().then(fn).then(
    value => { MEMO.set(key, { good: { at: Date.now(), value, short: !!(value && value.shortLife) } }); return value; },
    error => {
      const old = hit && hit.good;
      MEMO.set(key, { good: old, failAt: Date.now(), error });
      if (old && Date.now() - old.at < STALE_MAX) return old.value;
      throw error;
    });
  MEMO.set(key, { ...(hit || {}), pending });
  return pending;
}
// When the answer for a key was actually fetched from its source (null if never).
function asOf(key) { const h = MEMO.get(key); return h && h.good ? h.good.at : null; }

// 0. These functions only read. Anything other than GET or HEAD is refused, so it can't skip the saved copy at the edge.
function onlyRead(req, res) {
  const m = String(req.method || "GET").toUpperCase();
  if (m === "GET" || m === "HEAD") return false;
  res.setHeader("Allow", "GET, HEAD");
  res.status(405).send("");
  return true;
}

// Every call to a source gives up after 8 seconds, so one slow source can't hold everyone else up.
const TIMEOUT_MS = 8000;
function fetchWithTimeout(url, opts) { return fetch(url, { ...(opts || {}), signal: AbortSignal.timeout(TIMEOUT_MS) }); }

// 3. A spending limit per source in this server copy, kept under the source's own limit, with a pause after it says "busy".
const BUDGET = new Map();
function spend(host, perMinute) {
  const now = Date.now(), b = BUDGET.get(host) || { calls: [], pauseUntil: 0 };
  b.calls = b.calls.filter(t => now - t < 60e3);
  BUDGET.set(host, b);
  if (now < b.pauseUntil || b.calls.length >= perMinute) { const e = new Error("busy"); e.busy = true; throw e; }
  b.calls.push(now);
}
function pause(host, ms) { const b = BUDGET.get(host) || { calls: [], pauseUntil: 0 }; b.pauseUntil = Date.now() + ms; BUDGET.set(host, b); }

// 4. Plain messages for the public. Details go to the server log only, never to visitors.
function publicError(label, e) {
  console.error(`[${label}]`, e && e.message);
  if (e && (e.busy || e.status === 429)) return `${label}: the free data source is busy. Try again in a few minutes.`;
  return `${label}: couldn't reach the source just now. Try again later.`;
}

async function getJSON(url, headers, limits) {
  const host = new URL(url).host;
  if (limits && limits[host]) spend(host, limits[host]);
  const r = await fetchWithTimeout(url, { headers: { "User-Agent": "CivicAccord/1.0 (+https://civicaccord.org)", ...(headers || {}) } });
  if (!r.ok) {
    if (r.status === 429) pause(host, 60e3);
    const e = new Error(`${r.status} from ${host}`); e.status = r.status; throw e;
  }
  return r.json();
}

module.exports = { canonical, memo, asOf, onlyRead, fetchWithTimeout, publicError, getJSON };
