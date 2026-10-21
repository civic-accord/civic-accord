(function(){const T=window.CA_TOPICS;if(!T)return;const box=document.getElementById("quickpick");
  const pick=["health","education","housing","economy","environment","agriculture","safety","tech","veterans","families"];
  box.querySelector(".qchips").innerHTML=T.list.filter(t=>pick.includes(t.id)).map(t=>`<a href="open.html" data-q="${t.id}">${t.label}</a>`).join("")+`<a href="open.html">Something else</a>`;
  box.querySelectorAll("[data-q]").forEach(a=>a.addEventListener("click",()=>{try{const old=(JSON.parse(localStorage.getItem("civicaccord-topics")||"null")||{}).picked||[];
    localStorage.setItem("civicaccord-topics",JSON.stringify({picked:[a.dataset.q,...old.filter(x=>x!==a.dataset.q)].slice(0,5),skipped:false}))}catch(e){}}));
  box.hidden=false})();
