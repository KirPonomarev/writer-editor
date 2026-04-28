#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const STATUS_REF = 'docs/OPS/STATUS/B2C06_PROJECT_LIFECYCLE_STATE_MACHINE_V1.json';
const TOKEN_NAME = 'B2C06_PROJECT_LIFECYCLE_STATE_MACHINE_OK';

const EXPECTED_MAIN_STATES = Object.freeze(['ENTRY_EMPTY', 'OPEN_CLEAN', 'OPEN_DIRTY']);
const EXPECTED_ADVISORY_STATES = Object.freeze(['RECOVERED']);
const EXPECTED_ADMITTED_TRANSITIONS = Object.freeze([
  {
    transitionId: 'ENTRY_EMPTY_TO_OPEN_CLEAN',
    from: 'ENTRY_EMPTY',
    to: 'OPEN_CLEAN',
    proofLevel: 'AVAILABILITY_ONLY',
  },
  {
    transitionId: 'OPEN_CLEAN_TO_OPEN_DIRTY',
    from: 'OPEN_CLEAN',
    to: 'OPEN_DIRTY',
    proofLevel: 'SIGNAL_AND_LABEL',
  },
]);
const EXPECTED_ADVISORY_TRANSITIONS = Object.freeze([
  {
    transitionId: 'OPEN_DIRTY_TO_OPEN_CLEAN',
    from: 'OPEN_DIRTY',
    to: 'OPEN_CLEAN',
    proofLevel: 'SIGNAL_PRESENT_ONLY',
  },
  {
    transitionId: 'OPEN_ANY_TO_RECOVERED',
    from: 'OPEN_ANY',
    to: 'RECOVERED',
    proofLevel: 'IO_LEVEL_ONLY',
  },
]);
const EXPECTED_STATE_ROWS = Object.freeze([
  { stateId: 'ENTRY_EMPTY', detectorId: 'B2C06_ENTRY_EMPTY_PROOF_BINDING_V1' },
  { stateId: 'OPEN_CLEAN', detectorId: 'B2C06_OPEN_CLEAN_PROOF_BINDING_V1' },
  { stateId: 'OPEN_DIRTY', detectorId: 'B2C06_OPEN_DIRTY_PROOF_BINDING_V1' },
]);
const EXPECTED_TRANSITION_ROWS = Object.freeze([
  { transitionId: 'ENTRY_EMPTY_TO_OPEN_CLEAN', detectorId: 'B2C06_ENTRY_EMPTY_TO_OPEN_CLEAN_PROOF_BINDING_V1' },
  { transitionId: 'OPEN_CLEAN_TO_OPEN_DIRTY', detectorId: 'B2C06_OPEN_CLEAN_TO_OPEN_DIRTY_PROOF_BINDING_V1' },
]);
const EXPECTED_FORBIDDEN_PROMOTION_AREAS = Object.freeze([
  'transactionStateMachine',
  'recoveryProtocol',
  'autosaveCadence',
  'queueing',
  'concurrency',
  'runtimeCommandSurfaceExpansion',
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

function loadJsonFromRepo(repoRoot, relativePath) {
  return readJsonObject(path.resolve(repoRoot, relativePath));
}

async function verifyEntryEmptySurface(repoRoot) {
  const modulePath = pathToFileURL(path.resolve(repoRoot, 'scripts/ops/x19-ws01-first-run-and-empty-state-flow-state.mjs')).href;
  const { evaluateX19Ws01FirstRunAndEmptyStateFlowState } = await import(modulePath);
  const state = evaluateX19Ws01FirstRunAndEmptyStateFlowState({ repoRoot });
  if (state.ok !== true || state.X19_WS01_FIRST_RUN_AND_EMPTY_STATE_FLOW_OK !== 1) {
    throw new Error('ENTRY_EMPTY_SURFACE_NOT_GREEN');
  }
  if (state.counts.entryCount !== 5 || state.counts.requiredEntryActionCount !== 5) {
    throw new Error('ENTRY_EMPTY_COUNTS_DRIFT');
  }
}

function verifyUiTransitionSurface(repoRoot) {
  const guardRun = spawnSync(
    process.execPath,
    ['scripts/guards/sector-u-ui-state-transitions.mjs', '--mode', 'BLOCKING'],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  if (guardRun.status !== 0) {
    throw new Error('UI_TRANSITION_GUARD_RED');
  }

  const doc = loadJsonFromRepo(repoRoot, 'docs/OPS/STATUS/UI_STATE_TRANSITIONS.json');
  const transitions = Array.isArray(doc.transitions) ? doc.transitions : [];
  const has = (from, event, to) => transitions.some((row) =>
    row && row.from === from && row.event === event && row.to === to);

  if (!has('PROJECT_OPENING', 'UI_OPEN_SUCCEEDED', 'PROJECT_OPEN')) {
    throw new Error('OPEN_SUCCESS_TRANSITION_MISSING');
  }
  if (!has('PROJECT_OPEN', 'UI_EDIT_MUTATION', 'PROJECT_DIRTY')) {
    throw new Error('DIRTY_TRANSITION_MISSING');
  }
  if (!has('SAVING', 'UI_SAVE_SUCCEEDED', 'PROJECT_OPEN')) {
    throw new Error('SAVE_SUCCESS_TRANSITION_MISSING');
  }
}

async function verifyCleanDirtySurface(repoRoot) {
  const modulePath = pathToFileURL(path.resolve(repoRoot, 'src/renderer/commands/flowMode.mjs')).href;
  const flow = await import(modulePath);
  if (flow.buildFlowModeCoreStatus(2, { dirty: false }) !== 'Flow mode core (2) · synced') {
    throw new Error('OPEN_CLEAN_LABEL_DRIFT');
  }
  if (flow.buildFlowModeCoreStatus(2, { dirty: true }) !== 'Flow mode core (2) · unsaved changes · Shift+S save') {
    throw new Error('OPEN_DIRTY_LABEL_DRIFT');
  }
  if (flow.buildFlowModeCoreStatus(-1, { dirty: true }) !== 'Flow mode core (0) · unsaved changes · Shift+S save') {
    throw new Error('OPEN_DIRTY_FALLBACK_DRIFT');
  }
}

function verifyDirtySignalSurface(repoRoot) {
  const source = fs.readFileSync(path.resolve(repoRoot, 'src/renderer/tiptap/index.js'), 'utf8');
  if (!source.includes("signalId: 'signal.localDirty.set'")) {
    throw new Error('DIRTY_SIGNAL_ID_MISSING');
  }
  if (!source.includes('notifyDirtyState(false)') || !source.includes('notifyDirtyState(true)')) {
    throw new Error('DIRTY_SIGNAL_TRUE_FALSE_PATH_MISSING');
  }
}

function verifySaveCompletionStaysAdvisory(repoRoot) {
  const run = spawnSync(
    process.execPath,
    ['scripts/ops/contour-01-primary-editor-save-recovery-proofhook.mjs', '--json'],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  if (run.status === 0) {
    return;
  }
  const payload = JSON.parse(String(run.stdout || '{}'));
  if (payload.CONTOUR_01_PRIMARY_EDITOR_SAVE_RECOVERY_PATH_OK !== 0) {
    throw new Error('SAVE_COMPLETION_PROMOTION_DRIFT');
  }
  if (!Array.isArray(payload.missingChecks) || payload.missingChecks.length === 0) {
    throw new Error('SAVE_COMPLETION_MISSING_CHECKS_ABSENT');
  }
}

function verifyRecoveredStaysAdvisory(repoRoot) {
  const artifactStateRun = spawnSync(
    process.execPath,
    ['scripts/ops/phase03-project-workspace-state-artifact-state.mjs', '--json'],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  const foundationRun = spawnSync(
    process.execPath,
    ['scripts/ops/phase03-project-workspace-state-foundation-state.mjs', '--json'],
    { cwd: repoRoot, encoding: 'utf8' },
  );

  if (artifactStateRun.status === 0 || foundationRun.status === 0) {
    throw new Error('WORKSPACE_BINDING_ALREADY_GREEN');
  }

  const artifact = JSON.parse(String(artifactStateRun.stdout || '{}'));
  const foundation = JSON.parse(String(foundationRun.stdout || '{}'));
  if (artifact.overallStatus !== 'HOLD' || foundation.overallStatus !== 'HOLD') {
    throw new Error('WORKSPACE_BINDING_HOLD_DRIFT');
  }
}

export async function evaluateB2C06ProjectLifecycleState({
  repoRoot = process.cwd(),
  statusRef = STATUS_REF,
} = {}) {
  try {
    const doc = readJsonObject(path.resolve(repoRoot, statusRef));
    if (normalizeString(doc.artifactId) !== 'B2C06_PROJECT_LIFECYCLE_STATE_MACHINE_V1'
      || doc.schemaVersion !== 1
      || normalizeString(doc.taskId) !== 'B2C06_PROJECT_LIFECYCLE_STATE_MACHINE'
      || normalizeString(doc.status) !== 'PASS') {
      return buildFailure('E_B2C06_STATUS_ARTIFACT_INVALID');
    }

    const graph = isObjectRecord(doc.graph) ? doc.graph : {};
    const proofBinding = isObjectRecord(doc.proofBinding) ? doc.proofBinding : {};
    const mainStates = Array.isArray(graph.mainStateIds) ? graph.mainStateIds : [];
    const advisoryStates = Array.isArray(graph.advisoryStateIds) ? graph.advisoryStateIds : [];
    const admittedTransitions = Array.isArray(graph.admittedTransitions) ? graph.admittedTransitions : [];
    const advisoryTransitions = Array.isArray(graph.advisoryTransitions) ? graph.advisoryTransitions : [];
    const stateRows = Array.isArray(proofBinding.stateRows) ? proofBinding.stateRows : [];
    const transitionRows = Array.isArray(proofBinding.transitionRows) ? proofBinding.transitionRows : [];

    if (normalizeString(graph.entryStateId) !== 'ENTRY_EMPTY'
      || !sameJson(mainStates, EXPECTED_MAIN_STATES)
      || !sameJson(advisoryStates, EXPECTED_ADVISORY_STATES)) {
      return buildFailure('E_B2C06_STATE_SET');
    }

    if (!sameJson(admittedTransitions, EXPECTED_ADMITTED_TRANSITIONS)
      || !sameJson(advisoryTransitions, EXPECTED_ADVISORY_TRANSITIONS)) {
      return buildFailure('E_B2C06_TRANSITION_SET');
    }

    if (normalizeString(proofBinding.bindingMode) !== 'DETECTOR_IDS_ONLY'
      || !sameJson(stateRows, EXPECTED_STATE_ROWS)
      || !sameJson(transitionRows, EXPECTED_TRANSITION_ROWS)) {
      return buildFailure('E_B2C06_DETECTOR_BINDING');
    }

    const detectorIds = [
      ...stateRows.map((row) => normalizeString(row.detectorId)),
      ...transitionRows.map((row) => normalizeString(row.detectorId)),
    ];
    if (new Set(detectorIds).size !== detectorIds.length) {
      return buildFailure('E_B2C06_DETECTOR_BINDING');
    }

    const advisoryBoundary = isObjectRecord(doc.advisoryBoundary) ? doc.advisoryBoundary : {};
    if (normalizeString(advisoryBoundary.saveCompletionStatePromotion) !== 'ADVISORY_ONLY_UNTIL_FULL_PROJECT_SAVE_PATH_IS_GREEN'
      || normalizeString(advisoryBoundary.recoveredStatePromotion) !== 'ADVISORY_ONLY_UNTIL_RECOVERED_PROJECT_STATE_IS_MACHINE_PROVED_WITHOUT_PROTOCOL_LEAK'
      || normalizeString(advisoryBoundary.workspaceBindingPromotion) !== 'ADVISORY_ONLY_UNTIL_PHASE03_FOUNDATION_CHAIN_IS_GREEN'
      || !sameJson(advisoryBoundary.forbiddenPromotionAreas, EXPECTED_FORBIDDEN_PROMOTION_AREAS)) {
      return buildFailure('E_B2C06_FORBIDDEN_SCOPE');
    }

    const forbiddenKeyLocations = collectKeyPaths(doc)
      .filter(({ key, location }) =>
        EXPECTED_FORBIDDEN_PROMOTION_AREAS.includes(key)
        && !location.startsWith('advisoryBoundary.forbiddenPromotionAreas'))
      .map(({ location }) => location);
    if (forbiddenKeyLocations.length > 0) {
      return buildFailure('E_B2C06_FORBIDDEN_SCOPE', { forbiddenKeyLocations });
    }

    try {
      await verifyEntryEmptySurface(repoRoot);
    } catch (error) {
      return buildFailure('E_B2C06_ENTRY_EMPTY_PROOF', { error: String(error?.message || error) });
    }

    try {
      verifyUiTransitionSurface(repoRoot);
    } catch (error) {
      return buildFailure('E_B2C06_UI_TRANSITIONS_PROOF', { error: String(error?.message || error) });
    }

    try {
      await verifyCleanDirtySurface(repoRoot);
      verifyDirtySignalSurface(repoRoot);
    } catch (error) {
      return buildFailure('E_B2C06_OPEN_DIRTY_PROOF', { error: String(error?.message || error) });
    }

    try {
      verifySaveCompletionStaysAdvisory(repoRoot);
    } catch (error) {
      return buildFailure('E_B2C06_SAVE_COMPLETION_PROMOTION', { error: String(error?.message || error) });
    }

    try {
      verifyRecoveredStaysAdvisory(repoRoot);
    } catch (error) {
      return buildFailure('E_B2C06_RECOVERED_PROMOTION', { error: String(error?.message || error) });
    }

    return {
      ok: true,
      code: '',
      [TOKEN_NAME]: 1,
      statusRef,
      mainStateCount: mainStates.length,
      advisoryStateCount: advisoryStates.length,
      admittedTransitionCount: admittedTransitions.length,
      detectorRowCount: detectorIds.length,
    };
  } catch (error) {
    return buildFailure('E_B2C06_UNEXPECTED', { error: String(error?.message || error) });
  }
}

async function main() {
  const jsonMode = process.argv.includes('--json');
  const state = await evaluateB2C06ProjectLifecycleState();
  process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
  if (!state.ok) {
    process.exitCode = 1;
  }
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const selfPath = path.resolve(new URL(import.meta.url).pathname);
if (entrypointPath === selfPath) {
  main();
}
