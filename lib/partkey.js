/* Stable names for the parts of an official summary, so a saved practice vote stays with the exact text it was cast on.
   The name comes from the part's own words (and its lead-in), not its position. If a paragraph is added above it,
   the name doesn't change. If the words change, the name changes, and the old vote is not moved onto the new text. */
(function(){
const norm=s=>String(s||"").toLowerCase().replace(/\s+/g," ").trim();
// FNV-1a 32-bit hash, written out so pages and tests produce the same result.
function fnv(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h.toString(36)}
const partKey=p=>"k"+fnv(norm(p.lead)+"|"+norm(p.text));
const versionKey=parts=>"v"+fnv(parts.map(partKey).join(","));
const api={partKey,versionKey};
if(typeof window!=="undefined")window.CA_PARTKEY=api;
if(typeof module!=="undefined")module.exports=api;
})();
