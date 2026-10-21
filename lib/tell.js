/* Writing to the offices that represent you, and keeping a record of what you say you sent.
   Shared by Open Now and the issue page. Messages leave from the person's own email app or an office's own contact
   form; Civic Accord never sends them, and no request to Civic Accord's servers carries them. A record is saved only when the person confirms what they sent, and it
   is always labeled as reported by them (lib/records.js). */
(function(){
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const O=()=>window.CA_OFFICES, R=()=>window.CA_RECORDS, D=()=>window.CA_DATES;
const last=n=>String(n||"").trim().split(/\s+/).filter(x=>!/^(Jr\.?|Sr\.?|II|III|IV)$/i.test(x)).slice(-1)[0]||"";

// The offices that represent this person for this item, each with its seat's stable name.
function recipients(it,DIST,FED,STATELEG){
  const out=[];if(!DIST)return out;
  if(it.level==="federal"){
    const ht=DIST.state==="PR"?"Resident Commissioner":["DC","GU","VI","AS","MP"].includes(DIST.state)?"Delegate":"U.S. Representative";
    if(FED&&FED.rep)out.push({officeId:O().house(DIST.state,DIST.cd),name:FED.rep.name,title:`${ht}${DIST.cd?`, ${DIST.state} ${DIST.cd==="at-large"?"at large":"district "+DIST.cd}`:""}`,sal:`${ht==="U.S. Representative"?"Representative":ht} ${last(FED.rep.name)}`,url:FED.rep.contact||FED.rep.url,phone:FED.rep.phone});
    (FED&&FED.sen||[]).forEach(p=>out.push({officeId:O().senate(DIST.state,p.cls),name:p.name,title:`U.S. Senator for ${DIST.stateName||DIST.state}`,sal:`Senator ${last(p.name)}`,url:p.contact||p.url,phone:p.phone}));
  }else if(it.level==="state"&&STATELEG){
    // Nebraska's one-chamber legislature calls its members senators; D.C. has a council.
    const tt=p=>DIST.state==="NE"?"Senator":DIST.state==="DC"?"Councilmember":p.title;
    STATELEG.legislators.forEach(p=>out.push({officeId:O().stateSeat(DIST.state,p.chamber||"lower",p.district),name:p.name,title:`${tt(p)}, ${DIST.state==="DC"?"":"district "}${p.district}`,sal:`${tt(p)} ${last(p.name)}`,email:p.email,url:p.url,phone:p.phone}));
  }
  return out;
}

// The suggested message. stance: "Support", "Oppose", or anything else (undecided).
function message(it,sal,o){
  o=o||{};const v=o.stance,c=o.comment||"",S=o.signer||{},DIST=o.dist;
  const said=v==="Support"?"I support it, and I'd like you to support it too.":v==="Oppose"?"I oppose it, and I'd like you to oppose it too.":"I haven't decided yet. I'd like to know where you stand, and why.";
  const d=DIST?` in ${DIST.stateName||DIST.state}${it.level==="federal"&&DIST.cd?`'s ${DIST.cd==="at-large"?"at-large":"district "+DIST.cd}`:it.level==="state"&&DIST.sldl?`, state house district ${DIST.sldl}`:""}`:"";
  const subject=`${v==="Support"?"Please support":v==="Oppose"?"Please oppose":"Question about"}: ${it.title}`.slice(0,180);
  const link=it.read||(it.links&&(it.links.official||it.links.text))||"";
  const body=`Dear ${sal},\n\nI'm a constituent${d}. I'm writing about ${it.title}.\n\n${said}${c.trim()?"\n\n"+c.trim():""}\n\nOfficial text: ${link}\n\nThank you,\n${S.name||"[Your name]"}${S.town?"\n"+S.town:""}`;
  return {subject,body};
}

// "Record what you sent": one box per office, with the suggested message filled in so the person can make it match
// what they really sent. Nothing is saved until they choose Save. pending: [{officeId,name,title,channel,text}].
// manual: an office to offer when nothing is pending (for example, the agency for an official comment).
function recordPanel(uid,pending,manual){
  const rows=(pending&&pending.length?pending:manual?[manual]:[]);
  const today=D().today();
  return `<div class="record" id="${uid}" role="group" aria-labelledby="${uid}-h">
    <b id="${uid}-h">Keep a record of what you sent</b>
    <p class="meta">Saved only in this browser. It's marked "reported by you": Civic Accord didn't deliver it and can't confirm it was received. Edit the text so it matches what you really sent.</p>
    ${rows.length?rows.map((r,i)=>`<fieldset class="recrow"><legend><label><input type="checkbox" data-rec="${i}" checked> ${esc(r.title||r.name)}${r.name&&r.title&&r.name!==r.title?` <span class="meta">(${esc(r.name)})</span>`:""}</label></legend>
      <label class="meta" for="${uid}-m${i}">What you sent${r.channel==="official-comment"?" (optional: paste your comment)":""}</label>
      <textarea id="${uid}-m${i}" rows="5" maxlength="8000">${esc(r.text||"")}</textarea></fieldset>`).join(""):`<p class="meta">Choose an office to write to first.</p>`}
    ${rows.length?`<label class="meta" for="${uid}-d">Date you sent it</label> <input type="date" id="${uid}-d" value="${today}" max="${today}">
    <div class="acts"><button type="button" class="btn" data-recsave="1">Save this record</button><button type="button" class="btn ghost" data-recskip="1">Don't keep a record</button></div>`:""}
    <span class="toast" id="${uid}-msg" role="status" aria-live="polite"></span></div>`;
}
// Wire up a panel. issue: {id,title,version}. onDone(savedCount) is called after Save or Don't keep.
function bindPanel(uid,issue,pending,manual,onDone){
  const box=document.getElementById(uid);if(!box)return;
  const rows=(pending&&pending.length?pending:manual?[manual]:[]);
  const save=box.querySelector("[data-recsave]"),skip=box.querySelector("[data-recskip]"),msg=document.getElementById(uid+"-msg");
  if(skip)skip.onclick=()=>onDone&&onDone(0);
  if(save)save.onclick=()=>{
    if(!R().available()){msg.textContent="This browser isn't saving data (it may be a private window), so the record couldn't be kept.";return}
    const when=(document.getElementById(uid+"-d")||{}).value||null;let n=0;
    if(when&&when>D().today()){msg.textContent="That date is in the future. Choose the day you sent it.";return}
    rows.forEach((r,i)=>{const on=box.querySelector(`[data-rec="${i}"]`);if(on&&!on.checked)return;
      const text=(document.getElementById(`${uid}-m${i}`)||{}).value||"";
      if(R().addSent({issue,office:{id:r.officeId||null,name:r.title||r.name,holder:r.title&&r.name!==r.title?r.name:null},channel:r.channel||"email",message:text,sentOn:when}))n++});
    msg.textContent=n?`Saved ${n} record${n===1?"":"s"} in this browser, marked "reported by you." See them on the issue page or in Following.`:"Nothing was selected, so nothing was saved.";
    if(n&&onDone)setTimeout(()=>onDone(n),900)};
}
// Copy text to the clipboard. Resolves true only if the copy really happened.
async function copy(txt){try{await navigator.clipboard.writeText(txt);return true}catch(e){return false}}
// Show the full message where the person can select and copy it themselves, so it's never lost.
function showText(el,txt,intro){if(!el)return;el.innerHTML=`${esc(intro)}<textarea readonly rows="8" aria-label="Your message" style="display:block;width:100%;margin-top:6px;font:inherit">${esc(txt)}</textarea>`;
  const ta=el.querySelector("textarea");if(ta){ta.focus();ta.select()}}
// An email link longer than about 1,900 characters may not open. Then the message is copied, or shown to copy by hand.
async function mailUrl(email,m,el){let url=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;
  if(url.length<=1900)return {url,shown:false};
  const ok=await copy(m.body);
  if(!ok)showText(el,m.body,"Your message is too long to pass to your email app directly, and copying didn't work. Select the text below, copy it, and paste it into the email.");
  return {url:`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(ok?"(Your message was copied. Paste it here.)":"(Copy your message from the Civic Accord page and paste it here.)")}`,shown:!ok}}
const api={recipients,message,recordPanel,bindPanel,copy,showText,mailUrl};
if(typeof window!=="undefined")window.CA_TELL=api;
})();
