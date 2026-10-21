/* "Help me understand" (PREVIEW ONLY, prepared examples). Optional explanations beside an official passage on an
   issue page. Nothing here calls an AI service: explanations are prepared in advance in /preview/ai-examples.json.
   - The official text is never changed. The page works the same for people who never open an explanation.
   - Each example is shown only if the whole official context it was prepared for (title, version, date, every summary
     part with its lead-in and background) is unchanged, by comparing a fingerprint. An unchanged quote alone isn't
     enough: if anything around it changed, the example is held back until a person reviews it again.
   - Code checks every quote word for word. That only proves the words are in the source; whether the explanation
     follows from them, keeps their qualifications, and is fair is checked by a person (see the review status shown).
   - Nothing about the visitor is sent anywhere. */
(function(){
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const KIND={says:"This passage says",reading:"Reading of the text",unknown:"This passage does not say"};
let DATA=null, STATE={open:false,action:null,term:null};
const id=()=>new URLSearchParams(location.search).get("id")||"";

// The same fingerprint the examples file stores: SHA-256 of the item's official context, in a fixed shape.
async function contextHash(it,itemId){
  const o={id:itemId,title:it.title||"",version:(it.summary&&it.summary.version)||"",date:(it.summary&&it.summary.date)||"",
    parts:(it.parts||[]).map(p=>({lead:p.lead||"",text:p.text||"",background:p.background||""}))};
  const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(o)));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function style(){if(document.getElementById("aix-css"))return;const s=document.createElement("style");s.id="aix-css";
  s.textContent=`.aix-btn{font:inherit;min-height:44px;padding:8px 14px;border-radius:8px;border:1px solid var(--muted);background:var(--bg);color:var(--ink);cursor:pointer;margin-top:8px}
  .aix{margin-top:10px;border:2px dashed var(--muted);border-radius:10px;padding:12px 14px;background:var(--bg)}
  .aix h3{font-size:1rem;margin:0 0 6px}.aix-label{display:inline-block;font-size:.8rem;font-weight:700;border:1px solid var(--muted);border-radius:8px;padding:3px 10px;margin-bottom:8px}
  .aix-label.unapproved{border:2px solid var(--lehua)}
  .aix-acts{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.aix-acts button{font:inherit;min-height:44px;padding:8px 12px;border-radius:8px;border:1px solid var(--muted);background:var(--surface);color:var(--ink);cursor:pointer;text-align:left}
  .aix-acts button[aria-pressed="true"]{border:2px solid var(--koa)}
  .aix ol{padding-left:20px;margin:8px 0}.aix li{margin-bottom:10px}.aix-kind{font-weight:700}.aix-quote{display:block;font-size:.9rem;margin-top:2px}
  .aix-meta{font-size:.85rem}.aix dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 10px;margin:6px 0;font-size:.85rem}.aix dt{font-weight:700}.aix dd{margin:0}
  .aix details{margin:6px 0}::highlight(aix-src){background:var(--sun);color:var(--ink)}
  @media (max-width:520px){.aix dl{grid-template-columns:1fr}}`;document.head.appendChild(s)}

// Highlight a quoted phrase inside the official passage without changing its text (CSS Custom Highlight API).
function showInPassage(q){const bq=document.querySelector(".q5quote");if(!bq)return;bq.scrollIntoView({block:"center"});
  if(!(window.CSS&&CSS.highlights&&window.Highlight))return;
  const w=document.createTreeWalker(bq,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const i=n.textContent.indexOf(q);
    if(i>=0){const r=new Range();r.setStart(n,i);r.setEnd(n,i+q.length);CSS.highlights.set("aix-src",new Highlight(r));setTimeout(()=>CSS.highlights.delete("aix-src"),4000);return}}}

const approved=ex=>ex.review&&ex.review.status==="approved"&&ex.review.reviewedOn;
function labelHTML(ex){return approved(ex)
  ?`<span class="aix-label">AI-assisted explanation, reviewed by a person. Not official text.</span>`
  :`<span class="aix-label unapproved">Unapproved preview: AI-assisted explanation, not yet reviewed by a person. Not official text.</span>`}
function provenance(ex){const r=ex.review||{};
  return `<dl><dt>Source</dt><dd>${esc(ex.sourceVersion)}, ${esc(ex.source)}</dd>
    <dt>Material reviewed</dt><dd>${esc(ex.scopeReviewed)}</dd>
    <dt>Review</dt><dd>${approved(ex)?`Approved ${esc(r.reviewedOn)}${r.reviewerRole?` by ${esc(r.reviewerRole)}`:""}, using review checklist ${esc(r.checklist)}.`:"Not yet reviewed by a person. Only the code check of quotations has been done."}</dd></dl>`}
function claimsHTML(ex,claims){
  // Code check only: each quote must appear word for word in the passage. A claim whose quote doesn't is dropped.
  const ok=claims.filter(c=>(c.quotes||[]).every(q=>ex.passage.includes(q))&&(c.kind==="unknown"||(c.quotes||[]).length));
  const dropped=claims.length-ok.length;
  return `<ol>${ok.map(c=>`<li><span class="aix-kind">${esc(KIND[c.kind]||c.kind)}:</span> ${esc(c.text)}${(c.quotes||[]).map(q=>`<span class="aix-quote meta">Supporting words: “${esc(q)}” <button type="button" data-aixq="${esc(q)}" style="background:none;border:0;padding:0 4px;min-height:32px;color:var(--koa);text-decoration:underline;cursor:pointer;font:inherit">Show in the passage</button></span>`).join("")}</li>`).join("")}</ol>
    ${dropped?`<p class="aix-meta">${dropped} part${dropped===1?" was":"s were"} left out because the quoted words didn't match the passage.</p>`:""}`;
}
function answerHTML(ex,a){
  let claims=a.claims||[],pick="";
  if(a.terms){const t=a.terms.find(x=>x.term===STATE.term);
    pick=`<p class="aix-meta">Pick a term from the passage:</p><div class="aix-acts">${a.terms.map(x=>`<button type="button" data-aixt="${esc(x.term)}" aria-pressed="${STATE.term===x.term}">${esc(x.term)}</button>`).join("")}</div>`;
    claims=t?t.claims:[]}
  return pick+(claims.length?`<section class="aix-answer" aria-labelledby="aix-ah">${labelHTML(ex)}<h3 id="aix-ah">${esc(a.label)}${STATE.term?`: “${esc(STATE.term)}”`:""}</h3>${provenance(ex)}${claimsHTML(ex,claims)}
    <details><summary class="aix-meta">Report a problem with this explanation</summary><p class="aix-meta">A report would send the document and passage, the question you chose, and the explanation shown, plus a note if you add one. It would send nothing about you. In this preview, reporting isn't connected and nothing is sent.</p></details></section>`:"");
}
function panel(ex){
  const all=[...ex.primary,...(ex.limited||[])],a=all.find(x=>x.id===STATE.action);
  const btns=list=>list.map(x=>`<button type="button" data-aixa="${x.id}" aria-pressed="${STATE.action===x.id}">${esc(x.label)}</button>`).join("");
  return `<div class="aix" id="aix-panel" role="region" aria-label="Help me understand (preview)">
    ${labelHTML(ex)}
    <p class="aix-meta">This optional tool explains the official summary above. Explanations were prepared in advance with an AI system and can contain mistakes. They are not official text, don't change the record, and don't count as your response. No AI service is contacted and nothing about you is sent.</p>
    <details><summary class="aix-meta">What these explanations are based on</summary>${provenance(ex)}</details>
    <div class="aix-acts" role="group" aria-label="Explain this summary">${btns(ex.primary)}</div>
    ${ex.limited&&ex.limited.length?`<details${(ex.limited||[]).some(x=>x.id===STATE.action)?" open":""}><summary class="aix-meta">More questions (limited: only this summary is available)</summary><div class="aix-acts">${btns(ex.limited)}</div></details>`:""}
    <div aria-live="polite">${a?answerHTML(ex,a):""}</div></div>`;
}
async function inject(){
  if(!DATA||typeof IT==="undefined"||!IT)return;const itemId=id(),ex=DATA.items[itemId];if(!ex)return;
  const bq=document.querySelector(".q5 .q5quote");if(!bq)return;const dd=bq.closest("dd");
  if(!dd||dd.dataset.aix)return;dd.dataset.aix="1";
  style();
  // Context check: anything changed in the official context holds the example back for re-review.
  const h=await contextHash(IT,itemId);
  if(h!==ex.contextHash){dd.insertAdjacentHTML("beforeend",`<p class="aix-stale meta">An explanation was prepared for an earlier version of this official text. It's held back until a person reviews it again.</p>`);return}
  dd.insertAdjacentHTML("beforeend",`<button type="button" class="aix-btn" aria-expanded="${STATE.open}" aria-controls="aix-panel">Help me understand (preview)</button><div class="aix-slot">${STATE.open?panel(ex):""}</div>`);
  const btn=dd.querySelector(".aix-btn"),slot=dd.querySelector(".aix-slot");
  const redraw=sel=>{slot.innerHTML=STATE.open?panel(ex):"";btn.setAttribute("aria-expanded",STATE.open);bind();if(sel){const f=slot.querySelector(sel);if(f)f.focus()}};
  const bind=()=>{
    slot.querySelectorAll("[data-aixa]").forEach(b=>b.onclick=()=>{STATE.action=b.dataset.aixa;STATE.term=null;redraw(`[data-aixa="${b.dataset.aixa}"]`)});
    slot.querySelectorAll("[data-aixt]").forEach(b=>b.onclick=()=>{STATE.term=b.dataset.aixt;redraw(`[data-aixt="${CSS.escape(b.dataset.aixt)}"]`)});
    slot.querySelectorAll("[data-aixq]").forEach(b=>b.onclick=()=>showInPassage(b.dataset.aixq));
  };
  btn.onclick=()=>{STATE.open=!STATE.open;redraw()};bind();
}
async function init(){
  if(location.pathname!=="/item.html")return;
  try{DATA=await (await fetch("/preview/ai-examples.json")).json()}catch(e){return}
  const main=document.getElementById("main");if(!main)return;
  inject();new MutationObserver(()=>inject()).observe(main,{childList:true,subtree:true});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
