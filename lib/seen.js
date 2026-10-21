// What this browser has already been shown once: the welcome card, the first-visit note on an issue page. Kept in
// this browser only, under a civicaccord- key, so "Forget me on this device" clears it like everything else.
(function(){
const KEY="civicaccord-seen";
function all(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){return {}}}
function seen(k){return !!all()[k]}
function mark(k){const a=all();a[k]=1;try{localStorage.setItem(KEY,JSON.stringify(a))}catch(e){}}
function unmark(k){const a=all();delete a[k];try{localStorage.setItem(KEY,JSON.stringify(a))}catch(e){}}
const api={seen,mark,unmark};
if(typeof window!=="undefined")window.CA_SEEN=api;
if(typeof module!=="undefined")module.exports=api;
})();
