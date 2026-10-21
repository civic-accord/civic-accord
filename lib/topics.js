/* Civic Accord topics.
   Items are sorted into topics by these published word lists, never by AI. Anyone can read and improve them.
   Each item shows the word that matched, so people can see why it appears.
   A word ending in * matches any word that starts with it (agricultur* matches agriculture, agricultural).
   Other words match the whole word, plus a plural ending in s or es.
   A topic's "not" list skips items that are really about something else (a boating safety zone on a river is transportation). */
(function(){
const T=[
 {id:"health",label:"Health care",kw:["health","medicare","medicaid","hospital*","drug","pharmac*","insurance","disease*","clinic*","patient*","physician*","nurse*","vaccin*","opioid*","dental","medical"]},
 {id:"education",label:"Schools and education",kw:["school*","education*","student*","teacher*","college*","universit*","tuition","literacy","head start","child care","childcare","preschool"]},
 {id:"economy",label:"Jobs and the economy",kw:["employment","employer*","labor","worker*","wage*","job","unemployment","workforce","trade","tariff*","economic","manufactur*","apprentic*","overtime"]},
 {id:"taxes",label:"Taxes and budgets",kw:["tax","taxes","taxation","tax credit*","budget*","appropriation*","revenue*","fiscal","treasury","internal revenue"]},
 {id:"housing",label:"Housing",kw:["housing","rent","mortgage*","homeless*","landlord*","tenant*","zoning","housing and urban"]},
 {id:"transport",label:"Transportation",kw:["transportation","highway*","road*","transit","airport*","aviation","aircraft","airworthiness","railroad*","rail","vehicle*","traffic","bridge*","pipeline*","motor carrier*","waterway*","vessel*","safety zone*","drawbridge*"]},
 {id:"environment",label:"Environment and energy",not:["general electric","airworthiness"],kw:["environment*","air quality","emission*","pollut*","energy","electric*","solar","wind","climate","wildlife","endangered","mineral*","nuclear","conservation","hazardous","waste","marine","coastal","air plan*"]},
 {id:"water",label:"Water and land",not:["safety zone*","drawbridge*","special local regulation*","regulated navigation area*","anchorage*"],kw:["water","waters","drinking water","river*","watershed*","land","lands","forest*","park","parks","public lands","drought","flood*","irrigation","invasive","wetland*","basin*"]},
 {id:"agriculture",label:"Farms and food",kw:["agricultur*","farm*","crop*","livestock","food","nutrition","snap","fisher*","ranch*","pesticide*","biosecurity","animal and plant","meat","poultry","dairy"]},
 {id:"safety",label:"Public safety and courts",kw:["police","crime*","criminal","court","courts","justice","prison*","sentencing","fire","emergency","disaster*","law enforcement","victim*","911","firefighter*","wildland"]},
 {id:"immigration",label:"Immigration",kw:["immigra*","visa","asylum","citizenship","border","customs","naturaliz*","refugee*"]},
 {id:"elections",label:"Elections and government",kw:["election*","voting","voter*","campaign*","ethics","lobby*","public records","transparency","redistrict*","postal","federal employee*","telework","contractor*","procurement","acquisition regulation","corrupt*","census"]},
 {id:"tech",label:"Technology and privacy",kw:["privacy","personal data","data privacy","data breach*","cyber*","internet","broadband","artificial intelligence","telecommunication*","communications commission","spectrum","digital","crypto*","wireless","biometric*","facial recognition","quantum","ai"]},
 {id:"world",label:"World affairs",not:["international aero","airworthiness"],kw:["foreign","international","united nations","sanction*","embass*","treaty","treaties","passport*","diplomat*","export*"]},
 {id:"veterans",label:"Veterans and the military",kw:["veteran*","military","defense","armed forces","national guard","army","navy","air force"]},
 {id:"business",label:"Small business and consumers",kw:["small business*","consumer*","licens*","bank","banks","banking","credit union*","credit card*","credit report*","financial","securities","exchange commission","price*","commodit*","swap*","investment*"]},
 {id:"families",label:"Families and seniors",kw:["family","families","child","children","youth","senior*","aging","retirement","social security","disabilit*","caregiver*"]},
 {id:"firearms",label:"Firearms",kw:["firearm*","gun","guns","weapon*","ammunition"]},
 {id:"tribal",label:"Native and tribal affairs",kw:["tribal","tribe*","native american*","indian affairs","alaska native*","native hawaiian*"]}
];
const rx=k=>{const pre=k.endsWith("*"),w=k.replace(/\*$/,"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/ /g,"\\s+");
  return new RegExp("(^|[^a-z0-9])("+w+(pre?"[a-z]*":"(s|es)?(?![a-z0-9])")+")","i")};
T.forEach(t=>{t.rx=t.kw.map(k=>[k.replace(/\*$/,""),rx(k)]);t.nx=(t.not||[]).map(rx)});
function match(it){
  // The title and the office come first. The summary is used only when they match nothing,
  // because summaries mention many side topics.
  const scan=text=>{const out=[];T.forEach(t=>{if(t.nx.some(r=>r.test(text)))return;for(const [,r] of t.rx){const m=r.exec(text);if(m){out.push({id:t.id,label:t.label,word:m[2].toLowerCase().replace(/\s+/g," ")});break}}});return out};
  const first=scan([it.title,it.who].join(" "));
  // Committee names list many subjects at once ("Banking, Housing, and Urban Affairs"), so they're left out.
  return first.length?first:scan(String(it.summary||"").replace(/committee on [^.;]+/gi,""));
}
const api={list:T.map(({id,label,kw,not})=>({id,label,kw,not})),match};
if(typeof window!=="undefined")window.CA_TOPICS=api;
if(typeof module!=="undefined")module.exports=api;
})();
