# Civic Accord

Civic Accord is a tool where residents talk through a public issue, find where people with different views actually agree, weigh the costs, and hand their representatives a proposed bill backed by a full public record.

AI organizes and drafts. People decide. A legislator decides whether to introduce anything.

**Live prototype:** https://civicaccord.org (example data only)

## How it works

1. **Learn.** Everyone reads the same short, sourced briefing.
2. **Weigh in.** Verified residents vote agree, disagree, or pass on short statements, and add their own.
3. **Common ground.** The tool groups people by how they vote and shows what every group supports and where they split.
4. **Weigh costs.** Each option shows an estimated cost and what it accomplishes. Residents choose what to fund and how to pay.
5. **Draft.** The chosen package becomes a plain-language proposal and starting bill text. Anything without common ground is flagged.
6. **Hand off.** Representatives receive the proposal, the cost estimate, the disagreements, and the anonymized vote record.

## Built for any issue and any level of government

- **Core:** verification, voting, vote record, consensus math, cost tools, drafting, hand-off. The same everywhere.
- **Issue packs:** shared facts, current law, seed statements, cost options for one topic.
- **Jurisdiction packs:** districts, committees, calendar, bill format, budget figures for one government.

Live packs:
- **Hawaiʻi State Legislature** (pilot): invasive species, 2027 session.
- **U.S. Congress**: the same issue at the federal level, with federal facts, cost options, per-U.S.-resident costs, congressional bill format, and hand-off to a member's representative and senators.

## For representatives

[`inbox.html`](inbox.html) shows what an official receives: who took part compared with the district, common ground, disagreements, costs, and a public response that every participant can see.

## Writing a pack

Packs are plain JSON files in [`packs/`](packs/). See [`packs/SPEC.md`](packs/SPEC.md). Anyone can author one without writing code; nothing in a pack can affect how votes are counted.

The easiest way is the builder at [`new.html`](https://civicaccord.org/new.html) ("＋ Start a deliberation" in the app). Pick an existing government or enter a new one, add sourced facts, statements, and costs with their basis. It checks the pack rules as you go, previews the draft in the real tool, and exports the pack file for a second-person review.

Every statement can also carry citizen panel results (`panel: [agree, disagree, pass]`) from a randomly selected, demographically balanced group, shown next to the open results so representatives can see whether self-selected participants match the wider public.

## The office, not the person

The two-way conversation is between residents and an **office** (a seat), not an individual politician. The office inbox (`inbox.html`) belongs to the seat: responses are signed by the office and name who approved them, and when the officeholder changes, every open package, request, and past response passes to the next one.

- **Offices can ask.** An office can request a deliberation on a pending bill or a trade-off. A neutral host reviews it before it opens, and the request is public.
- **Counter-drafts.** An office can answer "I will introduce it with changes" and say what would need to change. Residents weigh in on the revised version.
- **Follow-through.** The office reports each step (introduced, heard, amended, voted, enacted, stalled) with its reasoning. Residents see the same timeline in the hand-off step.
- **Election quiet period.** Offices can't start new deliberations in the days before an election (`quietPeriodDays`, default 60), modeled on the limits on official mass mailings before elections. Residents can still deliberate, and offices can still respond.
- **No campaign use.** No party branding, campaign links, photos, fundraising, or ratings of officials.

## Trust rules

- AI never touches the vote count.
- Public, append-only, tamper-evident vote record; anyone can recount.
- Every AI summary links to the votes behind it.
- Disagreements travel with the proposal.
- One verified resident, one voice.
- Independent security audits.

## Status

Early prototype. Everything shown uses invented example data. Nothing is collected or sent anywhere.
