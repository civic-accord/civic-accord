// Checks that the security policy for geo-frame.html allows exactly the script in that file.
// Run after editing geo-frame.html: `node scripts/check-csp.js` (add `--fix` to update vercel.json).
const fs = require("fs"), crypto = require("crypto"), path = require("path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "geo-frame.html"), "utf8");
const code = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1];
if (!code) { console.error("No inline script found in geo-frame.html"); process.exit(1); }
const hash = "sha256-" + crypto.createHash("sha256").update(code, "utf8").digest("base64");
const vfile = path.join(root, "vercel.json"), v = fs.readFileSync(vfile, "utf8");
if (v.includes(`'${hash}'`)) { console.log("OK: vercel.json allows the current geo-frame.html script."); process.exit(0); }
if (process.argv.includes("--fix")) { fs.writeFileSync(vfile, v.replace(/'sha256-[A-Za-z0-9+/=]+'/, `'${hash}'`)); console.log("Updated vercel.json to " + hash); process.exit(0); }
console.error("Mismatch: vercel.json must allow '" + hash + "'. Run with --fix."); process.exit(1);
