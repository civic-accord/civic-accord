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
| `populationSource` | `{ "url", "label" }` for that figure |
| `baseline` | `{ "amount", "label" }`: current spending to compare totals against |
| `generalFundName` | For example "the general fund" |
| `generalFundTradeoff` | What else that money pays for |
| `representativeTitle` | For example "legislator", "council member" |
| `handoffTitle`, `handoffText`, `timing` | Hand-off step wording |
| `receiptPrefix` | Two letters on vote receipts, for example `HI` |
| `elections` | Upcoming elections for this body: list of `{ "name", "date" }` (YYYY-MM-DD) |
| `electionsSource` | `{ "url", "label" }` for those dates |
| `quietPeriodDays` | Days before each election when offices can't start new deliberations (default 60). Residents can still deliberate and offices can still respond |

### issue

| Field | What it holds |
| --- | --- |
| `key`, `name`, `title` | Issue id, short name, page title |
| `facts` | List of `[label, sentence]`. Every fact needs a source in `sources` |
| `lists` | List of `[heading, [items]]` |
| `sources`, `costSources` | List of `[url, label]` |
| `groups` | Two plain descriptions of the opinion groups (written after voting, from the votes) |
| `exampleVotes` | `true` while the votes shown are invented examples |
| `statements` | Seed statements: `{ "id", "text", "a": [agree, disagree, pass], "b": [...], "panel": [...] }`. `panel` is optional: citizen panel results |
| `participation` | Optional: `{ "open", "panel", "makeup": { "columns", "rows" } }` comparing who took part with the district |
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
| `centerLines` | Centered heading lines in the body's official format |
| `preamble` | Opening sections, ending with the line that introduces the numbered provisions |
| `sectionWord` | For example `SECTION` or `SEC.` |
| `firstSection` | Number of the first section after the preamble |
| `appropriation` | `style: "state"` with `general`, `special`, and `text` using `{source}`; or `style: "authorization"` with `text` using `{amount}` |
| `effective` | Effective-date section text |

## Rules every pack must follow

1. Every fact and every cost has a source or a stated method.
2. Wording is neutral. Statements are written so people on different sides can vote on them honestly.
3. Unknowns stay unknown. If a cost or revenue figure can't be estimated reliably, use `unestimated` rather than guessing.
4. Packs are reviewed by a second person before they go live, and every change is kept in the public history.
