/* Stable names for offices (seats), not the people who hold them. A record about what someone asked an office stays
   with that seat when a new officeholder takes it; the officeholder at the time is kept beside it.
   These names are also what a shared record system would use later, so they don't change once given out.
     U.S. House seat:        us/house/hi-2       (at-large seats: us/house/ak-al)
     U.S. Senate seat:       us/senate/hi/class-1 (the class tells a state's two seats apart; us/senate/hi if unknown)
     State legislature seat: hi/lower/13, id/lower/19a, ne/legislature/5
     Federal agency:         us/agency/environmental-protection-agency
     Local body:             local/hi-maui-county (the registry's feed id) */
(function(){
const slug=s=>String(s==null?"":s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
const st=s=>slug(s).slice(0,2);
function house(state,cd){const d=String(cd==null?"":cd).trim().toLowerCase();
  const n=!d||d==="at-large"||d==="al"||d==="0"||d==="00"||d==="98"?"al":String(parseInt(d,10)||d);
  return `us/house/${st(state)}-${n}`}
const senate=(state,cls)=>`us/senate/${st(state)}`+(cls?`/class-${parseInt(cls,10)}`:"");
// chamber: "lower", "upper", or "legislature" (one-chamber legislatures such as Nebraska's, and the D.C. Council).
const stateSeat=(state,chamber,district)=>`${st(state)}/${slug(chamber)}/${slug(district)}`;
const agency=name=>`us/agency/${slug(name)}`;
const local=feedId=>`local/${slug(feedId)}`;
const valid=id=>/^[a-z0-9]+(\/[a-z0-9-]+){1,3}$/.test(String(id||""));
const api={house,senate,stateSeat,agency,local,valid,slug};
if(typeof window!=="undefined")window.CA_OFFICES=api;
if(typeof module!=="undefined")module.exports=api;
})();
