// Run with: node --test scripts/
// Uses Node's built-in test runner — no new dependency, consistent with
// the rest of this pipeline (native fetch, no HTTP client library, etc.).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyViolationType,
  categoryFor,
  VIOLATION_CATEGORY,
  BEDBUG_ANNUAL_REPORT_CODE,
  displayNameFor,
  DISPLAY_NAMES,
} from './fetch-data.js';

// Real (unmodified) description text pulled from the cached raw dataset —
// see the project conversation this test was built from for how it was
// confirmed to never contain a "§ <digits>" citation.
const REAL_BEDBUG_ANNUAL_REPORT_DESC =
  '(A) § HMC:FILE ANNUAL BEDBUG REPORT IN ACCORDANCE WITH HPD RULE AS DESCRIBED ON THE BACK OF THIS NOTICE OF VIOLATION OR AS DESCRIBED ON HPD\x1AS WEBSITE, WWW.NYC.GOV\\HPD, SEARCH BED BUGS. AT PUBLIC HALL, 1st STORY';

const REAL_BEDBUG_NOTICE_DESC =
  '§27-2018.1 HMC: POST, IN THE FORM APPROVED BY THE COMMISSIONER, AND MAINTAIN THE NOTICE ABOUT PREVENTION, DETECTION AND REMOVAL OF BEDBUG INFESTATION IN COMMON AREA OF THE BUILDING.';

test('bedbug annual report filing gets its own code, not the generic UNKNOWN bucket', () => {
  const { code } = classifyViolationType(REAL_BEDBUG_ANNUAL_REPORT_DESC);
  assert.equal(code, BEDBUG_ANNUAL_REPORT_CODE);
  assert.notEqual(code, 'UNKNOWN');
});

test('bedbug annual report filing is categorized as administrative', () => {
  const { code } = classifyViolationType(REAL_BEDBUG_ANNUAL_REPORT_DESC);
  assert.equal(categoryFor(code), 'administrative');
});

test('bedbug prevention-notice posting (§27-2018.1) is categorized as administrative', () => {
  const { code } = classifyViolationType(REAL_BEDBUG_NOTICE_DESC);
  assert.equal(code, '§27-2018.1');
  assert.equal(categoryFor(code), 'administrative');
});

test('the two bedbug violation types are distinct codes, both administrative', () => {
  const filing = classifyViolationType(REAL_BEDBUG_ANNUAL_REPORT_DESC).code;
  const notice = classifyViolationType(REAL_BEDBUG_NOTICE_DESC).code;
  assert.notEqual(filing, notice);
  assert.equal(categoryFor(filing), 'administrative');
  assert.equal(categoryFor(notice), 'administrative');
});

test('a genuine physical-condition violation is categorized as physical', () => {
  const roaches =
    'HMC ADM CODE: § 27-2017.4 ABATE THE INFESTATION CONSISTING OF ROACHES IN THE ENTIRE APARTMENT LOCATED AT APT 4H, 4th STORY';
  const { code } = classifyViolationType(roaches);
  assert.equal(code, '§27-2017.4');
  assert.equal(categoryFor(code), 'physical');
});

test('an unrecognized code defaults to ambiguous, not physical', () => {
  // Guards against a future re-fetch silently asserting an unreviewed
  // category represents a physical condition.
  assert.equal(categoryFor('§99-9999'), 'ambiguous');
  assert.equal(categoryFor('UNKNOWN'), 'ambiguous');
});

test('every entry in VIOLATION_CATEGORY is one of the three valid buckets', () => {
  const validBuckets = new Set(['physical', 'administrative', 'ambiguous']);
  for (const [code, bucket] of Object.entries(VIOLATION_CATEGORY)) {
    assert.ok(validBuckets.has(bucket), `${code} has invalid category "${bucket}"`);
  }
});

test('every hand-curated display name has a non-empty, ellipsis-free value', () => {
  for (const [code, name] of Object.entries(DISPLAY_NAMES)) {
    assert.ok(name.length > 0, `${code} has an empty display name`);
    assert.ok(!name.includes('…') && !name.includes('...'), `${code} display name "${name}" contains an ellipsis`);
  }
});

test('displayNameFor falls back to a truncated, ellipsis-free label for unmapped codes', () => {
  const name = displayNameFor('§99-9999', '§ 99-9999 ADM CODE DO SOME VERY LONG THING THAT GOES ON AND ON AND ON');
  assert.ok(name.length > 0);
  assert.ok(!name.includes('…') && !name.includes('...'));
});
