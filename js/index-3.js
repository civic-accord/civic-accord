let deferredInstall=null;const ib=document.getElementById("installbtn");
addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;if(ib)ib.hidden=false});
if(ib)ib.onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();try{await deferredInstall.userChoice}catch(x){}deferredInstall=null;ib.hidden=true};
if(matchMedia("(display-mode: standalone)").matches||navigator.standalone){const sct=document.getElementById("install");if(sct)sct.hidden=true}
