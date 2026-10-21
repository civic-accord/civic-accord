# Security

Civic Accord is an early, open-source example that uses sample data. No real votes or identities are collected yet. Before it is used for real participation, it needs a neutral host, legal review in each jurisdiction, and independent security audits.

## Reporting a vulnerability

Please report security problems privately at https://github.com/civic-accord/civic-accord/security/advisories/new (or the repository's Security tab, "Report a vulnerability"). Please don't post details of a security problem publicly. We aim to acknowledge reports within a week and to credit reporters who want credit.

## What the system is designed to guarantee

- **Votes can be recounted by anyone.** Votes go into a public, append-only record; counting is done by simple open-source code.
- **Each person can check their vote was counted, and no one else can learn how they voted.** A receipt confirms a voter's sealed ballot is in the record, unchanged, but does not show its choices, so it can't be used to sell a vote or prove it to someone applying pressure.
- **Votes can be changed until close.** Only a voter's last ballot counts, so a voter who was pressured can quietly change their votes.
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

The vote record must let anyone recount, let each voter confirm their vote was counted, and never let anyone prove how a particular person voted (no vote buying or pressure). The planned design uses established, reviewed methods rather than new cryptography:

1. **Sealed ballots with tracking codes.** Each ballot is encrypted on the voter's device (ElectionGuard). The voter gets a tracking code that shows their encrypted ballot is in the public record, unchanged. The code does not reveal the choices.
2. **Revoting.** A voter can cast again until the deliberation closes; only the last ballot per voting credential counts. Superseded ballots are removed before counting in a way that can be checked.
3. **Verifiable shuffle, then decryption.** At close, the remaining ballots are shuffled with a publicly checkable mix-net, then decrypted by a threshold of independent trustees (no single party can decrypt). The shuffled, decrypted vote matrix (anonymous rows, one per ballot) is published so anyone can recount and rerun the grouping (Pol.is method).
4. **Pattern risk (open question).** In a long set of statements, a voter's full pattern can be nearly unique, so someone applying pressure could demand an unusual pattern and look for it in the published matrix. Mitigations under consideration: each voter sees a random subset of statements (as Pol.is does), publishing only statement totals plus group results with full-matrix recounts by independent auditors, or both. To be decided with the independent cryptography and security review before launch.

Stakes are advisory (proposals to an office, not binding elections), which lowers the incentive to buy votes, but the design treats coercion resistance as a requirement anyway.

