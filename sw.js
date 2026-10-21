// Civic Accord service worker. Pages and files work offline from the last visit.
// Live data (/api/*) is never served from this cache, so no one sees stale items as if they were current.
const VERSION = "ca-v12";
const SHELL = ["/", "/index.html", "/how.html", "/open.html", "/ask.html", "/governments.html", "/verify.html", "/app.html", "/inbox.html", "/new.html", "/learn.html", "/item.html", "/following.html",
  "/lib/registry.js", "/lib/topics.js", "/lib/forget.js", "/lib/sw-register.js", "/lib/dates.js", "/lib/partkey.js", "/lib/consensus.js", "/lib/offices.js", "/lib/records.js", "/lib/issue.js", "/lib/tell.js", "/lib/sample.js", "/lib/nav.js", "/geo-frame.html",
  "/js/app.js", "/js/ask.js", "/js/governments.js", "/js/inbox.js", "/js/index-2.js", "/js/index-3.js", "/js/index.js", "/js/item.js", "/js/following.js", "/js/home.js", "/js/learn.js", "/js/new.js", "/js/open.js", "/js/verify.js", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png", "/icons/favicon-32.png",
  "/registry/us.json", "/registry/states.json", "/packs/index.json"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;           // other sites: untouched
  if (url.pathname.startsWith("/api/")) return;                                        // live data: always from the network
  // Pages and files: try the network first so updates show right away; fall back to the last saved copy offline.
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match("/index.html"))));
});
