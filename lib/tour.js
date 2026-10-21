/* A short guided tour for first-time visitors. It walks across the real pages, with a small panel at the bottom of
   the screen explaining each one. It never starts on its own: only "Take the tour" starts it, and "End tour" or
   finishing it stops it. The current step is kept in this browser tab only (sessionStorage), and "Forget me on this
   device" clears it like everything else. */
(function(){
const KEY="civicaccord-tour";
// Each step: the page it belongs to, what to point at (if found), a heading, and plain words.
const STEPS=[
  {page:"/",target:".hero",h:"What Civic Accord is for",
   t:"A free, nonpartisan way to work with your governments. Today you can see what they have open for public input, find who represents you, speak up, and follow what happens, all from official sources. Later, verified voters will be able to talk issues through together and send the office a proposal it's asked to answer in public."},
  {page:"/",target:".note",h:"What's real today, and what's a sample",
   t:"Everything you do on the live pages uses official information. The deliberation tools still use sample votes, so you can see how they would work. Civic Accord says which is which on every page."},
  {page:"/governments.html",target:"#addr",h:"Step 1: find who represents you",
   t:"Type your home address. It goes straight from your browser to the U.S. Census Bureau to find your districts. Civic Accord never receives it, and only the districts are kept, in this browser. No address handy? Try one of the capitol examples below the box."},
  {page:"/open.html",target:"#topics",h:"Step 2: see what's open for input",
   t:"Issues lists what your governments have open right now: proposed federal rules, bills in Congress and your state legislature, and some local meetings. Pick topics you care about, or browse everything. Each card shows your next step."},
  {page:"item",target:".panel.top",h:"Step 3: an issue's page",
   t:"Every issue has its own page, built only from official material. At the top: what it is, who can act on it, where it stands, and what you can do next."},
  {page:"item",target:"#h2",h:"Step 4: take part",
   t:"Read the official text, comment through the government's own channel, or write to your representatives from your own email. Civic Accord never sends or sees your message. You can keep a private record of what you sent."},
  {page:"item",target:"#follow",h:"Step 5: follow it",
   t:"Choose Follow this issue. Civic Accord saves what you saw, in this browser only, so next time you can see what changed in the official record."},
  {page:"/following.html",target:"#main",h:"Step 6: come back to Following",
   t:"Following checks each issue you follow against the latest official data when you open it. It tells you what changed, and it says so plainly when a check couldn't be done."},
  {page:"/item.html?id=sample-civic-channel",target:".draftbar",h:"Where this is going",
   t:"This sample shows the next part, which isn't built yet: verified voters find common ground, the office gets the request, answers in public, and what it does is recorded. Everything on this page is invented, and marked Sample."},
  {page:"/how.html",target:"#what",h:"You're ready",
   t:"How it works explains every rule in plain words. If you're not a voter yet, Learn has real issues and real actions anyone can take. On a shared computer, use Forget me on this device at the bottom of any page when you're done."}
];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const get=()=>{try{const n=parseInt(sessionStorage.getItem(KEY),10);return n>=0&&n<STEPS.length?n:null}catch(e){return null}};
const set=n=>{try{n===null?sessionStorage.removeItem(KEY):sessionStorage.setItem(KEY,String(n))}catch(e){}};
const onItem=()=>location.pathname==="/item.html";
const here=s=>s.page==="item"?onItem()&&!/sample-/.test(location.search):s.page.includes("?")?(location.pathname+location.search)===s.page:location.pathname===s.page||(s.page==="/"&&location.pathname==="/index.html");

// For the issue-page steps, open a real issue: the first one on Issues right now. If that can't load, use Issues.
async function realIssue(){try{const d=await (await fetch("/api/open")).json();const it=(d.items||[]).find(i=>i.level==="federal")||(d.items||[])[0];
  return it?"/item.html?id="+encodeURIComponent(it.id):null}catch(e){return null}}
async function go(n){
  if(n===null||n>=STEPS.length){set(null);close();return}
  set(n);const s=STEPS[n];
  if(here(s)){show(n);return}
  if(s.page==="item"){if(onItem()&&!/sample-/.test(location.search)){show(n);return}const u=await realIssue();if(u){location.href=u;return}set(n+1);return go(n+1)}
  location.href=s.page;
}

let box=null,lit=null;
function style(){if(document.getElementById("tour-css"))return;const st=document.createElement("style");st.id="tour-css";
  st.textContent=`#tour{position:fixed;left:12px;right:12px;bottom:12px;z-index:60;max-width:560px;margin:0 auto;background:var(--surface,#fff);color:var(--ink,#1d2420);border:2px solid var(--koa,#2f5d50);border-radius:12px;padding:14px 16px;box-shadow:0 8px 30px rgba(0,0,0,.25);font:inherit}
  #tour h2{font-size:1.05rem;margin:2px 0 6px}#tour p{margin:0 0 10px;font-size:.95rem;line-height:1.45}#tour .tmeta{font-size:.8rem;opacity:.8}
  #tour .tacts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#tour button{font:inherit;min-height:44px;padding:8px 14px;border-radius:8px;cursor:pointer;border:1px solid var(--muted,#5b6660);background:var(--bg,#fff);color:var(--ink,#1d2420)}
  #tour button.tnext{background:var(--koa,#2f5d50);border-color:var(--koa,#2f5d50);color:var(--surface,#fff)}#tour button.tend{margin-left:auto;border:0;background:none;text-decoration:underline}
  #tour h2:focus{outline:none}
  .tour-lit{outline:3px solid var(--sun,#c98a00)!important;outline-offset:4px;border-radius:6px;scroll-margin-top:16px}
  @media (max-width:700px){#tour{bottom:calc(72px + env(safe-area-inset-bottom));padding:10px 12px}#tour p{font-size:.88rem;margin-bottom:8px}#tour h2{font-size:.98rem}}
  @media (max-width:700px) and (max-height:500px){#tour{position:static;margin:12px}}`;
  document.head.appendChild(st)}
function close(){if(box){box.remove();box=null}if(lit){lit.classList.remove("tour-lit");lit=null}}
function show(n){
  style();close();const s=STEPS[n];
  box=document.createElement("section");box.id="tour";box.setAttribute("role","region");box.setAttribute("aria-label","Guided tour");
  box.innerHTML=`<span class="tmeta">Tour · ${n+1} of ${STEPS.length}</span><h2 tabindex="-1">${esc(s.h)}</h2><p>${esc(s.t)}</p>
    <div class="tacts">${n>0?`<button type="button" class="tback">Back</button>`:""}<button type="button" class="tnext">${n===STEPS.length-1?"Finish":"Next"}</button><button type="button" class="tend">End tour</button></div>`;
  document.body.appendChild(box);
  box.querySelector(".tnext").onclick=()=>go(n+1);
  const b=box.querySelector(".tback");if(b)b.onclick=()=>back(n-1);
  box.querySelector(".tend").onclick=()=>{set(null);close()};
  box.addEventListener("keydown",e=>{if(e.key==="Escape"){set(null);close()}});
  // Point at the part of the page the step is about, once it has drawn.
  let tries=0;const point=()=>{const t=document.querySelector(s.target);if(t){lit=t;t.classList.add("tour-lit");t.scrollIntoView({block:"start",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}else if(++tries<20)setTimeout(point,250)};
  point();
  box.querySelector("h2").focus({preventScroll:true});
}
// Back goes to the previous step's page; for issue-page steps, the issue you were already on is reused if you're there.
function back(n){set(n);const s=STEPS[n];if(here(s)){show(n);return}if(s.page==="item"){history.back();return}location.href=s.page}

// "Take the tour" links anywhere on the site start it.
function bindStarts(){document.querySelectorAll("[data-tour-start]").forEach(a=>a.addEventListener("click",e=>{e.preventDefault();go(0)}))}
function init(){bindStarts();const n=get();if(n===null)return;const s=STEPS[n];if(here(s))show(n);
  else if(s.page==="item"&&onItem())show(n)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
window.CA_TOUR={start:()=>go(0),STEPS};
})();
