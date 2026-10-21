/* A sample issue page showing where Civic Accord is going: counted results, delivery, an office's public response,
   and the office's position, commitment, actions, and outcome kept apart. Everything here is invented and marked
   Sample, including the office, which is fictional. Nothing on this page is real. */
(function(){
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const S='<span class="lbl sample">Sample</span>';
const DATA={
  "sample-civic-channel":{
    title:"Should the District 3 council office offer a public, checkable way to work with residents?",
    office:"Example County Council, District 3 (a fictional office)",
    request:"Adopt an office policy: answer every request delivered from a District 3 deliberation within 30 days, in public, with a reason; and post each later step (introduced, heard, voted, adopted) on the request's page.",
    version:"Version 2, after review by two partner groups and a 7-day public objection period",
    period:"February 1 to February 28, 2027",
    took:212, registered:15000, registeredScope:"registered voters in District 3",
    statements:[
      {t:"The office should answer every delivered request within 30 days.",g:[[70,85],[60,80]],label:"Common ground",why:"At least 70% of each group agreed."},
      {t:"Each step on a request should be posted publicly as it happens.",g:[[68,84],[29,79]],label:"Divides groups",why:"One group was at 70% or more and the other under 50%."},
      {t:"Answers should name the staff member who approved them.",g:[[36,80],[42,81]],label:"Still forming",why:"Neither group reached 70%, and neither was clearly split."}
    ],
    delivered:"March 3, 2027, to the office's official email address listed in the registry. The host kept the delivery receipt.",
    response:{date:"March 30, 2027",by:"Approved by: the council member's chief of staff (role only)",text:"The council member supports answering requests within 30 days and will propose it to the council. Posting every step needs staff time the office doesn't have this year, so it isn't included yet."},
    records:[
      ["Position","What the office says it supports","Supports public answers within 30 days.","March 30, 2027, in the office's response"],
      ["Commitment","What the office promises to do","Will introduce a resolution by April 30, 2027.","March 30, 2027, in the office's response"],
      ["Action","What the official record shows","Resolution 27-41 introduced April 14, 2027 (sample record).","Council agenda, April 14, 2027 (sample)"],
      ["Outcome","What finally happened","Not yet. The resolution is in committee.","Checked May 1, 2027 (sample)"]
    ],
    comparison:{label:"Partially matches the request",why:"The resolution covers public answers within 30 days. It doesn't include posting each later step, which the request also asked for.",review:"Two reviewers from partner groups with different viewpoints agreed on this label. The office replied before it was published.",reply:"The office says step updates may follow in a later resolution.",corrections:"None."}
  }
};
function render(id){
  const d=DATA[id],$=x=>document.getElementById(x);
  if(!d){$("title").textContent="Sample not found";$("main").innerHTML='<p><a href="open.html" style="color:var(--koa)">Back to Open Now</a></p>';return}
  document.title="Sample issue · Civic Accord";
  $("title").textContent=d.title;
  $("kind").textContent="Sample issue · everything on this page is invented";
  const pct=(a,b)=>Math.floor(a*100/b);
  $("main").innerHTML=`
  <p class="draftbar"><b>This is a sample.</b> The office, the numbers, the response, and the records are all invented, to show where Civic Accord is going. No office has joined, and no votes are counted yet.</p>
  <section class="panel top" aria-labelledby="t-h"><h2 id="t-h" class="sr-only">At a glance</h2>
    <dl class="kv">
      <dt>The request</dt><dd>${esc(d.request)} ${S}<br><span class="meta">${esc(d.version)}</span></dd>
      <dt>Who can act</dt><dd>${esc(d.office)} ${S}</dd>
      <dt>Where it stands</dt><dd><b>Office responded</b>, ${esc(d.response.date)}. Official action recorded. ${S}</dd>
      <dt>What you can do next</dt><dd><a class="nextbtn" href="#follow-through">See the response and what happened</a></dd>
    </dl></section>
  <section class="panel" aria-labelledby="h1"><div class="eyebrow">1 · Understand ${S}</div><h2 id="h1">What it is</h2>
    <p>An invented example. Verified voters in a fictional District 3 talked through the same question as the <a href="app.html" style="color:var(--koa)">sample deliberation</a> and agreed on this request. It asks for an office policy, which an office can adopt on its own, not a bill.</p></section>
  <section class="panel" aria-labelledby="h2"><div class="eyebrow">2 · Participate ${S}</div><h2 id="h2">Who took part</h2>
    <p><b>${d.took} verified voters</b> took part, ${d.period}: ${(d.took*100/d.registered).toFixed(1)}% of the ${d.registered.toLocaleString("en-US")} ${esc(d.registeredScope)}. ${S}</p>
    <p class="meta">Only verified voters in District 3 could vote. Each person is counted once, however many statements they voted on. Each statement shows its own count, because not everyone voted on every statement. A pass counts as not agreeing.</p></section>
  <section class="panel" aria-labelledby="h3"><div class="eyebrow">3 · Results ${S}</div><h2 id="h3">Where people agree</h2>
    <p class="meta">Two groups formed from how people voted. These results describe the people who took part, not the whole district.</p>
    <ul class="sentlist">${d.statements.map(x=>`<li><b>${esc(x.label)}</b> ${S}<span>${esc(x.t)}</span><span class="meta">${esc(x.why)} ${x.g.map((g,i)=>`Group ${i+1}: ${g[0]} of ${g[1]} agreed (${pct(g[0],g[1])}%).`).join(" ")}</span></li>`).join("")}</ul></section>
  <section class="panel" aria-labelledby="h4"><div class="eyebrow">4 · Delivery ${S}</div><h2 id="h4">What was delivered</h2>
    <p><b>Delivered</b> ${esc(d.delivered)} ${S}</p>
    <p class="meta">The package held the exact request (version 2), the results above with their counts, the statements that divided people, and the turnout share. Disagreements traveled with it.</p></section>
  <section class="panel" aria-labelledby="h5"><div class="eyebrow">5 · Follow-through ${S}</div><h2 id="follow-through" tabindex="-1">What happened next</h2>
    <h3>The office's response ${S}</h3>
    <p><b>Responded ${esc(d.response.date)}.</b> ${esc(d.response.text)}</p><p class="meta">${esc(d.response.by)}. Responding is tracked on its own: no response never means opposition.</p>
    <h3>Kept apart ${S}</h3>
    <div class="tbl"><table class="mk"><tr><th>Record</th><th>What it means</th><th>Entry</th><th>Source</th></tr>
      ${d.records.map(r=>`<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td class="meta">${esc(r[3])}</td></tr>`).join("")}</table></div>
    <h3>Comparing the request with the action ${S}</h3>
    <p><b>${esc(d.comparison.label)}.</b> ${esc(d.comparison.why)}</p>
    <ul class="plain meta"><li>Review: ${esc(d.comparison.review)}</li><li>The office's reply: ${esc(d.comparison.reply)}</li><li>Corrections: ${esc(d.comparison.corrections)}</li></ul>
    <p class="meta">Labels like this are made by human reviewers, never by AI or by code alone, and never turned into a score for an official.</p></section>`;
}
if(typeof window!=="undefined")window.CA_SAMPLE={render};
})();
