/* "Help me understand" (PREVIEW ONLY, static examples). Shows optional explanations beside an official passage on an
   issue page. Nothing here calls an AI service: the explanations were written in advance, stored in
   /preview/ai-examples.json, and are shown only when the passage on the page matches the stored passage exactly.
   The official text is never changed. Every quote is checked word for word against the passage before it is shown;
   a claim whose quote isn't found is dropped. Nothing about the visitor is sent anywhere. */
(function(){
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const KIND={says:"The document says",reading:"Reading of the text",unknown:"Not determined here"};
let DATA=null, STATE={open:false,action:null,term:null};
const id=()=>new URLSearchParams(location.search).get("id")||"";

function style(){if(document.getElementById("aix-css"))return;const s=document.createElement("style");s.id="aix-css";
  s.textContent=`.aix-btn{font:inherit;min-height:44px;padding:8px 14px;border-radius:8px;border:1px solid var(--muted);background:var(--bg);color:var(--ink);cursor:pointer;margin-top:8px}
  .aix{margin-top:10px;border:2px dashed var(--muted);border-radius:10px;padding:12px 14px;background:var(--bg)}
  .aix h3{font-size:1rem;margin:0 0 6px}.aix .aix-label{display:inline-block;font-size:.78rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border:1px solid var(--muted);border-radius:999px;padding:2px 10px;margin-bottom:8px}
  .aix .aix-acts{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.aix .aix-acts button{font:inherit;min-height:44px;padding:8px 12px;border-radius:8px;border:1px solid var(--muted);background:var(--surface);color:var(--ink);cursor:pointer;text-align:left}
  .aix .aix-acts button[aria-pressed="true"]{border:2px solid var(--koa)}
  .aix ol{padding-left:20px;margin:8px 0}.aix li{margin-bottom:10px}.aix .aix-kind{font-weight:700}.aix .aix-quote{display:block;font-size:.9rem;margin-top:2px}
  .aix .aix-meta{font-size:.85rem;opacity:.9}.aix details{margin:6px 0}
  ::highlight(aix-src){background:var(--sun);color:var(--ink)}`;document.head.appendChild(s)}

// Highlight a quoted phrase inside the official passage without changing its text (CSS Custom Highlight API).
function showInPassage(q){const bq=document.querySelector(".q5quote");if(!bq)return;bq.scrollIntoView({block:"center"});
  if(!(window.CSS&&CSS.highlights&&window.Highlight))return;
  const walker=document.createTreeWalker(bq,NodeFilter.SHOW_TEXT);let n;while((n=walker.nextNode())){const i=n.textContent.indexOf(q);
    if(i>=0){const r=new Range();r.setStart(n,i);r.setEnd(n,i+q.length);CSS.highlights.set("aix-src",new Highlight(r));setTimeout(()=>CSS.highlights.delete("aix-src"),4000);return}}}

function claimsHTML(ex,claims){
  // Code check: every quote must appear word for word in the stored passage. A claim with a missing quote is dropped.
  const ok=claims.filter(c=>(c.quotes||[]).every(q=>ex.passage.includes(q))&&(c.kind==="unknown"||(c.quotes||[]).length));
  const dropped=claims.length-ok.length;
  return `<ol>${ok.map((c,i)=>`<li><span class="aix-kind">${esc(KIND[c.kind]||c.kind)}:</span> ${esc(c.text)}${(c.quotes||[]).map((q,j)=>`<span class="aix-quote meta">Supporting words: “${esc(q)}” <button type="button" class="linkbtn" data-aixq="${esc(q)}" style="background:none;border:0;padding:0 4px;min-height:32px;color:var(--koa);text-decoration:underline;cursor:pointer;font:inherit">Show in the passage</button></span>`).join("")}</li>`).join("")}</ol>
    ${dropped?`<p class="aix-meta">${dropped} part${dropped===1?"":"s"} of this explanation ${dropped===1?"was":"were"} left out because its quoted words didn't match the passage.</p>`:""}`;
}
function panel(ex){
  const a=ex.actions.find(x=>x.id===STATE.action);
  let answer="";
  if(a){
    let claims=a.claims||[];
    if(a.terms){const t=a.terms.find(x=>x.term===STATE.term);
      answer=`<p class="aix-meta">Pick a term from the passage:</p><div class="aix-acts">${a.terms.map(x=>`<button type="button" data-aixt="${esc(x.term)}" aria-pressed="${STATE.term===x.term}">${esc(x.term)}</button>`).join("")}</div>`;
      claims=t?t.claims:[]}
    if(claims.length)answer+=`<section class="aix-answer" aria-labelledby="aix-ah"><span class="aix-label">AI explanation, not official text</span><h3 id="aix-ah">${esc(a.label)}${STATE.term?`: “${esc(STATE.term)}”`:""}</h3>
      <p class="aix-meta">Based on: ${esc(ex.document)}, ${esc(ex.source)}. ${esc(ex.scope)}</p>${claimsHTML(ex,claims)}
      <details><summary class="aix-meta">Report a problem with this explanation</summary><p class="aix-meta">A report would send the document and passage, the action you chose, and the explanation shown, plus a note if you add one. It would send nothing about you. In this preview, reporting isn't connected and nothing is sent.</p></details></section>`;
  }
  return `<div class="aix" id="aix-panel" role="region" aria-label="Help me understand (preview)">
    <span class="aix-label">Preview · example explanations</span>
    <p class="aix-meta">This optional tool explains the official passage above. It can make mistakes. Its explanations are not official text, don't change the record, and don't count as your response. In this preview, the explanations were written in advance by an AI system (Claude) and checked before being shown. No AI service is contacted, and nothing about you is sent.</p>
    <details><summary class="aix-meta">See exactly what this tool can read</summary><p class="aix-meta">${esc(ex.scope)} Document: ${esc(ex.document)}.</p></details>
    <div class="aix-acts" role="group" aria-label="Choose what to explain">${ex.actions.map(x=>`<button type="button" data-aixa="${x.id}" aria-pressed="${STATE.action===x.id}">${esc(x.label)}</button>`).join("")}</div>
    <div aria-live="polite">${answer}</div></div>`;
}
function inject(){
  if(!DATA)return;const ex=DATA.items[id()];if(!ex)return;
  const bq=document.querySelector(".q5 .q5quote");if(!bq)return;
  const dd=bq.closest("dd");if(!dd||dd.querySelector(".aix-btn,.aix-stale"))return;
  style();
  // Version check: the example is shown only if the passage on the page is exactly the passage it was written for.
  if(bq.innerText.replace(/\s+/g," ").trim()!==ex.passage.replace(/\s+/g," ").trim()){
    dd.insertAdjacentHTML("beforeend",`<p class="aix-stale meta">An example explanation exists for an earlier version of this passage, so it isn't shown.</p>`);return}
  dd.insertAdjacentHTML("beforeend",`<button type="button" class="aix-btn" aria-expanded="${STATE.open}" aria-controls="aix-panel">Help me understand (preview)</button><div class="aix-slot">${STATE.open?panel(ex):""}</div>`);
  wire(dd,ex);
}
function wire(dd,ex){
  const btn=dd.querySelector(".aix-btn"),slot=dd.querySelector(".aix-slot");
  const redraw=focusSel=>{slot.innerHTML=STATE.open?panel(ex):"";btn.setAttribute("aria-expanded",STATE.open);bind();if(focusSel){const f=slot.querySelector(focusSel);if(f)f.focus()}};
  const bind=()=>{
    slot.querySelectorAll("[data-aixa]").forEach(b=>b.onclick=()=>{STATE.action=b.dataset.aixa;STATE.term=null;redraw(`[data-aixa="${b.dataset.aixa}"]`)});
    slot.querySelectorAll("[data-aixt]").forEach(b=>b.onclick=()=>{STATE.term=b.dataset.aixt;redraw(`[data-aixt="${CSS.escape(b.dataset.aixt)}"]`)});
    slot.querySelectorAll("[data-aixq]").forEach(b=>b.onclick=()=>showInPassage(b.dataset.aixq));
  };
  btn.onclick=()=>{STATE.open=!STATE.open;redraw()};
  bind();
}
async function init(){
  if(!/^\/item\.html$/.test(location.pathname))return;
  try{DATA=await (await fetch("/preview/ai-examples.json")).json()}catch(e){return}
  const main=document.getElementById("main");if(!main)return;
  inject();new MutationObserver(()=>inject()).observe(main,{childList:true,subtree:true});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
