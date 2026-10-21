// Lets Civic Accord work offline from the last visit (see sw.js).
if("serviceWorker" in navigator){addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}))}
