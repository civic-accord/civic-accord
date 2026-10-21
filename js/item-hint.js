// Issue page: the full note about where everything comes from shows the first time this browser opens an issue
// page. After that it's one line with a link, so the page gets to the item sooner.
(function(){
const n=document.getElementById("firstnote");if(!n||!window.CA_SEEN)return;
if(CA_SEEN.seen("item")){n.innerHTML=`Built only from official text; what you do here stays in this browser. <a href="how.html#talk" style="color:var(--koa)">How this page works</a>`;return}
CA_SEEN.mark("item");
})();
