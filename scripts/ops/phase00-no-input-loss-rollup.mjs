#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluatePhase00NoInputLossCore } from './phase00-tiptap-no-input-loss-core-smoke.mjs';

const REQUIRED_CASE_IDS = Object.freeze([
  'NIL_BASIC_TYPING',
  'NIL_PASTE_PLAIN_TEXT',
  'NIL_IME_COMPOSITION',
  'NIL_SELECTION',
  'NIL_REPLACE',
  'NIL_UNDO',
  'NIL_REDO',
  'NIL_SAVE',
  'NIL_REOPEN',
  'NIL_RECOVERY_RESTORE',
]);

const EVIDENCE_SOURCES = Object.freeze([
  'phase00-tiptap-no-input-loss-core-smoke.mjs',
  'phase00-tiptap-persistence-smoke.mjs',
  'PHASE00_IME_REAL_EVIDENCE_V1.json',
]);

const FAIL_REASON_FORCED_NEGATIVE = 'E_NO_INPUT_LOSS_ROLLUP_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_NO_INPUT_LOSS_ROLLUP_UNEXPECTED';
const DETECTOR_TOKEN = 'TEXT_NO_LOSS_OK';

function parseArgs(argv) {
  const out = { json: false, forceNegative: false };
  for (const token of argv) {
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
  }
  return out;
}

function makeCaseEntry(status, measured, evidenceSourceId, evidenceCaseId, note) {
  return {
    status,
    measured,
    evidenceSourceId,
    evidenceCaseId,
    note,
  };
}

const IME_EVIDENCE_CANDIDATE_PATHS = Object.freeze([
  'PHASE00_IME_REAL_EVIDENCE_V1.json',
  'docs/OPS/STATUS/PHASE00_IME_REAL_EVIDENCE_V1.json',
]);

function readImeEvidenceArtifact() {
  for (const relativePath of IME_EVIDENCE_CANDIDATE_PATHS) {
    const absolutePath = path.resolve(relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    try {
      const payload = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
      return {
        present: true,
        path: relativePath,
        payload,
      };
    } catch {
      return {
        present: true,
        path: relativePath,
        payload: null,
      };
    }
  }

  return {
    present: false,
    path: '',
    payload: null,
  };
}

function toMeasuredCaseEntry(sourceState, evidenceSourceId, evidenceCaseId) {
  const seamValue = Boolean(sourceState);
  return makeCaseEntry(
    seamValue ? 'GREEN' : 'OPEN_GAP',
    true,
    evidenceSourceId,
    evidenceCaseId,
    seamValue ? 'MEASURED_AND_GREEN' : 'MEASURED_AND_FAILED',
  );
}

function buildCaseStatusById(coreState, persistenceState) {
  const statusById = {};
  const imeEvidence = readImeEvidenceArtifact();
  const imeEvidencePass = imeEvidence.present
    && imeEvidence.payload
    && imeEvidence.payload.status === 'PASS';

  statusById.NIL_BASIC_TYPING = toMeasuredCaseEntry(
    coreState.caseResults['basic-typing-exact-text'],
    'phase00-tiptap-no-input-loss-core-smoke.mjs',
    'basic-typing-exact-text',
  );
  statusById.NIL_PASTE_PLAIN_TEXT = toMeasuredCaseEntry(
    coreState.caseResults['paste-plain-text-exact-text'],
    'phase00-tiptap-no-input-loss-core-smoke.mjs',
    'paste-plain-text-exact-text',
  );
  statusById.NIL_IME_COMPOSITION = makeCaseEntry(
    imeEvidencePass ? 'GREEN' : 'OPEN_GAP',
    imeEvidence.present,
    imeEvidence.path || 'none',
    'manual-primary-path-ime-verification',
    imeEvidencePass
      ? 'MANUAL_PRIMARY_PATH_IME_EVIDENCE_BOUND'
      : 'IME_EVIDENCE_ARTIFACT_MISSING_OR_NOT_PASS',
  );
  statusById.NIL_SELECTION = toMeasuredCaseEntry(
    coreState.caseResults['selection-targeted-edit-no-bleed'],
    'phase00-tiptap-no-input-loss-core-smoke.mjs',
    'selection-targeted-edit-no-bleed',
  );
  statusById.NIL_REPLACE = toMeasuredCaseEntry(
    coreState.caseResults['replace-over-selection-exact-result'],
    'phase00-tiptap-no-input-loss-core-smoke.mjs',
    'replace-over-selection-exact-result',
  );
  statusById.NIL_UNDO = toMeasuredCaseEntry(
    coreState.caseResults['undo-restores-pre-edit-oracle'],
    'phase00-tiptap-no-input-loss-core-smoke.mjs',
    'undo-restores-pre-edit-oracle',
  );
  statusById.NIL_REDO = toMeasuredCaseEntry(
    coreState.caseResults['redo-restores-post-edit-oracle'],
    'phase00-tiptap-no-input-loss-core-smoke.mjs',
    'redo-restores-post-edit-oracle',
  );
  statusById.NIL_SAVE = toMeasuredCaseEntry(
    persistenceState.seamResults['save-reopen-text-roundtrip'],
    'phase00-tiptap-persistence-smoke.mjs',
    'save-reopen-text-roundtrip',
  );
  statusById.NIL_REOPEN = toMeasuredCaseEntry(
    persistenceState.seamResults['save-reopen-text-roundtrip'],
    'phase00-tiptap-persistence-smoke.mjs',
    'save-reopen-text-roundtrip',
  );
  statusById.NIL_RECOVERY_RESTORE = toMeasuredCaseEntry(
    persistenceState.seamResults['recovery-restore-payload-roundtrip'],
    'phase00-tiptap-persistence-smoke.mjs',
    'recovery-restore-payload-roundtrip',
  );

  return statusById;
}

function readPersistenceState() {
  const result = spawnSync(
    process.execPath,
    [path.resolve('scripts/ops/phase00-tiptap-persistence-smoke.mjs'), '--json'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
      },
    },
  );
  const rawOutput = String(result.stdout || '').trim();

  if (!rawOutput) {
    const stderr = String(result.stderr || '').trim();
    throw new Error(stderr || 'PERSISTENCE_PROOFHOOK_JSON_MISSING');
  }

  let payload;
  try {
    payload = JSON.parse(rawOutput);
  } catch {
    throw new Error('PERSISTENCE_PROOFHOOK_JSON_INVALID');
  }

  if (!payload || typeof payload !== 'object' || typeof payload.seamResults !== 'object' || payload.seamResults === null) {
    throw new Error('PERSISTENCE_PROOFHOOK_SHAPE_INVALID');
  }

  return payload;
}

function evaluateRollupState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);
  const coreState = evaluatePhase00NoInputLossCore({ forceNegative: false });
  const persistenceState = readPersistenceState();
  const caseStatusById = buildCaseStatusById(coreState, persistenceState);

  const greenCaseIds = REQUIRED_CASE_IDS.filter((id) => caseStatusById[id].status === 'GREEN');
  const openGapIds = REQUIRED_CASE_IDS.filter((id) => caseStatusById[id].status !== 'GREEN');
  const overallStatus = openGapIds.length === 0 ? 'PASS' : 'HOLD';

  if (forceNegative) {
    return {
      ok: false,
      failReason: FAIL_REASON_FORCED_NEGATIVE,
      overallStatus: 'HOLD',
      requiredCaseIds: [...REQUIRED_CASE_IDS],
      caseStatusById,
      greenCaseIds,
      openGapIds,
      evidenceSources: [...EVIDENCE_SOURCES],
      falsePassGuard: 'OVERALL_STATUS_MUST_BE_HOLD_WHEN_ANY_REQUIRED_CASE_IS_NOT_GREEN',
      scope: 'ROLLUP_ONLY_CURRENT_MEASURED_02C_AND_02D_EVIDENCE',
      forcedNegative: true,
      token: {
        [DETECTOR_TOKEN]: 0,
      },
      [DETECTOR_TOKEN]: 0,
    };
  }

  return {
    ok: true,
    failReason: '',
    overallStatus,
    requiredCaseIds: [...REQUIRED_CASE_IDS],
    caseStatusById,
    greenCaseIds,
    openGapIds,
    evidenceSources: [...EVIDENCE_SOURCES],
    falsePassGuard: 'OVERALL_STATUS_MUST_BE_HOLD_WHEN_ANY_REQUIRED_CASE_IS_NOT_GREEN',
    scope: 'ROLLUP_ONLY_CURRENT_MEASURED_02C_AND_02D_EVIDENCE',
    forcedNegative: false,
    token: {
      [DETECTOR_TOKEN]: overallStatus === 'PASS' ? 1 : 0,
    },
    [DETECTOR_TOKEN]: overallStatus === 'PASS' ? 1 : 0,
  };
}

export function evaluatePhase00NoInputLossRollup(input = {}) {
  try {
    return evaluateRollupState(input);
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      requiredCaseIds: [...REQUIRED_CASE_IDS],
      caseStatusById: {},
      greenCaseIds: [],
      openGapIds: [...REQUIRED_CASE_IDS],
      evidenceSources: [...EVIDENCE_SOURCES],
      falsePassGuard: 'OVERALL_STATUS_MUST_BE_HOLD_WHEN_ANY_REQUIRED_CASE_IS_NOT_GREEN',
      scope: 'ROLLUP_ONLY_CURRENT_MEASURED_02C_AND_02D_EVIDENCE',
      forcedNegative: Boolean(input.forceNegative),
      token: {
        [DETECTOR_TOKEN]: 0,
      },
      [DETECTOR_TOKEN]: 0,
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const forceNegative = args.forceNegative || process.env.PHASE00_NO_INPUT_LOSS_ROLLUP_FORCE_NEGATIVE === '1';
  const state = evaluatePhase00NoInputLossRollup({ forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE00_NO_INPUT_LOSS_ROLLUP_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE00_NO_INPUT_LOSS_ROLLUP_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE00_NO_INPUT_LOSS_ROLLUP_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE00_NO_INPUT_LOSS_ROLLUP_EVIDENCE_SOURCES=${state.evidenceSources.join(',')}`);
    console.log(`PHASE00_NO_INPUT_LOSS_ROLLUP_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}
