// The issue page: one permanent page per official item. Understand it, take part through official channels, keep your
// own record of what you sent, and see what the official record shows afterward.
// Everything you do here stays in this browser (lib/records.js). Nothing is counted or sent by Civic Accord.
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const safe=u=>/^https:\/\//.test(String(u||""))?u:null;
const fmt=d=>{if(!d)return "";const x=new Date(String(d).slice(0,10)+"T12:00:00Z");return isNaN(x)?esc(d):x.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric",timeZone:"UTC"})};
const when=iso=>{const x=new Date(iso);return isNaN(x)?"":x.toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short"})};
const ID=new URLSearchParams(location.search).get("id")||"";
const tag=(k,t)=>`<span class="lbl ${k}">${t}</span>`;
const LIVE=tag("live","Live"), SAMPLE=tag("sample","Sample"), PLANNED=tag("planned","Planned"), PRACTICE=tag("practice","Practice"), YOURS=tag("yours","Reported by you");
// State bills: practice voting only for your own state, the same as Open Now.
const DIST=(()=>{try{const v=JSON.parse(localStorage.getItem("civicaccord-verified")||"null");if(v&&v.districts&&v.districts.state)return v.districts;return JSON.parse(localStorage.getItem("civicaccord-districts")||"null")}catch(e){return null}})();
const VKEY="civicaccord-item-votes", REKEY="civicaccord-reactions", SKEY="civicaccord-signer";
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||"null")||d}catch(e){return d}};
let ALL=load(VKEY,{}), REACT=load(REKEY,{}), SIGNER=load(SKEY,{name:"",town:""});
// Practice votes are saved by each part's own words (lib/partkey.js), with the text they were cast on,
// so a vote never moves onto different text if the official summary changes.
let MINE=ALL[ID]||{parts:{},added:[]};
let LEGACY=0;
if(MINE.parts&&Object.values(MINE.parts).some(v=>typeof v==="string")){LEGACY=Object.keys(MINE.parts).length;MINE.parts={}}
const save=()=>{ALL[ID]=MINE;try{localStorage.setItem(VKEY,JSON.stringify(ALL))}catch(e){}};
if(LEGACY)save();
const CH=[["0","Agree"],["1","Disagree"],["2","Pass"]];
const VOTE={"0":"Agree","1":"Disagree","2":"Pass"};
function choose(key,label){const v=MINE.parts[key]&&MINE.parts[key].v;
  return `<div class="choose" role="group" aria-label="${esc(label)}: your view">${CH.map(([k,t])=>`<button type="button" data-k="${esc(key)}" data-v="${k}" aria-pressed="${v===k}">${t}</button>`).join("")}</div>`}

let IT=null, FETCHED=null, FED=null, STATELEG=null, TELL=false, PENDING=[], RECORDING=false, COMMENT="", SINCE=null;

// Who can act on it, in plain words. The office record for each seat is planned (offices haven't joined yet).
function whoCanAct(it){const J=it.jurisdiction||{}, st=DIST&&DIST.state;
  if(it.kind==="Bill in Congress"){
    if(!st)return "The U.S. Congress. The House and the Senate can each consider it.";
    if(TERR.includes(st)){const who=st==="PR"?"resident commissioner":"delegate";
      return `The U.S. Congress. The House and the Senate can each consider it. Your ${who} in the House can work on it in committee but can't vote on its final passage, and ${st==="DC"?"D.C.":"your territory"} has no U.S. senators.`}
    return "The U.S. Congress. The House and the Senate can each consider it, including your member of the U.S. House and your two U.S. senators."}
  if(it.kind==="Proposed rule")return `${J.name||"The federal agency"}. The agency decides, and must consider the official comments.`;
  if(it.level==="local")return `${J.name}. Its members can decide at a public meeting.`;
  const code=J.stateCode||"";
  if(code==="NE")return "The Nebraska Legislature, which has one chamber. Its senators can consider it.";
  if(code==="DC")return "The D.C. Council. Its councilmembers can consider it.";
  return `The ${J.name||"state legislature"}. Its chambers can consider it${st&&st===code?", including your state legislators":""}.`}
function ownOf(it){const J=it.jurisdiction||{};
  if(it.level==="local")return !!(DIST&&((J.countyId&&DIST.countyId===J.countyId)||(J.placeId&&DIST.placeId===J.placeId)||(J.townId&&DIST.townId===J.townId)));
  return it.level!=="state"||!!(DIST&&DIST.state&&DIST.state===J.stateCode)}
const versionLabel=it=>it.summary?`${esc(it.summary.by)}${it.summary.version?` · ${esc(it.summary.version)}`:""}${it.summary.date?`, ${fmt(it.summary.date)}`:""}`:"No official summary yet";

function topBlock(it,stage,next,following){
  return `<section class="panel top" aria-labelledby="t-h"><h2 id="t-h" class="sr-only">At a glance</h2>
    <dl class="kv">
      <dt>The item</dt><dd>${esc(it.title)} ${LIVE}<br><span class="meta">Version: ${versionLabel(it)}</span></dd>
      <dt>Who can act</dt><dd>${esc(whoCanAct(it))}${it.level!=="local"&&it.kind!=="Proposed rule"?`<br><a href="governments.html?from=${encodeURIComponent(ID)}" style="color:var(--koa)">See who represents you, and how to reach them</a>`:""}</dd>
      <dt>Where it stands</dt><dd><b>${esc(stage.label)}</b>${stage.date?(stage.key==="comment-open"?` until ${fmt(stage.date)}`:`, ${fmt(stage.date)}`):""}${stage.detail?`<br><span class="meta">${esc(stage.detail)}</span>`:""}</dd>
      <dt>What you can do next</dt><dd>${next.href&&safe(next.href)?`<a class="nextbtn" href="${esc(next.href)}" target="_blank" rel="noopener">${esc(next.text)}</a>`:next.anchor?`<a class="nextbtn" href="#${esc(next.anchor)}">${esc(next.text)}</a>`:esc(next.text)}</dd>
    </dl>
    <div class="acts"><button type="button" class="btn${following?" ghost":""}" id="follow" aria-pressed="${following}">${following?"Following":"Follow this issue"}</button>
      <button type="button" class="btn ghost" id="share">Share this issue</button>
      <a href="following.html" class="meta" style="align-self:center;color:var(--koa)">See everything you follow</a></div>
    <p class="meta" id="follow-msg" role="status" aria-live="polite">${following?"Saved in this browser only. Changes are checked when you open this page or Following.":"Following saves what you see now, so next time you can see what changed. It stays in this browser."}</p>
    ${SINCE?sinceBox(SINCE):""}
  </section>`}
function sinceBox(s){
  if(s.c.result==="changed")return `<div class="submitbox" id="since"><b>Changed since you last looked (${esc(when(s.base.seenAt))})</b><ul class="plain">${s.c.changes.map(x=>`<li>${esc(x.text)} <span class="meta">${esc(x.why)}</span></li>`).join("")}</ul><p class="meta">These come from the official record. They aren't responses to anyone's request. This is now marked as seen.</p></div>`;
  if(s.c.result==="no-change")return `<p class="meta" id="since">No recorded change in the official record since you last looked (${esc(when(s.base.seenAt))}).</p>`;
  if(s.c.result==="not-refreshed")return `<p class="meta" id="since">The source hasn't been refreshed since you last looked (${esc(when(s.base.seenAt))}), so there's nothing new to compare yet.</p>`;
  return ""}

// "Read the official record": what the official sources say, kept apart from what they don't say and from the reader's
// own judgment. Quoted passages are copied word for word from the linked source, with their lead-in and background so
// qualifications aren't lost. Civic Accord adds only headings, instructions, and status labels. Nothing is summarized
// or reworded by people or AI, and a missing field is reported as missing, never filled with a substitute.
const TERR=["DC","PR","GU","VI","AS","MP"];
function excerpt(it){
  const ps=it.parts||[];if(!ps.length)return null;
  // A meeting's agenda: its first few items as a list. A summary: the first part, plus the parts that share its
  // lead-in (one list), up to three, so a list isn't cut mid-thought.
  const local=it.level==="local";const first=ps[0];let n=1;
  if(local)n=Math.min(ps.length,5);else if(first.lead)while(n<ps.length&&n<3&&ps[n].lead===first.lead)n++;
  const items=ps.slice(0,n);
  const body=local?`<ul class="q5list">${items.map(p=>`<li>${esc(p.text)}</li>`).join("")}</ul>`
    :first.lead?`<p class="q5lead">${esc(first.lead)}</p><ul class="q5list">${items.map(p=>`<li>${esc(p.text)}</li>`).join("")}</ul>`:`<p>${esc(first.text)}</p>`;
  const bg=items.map(p=>p.background).filter(Boolean);
  return {html:`<blockquote class="q5quote">${body}</blockquote>${bg.length?`<details><summary class="meta">Background from the same summary</summary>${bg.join("\n\n").split("\n\n").map(t=>`<p class="meta">${esc(t)}</p>`).join("")}</details>`:""}`,shown:n,total:ps.length};
}
function recordBlock(it,stage){
  const J=it.jurisdiction||{}, local=it.level==="local", rule=it.kind==="Proposed rule", L=it.links||{};
  const by=(it.summary&&it.summary.by?it.summary.by:(it.source&&it.source.label)||"the official source").replace(/^The /,"the ");
  const full=safe(L.text)||safe(L.official);
  const fullLink=full?` <a href="${esc(full)}" target="_blank" rel="noopener" style="color:var(--koa)">Open the full official ${local?"agenda":"text"}</a> <span class="meta">(opens in a new tab${/\.pdf($|\?)/i.test(full)?"; a PDF":""})</span>.`:"";
  const ex=excerpt(it);
  const unit=local?"agenda item":"part";
  // A meeting's list holds only agenda items with legislation attached, so it's never called the full agenda.
  const exNote=ex&&local?`<span class="meta">Agenda items with legislation attached, copied from ${esc(by)}${ex.total>ex.shown?`: ${ex.shown} of ${ex.total}. <a href="#h1" style="color:var(--koa)">All are below</a>`:""}. The full agenda may list more.</span>`
    :ex?ex.shown===ex.total?`<span class="meta">Quoted in full from ${esc(by)}.</span>`:`<span class="meta">Excerpt from ${esc(by)}: ${ex.shown===1?unit+" 1":`${unit}s 1 to ${ex.shown}`} of ${ex.total}.${ex.total>ex.shown?` <a href="#h1" style="color:var(--koa)">All parts are below</a>, in order.`:""}</span>`:"";
  const foot=`<p class="meta">Quoted passages are copied from the linked official sources. Civic Accord adds headings, instructions, and status labels. These are separate from the quoted text.</p>`;
  const nextStep=`<dt>Your next step</dt><dd>You can support it as written, suggest a change, oppose it, or ask for more information. <a href="#h2" style="color:var(--koa)">Take part below</a>${rule&&safe(L.comment)?`, or <a href="${esc(L.comment)}" target="_blank" rel="noopener" style="color:var(--koa)">comment officially</a>`:""}.</dd>`;
  if(local){
    const when=it.meets?`${fmt(it.meets)}${it.meetsTime?" at "+esc(it.meetsTime):""}`:"";
    return `<section class="panel q5" aria-labelledby="q5-h"><div class="eyebrow">From the official record ${LIVE}</div><h2 id="q5-h">About this meeting</h2>
      <p class="meta">What the official agenda says, and how to take part.</p>
      <dl class="kv">
        <dt>Who meets</dt><dd>${esc(J.name||"The local government")}</dd>
        <dt>When</dt><dd>${when||"No meeting date is listed in the information available here."}${it.status&&it.status.text?` <span class="meta">${esc(it.status.text)}.</span>`:""}</dd>
        <dt>On the agenda</dt><dd>${ex?`${ex.html}${exNote}`:`<span class="meta">${esc(it.partsNote||"No agenda items are listed in the information available here.")}</span>`}${fullLink}</dd>
        <dt>How to take part</dt><dd>${safe(L.comment)?`<a href="${esc(L.comment)}" target="_blank" rel="noopener" style="color:var(--koa)">${esc(L.commentLabel||"Meeting page and agenda")}</a>. <span class="meta">The meeting page and agenda say how to comment, in person or in writing.</span>`:"The official agenda says how to take part."}</dd>
      </dl>${foot}</section>`;
  }
  // For a proposed rule, the latest recorded step is its publication, not the comment deadline (that's the next date).
  const act0=rule&&it.actions&&it.actions[0];
  const latest=act0?`${act0.date?fmt(act0.date)+": ":""}${esc(act0.text)}`:it.status&&it.status.text?`${it.status.date?fmt(it.status.date)+": ":""}${esc(it.status.text)}`:"No recorded step is listed in the information available here.";
  const nextDate=it.closes?`Official comments close ${fmt(it.closes)}.`:"No next decision date is listed in the information available here.";
  const costs=(it.costs||[]).filter(c=>safe(c.url));
  return `<section class="panel q5" aria-labelledby="q5-h"><div class="eyebrow">From the official record ${LIVE}</div><h2 id="q5-h">Read the official record</h2>
    <p class="meta">These sources can help you understand the issue. Some questions may not be answered in the information available here.</p>
    <dl class="kv">
      <dt>What the official summary says</dt><dd>${ex?`${ex.html}${exNote}`:`No official summary is available here. Its official title: ${esc(it.title)}.`}${fullLink}</dd>
      ${it.topic&&it.kind==="Bill in Congress"?`<dt>Subject</dt><dd>${esc(it.topic)} <span class="meta">(policy area assigned by the Congressional Research Service)</span></dd>`:""}
      ${rule&&J.name?`<dt>Proposing agency</dt><dd>${esc(J.name)}</dd>`:""}
      <dt>Who could be affected</dt><dd>This page does not identify who would be affected. The official text may provide more detail.</dd>
      <dt>Cost information</dt><dd>${costs.length?costs.map(c=>`<a href="${esc(c.url)}" target="_blank" rel="noopener" style="color:var(--koa)">${esc(c.title)}</a>${c.date?`, ${fmt(c.date)}`:""} · ${esc(c.by)}`).join("<br>")+` <span class="meta">An estimate may not say who would pay. Check the estimate and the official text.</span>`:`No official cost estimate is available here. <span class="meta">${esc(it.costNote||"")}</span>`}</dd>
      <dt>Who's responsible</dt><dd>${esc(whoCanAct(it))}</dd>
      <dt>Latest recorded step</dt><dd>${latest} <span class="meta">(${esc(stage.label)})</span></dd>
      <dt>Next known date</dt><dd>${nextDate}</dd>
      ${nextStep}
    </dl>${foot}</section>`;
}

function render(it){
  const now=new Date(), stage=CA_ISSUE.stageOf(it,now), own=ownOf(it), next=CA_ISSUE.nextAction(it,stage,own&&!!DIST,now);
  $("title").textContent=it.title;
  $("kind").textContent=[it.kind,it.jurisdiction&&it.jurisdiction.name].filter(Boolean).join(" · ");
  document.title=it.title.slice(0,60)+" · Civic Accord";
  const parts=it.parts.length?it.parts:[{text:it.whole}];
  const J=it.jurisdiction||{}, local=it.level==="local";
  const what=it.kind==="Proposed rule"?"proposal":local?"meeting":"bill", from=it.partsFrom||"the official summary";
  const keys=parts.map(p=>CA_PARTKEY.partKey(p)), version=CA_PARTKEY.versionKey(parts);
  const changed=MINE.version&&MINE.version!==version;
  const orphans=Object.keys(MINE.parts).filter(k=>!keys.includes(k));
  const chosen=keys.filter(k=>MINE.parts[k]).length, agreed=keys.filter(k=>MINE.parts[k]&&MINE.parts[k].v==="0").length;
  if(!MINE.version||(!orphans.length&&changed)){MINE.version=version;save()}
  const L=it.links||{}, following=CA_RECORDS.isFollowing(ID), sent=CA_RECORDS.sentFor(ID);
  // Proposed rules too: the official comment comes first (above), and members of Congress can also be told.
  const canTell=(it.level==="federal"&&(it.kind==="Bill in Congress"||it.kind==="Proposed rule"))||it.level==="state";
  const r=REACT[ID];
  $("main").innerHTML=`${topBlock(it,stage,next,following)}
  ${recordBlock(it,stage)}

  <section class="panel" aria-labelledby="h1"><div class="eyebrow">1 · Understand ${LIVE}</div><h2 id="h1">What it is</h2>
    <dl class="kv">
      ${it.status?`<dt>Latest</dt><dd>${it.status.date?fmt(it.status.date)+": ":""}${esc(it.status.text)}</dd>`:""}
      ${it.meets?`<dt>Meets</dt><dd>${fmt(it.meets)}${it.meetsTime?" at "+esc(it.meetsTime):""}</dd>`:""}
      ${it.introduced?`<dt>${it.kind==="Proposed rule"?"Published":"Introduced"}</dt><dd>${fmt(it.introduced)}</dd>`:""}
      ${it.sponsors&&it.sponsors.length?`<dt>Sponsor${it.sponsors.length>1?"s":""}</dt><dd>${it.sponsors.map(s=>esc(s.name)).join(", ")}</dd>`:""}
      ${it.topic?`<dt>Topic</dt><dd>${esc(it.topic)}</dd>`:""}
      <dt>Summary by</dt><dd>${versionLabel(it)}</dd>
      <dt>Cost</dt><dd>${it.costs.filter(c=>safe(c.url)).length?it.costs.filter(c=>safe(c.url)).map(c=>`<a href="${esc(c.url)}" target="_blank" rel="noopener" style="color:var(--koa)">${esc(c.title)}</a>${c.date?`, ${fmt(c.date)}`:""} · ${esc(c.by)}${c.description?`<br><span class="meta">${esc(c.description)}</span>`:""}`).join("<br>"):"No official cost estimate is available here."+(it.kind==="Proposed rule"?" Read the full notice for any cost analysis.":local?" Read the agenda packet for any staff report.":"")}<br><span class="meta">${esc(it.costNote)}</span></dd>
    </dl>
    <div class="links">
      ${safe(L.text)?`<a class="primary" href="${esc(L.text)}" target="_blank" rel="noopener">Read the official text</a>`:""}
      ${safe(L.official)&&L.official!==L.text?`<a href="${esc(L.official)}" target="_blank" rel="noopener">Official page</a>`:""}
    </div>
  </section>

  <section class="panel" aria-labelledby="h2"><div class="eyebrow">2 · Participate ${LIVE} ${PRACTICE}</div><h2 id="h2">Take part</h2>
    <h3 id="tell">Through official channels</h3>
    ${safe(L.comment)?`<div class="links"><a class="primary" href="${esc(L.comment)}" target="_blank" rel="noopener" id="comment-link">${esc(L.commentLabel||(L.commentForm===false?"How to comment (in the notice)":"Comment officially"))}</a></div>`:""}
    ${it.kind==="Proposed rule"?`<p class="meta">For a proposed rule, the agency decides, and it must consider the official comments. Anyone can comment. That's the comment that counts most.</p>`:local?`<p class="meta">This is a public meeting. Speaking up at or before it is how the ${esc(J.name)} hears from residents. The meeting page and agenda say how to comment and by when.</p>`:""}
    ${canTell?tellHTML(it,own,r):""}
    ${(it.kind==="Proposed rule"||local)&&!RECORDING?`<button type="button" class="linkbtn" id="rec-manual">I sent a comment. Keep a record of it</button>`:""}
    ${RECORDING?CA_TELL.recordPanel("rec",PENDING,manualOffice(it)):""}

    <h3>Practice: weigh in on each part ${PRACTICE}</h3>
    <p>${it.parts.length?`Each part below is copied word for word from ${esc(from)}, in order. Do you agree with what it says or would do?`:esc(it.partsNote)}</p>
    ${it.parts.length?`<p class="meta">${local?"Only agenda items with legislation attached are listed. Read the agenda for everything else.":`${it.partsHeadings?`${it.partsHeadings} heading${it.partsHeadings===1?"":"s"} left out. `:""}${it.partsMore?`Showing the first ${it.parts.length} of ${it.partsTotal||"many"} parts. `:""}Read the official text for all of it.`}</p>
    <p class="meta">Some parts describe several things at once, or describe how things work today. If a part mixes things you'd answer differently, choose Pass and add your own statement below. Practice answers on a mixed part aren't a precise view of each piece.</p>`:""}
    ${LEGACY?`<p class="submitbox">You voted on this page before we changed how practice votes are saved. Those ${LEGACY} vote${LEGACY===1?"":"s"} couldn't be safely matched to the current text, so they were cleared. Please vote again.</p>`:""}
    ${orphans.length?`<div class="submitbox" id="review"><b>The official summary changed since your last visit.</b> ${orphans.length} of your earlier practice votes ${orphans.length===1?"was":"were"} on text that's no longer here, so ${orphans.length===1?"it isn't":"they aren't"} applied to the new text. Your votes on parts that didn't change are kept.
      <details><summary class="meta">See the earlier text and your votes</summary><ul class="plain">${orphans.map(k=>`<li><span class="meta">${esc(VOTE[MINE.parts[k].v]||"")}:</span> ${esc(MINE.parts[k].text||"")}</li>`).join("")}</ul></details>
      <button type="button" class="btn ghost" id="clearold">I've reviewed these. Clear them</button></div>`:""}
    ${own?"":`<p class="submitbox">${local?(DIST&&!DIST.countyId&&!DIST.placeId?`Your saved districts are from before local meetings were added. <a href="governments.html?from=${encodeURIComponent(ID)}" style="color:var(--koa)">Enter your address again on My representatives</a> so we know your local governments.`:DIST?`This meeting is for ${esc(J.name)}, so it's here to read. Practice voting is for your own county, city, town, or township. Anyone can read the agenda or testify.`:`To weigh in on a local meeting, first <a href="governments.html?from=${encodeURIComponent(ID)}" style="color:var(--koa)">enter your address on My representatives</a> so we know your local governments. It stays on this device.`):DIST?`This is another state's bill, so it's here to read. Practice voting is for bills in your own state (${esc(DIST.stateName||DIST.state)}).`:`To weigh in on a state bill, first <a href="governments.html?from=${encodeURIComponent(ID)}" style="color:var(--koa)">enter your address on My representatives</a> so we know it's your state. It stays on this device.`}</p>`}
    <ol class="parts">${parts.map((p,i)=>`<li class="part"><span class="num">${it.parts.length?(local?"Agenda item ":"Part ")+(i+1)+(p.ref?" · "+esc(p.ref):""):"The whole "+what}</span>${p.lead?`<span class="meta">${esc(p.lead)}</span>`:""}<blockquote>${esc(p.text)}</blockquote>${p.background?`<details><summary class="meta">Background from the same summary</summary>${String(p.background).split("\n\n").map(t=>`<p class="meta">${esc(t)}</p>`).join("")}</details>`:""}${own?choose(keys[i],it.parts.length?(local?"Agenda item ":"Part ")+(i+1):"The whole "+what):""}</li>`).join("")}</ol>
    ${it.partsMore?`<p class="meta">The summary has more parts than fit here. Read the rest in the official text.</p>`:""}
    <p class="meta" id="saved">${chosen?`Practice votes saved in this browser: ${chosen} of ${keys.length}. Not counted. Not sent to anyone.`:"Practice votes are saved in this browser as you go. They aren't counted or sent to anyone."}</p>
    ${own?`<h3>Add your own statement ${PRACTICE}</h3>
    <form id="addf"><label for="addt" class="meta">One clear idea about this ${what}, in your own words (practice; stays in this browser)</label>
      <textarea id="addt" rows="2" maxlength="200"></textarea>
      <p class="meta">In the live version, a moderator checks new statements against <a href="how.html#rules" style="color:var(--koa)">published rules</a> before others see them.</p>
      <button class="btn" type="submit">Add statement</button> <span class="toast" id="addmsg" aria-live="polite"></span></form>
    ${MINE.added.length?`<ul class="plain">${MINE.added.map((t,i)=>`<li>${esc(t)} <button type="button" class="btn ghost" data-rm="${i}">Remove</button></li>`).join("")}</ul>`:""}`:""}
  </section>

  <section class="panel" aria-labelledby="h3"><div class="eyebrow">3 · Results ${PLANNED}</div><h2 id="h3">Where people agree</h2>
    <p>No votes are counted yet, so there are no results. When verified voting starts, each part would be labeled common ground, divides groups, or still forming, using the <a href="how.html#ground" style="color:var(--koa)">published rules</a>. Results will describe the verified voters who took part, with their share of registered voters. They won't describe the whole district.</p>
    ${chosen?`<p class="meta">Your practice, in this browser only: you agreed with ${agreed} of the ${keys.length} ${it.parts.length?"parts":"choices"} you could vote on.</p>`:""}
    <p class="meta"><a href="item.html?id=sample-civic-channel" style="color:var(--koa)">See a sample issue with results, delivery, and an office response</a> (everything there is marked Sample).</p>
  </section>

  <section class="panel" aria-labelledby="h4"><div class="eyebrow">4 · Delivery ${YOURS} ${PLANNED}</div><h2 id="h4">What you sent</h2>
    ${sent.length?`<ul class="sentlist">${sent.map(s=>`<li><div><b>${esc(s.office.name)}</b>${s.office.holder?` <span class="meta">(${esc(s.office.holder)} at the time)</span>`:""} ${YOURS}</div>
        <div class="meta">${s.issue.version?"Saved with the summary version you saw":"Summary version not recorded (saved from the Issues list)"} · ${s.sentOn?"You said you sent it on "+fmt(s.sentOn):"No date given"} · ${esc(s.channel==="email"?"by email":s.channel==="contact-form"?"through the office's contact form":s.channel==="official-comment"?"as an official comment":s.channel==="meeting-comment"?"as a meeting comment":s.channel)}</div>
        ${s.message?`<details><summary class="meta">What you sent</summary><p class="msg">${esc(s.message)}</p></details>`:""}
        <div class="acts"><button type="button" class="btn ghost" data-copyrec="${esc(s.id)}">Copy as text</button><button type="button" class="btn ghost" data-delrec="${esc(s.id)}">Delete this record</button><span class="toast" id="cr-${esc(s.id)}" role="status" aria-live="polite"></span></div></li>`).join("")}</ul>
      <p class="meta">These records are reported by you. Civic Accord didn't deliver them and can't confirm they were received. They're kept only in this browser: they don't sync to your other devices, and clearing this browser's data deletes them. <a href="following.html#records" style="color:var(--koa)">Export a copy</a>.</p>`
      :`<p>No records yet. After you write to an office or comment officially, you can keep a record here of exactly what you sent. It stays in this browser.</p>`}
    <p class="meta">${PLANNED} Once verified voting exists, the ${it.kind==="Proposed rule"?"agency":local?esc(J.name):"office that represents you"} would receive a package with the exact request, which parts have common ground and which divide people, and how many verified voters took part, with the date it was delivered.</p>
  </section>

  <section class="panel" aria-labelledby="h5"><div class="eyebrow">5 · Follow-through ${LIVE}</div><h2 id="follow-through" tabindex="-1">What happened next</h2>
    <h3>Official developments ${LIVE}</h3>
    ${it.actions&&it.actions.length?`<ol class="timeline">${it.actions.map(a=>`<li><b>${a.date?fmt(a.date):"Date not given"}</b><span>${esc(a.text)}${a.by?` <span class="meta">· ${esc(a.by)}</span>`:""}</span></li>`).join("")}</ol>`:`<p class="meta">${local?"The meeting date is the official record so far. Read the agenda and minutes for what happened.":"No official actions are listed by the source yet."}</p>`}
    <p class="meta">From ${esc(it.actionsBy||(it.source&&it.source.label)||"the official source")}, fetched ${esc(when(FETCHED))}. These are steps in the official record. They aren't responses to anyone's request, and Civic Accord doesn't say any request caused them.</p>
    <h3>Responses to your request ${PLANNED}</h3>
    <p>None recorded. Offices haven't joined Civic Accord yet, so they can't respond here. When they can, an office's response will appear here with its reason, kept apart from what it commits to do and what the record shows it did. No response never means the office opposes anything.</p>
  </section>`;
  bind(it,keys,parts,version,orphans);
}

function tellHTML(it,own,r){
  if(!own&&it.level==="state")return `<p class="meta">Messages are for your own state's legislators. ${DIST?"":`<a href="governments.html?from=${encodeURIComponent(ID)}" style="color:var(--koa)">Enter your address on My representatives</a> to find them.`}</p>`;
  if(!DIST)return `<p>To write to the people who represent you, first <a href="governments.html?from=${encodeURIComponent(ID)}" style="color:var(--koa)">enter your address on My representatives</a>. Only your districts are kept, in this browser.</p>`;
  const reps=CA_TELL.recipients(it,DIST,FED,STATELEG), loading=(it.level==="federal"&&!FED)||(it.level==="state"&&!STATELEG);
  return `<div class="go" role="group" aria-label="Where you stand (kept in this browser)">${["Support","Oppose","Unsure"].map(x=>`<button type="button" data-r="${x}" aria-pressed="${r===x}">${x}</button>`).join("")}</div>
    ${TELL?`<div class="compose">
      <label for="cm" class="meta">Add your own words (optional)</label><textarea id="cm" rows="3" maxlength="1200" placeholder="Why it matters to you, in a sentence or two.">${esc(COMMENT)}</textarea>
      <div class="two"><div><label for="sn" class="meta">Your name</label><input id="sn" autocomplete="name" value="${esc(SIGNER.name)}"></div><div><label for="stw" class="meta">Your town (optional)</label><input id="stw" autocomplete="address-level2" value="${esc(SIGNER.town)}"></div></div>
      ${loading?`<p class="meta">Finding your representatives…</p>`:reps.length?reps.map((p,i)=>`<div class="rep"><b>${esc(p.title)}</b><span class="meta">${esc(p.name)}</span><div class="acts">
        ${p.email?`<a class="btn" href="#" data-mail="${i}" style="text-decoration:none">Email ${esc(p.sal)}</a>`:""}
        ${!p.email&&safe(p.url)?`<button type="button" class="btn" data-copy="${i}">Copy message</button><a href="${esc(p.url)}" target="_blank" rel="noopener" data-form="${i}">Open contact form</a>`:""}
        <span class="toast" id="rm-${i}" aria-live="polite"></span></div></div>`).join(""):`<p class="meta">We couldn't find contact details for these offices yet.</p>`}
      <p class="meta">Email opens in your own email app, so it comes from you. Your message isn't sent to Civic Accord. It stays on this page until you copy it or open it in your email app or an office's form, which sends it from you. Civic Accord saves your name and town in this browser for next time, and a copy of the message only if you choose to keep a record.</p>
      ${PENDING.length&&!RECORDING?`<div class="go" role="group" aria-label="Did you send it?"><span>Did you send it?</span><button type="button" class="btn" id="didsend">Yes, keep a record</button></div>`:""}
    </div>`:`<div class="go"><button type="button" class="btn" id="opentell">Write to your representatives</button></div>`}`}

function manualOffice(it){const J=it.jurisdiction||{};
  return it.kind==="Proposed rule"?{officeId:CA_OFFICES.agency(J.name||"agency"),name:J.name||"The agency",title:J.name||"The agency",channel:"official-comment",text:""}
    :it.level==="local"?{officeId:it.office&&it.office.id||null,name:J.name,title:J.name,channel:"meeting-comment",text:""}:null}

function bind(it,keys,parts,version,orphans){
  // After the page is redrawn, focus goes back to the control that was used (or to a named field), so keyboard and
  // screen-reader users don't land at the top of the page.
  const rerender=(focus)=>{const y=window.scrollY,back=focusKey();render(it);window.scrollTo({top:y});const f=(focus&&$(focus))||(back&&document.querySelector(back));if(f)f.focus({preventScroll:true})};
  $("follow").onclick=()=>{
    if(CA_RECORDS.isFollowing(ID)){CA_RECORDS.unfollow(ID);SINCE=null;rerender("follow");$("follow-msg").textContent="Stopped following. Nothing about this issue is kept for Following now.";return}
    if(!CA_RECORDS.available()){$("follow-msg").textContent="This browser isn't saving data (it may be a private window), so Follow can't be kept.";return}
    CA_RECORDS.follow({id:ID,title:it.title,kind:it.kind,level:it.level},CA_ISSUE.snapshot(it,FETCHED));rerender("follow");
    $("follow-msg").textContent="Following, in this browser only. Changes are checked when you open this page or Following, not in the background."};
  $("share").onclick=async()=>{const url=location.origin+"/item.html?id="+encodeURIComponent(ID);
    const text=CA_ISSUE.shareText(it,FETCHED,CA_ISSUE.stageOf(it,new Date()),url),m=$("follow-msg");
    try{if(navigator.share){await navigator.share({title:it.title,text});m.textContent="Shared. The link and text include only public facts, not your views.";return}}catch(e){if(e&&e.name==="AbortError")return}
    try{await navigator.clipboard.writeText(text);m.textContent="Copied. The link and text include only public facts, not your views."}catch(e){m.textContent="Copy this link: "+url}};
  document.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{REACT[ID]=REACT[ID]===b.dataset.r?undefined:b.dataset.r;try{localStorage.setItem(REKEY,JSON.stringify(REACT))}catch(e){}rerender()});
  const ot=$("opentell");if(ot)ot.onclick=()=>{TELL=true;loadReps(it);rerender("cm")};
  const sn=$("sn"),stw=$("stw"),cm=$("cm");
  const keepS=()=>{SIGNER={name:sn.value.trim(),town:stw.value.trim()};try{localStorage.setItem(SKEY,JSON.stringify(SIGNER))}catch(e){}};
  if(sn){sn.oninput=keepS;stw.oninput=keepS}if(cm)cm.oninput=()=>{COMMENT=cm.value};
  const reps=TELL&&DIST?CA_TELL.recipients(it,DIST,FED,STATELEG):[];
  const msg=p=>CA_TELL.message(it,p.sal,{stance:REACT[ID],comment:COMMENT,signer:SIGNER,dist:DIST});
  const pend=(p,channel,m)=>{const x={officeId:p.officeId,name:p.name,title:p.title,channel,text:`Subject: ${m.subject}\n\n${m.body}`};const i=PENDING.findIndex(y=>y.officeId===p.officeId&&y.name===p.name);if(i>=0)PENDING[i]=x;else PENDING.push(x)};
  document.querySelectorAll("[data-mail]").forEach(a=>a.onclick=async e=>{e.preventDefault();keepS();const p=reps[+a.dataset.mail],m=msg(p),el=$("rm-"+a.dataset.mail);
    const {url,shown}=await CA_TELL.mailUrl(p.email,m,el);
    pend(p,"email",m);window.__openMail?window.__openMail(url):(location.href=url);if(!shown){setTimeout(()=>rerender("didsend"),1200);el.textContent="Opening your email app…"}});
  document.querySelectorAll("[data-form]").forEach(a=>a.addEventListener("click",()=>{const p=reps[+a.dataset.form];pend(p,"contact-form",msg(p));setTimeout(()=>rerender(),1200)}));
  document.querySelectorAll("[data-copy]").forEach(b=>b.onclick=()=>{keepS();const i=+b.dataset.copy,p=reps[i],m=msg(p);pend(p,"contact-form",m);const txt=`Subject: ${m.subject}\n\n${m.body}`,t=$("rm-"+i);
    const noName=/\[Your name\]/.test(txt)?" It ends with [Your name]: add your name above first, or replace it after pasting.":"";
    CA_TELL.copy(txt).then(ok=>CA_TELL.showText(t,txt,(ok?"Copied. This is the message; now open the contact form and paste it.":"Couldn't copy automatically. Select the message below and copy it.")+noName))});
  const ds=$("didsend");if(ds)ds.onclick=()=>{RECORDING=true;rerender();const f=document.querySelector("#rec textarea");if(f)f.focus()};
  const rm=$("rec-manual");if(rm)rm.onclick=()=>{RECORDING=true;rerender();const f=document.querySelector("#rec textarea");if(f)f.focus()};
  if(RECORDING)CA_TELL.bindPanel("rec",{id:ID,title:it.title,version},PENDING,manualOffice(it),n=>{RECORDING=false;if(n)PENDING=[];rerender("h4")});
  document.querySelectorAll("[data-delrec]").forEach(b=>b.onclick=()=>{if(!confirm("Delete this record from this browser? This can't be undone unless you have an exported copy."))return;CA_RECORDS.removeSent(b.dataset.delrec);rerender("h4")});
  document.querySelectorAll("[data-copyrec]").forEach(b=>b.onclick=async()=>{const s=CA_RECORDS.sentFor(ID).find(x=>x.id===b.dataset.copyrec),t=$("cr-"+b.dataset.copyrec);if(!s)return;
    if(!confirm("This copies your message and who you sent it to. Share it only if you want others to see it."))return;
    const txt=`${it.title}\nSent to: ${s.office.name}${s.office.holder?" ("+s.office.holder+")":""}\n${s.sentOn?"Sent on "+s.sentOn:""} (reported by me; not confirmed by Civic Accord)\n\n${s.message}`;
    try{await navigator.clipboard.writeText(txt);t.textContent="Copied."}catch(e){t.textContent="Couldn't copy."}});
  const TXT={};parts.forEach((p,i)=>TXT[keys[i]]=(p.lead?p.lead+" ":"")+p.text);
  document.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{const k=b.dataset.k,v=b.dataset.v;if(MINE.parts[k]&&MINE.parts[k].v===v)delete MINE.parts[k];else MINE.parts[k]={v,text:TXT[k]||""};save();
    b.parentElement.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(!!MINE.parts[k]&&MINE.parts[k].v===x.dataset.v)));
    const n=keys.filter(k=>MINE.parts[k]).length;$("saved").textContent=`Practice votes saved in this browser: ${n} of ${keys.length}. Not counted. Not sent to anyone.`});
  const co=$("clearold");if(co)co.onclick=()=>{orphans.forEach(k=>delete MINE.parts[k]);MINE.version=version;save();render(it);
    const h=$("h2");if(h){h.setAttribute("tabindex","-1");h.focus()}const sv=$("saved");if(sv){sv.setAttribute("role","status");sv.textContent="Earlier votes cleared. "+sv.textContent}};
  const af=$("addf");if(af)af.onsubmit=e=>{e.preventDefault();const t=$("addt").value.trim();if(t.length<10){$("addmsg").textContent="Write at least a short sentence.";return}
    MINE.added.push(t);save();render(it);$("addt").focus();$("addmsg").textContent="Added in this browser. Not shared with anyone."};
  document.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{MINE.added.splice(+b.dataset.rm,1);save();render(it);const t=$("addt");if(t)t.focus();$("addmsg").textContent="Removed."});
}

async function loadReps(it){
  if(!DIST||(FED&&STATELEG))return;
  try{FED=await CA_REG.officeholders(DIST)}catch(e){FED={}}
  try{STATELEG=await CA_REG.stateLegislators(DIST)}catch(e){STATELEG={legislators:[],errors:["Couldn't reach the legislator lookup."]}}
  const y=window.scrollY,back=focusKey();render(it);window.scrollTo({top:y});const f=back&&document.querySelector(back);if(f)f.focus({preventScroll:true});
}
// A selector that finds the focused control again after a redraw: its id, or its data attribute.
function focusKey(){const a=document.activeElement;if(!a||a===document.body)return null;if(a.id)return "#"+CSS.escape(a.id);
  const d=a.dataset&&Object.entries(a.dataset)[0];return d?`[data-${d[0].replace(/[A-Z]/g,c=>"-"+c.toLowerCase())}="${CSS.escape(d[1])}"]`:null}

(async()=>{
  if(!ID){$("title").textContent="Pick an issue";$("main").innerHTML=`<p>Choose any bill, proposed rule, or meeting from <a href="open.html" style="color:var(--koa)">Issues</a>.</p>`;return}
  if(ID.startsWith("sample-")){if(window.CA_SAMPLE)return CA_SAMPLE.render(ID);return}
  let d=null;try{d=await (await fetch("/api/item?id="+encodeURIComponent(ID))).json()}catch(e){}
  if(!d||!d.item){$("title").textContent="Couldn't load this issue";
    const f=CA_RECORDS.follows().find(x=>x.issue.id===ID);
    $("main").innerHTML=`<p>${esc(d&&d.errors&&d.errors[0]||"Couldn't reach the official source. Check your connection and try again.")}</p>${f?`<p class="meta">You follow this issue. Nothing was compared this time, and what you last saw is kept.</p>`:""}<p><a href="open.html" style="color:var(--koa)">Back to Issues</a></p>`;return}
  IT=d.item;FETCHED=d.fetchedAt;
  // If you follow this issue, compare what you last saw with the latest official data, then mark it as seen.
  const f=CA_RECORDS.follows().find(x=>x.issue.id===ID);
  if(f&&f.baseline){const c=CA_ISSUE.compare(f.baseline,IT,FETCHED,new Date());SINCE={base:f.baseline,c};
    if(c.result==="changed"||c.result==="no-change")CA_RECORDS.setBaseline(ID,CA_ISSUE.snapshot(IT,FETCHED),IT.title)}
  render(IT);
  $("src").innerHTML=`From <a href="${esc(safe(IT.source.url)||"#")}" target="_blank" rel="noopener" style="color:inherit">${esc(IT.source.label)}</a> · fetched ${esc(when(FETCHED))}`;
})();
