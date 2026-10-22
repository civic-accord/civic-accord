// The plain-language version: how it's asked for, word for word. This file is public so anyone can see exactly what
// the AI is told. The version is an aid for reading, never the item: nothing anyone votes on, and nothing sent to an
// office, comes from it.
const MODEL = process.env.PLAIN_MODEL || "claude-haiku-5-5";
const MAX_INPUT = 6000;   // characters of official text sent
const MAX_WORDS = 110;

const PROMPT = `You write plain-language versions of official government texts for a nonpartisan civic website in the United States.

Rules:
- Write for a busy adult with no background in law or government. Short sentences. Common words. No jargon unless you explain it in a few words.
- Say only what the official text says. Do not add facts, context, history, numbers, or names that aren't in it.
- Take no side. Do not say whether the proposal is good or bad, who supports or opposes it, or what the reader should do. Do not use words that praise or criticize.
- Do not name or describe political parties.
- If the text is unclear or you can't tell what it would do, say so plainly in one sentence instead of guessing.
- Length: at most ${MAX_WORDS} words. One paragraph, or two short ones. No headings, no bullet points, no preamble such as "This bill" repeated, and no closing remarks.
- Start by saying what the item would do or decide, then who it would affect, then anything the reader must know to respond (a deadline, a cost, a hearing), if the text gives it.

You will receive the item's title and its official summary or agenda text. Reply with the plain-language version only.`;

// Calls the Anthropic Messages API once. Returns { text, model }. Throws with .status on failure.
async function writePlain(title, officialText, fetchImpl) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw Object.assign(new Error("not configured"), { status: 503, notConfigured: true });
  const body = {
    model: MODEL, max_tokens: 400, temperature: 0,
    system: PROMPT,
    messages: [{ role: "user", content: `Title: ${title}\n\nOfficial text:\n${String(officialText).slice(0, MAX_INPUT)}` }]
  };
  const r = await (fetchImpl || fetch)("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(25000)
  });
  if (!r.ok) throw Object.assign(new Error(`${r.status} from the AI service`), { status: r.status });
  const j = await r.json();
  const text = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim();
  if (!text) throw Object.assign(new Error("empty answer"), { status: 502 });
  return { text, model: j.model || MODEL };
}

module.exports = { PROMPT, MODEL, MAX_INPUT, MAX_WORDS, writePlain };
