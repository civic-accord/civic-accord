// Checks that the site's main security policy keeps its key protections, so a later edit can't quietly weaken it.
// Run: `node scripts/check-policy.js`. Anyone can read what it checks.
const v = require("../vercel.json");
const main = v.headers.find(h => h.source.includes("geo-frame") && h.source.startsWith("/(("));
const get = (h, k) => ((h && h.headers.find(x => x.key.toLowerCase() === k.toLowerCase())) || {}).value || "";
const csp = get(main, "Content-Security-Policy");
const dir = n => (csp.split(";").map(s => s.trim()).find(s => s.startsWith(n + " ")) || "").slice(n.length + 1).trim();
const problems = [];
if (!csp) problems.push("The main pages have no Content-Security-Policy.");
if (dir("script-src") !== "'self'") problems.push("script-src must be exactly 'self' (no inline or outside scripts).");
if (dir("frame-ancestors") !== "'none'") problems.push("frame-ancestors must be 'none' (no framing).");
if (dir("object-src") !== "'none'") problems.push("object-src must be 'none'.");
if (dir("base-uri") !== "'self'") problems.push("base-uri must be 'self'.");
if (!/max-age=\d{8,}/.test(get(main, "Strict-Transport-Security"))) problems.push("HSTS must be set with a long max-age.");
if (get(main, "X-Content-Type-Options") !== "nosniff") problems.push("X-Content-Type-Options must be nosniff.");
if (problems.length) { problems.forEach(p => console.error("Problem: " + p)); process.exit(1); }
console.log("OK: the main security policy keeps its key protections.");
