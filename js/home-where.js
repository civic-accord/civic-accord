// Home: "Where do you live?" comes first, because everything on the site answers for the person's own governments.
// A state is enough to start. A full address finds the exact districts (through the Census Bureau, from the browser,
// never through Civic Accord's servers). Only the districts are kept, in this browser, in the same place every
// other page reads them.
(function(){
const DKEY="civicaccord-districts";
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const box=document.getElementById("where");if(!box)return;
const $=id=>document.getElementById(id);
let D=null;try{D=JSON.parse(localStorage.getItem(DKEY)||"null")}catch(e){}
const save=d=>{try{localStorage.setItem(DKEY,JSON.stringify(d))}catch(e){}};
// State names come from the open registry; Puerto Rico is added because registry/states.json covers the 50 states and DC.
let NAMES=null;
async function names(){
  if(NAMES)return NAMES;
  try{const r=await fetch("registry/states.json");const j=await r.json();NAMES={};Object.keys(j.states).forEach(k=>NAMES[k]=j.states[k].name)}catch(e){NAMES={}}
  if(!NAMES.PR)NAMES.PR="Puerto Rico";
  return NAMES;
}
function placeLine(d){
  const bits=[];
  if(d.cd)bits.push(d.cd==="at-large"?"at-large congressional district":"congressional district "+d.cd);
  if(d.county)bits.push(d.county);
  if(d.place)bits.push(d.place);else if(d.town)bits.push(d.town);
  return `${esc(d.stateName||d.state)}${bits.length?", "+esc(bits.join(", ")):""}`;
}
function known(){
  box.innerHTML=`<h2 id="where-h">Where you live</h2>
    <p class="big" style="margin:4px 0 8px">${placeLine(D)}${D.cd?"":" (state only; add your address to see your exact districts)"}. <a href="#" id="where-change" style="color:var(--koa)">Change</a></p>
    <p class="meta">Kept in this browser only. "Forget me on this device," at the bottom of the page, clears it.</p>`;
  $("where-change").onclick=e=>{e.preventDefault();ask(true)};
  document.dispatchEvent(new CustomEvent("ca-where",{detail:D}));
}
async function ask(changing){
  const N=await names();
  const opts=Object.keys(N).sort((a,b)=>N[a].localeCompare(N[b])).map(k=>`<option value="${k}"${D&&D.state===k?" selected":""}>${esc(N[k])}</option>`).join("");
  box.innerHTML=`<h2 id="where-h">Where do you live?</h2>
    <p class="meta">Everything here is about your own governments, so this comes first. Your state is enough to start.</p>
    <div class="row"><label for="where-st" class="meta">State or territory</label><select id="where-st"><option value="">Choose your state</option>${opts}</select><button class="btn" id="where-go" type="button">Show what's open</button></div>
    <details style="margin-top:10px"><summary style="cursor:pointer;color:var(--koa);font-weight:700;min-height:44px;display:flex;align-items:center">Add your address to see your exact districts and representatives</summary>
      <div class="row" style="margin-top:8px"><label for="where-addr" class="meta">Home address (street, city, state, ZIP)</label><input id="where-addr" type="text" autocomplete="street-address" placeholder="Street address, city, state, ZIP"><button class="btn" id="where-find" type="button">Find my districts</button></div>
      <p class="meta">Your browser sends the address straight to the U.S. Census Bureau to find your districts. It never reaches Civic Accord. Only the districts are kept, in this browser.</p></details>
    <span class="toast" id="where-msg" aria-live="polite"></span>
    ${changing?`<p><a href="#" id="where-keep" style="color:var(--koa)">Keep what I had</a></p>`:""}`;
  const st=$("where-st");
  $("where-go").onclick=()=>{const k=st.value;if(!k){$("where-msg").textContent="Choose your state first.";st.focus();return}
    D={state:k,stateName:N[k]};save(D);location.href="open.html"};
  st.onchange=()=>{const k=st.value;if(k){D={state:k,stateName:N[k]};save(D);document.dispatchEvent(new CustomEvent("ca-where",{detail:D}))}};
  const find=async()=>{const a=$("where-addr").value.trim();if(a.length<8){$("where-msg").textContent="Enter a full street address, including city and state.";return}
    if(!window.CA_REG){$("where-msg").textContent="The lookup didn't load. Try My representatives.";return}
    $("where-msg").textContent="Looking up your districts with the Census Bureau…";
    try{const g=await CA_REG.lookup(a);D=CA_REG.districtsOf(g);save(D);$("where-msg").textContent="";known()}
    catch(e){$("where-msg").textContent=e.message==="nomatch"?"The Census Bureau couldn't match that address. Check the spelling and include the city and state.":"Couldn't reach the Census Bureau. Try again in a moment, or choose your state above."}};
  $("where-find").onclick=find;$("where-addr").onkeydown=e=>{if(e.key==="Enter")find()};
  if(changing){$("where-keep").onclick=e=>{e.preventDefault();known()}}
}
if(D&&D.state)known();else ask(false);
})();
