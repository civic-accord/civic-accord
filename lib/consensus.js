/* Civic Accord consensus rule and small shared helpers, used by every page and by the tests.
   Changing this rule changes the core design, so it needs the project lead's OK. */
(function(){
// The consensus rule, the same on every page. Each group is [agree, disagree, pass] for one statement.
// A group decides a label only once it has at least 10 votes on that statement, so a handful of people can't
// stand in for a whole group. Labels need at least two such groups. Common ground: every counted group is at 70%
// or more. Divides groups: at least one counted group is at 70% or more and at least one is under 50%.
const MIN_GROUP_VOTES=10;
// Compared on exact counts (agree × 100 ≥ 70 × votes), so 69.5% never rounds up to 70%. A pass counts as not agreeing.
function consensusLabel(groups){const counted=groups.filter(g=>g[0]+g[1]+g[2]>=MIN_GROUP_VOTES);
  if(counted.length<2) return "forming";
  const atLeast=(g,p)=>g[0]*100>=p*(g[0]+g[1]+g[2]);
  if(counted.every(g=>atLeast(g,70))) return "common";
  if(counted.some(g=>atLeast(g,70))&&counted.some(g=>!atLeast(g,50))) return "split";
  return "forming"}
// Share of registered voters who took part, as plain text.
function shareText(n,total){if(!total)return "";if(!n)return "0%";const v=n/total*100;return v<0.01?"under 0.01%":v<1?v.toFixed(2)+"%":v.toFixed(1)+"%"}
const httpsOnly=u=>/^https:\/\//.test(String(u||""))?u:null;
const api={MIN_GROUP_VOTES,consensusLabel,shareText,httpsOnly};
if(typeof window!=="undefined")Object.assign(window,api);
if(typeof module!=="undefined")module.exports=api;
})();
