/* Civic Accord deadline helpers. Shared by pages and tests.
   Official comment deadlines usually come as a date only (no time), so we never imply an exact cutoff:
   on the closing date the item says "Closes today" and points to the notice for the exact time. */
(function(){
// Today's date as YYYY-MM-DD in a time zone (default: the viewer's own).
function today(now,tz){const d=now||new Date();return d.toLocaleDateString("en-CA",tz?{timeZone:tz}:undefined)}
// Whole days from today to a YYYY-MM-DD date. Negative means it's already past. Null if there's no date.
function daysLeft(date,now,tz){if(!date||!/^\d{4}-\d{2}-\d{2}/.test(date))return null;
  const a=Date.UTC(...today(now,tz).split("-").map((x,i)=>i===1?x-1:+x)), b=Date.UTC(...String(date).slice(0,10).split("-").map((x,i)=>i===1?x-1:+x));
  return Math.round((b-a)/864e5)}
const isClosed=(date,now,tz)=>{const d=daysLeft(date,now,tz);return d!==null&&d<0};
// "Within a week" means today through 7 days from now, never a date already past.
const closesSoon=(date,now,tz)=>{const d=daysLeft(date,now,tz);return d!==null&&d>=0&&d<=7};
function label(date,now,tz){const d=daysLeft(date,now,tz);if(d===null)return null;if(d<0)return "Closed";if(d===0)return "Closes today";if(d===1)return "1 day left";return d+" days left"}
const api={today,daysLeft,isClosed,closesSoon,label};
if(typeof window!=="undefined")window.CA_DATES=api;
if(typeof module!=="undefined")module.exports=api;
})();
