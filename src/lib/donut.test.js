import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { computeDonutData } from './donut.js';

const SAMPLE_SUMMARY = { recurred: 800, no_recurrence: 200, censored: 500, total: 1500 };

test('segment counts sum to the classifiable denominator', () => {
  const donut = computeDonutData(SAMPLE_SUMMARY);
  const segmentSum = donut.segments.reduce((sum, s) => sum + s.count, 0);
  assert.equal(segmentSum, donut.classifiable);
  assert.equal(donut.classifiable, 1000);
});

test('classifiable plus too-recent reconciles with the total analyzed count', () => {
  const donut = computeDonutData(SAMPLE_SUMMARY);
  assert.equal(donut.classifiable + donut.tooRecentCount, donut.totalAnalyzed);
});

test('segment shares sum to 1 and match the displayed percentage', () => {
  const donut = computeDonutData(SAMPLE_SUMMARY);
  const shareSum = donut.segments.reduce((sum, s) => sum + s.share, 0);
  assert.ok(Math.abs(shareSum - 1) < 1e-9);

  const recurredSegment = donut.segments.find((s) => s.key === 'recurred');
  assert.ok(Math.abs(recurredSegment.share - 0.8) < 1e-9); // 800 / 1000 = 80%
});

test('too-recent count never contributes to a segment', () => {
  const donut = computeDonutData(SAMPLE_SUMMARY);
  for (const segment of donut.segments) {
    assert.notEqual(segment.key, 'censored');
    assert.notEqual(segment.key, 'too_recent');
  }
});

test('handles a zero-classifiable edge case without dividing by zero', () => {
  const donut = computeDonutData({ recurred: 0, no_recurrence: 0, censored: 50, total: 50 });
  assert.equal(donut.classifiable, 0);
  for (const segment of donut.segments) {
    assert.equal(segment.share, 0);
  }
});

// --- reconciliation against the actual generated data ----------------------

const SUMMARY_PATH = path.resolve('public/data/overall_summary.json');

test('reconciles against the real generated overall_summary.json', { skip: !existsSync(SUMMARY_PATH) }, () => {
  const summary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf-8'));
  const donut = computeDonutData(summary);

  assert.equal(donut.classifiable + donut.tooRecentCount, summary.total);

  const recurredSegment = donut.segments.find((s) => s.key === 'recurred');
  assert.ok(Math.abs(recurredSegment.share - summary.rate) < 1e-9, 'donut share must match the headline rate exactly (same denominator)');
});
