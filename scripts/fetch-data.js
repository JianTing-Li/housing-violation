// Standalone Node script. Never imported by the Vite/React app.
// Run with: node scripts/fetch-data.js
//
// Pulls Bronx HMC violations from Socrata, then aggregates everything
// into small static JSON files under public/data/ for the frontend.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Only load/require the token when this file is actually run as the fetch
// script — not when it's imported (e.g. by tests) just to reach the pure
// classification/aggregation functions below.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  process.loadEnvFile('.env');
}

const APP_TOKEN = process.env.SOCRATA_APP_TOKEN;
if (isMain && !APP_TOKEN) {
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

// HPD's annual bedbug report filing ("(A) § HMC:FILE ANNUAL BEDBUG REPORT
// IN ACCORDANCE WITH HPD RULE...") cites "HPD RULE" instead of an Admin
// Code section number — confirmed against the raw data (21,415 rows), not
// a rare edge case — so the §-regex below never matches it and it would
// otherwise fall into the generic UNKNOWN bucket alongside genuinely
// uncategorized future violations. Giving it its own stable synthetic code
// keeps it correctly and consistently classified without widening UNKNOWN
// into a mixed bag that silently inherits whatever category UNKNOWN gets.
const BEDBUG_ANNUAL_REPORT_PATTERN = /FILE\s+ANNUAL\s+BEDBUG\s+REPORT/i;
const BEDBUG_ANNUAL_REPORT_CODE = 'BEDBUG-ANNUAL-REPORT';

function classifyViolationType(novdescription) {
  const description = novdescription || '';
  if (BEDBUG_ANNUAL_REPORT_PATTERN.test(description)) {
    return { code: BEDBUG_ANNUAL_REPORT_CODE };
  }
  const match = /§\s?[\d]+(?:\.\d+)?(?:-[\d]+(?:\.\d+)?)?/.exec(description);
  const code = match ? match[0].replace(/\s/g, '') : 'UNKNOWN';
  return { code };
}

// Category classification is a hand-reviewed lookup, not a live keyword
// scan — every code below was checked against its actual NOV text before
// being placed here (see the audit notes in the project conversation this
// was built from). Buckets:
//   'physical'       — a tangible defect/condition in the unit or building
//                       that requires repair, replacement, extermination,
//                       or similar corrective physical work.
//   'administrative' — a paperwork, posting, filing, or registration
//                       obligation. These recur because they're a
//                       recordkeeping/compliance process (e.g. an annual
//                       filing), not because a physical condition broke
//                       again — so they don't belong in a ranking meant to
//                       represent unresolved physical conditions.
//   'ambiguous'       — doesn't cleanly fit either bucket from the NOV text
//                       alone; judgment call documented inline below.
// Codes not listed here default to 'ambiguous' (see categoryFor) rather
// than 'physical', so a future re-fetch surfaces new/unrecognized codes for
// human review instead of silently asserting they represent a physical
// condition.
const VIOLATION_CATEGORY = {
  // --- administrative: recurring paperwork/posting/filing obligations ---
  [BEDBUG_ANNUAL_REPORT_CODE]: 'administrative', // annual filing to HPD
  '§27-2018.1': 'administrative', // post & maintain bedbug prevention notice
  '§27-2104': 'administrative', // post & maintain registration-number sign
  '§27-2053': 'administrative', // post sign with super's name/address/phone
  '§26-1103': 'administrative', // post & maintain housing info guide notice
  '§329': 'administrative', // provide/post certificate of inspection visits
  '§27-2022': 'administrative', // post sign with waste collection hours
  '§67': 'administrative', // post printed egress floor plan
  '§27-848': 'administrative', // replace refuse chute warning sign
  '§27-2048': 'administrative', // paint or post floor-number signage
  '§27-2107': 'administrative', // owner failed to file registration statement
  '§27-2056.7': 'administrative', // certify lead-paint hazard control compliance

  // --- ambiguous: mixed or unclear from NOV text alone ---
  '§27-2033': 'ambiguous', // access/compliance failure during inspection, not a decaying condition or a filing
  '§300': 'ambiguous', // requires EITHER filing paperwork to legalize OR physically restoring — text offers both paths
  '§27-2142': 'ambiguous', // vacate order: a regulatory status tied to an underlying condition, not itself a repair action
  '§27-2153': 'ambiguous', // one-time enforcement-program enrollment notice — not physical, but not a recurring filing either

  // --- physical: a tangible defect/condition requiring repair, replacement,
  // extermination, or similar corrective physical work. Listed explicitly
  // (rather than left to the default) so the default only ever applies to
  // codes nobody has reviewed yet — see categoryFor below.
  '§27-2033.3': 'physical', // missing temperature-reporting device
  '§27-2017.4': 'physical', // roach infestation
  '§27-2045': 'physical', // missing/defective smoke detector
  '§27-2013': 'physical', // repaint required
  '§27-2005': 'physical', // broken stove burners
  '§27-2017.3': 'physical', // mold condition
  '§27-2026': 'physical', // water leak
  '§27-2046.1': 'physical', // missing/defective CO detector
  '§27-2031': 'physical', // no hot water
  '§27-2029': 'physical', // inadequate heat
  '§27-2017': 'physical', // rodent infestation
  '§27-2010': 'physical', // trash/refuse buildup
  '§27-2070': 'physical', // no gas supply
  '§27-2043.1': 'physical', // missing/defective window guard
  '§27-2011': 'physical', // yard not maintained
  '§27-2056.6': 'physical', // lead paint hazard
  '§27-2037': 'physical', // electrical fixture defect
  '§27-2021': 'physical', // missing trash receptacles
  '§27-2024': 'physical', // no cold water
  '§53': 'physical', // fire escape hardware defect
  '§25-171': 'physical', // fire door gap
  '§27-2042': 'physical', // missing elevator mirror
  '§27-2014': 'physical', // rust/paint maintenance
  '§27-2081': 'physical', // illegal room occupancy (requires physical plumbing disconnection)
  '§27-2073': 'physical', // no cooking gas
  '§27-2039': 'physical', // missing mailbox light
  '§27-2041': 'physical', // missing door peephole
  '§27-2028': 'physical', // heating system defect
  '§27-2040': 'physical', // missing entrance lighting
  '§27-2043': 'physical', // missing door lock
  '§27-2038': 'physical', // missing passage lighting
  '§27-2077': 'physical', // illegal rooming unit (requires physical work to discontinue)
};

function categoryFor(code) {
  return VIOLATION_CATEGORY[code] ?? 'ambiguous';
}

// Plain-language chart labels, hand-curated per §-code (the group key this
// script already uses — see classifyViolationType above). NOVDescription is
// raw legal correction-order text; these are what actually get shown on the
// chart axis, so a reader isn't parsing citation language mid-scroll.
const DISPLAY_NAMES = {
  '§27-2033.3': 'Missing temperature sensor',
  '§27-2017.4': 'Roach infestation',
  '§27-2045': 'Missing smoke detector',
  '§27-2013': 'Repaint required',
  '§27-2005': 'Broken stove burners',
  '§27-2017.3': 'Mold condition',
  '§27-2026': 'Water leak',
  '§27-2046.1': 'Missing CO detector',
  '§27-2031': 'No hot water',
  '§27-2033': 'Boiler access blocked',
  '§27-2029': 'Inadequate heat',
  '§27-2017': 'Rodent infestation',
  '§27-2010': 'Trash/refuse buildup',
  '§27-2070': 'No gas supply',
  '§27-2043.1': 'Missing window guard',
  '§27-2011': 'Yard not maintained',
  '§27-2056.6': 'Lead paint hazard',
  '§300': 'Unpermitted alteration',
  '§27-2037': 'Electrical fixture defect',
  '§27-2104': 'Missing registration sign',
  '§27-2021': 'Missing trash receptacles',
  '§27-2024': 'No cold water',
  '§27-2107': 'Unregistered property',
  '§27-2053': 'Missing super contact sign',
  '§53': 'Fire escape defect',
  '§25-171': 'Fire door gap',
  '§27-2042': 'Missing elevator mirror',
  '§27-2014': 'Rust/paint maintenance',
  '§26-1103': 'Missing info notice',
  '§329': 'Missing inspection certificate',
  '§27-2081': 'Illegal room occupancy',
  '§27-2073': 'No cooking gas',
  '§27-2039': 'Missing mailbox light',
  '§27-2041': 'Missing door peephole',
  '§27-2028': 'Heating system defect',
  '§27-2022': 'Missing waste sign',
  '§27-2040': 'Missing entrance lighting',
  '§27-2142': 'Vacate order',
  '§27-2153': 'Enforcement program notice',
  '§27-2043': 'Missing door lock',
  '§27-2056.7': 'Lead paint certification',
  '§27-2018.1': 'Required posting/notice',
  '§27-2048': 'Missing floor sign',
  '§67': 'Missing egress plan',
  '§27-848': 'Missing chute sign',
  '§27-2038': 'Missing passage lighting',
  '§27-2077': 'Illegal rooming unit',
  [BEDBUG_ANNUAL_REPORT_CODE]: 'Annual bedbug report',
};

// Fallback for any future code not yet hand-curated above: strip the
// citation prefix and hard-truncate at a word boundary. No ellipsis — the
// full text is still available in the chart tooltip, so this only needs to
// be "good enough to not be blank," not polished.
function fallbackDisplayName(description) {
  let s = (description || '').replace(/^§+\s?[\d.\-()A-Za-z]*\s*(,\s*[\d.\-()A-Za-z]+\s*)*(ADM\.?\s?CODE|HMC|M\/D LAW)?:?\s*/i, '');
  s = s.trim();
  if (s.length > 32) {
    const truncated = s.slice(0, 32);
    const lastSpace = truncated.lastIndexOf(' ');
    s = lastSpace > 12 ? truncated.slice(0, lastSpace) : truncated;
  }
  s = s.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function displayNameFor(code, description) {
  return DISPLAY_NAMES[code] ?? fallbackDisplayName(description);
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
    const { code } = classifyViolationType(item.row.novdescription);
    if (!groups.has(code)) {
      groups.set(code, { items: [], sampleDescription: item.row.novdescription });
    }
    groups.get(code).items.push(item);
  }

  return [...groups.entries()]
    .map(([code, g]) => ({
      code,
      display_name: displayNameFor(code, g.sampleDescription),
      description: g.sampleDescription.slice(0, 140).trim(),
      category: categoryFor(code),
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

// --- Exports (for tests only — the app never imports this script) --------
export {
  classifyViolationType,
  categoryFor,
  VIOLATION_CATEGORY,
  BEDBUG_ANNUAL_REPORT_CODE,
  displayNameFor,
  DISPLAY_NAMES,
};

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

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
