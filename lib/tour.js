/* A short, optional tour for first-time visitors. It walks across the real pages with a small panel at the bottom of
   the screen. The panel is not a dialog: it doesn't trap focus, so people can use the page controls it describes.
   It never starts on its own (only "Take a short tour" starts it), never advances by itself, and never follows an issue,
   sends anything, or saves an address for you. "End tour" leaves you where you are. The current step is kept in this
   browser tab only (sessionStorage); "Forget me on this device" clears it like everything else. */
(function(){
const KEY="civicaccord-tour", NOTE="civicaccord-tour-note";
// Each step: the page it belongs to ("item" = a real, open issue; "here" = wherever you are), what it points at, that
// part described in words (so the step doesn't depend on seeing the outline), a heading, and plain words.
const STEPS=[
  {page:"/",target:".hero",where:"the top of the home page",h:"What you can do here",
   t:"Civic Accord is an independent, nonpartisan website. Find what your governments have open for public input, read official information, and learn how to take part. You don't need to be a registered voter to browse or use these tools. Sample activities are labeled, and they don't count as public input."},
  {page:"/open.html",target:"#topics",where:"the topic picker near the top of Issues",h:"Find an issue",
   t:"Browse Issues by topic or state. Open an item's title to see its official information, sources, and next steps. What's covered varies by place: a state's bills show only while its legislature is in session."},
  {page:"/governments.html",target:"#addr",where:"the box labeled Home address",h:"Find your representatives",
   t:"You can browse without entering an address. To find your districts, enter an address or try a public example. The address goes to the U.S. Census Bureau. Civic Accord keeps only the districts, in this browser. An example shows the representatives for that address, not yours."},
  {page:"item",target:"#h2",where:"the Take part section of this issue's page",h:"Speak up",
   t:"Use the official comment link when one is available. You can also prepare a message for your representatives. You send it from your email app or the office's form; Civic Accord doesn't send it. You can save your own record of sending it."},
  {page:"item",target:"#follow",where:"the Follow this issue button",h:"Follow changes",
   t:"Follow an issue to save it in this browser. Open Following later to check for changes in the official record. It checks when you visit; it doesn't send alerts. Your saved items don't sync to other devices."},
  {page:"here",target:null,where:null,h:"Choose your next step",
   t:"You're ready to explore. Learn offers reading help for anyone. You can also open a fictional sample of the planned group process. On a shared device, \"Forget me on this device\" clears Civic Accord's saved data in this browser.",
   choices:[["Browse issues","/open.html"],["Open Learn","/learn.html"],["View the fictional sample","/item.html?id=sample-civic-channel"]]}
];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const get=()=>{try{const n=parseInt(sessionStorage.getItem(KEY),10);return n>=0&&n<STEPS.length?n:null}catch(e){return null}};
const set=n=>{try{n===null?sessionStorage.removeItem(KEY):sessionStorage.setItem(KEY,String(n))}catch(e){}};
const note=v=>{try{v===null?sessionStorage.removeItem(NOTE):sessionStorage.setItem(NOTE,v)}catch(e){}};
const readNote=()=>{try{return sessionStorage.getItem(NOTE)}catch(e){return null}};
const onRealItem=()=>location.pathname==="/item.html"&&!/[?&]id=sample-/.test(location.search);
const here=s=>s.page==="here"||(s.page==="item"?onRealItem():location.pathname===s.page||(s.page==="/"&&location.pathname==="/index.html"));

// For the issue-page steps, open a real issue with an action available now: a proposed rule still open for comment,
// otherwise a bill in Congress, otherwise any federal item. If none loads, the step says so on Issues instead.
async function realIssue(){try{const d=await (await fetch("/api/open")).json();const all=d.items||[];const today=new Date().toISOString().slice(0,10);
  const it=all.find(i=>i.kind==="Proposed rule"&&i.closes&&i.closes>=today&&i.act)||all.find(i=>i.kind==="Bill in Congress")||all.find(i=>i.level==="federal");
  return it?"/item.html?id="+encodeURIComponent(it.id):null}catch(e){return null}}
async function go(n){
  if(n===null||n>=STEPS.length){set(null);note(null);close();return}
  set(n);note(null);const s=STEPS[n];
  if(here(s)){show(n);return}
  if(s.page==="item"){const u=await realIssue();if(u){location.href=u;return}
    // No live issue could be loaded: explain on Issues rather than skipping silently.
    note("A live issue couldn't be opened just now, so this step is shown here. Open any issue's title to find this part on its page.");
    if(location.pathname==="/open.html"){show(n);return}location.href="/open.html";return}
  location.href=s.page;
}

let box=null,lit=null;
function style(){if(document.getElementById("tour-css"))return;const st=document.createElement("style");st.id="tour-css";
  st.textContent=`#tour{position:fixed;left:12px;right:12px;bottom:12px;z-index:60;max-width:560px;margin:0 auto;background:var(--surface,#fff);color:var(--ink,#1d2420);border:2px solid var(--koa,#2f5d50);border-radius:12px;padding:14px 16px;box-shadow:0 8px 30px rgba(0,0,0,.25);font:inherit}
  #tour h2{font-size:1.05rem;margin:2px 0 6px}#tour h2:focus{outline:none}#tour p{margin:0 0 10px;font-size:.95rem;line-height:1.45}#tour .tmeta{font-size:.8rem;opacity:.85}
  #tour .tacts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#tour button,#tour a.tbtn{font:inherit;min-height:44px;padding:8px 14px;border-radius:8px;cursor:pointer;border:1px solid var(--muted,#5b6660);background:var(--bg,#fff);color:var(--ink,#1d2420);text-decoration:none;display:inline-flex;align-items:center}
  #tour button.tnext{background:var(--koa,#2f5d50);border-color:var(--koa,#2f5d50);color:var(--surface,#fff)}#tour button.tend{margin-left:auto;border:0;background:none;text-decoration:underline}
  #tour button.tgo{padding:4px 12px;font-size:.85rem}
  .tour-lit{outline:3px solid var(--sun,#c98a00)!important;outline-offset:4px;border-radius:6px;scroll-margin-top:16px}
  @media (max-width:700px){#tour{bottom:calc(72px + env(safe-area-inset-bottom));padding:10px 12px}#tour p{font-size:.88rem;margin-bottom:8px}#tour h2{font-size:.98rem}}
  @media (max-width:700px) and (max-height:500px){#tour{position:static;margin:12px}}`;
  document.head.appendChild(st)}
function close(){if(box){box.remove();box=null}if(lit){lit.classList.remove("tour-lit");lit=null}}
function show(n){
  style();close();const s=STEPS[n],extra=readNote();
  // A labeled region, not a dialog: focus moves to its heading so the step is announced, and the page stays usable.
  box=document.createElement("section");box.id="tour";box.setAttribute("aria-labelledby","tour-h");
  box.innerHTML=`<span class="tmeta">Short tour · step ${n+1} of ${STEPS.length}</span><h2 id="tour-h" tabindex="-1">${esc(s.h)}</h2>
    <p>${esc(s.t)}</p>${extra?`<p class="tmeta">${esc(extra)}</p>`:s.where?`<p class="tmeta">This step is about ${esc(s.where)}, outlined on the page. <button type="button" class="tgo">Go to it</button></p>`:""}
    <div class="tacts">${s.choices?s.choices.map(([l,u])=>`<a class="tbtn" href="${esc(u)}" data-tour-done>${esc(l)}</a>`).join(""):""}
      ${n>0?`<button type="button" class="tback">Back</button>`:""}<button type="button" class="tnext">${s.choices?"Finish":"Next"}</button><button type="button" class="tend">End tour</button></div>`;
  document.body.appendChild(box);
  box.querySelector(".tnext").onclick=()=>go(n+1);
  const b=box.querySelector(".tback");if(b)b.onclick=()=>back(n-1);
  box.querySelector(".tend").onclick=()=>{set(null);note(null);close()};
  box.querySelectorAll("[data-tour-done]").forEach(a=>a.addEventListener("click",()=>{set(null);note(null)}));
  box.addEventListener("keydown",e=>{if(e.key==="Escape"){set(null);note(null);close()}});
  // Point at the part of the page the step is about, once it has drawn. "Go to it" moves keyboard focus there.
  const find=()=>s.target?document.querySelector(s.target):null;
  let tries=0;const point=()=>{const t=find();if(t){lit=t;t.classList.add("tour-lit");t.scrollIntoView({block:"start",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}else if(s.target&&++tries<20)setTimeout(point,250)};
  point();
  const g=box.querySelector(".tgo");if(g)g.onclick=()=>{const t=find();if(!t)return;
    const ctl="a,button,input,select,textarea,[tabindex]";const f=t.matches(ctl)?t:(t.querySelector("a,button,input,select,textarea")||t);
    if(f===t&&!t.matches(ctl))t.setAttribute("tabindex","-1");f.focus()};
  box.querySelector("h2").focus({preventScroll:true});
}
// Back goes to the previous step's page; for an issue-page step, the issue you were on is reused if you're there.
function back(n){set(n);note(null);const s=STEPS[n];if(here(s)){show(n);return}if(s.page==="item"){history.back();return}location.href=s.page}

function bindStarts(){document.querySelectorAll("[data-tour-start]").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();go(0)}))}
function init(){bindStarts();const n=get();if(n===null)return;const s=STEPS[n];
  if(here(s)||(s.page==="item"&&readNote()&&location.pathname==="/open.html"))show(n)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
window.CA_TOUR={start:()=>go(0),STEPS};
})();
