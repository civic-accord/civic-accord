const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const safe=u=>/^https:\/\//.test(String(u||""))?u:null;
const fmt=d=>{if(!d)return "";const x=new Date(String(d).slice(0,10)+"T12:00:00Z");return isNaN(x)?esc(d):x.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric",timeZone:"UTC"})};
const ID=new URLSearchParams(location.search).get("id")||"";
// State bills: practice voting only for your own state, the same as Open Now.
const DIST=(()=>{try{const v=JSON.parse(localStorage.getItem("civicaccord-verified")||"null");if(v&&v.districts&&v.districts.state)return v.districts;return JSON.parse(localStorage.getItem("civicaccord-districts")||"null")}catch(e){return null}})();
const VKEY="civicaccord-item-votes";
let ALL=(()=>{try{return JSON.parse(localStorage.getItem(VKEY)||"{}")}catch(e){return {}}})();
let MINE=ALL[ID]||{parts:{},added:[]};
const save=()=>{ALL[ID]=MINE;try{localStorage.setItem(VKEY,JSON.stringify(ALL))}catch(e){}};
const CH=[["0","Agree"],["1","Disagree"],["2","Pass"]];
function choose(key,label){const v=MINE.parts[key];
  return `<div class="choose" role="group" aria-label="${esc(label)}: your view">${CH.map(([k,t])=>`<button type="button" data-k="${esc(key)}" data-v="${k}" aria-pressed="${v===k}">${t}</button>`).join("")}</div>`}
function render(it){
  $("title").textContent=it.title;
  $("kind").textContent=[it.kind,it.jurisdiction&&it.jurisdiction.name].filter(Boolean).join(" · ");
  document.title=it.title.slice(0,60)+" · Talk It Through";
  const parts=it.parts.length?it.parts:[{text:it.whole}];
  const J=it.jurisdiction||{}, local=it.level==="local";
  const own=local?!!(DIST&&((J.countyId&&DIST.countyId===J.countyId)||(J.placeId&&DIST.placeId===J.placeId))):it.level!=="state"||!!(DIST&&DIST.state&&DIST.state===J.stateCode);
  const what=it.kind==="Proposed rule"?"proposal":local?"meeting":"bill", from=it.partsFrom||"the official summary";
  const keys=it.parts.length?parts.map((_,i)=>"p"+i):["whole"];
  const chosen=keys.filter(k=>MINE.parts[k]!==undefined).length, agreed=keys.filter(k=>MINE.parts[k]==="0").length;
  const L=it.links||{};
  $("main").innerHTML=`
  <section class="panel" aria-labelledby="h1"><div class="eyebrow">Step 1</div><h2 id="h1">What it is</h2>
    <dl class="kv">
      ${it.status?`<dt>Latest</dt><dd>${it.status.date?fmt(it.status.date)+": ":""}${esc(it.status.text)}</dd>`:""}
      ${it.meets?`<dt>Meets</dt><dd>${fmt(it.meets)}${it.meetsTime?" at "+esc(it.meetsTime):""}</dd>`:""}
      ${it.introduced?`<dt>${it.kind==="Proposed rule"?"Published":"Introduced"}</dt><dd>${fmt(it.introduced)}</dd>`:""}
      ${it.sponsors&&it.sponsors.length?`<dt>Sponsor${it.sponsors.length>1?"s":""}</dt><dd>${it.sponsors.map(s=>esc(s.name)).join(", ")}</dd>`:""}
      ${it.topic?`<dt>Topic</dt><dd>${esc(it.topic)}</dd>`:""}
      <dt>Summary by</dt><dd>${it.summary?esc(it.summary.by)+(it.summary.version?` · ${esc(it.summary.version)}`:"")+(it.summary.date?`, ${fmt(it.summary.date)}`:""):"No official summary yet"}</dd>
    </dl>
    <div class="links">
      ${safe(L.text)?`<a class="primary" href="${esc(L.text)}" target="_blank" rel="noopener">Read the official text</a>`:""}
      ${safe(L.official)&&L.official!==L.text?`<a href="${esc(L.official)}" target="_blank" rel="noopener">Official page</a>`:""}
      ${safe(L.comment)?`<a class="primary" href="${esc(L.comment)}" target="_blank" rel="noopener">${esc(L.commentLabel||(L.commentForm===false?"How to comment (in the notice)":"Comment officially"))}</a>`:""}
    </div>
    ${it.kind==="Proposed rule"?`<p class="meta">For a proposed rule, the agency decides, and it must consider the official comments. That's the comment that counts most.</p>`:local?`<p class="meta">This is a public meeting. Speaking up at or before it is how the ${esc(J.name)} hears from residents. The meeting page and agenda say how to comment and by when.</p>`:""}
  </section>

  <section class="panel" aria-labelledby="h2"><div class="eyebrow">Step 2</div><h2 id="h2">Weigh in on each part</h2>
    <p>${it.parts.length?`Each part below is copied word for word from ${esc(from)}, in order. Do you agree with it?`:esc(it.partsNote)}</p>
    ${it.parts.length?`<p class="meta">${local?"Only agenda items with legislation attached are listed. Read the agenda for everything else.":"Headings and very short lines are left out. Read the official text for all of it."}</p>`:""}
    ${own?"":`<p class="submitbox">${local?(DIST&&!DIST.countyId&&!DIST.placeId?`Your saved address is from before local meetings were added. <a href="open.html#me" style="color:var(--koa)">Enter your address again on Open Now</a> so we know your county and city.`:DIST?`This meeting is for ${esc(J.name)}, so it's here to read. Practice voting is for your own county or city. Anyone can read the agenda or testify.`:`To weigh in on a local meeting, first <a href="open.html#me" style="color:var(--koa)">enter your address on Open Now</a> so we know your county and city. It stays on this device.`):DIST?`This is another state's bill, so it's here to read. Practice voting is for bills in your own state (${esc(DIST.stateName||DIST.state)}).`:`To weigh in on a state bill, first <a href="open.html#me" style="color:var(--koa)">enter your address on Open Now</a> so we know it's your state. It stays on this device.`}</p>`}
    <ol class="parts">${parts.map((p,i)=>`<li class="part"><span class="num">${it.parts.length?(local?"Agenda item ":"Part ")+(i+1)+(p.ref?" · "+esc(p.ref):""):"The whole "+what}</span>${p.lead?`<span class="meta">${esc(p.lead)}</span>`:""}<blockquote>${esc(p.text)}</blockquote>${p.background?`<details><summary class="meta">Background from the same summary</summary>${String(p.background).split("\n\n").map(t=>`<p class="meta">${esc(t)}</p>`).join("")}</details>`:""}${own?choose(keys[i],it.parts.length?(local?"Agenda item ":"Part ")+(i+1):"The whole "+what):""}</li>`).join("")}</ol>
    ${it.partsMore?`<p class="meta">The summary has more parts than fit here. Read the rest in the official text.</p>`:""}
    <p class="meta" id="saved">${chosen?`Practice votes saved on this device: ${chosen} of ${keys.length}.`:"Your practice votes are saved on this device as you go."}</p>
    ${own?`<h3>Add your own statement</h3>
    <form id="addf"><label for="addt" class="meta">One clear idea about this ${what}, in your own words (practice; stays on this device)</label>
      <textarea id="addt" rows="2" maxlength="200"></textarea>
      <p class="meta">In the live version, a moderator checks new statements against <a href="how.html#rules" style="color:var(--koa)">published rules</a> before others see them.</p>
      <button class="btn" type="submit">Add statement</button> <span class="toast" id="addmsg" aria-live="polite"></span></form>
    ${MINE.added.length?`<ul class="plain">${MINE.added.map((t,i)=>`<li>${esc(t)} <button type="button" class="btn ghost" data-rm="${i}">Remove</button></li>`).join("")}</ul>`:""}`:""}
  </section>

  <section class="panel" aria-labelledby="h3"><div class="eyebrow">Step 3</div><h2 id="h3">Where people agree</h2>
    <p>No votes are counted yet, so there's nothing to show here. When verified voting starts, each part will be labeled common ground, divides groups, or still forming, using the <a href="how.html#ground" style="color:var(--koa)">published rules</a>, with the share of registered voters who took part.</p>
    ${chosen?`<p class="meta">Your practice: you agreed with ${agreed} of the ${keys.length} ${it.parts.length?"parts":"choices"} you could vote on.</p>`:""}
  </section>

  <section class="panel" aria-labelledby="h4"><div class="eyebrow">Step 4</div><h2 id="h4">What it would cost</h2>
    ${it.costs.filter(c=>safe(c.url)).length?`<ul class="plain">${it.costs.filter(c=>safe(c.url)).map(c=>`<li><b><a href="${esc(c.url)}" target="_blank" rel="noopener" style="color:var(--koa)">${esc(c.title)}</a></b>${c.date?`, ${fmt(c.date)}`:""} · ${esc(c.by)}${c.description?`<br><span class="meta">${esc(c.description)}</span>`:""}</li>`).join("")}</ul>`:it.kind==="Proposed rule"?`<p><b>Not shown here.</b> Read the full notice for any cost analysis.</p>`:local?`<p><b>Not shown here.</b> Read the agenda packet for any staff report on costs.</p>`:`<p><b>Not yet estimated.</b> No official cost estimate is available for this bill yet.</p>`}
    <p class="meta">${esc(it.costNote)}</p>
  </section>

  <section class="panel" aria-labelledby="h5"><div class="eyebrow">Step 5</div><h2 id="h5">What the office would receive (planned)</h2>
    <p>Once verified voting exists, the ${it.kind==="Proposed rule"?"agency":local?esc(J.name):"office that represents you"} would receive which parts have common ground and which divide people, the statements residents added, how many verified voters took part${local?"":", and any official cost estimate"}. Disagreements travel with it.</p>
    <p>You can speak up today: ${local&&safe(L.comment)?`<a href="${esc(L.comment)}" target="_blank" rel="noopener" style="color:var(--koa)">see the meeting page and agenda for how to comment</a>.`:`${it.kind==="Proposed rule"&&safe(L.comment)?`<a href="${esc(L.comment)}" target="_blank" rel="noopener" style="color:var(--koa)">comment officially</a>, or `:""}<a href="open.html" style="color:var(--koa)">write to your representatives from Open Now</a>.`}</p>
  </section>`;
  document.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{const k=b.dataset.k,v=b.dataset.v;if(MINE.parts[k]===v)delete MINE.parts[k];else MINE.parts[k]=v;save();
    b.parentElement.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(MINE.parts[k]===x.dataset.v)));
    const n=keys.filter(k=>MINE.parts[k]!==undefined).length;$("saved").textContent=`Practice votes saved on this device: ${n} of ${keys.length}.`});
  const af=$("addf");if(af)af.onsubmit=e=>{e.preventDefault();const t=$("addt").value.trim();if(t.length<10){$("addmsg").textContent="Write at least a short sentence.";return}
    MINE.added.push(t);save();render(it);$("addt").focus();$("addmsg").textContent="Added on this device."};
  document.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{MINE.added.splice(+b.dataset.rm,1);save();render(it);const t=$("addt");if(t)t.focus();$("addmsg").textContent="Removed."});
}
(async()=>{
  if(!ID){$("title").textContent="Pick an item to talk through";$("main").innerHTML=`<p>Choose any bill or proposed rule on <a href="open.html" style="color:var(--koa)">Open Now</a>, then choose "Talk it through."</p>`;return}
  let d=null;try{d=await (await fetch("/api/item?id="+encodeURIComponent(ID))).json()}catch(e){}
  if(!d||!d.item){$("title").textContent="Couldn't load this item";$("main").innerHTML=`<p>${esc(d&&d.errors&&d.errors[0]||"Couldn't reach the official source. Check your connection and try again.")}</p><p><a href="open.html" style="color:var(--koa)">Back to Open Now</a></p>`;return}
  render(d.item);
  $("src").innerHTML=`From <a href="${esc(safe(d.item.source.url)||"#")}" target="_blank" rel="noopener" style="color:inherit">${esc(d.item.source.label)}</a> · fetched ${new Date(d.fetchedAt).toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short"})}`;
})();
