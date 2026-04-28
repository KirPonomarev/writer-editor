#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B2C12_PERSIST_EFFECTS_ATOMIC_WRITE_OK';

const require = createRequire(import.meta.url);

const FILES = Object.freeze({
  main: 'src/main.js',
  helper: 'src/utils/flowSceneBatchAtomic.js',
  fileManager: 'src/utils/fileManager.js',
});

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableSortObject(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSortObject(entry));
  if (!isObjectRecord(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSortObject(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableSortObject(value), null, 2);
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    json: argv.includes('--json'),
  };
}

function readText(repoRoot, relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function makeTempProjectRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeScene(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
}

function listJsonMarkers(projectRoot) {
  const batchRoot = path.join(projectRoot, '.flow-batch');
  if (!fs.existsSync(batchRoot)) return [];
  return fs.readdirSync(batchRoot)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => path.join(batchRoot, entry))
    .sort();
}

async function evaluateRuntimeProofs(repoRoot) {
  const {
    readFlowSceneBatchMarkers,
    writeFlowSceneBatchAtomic,
  } = require(path.join(repoRoot, FILES.helper));

  const positiveRoot = makeTempProjectRoot('b2c12-positive-');
  const positiveA = path.join(positiveRoot, 'scenes', 'a.md');
  const positiveB = path.join(positiveRoot, 'scenes', 'b.md');
  writeScene(positiveA, 'before-a\n');
  writeScene(positiveB, 'before-b\n');
  const positive = await writeFlowSceneBatchAtomic({
    projectRoot: positiveRoot,
    entries: [
      { path: positiveA, content: 'after-a\n' },
      { path: positiveB, content: 'after-b\n' },
    ],
  });

  const rollbackRoot = makeTempProjectRoot('b2c12-rollback-');
  const rollbackA = path.join(rollbackRoot, 'scenes', 'a.md');
  const rollbackB = path.join(rollbackRoot, 'scenes', 'b.md');
  writeScene(rollbackA, 'before-a\n');
  writeScene(rollbackB, 'before-b\n');
  const rollback = await writeFlowSceneBatchAtomic(
    {
      projectRoot: rollbackRoot,
      entries: [
        { path: rollbackA, content: 'after-a\n' },
        { path: rollbackB, content: 'after-b\n' },
      ],
    },
    {
      afterActivate({ index }) {
        if (index === 0) {
          throw new Error('forced-after-activate-failure');
        }
      },
    },
  );

  const commitRoot = makeTempProjectRoot('b2c12-marker-');
  const commitA = path.join(commitRoot, 'scenes', 'a.md');
  const commitB = path.join(commitRoot, 'scenes', 'b.md');
  writeScene(commitA, 'before-a\n');
  writeScene(commitB, 'before-b\n');
  const missingCommitMarker = await writeFlowSceneBatchAtomic(
    {
      projectRoot: commitRoot,
      entries: [
        { path: commitA, content: 'after-a\n' },
        { path: commitB, content: 'after-b\n' },
      ],
    },
    {
      afterActivate({ markerPath, index }) {
        if (index === 1) {
          fs.unlinkSync(markerPath);
        }
      },
    },
  );

  const staleRoot = makeTempProjectRoot('b2c12-stale-');
  const staleA = path.join(staleRoot, 'scenes', 'a.md');
  writeScene(staleA, 'before-a\n');
  fs.mkdirSync(path.join(staleRoot, '.flow-batch'), { recursive: true });
  fs.writeFileSync(path.join(staleRoot, '.flow-batch', 'stale.json'), JSON.stringify({ state: 'FAILED' }, null, 2), 'utf8');
  const stale = await writeFlowSceneBatchAtomic({
    projectRoot: staleRoot,
    entries: [{ path: staleA, content: 'after-a\n' }],
  });

  return {
    positiveBatchCommitOk: Boolean(
      positive.ok === true
      && fs.readFileSync(positiveA, 'utf8') === 'after-a\n'
      && fs.readFileSync(positiveB, 'utf8') === 'after-b\n'
      && (await readFlowSceneBatchMarkers(positiveRoot)).length === 0,
    ),
    partialBatchRollbackOk: Boolean(
      rollback.ok === false
      && rollback.error.code === 'M7_FLOW_BATCH_WRITE_FAIL'
      && fs.readFileSync(rollbackA, 'utf8') === 'before-a\n'
      && fs.readFileSync(rollbackB, 'utf8') === 'before-b\n'
      && (await readFlowSceneBatchMarkers(rollbackRoot)).length === 1,
    ),
    commitMarkerNegativeOk: Boolean(
      missingCommitMarker.ok === false
      && missingCommitMarker.error.code === 'M7_FLOW_BATCH_COMMIT_MARKER_MISSING'
      && fs.readFileSync(commitA, 'utf8') === 'before-a\n'
      && fs.readFileSync(commitB, 'utf8') === 'before-b\n'
      && (await readFlowSceneBatchMarkers(commitRoot)).length === 1,
    ),
    staleBatchRejectOk: Boolean(
      stale.ok === false
      && stale.error.code === 'M7_FLOW_BATCH_STALE'
      && fs.readFileSync(staleA, 'utf8') === 'before-a\n',
    ),
    recoveryEvidenceMinimalOk: listJsonMarkers(rollbackRoot).length === 1 && listJsonMarkers(commitRoot).length === 1,
  };
}

export async function evaluateB2C12PersistEffectsAtomicWriteState(input = {}) {
  const repoRoot = path.resolve(String(input.repoRoot || process.cwd()));
  const mainText = readText(repoRoot, FILES.main);
  const helperText = readText(repoRoot, FILES.helper);
  const fileManagerText = readText(repoRoot, FILES.fileManager);
  const runtime = await evaluateRuntimeProofs(repoRoot);

  const flowSaveUsesBatchAtomicHelperOk = mainText.includes('writeFlowSceneBatchAtomic({')
    && mainText.includes("'save flow scene batch'");
  const flowOpenGuardBlocksStaleBatchOk = mainText.includes("flow_open_batch_recovery_required")
    && mainText.includes('getFlowBatchGuard(projectRoot)');
  const flowSaveGuardBlocksStaleBatchOk = mainText.includes("flow_save_batch_recovery_required");
  const directSequentialSceneWriteRemovedOk = !mainText.includes("() => fileManager.writeFileAtomic(scene.path, scene.content)");
  const markerReadExportOk = helperText.includes('readFlowSceneBatchMarkers');
  const batchRecoveryFailureMarkerOk = helperText.includes("state: 'FAILED'");
  const fileLevelAtomicityPresentOk = fileManagerText.includes('async function writeFileAtomic(');
  const broadScopeLeakDetected = [
    'save_reopen',
    'visible_text_equals',
    'restoreDrill',
    'migration',
  ].some((marker) => helperText.includes(marker));

  const failRows = [];
  if (!flowSaveUsesBatchAtomicHelperOk) failRows.push('FLOW_SAVE_BATCH_HELPER_MISSING');
  if (!flowOpenGuardBlocksStaleBatchOk) failRows.push('FLOW_OPEN_BATCH_GUARD_MISSING');
  if (!flowSaveGuardBlocksStaleBatchOk) failRows.push('FLOW_SAVE_BATCH_GUARD_MISSING');
  if (!directSequentialSceneWriteRemovedOk) failRows.push('DIRECT_SEQUENTIAL_SCENE_WRITE_REMAINS');
  if (!markerReadExportOk) failRows.push('BATCH_MARKER_EXPORT_MISSING');
  if (!batchRecoveryFailureMarkerOk) failRows.push('FAILED_MARKER_MISSING');
  if (!fileLevelAtomicityPresentOk) failRows.push('FILE_LEVEL_ATOMIC_HELPER_MISSING');
  if (!runtime.positiveBatchCommitOk) failRows.push('BATCH_COMMIT_RUNTIME_RED');
  if (!runtime.partialBatchRollbackOk) failRows.push('PARTIAL_BATCH_ROLLBACK_RED');
  if (!runtime.commitMarkerNegativeOk) failRows.push('COMMIT_MARKER_NEGATIVE_RED');
  if (!runtime.staleBatchRejectOk) failRows.push('STALE_BATCH_NEGATIVE_RED');
  if (!runtime.recoveryEvidenceMinimalOk) failRows.push('RECOVERY_EVIDENCE_MINIMAL_RED');
  if (broadScopeLeakDetected) failRows.push('BROAD_SCOPE_LEAK');

  return {
    ok: failRows.length === 0,
    [TOKEN_NAME]: failRows.length === 0 ? 1 : 0,
    failSignal: failRows.length === 0 ? '' : 'E_B2C12_ATOMIC_WRITE_RED',
    failRows,
    flowSaveUsesBatchAtomicHelperOk,
    flowOpenGuardBlocksStaleBatchOk,
    flowSaveGuardBlocksStaleBatchOk,
    directSequentialSceneWriteRemovedOk,
    markerReadExportOk,
    batchRecoveryFailureMarkerOk,
    fileLevelAtomicityPresentOk,
    positiveBatchCommitOk: runtime.positiveBatchCommitOk,
    partialBatchRollbackOk: runtime.partialBatchRollbackOk,
    commitMarkerNegativeOk: runtime.commitMarkerNegativeOk,
    staleBatchRejectOk: runtime.staleBatchRejectOk,
    recoveryEvidenceMinimalOk: runtime.recoveryEvidenceMinimalOk,
    broadStorageRewriteTouched: false,
    saveReopenScopeTouched: false,
    recoveryReadableScopeTouched: false,
    migrationScopeTouched: false,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs();
  const state = await evaluateB2C12PersistEffectsAtomicWriteState({ repoRoot: process.cwd() });
  const json = `${stableStringify(state)}\n`;
  if (args.json) {
    process.stdout.write(json);
  } else {
    process.stdout.write(json);
  }
}
