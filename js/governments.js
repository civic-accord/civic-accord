// My representatives: every office that represents an address, what each does, and how to reach it where we have
// that information. The address goes from the browser straight to the Census Bureau (lib/registry.js); only the
// districts and government names are kept in this browser, never the address itself.
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const safe=u=>/^https:\/\/[^\s"<>]+$/.test(String(u||""))?u:null;
const GKEY="civicaccord-geo", DKEY="civicaccord-districts";
// Coming from an issue page: offer a way back to it. Only an issue id is accepted, never anything personal.
const FROM=(()=>{const f=new URLSearchParams(location.search).get("from")||"";return /^[A-Za-z0-9._:\/-]{3,120}$/.test(f)?f:null})();
if(FROM){const b=$("back");b.hidden=false;b.innerHTML=`<a href="item.html?id=${encodeURIComponent(FROM)}" style="color:var(--koa)">← Back to the issue</a>`;}

function contacts(p){return [p.email?`<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`:"",safe(p.contact)?`<a href="${esc(p.contact)}" target="_blank" rel="noopener">Contact form</a>`:"",
  safe(p.url)?`<a href="${esc(p.url)}" target="_blank" rel="noopener">Official website</a>`:"",p.phone?`<a href="tel:${esc(String(p.phone).replace(/[^0-9+]/g,""))}">${esc(p.phone)}</a>`:""].filter(Boolean).join(" · ")}

async function show(geo,fromSaved){
  const map=await CA_REG.buildMap(geo), people=await CA_REG.officeholders(geo);
  const d=CA_REG.districtsOf(geo);
  let leg={legislators:[],errors:[]};try{leg=await CA_REG.stateLegislators(d)}catch(e){leg={legislators:[],errors:["Couldn't reach the legislator list."]}}
  const o=$("out");o.hidden=false;
  const houseTitle=geo.state==="PR"?"Resident Commissioner in the U.S. House":["DC","GU","VI","AS","MP"].includes(geo.state)?"Delegate to the U.S. House":"U.S. Representative";
  const cong=[people.rep&&{...people.rep,title:houseTitle},...(people.sen||[]).map(p=>({...p,title:"U.S. Senator"}))].filter(Boolean);
  // Nebraska's one-chamber legislature calls its members senators; D.C. has a council, not a state legislature.
  const legTitle=p=>geo.state==="DC"?"D.C. Council member":geo.state==="NE"?"State Senator":geo.state==="PR"?p.title:"State "+p.title;
  // One list: each office card carries its current officeholder(s) and contacts.
  const one=geo.state==="NE"||geo.state==="DC";
  const holders={};
  if(people.rep)holders["us-house"]=[{title:houseTitle,name:people.rep.name,contactsHtml:contacts(people.rep)}];
  if(people.sen&&people.sen.length)holders["us-senate"]=people.sen.map(p=>({title:"U.S. Senator",name:p.name,contactsHtml:contacts(p)}));
  leg.legislators.forEach(p=>{const key=one?"st-upper":(p.chamber==="lower"?"st-lower":"st-upper");(holders[key]=holders[key]||[]).push({title:`${legTitle(p)}${p.district?`, ${geo.state==="DC"?"":"district "}${p.district}`:""}`,name:p.name,contactsHtml:contacts(p)})});
  o.innerHTML=`<div><div class="eyebrow">${geo.example?"Example address":fromSaved?"Your saved districts":"Your districts"}</div>
      <h2>${esc([geo.stateName||geo.state,geo.cdName].filter(Boolean).join(" · "))}</h2>
      <p class="meta">${[geo.sldl?"State House district "+geo.sldl:"",geo.sldu?(geo.state==="DC"?(/ward/i.test(geo.sldu)?geo.sldu:"Ward "+geo.sldu):geo.state==="NE"?"Legislative district "+geo.sldu:"State Senate district "+geo.sldu):"",geo.county?geo.county.name:"",geo.place?geo.place.name:"",geo.township?geo.township.name:""].filter(Boolean).map(esc).join(" · ")}</p></div>

    <h3>Every government that represents you, and who holds the seats</h3>
    ${map.covered?"":`<p class="meta">We don't have full details for this state's state and local offices yet, so they show general descriptions.</p>`}
    ${map.notes.map(n=>`<p class="meta">${esc(n)}</p>`).join("")}
    ${leg.notConnected?`<p class="meta">This territory's legislature isn't in the open data Civic Accord uses yet, so its members aren't listed.</p>`:leg.errors.length?`<p class="meta">${esc(leg.errors.join(" "))}</p>`:""}
    ${CA_REG.render(map,people,holders)}
    <p class="meta">Members of Congress come from the public-domain congress-legislators data; state legislators from Open States, published nightly. Party is never shown. Local officeholders aren't listed yet; each government's own website lists its officials and meetings. To write about a specific issue, open it from <a href="open.html" style="color:var(--koa)">Issues</a>.</p>
    <h3>Sources</h3><ul class="plain">${map.sources.map(s=>`<li><a href="${esc(s[0])}" target="_blank" rel="noopener" style="color:var(--koa)">${esc(s[1])}</a></li>`).join("")}</ul>`;
}

function savedBar(){
  const s=$("saved");let g=null;try{g=JSON.parse(localStorage.getItem(GKEY)||"null")}catch(e){}
  if(!g||!g.state){let d=null;try{d=JSON.parse(localStorage.getItem(DKEY)||"null")}catch(e){}
    if(!(d&&d.state)){s.hidden=true;return null}
    // Districts saved from the home page or Issues, without the fuller record this page keeps: show what we can.
    s.hidden=false;s.innerHTML=`<p><b>Using what's saved on this device</b> (${esc(d.stateName||d.state)}${d.cd?`, ${d.cd==="at-large"?"at-large district":"congressional district "+esc(d.cd)}`:", state only"}). ${d.cd?"":"Enter your address once to see your exact districts and every government that represents you. "}Your address itself is never saved.</p>
      <div class="actions"><button type="button" class="btn ghost" id="change">${d.cd?"Use a different address":"Add my address"}</button></div>`;
    $("change").onclick=()=>{s.hidden=true;$("out").hidden=true;$("addr").focus()};
    return {partial:!d.cd,state:d.state,stateName:d.stateName,cd:d.cd||null,sldl:d.sldl||null,sldu:d.sldu||null,county:d.countyId?{geoid:d.countyId,name:d.county}:null,place:d.placeId?{geoid:d.placeId,name:d.place}:null,township:d.townId?{geoid:d.townId,name:d.town}:null,school:null,secondary:null};}
  s.hidden=false;s.innerHTML=`<p><b>Using your saved districts</b> (${esc(g.stateName||g.state)}${g.cd?`, ${g.cd==="at-large"?"at-large district":"congressional district "+esc(g.cd)}`:""}). Your address itself was never saved.</p>
    <div class="actions"><button type="button" class="btn ghost" id="change">Use a different address</button></div>`;
  $("change").onclick=()=>{s.hidden=true;$("out").hidden=true;$("addr").focus()};
  return g;
}

$("samples").innerHTML="No address handy? Try a capitol (results show the offices for that address, not your own): "+CA_REG.SAMPLES.map((a,i)=>`<a href="#" class="sample" data-i="${i}" style="color:var(--koa)">${esc(a[0])}</a>`).join(" · ");
document.querySelectorAll(".sample").forEach(x=>x.onclick=e=>{e.preventDefault();$("addr").value=CA_REG.SAMPLES[+x.dataset.i][1];$("go").dataset.example="1";$("go").click()});
$("go").onclick=async()=>{const a=$("addr").value.trim(),example=$("go").dataset.example==="1";delete $("go").dataset.example;
  if(a.length<8){$("msg").textContent="Enter a full street address, including city and state.";return}
  $("msg").textContent="Looking up your districts with the Census Bureau…";
  try{const g=await CA_REG.lookup(a);$("msg").textContent="";
    // Keep only the districts and government names, never the address, and never for an example address.
    if(!example){const keep={...g};delete keep.matched;try{localStorage.setItem(GKEY,JSON.stringify(keep));localStorage.setItem(DKEY,JSON.stringify(CA_REG.districtsOf(g)))}catch(e){}
      $("msg").textContent="Found your districts. They're saved in this browser; your address isn't."}
    if(example){$("saved").hidden=true;$("addr").value=""}else savedBar();
    await show(example?{...g,example:true}:g,false);$("out").scrollIntoView({behavior:"smooth",block:"start"})}
  catch(e){$("msg").textContent=e.message==="nomatch"?"The Census Bureau couldn't match that address. Check the spelling and include the city and state.":"Couldn't reach the Census Bureau's geocoder. Try again in a moment."}};
$("addr").onkeydown=e=>{if(e.key==="Enter")$("go").click()};
(()=>{const g=savedBar();if(g)show(g,true)})();
