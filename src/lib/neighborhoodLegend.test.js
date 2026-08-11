import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { RATE_BINS, INSUFFICIENT_DATA_BIN, binForNeighborhood } from './neighborhoodLegend.js';

test('rate bins have no gaps or overlaps across the full 0-100% range', () => {
  const sorted = [...RATE_BINS].sort((a, b) => a.min - b.min);
  assert.equal(sorted[0].min, -Infinity);
  assert.equal(sorted[sorted.length - 1].max, Infinity);
  for (let i = 0; i < sorted.length - 1; i++) {
    assert.equal(sorted[i].max, sorted[i + 1].min, `gap/overlap between "${sorted[i].label}" and "${sorted[i + 1].label}"`);
  }
});

test('a neighborhood below the volume floor gets the insufficient-data bin regardless of its raw rate', () => {
  const bin = binForNeighborhood({ rate: 0.99, sufficient_data: false });
  assert.equal(bin, INSUFFICIENT_DATA_BIN);
});

test('a neighborhood with a null rate gets the insufficient-data bin', () => {
  const bin = binForNeighborhood({ rate: null, sufficient_data: false, total: 3 });
  assert.equal(bin, INSUFFICIENT_DATA_BIN);
});

test('a sufficient-data neighborhood lands in exactly one bin matching its rate', () => {
  const bin = binForNeighborhood({ rate: 0.82, sufficient_data: true });
  assert.equal(bin.id, '80-84');
});

test('boundary values land in the upper bin (inclusive lower bound)', () => {
  assert.equal(binForNeighborhood({ rate: 0.65, sufficient_data: true }).id, '65-74');
  assert.equal(binForNeighborhood({ rate: 0.85, sufficient_data: true }).id, '85-plus');
});

// --- coverage against the real generated data -------------------------------

const DATA_PATH = path.resolve('public/data/by_neighborhood.json');

test('every eligible neighborhood in the real data falls into exactly one bin, no gaps', { skip: !existsSync(DATA_PATH) }, () => {
  const rows = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  for (const row of rows) {
    const bin = binForNeighborhood(row);
    assert.ok(bin, `${row.nta} did not match any bin`);
    if (row.sufficient_data && row.rate != null) {
      assert.notEqual(bin, INSUFFICIENT_DATA_BIN, `${row.nta} has sufficient data but landed in insufficient-data bin`);
    } else {
      assert.equal(bin, INSUFFICIENT_DATA_BIN, `${row.nta} lacks sufficient data but was assigned a rate bin`);
    }
  }
});
