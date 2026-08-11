# Bronx Housing Violation Recurrence

**[Live site →](https://housing-violations-recurrence.vercel.app/)**

A data journalism site analyzing 653K+ NYC HPD housing violation records to answer one question: **when a housing violation gets marked "closed," does the problem actually go away?**

Built with a fully static architecture — a Node pipeline pulls and analyzes the data once at build time, so the deployed site never touches the source API or exposes any credentials.

![Hero section](docs/screenshots/hero.png)

## The finding

Across 431,572 closed violations in the Bronx (2024–2026), **81% had a repeat violation** — the same building, same HPD order number, recorded again within a year — among the cases with enough follow-up time to know either way. Severity barely predicts it: Class B and Class C violations repeat at nearly identical rates (83.6% vs. 82.8%), both well above Class A (74.7%) — the most urgent violations aren't any less likely to come back than the merely-hazardous ones. The site breaks this down by severity, violation category (with a from-scratch classification system, see below), neighborhood, and property owner, with a methodology section covering the statistical choices behind the numbers.

![Neighborhood choropleth](docs/screenshots/neighborhoods.png)

## Why this project is interesting technically

- **Real dataset, real scale.** Not a toy CSV — pulls directly from NYC Open Data's Socrata API (8.3M+ rows citywide before filtering), using **keyset pagination** (`WHERE id > last_seen_id`, not `OFFSET`) so fetch time stays linear instead of degrading as the dataset grows.
- **Survival-analysis-style censoring.** A violation closed 3 weeks ago hasn't had a fair chance to repeat within the 365-day window yet — counting it as a negative would bias the rate downward. Those cases are explicitly tracked as **censored** and excluded from the rate, not silently miscounted.
- **A 4-category violation classification system, built by actually reading the data.** The raw dataset has no "is this a physical repair vs. paperwork vs. a legal order" field — violation types are extracted from free-text legal citations, then hand-audited into `physical_condition` / `administrative_or_posting` / `enforcement_or_legal_status` / `mixed_or_unresolved`, with every judgment call documented inline in the source. Chasing down the generic "unclassifiable" bucket surfaced three genuinely distinct real violation types hiding inside it (including a bedbug-law requirement that isn't the same as the two other bedbug-related violation types already identified), resolved with narrowly-scoped text normalization — validated against all 653K raw rows, not just the visible sample.
- **A denominator bug in the main chart, caught before it shipped.** The overall-recurrence donut originally plotted three segments (repeat / no-match / too-recent) by raw count, so the chart's *visual* proportions were a share of all closed violations while the headline "81%" was a share of only the classifiable subset — same numbers, different bases, silently inconsistent. Fixed by extracting the math into a standalone, tested module (`src/lib/donut.js`) so the chart's geometry and its headline number are provably using the same denominator, with too-recent cases reported separately instead of folded into a misleading third slice.
- **A neighborhood map legend that doesn't lie by omission.** Fixed, hand-chosen rate bins (not quantiles, so a bin's meaning doesn't silently shift on the next data refresh), an explicit gray "insufficient data" bucket instead of coloring low-volume neighborhoods as if their rate were trustworthy, and a choropleth that's keyboard- and touch-accessible — not hover-only — with a full data table underneath for anyone who wants exact numbers without pointing at a map.
- **Volume-floor guardrails explained, not just applied.** Every rate-based ranking (violation type, neighborhood, owner) requires at least 25 classifiable cases before a rate is shown. The methodology section makes the reasoning concrete with side-by-side illustrative examples (1-for-1 = 100%, meaningless; 22-for-25 = 88%, usable) instead of a chart — the same point, without a charting dependency or an axis a reader has to interpret.
- **A real test suite, not just a working demo.** 31 tests via Node's built-in `node:test` runner — zero new dependencies, matching the pipeline's existing native-fetch, no-HTTP-library philosophy. Tests cover the classification/eligibility logic, that every category bucket is mutually exclusive and accounted for, the donut's numerator/denominator/reconciliation math, and that the map's legend bins have no gaps or overlaps against the real generated data — run with `npm test`.
- **Security-conscious pipeline design.** The Socrata API token lives only in a gitignored `.env`, read only inside a standalone Node script (`scripts/fetch-data.js`) that never ships to the browser. The React app only ever fetches pre-computed static JSON — no live API calls, no credentials in the client bundle, deployable anywhere as pure static files.
- **Debugged real rendering bugs, not just logic bugs.** Caught and fixed a Chromium compositing issue where Leaflet's internally-transformed map panes could visually bleed through a sibling `position: sticky` nav bar despite correct z-index — root-caused via live `getBoundingClientRect()`/computed-style inspection rather than guessing, and fixed with a proper CSS stacking-context boundary (`isolation: isolate`).
- **Automated data refreshes.** A scheduled GitHub Actions workflow re-runs the fetch pipeline monthly and commits updated data automatically, so the analysis doesn't go stale.

## Tech stack

| Layer | Choice |
|---|---|
| Data pipeline | Node.js (native `fetch`, no HTTP client dependency) |
| Frontend | React 19 + Vite |
| Charts | Recharts (bar, donut) |
| Map | react-leaflet + Leaflet, custom single-hue choropleth with fixed legend bins |
| Testing | `node:test` (built-in, zero dependencies) |
| Styling | Hand-written CSS, no framework |
| Automation | GitHub Actions (scheduled cron + manual dispatch) |

## Architecture

```
scripts/fetch-data.js   →  public/data/*.json, *.geojson   →   React app (static fetch only)
   (Node, build-time,          (committed, static)               (browser, no API calls)
    reads .env token)
```

`scripts/fetch-data.js` is a standalone script — never imported by the app — that:
1. Pulls Bronx violations from Socrata via keyset pagination, with a local disk cache to avoid re-hitting the API during development
2. Computes repeat-violation status, censoring, and severity/neighborhood/owner/violation-type aggregations, including the 4-category classification described above
3. Pulls and trims official NYC NTA (neighborhood) boundary polygons for the choropleth
4. Writes everything to small static JSON/GeoJSON files under `public/data/`

The React app (`src/`) only ever reads those static files via `fetch('/data/...')` — it has no knowledge of Socrata, the API token, or any live data source. Pure data-shaping logic that needs to be correct (the donut's math, the map's legend bins) lives in small, independently-tested modules under `src/lib/`.

## Running locally

```bash
npm install
echo "SOCRATA_APP_TOKEN=your_token_here" > .env   # get a free token at dev.socrata.com
npm run fetch-data   # pulls + rebuilds public/data/ (~3.5 min for a fresh pull)
npm run dev
```

`npm run fetch-data` only needs to be re-run when you want fresh data — the site itself (`npm run dev` / `npm run build`) just reads the already-generated static files.

Run the test suite with `npm test` (31 tests, no build step required).

## Data & limitations

Source: [NYC HPD Housing Maintenance Code Violations](https://data.cityofnewyork.us/Housing-Development/Housing-Maintenance-Code-Violations/wvxf-dwi5) (Socrata dataset `wvxf-dwi5`). This data tracks violation *records*, not verified ground truth — a repeat violation record doesn't establish that the same physical condition returned or that a repair failed, and it can't distinguish a landlord neglecting a repair from a genuinely hard-to-fix piece of infrastructure. The violation-category classification (physical condition vs. administrative vs. enforcement) is a hand-reviewed best effort against free-text legal citations, not an official HPD taxonomy — a small number of codes are honestly labeled "could not confidently classify" rather than forced into a bucket. Owner-level analysis is limited to HPD registration numbers since the dataset doesn't include owner names (a full portfolio view would require joining HPD's separate Registration Contacts dataset).
