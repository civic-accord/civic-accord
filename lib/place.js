// Which state, if any, a federal item is about. Many federal notices are approvals for one state (an air plan for
// North Carolina, a water program for Arkansas). They're open to anyone's comment, but for a visitor elsewhere they
// shouldn't outrank their own state's bills and nationwide rules. This reads only the official title; nothing is
// reworded. A plain word list, no AI.
(function(){
const NAMES={AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",PR:"Puerto Rico",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"};
// "Washington" alone usually means the city; count it as the state only when the title says so.
const PATTERNS=Object.keys(NAMES).map(k=>{
  const n=NAMES[k].replace(/\s+/g,"\\s+");
  if(k==="WA")return {k,re:/\b(?:State\s+of\s+Washington|Washington\s+State)\b/i};
  if(k==="DC")return {k,re:/\b(?:District\s+of\s+Columbia|Washington,?\s+D\.?C\.?)\b/i};
  if(k==="VA")return {k,re:/(?<!West\s)\bVirginia\b/i};
  return {k,re:new RegExp("\\b"+n+"\\b","i")};
});
// Hawaiʻi is often spelled with the ʻokina in official titles.
PATTERNS.push({k:"HI",re:/\bHawai[ʻ'‘]i\b/i});
// Postal abbreviations count only after a comma, as in "Miami, FL" or "Biscayne Bay, Miami, FL".
const ABBR=/,\s*([A-Z]{2})\b/g;
function statesNamed(title){
  const t=String(title||"");const out=[];
  PATTERNS.forEach(p=>{if(p.re.test(t)&&!out.includes(p.k))out.push(p.k)});
  let m;ABBR.lastIndex=0;while((m=ABBR.exec(t))){if(NAMES[m[1]]&&!out.includes(m[1]))out.push(m[1])}
  return out;
}
// true when the title names at least one state and none of them is the visitor's.
function aboutAnotherState(title,mine){
  const s=statesNamed(title);
  return s.length>0&&!(mine&&s.includes(mine));
}
const api={statesNamed,aboutAnotherState,NAMES};
if(typeof window!=="undefined")window.CA_PLACE=api;
if(typeof module!=="undefined")module.exports=api;
})();
