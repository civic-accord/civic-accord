const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let OPEN=[];
async function show(geo){
  const map=await CA_REG.buildMap(geo), people=await CA_REG.officeholders(geo);
  const o=$("out");o.hidden=false;
  o.innerHTML=`<div><div class="eyebrow">${geo.example?"Example address":"Matched address"}</div><h2>${esc(geo.matched)}</h2></div>
    <p class="meta">${[geo.cdName,geo.sldl?"State House district "+geo.sldl:"",geo.sldu?"State Senate district "+geo.sldu:"",geo.county?geo.county.name:""].filter(Boolean).map(esc).join(" · ")}</p>
    ${map.covered?"":`<p class="note">This state isn't in the open registry yet, so state and local offices show general descriptions. A local host can add the details.</p>`}
    ${map.notes.map(n=>`<p class="meta">${esc(n)}</p>`).join("")}
    ${CA_REG.render(map,people,OPEN)}
    <h3>Sources</h3><ul class="plain">${map.sources.map(s=>`<li><a href="${esc(s[0])}" target="_blank" rel="noopener" style="color:var(--koa)">${esc(s[1])}</a></li>`).join("")}</ul>`;
}
$("samples").innerHTML="No address handy? Try a state capitol: "+CA_REG.SAMPLES.map((a,i)=>`<a href="#" class="sample" data-i="${i}" style="color:var(--koa)">${esc(a[0])}</a>`).join(" · ");
document.querySelectorAll(".sample").forEach(x=>x.onclick=e=>{e.preventDefault();$("addr").value=CA_REG.SAMPLES[+x.dataset.i][1];$("go").click()});
$("go").onclick=async()=>{const a=$("addr").value.trim();if(a.length<8){$("msg").textContent="Enter a full street address, including city and state.";return}
  $("msg").textContent="Looking up your districts with the Census Bureau…";
  try{const g=await CA_REG.lookup(a);$("msg").textContent="";show(g)}
  catch(e){$("msg").textContent=e.message==="nomatch"?"The Census Bureau couldn't match that address. Check the spelling and include the city and state.":"Couldn't reach the Census Bureau's geocoder. Try again in a moment."}};
$("addr").onkeydown=e=>{if(e.key==="Enter")$("go").click()};
(async()=>{try{const idx=await (await fetch("packs/index.json")).json();OPEN=[...new Set(idx.packs.map(p=>p.jurisdiction))]}catch(e){}})();
