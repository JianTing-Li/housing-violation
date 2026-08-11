// Run with: node --test scripts/*.test.js
// Uses Node's built-in test runner — no new dependency, consistent with
// the rest of this pipeline (native fetch, no HTTP client library, etc.).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
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
} from './fetch-data.js';

// Real (unmodified) description text pulled from the cached raw dataset —
// see the project conversation this test was built from for how each was
// confirmed against the full raw data before being hard-coded here.
const REAL_BEDBUG_ANNUAL_REPORT_DESC =
  '(A) § HMC:FILE ANNUAL BEDBUG REPORT IN ACCORDANCE WITH HPD RULE AS DESCRIBED ON THE BACK OF THIS NOTICE OF VIOLATION OR AS DESCRIBED ON HPD\x1AS WEBSITE, WWW.NYC.GOV\\HPD, SEARCH BED BUGS. AT PUBLIC HALL, 1st STORY';

const REAL_BEDBUG_NOTICE_DESC =
  '§27-2018.1 HMC: POST, IN THE FORM APPROVED BY THE COMMISSIONER, AND MAINTAIN THE NOTICE ABOUT PREVENTION, DETECTION AND REMOVAL OF BEDBUG INFESTATION IN COMMON AREA OF THE BUILDING.';

const REAL_BEDBUG_DISTRIBUTION_DESC =
  '(A) § HMC: POST AT OR NEAR THE MAILBOXES OR DISTRIBUTE TO EACH TENANT UPON COMMENCEMENT OF NEW LEASE OR UPON LEASE RENEWAL, IN THE FORM APPROVED BY THE COMMISSIONER, THE ANNUAL BEDBUG REPORT AND A COPY OF THE DOHMH PREVENTING AND GETTING RID OF BEDBUGS SAFELY GUIDE, ACCORDING TO THE CERTIFICATION MADE ON SUCH ANNUAL BEDBUG REPORT. AT PUBLIC HALL, 1st STORY';

const REAL_VACATE_DISMISSAL_DESC =
  '(B) 27-2142(A) HMC: THE FOLLOWING DWELLING UNITS WERE REOCCUPIED WHILE BEING SUBJECT TO AN ORDER TO REPAIR/VACATE ORDER ISSUED BY THE DEPARTMENT; FILE FOR A DISMISSAL REQUEST RELATED TO THE ISSUED ORDER (SEE WWW.NYC.GOV/HPD). IN THE ENTIRE APARTMENT LOCATED AT APT 2D, 2nd STORY, 1st APARTMENT FROM NORTH AT EAST';

const REAL_STANDARD_VACATE_ORDER_DESC =
  '§ 27-2142 ADM CODE APTS HAVE BEEN VACATED BY THIS DEPARTMENT AND CANNOT BE REOCCUPIED UNTIL SO ORDERED AFTER PROOF OF COMPLIANCE FOR APTS EAST 1 ILLEGAL APARTMENT CREATED AT CELLAR UNDER VACATE ORDER # 258680';

const REAL_PEST_NUISANCE_MISSING_SYMBOL_DESC =
  '566 (B) 27-2021.4 HMC: ABATE THE NUISANCE CONSISTING OF PESTS. EVIDENCE OF ROACHES IN THE ENTIRE APARTMENT';

const REAL_MISSING_SYMBOL_VACATE_POSTED_DESC =
  '(B) 27-2141(C) HMC: ORDER TO REPAIR/VACATE ORDER MUST REMAIN POSTED UNTIL SUCH TIME AS ORDERED REMOVED BY THE DEPARTMENT.';

// --- the two separated UNKNOWN variants -----------------------------------

test('bedbug annual report filing gets its own code, not the generic UNKNOWN bucket', () => {
  const { code } = classifyViolationType(REAL_BEDBUG_ANNUAL_REPORT_DESC);
  assert.equal(code, BEDBUG_ANNUAL_REPORT_CODE);
  assert.notEqual(code, 'UNKNOWN');
});

test('bedbug report distribution is separated from the annual filing, both administrative_or_posting', () => {
  const filing = classifyViolationType(REAL_BEDBUG_ANNUAL_REPORT_DESC).code;
  const distribution = classifyViolationType(REAL_BEDBUG_DISTRIBUTION_DESC).code;
  assert.equal(distribution, BEDBUG_DISTRIBUTION_CODE);
  assert.notEqual(distribution, filing);
  assert.notEqual(distribution, 'UNKNOWN');
  assert.equal(categoryFor(filing), 'administrative_or_posting');
  assert.equal(categoryFor(distribution), 'administrative_or_posting');
});

test('vacate-dismissal filing is separated from the standard vacate order, both enforcement_or_legal_status', () => {
  const dismissal = classifyViolationType(REAL_VACATE_DISMISSAL_DESC).code;
  const standard = classifyViolationType(REAL_STANDARD_VACATE_ORDER_DESC).code;
  assert.equal(dismissal, VACATE_DISMISSAL_CODE);
  assert.equal(standard, '§27-2142');
  assert.notEqual(dismissal, standard);
  assert.equal(categoryFor(dismissal), 'enforcement_or_legal_status');
  assert.equal(categoryFor(standard), 'enforcement_or_legal_status');
});

test('bedbug prevention-notice posting (§27-2018.1) is categorized as administrative_or_posting', () => {
  const { code } = classifyViolationType(REAL_BEDBUG_NOTICE_DESC);
  assert.equal(code, '§27-2018.1');
  assert.equal(categoryFor(code), 'administrative_or_posting');
});

// --- missing-§-symbol normalization ----------------------------------------

test('a missing-§ citation followed by HMC/ADM CODE normalizes to the § form', () => {
  const { code } = classifyViolationType(REAL_PEST_NUISANCE_MISSING_SYMBOL_DESC);
  assert.equal(code, '§27-2021.4');
  assert.equal(categoryFor(code), 'physical_condition');
});

test('a missing-§ code not explicitly reviewed still normalizes but defaults to mixed_or_unresolved', () => {
  const { code } = classifyViolationType(REAL_MISSING_SYMBOL_VACATE_POSTED_DESC);
  assert.equal(code, '§27-2141');
  assert.equal(categoryFor(code), 'mixed_or_unresolved');
});

test('a plain unrelated number in address text does not trigger the missing-§ fallback', () => {
  const desc = 'PROVIDE HOT WATER AT ALL HOT WATER FIXTURES LOCATED AT APT 27-2033, 5th STORY';
  const { code } = classifyViolationType(desc);
  assert.equal(code, 'UNKNOWN');
});

// --- category / chart-eligibility behavior ---------------------------------

test('a genuine physical-condition violation is categorized as physical_condition and ranking-eligible', () => {
  const roaches =
    'HMC ADM CODE: § 27-2017.4 ABATE THE INFESTATION CONSISTING OF ROACHES IN THE ENTIRE APARTMENT LOCATED AT APT 4H, 4th STORY';
  const { code } = classifyViolationType(roaches);
  assert.equal(code, '§27-2017.4');
  assert.equal(categoryFor(code), 'physical_condition');
  assert.equal(chartEligibilityFor(categoryFor(code)), 'physical_condition_ranking');
});

test('administrative_or_posting and enforcement_or_legal_status records are excluded from the physical-condition ranking', () => {
  for (const code of ['§27-2018.1', BEDBUG_ANNUAL_REPORT_CODE, '§27-2142', VACATE_DISMISSAL_CODE, '§27-2153']) {
    const category = categoryFor(code);
    assert.notEqual(category, 'physical_condition');
    assert.equal(chartEligibilityFor(category), 'excluded');
  }
});

test('mixed_or_unresolved records are excluded from the physical-condition ranking', () => {
  assert.equal(categoryFor('§27-2033'), 'mixed_or_unresolved');
  assert.equal(chartEligibilityFor('mixed_or_unresolved'), 'excluded');
});

test('an unrecognized code defaults to mixed_or_unresolved, not physical_condition', () => {
  // Guards against a future re-fetch silently asserting an unreviewed
  // category represents a physical condition.
  assert.equal(categoryFor('§99-9999'), 'mixed_or_unresolved');
  assert.equal(categoryFor('UNKNOWN'), 'mixed_or_unresolved');
  assert.equal(chartEligibilityFor(categoryFor('§99-9999')), 'excluded');
});

test('every entry in VIOLATION_CATEGORY is one of the four valid buckets', () => {
  const validBuckets = new Set([
    'physical_condition',
    'administrative_or_posting',
    'enforcement_or_legal_status',
    'mixed_or_unresolved',
  ]);
  for (const [code, bucket] of Object.entries(VIOLATION_CATEGORY)) {
    assert.ok(validBuckets.has(bucket), `${code} has invalid category "${bucket}"`);
  }
});

// --- display names: no raw/truncated source text as a public label --------

test('every hand-curated display name has a non-empty, ellipsis-free value', () => {
  for (const [code, name] of Object.entries(DISPLAY_NAMES)) {
    assert.ok(name.length > 0, `${code} has an empty display name`);
    assert.ok(!name.includes('…') && !name.includes('...'), `${code} display name "${name}" contains an ellipsis`);
  }
});

test('displayNameFor never exposes raw or truncated source description text for unmapped codes', () => {
  const name = displayNameFor('§99-9999');
  assert.equal(name, 'Uncategorized violation (§99-9999)');
  // Regression guard: the old fallback truncated the actual NOV text into
  // the label. Confirm the label doesn't contain legal-citation language
  // that would only appear if raw text leaked through.
  assert.ok(!/ABATE|REPAIR|PROVIDE|ADM CODE|HMC/i.test(name));
});

// --- reconciliation against the generated static data ----------------------

const DATA_DIR = path.resolve('public/data');

function loadJson(filename) {
  return JSON.parse(readFileSync(path.join(DATA_DIR, filename), 'utf-8'));
}

test('all processed records remain accounted for in overall_summary', { skip: !existsSync(path.join(DATA_DIR, 'overall_summary.json')) }, () => {
  const summary = loadJson('overall_summary.json');
  assert.equal(summary.recurred + summary.no_recurrence + summary.censored, summary.total);
});

test('the overall rate denominator excludes censored (too-recent) records', { skip: !existsSync(path.join(DATA_DIR, 'overall_summary.json')) }, () => {
  const summary = loadJson('overall_summary.json');
  const expectedRate = summary.recurred / (summary.recurred + summary.no_recurrence);
  assert.ok(Math.abs(summary.rate - expectedRate) < 1e-9);
});

test('every violation-type record below the volume floor is excluded from ranked output', { skip: !existsSync(path.join(DATA_DIR, 'by_violation_type.json')) }, () => {
  const rows = loadJson('by_violation_type.json');
  for (const row of rows) {
    assert.ok(row.recurred + row.no_recurrence >= RATE_VOLUME_FLOOR, `${row.code} is below the volume floor but was included`);
  }
});

test('every violation-type record has a non-raw display name and a valid category', { skip: !existsSync(path.join(DATA_DIR, 'by_violation_type.json')) }, () => {
  const rows = loadJson('by_violation_type.json');
  const validCategories = new Set([
    'physical_condition',
    'administrative_or_posting',
    'enforcement_or_legal_status',
    'mixed_or_unresolved',
  ]);
  for (const row of rows) {
    assert.ok(row.display_name?.length > 0, `${row.code} has no display name`);
    assert.ok(validCategories.has(row.category), `${row.code} has invalid category "${row.category}"`);
    const expectedEligibility = row.category === 'physical_condition' ? 'physical_condition_ranking' : 'excluded';
    assert.equal(row.chart_eligibility, expectedEligibility, `${row.code} chart_eligibility mismatch`);
  }
});

test('neighborhood records expose a sufficient_data flag consistent with the volume floor', { skip: !existsSync(path.join(DATA_DIR, 'by_neighborhood.json')) }, () => {
  const rows = loadJson('by_neighborhood.json');
  for (const row of rows) {
    const expected = row.recurred + row.no_recurrence >= RATE_VOLUME_FLOOR;
    assert.equal(row.sufficient_data, expected, `${row.nta} sufficient_data mismatch`);
  }
});
