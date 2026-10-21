const $=id=>document.getElementById(id);
const cssId=id=>String(id).replace(/[^A-Za-z0-9_-]/g,"_");
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const safe=u=>/^https:\/\//.test(u||"")?u:null;
const STATES=["","AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","PR","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
let VER=null;try{VER=JSON.parse(localStorage.getItem("civicaccord-verified")||"null")}catch(e){}
const REKEY="civicaccord-reactions";let REACT={};try{REACT=JSON.parse(localStorage.getItem(REKEY)||"{}")}catch(e){}
let GROUPS=[], OPENG=new Set();
// Your steps on each item. Kept only on this device.
const PKEY="civicaccord-progress";let PROG=(()=>{try{return JSON.parse(localStorage.getItem(PKEY)||"{}")}catch(e){return {}}})(), JUST=null;
function mark(id,k){(PROG[id]=PROG[id]||{})[k]=1;JUST=id+":"+k;try{localStorage.setItem(PKEY,JSON.stringify(PROG))}catch(e){}}
let DATA=null, shown=10, OPENID=null; const COMMENT={};
window.__openMail=window.__openMail||(u=>{location.href=u});
const DKEY="civicaccord-districts", SKEY="civicaccord-signer";
let DIST=(VER&&VER.districts&&VER.districts.state)?VER.districts:(()=>{try{return JSON.parse(localStorage.getItem(DKEY)||"null")}catch(e){return null}})();
let SIGNER=(()=>{try{return JSON.parse(localStorage.getItem(SKEY)||"null")||{name:"",town:""}}catch(e){return {name:"",town:""}}})();
let SIGNER_EDIT=false; // true while the name and town fields are open for editing
let FED=null, STATELEG=null;
async function loadReps(){
  FED=null;STATELEG=null;if(!DIST)return;
  try{FED=await CA_REG.officeholders(DIST)}catch(e){FED={}}
  try{STATELEG=await CA_REG.stateLegislators(DIST)}catch(e){STATELEG={legislators:[],errors:["Couldn't reach the legislator lookup."]}}
  if(OPENID)render();
}
function renderMe(){
  const m=$("me");
  if(DIST){m.innerHTML=`<div><h2>Who represents you</h2><p style="margin:4px 0 0">Writing as a resident of ${esc(DIST.stateName||DIST.state)}${DIST.cd?`, congressional district ${esc(DIST.cd)}`:""}${DIST.sldl?`, state house ${esc(DIST.sldl)}`:""}${DIST.sldu?`, state senate ${esc(DIST.sldu)}`:""}. <a href="#" id="chg" style="color:var(--koa)">Change</a></p></div>`;
    $("chg").onclick=e=>{e.preventDefault();DIST=null;try{localStorage.removeItem(DKEY)}catch(x){}renderMe();render()};return}
  m.innerHTML=`<div><h2>Who represents you</h2><p style="margin:4px 0 0">To tell your representatives what you think, enter your address once. Only your districts are kept on this device. The address goes from your browser straight to the U.S. Census Bureau.</p></div>
   <div class="row"><label for="addr" class="meta">Home address (street, city, state, ZIP)</label><input id="addr" type="text" autocomplete="street-address" placeholder="Street address, city, state, ZIP"><button class="btn" id="findme" type="button">Find my representatives</button></div>
   <span class="toast" id="memsg" aria-live="polite"></span>`;
  const go=async()=>{const a=$("addr").value.trim();if(a.length<8){$("memsg").textContent="Enter a full street address, including city and state.";return}
    $("memsg").textContent="Looking up your districts with the Census Bureau…";
    try{const g=await CA_REG.lookup(a);DIST=CA_REG.districtsOf(g);try{localStorage.setItem(DKEY,JSON.stringify(DIST))}catch(x){}
      if(DIST.state&&STATES.includes(DIST.state)&&$("st").value!==DIST.state){$("st").value=DIST.state;load()}
      renderMe();loadReps();render()}
    catch(e){$("memsg").textContent=e.message==="nomatch"?"The Census Bureau couldn't match that address. Check the spelling and include the city and state.":"Couldn't reach the Census Bureau. Try again in a moment."}};
  $("findme").onclick=go;$("addr").onkeydown=e=>{if(e.key==="Enter")go()};
}
// Recipients and the suggested message are shared with the issue page (lib/tell.js).
const recipients=it=>CA_TELL.recipients(it,DIST,FED,STATELEG);
const message=(it,sal)=>CA_TELL.message(it,sal,{stance:REACT[it.id],comment:COMMENT[it.id]||"",signer:SIGNER,dist:DIST});
// What this person opened to send, per item, so "Yes, I sent it" can offer to keep a record of it. Only in memory
// until they choose to save it.
const PENDING={};let RECORDING=null;
function pend(it,r,channel,m){const list=PENDING[it.id]=PENDING[it.id]||[];const x={officeId:r.officeId,name:r.name,title:r.title,channel,text:`Subject: ${m.subject}\n\n${m.body}`};
  const i=list.findIndex(y=>y.officeId===r.officeId&&y.name===r.name);if(i>=0)list[i]=x;else list.push(x)}
function manualOffice(it){return it.kind==="Proposed rule"?{officeId:CA_OFFICES.agency(it.who||"agency"),name:it.who||"The agency",title:it.who||"The agency",channel:"official-comment",text:""}
  :it.level==="local"?{officeId:it.localId?CA_OFFICES.local(it.localId):null,name:it.who,title:it.who,channel:"meeting-comment",text:""}:null}
function composeBox(it){
  const v=REACT[it.id];
  const reps=DIST?recipients(it):[];
  const loading=DIST&&((it.level==="federal"&&!FED)||(it.level==="state"&&!STATELEG));
  const errs=it.level==="state"&&STATELEG&&STATELEG.errors.length?STATELEG.errors:[];
  return `<div class="compose">
    <b>Tell your representatives you ${v==="Support"?"support":v==="Oppose"?"oppose":"have questions about"} this</b>
    ${it.kind==="Proposed rule"?`<p class="meta">For a proposed rule, the agency decides. ${it.commentForm===false?"The notice, linked above, explains how to send your official comment.":safe(it.act)?`Your official comment goes through <a href="${esc(it.act)}" target="_blank" rel="noopener" style="color:var(--koa);font-weight:700">Comment officially</a>.`:"Send your official comment through the agency's notice."} This message is a second step: it lets your members of Congress know.</p>`:""}
    <label for="cm" class="meta">Add your own words (optional)</label><textarea id="cm" rows="3" maxlength="1200" placeholder="Why it matters to you, in a sentence or two.">${esc(COMMENT[it.id]||"")}</textarea>
    ${SIGNER.name&&!SIGNER_EDIT?`<p class="meta">Signed as <b>${esc(SIGNER.name)}</b>${SIGNER.town?`, ${esc(SIGNER.town)}`:""} (remembered on this device). <a href="#" data-sedit="1" style="color:var(--koa)">Change</a></p>`:`<div class="two"><div><label for="sn" class="meta">Your name</label><input id="sn" autocomplete="name" value="${esc(SIGNER.name)}"></div><div><label for="stw" class="meta">Your town (optional)</label><input id="stw" autocomplete="address-level2" value="${esc(SIGNER.town)}"></div></div>`}
    ${!DIST?`<p>First, find who represents you. <a href="#me" data-gome="1" style="color:var(--koa);font-weight:700">Enter your address</a> (it takes a few seconds, and only your districts are kept on this device).</p>`:loading?`<p class="meta">Finding your representatives…</p>`:reps.length?reps.map((r,i)=>`<div class="rep"><b>${esc(r.title)}</b><span class="meta">${esc(r.name)}</span><div class="acts">
        ${r.email?`<a class="btn" href="#" data-mail="${i}" style="text-decoration:none">Email ${esc(r.sal)}</a>`:""}
        ${!r.email&&safe(r.url)?`<a class="btn" href="${esc(r.url)}" target="_blank" rel="noopener" data-form="${i}" style="text-decoration:none">Open contact form</a><button type="button" class="linkbtn" data-copy="${i}">Show the message</button>`:""}
        ${r.phone?`<a href="tel:${esc(String(r.phone).replace(/[^0-9+]/g,""))}">Call ${esc(r.phone)}</a>`:""}
        <span class="toast" id="rm-${i}" aria-live="polite"></span></div></div>`).join(""):`<p class="meta">${errs.length?esc(errs.join(" ")):"We couldn't find contact details for these offices yet."} Your legislature's website lists them.</p>`}
    <p class="meta">Email opens in your own email app, so it comes from you. Members of Congress don't publish email addresses, so for them the message is copied as their contact form opens; paste it there. Civic Accord never sees what you send.</p>
  </div>`;
}
const fmt=d=>d?new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"";
// Deadlines are checked against today's date every time the list is drawn (lib/dates.js), so a saved or cached list
// never shows a closed item as open.
const daysLeft=d=>CA_DATES.daysLeft(d);
let RAW=[];
function refreshLive(){if(!DATA)return;DATA.items=RAW.filter(it=>!CA_DATES.isClosed(it.closes)&&!CA_DATES.isClosed(it.meets));DATA.closedNow=RAW.length-DATA.items.length}

// Topics: a quick pick of what you care about. Saved only on this device. Matching uses published word lists (lib/topics.js), not AI.
const TKEY="civicaccord-topics", TMAX=5, TOP=window.CA_TOPICS||{list:[],match:()=>[]};
let TP=(()=>{try{return JSON.parse(localStorage.getItem(TKEY)||"null")}catch(e){return null}})()||{picked:[],skipped:false};
let EDIT=!TP.picked.length&&!TP.skipped, DRAFT=[...TP.picked], VIEW=TP.picked.length?"mine":"all";
const MATCH={};
const topicsOf=it=>MATCH[it.id]||(MATCH[it.id]=TOP.match(it));
const tlabel=id=>(TOP.list.find(t=>t.id===id)||{}).label||id;
function saveTP(){try{localStorage.setItem(TKEY,JSON.stringify(TP))}catch(e){}}
function tcount(id){return DATA?(DATA.items||[]).filter(it=>topicsOf(it).some(m=>m.id===id)).length:null}
function renderTopics(){
  const box=$("topics");
  if(!TOP.list.length){box.hidden=true;VIEW="all";return}
  if(EDIT){
    box.innerHTML=`<h2 id="th">What do you care about?</h2>
      <p class="meta" style="margin:0">Pick up to ${TMAX} topics and we'll show what's open on those first, soonest deadlines at the top. It takes a few seconds. Your picks stay on this device.</p>
      <div class="chips" role="group" aria-label="Topics">${TOP.list.map(t=>{const on=DRAFT.includes(t.id),n=tcount(t.id);
        return `<button type="button" data-t="${t.id}" aria-pressed="${on}" ${!on&&DRAFT.length>=TMAX?"disabled":""}>${esc(t.label)}${n!==null?`<span class="n">${n}</span>`:""}</button>`}).join("")}</div>
      <p class="meta" id="tn" aria-live="polite" style="margin:0">${DRAFT.length} of ${TMAX} picked.${tcount("health")!==null?" Numbers show how many items are open on each topic right now.":""}</p>
      <div class="row save"><button class="btn" id="tsave" type="button" ${DRAFT.length?"":"disabled"}>Show my issues</button><button class="linkbtn" id="tskip" type="button">Skip and show everything</button></div>`;
    box.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{const id=b.dataset.t;DRAFT=DRAFT.includes(id)?DRAFT.filter(x=>x!==id):DRAFT.length<TMAX?[...DRAFT,id]:DRAFT;renderTopics();const nb=box.querySelector(`[data-t="${id}"]`);if(nb)nb.focus()});
    $("tsave").onclick=()=>{TP={picked:[...DRAFT],skipped:false};saveTP();EDIT=false;VIEW="mine";shown=10;renderTopics();if(DATA){render();updateHeadline()}$("feed").scrollIntoView({behavior:"smooth",block:"start"})};
    $("tskip").onclick=()=>{TP={picked:TP.picked,skipped:true};saveTP();EDIT=false;VIEW=TP.picked.length?VIEW:"all";shown=10;renderTopics();if(DATA)render()};
    return;
  }
  const opts=TP.picked.length?[["mine","All my topics"],...TP.picked.map(id=>[id,tlabel(id)]),["all","Everything"]]:[["all","Everything"]];
  box.innerHTML=`<div class="row" style="justify-content:space-between"><h2 id="th" style="font-size:1.05rem">${TP.picked.length?"Your topics":"Showing everything"}</h2>
      <button class="linkbtn" id="tedit" type="button">${TP.picked.length?"Change topics":"Pick topics to narrow this down"}</button></div>
    <div class="chips" role="group" aria-label="Show">${opts.map(([v,l])=>{const n=v==="all"?(DATA?DATA.items.length:null):v==="mine"?(DATA?mineItems().length:null):tcount(v);
      return `<button type="button" data-v="${esc(v)}" aria-pressed="${VIEW===v}">${esc(l)}${n!==null?`<span class="n">${n}</span>`:""}</button>`}).join("")}</div>`;
  box.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{VIEW=b.dataset.v;shown=10;renderTopics();render()});
  $("tedit").onclick=()=>{EDIT=true;DRAFT=[...TP.picked];renderTopics();const f=$("topics").querySelector("[data-t]");if(f)f.focus()};
}
function updateTally(){const v=Object.values(PROG),rd=v.filter(x=>x.read).length,rc=Object.values(REACT).filter(Boolean).length,sp=v.filter(x=>x.spoke).length;
  const t=$("tally");if(!rd&&!rc){t.hidden=true;return}t.hidden=false;
  const parts=[rd&&`looked at ${rd} item${rd===1?"":"s"}`,rc&&`said where you stand on ${rc}`,sp&&`spoken up on ${sp}`].filter(Boolean);
  const list=parts.length>1?parts.slice(0,-1).join(", ")+", and "+parts[parts.length-1]:parts[0];
  t.textContent=`Your steps so far, kept only on this device: you've ${list}.`}
function gcount(list){const k=new Set();list.forEach(it=>k.add(it.kind==="Proposed rule"&&it.title.includes(";")?it.who+"|"+it.title.split(";")[0].trim():it.id));return k.size}
function updateHeadline(){if(!DATA)return;const all=DATA.items||[];const mine=TP.picked.length?mineItems():all;const nm=gcount(mine),na=gcount(all);
  const wk=mine.filter(i=>CA_DATES.closesSoon(i.closes)).length;
  const names=TP.picked.map(tlabel).map(x=>x.toLowerCase());const list=names.length<=2?names.join(" and "):names.slice(0,-1).join(", ")+", and "+names[names.length-1];
  // Your own local meetings are included in "your topics" even when no topic word matches, so say so.
  const localOnly=TP.picked.length?mine.filter(it=>!topicsOf(it).some(m=>TP.picked.includes(m.id))).length:0;
  $("headline").textContent=TP.picked.length?`${mine.length} item${mine.length===1?"":"s"} on ${TP.picked.length===1?names[0]:"your topics"}${localOnly?`, including ${localOnly} local meeting${localOnly===1?"":"s"},`:""} you can weigh in on right now${DIST&&DIST.stateName?" in "+DIST.stateName+" and nationwide":""}.`:`${all.length} items you can weigh in on right now${DIST&&DIST.stateName?" in "+DIST.stateName+" and nationwide":""}.`;
  $("subline").textContent=TP.picked.length?(wk?`${wk} close${wk===1?"s":""} within a week. Start with the one at the top, and each item shows your next step.`:"Start with the one at the top. Each item shows your next step."):"Pick what you care about, and we'll start there.";
  if(DATA.quiet)$("subline").textContent+=" "+DATA.quiet;}
// Your own county or city's meetings always show in "your topics", since meeting titles rarely name a topic.
function mineItems(){return (DATA.items||[]).filter(it=>topicsOf(it).some(m=>TP.picked.includes(m.id))||(it.level==="local"&&canRespond(it)))}
// Respond only to items from governments that represent you: federal items anywhere, state items only in your own state.
function canRespond(it){if(it.level==="federal")return true;
  // Local meetings: only for residents of that county or city (from the address on this device).
  if(it.level==="local")return !!(DIST&&((it.countyId&&DIST.countyId===it.countyId)||(it.placeId&&DIST.placeId===it.placeId)||(it.townId&&DIST.townId===it.townId)));
  return !!(DIST&&DIST.state&&DIST.state===$("st").value)}
function whyLine(it){const ms=topicsOf(it);if(!ms.length)return "";const mine=ms.filter(m=>TP.picked.includes(m.id)),show=mine.length?mine:ms;
  const gh=`https://github.com/civic-accord/civic-accord/issues/new?title=${encodeURIComponent("Wrong topic: "+it.title.slice(0,80))}&body=${encodeURIComponent("Item: "+it.id+"\nShown as: "+show.map(m=>m.label).join(", ")+"\nShould be: ")}`;
  return `<span class="why">${mine.length?"Your topic":"Topic"}: ${show.map(m=>esc(m.label)).join(", ")} <details class="whyd"><summary>Wrong topic?</summary><span class="meta">Matched on the word${show.length>1?"s":""} ${show.map(m=>`“${esc(m.word)}”`).join(", ")} in the official text, from a published word list, not AI. <a href="${gh}" target="_blank" rel="noopener" style="color:var(--koa)">Suggest a better topic</a>.</span></details></span>`}
function stepOf(it){const p=PROG[it.id]||{};return !p.read?0:!REACT[it.id]?1:!p.spoke?2:!p.talk?3:4}
const KIND=it=>it.kind==="Proposed rule"?"Federal rule":it.kind==="Bill in Congress"?"Bill in Congress":it.level==="state"?"State bill":it.level==="local"?"Local meeting":it.kind;
function pathHTML(it){const p=PROG[it.id]||{},now=stepOf(it),ro=!canRespond(it);
  const st=[["Read",p.read],["Where you stand",REACT[it.id]],["Speak up",p.spoke],["Go further",p.talk],["Counted",0]];
  const keys=["read","react","spoke","talk"];
  return `<ol class="path" aria-label="Your steps on this item">${st.map(([l,d],i)=>{const cls=i===4?"planned":d?"done":(!ro&&i===now)?"now":"";
    const just=JUST&&JUST===it.id+":"+keys[i]?" just":"";
    return `<li class="${cls}${just}">${l}${i===4?" (planned)":""}<span class="sr-only" style="position:absolute;left:-9999px">${i===4?", planned":d?", done":(!ro&&i===now)?", next":""}</span></li>`}).join("")}</ol>`}
function nextHTML(it){
  const p=PROG[it.id]||{},now=stepOf(it),r=REACT[it.id];
  const start=`item.html?id=${encodeURIComponent(it.id)}#h2`, build=`new.html?from=${encodeURIComponent(it.source)}&title=${encodeURIComponent(it.title.slice(0,140))}&url=${encodeURIComponent(it.read||"")}`;
  const reacts=`<div class="go" role="group" aria-label="Where you stand">${["Support","Oppose","Unsure"].map(x=>`<button type="button" data-r="${esc(it.id)}" data-v="${x}" aria-pressed="${r===x}">${x}</button>`).join("")}</div>`;
  if(!canRespond(it)&&it.level==="local")return `<div class="next ro"><p>${DIST&&!DIST.countyId&&!DIST.placeId?`Your saved districts are from before local meetings were added. <a href="#me" data-gome="1" style="color:var(--koa)">Enter your address again</a> so we know your local governments.`:DIST?`This meeting is for ${esc(it.who)}, so it's here to read. Reactions are for your own county, city, town, or township.`:`To respond to a local meeting, <a href="#me" data-gome="1" style="color:var(--koa)">enter your address</a> so we know your local governments.`} Anyone can read the agenda or testify.</p></div>`;
  if(!canRespond(it))return `<div class="next ro"><p>${DIST?`This is another state's bill, so it's here to read. Reactions and messages are for bills in your own state (${esc(DIST.stateName||DIST.state)}).`:`To respond to a state bill, <a href="#me" data-gome="1" style="color:var(--koa)">enter your address</a> so we know it's your state.`}</p>
    <div class="go"><a class="primary" data-read="${esc(it.id)}" href="item.html?id=${encodeURIComponent(it.id)}">Read what it says</a>${safe(it.read)?`<a data-read="${esc(it.id)}" href="${esc(it.read)}" target="_blank" rel="noopener">Official text</a>`:""}</div></div>`;
  if(now===0)return `<div class="next"><p>Start by reading what it says: one page built from the official summary, with the full text one link away.</p>
    <div class="go"><a class="primary" data-read="${esc(it.id)}" href="item.html?id=${encodeURIComponent(it.id)}">Read what it says</a>${safe(it.read)?`<a data-read="${esc(it.id)}" href="${esc(it.read)}" target="_blank" rel="noopener">Official text</a>`:""}<button type="button" data-skip="${esc(it.id)}">I already know it</button></div></div>`;
  if(now===1)return `<div class="next"><p>Where do you stand? You can change this anytime.</p>${reacts}</div>`;
  if(now===2){
    const local=it.level==="local"&&!!safe(it.act), rule=(it.kind==="Proposed rule"||local)&&!!safe(it.act);
    return `<div class="next"><p>${local?`This is a public meeting of ${esc(it.who)}. Speaking up at or before the meeting is how it hears from residents. The meeting page and agenda say how to comment and by when.`:rule?`The agency decides this one, and it must consider the official comments. That's the comment that counts most.${it.commentForm===false?" This notice has no online comment form. It explains how to comment, often by email or mail.":""}`:`You picked ${esc(r)}. Now tell the people who represent you, in your own words.`}</p>
      ${RECORDING===it.id?CA_TELL.recordPanel("rec-"+cssId(it.id),PENDING[it.id],manualOffice(it)):p.started?`<div class="go" role="group" aria-label="Did you send it?"><span>Did you send it?</span><button type="button" class="primary" data-sent="${esc(it.id)}">Yes, I sent it</button></div>`:""}
      ${reacts}
      ${rule?`<div class="go"><a class="primary" data-spoke="${esc(it.id)}" href="${esc(it.act)}" target="_blank" rel="noopener">${esc(it.actLabel||"Comment officially")}</a>${local?"":`<button type="button" data-tell="${esc(it.id)}">${OPENID===it.id?"Hide the message":"Also tell your members of Congress"}</button>`}</div>`:""}
      ${!rule&&OPENID!==it.id?`<div class="go"><button type="button" class="primary" data-tell="${esc(it.id)}">Write to your representatives</button></div>`:""}
      ${OPENID===it.id?composeBox(it):""}
      ${rule||p.started?"":`<button type="button" class="linkbtn" data-sk2="${esc(it.id)}" style="justify-self:start">I've already spoken up</button>`}</div>`}
  if(now===3)return `<div class="next"><p>Nice work. Want to go further? Weigh in on each part of it, copied word for word from the official summary, and see any official cost estimate. Your votes there are practice for now, saved only on this device. <a href="${esc(build)}" style="color:var(--koa)">Or build your own deliberation</a>.</p>
    <div class="go"><a class="primary" data-talk="${esc(it.id)}" href="${esc(start)}">Weigh in on each part</a>${OPENID===it.id?"":`<button type="button" data-tell="${esc(it.id)}">Write another message</button>`}</div>${OPENID===it.id?composeBox(it):""}</div>`;
  return `<div class="next"><p>You've done everything you can here today. In the live version, verified voters' views would be counted in a public record anyone can check. That part is planned. <a href="verify.html" style="color:var(--koa)">See how verification will work</a>.</p>${OPENID===it.id?composeBox(it):`<div class="go"><button type="button" data-tell="${esc(it.id)}">Write another message</button></div>`}</div>`;
}
function card(it,first){
  const dl=daysLeft(it.closes);
  const sm=it.summary||"";
  return `<article class="item lvl-${esc(it.level)}" id="it-${esc(it.id)}">
    <div class="top"><span class="kindtag">${esc(KIND(it))}</span>${far(it)?`<span class="kindtag" title="This item names another state in its official title">About ${esc(CA_PLACE.statesNamed(it.title).map(k=>CA_PLACE.NAMES[k]).join(" and "))}</span>`:""}${first?`<span class="start">Start here</span>`:""}
      ${it.closes&&dl!==null?`<span class="clock ${CA_DATES.closesSoon(it.closes)?"soon":""}">${CA_DATES.label(it.closes)}</span>`:""}</div>
    <h3><a href="item.html?id=${encodeURIComponent(it.id)}" style="color:inherit" title="Open this issue's page">${esc(it.title)}</a></h3>
    ${whyLine(it)}
    <span class="who">${esc(it.who)}${it.opened?`, opened ${fmt(it.opened)}`:""}${it.closes?`. Comments close ${fmt(it.closes)}${dl===0?" (check the notice for the exact time)":""}.`:""}${it.meets?`. Meets ${fmt(it.meets)}.`:""}</span>
    ${sm?(sm.length>220?`<details class="sum"><summary>${esc(sm.slice(0,200).replace(/\s+\S*$/,""))}… <span style="color:var(--koa)">More</span></summary>${esc(sm)}${it.summaryCut?` <a href="item.html?id=${encodeURIComponent(it.id)}" style="color:var(--koa)">Full summary</a>`:""}</details>`:`<p class="sum">${esc(sm)}</p>`):""}
    ${pathHTML(it)}
    ${nextHTML(it)}
    <div class="also">${safe(it.read)&&stepOf(it)>0?`<a data-read="${esc(it.id)}" href="${esc(it.read)}" target="_blank" rel="noopener">Official text</a>`:""}${safe(it.act)&&it.actLabel&&it.kind!=="Proposed rule"?`<a href="${esc(it.act)}" target="_blank" rel="noopener">${esc(it.actLabel)}</a>`:""}<span class="meta">From ${esc(it.source)}</span></div>
  </article>`;
}
// Federal items about one other state (an air plan for North Carolina, a water program for Arkansas) sort after your
// own state's items and nationwide rules. Judged from the official title only (lib/place.js). Nothing is hidden.
function far(it){return it.level==="federal"&&DIST&&DIST.state&&window.CA_PLACE&&CA_PLACE.aboutAnotherState(it.title,DIST.state)?1:0}
function render(){
  const qraw=$("q").value.trim(), q=qraw.toLowerCase(), lvl=$("lvl").value, kd=$("kind").value;
  const base=q?(DATA.items||[]):VIEW==="mine"&&TP.picked.length?mineItems():VIEW!=="all"&&VIEW!=="mine"?(DATA.items||[]).filter(it=>topicsOf(it).some(m=>m.id===VIEW)):(DATA.items||[]);
  const items=base.filter(it=>(!lvl||it.level===lvl)&&(!kd||it.kind===kd)&&(!q||(it.title+" "+it.who+" "+it.summary).toLowerCase().includes(q)))
    .sort((a,b)=>(far(a)-far(b))||(a.closes||a.meets||"9999").localeCompare(b.closes||b.meets||"9999"));
  const scope=q?` matching "${qraw}" (searching everything)`:VIEW==="mine"&&TP.picked.length?" on your topics":VIEW!=="all"&&VIEW!=="mine"?` on ${tlabel(VIEW)}`:"";
  const wk=items.filter(i=>!far(i)&&CA_DATES.closesSoon(i.closes));
  $("soon").hidden=!wk.length;$("soon").textContent=wk.length?`${wk.length} of these close${wk.length===1?"s":""} within a week. They're at the top.`:"";
  const empty=VIEW!=="all"&&!q?`<p class="meta">Nothing is open on ${VIEW==="mine"?"your topics":esc(tlabel(VIEW))} right now${lvl||kd?" with these filters":""}. <button class="linkbtn" type="button" id="seeall">See everything that's open</button></p>`:(q?`<p class="meta">Nothing matches. Try another word.</p>`:`<p class="meta">Nothing is open for public input here right now${lvl||kd?" with these filters":""}.${DATA&&DATA.quiet?" "+esc(DATA.quiet):""} See "Where this comes from" at the bottom of the page for each source.</p>`);
  // Many near-identical rules (for example, dozens of "Airworthiness Directives") are folded into one group.
  const groups=[],gi={};
  items.forEach(it=>{const k=it.kind==="Proposed rule"&&it.title.includes(";")?it.who+"|"+it.title.split(";")[0].trim():it.id;
    if(gi[k]===undefined){gi[k]=groups.length;groups.push({k,name:it.title.split(";")[0].trim(),list:[it]})}else groups[gi[k]].list.push(it)});
  GROUPS=groups;
  // One unit everywhere: items. When similar items are folded together, say so.
  $("count").textContent=`${items.length} item${items.length===1?"":"s"} open${scope}${groups.length<items.length?`, shown in ${groups.length} groups of similar items`:""}. ${items.some(i=>i.closes)?"Soonest deadlines first.":""}${(()=>{const n=items.filter(far).length;return n?` ${n} item${n===1?" is":"s are"} about other states; ${n===1?"it comes":"they come"} after yours.`:""})()}${DATA.closedNow?` ${DATA.closedNow} item${DATA.closedNow===1?" has":"s have"} closed since this list was fetched, so ${DATA.closedNow===1?"it's":"they're"} hidden.`:""}`;
  $("list").innerHTML=groups.slice(0,shown).map((g,gi)=>{const rest=g.list.length-1,f=gi===0&&!q&&VIEW!=="all";
    if(!rest)return card(g.list[0],f);
    const open=OPENG.has(g.k);
    return card(g.list[0],f)+(open?g.list.slice(1).map(card).join(""):"")+`<button class="linkbtn" type="button" data-g="${esc(g.k)}" aria-expanded="${open}">${open?`Hide the other ${rest}`:`Show ${rest} more like this: “${esc(g.name)}”`}</button>`}).join("")||empty;
  document.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{const k=b.dataset.g;OPENG.has(k)?OPENG.delete(k):OPENG.add(k);const y=window.scrollY;render();window.scrollTo({top:y})});
  const sa=$("seeall");if(sa)sa.onclick=()=>{VIEW="all";shown=10;renderTopics();render()};
  $("more").textContent=`Show ${Math.min(10,groups.length-shown)} more (${groups.length-shown} left)`;
  $("more").hidden=groups.length<=shown;
  const keep=()=>{const y=window.scrollY;render();window.scrollTo({top:y});JUST=null};
  document.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{const id=b.dataset.r;REACT[id]=REACT[id]===b.dataset.v?undefined:b.dataset.v;mark(id,"read");if(REACT[id])JUST=id+":react";try{localStorage.setItem(REKEY,JSON.stringify(REACT))}catch(e){}keep()});
  document.querySelectorAll("[data-read]").forEach(a=>a.addEventListener("click",()=>{const id=a.dataset.read;if(!(PROG[id]||{}).read){mark(id,"read");setTimeout(keep,50)}}));
  document.querySelectorAll("[data-skip]").forEach(b=>b.onclick=()=>{mark(b.dataset.skip,"read");keep()});
  document.querySelectorAll("[data-spoke]").forEach(a=>a.addEventListener("click",()=>{mark(a.dataset.spoke,"started");setTimeout(keep,50)}));
  document.querySelectorAll("[data-sent]").forEach(b=>b.onclick=()=>{const id=b.dataset.sent;const it=DATA.items.find(x=>x.id===id);
    if(!it||(!(PENDING[id]||[]).length&&!manualOffice(it))){mark(id,"spoke");OPENID=null;keep();return}
    RECORDING=id;OPENID=null;keep();const f=document.querySelector(`#rec-${cssId(id)} textarea, #rec-${cssId(id)} button`);if(f)f.focus()});
  if(RECORDING){const it=DATA.items.find(x=>x.id===RECORDING);if(it)CA_TELL.bindPanel("rec-"+cssId(it.id),{id:it.id,title:it.title,version:null},PENDING[it.id],manualOffice(it),()=>{mark(it.id,"spoke");delete PENDING[it.id];RECORDING=null;keep()})}
  document.querySelectorAll("[data-sk2]").forEach(b=>b.onclick=()=>{mark(b.dataset.sk2,"spoke");OPENID=null;keep()});
  document.querySelectorAll("[data-talk]").forEach(a=>a.addEventListener("click",()=>mark(a.dataset.talk,"talk")));
  document.querySelectorAll("[data-tell]").forEach(b=>b.onclick=()=>{OPENID=OPENID===b.dataset.tell?null:b.dataset.tell;keep()});
  document.querySelectorAll("[data-gome]").forEach(a=>a.onclick=e=>{e.preventDefault();$("me").scrollIntoView({behavior:"smooth",block:"center"});const f=$("addr");if(f)setTimeout(()=>f.focus({preventScroll:true}),400)});
  updateTally();
  const it=OPENID&&DATA.items.find(x=>x.id===OPENID);
  if(it){
    const keep=()=>{const sn=$("sn"),stw=$("stw");if(sn&&stw){SIGNER={name:sn.value.trim(),town:stw.value.trim()};try{localStorage.setItem(SKEY,JSON.stringify(SIGNER))}catch(e){}}};
    if($("sn")){$("sn").oninput=keep;$("stw").oninput=keep}$("cm").oninput=()=>{COMMENT[it.id]=$("cm").value};
    document.querySelectorAll("[data-sedit]").forEach(a=>a.onclick=e=>{e.preventDefault();SIGNER_EDIT=true;const y=window.scrollY;render();window.scrollTo({top:y});const f=$("sn");if(f)f.focus({preventScroll:true})});
    const reps=recipients(it);
    document.querySelectorAll("[data-mail]").forEach(a=>a.onclick=async e=>{e.preventDefault();keep();const r=reps[+a.dataset.mail];const m=message(it,r.sal),el=$("rm-"+a.dataset.mail);
      const {url,shown}=await CA_TELL.mailUrl(r.email,m,el);
      pend(it,r,"email",m);window.__openMail(url);mark(it.id,"started");
      if(!shown){setTimeout(()=>{const y=window.scrollY;render();window.scrollTo({top:y})},1200);el.textContent="Opening your email app…"}});
    document.querySelectorAll("[data-form]").forEach(a=>a.addEventListener("click",()=>{const i=+a.dataset.form,r=reps[i];if(!r)return;keep();const m=message(it,r.sal);pend(it,r,"contact-form",m);mark(it.id,"started");
      const txt=`Subject: ${m.subject}\n\n${m.body}`,t=$("rm-"+i),noName=/\[Your name\]/.test(txt)?" It ends with [Your name]: replace that after pasting.":"";
      CA_TELL.copy(txt).then(ok=>{if(ok){if(t)t.textContent="Message copied. Paste it into the form that just opened."+noName}else CA_TELL.showText(t,txt,"Couldn't copy automatically. Select the message below, copy it, and paste it into the form."+noName)});
      setTimeout(()=>{const y=window.scrollY;render();window.scrollTo({top:y});const t2=$("rm-"+i);if(t2&&t&&t.textContent)t2.textContent=t.textContent},1200)}));
    document.querySelectorAll("[data-copy]").forEach(b=>b.onclick=()=>{keep();const i=+b.dataset.copy,r=reps[i],m=message(it,r.sal);pend(it,r,"contact-form",m);const txt=`Subject: ${m.subject}\n\n${m.body}`;
      const t=$("rm-"+i),noName=/\[Your name\]/.test(txt)?" It ends with [Your name]: add your name above first, or replace it after pasting.":"";
      CA_TELL.copy(txt).then(ok=>CA_TELL.showText(t,txt,(ok?"Copied. This is the message; paste it into the contact form.":"Select the message below and copy it, then paste it into the contact form.")+noName))});
  }
}
// Only the latest state choice is ever shown: earlier requests are cancelled, and a late answer is ignored.
let LOADSEQ=0, LOADCTL=null;
async function load(){
  const st=$("st").value, seq=++LOADSEQ;
  if(LOADCTL)try{LOADCTL.abort()}catch(e){}
  LOADCTL=typeof AbortController!=="undefined"?new AbortController():null;
  $("count").textContent="Loading what's open…";
  let d=null;
  try{d=await (await fetch("/api/open"+(st?"?state="+st:""),LOADCTL?{signal:LOADCTL.signal}:undefined)).json()}catch(e){if(seq===LOADSEQ)$("count").textContent="Couldn't load the feed. Check your connection and try again.";return}
  if(seq!==LOADSEQ||$("st").value!==st)return;
  setWhere();
  // A reply without a list (for example, a platform error page) is treated as a failed load, never as "nothing open".
  if(!d||!Array.isArray(d.items)){$("count").textContent="Couldn't load the feed. Try again in a few minutes.";return}
  d.sources=d.sources||[];d.errors=d.errors||[];d.notConnected=d.notConnected||[];
  DATA=d;RAW=(DATA.items||[]).slice();refreshLive();
  const when=t=>t?new Date(t).toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short"}):"";
  $("sources").innerHTML=DATA.sources.map(s=>`<li><a href="${esc(safe(s.url)||"#")}" target="_blank" rel="noopener" style="color:var(--koa)">${esc(s.label)}</a> · ${s.count} items${s.at?` · fetched ${esc(when(s.at))}`:""}${s.stale?` <b>· Couldn't refresh just now, so this is the last good list.</b>`:""}</li>`).join("")+DATA.errors.map(e=>`<li class="meta">Couldn't reach a source just now: ${esc(e)}</li>`).join("");
  if(DATA.quiet) $("sources").innerHTML+=`<li class="meta">${esc(DATA.quiet)}</li>`;
  if(DATA.partial) $("sources").innerHTML+=`<li class="meta">${esc(DATA.partial)}</li>`;
  $("notconn").innerHTML=DATA.notConnected.length?`<h3>Not connected yet</h3><ul class="plain">${DATA.notConnected.map(n=>`<li>${esc(n.label)}. ${esc(n.how)} (<a href="${esc(safe(n.url)||"#")}" target="_blank" rel="noopener" style="color:var(--koa)">get one</a>), added by the site's host.</li>`).join("")}</ul>`:"";
  $("fetched").textContent="Fetched "+new Date(DATA.fetchedAt).toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short"});
  const kinds=[...new Set(DATA.items.map(i=>i.kind))], cur=$("kind").value;
  $("kind").innerHTML=`<option value="">All types</option>`+kinds.map(k=>`<option ${k===cur?"selected":""}>${esc(k)}</option>`).join("");
  shown=10;renderTopics();render();updateHeadline();
}
renderMe();loadReps();
$("st").innerHTML=STATES.map(s=>`<option value="${s}">${s?s:"Choose your state"}</option>`).join("");
const vs=DIST&&DIST.state; if(vs&&STATES.includes(vs)) $("st").value=vs;
function setWhere(){const st=$("st").value, nm=st?($("st").selectedOptions[0]||{}).textContent:"";
  $("where").innerHTML=st?`Showing federal items and items for ${esc(nm)}${DIST&&DIST.state===st?" (your state)":""}. Your reactions and steps stay on this device.`:`Showing federal items. Choose your state to add your state legislature's bills and connected local meetings. Your reactions and steps stay on this device.`}
setWhere();
$("q").oninput=()=>{shown=10;render()};$("lvl").onchange=()=>{shown=10;render()};$("kind").onchange=()=>{shown=10;render()};$("st").onchange=load;$("more").onclick=()=>{const n=shown;shown+=10;render();const c=$("list").children[n];if(c){c.setAttribute("tabindex","-1");c.focus({preventScroll:true})}};
renderTopics();
load();
// Coming back to an open tab, or leaving it open past midnight, re-checks every deadline.
// Redraw only if a deadline actually passed, so someone in the middle of writing a message isn't interrupted.
let LASTDAY=CA_DATES.today();
function recheck(){if(!DATA)return;const before=DATA.items.length,day=CA_DATES.today();refreshLive();
  if(DATA.items.length===before&&day===LASTDAY)return;LASTDAY=day;renderTopics();render();updateHeadline()}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)recheck()});
setInterval(recheck,30*60*1000);
