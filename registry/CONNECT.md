# Connect your government

Civic Accord lists a local government's public meetings on Issues when its agenda system is connected. Connecting one takes one entry in `registry/local-feeds.json`. No account, no key, no code. Anyone can do it: a resident, a clerk, a civics class, a League chapter.

## What you need

1. **Which agenda system the government uses.** Open its meeting calendar or agendas page and look at the address:
   - `https://<name>.legistar.com/Calendar.aspx`: **Legistar**; `<name>` is the `client`.
   - `https://<name>.granicus.com/ViewPublisher.php?view_id=<N>`: **Granicus**; the host is `<name>.granicus.com` and `viewId` is `<N>`. Civic Accord reads only the agenda feed the system publishes for subscribers.
   - `https://<the government's own site>/AgendaCenter`: **CivicPlus** (also called CivicEngage); the `host` is the site's host, for example `nevadamo.gov`.
   Readers for other systems (BoardDocs, PrimeGov, eScribe) are planned; see the coverage plan in the review doc.
2. **Its Census ID.** Only residents of that government can respond to its meetings, so each entry carries the Census GEOID:
   - county: the 5-digit county code (state + county), for example `15009` for Maui County, Hawaiʻi;
   - city or village: the 7-digit place code (state + place), for example `0653000` for Oakland, California;
   - town or township: the 10-digit county-subdivision code.
   Find them at the [Census Bureau's geocoder](https://geocoding.geo.census.gov/geocoder/geographies/address?form): enter any address in that government, choose "Current" benchmark and vintage, and read the GEOID from the Counties, Incorporated Places, or County Subdivisions result.
3. **Its time zone**, as an IANA name such as `America/Chicago`, so tonight's meetings aren't dropped early.

## The entry

Add this to the `feeds` list in `registry/local-feeds.json`, with your government's values:

```json
{
 "id": "ca-san-jose",
 "name": "San Jose City Council",
 "state": "CA",
 "level": "city",
 "placeId": "0668000",
 "system": "legistar",
 "client": "sanjose",
 "calendar": "https://sanjose.legistar.com/Calendar.aspx",
 "note": "Council, committee, and other public meetings. Each meeting page and agenda says how to comment.",
 "tz": "America/Los_Angeles",
 "source": "https://www.sanjoseca.gov/your-government/departments-offices/city-clerk"
}
```

For Granicus, replace `"client"` with `"host": "eagle-id.granicus.com", "viewId": "10"` and set `"system": "granicus"`. For CivicPlus, replace `"client"` with `"host": "nevadamo.gov"` and set `"system": "civicplus"`.

Fields: `id` is the state code, a dash, and a short lowercase name. `level` is `county`, `city`, `town`, `township`, or `school`. Use `countyId` for a county, `placeId` for a city or village, `townId` for a town or township. `source` is a page on the government's own site that points to its agenda system, so a reviewer can confirm the client is really theirs.

## Check it

```
node scripts/check-feeds.js          # fields and IDs
node scripts/check-feeds.js --live   # also asks the agenda system for the next 30 days of meetings
```

The first check runs automatically on every change. The live check needs a network connection and shows the first meeting found, so you can confirm it's the right government.

## Send it

Open a pull request on [github.com/civic-accord/civic-accord](https://github.com/civic-accord/civic-accord) with the one entry and a line saying who you are (a resident, a clerk, a group). A reviewer confirms the client against the `source` page and merges. Within a few hours the government's meetings appear on Issues for residents of that state, and residents inside its boundary can respond.

## What residents see

Each meeting is listed by body and date, with a link to the official agenda and meeting page. Civic Accord adds nothing: no summaries, no rewording. The meeting page and agenda say how to comment. Only residents of that county, city, or town can react or keep a record; everyone can read.
