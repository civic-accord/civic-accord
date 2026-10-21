// Home: a welcome card the first time this browser opens the site. "Got it" hides it; "Forget me on this device"
// or index.html?tour=1 brings it back. Three plain lines, no overlay, no tracking.
(function(){
const box=document.getElementById("welcome");if(!box||!window.CA_SEEN)return;
const force=/[?&]tour=1\b/.test(location.search);
if(CA_SEEN.seen("welcome")&&!force)return;
box.innerHTML=`<h2 id="welcome-h">First time here? Three things to know</h2>
  <ol class="plain" style="margin:0;padding-left:1.4em;display:grid;gap:6px">
    <li><b>Tell us where you live.</b> Everything here is about your own governments: Congress, your state, your county and town. A state is enough to start.</li>
    <li><b>See what's open, and take one step at a time.</b> Issues lists what your governments are asking the public about right now, from official sources. Each item shows your next step: read it, say where you stand, speak up.</li>
    <li><b>You send it; we keep nothing.</b> Messages go from your own email or the office's own form. Follows and records stay in this browser. There's no account, and no one is tracked.</li>
  </ol>
  <div class="row" style="margin-top:4px"><button class="btn" id="welcome-ok" type="button">Got it</button><a href="how.html" style="color:var(--koa);min-height:44px;display:inline-flex;align-items:center">How it works, in full</a></div>`;
box.hidden=false;
document.getElementById("welcome-ok").onclick=()=>{CA_SEEN.mark("welcome");box.hidden=true;const w=document.getElementById("where");if(w)w.scrollIntoView({behavior:"smooth",block:"start"})};
})();
