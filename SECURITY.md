# Security

Civic Accord is an early, open-source example that uses sample data. No real votes or identities are collected yet. Before it is used for real participation, it needs a neutral host, legal review in each jurisdiction, and independent security audits.

## Reporting a vulnerability

Please report security problems privately at https://github.com/liebeskind8301/civic-accord/security/advisories/new (or the repository's Security tab, "Report a vulnerability"). Please don't post details of a security problem publicly. We aim to acknowledge reports within a week and to credit reporters who want credit.

## What the system is designed to guarantee

- **Votes can be recounted by anyone.** Votes go into a public, append-only record; counting is done by simple open-source code.
- **Each person can check their own vote.** A private receipt lets a voter find their vote in the public record without revealing who they are.
- **AI never counts.** AI may summarize and draft, never touch the vote count or residency and voter-status checks.
- **Identity is separated from votes.** The residency check never sees votes; the vote record never sees names or addresses.
- **Addresses stay out of Civic Accord's servers.** Address lookups go from the browser straight to the U.S. Census Bureau. Legislator lookups send only district numbers.

"Verifiable," never "impossible to tamper with."

## Current attack surface (prototype)

- Static pages served by Vercel, with security headers (HSTS, CSP, no framing) set in `vercel.json`.
- Two read-only serverless functions (`api/open.js`, `api/people.js`) that fetch public data with API keys stored as Vercel secrets. They accept no personal data.
- Browser storage on the visitor's own device (districts, reactions, demo verification). Nothing is sent back.

## Verification plan

See the Security section of the National Blueprint. In short: automated checks on every change, an independent code review and penetration test against OWASP ASVS before launch, a public bug bounty, cryptographic end-to-end verifiability for the vote record, and recurring audits with public reports.
