// Home: a starting point, and a way back to what you follow. Uses only what's saved in this browser.
(function(){
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const box=document.getElementById("start");if(!box||!window.CA_RECORDS)return;
let D=null;try{D=JSON.parse(localStorage.getItem("civicaccord-districts")||"null")}catch(e){}
const f=CA_RECORDS.follows(), sent=CA_RECORDS.allSent();
if(!f.length&&!D)return; // keep the "Start here" steps
box.innerHTML=`<h2 id="start-h">Pick up where you left off</h2>
  ${f.length?`<p>You follow ${f.length} issue${f.length===1?"":"s"}${sent.length?` and have ${sent.length} record${sent.length===1?"":"s"} of what you sent`:""}.</p>
  <ul class="plain">${f.slice(0,3).map(x=>`<li><a href="item.html?id=${encodeURIComponent(x.issue.id)}" style="color:var(--koa)">${esc(x.issue.title||x.issue.id)}</a></li>`).join("")}</ul>
  <p><a class="btn" href="following.html" style="display:inline-flex;align-items:center;min-height:44px;text-decoration:none">See what changed in Following</a></p>`
  :`<p>You haven't followed any issues yet. Open one from <a href="open.html" style="color:var(--koa)">Issues</a> and choose "Follow this issue."</p>`}
  ${D&&D.state?`<p><a href="open.html" style="color:var(--koa)">Issues open for input${D.stateName?" in "+esc(D.stateName):""}</a> · <a href="governments.html" style="color:var(--koa)">Your representatives</a></p>`:`<p><a href="governments.html" style="color:var(--koa)">Find your representatives</a> so Issues can show what's from your own governments.</p>`}
  <p class="meta">Saved in this browser only. Changes are checked when you open Following, not in the background.</p>`;
})();
