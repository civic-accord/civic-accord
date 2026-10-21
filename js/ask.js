const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const SHARE_URL="https://civicaccord.org/ask.html";
const SHARE_TEXT="I asked my representatives for a public way to work with them, built so anyone can check the results. You can ask yours in two minutes: ";
function shareBar(el){
  const u=encodeURIComponent(SHARE_URL), t=encodeURIComponent(SHARE_TEXT);
  el.innerHTML=`${navigator.share?`<button type="button" id="sh-native">Share…</button>`:""}
   <button type="button" id="sh-copy">Copy link</button>
   <a href="mailto:?subject=${encodeURIComponent("Ask your representatives for this")}&body=${t}${u}">Email</a>
   <a href="sms:?&body=${t}${u}">Text</a>
   <a href="https://bsky.app/intent/compose?text=${t}${u}" target="_blank" rel="noopener">Bluesky</a>
   <a href="https://twitter.com/intent/tweet?text=${t}&url=${u}" target="_blank" rel="noopener">X</a>
   <a href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener">Facebook</a>
   <span class="toast" id="sh-msg" aria-live="polite"></span>`;
  const n=el.querySelector("#sh-native");if(n)n.onclick=()=>navigator.share({title:"Civic Accord",text:SHARE_TEXT,url:SHARE_URL}).catch(()=>{});
  el.querySelector("#sh-copy").onclick=()=>{const m=el.querySelector("#sh-msg");try{navigator.clipboard.writeText(SHARE_URL).then(()=>m.textContent="Link copied.",()=>m.textContent=SHARE_URL)}catch(e){m.textContent=SHARE_URL}};
}

shareBar($("share"));
let GEO=null, OFFICES=[];
const STANDARDS=["Only verified voters take part: one voter, one voice.","Votes are counted by simple code anyone can read and re-run. Each person gets a private receipt that shows their vote is included, designed so it can't reveal how they voted.","AI may summarize and draft, but never counts votes or decides anything.","Every summary links to the votes behind it, and disagreements are shown, not hidden.","Costs are shown with how they were estimated.","The office is asked to answer publicly, with its reasons."];
function letter(o,name,town,why){
  return `Dear ${o.salutation},

I'm a constituent${GEO&&o.districtText?` in ${o.districtText}`:""}. I'm writing to ask your office to offer residents a public way to talk through issues together and send you proposals. Anyone should be able to check the results, and your office would answer in public.
${why?"\n"+why+"\n":""}
An early example, using sample data, is at civicaccord.org. It isn't ready for real use yet, but it shows what's possible. It is nonpartisan, and anyone can read its code. Your office could adopt a tool like it, or any tool that meets these standards:
${STANDARDS.map(x=>"- "+x).join("\n")}

Would your office be willing to try a tool like this for hearing from constituents? I'm not asking you to support any bill, law, or spending. This is only about how your office hears from residents.

I started from a suggested message at civicaccord.org and made it my own.

Thank you for your time.

${name||"[Your name]"}${town?"\n"+town:""}`;
}
async function find(){
  const a=$("addr").value.trim();if(a.length<8){$("msg").textContent="Enter a full street address, including city and state.";return}
  $("msg").textContent="Looking up your districts with the Census Bureau…";
  try{GEO=await CA_REG.lookup(a)}catch(e){$("msg").textContent=e.message==="nomatch"?"The Census Bureau couldn't match that address. Check the spelling and include the city and state.":"Couldn't reach the Census Bureau's geocoder. Try again in a moment.";return}
  $("msg").textContent="";
  const map=await CA_REG.buildMap(GEO), people=await CA_REG.officeholders(GEO);
  let sd=null;try{sd=await (await fetch("registry/states.json")).json()}catch(e){}
  const sx=sd&&sd.states?sd.states[GEO.state]:null;
  OFFICES=[];
  if(people.rep) OFFICES.push({who:people.rep.name,title:`U.S. Representative, ${GEO.stateLabel} ${GEO.cd==="at-large"?"at large":"District "+GEO.cd}`,salutation:`Representative ${people.rep.name.split(" ").slice(-1)[0]}`,districtText:`${GEO.stateLabel}'s ${GEO.cd==="at-large"?"at-large":"District "+GEO.cd} congressional district`,url:people.rep.contact||people.rep.url,phone:people.rep.phone});
  (people.sen||[]).forEach(p=>OFFICES.push({who:p.name,title:`U.S. Senator for ${GEO.stateLabel}`,salutation:`Senator ${p.name.split(" ").slice(-1)[0]}`,districtText:GEO.stateLabel,url:p.contact||p.url,phone:p.phone}));
  const lvl=map.levels[1].offices.filter(o=>o.civic==="receives");
  let leg=null;try{leg=await CA_REG.stateLegislators(CA_REG.districtsOf(GEO))}catch(e){}
  const lastName=n=>String(n||"").trim().split(/\s+/).filter(x=>!/^(Jr\.?|Sr\.?|II|III|IV)$/i.test(x)).slice(-1)[0]||"";
  if(leg&&leg.legislators&&leg.legislators.length) leg.legislators.forEach(p=>OFFICES.push({who:p.name,title:`${GEO.stateLabel} ${p.title}, district ${p.district}`,salutation:`${p.title} ${lastName(p.name)}`,districtText:`${p.chamber==="upper"?"senate":"house"} district ${p.district}`,email:p.email,url:p.url,phone:p.phone,urlLabel:"Official page"}));
  else lvl.forEach(o=>OFFICES.push({who:null,title:`${o.name}, ${o.seat}`,salutation:/Council/.test(o.name)?"Councilmembers":o.id==="st-upper"?"Senator":"Representative",districtText:o.seat.replace(/^State /,"state ").replace(/^Legislative/,"legislative"),url:sx&&(sx.findLegislatorUrl||sx.legislatureUrl)||null,urlLabel:sx&&sx.findLegislatorUrl?"Find their contact page":"State legislature website"}));
  map.levels[2].offices.filter(o=>o.civic==="receives").forEach(o=>OFFICES.push({who:null,title:o.name,salutation:/ government$/.test(o.name)?o.name.replace(/ government$/," officials"):"members of the "+o.name,districtText:GEO.county?GEO.county.name:"",url:null,local:true}));
  map.levels[3].offices.filter(o=>o.civic==="receives").forEach(o=>OFFICES.push({who:null,title:`${o.name}: ${o.seat}`,salutation:`${o.name} officials`,districtText:o.name,url:null,local:true}));
  $("s2").hidden=false;
  $("s2").innerHTML=`<div><div class="eyebrow">Step 2</div><h2>Who represents you</h2></div>
   <p class="meta">${esc(GEO.matched)}</p>
   ${OFFICES.map((o,i)=>`<div class="off"><b>${esc(o.title)}</b>${o.who?`<span>${esc(o.who)}</span>`:""}
     <span class="meta">${o.url?"":o.local?"Contact details for local offices are still being added. Search for “"+esc(o.title.split(":")[0])+" contact” to find their page.":"Contact details for this office aren't in the registry yet."}</span></div>`).join("")}
   <p class="meta">Members of Congress come from the public-domain congress-legislators data. Districts come from the U.S. Census Bureau. Party is never shown.</p>`;
  $("s3").hidden=false;
  $("s3").innerHTML=`<div><div class="eyebrow">Step 3</div><h2>Your message</h2></div>
   <p>Edit anything you like. It's your message.</p>
   <label for="why" class="meta"><b>In your own words (recommended):</b> why would this help you or your community? One or two sentences.</label>
   <textarea id="why" rows="3" maxlength="600" placeholder="For example, a decision that affected your neighborhood, or a time you wished you could weigh in."></textarea>
   <p class="meta">Offices get many identical messages and often count them as one. A sentence in your own words makes yours count. The message also says it started from a suggestion here, so it's honest about where it came from.</p>
   <div class="two"><div class="addr2"><label for="nm" class="meta">Your name</label><input id="nm" autocomplete="name"></div><div class="addr2"><label for="tw" class="meta">Your town (optional)</label><input id="tw" autocomplete="address-level2"></div></div>
   <label for="lt" class="meta">Message</label><textarea class="letter" id="lt" rows="16"></textarea>
   <h3>Send it to each office</h3>
   <p class="meta">Where an office publishes an email address, the Email button opens your own email app with the message ready to send. Otherwise, copy the message and paste it into the office's contact page. Offices usually ask for your address so they can confirm you're a constituent.</p>
   ${OFFICES.map((o,i)=>`<div class="off"><b>${esc(o.title)}</b>${o.who?`<span class="meta">${esc(o.who)}</span>`:""}<div class="acts">
     ${o.email?`<a class="primary" href="#" data-mail="${i}">Email ${esc(o.salutation)}</a>`:""}
     <button type="button" class="${o.email?"":"primary"}" data-copy="${i}">Copy message</button>
     ${o.url?`<a href="${esc(o.url)}" target="_blank" rel="noopener" data-sent="${i}">${esc(o.urlLabel||"Open contact page")}</a>`:""}
     ${o.phone?`<a href="tel:${esc(o.phone.replace(/[^0-9+]/g,""))}">Call ${esc(o.phone)}</a>`:""}
     <span class="toast" id="cm-${i}" aria-live="polite"></span></div></div>`).join("")}
   <p class="meta">Civic Accord never sends anything for you and keeps no copy of your message. Offices may reply to you directly.</p>`;
    $("lt").value=letter({salutation:"[Office]",districtText:null},"","","");
  let edited=false;$("lt").oninput=()=>edited=true;
  const regen=()=>{if(!edited)$("lt").value=letter({salutation:"[Office]",districtText:null},$("nm").value.trim(),$("tw").value.trim(),$("why").value.trim())};
  $("nm").oninput=regen;$("tw").oninput=regen;$("why").oninput=regen;
  document.querySelectorAll("[data-copy]").forEach(b=>b.onclick=()=>{const o=OFFICES[+b.dataset.copy];
    const txt=$("lt").value.replace("Dear [Office],",`Dear ${o.salutation},`).replace("I'm a constituent.",o.districtText?`I'm a constituent in ${o.districtText}.`:"I'm a constituent.");
    const m=$("cm-"+b.dataset.copy);
    const fb=()=>{$("lt").value=txt;$("lt").select();m.textContent="Selected. Copy it with your keyboard."};
    try{navigator.clipboard.writeText(txt).then(()=>m.textContent="Copied, addressed to this office.",fb)}catch(e){fb()}});
  document.querySelectorAll("[data-mail]").forEach(a=>a.onclick=e=>{e.preventDefault();const o=OFFICES[+a.dataset.mail];
    const txt=$("lt").value.replace("Dear [Office],",`Dear ${o.salutation},`).replace("I'm a constituent.",o.districtText?`I'm a constituent in ${o.districtText}.`:"I'm a constituent.");
    location.href=`mailto:${encodeURIComponent(o.email)}?subject=${encodeURIComponent("A public, checkable way for constituents to work with your office")}&body=${encodeURIComponent(txt)}`});
  $("s2").scrollIntoView({behavior:"smooth"});
}
$("go").onclick=find;$("addr").onkeydown=e=>{if(e.key==="Enter")find()};
$("samples").innerHTML="No address handy? Try a state capitol: "+CA_REG.SAMPLES.map((a,i)=>`<a href="#" class="sample" data-i="${i}" style="color:var(--koa)">${esc(a[0])}</a>`).join(" · ");
document.querySelectorAll(".sample").forEach(x=>x.onclick=e=>{e.preventDefault();$("addr").value=CA_REG.SAMPLES[+x.dataset.i][1];find()});
