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
  /^signed chap/i, /^approval memo/i, /^veto memo/i  // New York: governor signed (chapter) or vetoed
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
module.exports = { stateEnded, congressEnded, CONGRESS_ENDED };
