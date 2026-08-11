// Standalone Node script. Never imported by the Vite/React app.
// Run with: node scripts/fetch-data.js
//
// Pulls Bronx HMC violations from Socrata, then aggregates everything
// into small static JSON files under public/data/ for the frontend.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

process.loadEnvFile('.env');

const APP_TOKEN = process.env.SOCRATA_APP_TOKEN;
if (!APP_TOKEN) {
  console.error('SOCRATA_APP_TOKEN is not set in .env — aborting.');
  process.exit(1);
}

const BASE_URL = 'https://data.cityofnewyork.us/resource/wvxf-dwi5.json';
const SELECT_FIELDS = [
  'violationid', 'buildingid', 'registrationid', 'boro', 'class',
  'inspectiondate', 'certifieddate', 'ordernumber', 'novdescription',
  'currentstatus', 'currentstatusdate', 'violationstatus', 'nta',
  'housenumber', 'streetname',
].join(',');

const START_DATE = '2024-08-10T00:00:00'; // 2 years of history from run date
const PAGE_LIMIT = 50000;
const RATE_VOLUME_FLOOR = 25; // min eligible closed violations before ranking by rate
const RECURRENCE_WINDOW_DAYS = 365;

const CACHE_DIR = path.resolve('.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'raw-violations.json');
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const OUTPUT_DIR = path.resolve('public/data');

const NOW = new Date();

async function fetchPage(afterId) {
  const where = afterId
    ? `boro='BRONX' AND inspectiondate >= '${START_DATE}' AND violationid > '${afterId}'`
    : `boro='BRONX' AND inspectiondate >= '${START_DATE}'`;

  const url = new URL(BASE_URL);
  url.searchParams.set('$select', SELECT_FIELDS);
  url.searchParams.set('$where', where);
  url.searchParams.set('$order', 'violationid');
  url.searchParams.set('$limit', String(PAGE_LIMIT));

  const res = await fetch(url, {
    headers: {
      'X-App-Token': APP_TOKEN,
      'Accept-Encoding': 'gzip',
    },
  });

  if (!res.ok) {
    throw new Error(`Socrata request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function fetchAll() {
  const rows = [];
  let afterId = null;
  let page = 0;

  for (;;) {
    page += 1;
    const batch = await fetchPage(afterId);
    console.log(`  page ${page}: ${batch.length} rows`);
    if (batch.length === 0) break;

    rows.push(...batch);
    afterId = batch[batch.length - 1].violationid;

    if (batch.length < PAGE_LIMIT) break; // last page was partial, we're done
  }

  return rows;
}

function loadCacheIfFresh() {
  if (!existsSync(CACHE_FILE)) return null;
  const stat = readFileSync(CACHE_FILE, 'utf-8');
  const parsed = JSON.parse(stat);
  const age = NOW - new Date(parsed.fetchedAt);
  if (age > CACHE_MAX_AGE_MS) return null;
  console.log(`Using cached raw pull from ${parsed.fetchedAt} (${parsed.rows.length} rows)`);
  return parsed.rows;
}

function saveCache(rows) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify({ fetchedAt: NOW.toISOString(), rows }));
}

// --- Analysis -----------------------------------------------------------

function effectiveCloseDate(row) {
  if (row.certifieddate) return new Date(row.certifieddate);
  if (row.violationstatus === 'Close' && row.currentstatusdate) {
    return new Date(row.currentstatusdate);
  }
  return null;
}

// Bedbug annual-notice filings (§27-2018.1) are a recurring paperwork
// requirement, not a repaired-and-failed-again violation — flagged so the
// frontend doesn't lump it in with genuine repeat-repair failures.
function classifyViolationType(novdescription) {
  const match = /§\s?[\d]+(?:\.\d+)?(?:-[\d]+(?:\.\d+)?)?/.exec(novdescription || '');
  const code = match ? match[0].replace(/\s/g, '') : 'UNKNOWN';
  const isComplianceCadence = code === '§27-2018.1';
  return { code, isComplianceCadence };
}

// The "how much time has passed" reference for censoring should be the
// most recent date actually present in the data, not wall-clock "now" —
// Socrata's ingestion can lag a few days behind real time, and using real
// "now" would treat that gap as if we'd confirmed no recurrence happened,
// when we simply don't have data covering it yet.
function computeDataCutoff(rows) {
  let max = new Date(0);
  for (const row of rows) {
    for (const field of ['inspectiondate', 'certifieddate', 'currentstatusdate']) {
      if (!row[field]) continue;
      const d = new Date(row[field]);
      if (d > max) max = d;
    }
  }
  return max;
}

function buildEligibility(rows, dataCutoff) {
  const byKey = new Map(); // buildingid|ordernumber -> [{violationid, inspectiondate}]
  for (const row of rows) {
    const key = `${row.buildingid}|${row.ordernumber}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ violationid: row.violationid, inspectiondate: new Date(row.inspectiondate) });
  }
  for (const list of byKey.values()) {
    list.sort((a, b) => a.inspectiondate - b.inspectiondate);
  }

  const eligible = [];
  for (const row of rows) {
    const closeDate = effectiveCloseDate(row);
    if (!closeDate) continue;

    const key = `${row.buildingid}|${row.ordernumber}`;
    const siblings = byKey.get(key);
    const windowEnd = new Date(closeDate.getTime() + RECURRENCE_WINDOW_DAYS * 86400000);

    const recurred = siblings.some(
      (s) => s.violationid !== row.violationid && s.inspectiondate > closeDate && s.inspectiondate <= windowEnd
    );

    let status;
    if (recurred) {
      status = 'recurred';
    } else if (dataCutoff - closeDate >= RECURRENCE_WINDOW_DAYS * 86400000) {
      status = 'no_recurrence';
    } else {
      status = 'censored';
    }

    eligible.push({ row, status });
  }
  return eligible;
}

function rate(recurred, noRecurrence) {
  const denom = recurred + noRecurrence;
  return denom === 0 ? null : recurred / denom;
}

function summarize(items) {
  const recurred = items.filter((i) => i.status === 'recurred').length;
  const noRecurrence = items.filter((i) => i.status === 'no_recurrence').length;
  const censored = items.filter((i) => i.status === 'censored').length;
  return { recurred, no_recurrence: noRecurrence, censored, total: items.length, rate: rate(recurred, noRecurrence) };
}

function buildOverallSummary(eligible, dataCutoff) {
  const summary = summarize(eligible);

  const byBuilding = new Map();
  for (const { row, status } of eligible) {
    if (status === 'censored') continue;
    if (!byBuilding.has(row.buildingid)) byBuilding.set(row.buildingid, []);
    byBuilding.get(row.buildingid).push(status);
  }
  const buildingsWithData = byBuilding.size;
  const buildingsWithRecurrence = [...byBuilding.values()].filter((statuses) =>
    statuses.includes('recurred')
  ).length;

  return {
    ...summary,
    building_any_recurrence_rate:
      buildingsWithData === 0 ? null : buildingsWithRecurrence / buildingsWithData,
    buildings_with_data: buildingsWithData,
    date_range_start: START_DATE,
    data_cutoff: dataCutoff.toISOString(),
    last_updated: NOW.toISOString(),
    total_rows_fetched: null, // filled in by caller
  };
}

function buildByClass(eligible) {
  const order = ['A', 'B', 'C'];
  const groups = new Map(order.map((c) => [c, []]));
  for (const item of eligible) {
    const cls = item.row.class;
    if (!groups.has(cls)) groups.set(cls, []);
    groups.get(cls).push(item);
  }
  return order
    .filter((c) => groups.has(c))
    .map((c) => ({ class: c, ...summarize(groups.get(c)) }));
}

function buildByViolationType(eligible) {
  const groups = new Map();
  for (const item of eligible) {
    const { code, isComplianceCadence } = classifyViolationType(item.row.novdescription);
    if (!groups.has(code)) {
      groups.set(code, { items: [], isComplianceCadence, sampleDescription: item.row.novdescription });
    }
    groups.get(code).items.push(item);
  }

  return [...groups.entries()]
    .map(([code, g]) => ({
      code,
      description: g.sampleDescription.slice(0, 140).trim(),
      is_compliance_cadence: g.isComplianceCadence,
      ...summarize(g.items),
    }))
    .filter((g) => g.recurred + g.no_recurrence >= RATE_VOLUME_FLOOR)
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
}

function buildByNeighborhood(eligible) {
  const groups = new Map();
  for (const item of eligible) {
    const nta = item.row.nta || 'UNKNOWN';
    if (!groups.has(nta)) groups.set(nta, []);
    groups.get(nta).push(item);
  }
  return [...groups.entries()]
    .map(([nta, items]) => ({ nta, ...summarize(items) }))
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
}

function buildByOwner(eligible) {
  const groups = new Map();
  for (const item of eligible) {
    const regId = item.row.registrationid;
    if (!regId || regId === '0') continue; // placeholder for missing registration
    if (!groups.has(regId)) groups.set(regId, []);
    groups.get(regId).push(item);
  }

  const all = [...groups.entries()].map(([registrationid, items]) => ({
    registrationid,
    ...summarize(items),
  }));

  const topByCount = [...all].sort((a, b) => b.total - a.total).slice(0, 15);
  const topByRate = all
    .filter((o) => o.recurred + o.no_recurrence >= RATE_VOLUME_FLOOR)
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
    .slice(0, 15);

  return { topByCount, topByRate };
}

function buildBuildingScatter(eligible) {
  const groups = new Map();
  for (const item of eligible) {
    if (item.status === 'censored') continue;
    const id = item.row.buildingid;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(item);
  }
  return [...groups.entries()].map(([buildingid, items]) => {
    const s = summarize(items);
    return { buildingid, eligible_count: s.recurred + s.no_recurrence, recurrence_rate: s.rate };
  });
}

// --- NTA boundaries (for the choropleth) -----------------------------------
// Public dataset, no token needed. Trimmed to the fields/precision the map
// actually uses, since the source geometry ships far more than that.

const NTA_BOUNDARY_URL = 'https://data.cityofnewyork.us/resource/9nt8-h7nd.geojson';

function roundCoords(coords, digits = 5) {
  if (typeof coords[0] === 'number') return coords.map((c) => Number(c.toFixed(digits)));
  return coords.map((c) => roundCoords(c, digits));
}

async function fetchNtaBoundaries() {
  const url = new URL(NTA_BOUNDARY_URL);
  url.searchParams.set('$where', "boroname='Bronx'");
  url.searchParams.set('$limit', '100');

  const res = await fetch(url, { headers: { 'X-App-Token': APP_TOKEN } });
  if (!res.ok) {
    throw new Error(`NTA boundary request failed: ${res.status} ${res.statusText}`);
  }
  const raw = await res.json();

  return {
    type: 'FeatureCollection',
    features: raw.features.map((f) => ({
      type: 'Feature',
      properties: {
        ntaname: f.properties.ntaname,
        nta2020: f.properties.nta2020,
        ntatype: f.properties.ntatype,
      },
      geometry: {
        type: f.geometry.type,
        coordinates: roundCoords(f.geometry.coordinates),
      },
    })),
  };
}

// --- Main -----------------------------------------------------------------

async function main() {
  let rows = loadCacheIfFresh();
  if (!rows) {
    console.log('Fetching from Socrata (keyset pagination)...');
    rows = await fetchAll();
    saveCache(rows);
  }
  console.log(`Total rows: ${rows.length}`);

  const dataCutoff = computeDataCutoff(rows);
  console.log(`Data cutoff (latest date observed in the data): ${dataCutoff.toISOString()}`);
  const eligible = buildEligibility(rows, dataCutoff);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const overallSummary = buildOverallSummary(eligible, dataCutoff);
  overallSummary.total_rows_fetched = rows.length;

  const outputs = {
    'overall_summary.json': overallSummary,
    'by_class.json': buildByClass(eligible),
    'by_violation_type.json': buildByViolationType(eligible),
    'by_neighborhood.json': buildByNeighborhood(eligible),
    'building_scatter.json': buildBuildingScatter(eligible),
  };

  const { topByCount, topByRate } = buildByOwner(eligible);
  outputs['by_owner_top_count.json'] = topByCount;
  outputs['by_owner_top_rate.json'] = topByRate;

  for (const [filename, data] of Object.entries(outputs)) {
    const filePath = path.join(OUTPUT_DIR, filename);
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    const count = Array.isArray(data) ? data.length : 1;
    console.log(`  wrote ${filename} (${count} record${count === 1 ? '' : 's'})`);
  }

  console.log('Fetching NTA boundaries...');
  const ntaBoundaries = await fetchNtaBoundaries();
  writeFileSync(path.join(OUTPUT_DIR, 'bronx_nta_boundaries.geojson'), JSON.stringify(ntaBoundaries));
  console.log(`  wrote bronx_nta_boundaries.geojson (${ntaBoundaries.features.length} features)`);

  console.log('\nOverall summary:', overallSummary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
