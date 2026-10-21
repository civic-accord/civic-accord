# Civic Accord pack format (version 1)

A **pack** adapts Civic Accord to one government and one issue. It is a plain JSON file. Anyone can write one: a county clerk, a librarian, a university class. No programming is needed, and nothing in a pack can run code or affect how votes are counted.

The core reads every pack the same way. Pack text is always shown as plain text, never as HTML, and links must start with `https://`.

## Files

- `packs/index.json` lists the live packs and which government each one belongs to.
- Each pack is one file, named `<place>-<body>-<issue>.json`, for example `hi-state-invasive.json`.

## Structure

```
{
  "id": "hi-state-invasive",
  "format": 1,
  "jurisdiction": { ... who decides },
  "issue": { ... what is being decided },
  "bill": { ... how proposals are written },
  "copyTitle": "Invasive species, Hawaiʻi State Legislature"
}
```

### jurisdiction

| Field | What it holds |
| --- | --- |
| `key` | Short id, for example `state`, `federal`, `maui-county` |
| `name` | Full name, for example "Hawaiʻi State Legislature" |
| `level` | `federal`, `state`, `county`, `city`, `school`, or `special` |
| `district` | The district shown to participants |
| `session` | When the body next meets to take up bills |
| `drafting` | Who writes final legal text for a sponsor |
| `residents` | Population used for per-resident costs |
| `residentLabel` | For example "Hawaiʻi resident" |
| `residentNote` | Plain sentence naming the population figure and year |
| `registeredVoters` | Optional: the number of registered voters for the population above, so results can show what share took part |
| `registeredVotersLabel` | Optional plain label for that number, saying its scope, for example `registered voters in Hawaiʻi (statewide)` |
| `registeredVotersSource` | `{ "url", "label" }` for that number, from the election office |
| `populationSource` | `{ "url", "label" }` for that figure |
| `baseline` | `{ "amount", "label" }`: current spending to compare totals against |
| `generalFundName` | For example "the general fund" |
| `generalFundTradeoff` | What else that money pays for |
| `representativeTitle` | For example "legislator", "council member" |
| `handoffTitle`, `handoffText`, `timing` | Hand-off step wording |
| `receiptPrefix` | Two letters on vote receipts, for example `HI` |
| `elections` | Upcoming elections for this body: list of `{ "name", "date" }` (YYYY-MM-DD). Updated each cycle |
| `electionsSource` | `{ "url", "label" }` for those dates |
| `offices` | The seats that receive packages (below) |

#### offices

The conversation is with an office (a seat), not a person. Each seat carries the rules its own law sets.

| Field | What it holds |
| --- | --- |
| `key`, `title`, `where` | For example `state-house`, "State House seat", "Maui district" |
| `holder`, `term`, `onBallot` | Current officeholder, term length, and whether they are a candidate in the next election |
| `preElection` | The limit on official mass communications before elections (below) |

`preElection`:

| Field | What it holds |
| --- | --- |
| `basis` | `law`, `chamber rule`, or `none` when no law or rule applies |
| `summary` | The rule in one plain sentence |
| `window` | `{ "type": "daysBefore", "days" }` or `{ "type": "range", "from", "to", "fromLabel", "toLabel" }` |
| `onlyIfCandidate` | `true` when the law applies only if the officeholder is on the ballot |
| `citations` | List of `{ "url", "label" }` for the law or rule, or for where it says none exists |
| `verified` | `true` only after a reviewer has checked the rule against its source |
| `note` | Anything a reader needs: thresholds, exemptions, open questions |

The tool pauses office-initiated deliberation requests during that window. Residents can still deliberate, and offices can still respond.

#### disclosures (planned)

A list of `{ "who", "stake" }`: the pack author's and reviewers' personal or financial stakes in the issue, in plain words, or `"none"`. Published with the pack.

#### review (planned)

| Field | What it holds |
|---|---|
| `reviewers` | Two reviewers' roles (not names), drawn at random from the host's pool |
| `checklist` | Each check (facts sourced, law correct, costs labeled, statements fair) with its result |
| `changes` | What the reviewers asked to change, and what changed |
| `objections` | The 7-day public objection period: dates, link, and each objection with its answer |
| `status` | `needed`, `in review`, `objection period`, or `done` |

#### legalReview

Legal review happens in two layers. The **core** layer covers law that is the same everywhere (federal law, privacy, the host's obligations) and is reviewed once by the host's counsel. The **jurisdiction** layer covers each government's own rules and is reviewed by someone with local expertise, such as a law school clinic or bar pro bono program in that state.

| Field | What it holds |
| --- | --- |
| `layer` | `core` or `jurisdiction` |
| `status` | `needed`, `in review`, or `done` |
| `reviewer`, `date` | Who reviewed it and when |
| `suggested` | Who could review it, while unassigned |
| `scope` | What the review covers |
| `cadence` | When it is repeated, for example each election cycle |

A pack can't go live until its legal review is `done`.

### issue

| Field | What it holds |
| --- | --- |
| `key`, `name`, `title` | Issue id, short name, page title |
| `facts` | List of `[label, sentence]`. Every fact needs a source in `sources` |
| `lists` | List of `[heading, [items]]` |
| `sources`, `costSources` | List of `[url, label]` |
| `groups` | Two plain descriptions of the opinion groups (written after voting, from the votes) |
| `exampleVotes` | `true` while the votes shown are invented examples |
| `statements` | Seed statements: `{ "id", "text", "a": [agree, disagree, pass], "b": [...], "panel": [...] }`. `panel` is optional: citizen panel results. Every count comes from verified voters only; there is no separate view for anyone else |
| `participation` | Optional: `{ "open", "panel", "makeup": { "columns", "rows" } }` comparing who took part with the district. |
| `costOptions` | What could be funded (below) |
| `revenue` | How it could be paid for (below) |

#### costOptions

Each option links to the statement it puts a price on.

| Field | What it holds |
| --- | --- |
| `statement` | Id of the statement this prices |
| `name` | Short name |
| `unit` | What is counted, for example "inspectors". Use `"million dollars"` for a lump sum, `""` for a single item |
| `min`, `max`, `step`, `default` | Slider range |
| `unitCost` | Cost of one unit, in dollars |
| `recurring` | `true` for yearly costs, `false` for one-time |
| `impact` | Sentence describing what this buys |
| `basis` | **Required.** How the cost was estimated, and from what |
| `billText` | Clause for the draft bill |

A statement can also carry its own `billText`. It becomes a provision of the draft only if that statement reaches common ground. A statement that has a cost option uses the cost option's `billText` instead, and only when that option is turned on.

Templates you can use in `impact` and `billText`:

- `{n}` the number chosen, with commas (12,000)
- `{total}` the total, short form ($2.4M)
- `{dollars}` the total, in full ($2,400,000)

#### revenue

| `type` | Fields | Meaning |
| --- | --- | --- |
| `fee` | `statement`, `name`, `perDollar`, `max`, `step`, `payers`, `note`, `billText` (may use `{fee}`) | A fee whose rate residents choose; `perDollar` is the yearly revenue for each $1 |
| `fixed` | `statement`, `name`, `amount`, `note`, `billText` | A fixed yearly amount, for example added fine revenue |
| `unestimated` | `statement`, `name`, `note` | Revenue that exists but has no reliable estimate yet. Shown, never counted |

### bill

| Field | What it holds |
| --- | --- |
| `kind` | Optional: `bill` (the default) or `policy`, for a practice an office can adopt on its own |
| `label` | Optional heading for the draft, for example `Starting office policy` |
| `centerLines` | Centered heading lines in the body's official format |
| `preamble` | Opening sections, ending with the line that introduces the numbered provisions |
| `sectionWord` | For example `SECTION` or `SEC.` |
| `firstSection` | Number of the first section after the preamble |
| `appropriation` | `style: "state"` with `general`, `special`, and `text` using `{source}`; or `style: "authorization"` with `text` using `{amount}` |
| `effective` | Effective-date section text |

## Rules every pack must follow

1. Every rule the tool applies comes from the government's own law or chamber rules, cited. Where no law applies, the tool adds no rule of its own. Rules not yet checked against their source are shown as unconfirmed.
2. Every fact and every cost has a source or a stated method.
3. Wording is neutral. Statements are written so people on different sides can vote on them honestly.
4. Unknowns stay unknown. If a cost or revenue figure can't be estimated reliably, use `unestimated` rather than guessing.
5. Packs are checked by two reviewers (one from each of two partner groups), the review is published, and anyone can object for 7 days before they go live. Every change is kept in the public history.
