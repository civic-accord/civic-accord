const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const STEPS=["Address","Your governments","Your voter record","Prove it's you","Enter code","Done"];
let step=0, geo=null, method="mail", code="", OPEN=[], vstatus=null, ELIG=null;
const rnd=n=>{let s="";const a=new Uint32Array(n);crypto.getRandomValues(a);a.forEach(x=>s+=x%10);return s};
const cred=()=>{const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",a=new Uint32Array(8);crypto.getRandomValues(a);return "CA-V-"+[...a].map(x=>c[x%c.length]).join("").replace(/(.{4})/,"$1-")};
function bar(){$("vsteps").innerHTML=STEPS.map((s,i)=>`<span class="${i===step?"on":i<step?"done":""}">${i+1}. ${s}</span>`).join("")}
async function render(){bar();const p=$("p");
 if(step===0){p.innerHTML=`<div><div class="eyebrow">Step 1</div><h2>Where do you live?</h2></div>
   <p>Your address finds your districts: congressional, state house and senate, county, and more. Use the address where you're registered to vote.</p>
   <div class="addr"><label for="addr" class="meta">Home address (street, city, state, ZIP)</label><input type="text" id="addr" autocomplete="street-address" placeholder="Street address, city, state, ZIP"></div>
   <p class="privacy">Your address goes from your browser straight to the U.S. Census Bureau to find your districts. Only your districts are kept.</p>
   <div class="grp"><h3>Who can take part</h3><p class="meta">Registered voters in the district. Everyone else can still read everything, see what's open for public input, comment through official channels, and write to their representatives. Not a voter yet? Try <a href="learn.html" style="color:var(--koa)">Civic Accord Learn</a>.</p></div>
   <div class="actions"><button class="btn" id="go" type="button">Find my districts</button></div>
   <p class="meta">No address handy? Try a capitol (results show the offices for that address, not your own): ${CA_REG.SAMPLES.map((a,i)=>`<a href="#" class="sample" data-i="${i}" style="color:var(--koa)">${esc(a[0])}</a>`).join(" · ")}</p>
   <span class="toast" id="msg" aria-live="polite"></span>`;
   document.querySelectorAll(".sample").forEach(x=>x.onclick=e=>{e.preventDefault();$("addr").value=CA_REG.SAMPLES[+x.dataset.i][1];$("go").click()});
   $("go").onclick=async()=>{const a=$("addr").value.trim();if(a.length<8){$("msg").textContent="Enter a full street address, including city and state.";return}
     $("msg").textContent="Looking up your districts with the Census Bureau…";
     try{geo=await CA_REG.lookup(a);step=1;render()}catch(e){$("msg").innerHTML=e.message==="nomatch"?"The Census Bureau couldn't match that address. Check the spelling and include the city and state.":`Couldn't reach the Census Bureau's geocoder. Try again, or <a href="#" id="ex" style="color:var(--koa)">continue with an offline example</a>.`;const ex=$("ex");if(ex)ex.onclick=ev=>{ev.preventDefault();geo=CA_REG.EXAMPLE;step=1;render()}}};
   return}
 if(step===1){p.innerHTML=`<div><div class="eyebrow">Step 2</div><h2>Every government that represents you</h2></div><p class="meta">Loading…</p>`;
   const map=await CA_REG.buildMap(geo), people=await CA_REG.officeholders(geo);
   p.innerHTML=`<div><div class="eyebrow">Step 2 · ${geo.example?"example address":"matched address"}</div><h2>Every government that represents you</h2></div>
   <p class="meta">${esc(geo.matched)}</p>
   ${map.notes.map(n=>`<p class="meta">${esc(n)}</p>`).join("")}
   ${CA_REG.render(map,people,OPEN)}
   <p>In the live version, once you're verified as a voter, your voice would count in every deliberation open for these governments.</p>
   <div class="actions"><button class="btn" id="yes" type="button">This is where I live</button><button class="btn ghost" id="back" type="button">Change address</button></div>`;
   $("yes").onclick=()=>{step=2;render()};$("back").onclick=()=>{step=0;ELIG=null;render()};return}
 if(step===2){
   if(!ELIG) ELIG=await CA_REG.eligibility(geo);
   const vs=ELIG.voterStatus, law=vs.basis==="law";
   p.innerHTML=`<div><div class="eyebrow">Step 3</div><h2>Find your voter record</h2></div>
   <p>First, we check that an active voter record exists for you in this district. Only registered voters can take part.</p>
   <div class="record"><div class="recrow${vs.verified?"":" silent"}"><b>${law?"What this state's law allows":"This state isn't in the registry yet"}</b><span>${esc(vs.summary)}</span>
     <span class="meta">${vs.verified?"✓ Checked by a reviewer":"! Not yet confirmed in this state's legal review"}${vs.citations.length?" · "+vs.citations.map(c=>`<a href="${esc(c[0])}" target="_blank" rel="noopener" style="color:var(--koa)">${esc(c[1])}</a>`).join(" · "):""}</span></div></div>
   ${vs.tiers?`<details><summary>How the match works</summary><div class="record" style="margin-top:8px">${vs.tiers.map(t=>`<div class="recrow"><b>${esc(t.name)} · ${esc(t.strength)}</b><span>${esc(t.how)}</span><span class="meta">Needs: ${esc(t.needs)}</span></div>`).join("")}</div></details>`:""}
   <div class="addr"><label for="vname" class="meta">Your name as it appears on your voter registration</label><input type="text" id="vname" autocomplete="name"></div>
   <p class="privacy">In the live version, your name is used once for the match, then deleted. Each voter record can be claimed by only one person. If someone else claimed yours, you'll be able to take it back, and their claim is cancelled.</p>
   <p class="meta">This sample makes no real match. Choose what the check would find:</p>
   <form id="vs" style="display:grid;gap:8px">${[["registered","Active registered voter in this district"],["not registered","No active voter record here"]].map((v,i)=>`<label class="choice"><input type="radio" name="vs" value="${v[0]}" ${i===0?"checked":""}><span><b>${esc(v[1])}</b></span></label>`).join("")}</form>
   <div id="notreg"></div>
   <div class="actions"><button class="btn" id="next" type="button">Continue</button><button class="btn ghost" id="back" type="button">Back</button></div>`;
   $("next").onclick=()=>{const v=document.querySelector("input[name=vs]:checked").value;
     if(v!=="registered"){$("notreg").innerHTML=`<div class="submitbox"><h3>Only registered voters can take part here</h3><p>You can still read every deliberation, see what's open for public input, comment through official channels, and write to your representatives. <a href="learn.html" style="color:var(--koa)">Civic Accord Learn</a> is built for people who aren't voters yet.</p><p><a class="btn" href="${esc(vs.registerUrl||"https://vote.gov/")}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-block">Register to vote</a></p><p class="meta">Once you're registered, come back and verify.</p></div>`;return}
     vstatus={status:"registered",how:"sample only; nothing was matched or checked"};step=3;render()};
   $("back").onclick=()=>{step=1;render()};return}
 if(step===3){p.innerHTML=`<div><div class="eyebrow">Step 4</div><h2>Prove you're that voter</h2></div>
   <p>Next, we confirm you're really the person on that record, so no one can claim someone else's.</p>
   <form id="m" class="choices" style="display:grid;gap:8px">
    <label class="choice"><input type="radio" name="m" value="mail" ${method==="mail"?"checked":""}><span><b>Mail a code to the address on my voter record</b><br><span class="meta">A sealed letter goes to the home address on your voter registration, not one you type, so receiving it shows you're that voter. It arrives in about 3 to 7 days.</span></span></label>
    <label class="choice"><input type="radio" name="m" value="library" ${method==="library"?"checked":""}><span><b>In person at a library or election office</b><br><span class="meta">Staff compare your ID with your voter record and give you a code. Nothing is copied. Good if mail is unreliable for you.</span></span></label>
    <label class="choice off"><input type="radio" name="m" value="official" disabled><span><b>Instant check with your state election office</b><br><span class="meta">Planned. You'd enter what your state already uses to confirm voters online, and the election office answers only yes or no. Needs an agreement with the election office.</span></span></label>
    <label class="choice off"><input type="radio" name="m" value="digital" disabled><span><b>State digital ID</b><br><span class="meta">Planned, only where state law provides a digital ID that can confirm your name and address.</span></span></label>
   </form>
   <div class="actions"><button class="btn" id="send" type="button">Continue</button><button class="btn ghost" id="back" type="button">Back</button></div>`;
   $("send").onclick=()=>{method=document.querySelector("input[name=m]:checked").value;code=rnd(6);step=4;render()};$("back").onclick=()=>{step=2;render()};return}
 if(step===4){p.innerHTML=`<div><div class="eyebrow">Step 5</div><h2>Enter your code</h2></div>
   <p>${method==="mail"?"In the live version, a sealed letter goes to the address on your voter record. The outside of the envelope doesn't mention voting. In this sample, here's what the code inside would look like:":"Staff give you a slip with your code. In this sample, here's what it would look like:"}</p>
   <div class="postcard"><span class="eyebrow">${method==="mail"?"Civic Accord · letter":"Civic Accord · library slip"}</span><span>Your voter verification code</span><span class="code">${code}</span><span class="meta">Expires in 30 days. Works once.</span>${method==="mail"?`<span class="meta">Didn't ask for this? Someone may be trying to claim your voter record. You don't need to do anything. Keep this code private. It works once, only for this voter record. The live letter will also say how to report it.</span>`:""}</div>
   <div class="addr"><label for="code" class="meta">6-digit code</label><input type="text" id="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div>
   <span class="toast" id="msg" aria-live="polite"></span>
   <div class="actions"><button class="btn" id="check" type="button">Verify</button><button class="btn ghost" id="back" type="button">Back</button></div>`;
   $("check").onclick=()=>{if($("code").value.trim()!==code){$("msg").textContent="That code doesn't match. Check it and try again.";return}
     const v={districts:{state:geo.state,stateName:geo.stateLabel||geo.stateName,cd:geo.cd,sldl:geo.sldl,sldu:geo.sldu,county:geo.county?geo.county.name:null,countyId:geo.county?geo.county.geoid:null,place:geo.place?geo.place.name:null,placeId:geo.place?geo.place.geoid:null,town:geo.township?(geo.township.label||geo.township.name):null,townId:geo.township?geo.township.geoid:null},voterStatus:vstatus.status,voterStatusHow:vstatus.how,method,date:new Date().toLocaleDateString("en-CA"),credential:cred(),example:!!geo.example};
     try{localStorage.setItem("civicaccord-verified",JSON.stringify(v))}catch(e){}
     window.__ver=v;step=5;render()};
   $("back").onclick=()=>{step=3;render()};return}
 const v=window.__ver||{};
 p.innerHTML=`<div class="submitbox"><h3>✓ Sample check complete</h3><p>In the live version, your voice would now count in deliberations for ${esc([geo.cdName,geo.sldl?"State House district "+geo.sldl:"",geo.sldu?"State Senate district "+geo.sldu:"",geo.county?geo.county.name:""].filter(Boolean).join(", "))}.</p>
   <p class="meta">Verification receipt</p><span class="receipt">${esc(v.credential)}</span>
   <p class="meta">Sample result: registered voter (${esc(v.voterStatusHow)}). You can now try voting in the sample deliberation.</p>
   <p class="meta">This is a sample receipt. Nothing was verified or sent anywhere. In the live version, it would prove you were verified, and say nothing about how you vote.</p></div>
   <h3>How privacy will be protected (planned)</h3>
   <div class="flow">
    <div><b>1. Voter check</b><span class="meta">Confirms an active voter record exists for you in these districts, that you're that voter, and that the record hasn't been claimed before. Keeps only your districts and a one-way fingerprint to stop duplicates. Your name and address are deleted. Your status is re-checked before each hand-off.</span></div>
    <div><b>2. Your sealed voting key</b><span class="meta">Issued to your device in a way the checker can't see, so even the host can't match the key to you. One key per person per district.</span></div>
    <div><b>3. The public vote record</b><span class="meta">Holds only sealed votes, never names, and is designed so votes can't be traced back to a voter. Anyone can check that a district's verified voters never outnumber its registered voters. Anyone can recount. Your receipt shows your sealed votes are included, without showing how you voted, and you can change your votes until the deliberation closes.</span></div>
   </div>
   <p class="meta">Voter status is checked again before each hand-off. What's kept, and for how long, follows each state's privacy law and is checked in that state's legal review.</p>
   <div class="actions"><a class="btn" href="app.html" style="text-decoration:none">Start taking part</a></div>`;
}
(async()=>{try{const idx=await (await fetch("packs/index.json")).json();OPEN=[...new Set(idx.packs.map(p=>p.jurisdiction))]}catch(e){}render()})();
