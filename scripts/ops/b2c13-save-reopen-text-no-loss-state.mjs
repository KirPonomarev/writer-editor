#!/usr/bin/env node
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const TOKEN_NAME = 'B2C13_SAVE_REOPEN_TEXT_NO_LOSS_OK';

const TASK_ID = 'B2C13_SAVE_REOPEN_TEXT_NO_LOSS';
const STATUS_BASENAME = 'B2C13_SAVE_REOPEN_TEXT_NO_LOSS_STATUS_V1.json';
const EVIDENCE_DIR = path.join('docs', 'OPS', 'EVIDENCE', TASK_ID, 'TICKET_01');
const DONOR = Object.freeze({
  primaryBasename: 'writer-editor-longform-v5_1-block2-trusted-kernel-pack-v1.zip',
  primarySha256: '7189d8357f340d89112b02a57eb9315f9af4695ac00e3a2707801e4d97320791',
  claimBoundary: 'ARCHIVE_OVERLAY_READY_FOR_REPO_INTEGRATION_NO_RELEASE_CLAIM',
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

function hashText(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

function normalizeVisibleText(value) {
  return String(value ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n').trim();
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    write: argv.includes('--write'),
  };
}

async function loadEnvelope(repoRoot) {
  return import(pathToFileURL(path.join(repoRoot, 'src', 'renderer', 'documentContentEnvelope.mjs')).href);
}

function loadBatchAtomic(repoRoot) {
  const require = createRequire(import.meta.url);
  return require(path.join(repoRoot, 'src', 'utils', 'flowSceneBatchAtomic.js'));
}

function buildSceneContent(envelope, visibleText) {
  return envelope.composeObservablePayload({
    doc: envelope.buildParagraphDocumentFromText(visibleText),
  });
}

async function readSceneEnvelope(scenePath, envelope) {
  const raw = await fsp.readFile(scenePath, 'utf8');
  const parsed = envelope.parseObservablePayload(raw);
  const text = normalizeVisibleText(parsed.text);
  return {
    text,
    textHash: hashText(text),
    version: parsed.version,
    issueCode: parsed.issue ? parsed.issue.code : '',
  };
}

async function runSaveReopenProof(repoRoot) {
  const envelope = await loadEnvelope(repoRoot);
  const { writeFlowSceneBatchAtomic, readFlowSceneBatchMarkers } = loadBatchAtomic(repoRoot);
  const projectRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'b2c13-save-reopen-'));
  const sceneDir = path.join(projectRoot, 'scenes');
  const sceneA = path.join(sceneDir, 'scene-a.md');
  const sceneB = path.join(sceneDir, 'scene-b.md');
  const initialA = 'Alpha before\nSecond line';
  const initialB = 'Beta before';
  const editedA = 'Alpha after\nSecond line preserved';
  const editedB = 'Beta after\nUnicode: Privet';

  await fsp.mkdir(sceneDir, { recursive: true });
  await fsp.writeFile(sceneA, buildSceneContent(envelope, initialA), 'utf8');
  await fsp.writeFile(sceneB, buildSceneContent(envelope, initialB), 'utf8');

  const unsavedDraftAHash = hashText(normalizeVisibleText(editedA));
  const missingSaveReopen = await readSceneEnvelope(sceneA, envelope);
  const missingSaveDetected = missingSaveReopen.textHash !== unsavedDraftAHash;

  const saveResult = await writeFlowSceneBatchAtomic({
    projectRoot,
    entries: [
      { path: sceneA, content: buildSceneContent(envelope, editedA) },
      { path: sceneB, content: buildSceneContent(envelope, editedB) },
    ],
  });

  const reopenedA = await readSceneEnvelope(sceneA, envelope);
  const reopenedB = await readSceneEnvelope(sceneB, envelope);
  const expectedAHash = hashText(normalizeVisibleText(editedA));
  const expectedBHash = hashText(normalizeVisibleText(editedB));

  await fsp.writeFile(sceneA, buildSceneContent(envelope, 'Alpha drifted'), 'utf8');
  const driftedA = await readSceneEnvelope(sceneA, envelope);
  const negativeDriftDetected = driftedA.textHash !== expectedAHash;
  const staleMarkersAfterCommit = await readFlowSceneBatchMarkers(projectRoot);

  return {
    positiveSaveOk: saveResult.ok === true,
    sceneAHashMatchesAfterReopen: reopenedA.textHash === expectedAHash,
    sceneBHashMatchesAfterReopen: reopenedB.textHash === expectedBHash,
    sceneAVisibleTextMatchesAfterReopen: reopenedA.text === normalizeVisibleText(editedA),
    sceneBVisibleTextMatchesAfterReopen: reopenedB.text === normalizeVisibleText(editedB),
    sceneAVersionAfterReopen: reopenedA.version,
    sceneBVersionAfterReopen: reopenedB.version,
    sceneAIssueCodeAfterReopen: reopenedA.issueCode,
    sceneBIssueCodeAfterReopen: reopenedB.issueCode,
    missingSaveDetected,
    negativeDriftDetected,
    staleMarkerCountAfterCommit: staleMarkersAfterCommit.length,
    sceneCount: 2,
  };
}

export async function evaluateB2C13SaveReopenTextNoLossState(input = {}) {
  const repoRoot = path.resolve(String(input.repoRoot || process.cwd()));
  const runtime = await runSaveReopenProof(repoRoot);
  const failRows = [];

  if (!runtime.positiveSaveOk) failRows.push('SAVE_REOPEN_POSITIVE_SAVE_RED');
  if (!runtime.sceneAHashMatchesAfterReopen) failRows.push('SCENE_A_TEXT_HASH_MISMATCH');
  if (!runtime.sceneBHashMatchesAfterReopen) failRows.push('SCENE_B_TEXT_HASH_MISMATCH');
  if (!runtime.sceneAVisibleTextMatchesAfterReopen) failRows.push('SCENE_A_VISIBLE_TEXT_MISMATCH');
  if (!runtime.sceneBVisibleTextMatchesAfterReopen) failRows.push('SCENE_B_VISIBLE_TEXT_MISMATCH');
  if (runtime.sceneAIssueCodeAfterReopen) failRows.push('SCENE_A_PAYLOAD_ISSUE');
  if (runtime.sceneBIssueCodeAfterReopen) failRows.push('SCENE_B_PAYLOAD_ISSUE');
  if (!runtime.missingSaveDetected) failRows.push('MISSING_SAVE_NEGATIVE_RED');
  if (!runtime.negativeDriftDetected) failRows.push('DRIFT_NEGATIVE_RED');
  if (runtime.staleMarkerCountAfterCommit !== 0) failRows.push('STALE_MARKERS_AFTER_COMMIT');

  return {
    artifactId: 'B2C13_SAVE_REOPEN_TEXT_NO_LOSS_STATUS_V1',
    schemaVersion: 1,
    taskId: TASK_ID,
    status: failRows.length === 0 ? 'PASS' : 'FAIL',
    ok: failRows.length === 0,
    [TOKEN_NAME]: failRows.length === 0 ? 1 : 0,
    failSignal: failRows.length === 0 ? '' : 'E_B2C13_SAVE_REOPEN_TEXT_NO_LOSS_RED',
    failRows,
    donor: DONOR,
    scope: {
      contour: 'B2C13_ONLY',
      releaseClaim: false,
      docxDependencyImported: false,
      uiTouched: false,
      electronRuntimeClaim: false,
      b2c14Closed: false,
      b2c15Closed: false,
    },
    proof: {
      repoBound: true,
      saveLayer: 'writeFlowSceneBatchAtomic',
      textHashAlgorithm: 'sha256_visible_text',
      sceneCount: runtime.sceneCount,
      positiveSaveOk: runtime.positiveSaveOk,
      textHashMatchesAfterReopen: runtime.sceneAHashMatchesAfterReopen && runtime.sceneBHashMatchesAfterReopen,
      visibleTextMatchesAfterReopen: runtime.sceneAVisibleTextMatchesAfterReopen && runtime.sceneBVisibleTextMatchesAfterReopen,
      missingSaveNegativeOk: runtime.missingSaveDetected,
      driftNegativeOk: runtime.negativeDriftDetected,
      staleMarkerCountAfterCommit: runtime.staleMarkerCountAfterCommit,
    },
    runtime,
  };
}

async function writeStateArtifacts(repoRoot, state) {
  const statusPath = path.join(repoRoot, 'docs', 'OPS', 'STATUS', STATUS_BASENAME);
  const evidencePath = path.join(repoRoot, EVIDENCE_DIR);
  await fsp.mkdir(path.dirname(statusPath), { recursive: true });
  await fsp.mkdir(evidencePath, { recursive: true });
  await fsp.writeFile(statusPath, `${stableStringify(state)}\n`, 'utf8');
  await fsp.writeFile(path.join(evidencePath, 'save-reopen-proof.json'), `${stableStringify(state.proof)}\n`, 'utf8');
  await fsp.writeFile(path.join(evidencePath, 'donor-mapping.json'), `${stableStringify({
    donor: state.donor,
    acceptedUse: 'INPUT_AND_TEST_IDEAS_ONLY',
    rejectedUse: 'BLIND_OVERLAY_OR_RELEASE_CLAIM',
    mappedContour: TASK_ID,
  })}\n`, 'utf8');
  await fsp.writeFile(path.join(evidencePath, 'command-results.json'), `${stableStringify({
    commands: [
      'node scripts/ops/b2c13-save-reopen-text-no-loss-state.mjs --write --json',
      'node --test test/contracts/b2c13-save-reopen-text-no-loss.contract.test.js',
      'npm run oss:policy',
      'node scripts/ops/b2c12-persist-effects-atomic-write-state.mjs --json',
    ],
    status: 'RECORDED_BY_B2C13_STATE_SCRIPT',
  })}\n`, 'utf8');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs();
  const repoRoot = process.cwd();
  const state = await evaluateB2C13SaveReopenTextNoLossState({ repoRoot });
  if (args.write) {
    await writeStateArtifacts(repoRoot, state);
  }
  process.stdout.write(`${stableStringify(state)}\n`);
}
