/* Your records, kept only in this browser: the issues you follow (each with a dated baseline of what you last saw) and
   what you reported sending to offices. Nothing here is sent to Civic Accord. Records don't sync across devices and
   are lost if this browser's data is cleared; export makes a copy you keep.

   Shapes are kept stable so they could later move into a shared, anonymous record without changing:
     follows[issueId] = { issue:{id,title,kind,level}, since, baseline }        (baseline: lib/issue.js snapshot)
     sent[] = { id, issue:{id,title,version}, office:{id,name,holder}, channel, message, sentOn, recordedAt,
                status:{ participation:"individual", delivery:"reported-by-you", response:"none-recorded" } }
   Delivery is always "reported-by-you": Civic Accord didn't deliver it and can't confirm it was received. */
(function(){
const KEY="civicaccord-records", FORMAT="civic-accord-records", MAX_IMPORT=2e6;
const OTHER=/^civicaccord-(item-votes|reactions|progress|topics|districts|signer|geo|learn-notes|learn-topics|learn-districts)$/;
const empty=()=>({v:1,follows:{},sent:[]});
const str=(s,n)=>String(s==null?"":s).slice(0,n);
const okId=id=>typeof id==="string"&&/^[A-Za-z0-9._:\/-]{3,120}$/.test(id);
const day=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||""))?String(s):null;
// A send date can't be later than today (with a day's grace for time zones).
const past=(d,now)=>{if(!d)return null;const lim=new Date((now||new Date()).getTime()+864e5).toISOString().slice(0,10);return d<=lim?d:null};
const iso=s=>typeof s==="string"&&!isNaN(Date.parse(s))&&s.length<40?s:null;
const pair=x=>x&&typeof x==="object"?{date:day(String(x.date||"").slice(0,10)),text:str(x.text,1000)}:null;
// Other settings are restored only if they have the expected shape. Free text (notes, practice votes, name and town)
// may contain any characters, since pages always display it as plain text; size and nesting are limited.
// Topic lists must hold known-looking topic ids, and district settings plain place codes and names.
function plainData(x,depth){depth=depth||0;if(depth>6)return false;
  if(x===null||typeof x==="number"||typeof x==="boolean")return true;
  if(typeof x==="string")return x.length<=10000;
  if(Array.isArray(x))return x.length<=1000&&x.every(y=>plainData(y,depth+1));
  if(typeof x==="object"){const ks=Object.keys(x);return ks.length<=1000&&ks.every(k=>k.length<=300&&plainData(x[k],depth+1))}
  return false}
function placeData(x){if(!x||typeof x!=="object"||Array.isArray(x))return false;
  if("state" in x&&x.state!==null&&!(typeof x.state==="string"&&/^[A-Z]{2}$/.test(x.state)))return false;
  const ok=v=>v===null||typeof v==="boolean"||typeof v==="number"||(typeof v==="string"&&v.length<=200&&!/[<>"`]/.test(v))||(v&&typeof v==="object"&&!Array.isArray(v)&&Object.values(v).every(ok));
  return Object.values(x).every(ok)}
function safeSetting(key,x){const k=key.replace(/^civicaccord-/,"");
  if(k==="topics"||k==="learn-topics")return !!x&&typeof x==="object"&&(!("picked" in x)||(Array.isArray(x.picked)&&x.picked.length<=20&&x.picked.every(t=>typeof t==="string"&&/^[a-z0-9-]{1,40}$/.test(t))))&&plainData(x);
  if(k==="districts"||k==="geo"||k==="learn-districts")return placeData(x);
  return plainData(x)}
// Only known fields, with dates that look like dates, survive an import.
function cleanBaseline(b){if(!b||typeof b!=="object"||!iso(b.seenAt))return null;
  const out={seenAt:b.seenAt,dataAt:iso(b.dataAt),status:pair(b.status),final:pair(b.final),vetoed:pair(b.vetoed),
    actionsKnown:b.actionsKnown!==false,lastAction:pair(b.lastAction),actionCount:Number.isFinite(b.actionCount)?Math.max(0,Math.floor(b.actionCount)):0,
    closes:day(b.closes),meets:day(b.meets),version:typeof b.version==="string"&&/^v[0-9a-z]{1,12}$/.test(b.version)?b.version:null};
  return out}

function make(storage){
  const get=()=>{try{const v=JSON.parse(storage.getItem(KEY)||"null");return v&&v.v===1&&v.follows&&Array.isArray(v.sent)?v:empty()}catch(e){return empty()}};
  const put=r=>{try{storage.setItem(KEY,JSON.stringify(r));return true}catch(e){return false}};
  // Whether this browser is keeping data at all (private windows and blocked storage may not).
  function available(){try{const k=KEY+"-probe";storage.setItem(k,"1");storage.removeItem(k);return true}catch(e){return false}}

  function follow(issue,baseline,now){if(!okId(issue&&issue.id))return false;const r=get();
    r.follows[issue.id]={issue:{id:issue.id,title:str(issue.title,300),kind:str(issue.kind,80),level:str(issue.level,20)},since:(now||new Date()).toISOString(),baseline:baseline||null};return put(r)}
  function unfollow(id){const r=get();delete r.follows[id];return put(r)}
  const isFollowing=id=>!!get().follows[id];
  const follows=()=>Object.values(get().follows).sort((a,b)=>String(b.since).localeCompare(String(a.since)));
  function setBaseline(id,baseline,title){const r=get();if(!r.follows[id])return false;r.follows[id].baseline=baseline;if(title)r.follows[id].issue.title=str(title,300);return put(r)}

  function addSent(x,now){
    if(!okId(x&&x.issue&&x.issue.id)||!x.office||!x.office.name)return null;
    const rec={id:"s"+(now||new Date()).getTime().toString(36)+Math.random().toString(36).slice(2,7),
      issue:{id:x.issue.id,title:str(x.issue.title,300),version:x.issue.version?str(x.issue.version,40):null},
      office:{id:x.office.id?str(x.office.id,80):null,name:str(x.office.name,200),holder:x.office.holder?str(x.office.holder,120):null},
      channel:str(x.channel||"email",30),message:str(x.message,8000),sentOn:past(day(x.sentOn),now),recordedAt:(now||new Date()).toISOString(),
      status:{participation:"individual",delivery:"reported-by-you",response:"none-recorded"}};
    const r=get();r.sent.push(rec);return put(r)?rec:null}
  function removeSent(id){const r=get();r.sent=r.sent.filter(s=>s.id!==id);return put(r)}
  const sentFor=issueId=>get().sent.filter(s=>s.issue.id===issueId).sort((a,b)=>String(b.sentOn||b.recordedAt).localeCompare(String(a.sentOn||a.recordedAt)));
  const allSent=()=>get().sent.slice();

  // A copy of everything Civic Accord saved in this browser, for the person to keep.
  function exportData(now){const data={};
    try{for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k===KEY||OTHER.test(k||""))data[k]=storage.getItem(k)}}catch(e){}
    return {format:FORMAT,version:1,exportedAt:(now||new Date()).toISOString(),
      notice:"This file may contain private messages you wrote, your name and town, your districts, and your views on public issues. Keep it somewhere safe. Share it only if you choose to.",data}}

  // Restore from an exported file. Follows and sent records are merged without duplicates; for anything else already
  // saved here, what's here is kept. Returns a plain summary, or throws an Error with a plain message.
  function importData(text){
    if(String(text).length>MAX_IMPORT)throw new Error("That file is too large to be a Civic Accord export.");
    let f;try{f=JSON.parse(text)}catch(e){throw new Error("That file isn't a Civic Accord export.")}
    if(!f||f.format!==FORMAT||f.version!==1||!f.data||typeof f.data!=="object")throw new Error("That file isn't a Civic Accord export.");
    const out={follows:0,sent:0,other:0,kept:0,skipped:0};
    const r=get();
    if(typeof f.data[KEY]==="string"){let x;try{x=JSON.parse(f.data[KEY])}catch(e){x=null}
      if(x&&x.follows&&typeof x.follows==="object")for(const [id,v] of Object.entries(x.follows)){
        if(!okId(id)||!v||!v.issue)continue;
        const mine=r.follows[id];
        const bl=cleanBaseline(v.baseline);
        if(!mine){r.follows[id]={issue:{id,title:str(v.issue.title,300),kind:str(v.issue.kind,80),level:str(v.issue.level,20)},since:iso(v.since)||new Date().toISOString(),baseline:bl};out.follows++}
        else if(bl&&(!mine.baseline||String(bl.seenAt)>String(mine.baseline.seenAt)))mine.baseline=bl;
      }
      if(x&&Array.isArray(x.sent)){const have=new Set(r.sent.map(s=>s.id));
        x.sent.forEach(s=>{if(s&&typeof s.id==="string"&&!have.has(s.id)&&s.issue&&okId(s.issue.id)&&s.office&&s.office.name){
          r.sent.push({id:str(s.id,40),issue:{id:s.issue.id,title:str(s.issue.title,300),version:s.issue.version?str(s.issue.version,40):null},
            office:{id:s.office.id?str(s.office.id,80):null,name:str(s.office.name,200),holder:s.office.holder?str(s.office.holder,120):null},
            channel:str(s.channel||"email",30),message:str(s.message,8000),sentOn:past(day(s.sentOn)),recordedAt:iso(s.recordedAt)||new Date().toISOString(),
            status:{participation:"individual",delivery:"reported-by-you",response:"none-recorded"}});have.add(s.id);out.sent++}})}
    }
    if(!put(r))throw new Error("This browser isn't saving data right now, so nothing was restored.");
    for(const [k,v] of Object.entries(f.data)){if(!OTHER.test(k)||typeof v!=="string")continue;
      let parsed;try{parsed=JSON.parse(v)}catch(e){continue}
      if(!safeSetting(k,parsed)){out.skipped++;continue}
      let have=null;try{have=storage.getItem(k)}catch(e){}
      if(have===null){try{storage.setItem(k,v);out.other++}catch(e){}}else out.kept++}
    return out;
  }
  return {available,follow,unfollow,isFollowing,follows,setBaseline,addSent,removeSent,sentFor,allSent,exportData,importData,KEY};
}
if(typeof window!=="undefined"){let s=null;try{s=window.localStorage}catch(e){}
  window.CA_RECORDS=make(s||{getItem:()=>null,setItem:()=>{throw new Error("no storage")},removeItem:()=>{},key:()=>null,length:0})}
if(typeof module!=="undefined")module.exports={make};
})();
