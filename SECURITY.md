# Security

Civic Accord is an early, open-source example that uses sample data. No real votes or identities are collected yet. Before it is used for real participation, it needs a neutral host, legal review in each jurisdiction, and independent security audits.

## Reporting a vulnerability

Please report security problems privately at https://github.com/civic-accord/civic-accord/security/advisories/new (or the repository's Security tab, "Report a vulnerability"). Please don't post details of a security problem publicly. We aim to acknowledge reports within a week and to credit reporters who want credit.

## What the system is designed to guarantee

- **Votes can be recounted by anyone.** Votes go into a public, append-only record; counting is done by simple open-source code.
- **Each person can check their vote is included, and no one else can learn how they voted (design goal).** A receipt (tracking code) shows a voter's sealed ballot is in the record but not its choices, so it is designed so it can't be used to sell a vote or prove it to someone applying pressure.
- **Votes can be changed until close (design goal).** Only a voter's last ballot counts, which makes pressure much harder. This depends on new ballots not being visibly linked to earlier ones; see the design below.
- **AI never counts.** AI may summarize and draft, never touch the vote count or residency and voter-status checks.
- **Identity is separated from votes.** The residency check never sees votes; the vote record never sees names or addresses.
- **Addresses stay out of Civic Accord's servers.** Address lookups go from the browser straight to the U.S. Census Bureau. Legislator lookups send only the state; the browser picks its own districts.

"Verifiable," never "impossible to tamper with."

## Current attack surface (prototype)

- Static pages served by Vercel, with security headers (HSTS, CSP, no framing) set in `vercel.json`.
- Three read-only serverless functions (`api/open.js`, `api/people.js`, `api/congress.js`) that fetch public data, with API keys stored as Vercel secrets. They accept no personal data.
- Browser storage on the visitor's own device (districts, reactions, demo verification). Nothing is sent back. "Forget me on this device" (`lib/forget.js`, in every page footer) removes it all.
- The data functions answer only their exact expected address (anything else is redirected), accept only GET and HEAD, share one request among simultaneous visitors, give up on a source after 8 seconds, remember failures briefly (keeping the last good answer, with its real fetch time), limit calls to Open States in each server copy to stay under its free limit, and show visitors plain error messages without source details.

## Verification plan (not in place yet)

See the Security section of the National Blueprint. In short, planned: automated checks on every change, an independent code review and penetration test against OWASP ASVS before launch, a public bug bounty, cryptographic end-to-end verifiability for the vote record, and recurring audits with public reports.

## Vote record design (planned)

Goals: anyone can recount; each voter can check their ballot is included and was sealed correctly; no one can prove how a particular person voted (no vote buying or pressure). The design uses established, reviewed methods, not new cryptography. Everything here goes to an independent cryptography and security review before launch.

1. **Sealed ballots and tracking codes.** Ballots are encrypted on the voter's device, ElectionGuard-style: tracking codes, threshold "guardians" (no single party can decrypt), and encrypted running totals. A tracking code shows the sealed ballot is in the record; it does not prove the ballot holds the voter's choices. For that, the voter can spot-check before casting with the Benaloh challenge (ElectionGuard's "spoil" step), which opens a test ballot.
2. **Revoting without linking voters.** Only the last ballot per voting credential counts. Removing superseded ballots must be checkable without revealing which ballots belong to the same voter, or a watcher could see that someone changed their votes. Candidate methods: VoteAgain (Lueks, Querejeta-Azurmendi, Troncoso, 2020: dummy ballots and verifiable filtering) or JCJ/Civitas-style credentials (decoy credentials; plaintext-equivalence tests, which get slow as ballots grow). Revoting does not help if someone takes the device that holds the voting key or forces a vote at the last minute; it makes pressure harder, not impossible. Open problem until the review picks a method.
3. **Checkable shuffle, then decryption.** At close, the remaining ballots go through a verifiable mix-net (for example, Verificatum; ElectionGuard does not include one), then threshold decryption. The shuffled vote matrix (anonymous rows) can then be published for recounts and to rerun the grouping (Pol.is method).
4. **Live results (open question).** Sealed ballots can't be grouped while a deliberation is open. Options: show only per-statement totals from encrypted running totals, released in batches so a single vote can't be picked out by watching the totals change, with groups and common ground shown at close; or accept some exposure by opening ballots early (not recommended). The current sample shows groups live.
5. **Pattern risk (open question).** With many statements, a voter's full pattern can be nearly unique, so someone applying pressure could demand an unusual pattern and look for it in the published matrix (the "Italian attack"). Options: show each voter only some statements (Pol.is already picks statements by priority, not purely at random, so this would need a change), publish only statement totals and group results with full-matrix recounts by independent auditors, or both.
6. **Written statements.** A statement a voter writes can identify its author through its content or timing. Statements are published without any link to the author's credential, in batches.

Stakes are advisory (proposals to an office, not binding elections), which lowers the incentive to buy votes, but the design treats coercion resistance as a requirement anyway.
