/* Civic Accord open lookup: address -> districts -> offices.
   Districts come from the U.S. Census Bureau Geocoder, called straight from the browser (JSONP),
   so the address never passes through Civic Accord. Offices come from the open registry files in /registry. */
(function(){
const STATES={"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY","72":"PR","60":"AS","66":"GU","69":"MP","78":"VI"};
const TERR={DC:"District of Columbia",PR:"Puerto Rico",GU:"Guam",VI:"U.S. Virgin Islands",AS:"American Samoa",MP:"Northern Mariana Islands"};
const NO_COUNTY_GOV={CT:"Connecticut has no county governments. Its planning regions coordinate services but aren't elected governments.",RI:"Rhode Island has no county governments. Cities and towns provide local services."};
const CONSOLIDATED=["06075","08031","08014","42101","25019"];
const NYC_BOROUGHS=["36005","36047","36061","36081","36085"];
const pick=(g,re)=>{const k=Object.keys(g||{}).find(k=>re.test(k));return k&&g[k]&&g[k].length?g[k][0]:null};
const num=v=>{if(v==null)return null;const s=String(v).replace(/^0+/,"");return s===""?"0":s};
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
    place:place?{geoid:place.GEOID,name:place.BASENAME||place.NAME}:null,
    township:sub&&sub.FUNCSTAT==="A"?{geoid:sub.GEOID,name:sub.NAME}:null,
    school:sch?{geoid:sch.GEOID,name:sch.NAME}:null, secondary:sec?{geoid:sec.GEOID,name:sec.NAME}:null
  };
}
function lookup(address,timeoutMs){
  return new Promise((resolve,reject)=>{
    const cb="__caGeo"+Math.random().toString(36).slice(2);
    const s=document.createElement("script");
    const done=(fn,v)=>{clearTimeout(t);delete window[cb];s.remove();fn(v)};
    const t=setTimeout(()=>done(reject,new Error("timeout")),timeoutMs||12000);
    window[cb]=data=>{const m=data&&data.result&&data.result.addressMatches;
      if(!m||!m.length) return done(reject,new Error("nomatch"));
      done(resolve,normalize(m[0]))};
    s.onerror=()=>done(reject,new Error("network"));
    s.src="https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address="+encodeURIComponent(address)+
      "&benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=jsonp&callback="+cb;
    document.head.appendChild(s);
  });
}
const EXAMPLE={example:true,matched:"Example address in Haʻikū, Maui, HI 96708",state:"HI",stateFips:"15",stateName:"Hawaii",cd:"2",cdName:"Congressional District 2",
  sldu:"7",sldl:"13",county:{geoid:"15009",name:"Maui County"},place:null,township:null,school:{geoid:"1500030",name:"Hawaii Department of Education"},secondary:null};
const SAMPLES=[["Idaho","700 W Jefferson St, Boise, ID 83702"],["Ohio","90 W Broad St, Columbus, OH 43215"],["Texas","1100 Congress Ave, Austin, TX 78701"],["Pennsylvania","501 N 3rd St, Harrisburg, PA 17120"],["Minnesota","75 Rev Dr Martin Luther King Jr Blvd, St Paul, MN 55155"],["Hawaiʻi","415 S Beretania St, Honolulu, HI 96813"]];
let STATES_DATA;async function statesData(){if(STATES_DATA===undefined)STATES_DATA=await getJSON("registry/states.json");return STATES_DATA}
async function eligibility(geo){
  const us=await getJSON("registry/us.json"), reg=geo.state?await getJSON("registry/"+geo.state.toLowerCase()+".json"):null;
  if(reg&&reg.eligibility) return reg.eligibility;
  const e=JSON.parse(JSON.stringify(us.eligibilityDefault)), sd=await statesData(), x=sd&&sd.states&&sd.states[geo.state];
  if(x){ if(x.voterList&&x.voterList.publicFields){e.voterStatus.summary=`${x.name}: ${x.voterList.publicFields}${x.voterList.allowedUse?" Allowed uses: "+x.voterList.allowedUse:""}`;
      if(x.voterList.source)e.voterStatus.citations=[[x.voterList.source,`${x.name} voter list rules`]];}
    if(x.electionOffice)e.voterStatus.registerUrl=x.electionOffice;
    if(x.preregistrationAge)e.ageNote+=` ${x.name} lets people preregister to vote at ${x.preregistrationAge}.`; }
  return e;
}
async function getJSON(u){try{const r=await fetch(u);if(!r.ok)return null;return await r.json()}catch(e){return null}}
let CONG=null;
async function officeholders(geo){
  if(!geo||!geo.state) return {};
  if(!CONG){const j=await getJSON("/api/congress");CONG=j&&j.members&&j.members.length?j.members:null;
    if(!CONG){const raw=await getJSON("https://unitedstates.github.io/congress-legislators/legislators-current.json");
      CONG=raw?raw.map(p=>{const t=p.terms[p.terms.length-1];return {name:p.name.official_full||[p.name.first,p.name.last].join(" "),type:t.type,state:t.state,district:t.district,url:t.url||null,contact:t.contact_form||null,phone:t.phone||null}}):[]}}
  const out={rep:null,sen:[]};
  CONG.forEach(m=>{if(m.state!==geo.state)return;const who={name:m.name,url:m.url,phone:m.phone,contact:m.contact};
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
  if(geo.place&&!merged) local.push({id:"city",name:geo.place.name,branch:"Legislative and executive",seat:"City or town council and mayor",civic:"receives",pending:!covered});
  if(geo.township&&!geo.place) local.push({id:"town",name:geo.township.name,branch:"Legislative and executive",seat:"Town or township board",civic:"receives",pending:!covered});
  if(!(reg&&reg.noLocal)) levels.push({level:"City or town",offices:local,empty:local.length?null:merged?"Your city and county are one government, shown above.":"Your address isn't inside a city or town government, so the county provides local services."});
  else levels.push({level:"City or town",offices:[],empty:reg.localNote||reg.notes[0]});
  const sch=[];
  if(reg&&reg.school) sch.push(reg.school);
  else{ if(geo.school) sch.push({id:"sch",name:geo.school.name,branch:"Education",seat:"School board",civic:"receives",pending:true});
        if(geo.secondary) sch.push({id:"sch2",name:geo.secondary.name,branch:"Education",seat:"School board",civic:"receives",pending:true}); }
  levels.push({level:"School district",offices:sch,empty:sch.length?null:"No school district found for this address."});
  return {geo,levels,notes:reg?reg.notes:[],sources:[...(us?us.sources:[]),...(reg?reg.sources:[]),...(!reg&&sd&&sd.sources?sd.sources:[])],covered,special:"Special districts (water, fire, transit, and others) aren't in the Census lookup. Local hosts add them to the registry."};
}
const CIVIC={receives:["Receives proposals","common"],possible:["Could receive proposals","forming"],later:["Public comment, later","forming"],never:["Not part of Civic Accord","split"]};
function render(map,people,openPacks){
  const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const holder=o=>{if(!people)return"";if(o.id==="us-house"&&people.rep)return `<span class="meta">Current officeholder: ${people.rep.url?`<a href="${esc(people.rep.url)}" target="_blank" rel="noopener" style="color:var(--koa)">${esc(people.rep.name)}</a>`:esc(people.rep.name)}</span>`;
    if(o.id==="us-senate"&&people.sen&&people.sen.length)return `<span class="meta">Current officeholders: ${people.sen.map(p=>p.url?`<a href="${esc(p.url)}" target="_blank" rel="noopener" style="color:var(--koa)">${esc(p.name)}</a>`:esc(p.name)).join(", ")}</span>`;return""};
  return map.levels.map(l=>`<div class="lvl"><h3>${esc(l.level)}</h3>
    ${l.offices.length?l.offices.map(o=>{const c=CIVIC[o.civic]||CIVIC.later;const open=o.pack&&openPacks&&openPacks.includes(o.pack);
      return `<div class="gov"><div class="gtop"><b>${esc(o.name)}</b>${o.noTag?"":`<span class="tag ${open?"common":c[1]}">${open?"Deliberation open":esc(c[0])}</span>`}</div>
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
  const legislators=all.legislators.filter(p=>want.some(([c,n])=>(p.chamber===c||(one&&c==="legislature"))&&normD(p.district)===normD(n)));
  return {legislators,errors:all.errors||[]};
}
function districtsOf(g){return {state:g.state,stateName:g.stateLabel||g.stateName,cd:g.cd,sldl:g.sldl,sldu:g.sldu,county:g.county?g.county.name:null}}
window.CA_REG={lookup,normalize,EXAMPLE,SAMPLES,buildMap,officeholders,render,eligibility,stateLegislators,districtsOf};
})();
