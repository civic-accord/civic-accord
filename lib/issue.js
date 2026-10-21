/* What an issue page says about where an official item stands, what to do next, and what changed since someone last
   looked. Shared by the issue page, the Following page, and the tests. Uses only official data the page already has.
   It never says an office responded (offices haven't joined yet) and never links an action to anyone's request. */
(function(){
const D=typeof window!=="undefined"?window.CA_DATES:require("./dates.js");
const PK=typeof window!=="undefined"?window.CA_PARTKEY:require("./partkey.js");
const longDate=d=>{if(!d)return "";const x=new Date(String(d).slice(0,10)+"T12:00:00Z");return isNaN(x)?String(d):x.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric",timeZone:"UTC"})};

// Where the item stands, from the official record. Dates are judged on the viewer's own day (lib/dates.js).
function stageOf(it,now){
  if(!it)return {key:"unknown",label:"Status not available"};
  if(it.final)return {key:"final",label:"Final decision",detail:it.final.text,date:it.final.date||null};
  if(it.kind==="Proposed rule"){
    if(!it.closes)return {key:"rule",label:"Proposed rule",detail:"No comment deadline is listed in the notice."};
    return D.isClosed(it.closes,now)?{key:"comment-closed",label:"Comment period closed",date:it.closes}:{key:"comment-open",label:"Open for official comments",date:it.closes};
  }
  if(it.level==="local"){
    if(!it.meets)return {key:"meeting",label:"Public meeting",detail:"No meeting date is listed."};
    return D.isClosed(it.meets,now)?{key:"meeting-held",label:"Meeting held",date:it.meets}:{key:"meeting-upcoming",label:"Meeting scheduled",date:it.meets};
  }
  if(it.status&&it.status.text)return {key:"in-progress",label:"In progress",detail:it.status.text,date:it.status.date||null};
  return {key:"unknown",label:"Status not available"};
}

// The most useful thing to do next. own: whether this item is from one of the viewer's own governments.
function nextAction(it,stage,own,now){
  const L=(it&&it.links)||{};
  switch(stage.key){
    case "comment-open":{const d=D.daysLeft(stage.date,now);
      return {text:d===0?"Comment officially today (the notice has the exact time)":`Comment officially by ${longDate(stage.date)}`,href:L.comment||null,official:true}}
    case "meeting-upcoming":return {text:`Meeting on ${longDate(stage.date)}. The agenda says how to comment or testify.`,href:L.comment||L.official||null,official:true};
    case "in-progress":return own?{text:"Tell your representatives what you think",anchor:"tell"}:{text:"Follow for official updates",anchor:"follow"};
    case "final":return {text:"See what the official record shows",anchor:"follow-through"};
    case "comment-closed":case "meeting-held":return {text:"Follow for what happens next",anchor:"follow"};
    default:return {text:"Read the official text",href:L.text||L.official||null,official:true};
  }
}

// What someone saw, with when they saw it and when the source data was fetched. Kept only on their device.
function snapshot(it,fetchedAt,now){
  const parts=it.parts&&it.parts.length?it.parts:null;
  const acts=Array.isArray(it.actions)?it.actions:[];
  return {seenAt:(now||new Date()).toISOString(),dataAt:fetchedAt||null,
    status:it.status?{date:it.status.date||null,text:String(it.status.text||"")}:null,
    final:it.final?{date:it.final.date||null,text:String(it.final.text||"")}:null,
    lastAction:acts.length?{date:acts[0].date||null,text:String(acts[0].text||"")}:null,actionCount:acts.length,
    closes:it.closes||null,meets:it.meets||null,version:parts?PK.versionKey(parts):null};
}

// Compare what someone last saw with the latest official data.
//   result "unavailable": the source didn't answer. Nothing is concluded; the baseline is kept.
//   result "not-refreshed": the source's data is no newer than what they last saw, so there's nothing new to compare.
//   result "changed": one or more changes, each with why it's listed.
//   result "no-change": newer data, and nothing material changed.
// soon: deadlines and meetings in the next 7 days (listed apart from changes; they aren't changes).
function compare(base,cur,curFetchedAt,now){
  if(!cur)return {result:"unavailable",changes:[],soon:[]};
  const soon=[];
  if(cur.closes&&D.closesSoon(cur.closes,now))soon.push({kind:"deadline",text:`Official comments close ${D.label(cur.closes,now).toLowerCase()==="closes today"?"today":"on "+longDate(cur.closes)}`,why:"A deadline you can still act on is within 7 days."});
  if(cur.meets&&D.closesSoon(cur.meets,now))soon.push({kind:"meeting-soon",text:`Meeting on ${longDate(cur.meets)}`,why:"A public meeting is within 7 days."});
  if(!base)return {result:"no-baseline",changes:[],soon};
  if(base.dataAt&&curFetchedAt&&Date.parse(curFetchedAt)<=Date.parse(base.dataAt))return {result:"not-refreshed",changes:[],soon};
  const c=snapshot(cur,curFetchedAt,now),changes=[];
  const same=(a,b)=>JSON.stringify(a||null)===JSON.stringify(b||null);
  if(c.final&&!base.final)changes.push({kind:"final",text:`Final decision${c.final.date?" on "+longDate(c.final.date):""}: ${c.final.text}`,why:"The official record shows this item is finished."});
  else if(!same(c.lastAction,base.lastAction)&&c.lastAction)changes.push({kind:"action",text:`New official action${c.lastAction.date?" on "+longDate(c.lastAction.date):""}: ${c.lastAction.text}`,why:"The official record shows a new step."});
  else if(!same(c.status,base.status)&&c.status)changes.push({kind:"action",text:`Status updated${c.status.date?" on "+longDate(c.status.date):""}: ${c.status.text}`,why:"The official status changed."});
  if(c.meets&&c.meets!==base.meets)changes.push({kind:"meeting",text:base.meets?`Meeting date changed from ${longDate(base.meets)} to ${longDate(c.meets)}`:`Meeting scheduled for ${longDate(c.meets)}`,why:"A public meeting date was set or moved."});
  if(c.closes!==base.closes&&(c.closes||base.closes))changes.push({kind:"deadline",text:c.closes?(base.closes?`Comment deadline changed from ${longDate(base.closes)} to ${longDate(c.closes)}`:`Comment deadline set: ${longDate(c.closes)}`):"The comment deadline was removed from the notice",why:"The official comment deadline changed."});
  else if(c.closes&&!D.isClosed(base.closes,new Date(base.seenAt))&&D.isClosed(c.closes,now))changes.push({kind:"closed",text:`The comment period closed on ${longDate(c.closes)}`,why:"The deadline passed since you last looked."});
  if(c.meets&&c.meets===base.meets&&!D.isClosed(base.meets,new Date(base.seenAt))&&D.isClosed(c.meets,now))changes.push({kind:"held",text:`The meeting on ${longDate(c.meets)} has taken place`,why:"The meeting date passed since you last looked."});
  if(base.version&&c.version&&base.version!==c.version)changes.push({kind:"summary",text:"The official summary changed",why:"Practice votes on changed parts need your review."});
  return {result:changes.length?"changed":"no-change",changes,soon};
}

// Text for sharing an issue. Contains only public facts: never the sharer's view, name, or address.
function shareText(it,fetchedAt,stage,url){
  return `${it.title}\n${stage.label}${stage.date?" ("+longDate(stage.date)+")":""}. Source: ${it.source&&it.source.label||"official record"}, fetched ${longDate(String(fetchedAt||"").slice(0,10))}.\nOn Civic Accord, no votes are counted yet. ${url}`;
}

const api={stageOf,nextAction,snapshot,compare,shareText,longDate};
if(typeof window!=="undefined")window.CA_ISSUE=api;
if(typeof module!=="undefined")module.exports=api;
})();
