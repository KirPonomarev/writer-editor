const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'hot-path-incremental-render-state.mjs');
const FAILSIGNAL_REGISTRY_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'FAILSIGNALS', 'FAILSIGNAL_REGISTRY.json');
const HOTPATH_POLICY_PATH = path.join(REPO_ROOT, 'scripts', 'perf', 'hotpath-policy.json');
const PERF_THRESHOLDS_PATH = path.join(REPO_ROOT, 'scripts', 'perf', 'perf-thresholds.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function minimalMainSourceWithQueuedIo() {
  return `
  function sample() {
    queueDiskOperation(() => writeAutosave(), 'autosave temporary');
    queueDiskOperation(() => writeBackupCurrent(), 'backup current file');
    queueDiskOperation(() => writeBackupAutosave(), 'backup autosave');
  }
  `;
}

test('hot-path incremental render: baseline checks pass with drift count zero', async () => {
  const { evaluateHotPathIncrementalRenderState } = await loadModule();
  const state = evaluateHotPathIncrementalRenderState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    hotpathPolicyPath: HOTPATH_POLICY_PATH,
    perfThresholdsPath: PERF_THRESHOLDS_PATH,
  });

  assert.equal(state.ok, true);
  assert.equal(state.HOT_PATH_INCREMENTAL_RENDER_OK, 1);
  assert.equal(state.noFullRerenderCheck.ok, true);
  assert.equal(state.inputP95Check.ok, true);
  assert.equal(state.typingLoopNonBlockingCheck.ok, true);
  assert.equal(state.noRuntimeHotpathGovernance.ok, true);
  assert.equal(state.advisoryToBlockingDriftCount, 0);
  assert.equal(state.advisoryToBlockingDriftCountZero, true);
});

test('hot-path incremental render: full rerender in input handler is rejected', async () => {
  const { evaluateHotPathIncrementalRenderState } = await loadModule();
  const editorSourceOverride = `
const HOTPATH_RENDER_DEBOUNCE_MS = 32;
const HOTPATH_FULL_RENDER_MIN_INTERVAL_MS = 280;
const HOTPATH_PAGINATION_IDLE_DELAY_MS = 220;
editor.addEventListener('input', () => {
  scheduleIncrementalInputDomSync();
  syncPlainTextBufferFromEditorDom();
  scheduleDeferredHotpathRender({ includePagination: false, preserveSelection: true });
  scheduleDeferredPaginationRefresh();
  setPlainText('unsafe');
  markAsModified();
  updateWordCount();
});
`;

  const state = evaluateHotPathIncrementalRenderState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    hotpathPolicyPath: HOTPATH_POLICY_PATH,
    perfThresholdsPath: PERF_THRESHOLDS_PATH,
    editorSourceOverride,
    mainSourceOverride: minimalMainSourceWithQueuedIo(),
  });

  assert.equal(state.noFullRerenderCheck.ok, false);
  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'E_FULL_RERENDER_DETECTED');
});

test('hot-path incremental render: typing loop blocking autosave path is rejected', async () => {
  const { evaluateHotPathIncrementalRenderState } = await loadModule();
  const editorSourceOverride = `
const HOTPATH_RENDER_DEBOUNCE_MS = 32;
const HOTPATH_FULL_RENDER_MIN_INTERVAL_MS = 280;
const HOTPATH_PAGINATION_IDLE_DELAY_MS = 220;
editor.addEventListener('input', () => {
  scheduleIncrementalInputDomSync();
  syncPlainTextBufferFromEditorDom();
  scheduleDeferredHotpathRender({ includePagination: false, preserveSelection: true });
  scheduleDeferredPaginationRefresh();
  markAsModified();
  updateWordCount();
});
`;

  const state = evaluateHotPathIncrementalRenderState({
    repoRoot: REPO_ROOT,
    failsignalRegistryPath: FAILSIGNAL_REGISTRY_PATH,
    hotpathPolicyPath: HOTPATH_POLICY_PATH,
    perfThresholdsPath: PERF_THRESHOLDS_PATH,
    editorSourceOverride,
    mainSourceOverride: 'function broken(){ return 0; }',
  });

  assert.equal(state.typingLoopNonBlockingCheck.ok, false);
  assert.equal(state.ok, false);
  assert.equal(state.failReason, 'E_TYPING_LOOP_BLOCKED');
});
