/* "Forget me on this device": removes everything Civic Accord has saved in this browser
   (districts, name and town for messages, reactions, topics, notes, drafts, follows, records of
   what you sent, sample verification).
   Useful on shared computers at a library, school, or home. Nothing is stored anywhere else to delete. */
(function(){
  function forget(){
    var gone=0;
    [window.localStorage,window.sessionStorage].forEach(function(store){
      try{ for(var i=store.length-1;i>=0;i--){var k=store.key(i);if(k&&k.indexOf("civicaccord-")===0){store.removeItem(k);gone++}} }catch(e){}
    });
    return gone;
  }
  function add(){
    var f=document.querySelector("footer"); if(!f||f.querySelector("[data-forget]"))return;
    var span=document.createElement("span");
    span.innerHTML='<button type="button" data-forget style="background:none;border:0;padding:0;min-height:44px;font:inherit;color:inherit;text-decoration:underline;cursor:pointer">Forget me on this device</button> <span role="status" aria-live="polite"></span>';
    f.appendChild(span);
    var b=span.querySelector("button"), msg=span.querySelector("[role=status]");
    b.addEventListener("click",function(){
      if(!window.confirm("Remove everything Civic Accord saved in this browser? This includes your districts, the name and town you used in messages, your reactions, topics, notes, drafts, the issues you follow, and your records of what you sent. On a shared computer, do this when you're done."))return;
      forget();
      var left=0;try{for(var i=0;i<localStorage.length;i++){if((localStorage.key(i)||"").indexOf("civicaccord-")===0)left++}}catch(e){}
      msg.textContent=left?"Some items couldn't be removed. Your browser may be blocking changes. Try clearing this site's data in your browser settings.":"Done. Nothing from Civic Accord is saved in this browser now. Reload the page, or close it, to start fresh.";
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",add);else add();
})();
