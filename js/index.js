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
shareBar(document.getElementById("share"));
