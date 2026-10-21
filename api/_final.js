// When an official record says a bill is finished. Shared by Open Now (which leaves finished bills out) and issue pages
// (which say "Final decision"). Files starting with "_" are not public routes.

// Congress: law, vetoed, or failed. (Resolutions agreed to are handled by Open Now's own rule, which knows the type.)
const CONGRESS_ENDED = /became (public|private) law|signed by (the )?president|vetoed by (the )?president|pocket vetoed|failed of passage|failed to pass/i;

// States: finished only when the latest action says the bill itself ended. Words like "failed" or "tabled" alone
// aren't enough: "Amendment failed" or "Motion tabled" happen on bills that are still moving.
const BILL_END = [
  /^(signed|approved) by (the )?governor/i, /^became law/i, /^became effective/i, /^chaptered/i, /^enacted/i,
  /^act( no\.)? ?\d+/i, /^session law/i, /^(vetoed|veto sustained)/i, /^filed with(out)? (the )?governor'?s signature/i,
  /^indefinitely postponed/i, /\bdied in committee\b/i,
  /^signed chap/i, /^approval memo/i, /^veto memo/i,  // New York: governor signed (chapter) or vetoed
  // How other legislatures record a bill becoming law (New Jersey, Michigan, Wisconsin, Texas, Illinois, Florida,
  // Minnesota, Virginia, North Carolina), and a governor's signature or veto worded differently.
  /^approved p\.\s?l\.\s?\d/i, /^assigned pa\b/i, /^filed with (the )?secretary of state/i, /^published \d/i,
  /^effective (on |immediately|\d)/i, /^public act\b/i, /^chapter no\.?\s*\d/i, /^secretary of state,? chapter\b/i,
  /acts of assembly chapter/i, /^ch\.? ?sl\b/i, /^governor signed\b/i, /\bpocket vetoed\b/i, /^vetoed by (the )?governor/i
];
// "Failed", "died", and "withdrawn" end a bill only when they're about the bill itself, not an amendment, a motion,
// or a step like "Withdrawn from committee", which moves a bill forward.
const ABOUT_PART = /amendment|motion|from committee|from the committee|report|reconsider/i;
// Open States labels some actions; these labels mean the bill itself ended.
const ENDING_LABELS = ["became-law", "executive-signature", "executive-veto", "veto-override-failure", "withdrawal"];
function stateEnded(text, isResolution, labels) {
  const t = String(text || "").trim();
  if (BILL_END.some(re => re.test(t))) return true;
  if (/^(bill )?(failed|died|dead|withdrawn)\b/i.test(t) && !ABOUT_PART.test(t)) return true;
  // "Adopted" ends a resolution, but on a bill it usually means a committee report or amendment was adopted.
  if (isResolution && /^(resolution )?adopted\b/i.test(t) && !ABOUT_PART.test(t)) return true;
  if (Array.isArray(labels) && labels.some(l => ENDING_LABELS.includes(l)) && !ABOUT_PART.test(t)) return true;
  return false;
}
const congressEnded = text => CONGRESS_ENDED.test(String(text || ""));

// For issue pages, which must not call a bill "final" when it isn't. Returns "final", "vetoed", or null.
// A regular veto isn't final: the legislature can still vote to override it. A pocket veto, a sustained veto, or a
// failed override is final. Open Now (above) leaves vetoed bills out of its list either way.
const VETO = /^(vetoed|veto memo|returned without (the )?governor'?s? (approval|signature))|vetoed by (the )?(president|governor)/i;
const VETO_FINAL = /pocket vetoed|veto sustained|failed to override|override (failed|fails)|veto override failed|override of (the )?veto failed/i;
function congressOutcome(type, text) {
  const t = String(text || ""), T = String(type || "").toUpperCase();
  if (VETO_FINAL.test(t)) return "final";
  if (/vetoed by (the )?president/i.test(t)) return "vetoed";
  if (/became (public|private) law|signed by (the )?president|failed of passage|failed to pass/i.test(t)) return "final";
  // Resolutions: "agreed to" counts only for the resolution itself, never for a motion to refer or table, or for
  // agreement with an amendment (which goes back to the other chamber).
  const agreed = /agreed to/i.test(t) && !/motion to (refer|table|recommit|reconsider)|with an amendment|with amendments/i.test(t);
  // After the House adopts a resolution, the last step is often "Motion to reconsider laid on the table Agreed to",
  // which only follows adoption.
  if (/^(HRES|SRES)$/.test(T) && (agreed || /motion to reconsider laid on the table agreed to/i.test(t))) return "final";
  if (/^(HCONRES|SCONRES)$/.test(T) && agreed && (T === "HCONRES" ? /Senate/i.test(t) : /House/i.test(t)) && !/message on/i.test(t)) return "final";
  return null;
}
// A one-chamber ("simple") resolution is finished when adopted; concurrent and joint resolutions need both chambers.
const simpleResolution = cls => Array.isArray(cls) && cls.includes("resolution") && !cls.some(c => /concurrent|joint/i.test(c));
function stateOutcome(text, classification, labels) {
  const t = String(text || "").trim(), L = Array.isArray(labels) ? labels : [];
  if (VETO_FINAL.test(t) || L.includes("veto-override-failure")) return "final";
  // A line-item veto strikes some items from a bill that is otherwise signed, so it isn't treated as a veto here.
  if (VETO.test(t) || L.includes("executive-veto")) return "vetoed";
  if (ABOUT_PART.test(t)) return null;
  if (BILL_END.filter(re => !/vetoed|veto memo/.test(re.source)).some(re => re.test(t))) return "final";
  if (/^(bill )?(failed|died|dead|withdrawn)\b/i.test(t)) return "final";
  if (simpleResolution(classification) && /^(resolution )?adopted\b/i.test(t)) return "final";
  if (L.some(l => ["became-law", "executive-signature", "withdrawal"].includes(l))) return "final";
  return null;
}
module.exports = { stateEnded, congressEnded, CONGRESS_ENDED, congressOutcome, stateOutcome, simpleResolution };
