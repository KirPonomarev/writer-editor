const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const os = require('node:os');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'ops',
  'x16-ws02-export-markdown-mindmap-bridge-state.mjs',
);

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function evaluateBaseline(evaluateX16Ws02ExportMarkdownMindmapBridgeState) {
  return evaluateX16Ws02ExportMarkdownMindmapBridgeState({ repoRoot: REPO_ROOT });
}

test('x16 ws02 baseline: export markdown + mindmap bridge passes', async () => {
  const { evaluateX16Ws02ExportMarkdownMindmapBridgeState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws02ExportMarkdownMindmapBridgeState);

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state.X16_WS02_EXPORT_MARKDOWN_MINDMAP_BRIDGE_OK, 1);
  assert.equal(state.counts.bridgeEntryCount, 2);
  assert.equal(state.counts.visibilityConflictCount, 0);
  assert.equal(state.counts.missingStageGateCount, 0);
  assert.equal(state.counts.advisoryToBlockingDriftCount, 0);

  for (const [key, value] of Object.entries(state.negativeResults)) {
    assert.equal(value, true, `negative scenario must pass: ${key}`);
  }
  for (const [key, value] of Object.entries(state.positiveResults)) {
    assert.equal(value, true, `positive scenario must pass: ${key}`);
  }

  assert.equal(state.dod.NEXT_TZ_DOD_01, true);
  assert.equal(state.dod.NEXT_TZ_DOD_02, true);
  assert.equal(state.dod.NEXT_TZ_DOD_03, true);
  assert.equal(state.dod.NEXT_TZ_DOD_05, true);
  assert.equal(state.dod.NEXT_TZ_DOD_06, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_01, true);
  assert.equal(state.acceptance.NEXT_TZ_ACCEPTANCE_02, true);
});

test('x16 ws02 parser includes the full actual runtime capability binding, including imported product commands', async () => {
  const { CAPABILITY_BINDING } = await import('../../src/renderer/commands/capabilityPolicy.mjs');
  const { evaluateX16Ws02ExportMarkdownMindmapBridgeState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws02ExportMarkdownMindmapBridgeState);
  assert.equal(state.parseState.parsedRuntimeCapabilityBindingOk, true);
  assert.equal(state.counts.runtimeCapabilityBindingCount, Object.keys(CAPABILITY_BINDING).length);
  assert.ok(Object.keys(CAPABILITY_BINDING).length > 0);
  for (const key of ['NEXT_TZ_NEGATIVE_01', 'NEXT_TZ_NEGATIVE_02', 'NEXT_TZ_NEGATIVE_03', 'NEXT_TZ_NEGATIVE_04', 'NEXT_TZ_NEGATIVE_05'])
    assert.equal(state.negativeResults[key], true, key);
});

for (const kind of ['missing', 'missing-export']) test(`x16 ws02 fails closed on a ${kind} same-repository product binding without fallback`, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yalken-p05-x16-import-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src/renderer/commands'), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, 'src/renderer/commands/capabilityPolicy.mjs'), path.join(root, 'src/renderer/commands/capabilityPolicy.mjs'));
  if (kind === 'missing-export') {
    fs.mkdirSync(path.join(root, 'src/shared'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src/shared/productCommandRegistry.cjs'), 'module.exports = {};\n');
  }
  const { evaluateX16Ws02ExportMarkdownMindmapBridgeState } = await loadModule();
  const state = evaluateX16Ws02ExportMarkdownMindmapBridgeState({ repoRoot: root });
  assert.equal(state.ok, false);
  assert.equal(state.parseState.parsedRuntimeCapabilityBindingOk, false);
  assert.equal(state.parseState.parsedRuntimeCapabilityBindingReason, 'CAPABILITY_BINDING_IMPORT_UNAVAILABLE');
  assert.equal(state.counts.runtimeCapabilityBindingCount, 0);
});

test('x16 ws02 negative 01: export markdown without stage flag is rejected', async () => {
  const { evaluateX16Ws02ExportMarkdownMindmapBridgeState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws02ExportMarkdownMindmapBridgeState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_01, true);
});

test('x16 ws02 negative 02: mindmap without derived guard is rejected', async () => {
  const { evaluateX16Ws02ExportMarkdownMindmapBridgeState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws02ExportMarkdownMindmapBridgeState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_02, true);
});

test('x16 ws02 negative 03: mode profile visibility conflict is rejected', async () => {
  const { evaluateX16Ws02ExportMarkdownMindmapBridgeState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws02ExportMarkdownMindmapBridgeState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_03, true);
});

test('x16 ws02 negative 04: non-machine-bound blocking classification is rejected', async () => {
  const { evaluateX16Ws02ExportMarkdownMindmapBridgeState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws02ExportMarkdownMindmapBridgeState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_04, true);
});

test('x16 ws02 negative 05: capability mismatch is rejected', async () => {
  const { evaluateX16Ws02ExportMarkdownMindmapBridgeState } = await loadModule();
  const state = evaluateBaseline(evaluateX16Ws02ExportMarkdownMindmapBridgeState);
  assert.equal(state.negativeResults.NEXT_TZ_NEGATIVE_05, true);
});

test('x16 ws02 repeatability: three runs are stable', async () => {
  const { evaluateX16Ws02ExportMarkdownMindmapBridgeState } = await loadModule();

  const runs = [
    evaluateBaseline(evaluateX16Ws02ExportMarkdownMindmapBridgeState),
    evaluateBaseline(evaluateX16Ws02ExportMarkdownMindmapBridgeState),
    evaluateBaseline(evaluateX16Ws02ExportMarkdownMindmapBridgeState),
  ].map((state) => ({
    ok: state.ok,
    token: state.X16_WS02_EXPORT_MARKDOWN_MINDMAP_BRIDGE_OK,
    counts: state.counts,
    negativeResults: state.negativeResults,
    positiveResults: state.positiveResults,
    dod: state.dod,
    acceptance: state.acceptance,
    detector: state.detector,
  }));

  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
  assert.equal(runs[0].ok, true);
});
