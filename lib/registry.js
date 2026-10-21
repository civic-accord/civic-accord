/* Civic Accord open lookup: address -> districts -> offices.
   Districts come from the U.S. Census Bureau Geocoder, called from an isolated, sandboxed frame (geo-frame.html),
   so the address never passes through Civic Accord. Offices come from the open registry files in /registry. */
(function(){
const STATES={"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY","72":"PR","60":"AS","66":"GU","69":"MP","78":"VI"};
const TERR={DC:"District of Columbia",PR:"Puerto Rico",GU:"Guam",VI:"U.S. Virgin Islands",AS:"American Samoa",MP:"Northern Mariana Islands"};
const NO_COUNTY_GOV={CT:"Connecticut has no county governments. Its planning regions coordinate services but aren't elected governments.",RI:"Rhode Island has no county governments. Cities and towns provide local services."};
const CONSOLIDATED=["06075","08031","08014","42101","25019"];
const NYC_BOROUGHS=["36005","36047","36061","36081","36085"];
const pick=(g,re)=>{const k=Object.keys(g||{}).find(k=>re.test(k));return k&&g[k]&&g[k].length?g[k][0]:null};
const num=v=>{if(v==null)return null;const s=String(v).replace(/^0+/,"");return s===""?"0":s};
// Plain names and roles for local governments, from the Census "legal/statistical area" code (LSADC).
const LSAD={"25":["City of ","","City council and mayor"],"47":["Village of ","","Village board and mayor or president"],"21":["Borough of ","","Borough council and mayor"],
  "43":["Town of ","","Town government: a select board and town meeting, or a town council"],"44":[""," Township","Township board or committee"],
  "49":[""," Charter Township","Township board"]};
const govLabel=x=>{const l=LSAD[x.LSADC];return l?l[0]+(x.BASENAME||x.NAME)+l[1]:(x.NAME||x.BASENAME)};
// New England towns (CT, ME, MA, NH, RI, VT) usually have a select board and town meeting; towns elsewhere (for example, New York, Wisconsin) have a town board.
const NEW_ENGLAND=["09","23","25","33","44","50"];
// An incorporated town outside New England (for example, in North Carolina or Virginia) has a town council and mayor.
const govKind=(x,isPlace)=>{if(x.LSADC==="43"&&!NEW_ENGLAND.includes(String(x.STATE||"")))return isPlace?"Town council and mayor":"Town board";const l=LSAD[x.LSADC];return l?l[2]:"Local council"};
function normalize(match){
  const g=match.geographies||{};
  const st=pick(g,/^States$/), co=pick(g,/^Counties$/);
  const cd=pick(g,/Congressional Districts/), up=pick(g,/State Legislative Districts.*Upper/), lo=pick(g,/State Legislative Districts.*Lower/);
  const place=pick(g,/^Incorporated Places$/), sub=pick(g,/^County Subdivisions$/);
  const sch=pick(g,/Unified School Districts/)||pick(g,/Elementary School Districts/), sec=pick(g,/Secondary School Districts/);
  const cdKey=cd&&Object.keys(cd).find(k=>/^CD\d+$/.test(k));
  const fips=st?st.STATE:(co?co.STATE:null);
  return {
    matched:match.matchedAddress||"",
    state:STATES[fips]||null, stateFips:fips, stateName:st?st.NAME:null,
    cd:cd&&cdKey?(cd[cdKey]==="00"||/at Large/i.test(cd.NAME||"")?"at-large":num(cd[cdKey])):null, cdName:cd?cd.NAME:null,
    sldu:up?(up.BASENAME||num(up.SLDU)):null, sldl:lo?(lo.BASENAME||num(lo.SLDL)):null,
    county:co?{geoid:co.GEOID,name:co.NAME}:null,
    place:place?{geoid:place.GEOID,name:place.BASENAME||place.NAME,label:govLabel(place),kind:govKind(place,true)}:null,
    // A town or township is its own government only when the Census marks it active (A, or B: partly merged with another).
    // In many states it governs alongside a village inside it (for example, New York, Michigan, Ohio), so both are shown.
    // When it just repeats a city or borough (Census status F), it isn't shown twice.
    township:sub&&/^[AB]$/.test(sub.FUNCSTAT||"")?{geoid:sub.GEOID,name:sub.BASENAME||sub.NAME,label:govLabel(sub),kind:govKind(sub,false)}:null,
    school:sch?{geoid:sch.GEOID,name:sch.NAME}:null, secondary:sec?{geoid:sec.GEOID,name:sec.NAME}:null
  };
}
// The Census Bureau's lookup only works by loading its script, so it runs inside an isolated, sandboxed frame
// (geo-frame.html) that can't touch this page, its storage, or its cookies. The address goes from that frame
// straight to the Census Bureau; only the districts come back here. Nothing is sent to Civic Accord's servers.
let GEO=null;
function geoFrame(){
  if(GEO)return GEO;
  GEO=new Promise((resolve,reject)=>{
    const f=document.createElement("iframe");
    f.src="/geo-frame.html";f.setAttribute("sandbox","allow-scripts");f.setAttribute("aria-hidden","true");f.tabIndex=-1;f.title="Address lookup";
    f.style.cssText="position:absolute;width:0;height:0;border:0;visibility:hidden";
    const t=setTimeout(()=>{GEO=null;f.remove();reject(new Error("network"))},10000);
    const on=e=>{if(e.source===f.contentWindow&&e.data&&e.data.type==="ca-geo-ready"){clearTimeout(t);removeEventListener("message",on);resolve(f)}};
    addEventListener("message",on);
    document.body.appendChild(f);
  });
  return GEO;
}
async function lookup(address,timeoutMs){
  const f=await geoFrame();
  return new Promise((resolve,reject)=>{
    const id=Math.random().toString(36).slice(2,12);
    const done=(fn,v)=>{clearTimeout(t);removeEventListener("message",on);fn(v)};
    const t=setTimeout(()=>done(reject,new Error("timeout")),timeoutMs||14000);
    const on=e=>{const m=e.data;if(e.source!==f.contentWindow||!m||m.type!=="ca-geo-result"||m.id!==id)return;
      if(!m.ok)return done(reject,new Error(m.error==="nomatch"?"nomatch":"network"));
      done(resolve,normalize(m.match))};
    addEventListener("message",on);
    f.contentWindow.postMessage({type:"ca-geo-lookup",id,address:String(address)},"*");
  });
}
// Offline example: the Nebraska State Capitol (districts from the Census Bureau's lookup, October 2026). Nebraska's
// one-chamber legislature makes it a useful test.
const EXAMPLE={example:true,matched:"Example address: Nebraska State Capitol, 1445 K St, Lincoln, NE 68508",state:"NE",stateFips:"31",stateName:"Nebraska",cd:"1",cdName:"Congressional District 1",
  sldu:"28",sldl:null,county:{geoid:"31109",name:"Lancaster County"},place:null,township:null,school:{geoid:"3172840",name:"Lincoln Public Schools"},secondary:null};
const SAMPLES=[["California","1315 10th St, Sacramento, CA 95814"],["D.C.","1350 Pennsylvania Ave NW, Washington, DC 20004"],["Hawaiʻi","415 S Beretania St, Honolulu, HI 96813"],["Idaho","700 W Jefferson St, Boise, ID 83702"],["Nebraska","1445 K St, Lincoln, NE 68508"],["Ohio","90 W Broad St, Columbus, OH 43215"],["Texas","1100 Congress Ave, Austin, TX 78701"],["Vermont","115 State St, Montpelier, VT 05633"]];
let STATES_DATA;async function statesData(){if(STATES_DATA===undefined)STATES_DATA=await getJSON("registry/states.json");return STATES_DATA}
async function eligibility(geo){
  const us=await getJSON("registry/us.json"), reg=geo.state?await getJSON("registry/"+geo.state.toLowerCase()+".json"):null;
  if(reg&&reg.eligibility) return reg.eligibility;
  const e=JSON.parse(JSON.stringify(us.eligibilityDefault)), sd=await statesData(), x=sd&&sd.states&&sd.states[geo.state];
  if(x){ if(x.voterList&&x.voterList.publicFields){e.voterStatus.summary=`${x.name}: ${x.voterList.publicFields}${x.voterList.allowedUse?" Allowed uses: "+x.voterList.allowedUse:""}`;
      if(x.voterList.source)e.voterStatus.citations=[[x.voterList.source,`${x.name} voter list rules`]];}
    if(x.electionOffice)e.voterStatus.registerUrl=x.electionOffice; }
  return e;
}
async function getJSON(u){try{const r=await fetch(u);if(!r.ok)return null;return await r.json()}catch(e){return null}}
let CONG=null;
async function officeholders(geo){
  if(!geo||!geo.state) return {};
  if(!CONG){const j=await getJSON("/api/congress");CONG=j&&j.members&&j.members.length?j.members:null;
    if(!CONG){const raw=await getJSON("https://unitedstates.github.io/congress-legislators/legislators-current.json");
      CONG=raw?raw.map(p=>{const t=p.terms[p.terms.length-1];return {name:p.name.official_full||[p.name.first,p.name.last].join(" "),type:t.type,state:t.state,district:t.district,cls:t.class||null,url:/^https:\/\//.test(t.url||"")?t.url:null,contact:/^https:\/\//.test(t.contact_form||"")?t.contact_form:null,phone:t.phone||null}}):[]}}
  const out={rep:null,sen:[]};
  CONG.forEach(m=>{if(m.state!==geo.state)return;const who={name:m.name,url:m.url,phone:m.phone,contact:m.contact,cls:m.cls||null};
    if(m.type==="sen") out.sen.push(who);
    else if(m.type==="rep"&&(geo.cd==="at-large"?true:String(m.district)===String(geo.cd))) out.rep=who;});
  return out;
}
const fill=(s,geo)=>String(s||"").replace("{state}",geo.stateLabel).replace("{cd}",geo.cd==="at-large"?"(at large)":"District "+geo.cd).replace("{sldl}",geo.sldl||"?").replace("{sldu}",geo.sldu||"?");
async function buildMap(geo){
  const us=await getJSON("registry/us.json"), reg=geo.state?await getJSON("registry/"+geo.state.toLowerCase()+".json"):null;
  const sd=await statesData(), sx=sd&&sd.states&&geo.state?sd.states[geo.state]:null;
  geo.stateLabel=reg?reg.stateName:(sx?sx.name:(geo.stateName||geo.state||"your state"));
  const levels=[], covered=!!reg;
  let fed=(us?us.federal:[]).map(o=>({...o,seat:fill(o.seat,geo)}));
  if(TERR[geo.state]){const t=TERR[geo.state];fed=fed.filter(o=>o.id!=="us-senate").map(o=>o.id==="us-house"?{...o,seat:`${geo.state==="PR"?"Resident Commissioner":"Delegate"} for ${t}, a non-voting member who can vote in committees but not on final passage of bills`,chosen:"Elected"+(geo.state==="DC"?" citywide":" territory-wide")}:o);
    fed.push({id:"us-nosen",name:"U.S. Senate",branch:"Legislative",seat:`${t} has no U.S. senators.`,civic:"never",noTag:true})}
  levels.push({level:"Federal",offices:fed});
  let base=reg&&reg.state_offices?reg.state_offices:(us?JSON.parse(JSON.stringify(us.stateDefaults)):[]);
  if(!reg&&sx){base.forEach(o=>{if(o.id==="st-lower"){if(sx.lower){o.name=`${sx.name} ${sx.lower.name}`;o.term=sx.lower.term}else o.drop=true}
    if(o.id==="st-upper"&&sx.upper){o.name=`${sx.name} ${sx.upper.name}`;o.term=sx.upper.term;if(!sx.lower)o.seat="Legislative district {sldu}"}});base=base.filter(o=>!o.drop);
    base.forEach(o=>{if(o.civic==="receives")o.pack=geo.state.toLowerCase()+"-state"})}
  const stOff=base.map(o=>({...o,seat:fill(o.seat,geo)})).filter(o=>!(o.id==="st-lower"&&!geo.sldl)&&!(o.id==="st-upper"&&!geo.sldu));

  levels.push({level:(geo.state==="DC"?"District":TERR[geo.state]?"Territory":"State")+" · "+geo.stateLabel,offices:stOff});
  let county=[], countyEmpty=null, merged=false;
  const cid=geo.county&&geo.county.geoid, cname=geo.county?geo.county.name:"";
  if(geo.county){
    if(reg&&reg.counties&&reg.counties[cid]) county=reg.counties[cid];
    else if(reg&&reg.countyOffices) county=reg.countyOffices.map(o=>({...o,name:o.name.replace("{county}",cname.replace(/ Municipio$/,""))}));
    else if(NO_COUNTY_GOV[geo.state]) countyEmpty=NO_COUNTY_GOV[geo.state];
    else if(NYC_BOROUGHS.includes(cid)) countyEmpty=`${cname} is one of New York City's five boroughs. It has no separate county government; the city government serves it.`;
    else if(/ city$/.test(cname)||/City and Borough|Municipality|City and County/.test(cname)||CONSOLIDATED.includes(cid)){merged=true;
      county=[{id:"co-gen",name:cname.replace(/ city$/," (independent city)")+" government",branch:"Legislative and executive",seat:"City and county are one government: one council and one mayor or manager",civic:"receives",pending:!covered}]}
    else county=[{id:"co-gen",name:cname+" government",branch:"Legislative and executive",seat:"County board or commission",civic:"receives",pending:true}];
  }
  if(reg&&reg.noCounty){countyEmpty=reg.notes[0];county=[]}
  levels.push({level:(reg&&reg.countyLabel?reg.countyLabel:"County")+" · "+(cname||"unknown"),offices:county,empty:countyEmpty});
  if(!reg&&sx&&sx.localNote&&!countyEmpty) county.push({id:"co-note",name:"How local government works here",branch:"Note",seat:sx.localNote,civic:"possible",noTag:true});
  const local=[];
  if(geo.place&&!merged) local.push({id:"city",name:geo.place.label||geo.place.name,branch:"Legislative and executive",seat:geo.place.kind||"City or town council and mayor",civic:"receives",pending:!covered});
  // New York City's boroughs are county subdivisions too, but they have no council of their own; the city government is shown above.
  if(geo.township&&!NYC_BOROUGHS.includes(cid)&&!(geo.place&&geo.place.geoid&&geo.township.geoid&&(geo.place.label||geo.place.name)===(geo.township.label||geo.township.name)))
    local.push({id:"town",name:geo.township.label||geo.township.name,branch:"Legislative and executive",seat:(geo.township.kind||"Town or township board")+(geo.place&&!merged?". This address is also inside the "+(geo.place.label||geo.place.name)+". Each has its own elected officials; what each one handles depends on state law.":""),civic:"receives",pending:!covered});
  if(!(reg&&reg.noLocal)) levels.push({level:"City or town",offices:local,empty:local.length?null:merged?"Your city and county are one government, shown above.":"Your address isn't inside a city or town government, so the county provides local services."});
  else levels.push({level:"City or town",offices:[],empty:reg.localNote||reg.notes[0]});
  const sch=[];
  if(reg&&reg.school) sch.push(reg.school);
  else{ if(geo.school) sch.push({id:"sch",name:geo.school.name,branch:"Education",seat:"School board",civic:"receives",pending:true});
        if(geo.secondary) sch.push({id:"sch2",name:geo.secondary.name,branch:"Education",seat:"School board",civic:"receives",pending:true}); }
  levels.push({level:"School district",offices:sch,empty:sch.length?null:"No school district found for this address."});
  return {geo,levels,notes:reg?reg.notes:[],sources:[...(us?us.sources:[]),...(reg?reg.sources:[]),...(!reg&&sd&&sd.sources?sd.sources:[])],covered,special:"Special districts (water, fire, transit, and others) aren't in the Census lookup. Local hosts add them to the registry."};
}
// No office has joined Civic Accord yet, so labels say what could happen, not what does.
const CIVIC={receives:["Could receive proposals (no office has joined yet)","common"],possible:["Maybe later","forming"],later:["Public comment, later","forming"],never:["Not part of Civic Accord","split"]};
function render(map,people,openPacks){
  const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const holder=o=>{if(!people)return"";if(o.id==="us-house"&&people.rep)return `<span class="meta">Current officeholder: ${people.rep.url?`<a href="${esc(people.rep.url)}" target="_blank" rel="noopener" style="color:var(--koa)">${esc(people.rep.name)}</a>`:esc(people.rep.name)}</span>`;
    if(o.id==="us-senate"&&people.sen&&people.sen.length)return `<span class="meta">Current officeholders: ${people.sen.map(p=>p.url?`<a href="${esc(p.url)}" target="_blank" rel="noopener" style="color:var(--koa)">${esc(p.name)}</a>`:esc(p.name)).join(", ")}</span>`;return""};
  return map.levels.map(l=>`<div class="lvl"><h3>${esc(l.level)}</h3>
    ${l.offices.length?l.offices.map(o=>{const c=CIVIC[o.civic]||CIVIC.later;const open=o.pack&&openPacks&&openPacks.includes(o.pack);
      return `<div class="gov"><div class="gtop"><b>${esc(o.name)}</b>${o.noTag?"":`<span class="tag ${open?"common":c[1]}">${open?"Sample deliberation":esc(c[0])}</span>`}</div>
        <span>${esc(o.seat)}${o.term?` · ${esc(o.term)}`:""}</span>
        <span class="meta">${esc(o.branch)}${o.chosen?` · ${esc(o.chosen)}`:""}${o.pending?" · Details not yet in the registry":""}</span>
        ${holder(o)}${o.note?`<span class="meta">${esc(o.note)}</span>`:""}${o.exampleNote&&map.geo.example?`<span class="meta">${esc(o.exampleNote)}</span>`:""}${o.how?`<span class="meta">${esc(o.how)}</span>`:""}</div>`}).join("")
      :`<p class="meta">${esc(l.empty||"None")}</p>`}</div>`).join("")+
    `<p class="meta">${esc(map.special)}</p>`;
}
const LEG_CACHE={};
const normD=x=>String(x||"").toLowerCase().replace(/^0+(?=\d)/,"").replace(/^(district|ward)\s+/,"").replace(/\s+/g," ").trim();
async function stateLegislators(d){
  if(!d||!d.state||(!d.sldl&&!d.sldu))return {legislators:[],errors:[]};
  // Fetch the whole state's list and filter here, so no district or address is ever sent.
  const all=LEG_CACHE[d.state]||(LEG_CACHE[d.state]=await getJSON("/api/people?state="+encodeURIComponent(d.state)));
  if(!all)return {legislators:[],errors:["Couldn't reach the legislator list."]};
  const one=d.state==="NE"||d.state==="DC";
  const want=[["lower",d.sldl],[one?"legislature":"upper",d.sldu]].filter(x=>x[1]);
  // Exact district match; where a state splits a district into seats (Idaho "19A" and "19B"), match those seats too.
  const same=(os,cen)=>{const a=normD(os),b=normD(cen);return a===b||(/^\d+$/.test(b)&&new RegExp("^"+b+"[a-z]$").test(a))};
  const legislators=all.legislators.filter(p=>want.some(([c,n])=>(p.chamber===c||(one&&c==="legislature"))&&same(p.district,n)));
  return {legislators,errors:all.errors||[]};
}
function districtsOf(g){return {state:g.state,stateName:g.stateLabel||g.stateName,cd:g.cd,sldl:g.sldl,sldu:g.sldu,county:g.county?g.county.name:null,countyId:g.county?g.county.geoid:null,place:g.place?g.place.name:null,placeId:g.place?g.place.geoid:null,town:g.township?(g.township.label||g.township.name):null,townId:g.township?g.township.geoid:null}}
window.CA_REG={lookup,normalize,EXAMPLE,SAMPLES,buildMap,officeholders,render,eligibility,stateLegislators,districtsOf};
})();
