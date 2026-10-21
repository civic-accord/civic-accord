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

## Voter check design (planned)

Goals: only the real voter can claim a voter record; a stale or shared address can't hand someone else's record to the wrong person without it being visible and reversible; no one can use the mail step to harass voters, learn who uses the service, or run up costs. Each state's law decides which voter-record fields may be used; nothing here adds rules beyond that.

Threats and planned controls:

1. **Stale records.** People move and die; rolls lag. Codes go only to records the election office lists as **active**, at the residence address on that record, from the most recent list the host may legally obtain. Civic Accord does no list maintenance and changes no records; corrections go through the election office. Status is re-checked before each hand-off.
2. **Someone else at the address** (new tenant, roommate, family member, mail theft). Codes are mailed in a **sealed letter** whose outside doesn't mention voting, so others at the address don't learn that a person uses the service. The letter tells the voter what to do if they didn't ask and how to report it to the host. Anyone who opens the letter can read the code, so this relies on the take-back path below, not on secrecy alone.
3. **Squatting and take-back.** The real voter can take back a record by any of: an in-person check (library or election office), the election office's own check (where agreed), or a take-back code mailed in a sealed letter to the record address. Assisted checks are offered for people who can't travel (home visits or care-home sessions arranged with the election office). The earlier claim is cancelled; a notice letter goes to the record address.
4. **Removing a cancelled claim's ballots (open problem).** The system must be able to revoke a credential without learning which ballots it cast. Candidate approach: the credential is issued blindly, and the issuer keeps only a revocation token per voter record (not the credential); revocation is applied with the same checkable filtering used for replaced ballots (VoteAgain or JCJ/Civitas-style), so no one learns which ballots were removed. To be settled in the security review. After close, the number of cancelled claims is published with the result.
5. **Voters the letter can't reach.** People in address confidentiality programs (substitute or withheld addresses), military and overseas voters (UOCAVA), and voters without home delivery (P.O. boxes, rural routes, people experiencing homelessness) use the election office's check or an in-person check. A user never types in a substitute mailing address.
6. **Mass requests and harassment.** At most one code per voter record per 30 days. No more outstanding codes per address than active voters registered there, and a monthly cap per address. Every request gets the same response whether or not a cap was hit, so the caps don't reveal household size. Addresses with many active records (care homes, dorms, shelters) are routed to assisted or election-office checks. Requests use a bot check that doesn't track visitors across sites; network addresses are kept no more than 24 hours, only for rate limits, and limits allow for shared networks (libraries, phone carriers). A published daily mailing cap protects the budget.
7. **Guessing codes.** Codes are random, single-use, tied to one record, expire in 30 days, and lock after 5 wrong tries (then a new letter or another check).
8. **Insiders.** Letters are printed by the host or the election office, not the convener. The address is used once for printing and then deleted; only districts are kept. Staff doing in-person checks compare ID to the record and copy nothing.
9. **Public monitoring.** Per district, weekly: codes mailed, claims made, taken back, and cancelled, plus the check that verified voters never outnumber registered voters. A count is shown only when it's at least 10 (smaller counts show as "fewer than 10"), so small towns and special districts can't point to a person.

10. **Fake sign-ups at scale.** "Verified voters never outnumber registered voters" is a weak bound on its own. Added checks: each district publishes verified voters as a share of registered voters, with unusual jumps flagged; an independent auditor sends a confirmation letter to a random sample of claimed voter records (asking only "did you sign up?", nothing about votes) and publishes the confirmation rate; claims on records the election office later removes (moved, deceased) are counted and published.
11. **Small organized groups.** Consensus labels count a group only once it has at least 10 votes on that statement, and need at least two such groups. The common-ground step and the office's package show turnout as a share of registered voters, beside the citizen panel. Planned: a public daily timeline of votes and sign-ups so coordinated bursts are visible.

To be reviewed with the host's counsel, each state's legal review (which voter-list fields and mailings are allowed, address confidentiality programs), and the independent security review.

## Office identity design (planned)

Goal: nothing can appear as an office's public response unless that office really sent it, and the public can check that. A fake response (or a real one later disowned) is among the most damaging failures for trust, so office accounts get stronger controls than any other part of the system.

1. **Confirming the office, out of band.** The host confirms each seat through official channels, never through contact details supplied by whoever asks: it writes to the office at the contact in the chamber's or government's own published directory and asks the office to designate an office administrator. Creating or re-confirming an office account needs two host staff to approve.
2. **Official domains.** The registry lists each government's official email domains with sources (e.g., house.gov, senate.gov, a legislature's domain). Office accounts can only use addresses on those domains. Lookalike domains are rejected.
3. **Phishing-resistant sign-in.** Every office account uses a passkey or security key (WebAuthn), one account per person. No shared logins. Account recovery happens only by re-confirming through official channels, never by a help-desk reset.
4. **Roles.** Staff can draft; only designated approvers can publish. Every public response names its approver (as the core design requires).
5. **Signed responses.** Each response is signed with the office's signing key and added to the public, append-only record with its signature, so anyone can verify it came from that office account. Each response has a permanent page; screenshots can be checked against it.
6. **Public change log.** Every change to who can post for an office (added, removed, re-confirmed, keys rotated) is published with dates, without personal contact details.
7. **Disputes.** If an office reports that it didn't send a response, the response is labeled "Under review: the office says it didn't send this" at once. The host investigates, publishes the outcome, revokes compromised keys, and keeps the original in the record with the label.
8. **Term changes.** The new officeholder's start date comes from official sources (certification and swearing-in). Outgoing staff access ends that day; the signing key is rotated; the new office is confirmed the same way. Open packages and the full record pass to the seat; "No response yet" keeps counting.
9. **Host insiders.** Host staff cannot post as an office. Host actions on office accounts are logged and published in the change log.
10. **No secrets by email or phone.** Civic Accord never asks an office for a password or code by email or phone; the office onboarding guide says so.

To be reviewed in the independent security review, and with each chamber's rules on official communications.

