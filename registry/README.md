# Open representative lookup

Google shut down its free Representatives API in 2025. This is an open replacement: an address goes in, and every government that represents it comes out, with each office's branch, how it's chosen, and whether it can receive proposals through Civic Accord.

## How it works

1. **Districts.** The browser sends the address straight to the [U.S. Census Bureau Geocoder](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html) (JSONP, no key). It returns the state, county, congressional district, state house and senate districts, incorporated place, active county subdivision (towns and townships), and school districts. The address never passes through Civic Accord.
2. **Offices.** `us.json` describes federal offices and general state defaults. Each state file (`hi.json`, ...) adds what's specific: chamber names, terms, how offices are chosen, county councils keyed by county FIPS code, statewide bodies, and notes such as "no city governments."
3. **Officeholders.** Members of Congress come from the public-domain [congress-legislators](https://github.com/unitedstates/congress-legislators) dataset. The tool shows names and official sites only, never party.

Census-designated places are statistical areas, not governments, so they are ignored. Special districts (water, fire, transit) aren't in the Census lookup yet; local hosts add them.

## Adding a state

Planned field: `officialEmailDomains`, a list of the government's official email domains with a source for each, used to confirm office accounts (see SECURITY.md, Office identity design). Leave it out if a government has none; those offices are confirmed by letter or at a public meeting.

Copy `hi.json` to `<state>.json` (two-letter code, lowercase). Every entry needs a source in `sources`, and the file is reviewed in that state's legal review like any pack. `civic` is one of `receives`, `possible`, `later`, or `never` (courts are always `never`).

## Who can take part

`eligibility` in a state file sets how voter registration status is confirmed under that state's law. Only active registered voters in the district can vote or add statements; there is no separate result for anyone else. In Hawaiʻi, a voter's name, district or precinct, and voter status are public for any purpose (HRS § 11-97, HAR § 3-177-160), so the check matches only those. States without an entry fall back to `us.json`'s `eligibilityDefault`, where status is self-reported and labeled that way. `participants` is a plain sentence saying who can take part, kept with the state's data for reviewers. Preregistration ages in `states.json` are shown in Civic Accord Learn, not used to let anyone take part.

## Local agenda feeds

`local-feeds.json` lists local governments whose public meeting agendas Civic Accord reads automatically (today: Maui County Council and Oakland City Council, through Legistar's public data service). Lists are downloaded by the scheduled job (api/refresh.js) about every 3 hours and saved; the Issues page reads the saved copy, so adding governments never slows a visit. Each entry gives the government's name, state, level, Census county, place, or town/township ID (`countyId`, `placeId`, `townId`, so only residents can respond), and its agenda system. Adding a government that uses the same system takes one entry.

To connect a government, follow [CONNECT.md](CONNECT.md): one entry, checked by `node scripts/check-feeds.js`.

**Goal: load every municipality whose agendas are publicly available.** Next: check other governments on the same agenda system (for example, San Jose and Long Beach share data publicly), then add readers for other common agenda systems so more cities, counties, and school boards can be connected.
