# Bronx Housing Violation Recurrence

**[Explore the analysis →](https://housing-violations-recurrence.vercel.app/)**

A data journalism site analyzing 653K+ NYC HPD housing violation records to answer one question: **when a housing violation is marked "closed," does the problem actually go away?**

A Node pipeline analyzes the data at build time, and the deployed React site serves only precomputed static files—no live API dependency or exposed credentials.

![Hero section](docs/screenshots/hero.png)

## The finding

Across 431,572 closed violations in the Bronx (2024–2026), **81% recur within a year**. Class C ("immediately hazardous") violations recur at nearly the same rate as lower-severity ones, suggesting the close-out process—not violation severity—is the weak point. The site explores the pattern by category, neighborhood, and property owner.

![Neighborhood choropleth](docs/screenshots/neighborhoods.png)

## Technical highlights

- **Scalable ingestion.** Pulls from NYC Open Data's 8.3M+ row citywide dataset using keyset pagination (`WHERE id > last_seen_id`) so fetch performance does not degrade like `OFFSET` pagination.
- **Statistically sound comparisons.** Recent closures without a full 365-day observation window are treated as censored rather than false negatives. Rate-based rankings also require minimum sample sizes to limit small-sample noise.
- **Messy-data modeling.** Extracts violation categories from free-text legal citations and separates annual compliance filings from repeat-repair failures so they do not distort the analysis.
- **Secure, automated delivery.** Keeps the API token in a gitignored `.env`, ships only precomputed JSON/GeoJSON to the browser, and refreshes the data monthly through GitHub Actions.

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

The standalone pipeline fetches and caches source records, computes all aggregations, trims official NYC neighborhood boundaries, and writes the static assets consumed by the React app.

## Running locally

```bash
npm install
echo "SOCRATA_APP_TOKEN=your_token_here" > .env   # get a free token at dev.socrata.com
npm run fetch-data   # rebuilds public/data/ (~3.5 min for a fresh pull)
npm run dev
```

## Data & limitations

Source: [NYC HPD Housing Maintenance Code Violations](https://data.cityofnewyork.us/Housing-Development/Housing-Maintenance-Code-Violations/wvxf-dwi5). These records are not verified ground truth: they cannot distinguish neglect from a genuinely difficult repair. Owner analysis is also limited to HPD registration numbers because the dataset does not include owner names.
