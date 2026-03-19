#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluatePhase00NoInputLossRollup } from './phase00-no-input-loss-rollup.mjs';
import { evaluatePhase00PrimaryPathState } from './phase00-primary-path-state.mjs';
import { evaluatePhase00ImeCompositionState } from './phase00-ime-composition-state.mjs';
import { evaluatePhase00RuntimeCommandDeltaState } from './phase00-runtime-command-delta-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE00_CLOSURE_CANDIDATE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE00_CLOSURE_CANDIDATE_UNEXPECTED';
const FALSE_PASS_GUARD = 'HOLD_WHEN_ANY_REQUIRED_DIMENSION_OR_REQUIRED_ARTIFACT_IS_OPEN';

const CLOSURE_PACKET_CANDIDATE_PATHS = Object.freeze([
  'PRIMARY_EDITOR_CLOSURE_PACKET_V1.json',
  'PRIMARY_EDITOR_CLOSURE_PACKET_V1.md',
  'docs/OPS/STATUS/PRIMARY_EDITOR_CLOSURE_PACKET_V1.json',
  'docs/OPS/STATUS/PRIMARY_EDITOR_CLOSURE_PACKET_V1.md',
]);

const DOCX_CLOSURE_EVIDENCE_CANDIDATE_PATHS = Object.freeze([
  'DOCX_CLOSURE_EVIDENCE_V1.json',
  'DOCX_CLOSURE_EVIDENCE_V1.md',
  'docs/OPS/STATUS/DOCX_CLOSURE_EVIDENCE_V1.json',
  'docs/OPS/STATUS/DOCX_CLOSURE_EVIDENCE_V1.md',
  'docs/OPS/STATUS/PRIMARY_EDITOR_DOCX_CLOSURE_EVIDENCE_V1.json',
]);

function parseArgs(argv) {
  const out = { json: false, forceNegative: false };
  for (const token of argv) {
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
  }
  return out;
}

function getPresentArtifacts(candidatePaths) {
  return candidatePaths.filter((relativePath) => fs.existsSync(path.resolve(relativePath)));
}

function readFirstJsonArtifact(candidatePaths) {
  for (const relativePath of candidatePaths) {
    const absolutePath = path.resolve(relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    if (!relativePath.endsWith('.json')) {
      return {
        present: true,
        path: relativePath,
        payload: null,
      };
    }
    try {
      return {
        present: true,
        path: relativePath,
        payload: JSON.parse(fs.readFileSync(absolutePath, 'utf8')),
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

function asDimension(status, measured, sourceIds, note) {
  return {
    status,
    measured,
    sourceIds,
    note,
  };
}

function evaluateClosureCandidateState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  const noInputLoss = evaluatePhase00NoInputLossRollup({ forceNegative: false });
  const primaryPath = evaluatePhase00PrimaryPathState({ forceNegative: false });
  const ime = evaluatePhase00ImeCompositionState({ forceNegative: false });
  const runtimeDelta = evaluatePhase00RuntimeCommandDeltaState({ forceNegative: false });

  const closurePacketPresentPaths = getPresentArtifacts(CLOSURE_PACKET_CANDIDATE_PATHS);
  const docxClosureEvidencePresentPaths = getPresentArtifacts(DOCX_CLOSURE_EVIDENCE_CANDIDATE_PATHS);
  const closurePacketArtifact = readFirstJsonArtifact(CLOSURE_PACKET_CANDIDATE_PATHS);
  const docxClosureEvidenceArtifact = readFirstJsonArtifact(DOCX_CLOSURE_EVIDENCE_CANDIDATE_PATHS);

  const closurePacketPresent = closurePacketPresentPaths.length > 0;
  const docxClosureEvidencePresent = docxClosureEvidencePresentPaths.length > 0;
  const closurePacketPass = closurePacketArtifact.present
    && closurePacketArtifact.payload
    && closurePacketArtifact.payload.status === 'PASS';
  const docxClosureEvidencePass = docxClosureEvidenceArtifact.present
    && docxClosureEvidenceArtifact.payload
    && docxClosureEvidenceArtifact.payload.status === 'PASS';

  const noInputLossStatus = noInputLoss?.overallStatus || 'HOLD';
  const primaryPathStatus = primaryPath?.overallStatus || 'HOLD';
  const imeStatus = ime?.overallStatus || 'HOLD';
  const dualTruthStatus = primaryPath?.dualTruthStatus || 'UNKNOWN';
  const runtimeCommandDeltaEmpty = Array.isArray(runtimeDelta?.missingOnTiptapIds)
    ? runtimeDelta.missingOnTiptapIds.length === 0
    : false;
  const docxClosureEvidenceStatus = docxClosureEvidencePresent ? 'PRESENT' : 'MISSING';

  const dimensionStatusById = {
    CLOSURE_PACKET_PRESENT: asDimension(
      closurePacketPass ? 'GREEN' : 'OPEN_GAP',
      true,
      ['phase00-closure-candidate-state.mjs'],
      closurePacketPass
        ? 'PRIMARY_EDITOR_CLOSURE_PACKET_V1_PASS'
        : closurePacketPresent
          ? 'PRIMARY_EDITOR_CLOSURE_PACKET_V1_NOT_GREEN'
          : 'PRIMARY_EDITOR_CLOSURE_PACKET_V1_MISSING',
    ),
    NO_INPUT_LOSS_GREEN: asDimension(
      noInputLossStatus === 'PASS' ? 'GREEN' : 'OPEN_GAP',
      true,
      ['phase00-no-input-loss-rollup.mjs'],
      `NO_INPUT_LOSS_STATUS_${noInputLossStatus}`,
    ),
    PRIMARY_PATH_GREEN: asDimension(
      primaryPathStatus === 'PASS' ? 'GREEN' : 'OPEN_GAP',
      true,
      ['phase00-primary-path-state.mjs'],
      `PRIMARY_PATH_STATUS_${primaryPathStatus}`,
    ),
    IME_GREEN: asDimension(
      imeStatus === 'PASS' ? 'GREEN' : 'OPEN_GAP',
      true,
      ['phase00-ime-composition-state.mjs'],
      `IME_STATUS_${imeStatus}`,
    ),
    DUAL_TRUTH_RESOLVED: asDimension(
      dualTruthStatus === 'SINGLE_TRUTH' ? 'GREEN' : 'OPEN_GAP',
      true,
      ['phase00-primary-path-state.mjs'],
      `DUAL_TRUTH_STATUS_${dualTruthStatus}`,
    ),
    RUNTIME_COMMAND_DELTA_EMPTY: asDimension(
      runtimeCommandDeltaEmpty ? 'GREEN' : 'OPEN_GAP',
      true,
      ['phase00-runtime-command-delta-state.mjs'],
      runtimeCommandDeltaEmpty ? 'RUNTIME_COMMAND_DELTA_EMPTY' : 'RUNTIME_COMMAND_DELTA_NON_EMPTY',
    ),
    DOCX_CLOSURE_EVIDENCE_PRESENT: asDimension(
      docxClosureEvidencePass ? 'GREEN' : 'OPEN_GAP',
      true,
      ['phase00-closure-candidate-state.mjs'],
      docxClosureEvidencePass
        ? 'DOCX_CLOSURE_EVIDENCE_PASS'
        : docxClosureEvidencePresent
          ? 'DOCX_CLOSURE_EVIDENCE_NOT_GREEN'
          : 'DOCX_CLOSURE_EVIDENCE_MISSING',
    ),
  };

  const greenDimensionIds = Object
    .entries(dimensionStatusById)
    .filter(([, value]) => value.status === 'GREEN')
    .map(([id]) => id);

  const openGapIdSet = new Set();
  if (!closurePacketPass) openGapIdSet.add(closurePacketPresent ? 'CLOSURE_PACKET_NOT_GREEN' : 'CLOSURE_PACKET_MISSING');
  if (noInputLossStatus !== 'PASS') openGapIdSet.add('NO_INPUT_LOSS_NOT_GREEN');
  if (primaryPathStatus !== 'PASS') openGapIdSet.add('PRIMARY_PATH_NOT_GREEN');
  if (imeStatus !== 'PASS') openGapIdSet.add('IME_NOT_GREEN');
  if (dualTruthStatus !== 'SINGLE_TRUTH') openGapIdSet.add('DUAL_TRUTH_EXISTS');
  if (!runtimeCommandDeltaEmpty) openGapIdSet.add('RUNTIME_COMMAND_DELTA_NON_EMPTY');
  if (!docxClosureEvidencePass) openGapIdSet.add(docxClosureEvidencePresent ? 'DOCX_CLOSURE_EVIDENCE_NOT_GREEN' : 'DOCX_CLOSURE_EVIDENCE_MISSING');

  const missingArtifactIds = [];
  if (!closurePacketPresent) missingArtifactIds.push('PRIMARY_EDITOR_CLOSURE_PACKET_V1');
  if (!docxClosureEvidencePresent) missingArtifactIds.push('DOCX_CLOSURE_EVIDENCE_V1');

  const openGapIds = [...openGapIdSet];
  const overallStatus = openGapIds.length === 0 ? 'PASS' : 'HOLD';

  if (forceNegative) {
    return {
      ok: false,
      failReason: FAIL_REASON_FORCED_NEGATIVE,
      overallStatus: 'HOLD',
      greenDimensionIds,
      openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
      missingArtifactIds: Array.from(new Set([...missingArtifactIds, 'FORCED_NEGATIVE_PATH'])),
      closurePacketPresentOrNot: closurePacketPresent ? 'PRESENT' : 'MISSING',
      noInputLossStatus,
      primaryPathStatus,
      imeStatus,
      dualTruthStatus,
      docxClosureEvidenceStatus,
      falsePassGuard: FALSE_PASS_GUARD,
      evidenceSources: [
        'phase00-no-input-loss-rollup.mjs',
        'phase00-primary-path-state.mjs',
        'phase00-ime-composition-state.mjs',
        'phase00-runtime-command-delta-state.mjs',
      ],
      forcedNegative: true,
    };
  }

  return {
    ok: true,
    failReason: '',
    overallStatus,
    greenDimensionIds,
    openGapIds,
    missingArtifactIds,
    closurePacketPresentOrNot: closurePacketPresent ? 'PRESENT' : 'MISSING',
    noInputLossStatus,
    primaryPathStatus,
    imeStatus,
    dualTruthStatus,
    docxClosureEvidenceStatus,
    closurePacketPresentPaths,
    docxClosureEvidencePresentPaths,
    dimensionStatusById,
    falsePassGuard: FALSE_PASS_GUARD,
    evidenceSources: [
      'phase00-no-input-loss-rollup.mjs',
      'phase00-primary-path-state.mjs',
      'phase00-ime-composition-state.mjs',
      'phase00-runtime-command-delta-state.mjs',
    ],
    forcedNegative: false,
  };
}

export function evaluatePhase00ClosureCandidateState(input = {}) {
  try {
    return evaluateClosureCandidateState(input);
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      greenDimensionIds: [],
      openGapIds: ['CLOSURE_CANDIDATE_STATE_EVALUATION_ERROR'],
      missingArtifactIds: [],
      closurePacketPresentOrNot: 'UNKNOWN',
      noInputLossStatus: 'UNKNOWN',
      primaryPathStatus: 'UNKNOWN',
      imeStatus: 'UNKNOWN',
      dualTruthStatus: 'UNKNOWN',
      docxClosureEvidenceStatus: 'UNKNOWN',
      falsePassGuard: FALSE_PASS_GUARD,
      evidenceSources: [
        'phase00-no-input-loss-rollup.mjs',
        'phase00-primary-path-state.mjs',
        'phase00-ime-composition-state.mjs',
        'phase00-runtime-command-delta-state.mjs',
      ],
      forcedNegative: Boolean(input.forceNegative),
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const forceNegative = args.forceNegative || process.env.PHASE00_CLOSURE_CANDIDATE_FORCE_NEGATIVE === '1';
  const state = evaluatePhase00ClosureCandidateState({ forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE00_CLOSURE_CANDIDATE_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE00_CLOSURE_CANDIDATE_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE00_CLOSURE_CANDIDATE_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE00_CLOSURE_CANDIDATE_MISSING_ARTIFACT_IDS=${state.missingArtifactIds.join(',')}`);
    console.log(`PHASE00_CLOSURE_CANDIDATE_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}
