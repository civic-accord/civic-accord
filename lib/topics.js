/* Civic Accord topics.
   Items are sorted into topics by these published word lists, never by AI. Anyone can read and improve them.
   Each item shows the word that matched, so people can see why it appears.
   A word ending in * matches any word that starts with it (agricultur* matches agriculture, agricultural).
   Other words match the whole word, plus a plural ending in s or es. */
(function(){
const T=[
 {id:"health",label:"Health care",kw:["health","medicare","medicaid","hospital*","drug","pharmac*","insurance","disease*","clinic*","patient*","physician*","nurse*","vaccin*","opioid*","dental","medical"]},
 {id:"education",label:"Schools and education",kw:["school*","education*","student*","teacher*","college*","universit*","tuition","literacy","head start","child care","childcare","preschool"]},
 {id:"economy",label:"Jobs and the economy",kw:["employment","employer*","labor","worker*","wage*","job","unemployment","workforce","trade","tariff*","economic","commerce","apprentic*","overtime"]},
 {id:"taxes",label:"Taxes and budgets",kw:["tax","taxes","taxation","budget*","appropriation*","revenue*","fiscal","treasury","internal revenue"]},
 {id:"housing",label:"Housing",kw:["housing","rent","mortgage*","homeless*","landlord*","tenant*","zoning","housing and urban"]},
 {id:"transport",label:"Transportation",kw:["transportation","highway*","road*","transit","airport*","aviation","aircraft","airworthiness","railroad*","rail","vehicle*","traffic","bridge*","pipeline*","motor carrier*","waterway*","vessel*","safety zone*","drawbridge*"]},
 {id:"environment",label:"Environment and energy",kw:["environment*","air quality","emission*","pollut*","energy","electric*","solar","wind","climate","wildlife","endangered","conservation","hazardous","waste","marine","coastal","air plan*"]},
 {id:"water",label:"Water and land",kw:["water*","river*","watershed*","land","lands","forest*","park","parks","public lands","drought","flood*","irrigation","invasive"]},
 {id:"agriculture",label:"Farms and food",kw:["agricultur*","farm*","crop*","livestock","food","nutrition","snap","fisher*","ranch*","pesticide*","biosecurity","animal and plant","meat","poultry","dairy"]},
 {id:"safety",label:"Public safety and courts",kw:["police","crime*","criminal","court*","justice","prison*","sentencing","fire","emergency","disaster*","law enforcement","victim*","911"]},
 {id:"immigration",label:"Immigration",kw:["immigra*","visa","asylum","citizenship","border","customs","naturaliz*","refugee*"]},
 {id:"elections",label:"Elections and government",kw:["election*","voting","voter*","campaign*","ethics","lobby*","public records","transparency","redistrict*"]},
 {id:"tech",label:"Technology and privacy",kw:["privacy","data","cyber*","internet","broadband","artificial intelligence","telecommunication*","communications commission","spectrum","digital","crypto*","wireless"]},
 {id:"veterans",label:"Veterans and the military",kw:["veteran*","military","defense","armed forces","national guard","army","navy","air force"]},
 {id:"business",label:"Small business and consumers",kw:["small business*","consumer*","licens*","bank","banks","banking","credit","financial","securities","exchange commission","price*"]},
 {id:"families",label:"Families and seniors",kw:["family","families","child","children","youth","senior*","aging","retirement","social security","disabilit*","caregiver*"]},
 {id:"firearms",label:"Firearms",kw:["firearm*","gun","guns","weapon*","ammunition"]},
 {id:"tribal",label:"Native and tribal affairs",kw:["tribal","tribe*","native american*","indian affairs","alaska native*","native hawaiian*"]}
];
const rx=k=>{const pre=k.endsWith("*"),w=k.replace(/\*$/,"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/ /g,"\\s+");
  return new RegExp("(^|[^a-z0-9])"+w+(pre?"":"(s|es)?(?![a-z0-9])"),"i")};
T.forEach(t=>t.rx=t.kw.map(k=>[k.replace(/\*$/,""),rx(k)]));
function match(it){
  const text=[it.title,it.who,it.summary].join(" ");
  const out=[];
  T.forEach(t=>{const hit=t.rx.find(([,r])=>r.test(text));if(hit)out.push({id:t.id,label:t.label,word:hit[0]})});
  return out;
}
const api={list:T.map(({id,label,kw})=>({id,label,kw})),match};
if(typeof window!=="undefined")window.CA_TOPICS=api;
if(typeof module!=="undefined")module.exports=api;
})();
