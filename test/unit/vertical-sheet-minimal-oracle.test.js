const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadOracle() {
  return import(pathToFileURL(path.join(process.cwd(), 'scripts', 'vertical-sheet-minimal-oracle-smoke.mjs')).href);
}

async function loadFixtures() {
  return import(pathToFileURL(path.join(process.cwd(), 'test', 'fixtures', 'viewport-oracle-fixture.mjs')).href);
}

test('vertical sheet minimal oracle accepts a two-sheet DOM text continuation snapshot', async () => {
  const oracle = await loadOracle();
  const fixtures = await loadFixtures();
  const result = oracle.evaluateViewportOracleSnapshot(fixtures.createPassingViewportFixture());

  assert.equal(result.ok, true);
  assert.equal(result.facts.tiptapHostCount, 1);
  assert.equal(result.facts.proseMirrorCount, 1);
  assert.equal(result.facts.sheetCount, 2);
});

test('vertical sheet minimal oracle rejects text painted in a sheet gap', async () => {
  const oracle = await loadOracle();
  const fixtures = await loadFixtures();
  const result = oracle.evaluateViewportOracleSnapshot(fixtures.createGapFailureViewportFixture());

  assert.equal(result.ok, false);
  assert.equal(result.failures.includes('E_VIEWPORT_TEXT_IN_GAP'), true);
});

test('vertical sheet minimal oracle rejects bitmap text and fake scale on primary text', async () => {
  const oracle = await loadOracle();
  const fixtures = await loadFixtures();
  const result = oracle.evaluateViewportOracleSnapshot(fixtures.createScaleCanvasFailureViewportFixture());

  assert.equal(result.ok, false);
  assert.equal(result.failures.includes('E_VIEWPORT_PRIMARY_TEXT_BITMAP'), true);
  assert.equal(result.failures.includes('E_VIEWPORT_PRIMARY_TEXT_SCALE'), true);
});

test('vertical sheet minimal oracle classifies current static TipTap page as expected runtime fail', async () => {
  const oracle = await loadOracle();
  const result = oracle.runMinimalOracleSmoke();

  assert.equal(result.ok, true);
  assert.equal(result.currentExpectedFail, true);
  assert.equal(result.current.failures.includes('E_VIEWPORT_STATIC_SINGLE_PAGE_SHELL'), true);
  assert.equal(result.current.failures.includes('E_VIEWPORT_TEXT_LOST_AFTER_BOUNDARY'), true);
  assert.equal(result.sourceFacts.source.newEditorCount, 1);
  assert.equal(result.sourceFacts.source.canvasInTiptapSource, false);
  assert.equal(result.sourceFacts.source.primaryTextScaleInCss, false);
});
