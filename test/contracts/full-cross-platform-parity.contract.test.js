const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'full-cross-platform-parity-state.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

test('full cross-platform parity: matrix complete and release-critical parity passes', async () => {
  const { evaluateFullCrossPlatformParityState } = await loadModule();
  const state = evaluateFullCrossPlatformParityState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.ok, true);
  assert.equal(state.FULL_CROSS_PLATFORM_PARITY_EXPANSION_OK, 1);
  assert.equal(state.matrixState.ok, true);
  assert.equal(state.parityState.ok, true);
  assert.equal(state.gapState.ok, true);
  assert.equal(state.gapState.totalMissingPaths, 0);
  assert.equal(state.gapState.totalFailingPaths, 0);
});

test('full cross-platform parity: missing platform fails matrix complete check', async () => {
  const { evaluateFullCrossPlatformParityState } = await loadModule();
  const fixtureDoc = {
    schemaVersion: 'xplat-parity-fixtures.v1',
    platforms: ['web', 'windows', 'linux', 'android'],
    releaseCriticalPaths: ['open', 'edit', 'save', 'reopen', 'recover', 'export_docx', 'export_markdown', 'roundtrip_e2e'],
    fixturesByPlatform: {},
  };
  for (const platform of fixtureDoc.platforms) {
    fixtureDoc.fixturesByPlatform[platform] = {
      platform,
      deterministicFixtureSetId: `fixtures-${platform}`,
      fixturesTotal: 12,
      releaseCriticalPaths: {
        open: 'PASS',
        edit: 'PASS',
        save: 'PASS',
        reopen: 'PASS',
        recover: 'PASS',
        export_docx: 'PASS',
        export_markdown: 'PASS',
        roundtrip_e2e: 'PASS',
      },
    };
  }

  const state = evaluateFullCrossPlatformParityState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    fixtureDoc,
  });

  assert.equal(state.matrixState.ok, false);
  assert.equal(state.matrixState.missingPlatforms.includes('ios'), true);
  assert.equal(state.ok, false);
});

test('full cross-platform parity: release-critical mismatch fails parity and gap checks', async () => {
  const { evaluateFullCrossPlatformParityState } = await loadModule();
  const baseState = evaluateFullCrossPlatformParityState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  const fixtureDoc = JSON.parse(JSON.stringify(baseState.fixtureDoc));
  fixtureDoc.fixturesByPlatform.android.releaseCriticalPaths.export_docx = 'FAIL';

  const state = evaluateFullCrossPlatformParityState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    fixtureDoc,
  });

  assert.equal(state.matrixState.ok, true);
  assert.equal(state.parityState.ok, false);
  assert.equal(state.gapState.ok, false);
  assert.equal(state.gapState.totalFailingPaths > 0, true);
  assert.equal(state.ok, false);
});

test('full cross-platform parity: negative cases enforced and advisory drift stays zero', async () => {
  const { evaluateFullCrossPlatformParityState } = await loadModule();
  const state = evaluateFullCrossPlatformParityState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
  });

  assert.equal(state.negativeState.ok, true);
  assert.equal(state.negativeState.cases.length >= 3, true);
  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
});
