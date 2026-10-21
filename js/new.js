const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const $=id=>document.getElementById(id);
const KEY="civicaccord-builder";
let templates={}, B=null;
const GMAP={"g-name":"name","g-level":"level","g-title":"title","g-district":"district","g-session":"session","g-drafting":"drafting","g-res":"res","g-reslabel":"reslabel","g-popurl":"popurl","g-base":"base","g-baselabel":"baselabel","g-fund":"fund","g-pe":"pe","g-pebasis":"pebasis","g-pecand":"pecand","g-pedays":"pedays","g-pefrom":"pefrom","g-peto":"peto","g-prim":"prim","g-gen":"gen","g-peurl":"peurl","g-pesum":"pesum","g-lr":"lr"};
const isDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||"");
const empty=()=>({gov:"",custom:{name:"",level:"city",title:"",district:"",session:"",drafting:"",res:"",reslabel:"",popurl:"",base:"",baselabel:"",fund:"",pe:"",pebasis:"law",pecand:"",pedays:"",pefrom:"",peto:"",prim:"",gen:"",peurl:"",pesum:"",lr:""},
  name:"",title:"",facts:[{label:"",text:"",url:""}],stmts:["","","",""],costs:[],revs:[]});
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(B))}catch(e){}};
const slug=s=>String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40)||"issue";
const isUrl=u=>/^https:\/\/\S+\.\S+/.test(u||"");
const LOADED=/\b(obviously|clearly|disastrous|outrageous|so-called|radical|extremist|common sense|everyone knows)\b|!/i;

function buildPack(){
  const t=templates[B.gov]; let j, bill;
  const nm=B.name.trim()||"Issue";
  if(t){j=JSON.parse(JSON.stringify(t.jurisdiction)); bill=JSON.parse(JSON.stringify(t.bill));
    if(j.level==="federal"){bill.centerLines=["H. R. ____","IN THE HOUSE OF REPRESENTATIVES","A BILL",`To address ${nm.toLowerCase()}, and for other purposes.`];
      bill.preamble=["Be it enacted by the Senate and House of Representatives of the United States of America in Congress assembled,",`SECTION 1.  SHORT TITLE.\n     This Act may be cited as the "${nm} Act of 2027".`,"SEC. 2.  ACTIONS.\n     The appropriate Federal agencies shall:"];}
    else {bill.centerLines=[bill.centerLines[0],`RELATING TO ${nm.toUpperCase()}.`,bill.centerLines[bill.centerLines.length-1]];
      bill.preamble=[`SECTION 1.  The legislature finds that residents have identified ${nm.toLowerCase()} as a priority, and that residents with differing views share common ground on the measures in this Act.`,"SECTION 2.  The appropriate state agencies shall:"];}
  } else {const c=B.custom;
    j={key:slug(c.name)||"custom",name:c.name,level:c.level,district:c.district,session:c.session,drafting:`AI organizes and drafts. People decide. ${c.drafting||"Staff"} write final text for any ${c.title||"representative"} who takes it up.`,
      residents:+c.res||0,residentLabel:c.reslabel||"resident",residentNote:`${(+c.res||0).toLocaleString()} residents`,populationSource:{url:c.popurl,label:"Population source"},
      baseline:{amount:+c.base||0,label:c.baselabel||"current spending"},generalFundName:c.fund||"the general fund",generalFundTradeoff:`${c.fund||"the general fund"}, where it competes with everything else the government pays for`,
      representativeTitle:c.title||"representative",handoffTitle:"Hand off to your representatives",handoffText:`The package goes to the ${c.title||"representative"} for this district. They decide whether to take it up. The public record stays open either way.`,
      timing:c.session||"",receiptPrefix:(c.name.match(/\b[A-Za-z]/g)||["X","X"]).slice(0,2).join("").toUpperCase(),
      elections:[c.prim&&{name:"Primary election",date:c.prim},c.gen&&{name:"General election",date:c.gen}].filter(Boolean),
      legalReview:{layer:"jurisdiction",status:"needed",reviewer:c.lr||null,suggested:"A local law school clinic or bar pro bono program",scope:["Each seat's pre-election communication rule","Election dates"],cadence:"Before launch and at the start of each election cycle"},
      offices:[{key:slug(c.name)+"-seat",title:`${c.name} seat`,where:c.district,holder:"Current officeholder",term:"",onBallot:true,
        preElection:c.pe?{basis:c.pe==="none"?"none":c.pebasis,summary:c.pesum||(c.pe==="none"?"No law or rule limits official mass communications before elections.":""),
          window:c.pe==="days"?{type:"daysBefore",days:+c.pedays}:c.pe==="range"?{type:"range",from:c.pefrom,to:c.peto,fromLabel:c.pefrom,toLabel:c.peto}:undefined,
          onlyIfCandidate:!!c.pecand,citations:isUrl(c.peurl)?[{url:c.peurl,label:"Source"}]:[],verified:false,note:"Entered by the pack author. A reviewer confirms it against the source."}:null}]};
    bill={centerLines:[`A PROPOSAL TO THE ${c.name.toUpperCase()}`,`RELATING TO ${nm.toUpperCase()}.`],preamble:[`SECTION 1.  Residents with differing views share common ground on the measures below.`,"SECTION 2.  The appropriate departments shall:"],sectionWord:"SECTION",firstSection:3,appropriation:{style:"authorization",text:"FUNDING.\n     There is authorized {amount} to carry out these measures."},effective:"This measure takes effect upon adoption."};
  }
  const stmts=B.stmts.map((x,i)=>({id:i+1,text:x.trim(),a:[0,0,0],b:[0,0,0]})).filter(x=>x.text);
  return {id:`${j.key}-${slug(nm)}`,format:1,jurisdiction:j,
    issue:{key:slug(nm),name:nm,title:B.title.trim()||nm,
      facts:B.facts.filter(f=>f.label||f.text).map(f=>[f.label.trim(),f.text.trim()]),lists:[],
      sources:B.facts.filter(f=>isUrl(f.url)).map(f=>[f.url.trim(),f.label.trim()||f.url.trim()]),
      costSources:B.costs.filter(c=>isUrl(c.url)).map(c=>[c.url.trim(),c.name.trim()]),
      exampleVotes:false,statements:stmts,
      costOptions:B.costs.map(c=>{const min=+c.min||0,max=Math.max(+c.max||0,+c.def||1),fixed=!c.unit;
        return {statement:+c.stmt,name:c.name.trim(),unit:c.unit.trim(),min:fixed?1:min,max:fixed?1:max,step:+c.step||1,default:fixed?1:(+c.def||1),unitCost:+c.cost||0,recurring:!!c.yr,impact:c.impact.trim()||c.name.trim(),basis:c.basis.trim(),billText:(c.bill.trim()||c.name.trim()).replace(/[.;]\s*$/,"")}}),
      revenue:B.revs.map(r=>r.type==="fixed"?{statement:+r.stmt,type:"fixed",name:r.name.trim(),amount:+r.amount||0,note:r.note.trim(),billText:r.bill.trim()||r.name.trim()}:{statement:+r.stmt,type:"unestimated",name:`${r.name.trim()} (not yet estimated)`,note:r.note.trim()})},
    bill,copyTitle:`${nm}, ${j.name}`};
}
function checks(){
  const c=[], t=templates[B.gov], cu=B.custom;
  const add=(state,txt)=>c.push([state,txt]);
  if(t) add("ok",`Government: ${t.jurisdiction.name}`);
  else if(B.gov==="custom"){const okc=cu.name&&cu.district&&+cu.res>0&&cu.title;add(okc?"ok":"no",okc?`Government: ${cu.name}`:"Fill in the government's name, district, population, and representative title");
    add(isUrl(cu.popurl)?"ok":"no",isUrl(cu.popurl)?"Population has a source":"Add an https link for the population figure");
    const pe=cu.pe;
    if(!pe) add("no","Research this government's rules on official communications before elections");
    else{const okw=pe==="none"||(pe==="days"&&+cu.pedays>0&&(isDate(cu.prim)||isDate(cu.gen)))||(pe==="range"&&isDate(cu.pefrom)&&isDate(cu.peto));
      add(okw?"ok":"no",okw?"Pre-election rule entered":pe==="days"?"Add the number of days and at least one election date (YYYY-MM-DD)":"Add the start and end dates (YYYY-MM-DD)");
      add(isUrl(cu.peurl)?"ok":"no",isUrl(cu.peurl)?"Pre-election rule has a source":"Add an https link to the law or rule (or to where it says none exists)");}
    add(cu.lr&&cu.lr.trim()?"ok":"warn",cu.lr&&cu.lr.trim()?`Legal reviewer: ${cu.lr.trim()}`:"Name a legal reviewer for this government before launch");}
  else add("no","Choose a government");
  add(B.name.trim()&&B.title.trim()?"ok":"no",B.name.trim()&&B.title.trim()?"Issue named":"Give the issue a short name and a title");
  const facts=B.facts.filter(f=>f.label||f.text);
  add(facts.length>=2?"ok":"no",`${facts.length} shared fact${facts.length===1?"":"s"} (at least 2)`);
  const nosrc=facts.filter(f=>!isUrl(f.url)).length;
  add(nosrc?"no":"ok",nosrc?`${nosrc} fact${nosrc===1?" needs":"s need"} an https source link`:"Every fact has a source");
  const st=B.stmts.map(x=>x.trim()).filter(Boolean);
  add(st.length>=4?"ok":"no",`${st.length} statements (at least 4)`);
  const bad=st.filter(x=>x.length<15||x.length>200).length;
  if(bad) add("no",`${bad} statement${bad===1?" is":"s are"} too short or too long (15 to 200 characters)`);
  const loaded=st.filter(x=>LOADED.test(x)).length;
  add(loaded?"warn":"ok",loaded?`${loaded} statement${loaded===1?" uses":"s use"} loaded wording. Rewrite so both sides can vote honestly`:"Wording reads as neutral");
  B.costs.forEach((k,i)=>{const n=k.name.trim()||`Cost option ${i+1}`;
    if(!k.stmt) add("no",`${n}: link it to a statement`);
    if(!(+k.cost>0)) add("no",`${n}: add a unit cost`);
    if((k.basis||"").trim().length<20) add("no",`${n}: explain how the cost was estimated`);});
  if(B.costs.length) add(B.costs.every(k=>k.stmt&&+k.cost>0&&(k.basis||"").trim().length>=20)?"ok":"warn","Every cost is linked, priced, and explained");
  else add("warn","No costs yet. Add them for any statement that would cost money");
  B.revs.forEach((r,i)=>{if(!r.stmt||!r.name.trim()||!r.note.trim()||(r.type==="fixed"&&!(+r.amount>0))) add("no",`Revenue ${i+1}: needs a statement, name, note${r.type==="fixed"?", and amount":""}`)});
  add("warn","Two reviewers must check the pack, and it must be open to public objection for 7 days, before it goes live");
  return c;
}
function renderChecks(){const c=checks();$("checks").innerHTML=c.map(([s,t])=>`<div class="ck ${s}"><span class="i">${s==="ok"?"✓":s==="no"?"✗":"!"}</span><span>${esc(t)}</span></div>`).join("");
  const ready=!c.some(x=>x[0]==="no");$("preview").disabled=false;$("download").textContent=ready?"Download pack file":"Download draft (not ready for review)";}
const stmtOptions=sel=>`<option value="">Choose a statement</option>`+B.stmts.map((x,i)=>x.trim()?`<option value="${i+1}" ${+sel===i+1?"selected":""}>${i+1}. ${esc(x.trim().slice(0,70))}</option>`:"").join("");
function renderLists(){
  $("facts").innerHTML=B.facts.map((f,i)=>`<div class="item"><button class="rm" data-rm="facts" data-i="${i}" type="button">Remove</button>
    <div class="grid3"><div class="frow"><label for="f-l-${i}">Label</label><input type="text" id="f-l-${i}" data-l="facts" data-i="${i}" data-k="label" value="${esc(f.label)}" placeholder="Current funding"></div>
    <div class="frow" style="grid-column:span 2"><label for="f-u-${i}">Source (https link)</label><input type="text" id="f-u-${i}" data-l="facts" data-i="${i}" data-k="url" value="${esc(f.url)}" placeholder="https://"></div></div>
    <div class="frow"><label for="f-t-${i}">Fact</label><textarea id="f-t-${i}" rows="2" data-l="facts" data-i="${i}" data-k="text">${esc(f.text)}</textarea></div></div>`).join("");
  $("stmts").innerHTML=B.stmts.map((x,i)=>`<div class="item"><button class="rm" data-rm="stmts" data-i="${i}" type="button">Remove</button><div class="frow"><label for="s-${i}">Statement ${i+1}</label><textarea id="s-${i}" rows="2" maxlength="200" data-l="stmts" data-i="${i}">${esc(x)}</textarea></div></div>`).join("");
  $("costs").innerHTML=B.costs.map((c,i)=>`<div class="item"><button class="rm" data-rm="costs" data-i="${i}" type="button">Remove</button>
    <div class="frow"><label for="c-s-${i}">Prices statement</label><select id="c-s-${i}" data-l="costs" data-i="${i}" data-k="stmt">${stmtOptions(c.stmt)}</select></div>
    <div class="grid3"><div class="frow"><label for="c-n-${i}">Name</label><input type="text" id="c-n-${i}" data-l="costs" data-i="${i}" data-k="name" value="${esc(c.name)}" placeholder="More bus drivers"></div>
    <div class="frow"><label for="c-u-${i}">Unit (blank for a single item)</label><input type="text" id="c-u-${i}" data-l="costs" data-i="${i}" data-k="unit" value="${esc(c.unit)}" placeholder="drivers"></div>
    <div class="frow"><label for="c-c-${i}">Cost per unit ($)</label><input type="number" id="c-c-${i}" min="0" data-l="costs" data-i="${i}" data-k="cost" value="${esc(c.cost)}"></div></div>
    <div class="grid3"><div class="frow"><label for="c-d-${i}">Starting amount</label><input type="number" id="c-d-${i}" min="0" data-l="costs" data-i="${i}" data-k="def" value="${esc(c.def)}"></div>
    <div class="frow"><label for="c-x-${i}">Most allowed</label><input type="number" id="c-x-${i}" min="0" data-l="costs" data-i="${i}" data-k="max" value="${esc(c.max)}"></div>
    <div class="frow"><label for="c-y-${i}">Repeats every year?</label><select id="c-y-${i}" data-l="costs" data-i="${i}" data-k="yr"><option value="1" ${c.yr?"selected":""}>Yes, yearly</option><option value="" ${c.yr?"":"selected"}>No, one time</option></select></div></div>
    <div class="frow"><label for="c-b-${i}">How this cost was estimated</label><textarea id="c-b-${i}" rows="2" data-l="costs" data-i="${i}" data-k="basis" placeholder="About $78,000 per driver for wages and benefits, from the transit agency's FY26 budget.">${esc(c.basis)}</textarea></div>
    <div class="frow"><label for="c-r-${i}">Source for the estimate (https link, optional)</label><input type="text" id="c-r-${i}" data-l="costs" data-i="${i}" data-k="url" value="${esc(c.url)}" placeholder="https://"></div>
    <div class="frow"><label for="c-i-${i}">What it buys (use {n} for the amount chosen)</label><input type="text" id="c-i-${i}" data-l="costs" data-i="${i}" data-k="impact" value="${esc(c.impact)}" placeholder="{n} more drivers, enough for 15-minute service on two routes."></div>
    <div class="frow"><label for="c-t-${i}">Bill clause (use {n} or {dollars})</label><input type="text" id="c-t-${i}" data-l="costs" data-i="${i}" data-k="bill" value="${esc(c.bill)}" placeholder="hire {n} additional bus operators"></div></div>`).join("");
  $("revs").innerHTML=B.revs.map((r,i)=>`<div class="item"><button class="rm" data-rm="revs" data-i="${i}" type="button">Remove</button>
    <div class="grid3"><div class="frow"><label for="r-s-${i}">Tied to statement</label><select id="r-s-${i}" data-l="revs" data-i="${i}" data-k="stmt">${stmtOptions(r.stmt)}</select></div>
    <div class="frow"><label for="r-t-${i}">Type</label><select id="r-t-${i}" data-l="revs" data-i="${i}" data-k="type"><option value="fixed" ${r.type==="fixed"?"selected":""}>Fixed yearly amount</option><option value="unestimated" ${r.type!=="fixed"?"selected":""}>Not yet estimated</option></select></div>
    <div class="frow"><label for="r-a-${i}">Yearly amount ($)</label><input type="number" id="r-a-${i}" min="0" data-l="revs" data-i="${i}" data-k="amount" value="${esc(r.amount)}" ${r.type==="fixed"?"":"disabled"}></div></div>
    <div class="frow"><label for="r-n-${i}">Name</label><input type="text" id="r-n-${i}" data-l="revs" data-i="${i}" data-k="name" value="${esc(r.name)}" placeholder="Raise parking fines downtown"></div>
    <div class="frow"><label for="r-o-${i}">Note on the estimate</label><input type="text" id="r-o-${i}" data-l="revs" data-i="${i}" data-k="note" value="${esc(r.note)}"></div></div>`).join("");
}
function renderGov(){
  const g=$("gov");g.innerHTML=`<option value="">Choose a government</option>`+Object.keys(templates).map(k=>`<option value="${esc(k)}" ${B.gov===k?"selected":""}>${esc(templates[k].jurisdiction.name)}</option>`).join("")+`<option value="custom" ${B.gov==="custom"?"selected":""}>Another government (enter details)</option>`;
  $("govcustom").hidden=B.gov!=="custom";
  const map=GMAP;
  B.custom=Object.assign(empty().custom,B.custom);Object.entries(map).forEach(([id,k])=>{$(id).value=B.custom[k]??""});
  $("i-name").value=B.name;$("i-title").value=B.title;
}
function renderAll(){renderGov();renderLists();renderChecks()}
document.addEventListener("input",e=>{const t=e.target;
  if(t.dataset.l){const arr=B[t.dataset.l],i=+t.dataset.i; if(t.dataset.l==="stmts") arr[i]=t.value; else arr[i][t.dataset.k]=t.value;
    if(t.dataset.k==="type"){renderLists()} if(t.dataset.l==="stmts"){/* refresh statement pickers without stealing focus */document.querySelectorAll('select[data-k="stmt"]').forEach(s=>{const it=B[s.dataset.l][+s.dataset.i];s.innerHTML=stmtOptions(it.stmt)})}}
  else if(t.id.startsWith("g-")){const map=GMAP;B.custom[map[t.id]]=t.value}
  else if(t.id==="i-name") B.name=t.value; else if(t.id==="i-title") B.title=t.value;
  save();renderChecks();});
document.addEventListener("change",e=>{const t=e.target; if(t.id&&t.id.startsWith("g-")&&GMAP[t.id]){B.custom=Object.assign(empty().custom,B.custom);B.custom[GMAP[t.id]]=t.value;save();renderChecks();return} if(t.id==="gov"){B.gov=t.value;save();renderAll()} else if(t.dataset.k==="yr"){B[t.dataset.l][+t.dataset.i].yr=!!t.value;save()} else if(t.dataset.k==="type"||t.dataset.k==="stmt"){B[t.dataset.l][+t.dataset.i][t.dataset.k]=t.value;save();if(t.dataset.k==="type")renderLists();renderChecks()}});
document.addEventListener("click",e=>{const t=e.target; if(t.dataset.rm){B[t.dataset.rm].splice(+t.dataset.i,1);save();renderLists();renderChecks()}});
$("addfact").onclick=()=>{B.facts.push({label:"",text:"",url:""});save();renderLists();renderChecks()};
$("addstmt").onclick=()=>{if(B.stmts.length>=15)return;B.stmts.push("");save();renderLists();renderChecks()};
$("addcost").onclick=()=>{B.costs.push({stmt:"",name:"",unit:"",cost:"",def:"1",max:"",yr:true,basis:"",url:"",impact:"",bill:""});save();renderLists();renderChecks()};
$("addrev").onclick=()=>{B.revs.push({stmt:"",type:"fixed",name:"",amount:"",note:"",bill:""});save();renderLists();renderChecks()};
$("clear").onclick=()=>{B=empty();save();renderAll();$("amsg").textContent="Cleared."};
$("example").onclick=()=>{const t=templates["hi-state"];if(!t)return;const is=t.issue;
  B={gov:"hi-state",custom:empty().custom,name:is.name,title:is.title,
    facts:is.facts.map((f,i)=>({label:f[0],text:f[1],url:(is.sources[i]||is.sources[0]||[""])[0]})),
    stmts:is.statements.map(s=>s.text),
    costs:is.costOptions.map(c=>({stmt:String(c.statement),name:c.name,unit:c.unit==="million dollars"?"":c.unit,cost:String(c.unit==="million dollars"?c.unitCost*c.default:c.unitCost),def:String(c.unit==="million dollars"?1:c.default),max:String(c.unit==="million dollars"?1:c.max),yr:c.recurring,basis:c.basis,url:"",impact:c.impact.replace("{total}","this"),bill:c.billText.replace("{dollars}","$"+(c.unitCost*c.default).toLocaleString())})),
    revs:is.revenue.filter(r=>r.type!=="fee").map(r=>({stmt:String(r.statement),type:r.type==="fixed"?"fixed":"unestimated",name:r.name,amount:String(r.amount||""),note:r.note,bill:r.billText||""}))};
  save();renderAll();$("amsg").textContent="Loaded the Hawaiʻi example. Edit anything.";window.scrollTo({top:0})};
$("preview").onclick=()=>{try{localStorage.setItem("civicaccord-draft",JSON.stringify(buildPack()));location.href="app.html?preview=draft"}catch(e){$("amsg").textContent="Preview needs browser storage, which is blocked here. Try another browser."}};
$("download").onclick=()=>{const p=buildPack();const blob=new Blob([JSON.stringify(p,null,1)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${p.id}.json`;document.body.appendChild(a);a.click();a.remove();$("amsg").textContent=`Downloaded ${p.id}.json.`};
$("copy").onclick=()=>{const txt=JSON.stringify(buildPack(),null,1);const fb=()=>{const ta=$("copytext");ta.hidden=false;ta.value=txt;ta.select();$("amsg").textContent="Select and copy the text below."};try{navigator.clipboard.writeText(txt).then(()=>$("amsg").textContent="Copied.",fb)}catch(e){fb()}};
(async()=>{
  try{const raw=localStorage.getItem(KEY);B=raw?JSON.parse(raw):empty()}catch(e){B=empty()}
  try{const idx=await (await fetch("packs/index.json")).json();for(const e of idx.packs){const d=await (await fetch(e.file)).json();if(!templates[d.jurisdiction.key])templates[d.jurisdiction.key]=d}}catch(e){}
  const qp=new URLSearchParams(location.search);
  if(qp.get("title")){const t=qp.get("title").slice(0,140),u=qp.get("url")||"",src=qp.get("from")||"official source";
    // A draft already in progress is kept as the previous draft, so following a link never loses someone's work.
    const had=JSON.stringify(B)!==JSON.stringify(empty());
    if(had){try{localStorage.setItem(KEY+"-previous",JSON.stringify(B))}catch(e){}}
    B=empty();B.title=t;B.name=t.replace(/^[A-Z.]+\s*\d+:\s*/,"").split(/[;:,(]/)[0].slice(0,60);
    B.facts=[{label:"What's open",text:`${t} (from the ${src}).`,url:/^https:\/\//.test(u)?u:""},{label:"",text:"",url:""}];save();
    if(had){const m=$("amsg");if(m){m.innerHTML='Started a new draft for this item. Your earlier draft is kept. <button type="button" id="restoreprev" style="background:none;border:0;padding:0;min-height:44px;font:inherit;color:var(--koa);text-decoration:underline;cursor:pointer">Go back to it</button>';
      $("restoreprev").onclick=()=>{try{const p=JSON.parse(localStorage.getItem(KEY+"-previous")||"null");if(p){B=p;save();renderAll();m.textContent="Your earlier draft is back."}}catch(e){}}}}}
  renderAll();
})();
