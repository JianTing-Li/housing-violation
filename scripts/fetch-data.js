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

// Every row from the source dataset is an HPD violation or enforcement
// record. Categorization below determines what KIND of record it is and
// which comparisons it's appropriate for — it is not a judgment about
// whether the record is a "real" violation. All records remain in the
// data; category only controls which chart/ranking a record is eligible
// for (see chartEligibilityFor).
//
//   'physical_condition'        — a tangible defect/condition in the unit
//                                  or building requiring repair, replacement,
//                                  extermination, or similar corrective work.
//   'administrative_or_posting' — a valid HPD violation for a report,
//                                  registration, certificate, notice, or
//                                  required sign. Some recur on a schedule
//                                  (e.g. an annual filing); others don't.
//                                  Excluded from the physical-condition
//                                  ranking because the record describes a
//                                  paperwork/posting obligation, not a
//                                  physical condition.
//   'enforcement_or_legal_status' — a regulatory/legal-status record (a
//                                  vacate order, a dismissal filing tied to
//                                  one, an enforcement-program notice) —
//                                  distinct from both an ongoing physical
//                                  condition and a routine posting duty.
//   'mixed_or_unresolved'       — doesn't cleanly fit the above from the
//                                  NOV text alone; judgment call documented
//                                  inline below, or a code nobody has
//                                  reviewed yet (see categoryFor default).

// --- HPD text variants that don't carry a parseable "§ <digits>" citation ---
// Confirmed against the full raw dataset (see the project conversation this
// was built from) — every one of these is real, recurring text, not a
// one-off OCR artifact. Matched with narrow, content-specific patterns
// (not a broad keyword scan) so they can't accidentally capture unrelated
// text, and checked before the general §-regex and before the generic
// missing-§ fallback below.

// "(A) § HMC:FILE ANNUAL BEDBUG REPORT IN ACCORDANCE WITH HPD RULE..." —
// cites "HPD RULE", not an Admin Code section number, so it never matches
// the §-regex (21,415 raw rows — not a rare edge case).
const BEDBUG_ANNUAL_REPORT_PATTERN = /FILE\s+ANNUAL\s+BEDBUG\s+REPORT/i;
const BEDBUG_ANNUAL_REPORT_CODE = 'BEDBUG-ANNUAL-REPORT';

// "(A) § HMC: POST AT OR NEAR THE MAILBOXES OR DISTRIBUTE TO EACH
// TENANT...THE ANNUAL BEDBUG REPORT AND A COPY..." — a third, distinct
// bedbug-law requirement (distributing the report/guide to tenants), not
// the same action as filing the report or posting the prevention notice.
const BEDBUG_DISTRIBUTION_PATTERN = /POST AT OR NEAR THE MAILBOXES OR DISTRIBUTE[\s\S]{0,160}ANNUAL BEDBUG REPORT/i;
const BEDBUG_DISTRIBUTION_CODE = 'BEDBUG-REPORT-DISTRIBUTION';

// "(B) 27-2142(A) HMC: THE FOLLOWING DWELLING UNITS WERE REOCCUPIED WHILE
// BEING SUBJECT TO AN ORDER TO REPAIR/VACATE ORDER ISSUED BY THE
// DEPARTMENT; FILE FOR A DISMISSAL REQUEST..." — cites the same section
// number as the standard vacate-order text but describes a different
// action (filing a dismissal request after reoccupying), so it's kept as
// its own code rather than merged into §27-2142.
const VACATE_DISMISSAL_PATTERN = /27-?2142[\s\S]{0,60}REOCCUPIED[\s\S]{0,120}DISMISSAL/i;
const VACATE_DISMISSAL_CODE = 'VACATE-DISMISSAL-FILING';

// Generic fallback for any other text missing a "§": requires the bare
// "NN-NNNN(.N)?" citation near the START of the string (allowing an
// optional leading item number and/or "(A)"/"(B)"/"(C)" sub-item marker,
// e.g. "566 (B) 27-2021.4 HMC:..."), immediately followed by "HMC",
// "ADM CODE", or "M/D LAW". This narrow shape — citation right at the
// start, legal-code keyword right after — is what distinguishes a missing
// "§" from an ordinary number appearing later in address/apartment text.
// Matches normalize to the same "§..." code format so a missing-§ variant
// of an already-known section (e.g. plain "27-2142 ADM CODE...") merges
// into that section's existing category instead of creating a duplicate.
const MISSING_SECTION_SYMBOL_PATTERN =
  /^(?:\d{2,4}\s*)?\(?[A-C]?\)?\s*(\d{2,3}-\d{3,4}(?:\.\d+)?)\s*\(?[A-C]?\)?\s*(?:HMC|ADM\.?\s?CODE|M\/D LAW)/i;

function classifyViolationType(novdescription) {
  const description = novdescription || '';

  if (BEDBUG_ANNUAL_REPORT_PATTERN.test(description)) return { code: BEDBUG_ANNUAL_REPORT_CODE };
  if (BEDBUG_DISTRIBUTION_PATTERN.test(description)) return { code: BEDBUG_DISTRIBUTION_CODE };
  if (VACATE_DISMISSAL_PATTERN.test(description)) return { code: VACATE_DISMISSAL_CODE };

  const sectionMatch = /§\s?[\d]+(?:\.\d+)?(?:-[\d]+(?:\.\d+)?)?/.exec(description);
  if (sectionMatch) return { code: sectionMatch[0].replace(/\s/g, '') };

  const missingSymbolMatch = MISSING_SECTION_SYMBOL_PATTERN.exec(description);
  if (missingSymbolMatch) return { code: `§${missingSymbolMatch[1]}` };

  return { code: 'UNKNOWN' };
}

const VIOLATION_CATEGORY = {
  // --- administrative_or_posting: valid HPD violations for a report,
  // registration, certificate, notice, or required sign. Excluded from the
  // physical-condition ranking because the record itself describes a
  // paperwork/posting obligation, not a physical condition — not because
  // it's a lesser or invalid violation. ---
  [BEDBUG_ANNUAL_REPORT_CODE]: 'administrative_or_posting', // annual filing to HPD
  [BEDBUG_DISTRIBUTION_CODE]: 'administrative_or_posting', // distribute report/guide to tenants
  '§27-2018.1': 'administrative_or_posting', // post & maintain bedbug prevention notice
  '§27-2104': 'administrative_or_posting', // post & maintain registration-number sign
  '§27-2053': 'administrative_or_posting', // post sign with super's name/address/phone
  '§26-1103': 'administrative_or_posting', // post & maintain housing info guide notice
  '§329': 'administrative_or_posting', // provide/post certificate of inspection visits
  '§27-2022': 'administrative_or_posting', // post sign with waste collection hours
  '§67': 'administrative_or_posting', // post printed egress floor plan
  '§27-848': 'administrative_or_posting', // replace refuse chute warning sign
  '§27-2048': 'administrative_or_posting', // paint or post floor-number signage
  '§27-2107': 'administrative_or_posting', // owner failed to file registration statement
  '§27-2056.7': 'administrative_or_posting', // certify lead-paint hazard control compliance

  // --- enforcement_or_legal_status: a regulatory/legal-status record, not
  // an ongoing physical condition and not a routine posting duty. ---
  '§27-2142': 'enforcement_or_legal_status', // vacate order: apartments vacated, cannot be reoccupied until so ordered
  [VACATE_DISMISSAL_CODE]: 'enforcement_or_legal_status', // dismissal request filed after reoccupying under a vacate/repair order
  '§27-2153': 'enforcement_or_legal_status', // building selected for the Alternative Enforcement Program

  // --- mixed_or_unresolved: doesn't cleanly fit the above from the NOV
  // text alone. Each judgment call documented at the point of decision. ---
  '§27-2033': 'mixed_or_unresolved', // Inspected the full text: this single code covers TWO different actions —
  // "POST NOTICE...NAME AND LOCATION OF THE PERSON DESIGNATED...TO HAVE KEY
  // TO BUILDINGS HEATING SYSTEM" (a posting duty) and "PROVIDE READY ACCESS
  // TO BUILDINGS HEATING SYSTEM...LOCKED DOOR...DID NOT COMPLY AT BOILER
  // ROOM" (an access obstruction found during inspection, not a filing and
  // not a decaying condition). Since the code conflates two different kinds
  // of record and the source doesn't let them be told apart without further
  // text-pattern work not yet done, it's held out of the physical ranking
  // rather than assigned to either bucket.
  '§300': 'mixed_or_unresolved', // text offers EITHER a paperwork path ("FILE PLANS AND APPLICATION AND
  // LEGALIZE...") OR a physical one ("...OR RESTORE TO THE LEGAL CONDITION
  // EXISTING PRIOR TO THE MAKING OF SAID ALTERATION") — the source doesn't
  // distinguish which applies to a given record.

  // --- physical_condition: a tangible defect/condition requiring repair,
  // replacement, extermination, or similar corrective physical work.
  // Listed explicitly (rather than left to the default) so the default
  // only ever applies to codes nobody has reviewed yet. ---
  '§27-2033.3': 'physical_condition', // missing temperature-reporting device
  '§27-2017.4': 'physical_condition', // roach infestation
  '§27-2045': 'physical_condition', // missing/defective smoke detector
  '§27-2013': 'physical_condition', // repaint required
  '§27-2005': 'physical_condition', // broken stove burners
  '§27-2017.3': 'physical_condition', // mold condition
  '§27-2026': 'physical_condition', // water leak
  '§27-2046.1': 'physical_condition', // missing/defective CO detector
  '§27-2031': 'physical_condition', // no hot water
  '§27-2029': 'physical_condition', // inadequate heat
  '§27-2017': 'physical_condition', // rodent infestation
  '§27-2021.4': 'physical_condition', // general pest nuisance (ants, flies, mice, mold, water — same family as roach/rodent infestation)
  '§27-2010': 'physical_condition', // trash/refuse buildup
  '§27-2070': 'physical_condition', // no gas supply
  '§27-2043.1': 'physical_condition', // missing/defective window guard
  '§27-2011': 'physical_condition', // yard not maintained
  '§27-2056.6': 'physical_condition', // lead paint hazard
  '§27-2037': 'physical_condition', // electrical fixture defect
  '§27-2021': 'physical_condition', // missing trash receptacles
  '§27-2024': 'physical_condition', // no cold water
  '§53': 'physical_condition', // fire escape hardware defect
  '§25-171': 'physical_condition', // fire door gap
  '§27-2042': 'physical_condition', // missing elevator mirror
  '§27-2014': 'physical_condition', // rust/paint maintenance
  '§27-2081': 'physical_condition', // illegal room occupancy (requires physical plumbing disconnection)
  '§27-2073': 'physical_condition', // no cooking gas
  '§27-2039': 'physical_condition', // missing mailbox light
  '§27-2041': 'physical_condition', // missing door peephole
  '§27-2028': 'physical_condition', // heating system defect
  '§27-2040': 'physical_condition', // missing entrance lighting
  '§27-2043': 'physical_condition', // missing door lock
  '§27-2038': 'physical_condition', // missing passage lighting
  '§27-2077': 'physical_condition', // illegal rooming unit (requires physical work to discontinue)
};

// Unseen codes default to 'mixed_or_unresolved', not 'physical_condition',
// so a future re-fetch surfaces new/unrecognized codes for human review
// instead of silently asserting they represent a physical condition. (For
// example, "(B) 27-2141(C) HMC: ORDER TO REPAIR/VACATE ORDER MUST REMAIN
// POSTED..." — a real, missing-§ code this fetch surfaced — lands here
// rather than being force-classified.)
function categoryFor(code) {
  return VIOLATION_CATEGORY[code] ?? 'mixed_or_unresolved';
}

// A record's category describes what KIND of record it is. Chart
// eligibility — whether it belongs in the physical-condition ranking — is
// stored as its own field rather than inferred inline at render time, so
// the "which categories count as physical" rule lives in one place and
// isn't silently re-derived differently in different charts.
function chartEligibilityFor(category) {
  return category === 'physical_condition' ? 'physical_condition_ranking' : 'excluded';
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
  '§27-2021.4': 'Pest infestation',
  [BEDBUG_ANNUAL_REPORT_CODE]: 'Annual bedbug report',
  [BEDBUG_DISTRIBUTION_CODE]: 'Bedbug report distribution',
  [VACATE_DISMISSAL_CODE]: 'Vacate order dismissal filing',
};

// Fallback for any code not yet hand-curated above. Deliberately does NOT
// use the raw NOV text — a truncated legal citation isn't a reviewed label
// and shouldn't be shown as one. The generic "Uncategorized violation"
// label is paired with the internal code in parentheses so it stays
// identifiable in the UI (and easy to find here for curation) without
// exposing unreviewed source text as a public-facing name. The full NOV
// text is still available in the chart tooltip's "description" field for
// anyone who wants it.
function fallbackDisplayName(code) {
  return `Uncategorized violation (${code})`;
}

function displayNameFor(code) {
  return DISPLAY_NAMES[code] ?? fallbackDisplayName(code);
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
    .map(([code, g]) => {
      const category = categoryFor(code);
      return {
        code,
        display_name: displayNameFor(code),
        description: g.sampleDescription.slice(0, 140).trim(),
        category,
        chart_eligibility: chartEligibilityFor(category),
        ...summarize(g.items),
      };
    })
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
    .map(([nta, items]) => {
      const s = summarize(items);
      return { nta, ...s, sufficient_data: s.recurred + s.no_recurrence >= RATE_VOLUME_FLOOR };
    })
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
  chartEligibilityFor,
  VIOLATION_CATEGORY,
  BEDBUG_ANNUAL_REPORT_CODE,
  BEDBUG_DISTRIBUTION_CODE,
  VACATE_DISMISSAL_CODE,
  displayNameFor,
  DISPLAY_NAMES,
  RATE_VOLUME_FLOOR,
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
