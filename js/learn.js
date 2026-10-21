const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const safe=u=>/^https:\/\//.test(u||"")?u:null;
const DKEY="civicaccord-learn-districts";
const LTKEY="civicaccord-learn-topics", TOP=window.CA_TOPICS||{list:[],match:()=>[]};
let LT=(()=>{try{return JSON.parse(localStorage.getItem(LTKEY)||"[]")}catch(e){return []}})(), ALL=[], LSHOW=7;
let D=(()=>{try{return JSON.parse(localStorage.getItem(DKEY)||"null")}catch(e){return null}})(), ITEMS=[], OPENG=null, NOTES={};
try{NOTES=JSON.parse(localStorage.getItem("civicaccord-learn-notes")||"{}")}catch(e){}
const QS=["What problem is this trying to solve?","Who would it affect, and how?","What would it cost, and who would pay?","Who decides, and when?","What would you want changed?"];
async function showReps(){
  if(!D){$("reps").innerHTML="";return}
  let sd=null;try{sd=await (await fetch("registry/states.json")).json()}catch(e){}
  const sx=sd&&sd.states?sd.states[D.state]:null;
  if(sx){$("prereg").textContent=sx.preregistrationAge?`In ${sx.name}, you can preregister to vote at ${sx.preregistrationAge===17.5?"17½":sx.preregistrationAge>17&&sx.preregistrationAge<18?"about 17 and 10 months":sx.preregistrationAge}.`:sx.preregistrationNote?`In ${sx.name}: ${sx.preregistrationNote.replace(/^No preregistration age\. You may/,"you may")} Check the state election office for details.`:`Check the ${sx.name} election office for when you can register.`}
  const fed=await CA_REG.officeholders(D), st=await CA_REG.stateLegislators(D);
  const rows=[];
  if(fed.rep) rows.push(`<li><b>${D.state==="PR"?"Resident Commissioner":["DC","GU","VI","AS","MP"].includes(D.state)?"Delegate to the U.S. House":"U.S. Representative"}:</b> ${esc(fed.rep.name)}${safe(fed.rep.contact||fed.rep.url)?` · <a href="${esc(fed.rep.contact||fed.rep.url)}" target="_blank" rel="noopener" style="color:var(--koa)">contact</a>`:""}</li>`);
  (fed.sen||[]).forEach(p=>rows.push(`<li><b>U.S. Senator:</b> ${esc(p.name)}${safe(p.contact||p.url)?` · <a href="${esc(p.contact||p.url)}" target="_blank" rel="noopener" style="color:var(--koa)">contact</a>`:""}</li>`));
  (st.legislators||[]).forEach(p=>rows.push(`<li><b>${D.state==="DC"?"D.C. Councilmember,":D.state==="NE"?"State senator, district":`State ${esc(p.title)}, district`} ${esc(p.district)}:</b> ${esc(p.name)}${p.email?` · <a href="mailto:${esc(p.email)}" style="color:var(--koa)">email</a>`:""}</li>`));
  $("reps").innerHTML=`<h3>Who represents you in ${esc(D.stateName||D.state)}</h3><ul class="plain">${rows.join("")||"<li>Contact details aren't available yet.</li>"}</ul>
   ${sx&&sx.testimony&&safe(sx.testimony.url)?`<div class="item"><h3>How to testify in ${esc(sx.name)}</h3>${sx.testimony.how?`<p>${esc(sx.testimony.how)}</p>`:""}${sx.testimony.remote===true?`<p class="meta">You can take part online or remotely.</p>`:""}<div class="acts"><a href="${esc(sx.testimony.url)}" target="_blank" rel="noopener">Official instructions</a>${sx.legislatureUrl?`<a href="${esc(sx.legislatureUrl)}" target="_blank" rel="noopener">${esc(sx.legislature||"Legislature website")}</a>`:""}</div><p class="meta">From the legislature's own site. Rules can differ by committee, so check the bill's hearing notice too.</p></div>`
     :sx&&sx.legislatureUrl?`<p class="meta">Your state legislature: <a href="${esc(sx.legislatureUrl)}" target="_blank" rel="noopener" style="color:var(--koa)">${esc(sx.legislature||"official site")}</a>. Look for "testimony" or "public comment" on bills with hearings.</p>`:""}
   <p class="meta"><a href="#" id="chg" style="color:var(--koa)">Use a different address</a></p>`;
  const c=$("chg");if(c)c.onclick=e=>{e.preventDefault();D=null;try{localStorage.removeItem(DKEY)}catch(x){}showReps();loadItems()};
}
function itemCard(it){
  const open=OPENG===it.id, n=NOTES[it.id]||{};
  return `<article class="item"><span class="eyebrow">${esc(it.kind)} · ${esc(it.source)}</span><h3>${esc(it.title)}</h3>
    ${(()=>{const ms=TOP.match(it),mine=ms.filter(m=>LT.includes(m.id)),sh=mine.length?mine:ms;return sh.length?`<span class="why">${mine.length?"Your topic":"Topic"}: ${sh.map(m=>`${esc(m.label)} <span style="font-weight:400">(the word “${esc(m.word)}”)</span>`).join(", ")}</span>`:""})()}
    <span class="meta">${esc(it.who)}${it.closes?`. Comments close ${esc(new Date(it.closes+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}))}.`:""}</span>
    <div class="acts">${safe(it.read)?`<a href="${esc(it.read)}" target="_blank" rel="noopener">Read the official text</a>`:""}
      <button type="button" data-g="${esc(it.id)}">${open?"Hide the guide":"Read it with the guide"}</button>
      ${safe(it.act)&&it.actLabel?`<a href="${esc(it.act)}" target="_blank" rel="noopener">${esc(it.actLabel)}</a>`:""}</div>
    ${open?`<div class="guide"><p class="meta">Answer in your own words. Your notes stay on this device.</p>
      ${QS.map((q,i)=>`<label for="q${i}" class="meta"><b>${esc(q)}</b></label><textarea id="q${i}" rows="2" data-n="${i}">${esc(n[i]||"")}</textarea>`).join("")}
      <p class="meta">Ready to speak up? ${it.kind==="Proposed rule"?"Turn your answers into a comment, in your own words, and submit it on the official comment page.":"Write to the people who represent you, in your own words. A real story about how it affects you is the most useful thing you can share."} A message in your own words is usually more useful than a copied one.</p>
      <div class="acts"><button type="button" id="copynotes">Copy my notes</button>${safe(it.act)&&it.actLabel?`<a href="${esc(it.act)}" target="_blank" rel="noopener">${it.commentForm===false?"See how to comment (in the notice)":"Open the official comment page"}</a>`:""}<span class="toast" id="cpmsg" aria-live="polite"></span></div></div>`:""}
  </article>`;
}
function renderItems(){
  $("items").innerHTML=ITEMS.length?ITEMS.map(itemCard).join(""):`<p class="meta">Nothing to show right now. Try again later.</p>`;
  document.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{OPENG=OPENG===b.dataset.g?null:b.dataset.g;renderItems()});
  document.querySelectorAll("[data-n]").forEach(t=>t.oninput=()=>{(NOTES[OPENG]=NOTES[OPENG]||{})[t.dataset.n]=t.value;try{localStorage.setItem("civicaccord-learn-notes",JSON.stringify(NOTES))}catch(e){}});
  const cp=$("copynotes");if(cp)cp.onclick=()=>{const n=NOTES[OPENG]||{};const txt=QS.map((q,i)=>n[i]?`${q}\n${n[i]}`:"").filter(Boolean).join("\n\n");try{navigator.clipboard.writeText(txt).then(()=>$("cpmsg").textContent="Copied.")}catch(e){$("cpmsg").textContent="Select your notes to copy them."}};
}

// Mix state bills, soonest comment deadlines, and bills in Congress, so there's a little of each.
// Closed items are left out, using the same deadline check as Open Now (lib/dates.js).
function mix(all){const list=all.filter(x=>!CA_DATES.isClosed(x.closes)&&!CA_DATES.isClosed(x.meets));
  const st=list.filter(x=>x.level==="state"), ru=list.filter(x=>x.closes).sort((a,b)=>a.closes.localeCompare(b.closes)), co=list.filter(x=>x.source==="Congress.gov");
  const out=[],seen=new Set(),q=[st,ru,co];let i=0;while(q.some(a=>a.length)){const a=q[i++%3];const x=a.shift();if(x&&!seen.has(x.id)){seen.add(x.id);out.push(x)}}return out}
function pick(){
  const q=$("lq").value.trim().toLowerCase();
  const base=q?ALL.filter(it=>(it.title+" "+it.who+" "+(it.summary||"")).toLowerCase().includes(q)):LT.length?ALL.filter(it=>TOP.match(it).some(m=>LT.includes(m.id))):ALL;
  const m=mix([...base]);ITEMS=m.slice(0,LSHOW);
  $("lcount").textContent=ALL.length?(q?`${m.length} issue${m.length===1?"":"s"} match "${$("lq").value.trim()}".`:LT.length?`${m.length} real issue${m.length===1?"":"s"} open on your topics.`:`Showing a few of ${ALL.length} open issues. Pick topics to find yours.`):"";
  $("lmore").hidden=m.length<=LSHOW;$("lmore").textContent=`Show more (${m.length-LSHOW} left)`;
  renderTopicsL();renderItems();
  if(!m.length&&ALL.length)$("items").innerHTML=`<p class="meta">Nothing open on that right now. Try another topic or word. <button class="linkbtn" type="button" id="lall">Show a mix of everything</button></p>`,$("lall").onclick=()=>{LT=[];$("lq").value="";try{localStorage.setItem(LTKEY,"[]")}catch(e){}pick()};
}
function renderTopicsL(){
  if(!TOP.list.length){$("ltopics").hidden=true;return}
  const cnt=id=>ALL.filter(it=>TOP.match(it).some(m=>m.id===id)).length;
  $("ltopics").innerHTML=TOP.list.map(t=>{const on=LT.includes(t.id);return `<button type="button" data-lt="${t.id}" aria-pressed="${on}" ${!on&&LT.length>=5?"disabled":""}>${esc(t.label)}${ALL.length?`<span class="n">${cnt(t.id)}</span>`:""}</button>`}).join("");
  $("ltopics").querySelectorAll("[data-lt]").forEach(b=>b.onclick=()=>{const id=b.dataset.lt;LT=LT.includes(id)?LT.filter(x=>x!==id):LT.length<5?[...LT,id]:LT;try{localStorage.setItem(LTKEY,JSON.stringify(LT))}catch(e){}LSHOW=7;OPENG=null;pick();const nb=$("ltopics").querySelector(`[data-lt="${id}"]`);if(nb)nb.focus()});
}
async function loadItems(){
  try{const j=await (await fetch("/api/open"+(D&&D.state?"?state="+encodeURIComponent(D.state):""))).json();
    ALL=j.items||[];LSHOW=7;pick();
  }catch(e){$("items").innerHTML=`<p class="meta">Couldn't load live items right now. Check your connection.</p>`}
}
const go=async()=>{const a=$("addr").value.trim();if(a.length<8){$("memsg").textContent="Enter a full street address, including city and state. A school or library address works too.";return}
  $("memsg").textContent="Looking up your districts with the Census Bureau…";
  try{const g=await CA_REG.lookup(a);D=CA_REG.districtsOf(g);try{localStorage.setItem(DKEY,JSON.stringify(D))}catch(x){}$("memsg").textContent="";showReps();loadItems()}
  catch(e){$("memsg").textContent=e.message==="nomatch"?"The Census Bureau couldn't match that address. Check the spelling and include the city and state.":"Couldn't reach the Census Bureau. Try again in a moment."}};
$("lq").oninput=()=>{LSHOW=7;pick()};$("lmore").onclick=()=>{LSHOW+=7;pick()};
$("findme").onclick=go;$("addr").onkeydown=e=>{if(e.key==="Enter")go()};
showReps();loadItems();
