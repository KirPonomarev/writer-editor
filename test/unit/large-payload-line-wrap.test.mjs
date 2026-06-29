import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLargePayloadLineSafeRows } from '../../src/renderer/largePayloadLineWrap.mjs';

const measureText = (text) => String(text || '').length;

test('large payload line wrap emits bounded rows without clipping overflow', () => {
  const rows = buildLargePayloadLineSafeRows({
    sourceText: 'alpha beta gamma delta epsilon zeta',
    pageNumber: 1,
    pageCharBudget: 12,
    visibleCharBudget: 64,
    contentWidthPx: 10,
    contentHeightPx: 30,
    lineHeightPx: 10,
    measureText,
    lineWidthSafetyPx: 0,
  });

  assert.deepEqual(rows, ['alpha beta', 'gamma', 'delta']);
  assert.equal(rows.every((row) => measureText(row) <= 10), true);
});

test('large payload line wrap does not skip oversized token pages', () => {
  const sourceText = `${'A'.repeat(40)} end`;
  const rows = buildLargePayloadLineSafeRows({
    sourceText,
    pageNumber: 2,
    pageCharBudget: 10,
    visibleCharBudget: 24,
    contentWidthPx: 5,
    contentHeightPx: 30,
    lineHeightPx: 10,
    measureText,
    lineWidthSafetyPx: 0,
  });

  assert.deepEqual(rows, ['AAAAA', 'AAAAA', 'AAAAA']);
});

test('large payload line wrap preserves visible internal whitespace runs', () => {
  const rows = buildLargePayloadLineSafeRows({
    sourceText: 'word1    word2\t\tword3',
    pageNumber: 1,
    pageCharBudget: 24,
    visibleCharBudget: 24,
    contentWidthPx: 64,
    contentHeightPx: 20,
    lineHeightPx: 10,
    measureText,
    lineWidthSafetyPx: 0,
  });

  assert.equal(rows[0], 'word1    word2\t\tword3');
});

test('large payload line wrap trims line edges but keeps nonblank pages', () => {
  const rows = buildLargePayloadLineSafeRows({
    sourceText: `  ${'B'.repeat(20)}  tail`,
    pageNumber: 2,
    pageCharBudget: 10,
    visibleCharBudget: 24,
    contentWidthPx: 6,
    contentHeightPx: 20,
    lineHeightPx: 10,
    measureText,
    lineWidthSafetyPx: 0,
  });

  assert.equal(rows.length > 0, true);
  assert.equal(rows.some((row) => row.length > 0), true);
});
