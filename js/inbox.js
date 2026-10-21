const words=n=>n.toLocaleString();
const money=v=>{if(v<=0)return "$0";const t=(x,d)=>x.toFixed(d).replace(/\.0+$/,"");return v>=1e9?`$${t(v/1e9,2)}B`:v>=1e6?`$${t(v/1e6,v>=1e8?0:v>=1e7?1:2)}M`:v>=1000?`$${Math.round(v/1000)}K`:`$${Math.round(v).toLocaleString("en-US")}`};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let OFFICES=[];
let PK={}, office=null, open=null;
const SKEY="civicaccord-office";
const load=()=>{try{const v=JSON.parse(localStorage.getItem(SKEY)||"{}");return {responses:v.responses||{},updates:v.updates||{},requests:v.requests||{},history:v.history||{}}}catch(e){return {responses:{},updates:{},requests:{},history:{}}}};
// Responses are append-only on the public record: a new response supersedes the earlier one, which stays in history.
const DB=load(); const responses=DB.responses, history=DB.history; const rk=id=>office+"|"+id;
const persist=()=>{try{localStorage.setItem(SKEY,JSON.stringify(DB))}catch(e){}};
const TODAY=(()=>{const q=new URLSearchParams(location.search).get("today");const d=q&&/^\d{4}-\d{2}-\d{2}$/.test(q)?new Date(q+"T12:00:00"):new Date();d.setHours(12,0,0,0);return d})();
const fmt=d=>d.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
const today=()=>fmt(TODAY);
const day=s=>new Date(s+"T12:00:00");
function quiet(o,j){
  const r=o.preElection;
  if(!r||r.basis==="none") return {paused:false,none:true,rule:r};
  if(r.onlyIfCandidate&&!o.onBallot) return {paused:false,notCandidate:true,rule:r};
  if(r.window.type==="range"){const a=day(r.window.from),b=day(r.window.to);
    if(TODAY>=a&&TODAY<=b){const re=new Date(b);re.setDate(re.getDate()+1);return {paused:true,rule:r,reopens:re}}
    return {paused:false,rule:r,nextStart:a>TODAY?a:null}}
  const days=r.window.days, els=(j.elections||[]).map(e=>({...e,d:day(e.date)})).sort((a,b)=>a.d-b.d);
  for(const e of els){const start=new Date(e.d);start.setDate(start.getDate()-days);
    if(TODAY>=start&&TODAY<=e.d){let end=e.d;for(const f of els){const fs=new Date(f.d);fs.setDate(fs.getDate()-days);if(f.d>end&&fs<=end)end=f.d}
      const re=new Date(end);re.setDate(re.getDate()+1);return {paused:true,rule:r,days,election:e,start,reopens:re}}}
  const next=els.find(e=>e.d>TODAY);let nextStart=null;if(next){nextStart=new Date(next.d);nextStart.setDate(nextStart.getDate()-days)}
  return {paused:false,rule:r,days,next,nextStart};
}
const packsFor=key=>Object.keys(PK).filter(k=>(PK[k].jurisdiction.offices||[]).some(o=>o.key===key));
const officeJ=()=>{const k=packsFor(office)[0];return k?PK[k].jurisdiction:null};
const office$=()=>OFFICES.find(o=>o.key===office);
const sign=r=>`Office of the ${office$().title}, ${office$().where}${r.approver?" · approved by "+r.approver:""}`;
const pct=g=>{const n=g[0]+g[1]+g[2];return n?Math.floor(g[0]*100/n):0};
function analyze(d){
  // Same rule as the deliberation page (consensusLabel).
  const st=d.issue.statements.map(s=>{const pa=pct(s.a),pb=pct(s.b),pp=s.panel?pct(s.panel):null,n=s.a.concat(s.b).reduce((x,y)=>x+y,0);const kind=consensusLabel([s.a,s.b]);return {...s,pa,pb,pp,kind,n}});
  const opt={};d.issue.costOptions.forEach(c=>opt[c.statement]=c);
  let yearly=0,once=0;st.filter(s=>s.kind==="common"&&opt[s.id]).forEach(s=>{const c=opt[s.id];const v=c.unitCost*c.default;c.recurring?yearly+=v:once+=v});
  // Costs here use each common-ground option at its default amount; a resident's own Step 4 choices on the sample page can differ.
  return {st,opt,yearly,once,votes:st.reduce((x,s)=>x+s.n,0)};
}
function renderOffices(){
  const b=document.getElementById("offices");b.innerHTML="";
  OFFICES.forEach(o=>{const e=document.createElement("button");e.className="issue";e.setAttribute("aria-pressed",o.key===office);e.innerHTML=`${esc(o.title)}<small>${esc(o.where)}</small>`;e.onclick=()=>{office=o.key;open=null;render()};b.appendChild(e)});
}
function renderSeat(){
  const o=office$(), j=officeJ(), el=document.getElementById("seat"); if(!j){el.innerHTML="";return}
  const q=quiet(o,j), reqs=DB.requests[office]||[], ru=o.preElection;
  const pending=packsFor(office).filter(k=>!responses[rk(PK[k].id)]).length;
  const cites=ru&&ru.citations?ru.citations.map(c=>`<a href="${esc(c.url)}" target="_blank" rel="noopener" style="color:var(--koa)">${esc(c.label)}</a>`).join(" · "):"";
  const basis={law:"Law","chamber rule":"Chamber rule",none:"No rule in law"}[ru?ru.basis:"none"]||"Rule";
  el.innerHTML=`<div class="seat"><span class="eyebrow">The seat</span><h2>${esc(o.title)}, ${esc(o.where)}</h2>
      <span class="holder">${esc(o.holder)} · ${esc(o.term)} · ${pending} package${pending===1?"":"s"} awaiting a response · ${Object.keys(responses).filter(k=>k.startsWith(office+"|")).length} answered</span></div>
    <h3>Rules this office follows</h3>
    <p class="meta">Every rule the tool applies comes from this government's own law or chamber rules, with the source. Where no law applies, the tool adds none of its own.</p>
    <div class="record"><div class="recrow${ru&&ru.verified?"":" silent"}"><b>Before elections · ${esc(basis)}</b><span>${esc(ru?ru.summary:"Not yet researched.")}</span>
      ${ru&&ru.note?`<span class="meta">${esc(ru.note)}</span>`:""}
      <span class="meta">${ru&&ru.verified?"✓ Checked against the source":"! Not yet confirmed by a reviewer"}${cites?" · "+cites:""}</span></div>
      ${j.legalReview?`<div class="recrow${j.legalReview.status==="done"?"":" silent"}"><b>Legal review · ${j.legalReview.layer==="core"?"core (applies everywhere)":esc(j.name)}</b>
        <span>${j.legalReview.reviewer?`Reviewed by ${esc(j.legalReview.reviewer)}${j.legalReview.date?" on "+esc(j.legalReview.date):""}`:"Reviewer not yet assigned. Suggested: "+esc(j.legalReview.suggested)}</span>
        <span class="meta">Covers: ${j.legalReview.scope.map(esc).join("; ")}. ${esc(j.legalReview.cadence)}.</span></div>`:""}</div>
    <h3>Ask your district to weigh in</h3>
    <p class="meta">The office can ask constituents to deliberate on a pending bill or a trade-off it faces. In the live version, a neutral host would review every request for sourced facts, neutral wording, and cost methods before it opens, and the request itself is public.</p>
    ${q.paused?`<div class="paused" id="quiet"><b>Requests are paused ${q.election?`for the ${esc(q.election.name.toLowerCase())} on ${fmt(q.election.d)}`:`from ${esc(q.rule.window.fromLabel)} until ${esc(q.rule.window.toLabel)}`}.</b>
        <span>This office's ${esc(basis.toLowerCase())} limits official mass communications ${q.election?`in the ${q.days} days before an election${q.rule.onlyIfCandidate?" in which the officeholder is a candidate":""}`:"in this period"}, so the tool applies the same limit to new requests. Requests reopen ${fmt(q.reopens)}.</span>
        <span class="meta">Residents can still deliberate, and the office can still answer packages and report what happened to them.${q.election?` Election dates: <a href="${esc(j.electionsSource?j.electionsSource.url:"#")}" target="_blank" rel="noopener" style="color:var(--koa)">${esc(j.electionsSource?j.electionsSource.label:"election office")}</a>.`:""}</span></div>`
    :`<form id="request" class="choices">
      <div class="grid2"><div><label for="rq-bill" class="meta">Bill or topic</label><input type="text" id="rq-bill" maxlength="120" placeholder="HB 1234, or a budget choice"></div>
      <div><label for="rq-by" class="meta">Approver's role</label><input type="text" id="rq-by" maxlength="80" placeholder="Chief of staff"></div></div>
      <label for="rq-q" class="meta">The question for constituents</label>
      <textarea id="rq-q" rows="2" maxlength="400" placeholder="Should the bill fund more inspectors or more rapid-response crews?"></textarea>
      ${q.none?`<p class="meta">No law limits this office's communications before elections, so requests stay open year-round.</p>`:q.notCandidate?`<p class="meta">The pre-election limit applies only when the officeholder is a candidate, and this one isn't on the ballot.</p>`:q.nextStart?`<p class="meta">Requests pause on ${fmt(q.nextStart)}${q.next?`, ${q.days} days before the ${esc(q.next.name.toLowerCase())}`:""}.</p>`:`<p class="meta">The next election dates haven't been added for this office yet. A reviewer adds them each cycle.</p>`}
      <span class="toast" id="rqmsg" aria-live="polite"></span>
      <button class="btn" type="submit">Send request to the host</button></form>`}
    <h3>Public request record</h3>
    <div class="record">${reqs.length?reqs.map(r=>`<div class="recrow"><b>${esc(r.bill)}</b><span>${esc(r.q)}</span><span class="meta">${esc(r.date)} · ${esc(sign(r))} · Sample request (no host yet)</span></div>`).join(""):`<div class="recrow silent"><span class="meta">No requests from this office yet</span></div>`}</div>`;
  const f=document.getElementById("request");
  if(f) f.onsubmit=e=>{e.preventDefault();const bill=document.getElementById("rq-bill").value.trim(),qq=document.getElementById("rq-q").value.trim(),by=document.getElementById("rq-by").value.trim();
    if(!bill||qq.length<15||!by){document.getElementById("rqmsg").textContent="Add the bill or topic, a question of at least 15 characters, and the approver's role.";return}
    (DB.requests[office]=DB.requests[office]||[]).unshift({bill,q:qq,approver:by,date:today()});persist();render()};
}
function renderList(){
  const o=OFFICES.find(x=>x.key===office);
  const cards=packsFor(o.key).map(k=>{const d=PK[k],a=analyze(d),r=responses[rk(d.id)];
    return `<button class="pkgcard" data-k="${k}" aria-pressed="${open===k}">
      <span class="eyebrow">${esc(d.jurisdiction.name)}</span>
      <h3>${esc(d.issue.name)}</h3>
      <span class="meta">${d.issue.participation?d.issue.participation.open.count+" verified constituents and "+d.issue.participation.panel.count+" panelists":"Verified constituents"} · ${words(a.votes)} votes · ${a.st.filter(s=>s.kind==="common").length} points of common ground · about ${money(a.yearly)} a year</span>
      <span class="tag ${r?"common":"forming"}">${r?"Responded: "+esc(r.label):"Awaiting your response"}</span>
    </button>`}).join("");
  document.getElementById("list").innerHTML=`<div><div class="eyebrow">Packages from your district</div><h2>Packages for this seat</h2></div>
    ${cards}
    <div class="pkgcard empty"><span>Other deliberations in your district arrive here as residents complete them.</span></div>`;
  document.querySelectorAll(".pkgcard[data-k]").forEach(c=>c.onclick=()=>{open=c.dataset.k;render();document.getElementById("detail").scrollIntoView({behavior:"smooth"})});
}
function bar(v){return `<span class="mini"><span class="track"><span class="fill" style="display:block;width:${v}%"></span></span><span>${v}%</span></span>`}
function renderDetail(){
  const m=document.getElementById("detail");
  if(!open||!PK[open]){m.innerHTML="";return}
  const d=PK[open],a=analyze(d),j=d.jurisdiction,r=responses[rk(d.id)];
  const common=a.st.filter(s=>s.kind==="common"),split=a.st.filter(s=>s.kind==="split");
  const per=x=>{const v=x/j.residents;return v<10?`$${v.toFixed(2)}`:`$${Math.round(v)}`};
  const costOf=s=>{const c=a.opt[s.id];return c?`${money(c.unitCost*c.default)}${c.recurring?" a year":" one time"}`:(d.issue.revenue.find(x=>x.statement===s.id)?"brings in revenue":"no cost estimate")};
  const pt=d.issue.participation, dims=pt&&pt.makeup?pt.makeup.dimensions:[];
  const skew=dims.some(dm=>dm.rows.some(r=>Math.abs(r[1]-r[3])>=8));
  const pn=pt?pt.panel.count:0;
  m.innerHTML=`<section class="panel">
    <div><div class="eyebrow">Package · ${esc(j.name)}</div><h2>${esc(d.issue.title)}</h2></div>
    <div class="stat">
      <div><strong>${pt?pt.open.count:0}</strong><span>verified voters</span></div>
      ${pt?`<div><strong>${pn}</strong><span>citizen panelists</span></div>`:""}
      <div><strong>${words(a.votes)}</strong><span>votes</span></div>
      <div><strong>${money(a.yearly)}</strong><span>yearly cost of common ground</span></div>
      <div><strong>${per(a.yearly)}</strong><span>per ${esc(j.residentLabel)} a year (common-ground options at default amounts)</span></div>
    </div>
    <p class="meta">${!pt?"":j.registeredVoters?`<b>${pt.open.count} verified voters took part, ${shareText(pt.open.count,j.registeredVoters)} of ${j.registeredVoters.toLocaleString("en-US")} ${esc(j.registeredVotersLabel||"registered voters")}</b>${j.registeredVotersSource&&httpsOnly(j.registeredVotersSource.url)?` (<a href="${esc(j.registeredVotersSource.url)}" target="_blank" rel="noopener" style="color:var(--koa)">${esc(j.registeredVotersSource.label||"source")}</a>)`:""}. Common ground means agreement among those who took part, not everyone you represent. The citizen panel is the check on whether it reflects the district.`:"This package doesn't list the number of registered voters yet, so the share who took part isn't shown."}</p>
    <h3>Who took part</h3>
    <p class="meta">Open participants and the randomly selected citizen panel, compared with the district's adult population.${pt&&pt.example?" Example figures.":""}</p>
    <div class="cmp" style="grid-template-columns:minmax(70px,100px) repeat(3,minmax(0,1fr))"><span></span>${pt?pt.makeup.columns.map(c=>`<span class="h">${esc(c)}</span>`).join(""):""}
      ${dims.map(dm=>`<span class="h">${esc(dm.name)}</span><span></span><span></span><span></span>${dm.rows.map(r=>`<span>${esc(r[0])}</span>${bar(r[1])}${bar(r[2])}${bar(r[3])}`).join("")}`).join("")}
    </div>
    ${skew?`<p class="flag">Open participants don't match the district on every measure. The citizen panel does, so where the two agree, the common ground is more likely to reflect your constituents.</p>`:""}
    <h3>Common ground (${common.length})</h3>
    <ul class="plain">${common.map(s=>`<li>${esc(s.text)} <span class="meta">Group A ${s.pa}%, Group B ${s.pb}%${s.pp!==null?`, citizen panel ${s.pp}%`:""} · ${costOf(s)}</span></li>`).join("")}</ul>
    ${a.st.filter(s=>s.kind!=="common"&&s.pp!==null&&s.pp>=70).length?`<h3>Panel found more agreement</h3><ul class="plain">${a.st.filter(s=>s.kind!=="common"&&s.pp>=70).map(s=>`<li>${esc(s.text)} <span class="meta">Citizen panel ${s.pp}%, open groups ${s.pa}% and ${s.pb}% · ${costOf(s)}</span></li>`).join("")}</ul>`:""}
    <h3>Where constituents split (${split.length})</h3>
    <ul class="plain">${split.map(s=>`<li>${esc(s.text)} <span class="meta">Group A ${s.pa}%, Group B ${s.pb}%${s.pp!==null?`, citizen panel ${s.pp}%`:""} · ${costOf(s)}</span></li>`).join("")||"<li>No sharp splits.</li>"}</ul>
    <p class="meta">Every figure links back to the public vote record in the live tool. ${d.bill&&d.bill.kind==="policy"?"The starting office policy":"Starting bill text"} and cost methods come with the package.</p>
    <h3>The office's public response</h3>
    ${(history[rk(d.id)]||[]).length?`<details><summary class="meta" style="cursor:pointer;padding:8px 0">${(history[rk(d.id)]).length} earlier response${(history[rk(d.id)]).length===1?"":"s"}, kept on the record</summary><ul class="plain">${history[rk(d.id)].map(h=>`<li class="meta"><b>${esc(h.label)}</b> · ${esc(h.date)} · ${esc(h.reason)} (superseded)</li>`).join("")}</ul></details>`:""}
    ${r?`<div class="submitbox"><h3>✓ Response recorded publicly</h3><p><b>${esc(r.label)}</b> · ${esc(r.date)}</p><p>${esc(r.reason)}</p>${r.changes?`<p><b>Changes the office needs:</b> ${esc(r.changes)}</p><p class="meta">Residents are invited to weigh in on the revised version before the office ${d.bill&&d.bill.kind==="policy"?"adopts":"introduces"} it.</p>`:""}<p class="meta">${esc(sign(r))}. In the live version, residents who took part would be notified and see this on the public record.</p><button class="btn ghost" id="change">Add a new response (the earlier one stays on the record)</button></div>`:`
    <p class="meta">Residents see the office's response, or "no response yet" after 30 days. A reason is required for every choice.</p>
    <form id="respond" class="choices">
      ${(d.bill&&d.bill.kind==="policy"?[["adopt","Our office will adopt this policy"],["amend","Our office will adopt it with changes"],["info","We need more information"],["decline","We decline"]]:[["introduce","Our office will introduce a bill"],["cosponsor","Our office will support or co-sponsor an existing bill"],["amend","Our office will introduce it with changes"],["info","We need more information"],["decline","We decline"]]).map(([v,l],i)=>`<label class="choice"><input type="radio" name="resp" value="${v}" ${i===0?"checked":""}><span>${l}</span></label>`).join("")}
      <div id="changesbox" hidden><label for="changes" class="meta">What would need to change? Residents deliberate on the revised version.</label>
      <textarea id="changes" rows="2" maxlength="600" placeholder="${d.bill&&d.bill.kind==="policy"?"For example: start with one pilot topic and add more after six months.":"For example: phase in the inspectors over two years and drop the visitor fee."}"></textarea></div>
      <label for="reason" class="meta">The office's reason, shown publicly</label>
      <textarea id="reason" rows="3" maxlength="600" placeholder="${d.bill&&d.bill.kind==="policy"?"For example: we'll adopt the common-ground practices and report back in six months.":"For example: I'll introduce the common-ground items and hold a hearing on the visitor fee."}"></textarea>
      <label for="approver" class="meta">Approver's role</label>
      <input type="text" id="approver" maxlength="80" placeholder="The representative, or chief of staff">
      <span class="toast" id="rmsg" aria-live="polite"></span>
      <button class="btn" type="submit">Record the office's response</button>
    </form>`}
    <h3>What happened next</h3>
    <p class="meta">Report each step so residents can follow their proposal. When the office votes, explain the vote, especially where it differs from the district's common ground.</p>
    <ol class="timeline">
      <li><b>Package received</b><span class="meta">From ${pt?pt.open.count:0} verified voters and ${pn} panelists</span></li>
      ${r?`<li><b>${esc(r.label)}</b><span class="meta">${esc(r.date)} · ${esc(r.reason)}</span></li>`:`<li class="wait"><b>No response yet</b><span class="meta">Shown publicly after 30 days</span></li>`}
      ${(DB.updates[rk(d.id)]||[]).map(u=>`<li><b>${esc(u.stage)}${u.bill?" · "+esc(u.bill):""}</b><span class="meta">${esc(u.date)} · ${esc(u.note)} · approved by ${esc(u.approver)}</span></li>`).join("")}
    </ol>
    ${r?`<form id="update" class="choices">
      <div class="grid2"><div><label for="up-stage" class="meta">Step</label><select id="up-stage">${(d.bill&&d.bill.kind==="policy"?["Adopted","Started a pilot","Changed the policy","Reported results","Paused","Stopped"]:["Introduced","Hearing scheduled","Heard in committee","Amended","Passed a chamber","The office voted","Enacted","Stalled"]).map(x=>`<option>${x}</option>`).join("")}</select></div>
      <div><label for="up-bill" class="meta">${d.bill&&d.bill.kind==="policy"?"Reference (optional)":"Bill number (optional)"}</label><input type="text" id="up-bill" maxlength="40"></div></div>
      <label for="up-note" class="meta">What happened, and why (for a vote, the office's reasoning)</label>
      <textarea id="up-note" rows="2" maxlength="600"></textarea>
      <label for="up-by" class="meta">Approver's role</label><input type="text" id="up-by" maxlength="80">
      <span class="toast" id="upmsg" aria-live="polite"></span>
      <button class="btn ghost" type="submit">Add to the public record</button></form>`:""}
  </section>`;
  const f=document.getElementById("respond");
  if(f) f.onsubmit=e=>{e.preventDefault();const reason=document.getElementById("reason").value.trim();
    if(reason.length<10){document.getElementById("rmsg").textContent="Add a short reason. Residents see it with your response.";return}
    const v=f.querySelector("input[name=resp]:checked");const label=v.parentElement.textContent.trim();
    const approver=document.getElementById("approver").value.trim(), changes=v.value==="amend"?document.getElementById("changes").value.trim():"";
    if(!approver){document.getElementById("rmsg").textContent="Add the approver's role. It's signed by the office and shows the role, not a name.";return}
    if(v.value==="amend"&&changes.length<10){document.getElementById("rmsg").textContent="Describe the changes the office needs.";return}
    responses[rk(d.id)]={office:office$().title+", "+office$().where,value:v.value,label,reason,changes,approver,date:today()};persist();render()};
  if(f) f.onchange=()=>{document.getElementById("changesbox").hidden=f.querySelector("input[name=resp]:checked").value!=="amend"};
  const c=document.getElementById("change");if(c)c.onclick=()=>{const old=responses[rk(d.id)];if(old){(history[rk(d.id)]=history[rk(d.id)]||[]).push(old)}delete responses[rk(d.id)];persist();render()};
  const u=document.getElementById("update");
  if(u) u.onsubmit=e=>{e.preventDefault();const note=document.getElementById("up-note").value.trim(),by=document.getElementById("up-by").value.trim();
    if(note.length<10||!by){document.getElementById("upmsg").textContent="Add what happened and the approver's role.";return}
    (DB.updates[rk(d.id)]=DB.updates[rk(d.id)]||[]).push({stage:document.getElementById("up-stage").value,bill:document.getElementById("up-bill").value.trim(),note,approver:by,date:today()});persist();render()};
}
function render(){renderOffices();renderSeat();renderList();renderDetail()}
(async()=>{try{const idx=await (await fetch("packs/index.json")).json();
  for(const e of idx.packs){PK[e.file]=await (await fetch(e.file)).json()}
  const seen=new Set();Object.values(PK).forEach(d=>(d.jurisdiction.offices||[]).forEach(o=>{if(!seen.has(o.key)){seen.add(o.key);OFFICES.push(o)}}));
  const want=new URLSearchParams(location.search).get("office");office=(OFFICES.find(o=>o.key===want)||OFFICES.find(o=>o.key==="state-house")||OFFICES[0]).key;
  open=packsFor(office)[0]||null;render();}catch(e){document.getElementById("list").innerHTML='<h2>Couldn\'t load the inbox</h2><p class="meta">Reload the page to try again.</p>'}})();
