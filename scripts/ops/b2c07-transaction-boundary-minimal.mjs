#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const STATUS_REF = 'docs/OPS/STATUS/B2C07_TRANSACTION_BOUNDARY_MINIMAL_V1.json';
const TOKEN_NAME = 'B2C07_TRANSACTION_BOUNDARY_MINIMAL_OK';

const EXPECTED_ADMITTED_ROWS = Object.freeze([
  {
    rowId: 'CORE_SINGLE_SCENE_MUTATION_UNIT',
    proofLevel: 'CORE_RUNTIME_SCENE_BOUND',
  },
  {
    rowId: 'APPLY_PREV_HASH_GATE',
    proofLevel: 'PREV_HASH_TYPED_REJECTION',
  },
  {
    rowId: 'EVENTLOG_APPEND_ONLY_REPLAY_CHAIN',
    proofLevel: 'APPEND_ONLY_AND_REPLAY_DETERMINISM',
  },
]);

const EXPECTED_ADVISORY_ROWS = Object.freeze([
  {
    rowId: 'SCENE_TRANSACTION_ATOMICITY',
    proofLevel: 'ADVISORY_ONLY_UNTIL_DEDICATED_COMMIT_PROOF',
  },
  {
    rowId: 'CROSS_SCENE_BATCH_ATOMICITY',
    proofLevel: 'ADVISORY_ONLY_MULTI_SCENE_FLOW_SAVE_EXISTS',
  },
]);

const EXPECTED_BOUNDARY_ROWS = Object.freeze([
  {
    rowId: 'CORE_SINGLE_SCENE_MUTATION_UNIT',
    detectorId: 'B2C07_CORE_SINGLE_SCENE_MUTATION_UNIT_PROOF_BINDING_V1',
  },
  {
    rowId: 'APPLY_PREV_HASH_GATE',
    detectorId: 'B2C07_APPLY_PREV_HASH_GATE_PROOF_BINDING_V1',
  },
  {
    rowId: 'EVENTLOG_APPEND_ONLY_REPLAY_CHAIN',
    detectorId: 'B2C07_EVENTLOG_APPEND_ONLY_REPLAY_CHAIN_PROOF_BINDING_V1',
  },
]);

const EXPECTED_FORBIDDEN_AREAS = Object.freeze([
  'queueing',
  'concurrency',
  'orderingKeyRuntime',
  'recoveryProtocol',
  'runtimeCommandSurfaceExpansion',
  'crossSceneBatchAtomicity',
  'extraTransactionCluster',
]);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readJsonObject(absPath) {
  const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  if (!isObjectRecord(parsed)) {
    throw new Error(`JSON_OBJECT_EXPECTED:${absPath}`);
  }
  return parsed;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildFailure(code, extra = {}) {
  return {
    ok: false,
    code,
    [TOKEN_NAME]: 0,
    ...extra,
  };
}

function collectKeyPaths(value, prefix = '') {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectKeyPaths(entry, `${prefix}[${index}]`));
  }
  if (!isObjectRecord(value)) return [];
  const out = [];
  for (const [key, child] of Object.entries(value)) {
    const location = prefix ? `${prefix}.${key}` : key;
    out.push({ key, location });
    out.push(...collectKeyPaths(child, location));
  }
  return out;
}

function runNodeScript(repoRoot, relativePath, args = []) {
  return spawnSync(process.execPath, [relativePath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function verifyCanonBoundary(repoRoot) {
  const text = fs.readFileSync(
    path.resolve(repoRoot, 'docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md'),
    'utf8',
  );
  if (!text.includes('Atomic concurrency unit = `Scene`.')) {
    throw new Error('CANON_SCENE_UNIT_MISSING');
  }
  if (!text.includes('append-only event log')) {
    throw new Error('CANON_APPEND_ONLY_MISSING');
  }
  if (!text.includes('deterministic replay')) {
    throw new Error('CANON_DETERMINISTIC_REPLAY_MISSING');
  }
}

async function verifyCoreSingleScene(repoRoot) {
  const runtimeUrl = pathToFileURL(path.resolve(repoRoot, 'src/core/runtime.mjs')).href;
  const { CORE_COMMAND_IDS, createInitialCoreState, reduceCoreState } = await import(runtimeUrl);
  const contractsText = fs.readFileSync(path.resolve(repoRoot, 'src/core/contracts.ts'), 'utf8');
  if (!contractsText.includes('payload: { projectId: string; sceneId: string; text: string }')) {
    throw new Error('CORE_SCENE_PAYLOAD_CONTRACT_DRIFT');
  }

  const initial = createInitialCoreState();
  const createResult = reduceCoreState(initial, {
    type: CORE_COMMAND_IDS.PROJECT_CREATE,
    payload: { projectId: 'project-b2c07', title: 'B2C07', sceneId: 'scene-1' },
  });
  if (createResult.ok !== true) {
    throw new Error('CORE_CREATE_PROJECT_RED');
  }

  const augmentedState = JSON.parse(JSON.stringify(createResult.state));
  augmentedState.data.projects['project-b2c07'].scenes['scene-2'] = {
    id: 'scene-2',
    text: 'Stable second scene',
  };

  const editResult = reduceCoreState(augmentedState, {
    type: CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT,
    payload: {
      projectId: 'project-b2c07',
      sceneId: 'scene-1',
      text: 'Updated first scene',
    },
  });
  if (editResult.ok !== true) {
    throw new Error('CORE_SINGLE_SCENE_EDIT_RED');
  }
  if (editResult.state.data.projects['project-b2c07'].scenes['scene-1'].text !== 'Updated first scene') {
    throw new Error('CORE_SCENE_ONE_NOT_UPDATED');
  }
  if (editResult.state.data.projects['project-b2c07'].scenes['scene-2'].text !== 'Stable second scene') {
    throw new Error('CORE_SECOND_SCENE_MUTATED');
  }

  const missingScene = reduceCoreState(createResult.state, {
    type: CORE_COMMAND_IDS.PROJECT_APPLY_TEXT_EDIT,
    payload: {
      projectId: 'project-b2c07',
      sceneId: 'missing-scene',
      text: 'x',
    },
  });
  if (missingScene.ok !== false || normalizeString(missingScene.error?.code) !== 'E_CORE_SCENE_NOT_FOUND') {
    throw new Error('CORE_SCENE_NOT_FOUND_TYPED_ERROR_DRIFT');
  }
}

function verifyApplyPrevHashGate(repoRoot) {
  const stateRun = runNodeScript(repoRoot, 'scripts/ops/collab-apply-pipeline-state.mjs', ['--json']);
  if (stateRun.status !== 0) {
    throw new Error('APPLY_PIPELINE_STATE_RED');
  }
  const statePayload = JSON.parse(String(stateRun.stdout || '{}'));
  if (statePayload.COLLAB_APPLY_PIPELINE_OK !== 1) {
    throw new Error('APPLY_PIPELINE_TOKEN_RED');
  }
}

function verifyEventLogReplay(repoRoot) {
  const stateRun = runNodeScript(repoRoot, 'scripts/ops/collab-eventlog-state.mjs', ['--json']);
  if (stateRun.status !== 0) {
    throw new Error('EVENTLOG_STATE_RED');
  }
  const statePayload = JSON.parse(String(stateRun.stdout || '{}'));
  if (statePayload.COLLAB_EVENTLOG_OK !== 1) {
    throw new Error('EVENTLOG_TOKEN_RED');
  }
}

function verifyQueueDomainSeparate(repoRoot) {
  const stateRun = runNodeScript(repoRoot, 'scripts/ops/collab-causal-queue-readiness-state.mjs', ['--json']);
  if (stateRun.status !== 0) {
    throw new Error('QUEUE_DOMAIN_STATE_RED');
  }
  const statePayload = JSON.parse(String(stateRun.stdout || '{}'));
  if (statePayload.COLLAB_CAUSAL_QUEUE_READINESS_OK !== 1) {
    throw new Error('QUEUE_DOMAIN_TOKEN_RED');
  }
}

function verifyBatchAtomicityStaysAdvisory(repoRoot) {
  const mainSource = fs.readFileSync(path.resolve(repoRoot, 'src/main.js'), 'utf8');
  const editorSource = fs.readFileSync(path.resolve(repoRoot, 'src/renderer/editor.js'), 'utf8');
  const commandSource = fs.readFileSync(path.resolve(repoRoot, 'src/renderer/commands/projectCommands.mjs'), 'utf8');

  if (!mainSource.includes('const normalizedScenes = [];')
    || !mainSource.includes('for (const scene of normalizedScenes)')
    || !mainSource.includes("() => fileManager.writeFileAtomic(scene.path, scene.content)")
    || !mainSource.includes('savedCount: normalizedScenes.length')) {
    throw new Error('MULTI_SCENE_FLOW_SAVE_SURFACE_MISSING');
  }
  if (!editorSource.includes('runFlowSaveCommand(payload.scenes)')
    || !commandSource.includes('COMMAND_IDS.PROJECT_FLOW_SAVE_V1')) {
    throw new Error('FLOW_SAVE_BRIDGE_SURFACE_MISSING');
  }
}

export async function evaluateB2C07TransactionBoundaryMinimal({
  repoRoot = process.cwd(),
  statusRef = STATUS_REF,
} = {}) {
  try {
    const doc = readJsonObject(path.resolve(repoRoot, statusRef));
    if (normalizeString(doc.artifactId) !== 'B2C07_TRANSACTION_BOUNDARY_MINIMAL_V1'
      || doc.schemaVersion !== 1
      || normalizeString(doc.taskId) !== 'B2C07_TRANSACTION_BOUNDARY_MINIMAL'
      || normalizeString(doc.status) !== 'PASS') {
      return buildFailure('E_B2C07_STATUS_ARTIFACT_INVALID');
    }

    const boundary = isObjectRecord(doc.boundary) ? doc.boundary : {};
    const proofBinding = isObjectRecord(doc.proofBinding) ? doc.proofBinding : {};
    const admittedRows = Array.isArray(boundary.admittedBoundaryRows) ? boundary.admittedBoundaryRows : [];
    const advisoryRows = Array.isArray(boundary.advisoryBoundaryRows) ? boundary.advisoryBoundaryRows : [];
    const bindingRows = Array.isArray(proofBinding.boundaryRows) ? proofBinding.boundaryRows : [];

    if (normalizeString(boundary.transactionUnitId) !== 'SCENE'
      || !sameJson(admittedRows, EXPECTED_ADMITTED_ROWS)
      || !sameJson(advisoryRows, EXPECTED_ADVISORY_ROWS)) {
      return buildFailure('E_B2C07_BOUNDARY_SET');
    }

    if (normalizeString(proofBinding.bindingMode) !== 'DETECTOR_IDS_ONLY'
      || !sameJson(bindingRows, EXPECTED_BOUNDARY_ROWS)) {
      return buildFailure('E_B2C07_DETECTOR_BINDING');
    }

    const detectorIds = bindingRows.map((row) => normalizeString(row.detectorId));
    if (new Set(detectorIds).size !== detectorIds.length) {
      return buildFailure('E_B2C07_DETECTOR_BINDING');
    }

    const advisoryBoundary = isObjectRecord(doc.advisoryBoundary) ? doc.advisoryBoundary : {};
    if (normalizeString(advisoryBoundary.sceneTransactionAtomicityPromotion) !== 'ADVISORY_ONLY_UNTIL_DEDICATED_SCENE_COMMIT_PROOF_IS_GREEN'
      || normalizeString(advisoryBoundary.crossSceneBatchPromotion) !== 'ADVISORY_ONLY_MULTI_SCENE_FLOW_SAVE_EXISTS_WITHOUT_GROUP_ROLLBACK_PROOF'
      || normalizeString(advisoryBoundary.queueingPromotion) !== 'ADVISORY_ONLY_QUEUEING_IS_SEPARATE_DOMAIN'
      || normalizeString(advisoryBoundary.recoveryProtocolPromotion) !== 'ADVISORY_ONLY_RECOVERY_PROTOCOL_OUT_OF_SCOPE'
      || !sameJson(advisoryBoundary.forbiddenPromotionAreas, EXPECTED_FORBIDDEN_AREAS)) {
      return buildFailure('E_B2C07_FORBIDDEN_SCOPE');
    }

    const forbiddenKeys = new Set([
      'queueing',
      'concurrency',
      'orderingKeyRuntime',
      'recoveryProtocol',
      'runtimeCommandSurfaceExpansion',
      'crossSceneBatchAtomicity',
      'extraTransactionCluster',
    ]);
    const keyPaths = collectKeyPaths(doc);
    const illegalKey = keyPaths.find(({ key, location }) =>
      forbiddenKeys.has(key) && !location.startsWith('advisoryBoundary.forbiddenPromotionAreas'));
    if (illegalKey) {
      return buildFailure('E_B2C07_FORBIDDEN_SCOPE', { forbiddenLocation: illegalKey.location });
    }

    verifyCanonBoundary(repoRoot);
    await verifyCoreSingleScene(repoRoot);
    verifyApplyPrevHashGate(repoRoot);
    verifyEventLogReplay(repoRoot);
    verifyQueueDomainSeparate(repoRoot);
    verifyBatchAtomicityStaysAdvisory(repoRoot);

    return {
      ok: true,
      code: '',
      [TOKEN_NAME]: 1,
      transactionUnitId: 'SCENE',
      admittedBoundaryRowCount: admittedRows.length,
      advisoryBoundaryRowCount: advisoryRows.length,
      detectorRowCount: bindingRows.length,
    };
  } catch (error) {
    const message = error && typeof error.message === 'string' ? error.message : 'UNKNOWN';
    if (message.startsWith('CORE_')) return buildFailure('E_B2C07_CORE_SINGLE_SCENE_PROOF');
    if (message.startsWith('APPLY_PIPELINE')) return buildFailure('E_B2C07_APPLY_PIPELINE_PROOF');
    if (message.startsWith('EVENTLOG')) return buildFailure('E_B2C07_EVENTLOG_PROOF');
    if (message.startsWith('QUEUE_DOMAIN')) return buildFailure('E_B2C07_FORBIDDEN_SCOPE');
    if (message.startsWith('MULTI_SCENE') || message.startsWith('FLOW_SAVE')) {
      return buildFailure('E_B2C07_BATCH_ATOMICITY_PROMOTION');
    }
    if (message.startsWith('CANON_')) return buildFailure('E_B2C07_BOUNDARY_SET');
    return buildFailure('E_B2C07_UNEXPECTED', { message });
  }
}

function parseArgs(argv) {
  const out = {
    json: false,
    rootDir: process.cwd(),
    statusRef: STATUS_REF,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (token === '--json') {
      out.json = true;
      continue;
    }
    if (token === '--root' && i + 1 < argv.length) {
      out.rootDir = String(argv[i + 1] || '').trim() || process.cwd();
      i += 1;
      continue;
    }
    if (token === '--status-ref' && i + 1 < argv.length) {
      out.statusRef = String(argv[i + 1] || '').trim() || STATUS_REF;
      i += 1;
    }
  }
  return out;
}

const isDirectRun = (() => {
  try {
    if (!process.argv[1]) return false;
    return path.basename(process.argv[1]) === 'b2c07-transaction-boundary-minimal.mjs';
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  const args = parseArgs(process.argv.slice(2));
  const result = await evaluateB2C07TransactionBoundaryMinimal({
    repoRoot: args.rootDir,
    statusRef: args.statusRef,
  });
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${TOKEN_NAME}=${result[TOKEN_NAME]}\n`);
    if (!result.ok && result.code) process.stdout.write(`FAIL_REASON=${result.code}\n`);
  }
  process.exit(result.ok ? 0 : 1);
}
