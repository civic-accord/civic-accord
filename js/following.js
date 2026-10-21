// Following: compares what you last saw of each issue with the latest official data, when you open this page.
// Everything stays in this browser (lib/records.js). A failed check is never treated as "no change".
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const when=iso=>{const x=new Date(iso);return isNaN(x)?"an unknown date":x.toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short"})};
const RESULTS={changed:"Changed since you last looked","no-change":"No recorded change","not-refreshed":"No newer data from the source yet",unavailable:"Couldn't check right now","no-baseline":"First check"};
let CHECKS={};

async function fetchItem(id){
  if(id.startsWith("sample-"))return {sample:true};
  try{const r=await fetch("/api/item?id="+encodeURIComponent(id));const d=await r.json();return d&&d.item?{item:d.item,at:d.fetchedAt}:{error:(d&&d.errors&&d.errors[0])||"The source didn't answer."}}
  catch(e){return {error:"Couldn't reach Civic Accord. Check your connection."}}
}

function draw(){
  const list=CA_RECORDS.follows(), sent=CA_RECORDS.allSent();
  $("rec-sum").textContent=`${list.length} issue${list.length===1?"":"s"} followed · ${sent.length} record${sent.length===1?"":"s"} of what you sent, all reported by you.`;
  if(!list.length){$("main").innerHTML=`<p>You aren't following any issues yet. Open any issue from <a href="open.html" style="color:var(--koa)">Open Now</a> and choose "Follow this issue."</p>`;return}
  const order=f=>{const c=CHECKS[f.issue.id];if(!c)return 3;if(c.cmp&&c.cmp.result==="changed")return 0;if(c.cmp&&c.cmp.soon.length)return 1;return 2};
  const rows=list.slice().sort((a,b)=>order(a)-order(b));
  const done=rows.filter(f=>CHECKS[f.issue.id]).length;
  $("main").innerHTML=`${done<rows.length?`<p class="meta" role="status">Checking ${done} of ${rows.length}…</p>`:""}
  <ul class="fl">${rows.map(f=>{const id=f.issue.id,c=CHECKS[id],r=c&&c.cmp?c.cmp.result:c&&c.sample?"sample":c?"unavailable":null,n=sent.filter(s=>s.issue.id===id).length;
    return `<li class="${r==="changed"?"changed":""}"><h2><a href="item.html?id=${encodeURIComponent(id)}">${esc(f.issue.title||id)}</a></h2>
      <span class="meta">${esc(f.issue.kind||"")}${f.baseline?` · You last looked ${esc(when(f.baseline.seenAt))}`:""}${n?` · ${n} record${n===1?"":"s"} of what you sent`:""}</span>
      ${!c?`<span class="meta">Checking…</span>`:r==="sample"?`<span class="meta">Sample issue. Nothing to check.</span>`
        :r==="unavailable"?`<span class="res unavailable">${RESULTS.unavailable}</span><span class="meta">${esc(c.error||"")} Nothing was compared, and what you last saw is kept.</span>`
        :`<span class="res ${r}">${RESULTS[r]||""}</span>
          ${r==="changed"?`<ul class="plain">${c.cmp.changes.map(x=>`<li>${esc(x.text)} <span class="meta">${esc(x.why)}</span></li>`).join("")}</ul>`:""}
          ${r==="no-change"?`<span class="meta">Compared with official data fetched ${esc(when(c.at))}.</span>`:""}
          ${r==="not-refreshed"?`<span class="meta">The source's data (fetched ${esc(when(c.at))}) isn't newer than what you last saw, so there's nothing new to compare yet. This is not the same as "no change."</span>`:""}
          ${c.cmp.soon.length?`<p><b>Coming up:</b> ${c.cmp.soon.map(x=>esc(x.text)).join("; ")}.</p>`:""}`}
      <div class="acts">${r==="changed"||r==="no-baseline"?`<button type="button" class="btn ghost" data-seen="${esc(id)}">Mark as seen</button>`:""}<button type="button" class="btn ghost" data-unf="${esc(id)}">Stop following</button></div></li>`}).join("")}</ul>
  ${done===rows.length?`<p class="end">You're up to date. That's everything you follow.</p>`:""}`;
  document.querySelectorAll("[data-seen]").forEach(b=>b.onclick=()=>{const c=CHECKS[b.dataset.seen];if(c&&c.item){CA_RECORDS.setBaseline(b.dataset.seen,CA_ISSUE.snapshot(c.item,c.at),c.item.title);c.cmp={result:"no-change",changes:[],soon:c.cmp.soon};c.seenNow=true}draw();
    const h=$("main").querySelector("h2");if(h)h.focus()});
  document.querySelectorAll("[data-unf]").forEach(b=>b.onclick=()=>{CA_RECORDS.unfollow(b.dataset.unf);delete CHECKS[b.dataset.unf];draw();$("rec-msg").textContent="Stopped following that issue."});
}

async function checkAll(){
  const ids=CA_RECORDS.follows().map(f=>f.issue.id);let i=0;
  const worker=async()=>{while(i<ids.length){const id=ids[i++];const r=await fetchItem(id);
    const f=CA_RECORDS.follows().find(x=>x.issue.id===id);
    if(r.item)CHECKS[id]={item:r.item,at:r.at,cmp:CA_ISSUE.compare(f&&f.baseline,r.item,r.at,new Date())};
    else CHECKS[id]=r.sample?{sample:true}:{error:r.error};
    draw()}};
  await Promise.all([worker(),worker(),worker()]);
}

function records(){
  $("export").onclick=()=>{
    if(!confirm("The file may contain private messages you wrote and your views on public issues. Keep it somewhere safe, and share it only if you choose to. Export now?"))return;
    const data=CA_RECORDS.exportData(),blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");
    a.href=URL.createObjectURL(blob);a.download=`civic-accord-records-${CA_DATES.today()}.json`;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);$("rec-msg").textContent="Exported. The file is in your downloads."};
  $("import").onchange=e=>{const file=e.target.files&&e.target.files[0];if(!file)return;const rd=new FileReader();
    rd.onload=()=>{try{const r=CA_RECORDS.importData(String(rd.result));
      $("rec-msg").textContent=`Imported ${r.follows} followed issue${r.follows===1?"":"s"} and ${r.sent} record${r.sent===1?"":"s"}. ${r.kept?`Kept what was already here for ${r.kept} other setting${r.kept===1?"":"s"}.`:""}`;checkAll()}
      catch(x){$("rec-msg").textContent=x.message}e.target.value=""};
    rd.onerror=()=>{$("rec-msg").textContent="Couldn't read that file."};rd.readAsText(file)};
  $("clearall").onclick=()=>{if(!confirm("Delete every issue you follow and every record of what you sent, from this browser? This can't be undone unless you have an exported copy."))return;
    try{localStorage.removeItem(CA_RECORDS.KEY)}catch(e){}CHECKS={};draw();$("rec-msg").textContent="Deleted all follows and records from this browser."};
}

$("storage").textContent=CA_RECORDS.available()?"":"This browser isn't saving data right now (it may be a private window). Follows and records won't be kept.";
records();draw();checkAll();
