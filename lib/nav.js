/* The phone "More" menu: closes with Escape or a tap outside it, and after choosing a link. */
(function(){
  var m=document.querySelector(".morenav");if(!m)return;
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&m.open){m.open=false;var s=m.querySelector("summary");if(s)s.focus()}});
  document.addEventListener("click",function(e){if(m.open&&!m.contains(e.target))m.open=false});
})();
