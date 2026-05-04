const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'postReconNextStepSelectionRecord.mjs';
const TEST_BASENAME = 'postReconNextStepSelectionRecord.contract.test.js';
const TASK_BASENAME = 'STAGE05R_POST_RECON_NEXT_STEP_SELECTION_RECORD_ONLY_001.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function allowedChangedBasenames() {
  return [MODULE_BASENAME, TEST_BASENAME, TASK_BASENAME];
}

function ownerPacket(overrides = {}) {
  return {
    packetKind: 'STAGE05R_POST_RECON_NEXT_STEP_SELECTION_OWNER_PACKET_001',
    targetContourId: 'STAGE05R_POST_RECON_NEXT_STEP_SELECTION_RECORD_ONLY_001',
    sourceStage05QHash: 'stage05q-post-recon-hash-001',
    selectedNextContourId: 'POST_RECON_FOLLOWUP_REVIEW_CONTOUR_001',
    ownerUnderstandsNoStage05Close: true,
    ownerUnderstandsNoStage06Open: true,
    ownerUnderstandsRecordOnly: true,
    ...overrides,
  };
}

function sourceOutput(overrides = {}) {
  return {
    classification: 'POST_RECON_NO_FOLLOWUP_GAP_OBSERVED',
    outputDecision: 'POST_RECON_FOLLOWUP_GAP_FACTS_RECORDED',
    blocked: false,
    ownerReviewRequired: false,
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    changedBasenames: allowedChangedBasenames(),
    stage05qPostReconFollowupGapClassifierRecordHash: 'stage05q-post-recon-hash-001',
    stage05qPostReconFollowupGapClassifierRecordOutput: sourceOutput(),
    ...overrides,
  };
}

const FALSE_OUTPUT_FLAGS = [
  'nextContourOpened',
  'automaticNextContourOpened',
  'projectTruth',
  'projectTruthAccepted',
  'projectTruthCreated',
  'stage05Closed',
  'stage06Opened',
  'stage06PreAdmitted',
  'stage06PreAdmissionGranted',
  'stage06AdmissionGranted',
  'stage06PermissionGranted',
  'applyTxnAllowed',
  'applyTxnCreated',
  'applyTxnPerformed',
  'runtimeApplyPerformed',
  'applyOpCreated',
  'applyOpPerformed',
  'projectWritePerformed',
  'storageMutationPerformed',
  'storageMigrationPerformed',
  'stableIdCreated',
  'stableBlockInstanceIdCreated',
  'blockLineageCreated',
  'blockLineagePersisted',
  'uiTouched',
  'docxTouched',
  'networkTouched',
  'dependencyTouched',
];

test('stage05r module stays pure deterministic in-memory record only', () => {
  const moduleText = fs.readFileSync(
    path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME),
    'utf8',
  );
  const forbidden = [
    /from\s+['"]node:fs['"]/u,
    /from\s+['"]fs['"]/u,
    /from\s+['"]node:child_process['"]/u,
    /from\s+['"]node:http['"]/u,
    /from\s+['"]node:https['"]/u,
    /from\s+['"]node:net['"]/u,
    /from\s+['"]electron['"]/u,
    /\bfetch\s*\(/u,
    /\bXMLHttpRequest\b/u,
    /\bipcRenderer\b/u,
    /\bipcMain\b/u,
    /\blocalStorage\b/u,
    /\bsessionStorage\b/u,
    /\bDate\.now\s*\(/u,
    /\bnew Date\s*\(/u,
    /\bMath\.random\s*\(/u,
    /\bwriteFile\b/u,
    /\bmkdir\b/u,
    /\brename\b/u,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(moduleText), false, `forbidden pure pattern: ${pattern.source}`);
  }

  const importLines = moduleText
    .split('\n')
    .filter((line) => line.trim().startsWith('import '));
  assert.deepEqual(importLines, ["import { canonicalHash } from './reviewIrKernel.mjs';"]);
});

test('importing stage05r creates no files and exposes record-only aliases', async () => {
  const before = new Set(fs.readdirSync(path.join(process.cwd(), 'src', 'revisionBridge')));
  const {
    compilePostReconNextStepSelectionRecord,
    runPostReconNextStepSelectionRecord,
    compilePostReconNextStepSelectionRecordOnly,
    runPostReconNextStepSelectionRecordOnly,
  } = await loadModule();
  const after = new Set(fs.readdirSync(path.join(process.cwd(), 'src', 'revisionBridge')));

  assert.deepEqual(after, before);
  assert.equal(runPostReconNextStepSelectionRecord, compilePostReconNextStepSelectionRecord);
  assert.equal(compilePostReconNextStepSelectionRecordOnly, compilePostReconNextStepSelectionRecord);
  assert.equal(runPostReconNextStepSelectionRecordOnly, compilePostReconNextStepSelectionRecord);
});

test('same input returns same selection record and canonical hash', async () => {
  const { compilePostReconNextStepSelectionRecord } = await loadModule();
  const first = compilePostReconNextStepSelectionRecord(baseInput());
  const second = compilePostReconNextStepSelectionRecord(baseInput());

  assert.deepEqual(first, second);
  assert.equal(first.canonicalHash, second.canonicalHash);
});

test('changedBasenames must exactly match the Stage05R delivery scope', async () => {
  const {
    compilePostReconNextStepSelectionRecord,
    POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES,
  } = await loadModule();
  const exact = compilePostReconNextStepSelectionRecord(baseInput({
    changedBasenames: [...allowedChangedBasenames()].reverse(),
  }));
  const missingInput = baseInput();
  delete missingInput.changedBasenames;
  const missing = compilePostReconNextStepSelectionRecord(missingInput);
  const empty = compilePostReconNextStepSelectionRecord(baseInput({ changedBasenames: [] }));
  const subset = compilePostReconNextStepSelectionRecord(baseInput({
    changedBasenames: allowedChangedBasenames().slice(0, 2),
  }));
  const duplicate = compilePostReconNextStepSelectionRecord(baseInput({
    changedBasenames: [...allowedChangedBasenames(), allowedChangedBasenames()[0]],
  }));
  const outside = compilePostReconNextStepSelectionRecord(baseInput({
    changedBasenames: [...allowedChangedBasenames(), 'package.json'],
  }));

  assert.equal(exact.outputDecision, 'POST_RECON_NEXT_STEP_SELECTION_RECORDED');
  for (const result of [missing, empty, subset, duplicate]) {
    assert.equal(result.blockedReasons.includes(
      POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE,
    ), true);
  }
  assert.equal(outside.blockedReasons.includes(
    POST_RECON_NEXT_STEP_SELECTION_RECORD_REASON_CODES.FORBIDDEN_BASENAME_CHANGE,
  ), true);
});

test('missing stage05q hash stops and stale stage05q hash blocks', async () => {
  const { compilePostReconNextStepSelectionRecord } = await loadModule();
  const missingInput = baseInput();
  delete missingInput.stage05qPostReconFollowupGapClassifierRecordHash;
  const missing = compilePostReconNextStepSelectionRecord(missingInput);
  const staleFlag = compilePostReconNextStepSelectionRecord(baseInput({
    stage05qPostReconFollowupGapClassifierRecordHashStale: true,
  }));
  const staleMismatch = compilePostReconNextStepSelectionRecord(baseInput({
    stage05qPostReconFollowupGapClassifierRecordHash: 'actual-stage05q-hash',
    stage05qPostReconFollowupGapClassifierRecordHashExpected: 'expected-stage05q-hash',
  }));

  assert.equal(missing.outputDecision, 'STOP_OWNER_REVIEW_REQUIRED');
  assert.equal(missing.reviewBom.missingHashRefCount, 1);
  for (const result of [staleFlag, staleMismatch]) {
    assert.equal(result.outputDecision, 'POST_RECON_NEXT_STEP_SELECTION_BLOCKED');
    assert.equal(result.reviewBom.staleHashRefCount, 1);
  }
});

test('source stopped or blocked flags propagate stop and block without opening contours', async () => {
  const { compilePostReconNextStepSelectionRecord } = await loadModule();
  const stopped = compilePostReconNextStepSelectionRecord(baseInput({
    sourceStopped: true,
  }));
  const blocked = compilePostReconNextStepSelectionRecord(baseInput({
    sourceBlocked: true,
  }));

  assert.equal(stopped.outputDecision, 'STOP_OWNER_REVIEW_REQUIRED');
  assert.equal(stopped.nextContourOpened, false);
  assert.equal(stopped.automaticNextContourOpened, false);
  assert.equal(blocked.outputDecision, 'POST_RECON_NEXT_STEP_SELECTION_BLOCKED');
  assert.equal(blocked.nextContourOpened, false);
});

test('no followup classification records no new contour candidate', async () => {
  const { compilePostReconNextStepSelectionRecord } = await loadModule();
  const result = compilePostReconNextStepSelectionRecord(baseInput({
    stage05qPostReconFollowupGapClassifierRecordOutput: sourceOutput({
      classification: 'POST_RECON_NO_FOLLOWUP_GAP_OBSERVED',
    }),
  }));

  assert.equal(result.outputDecision, 'POST_RECON_NEXT_STEP_SELECTION_RECORDED');
  assert.equal(result.classification, 'POST_RECON_NO_FOLLOWUP_GAP_OBSERVED');
  assert.equal(result.nextContourCandidateRecorded, false);
  assert.equal(result.nextContourSelectionOutcome, 'NO_NEW_CONTOUR_RECORDED');
  assert.deepEqual(result.nextContourCandidateIds, []);
});

test('nonblocked classification requires owner packet', async () => {
  const { compilePostReconNextStepSelectionRecord } = await loadModule();
  const result = compilePostReconNextStepSelectionRecord(baseInput({
    stage05qPostReconFollowupGapClassifierRecordOutput: sourceOutput({
      classification: 'POST_RECON_NONBLOCKED_FOLLOWUP_GAP_OBSERVED',
    }),
  }));

  assert.equal(result.outputDecision, 'STOP_OWNER_REVIEW_REQUIRED');
  assert.equal(result.nextContourCandidateRecorded, false);
  assert.equal(result.blockedReasons.includes('MISSING_OWNER_NEXT_CONTOUR_PACKET'), true);
});

test('valid owner packet records one candidate contour without opening it', async () => {
  const { compilePostReconNextStepSelectionRecord } = await loadModule();
  const result = compilePostReconNextStepSelectionRecord(baseInput({
    stage05qPostReconFollowupGapClassifierRecordOutput: sourceOutput({
      classification: 'POST_RECON_NONBLOCKED_FOLLOWUP_GAP_OBSERVED',
    }),
    ownerNextContourPacket: ownerPacket(),
  }));

  assert.equal(result.outputDecision, 'POST_RECON_NEXT_STEP_SELECTION_RECORDED');
  assert.equal(result.nextContourCandidateRecorded, true);
  assert.equal(result.selectedNextContourId, 'POST_RECON_FOLLOWUP_REVIEW_CONTOUR_001');
  assert.deepEqual(result.nextContourCandidateIds, ['POST_RECON_FOLLOWUP_REVIEW_CONTOUR_001']);
  assert.equal(result.nextContourOpened, false);
  assert.equal(result.automaticNextContourOpened, false);
});

test('owner review observed classification stops without owner decision promotion', async () => {
  const { compilePostReconNextStepSelectionRecord } = await loadModule();
  const result = compilePostReconNextStepSelectionRecord(baseInput({
    stage05qPostReconFollowupGapClassifierRecordOutput: sourceOutput({
      classification: 'POST_RECON_OWNER_REVIEW_REQUIRED_OBSERVED',
    }),
  }));

  assert.equal(result.outputDecision, 'STOP_OWNER_REVIEW_REQUIRED');
  assert.equal(result.classification, 'POST_RECON_OWNER_REVIEW_REQUIRED_OBSERVED');
  assert.equal(result.nextContourCandidateRecorded, false);
  assert.equal(result.blocked, false);
});

test('blocked debt classification blocks selection record', async () => {
  const { compilePostReconNextStepSelectionRecord } = await loadModule();
  const result = compilePostReconNextStepSelectionRecord(baseInput({
    stage05qPostReconFollowupGapClassifierRecordOutput: sourceOutput({
      classification: 'POST_RECON_BLOCKED_DEBT_OBSERVED',
      outputDecision: 'POST_RECON_FOLLOWUP_GAP_FACTS_BLOCKED',
      blocked: true,
    }),
  }));

  assert.equal(result.outputDecision, 'POST_RECON_NEXT_STEP_SELECTION_BLOCKED');
  assert.equal(result.classification, 'POST_RECON_BLOCKED_DEBT_OBSERVED');
  assert.equal(result.nextContourOpened, false);
});

test('owner packet cannot record Stage06-like candidate in selection-only contour', async () => {
  const { compilePostReconNextStepSelectionRecord } = await loadModule();
  const result = compilePostReconNextStepSelectionRecord(baseInput({
    stage05qPostReconFollowupGapClassifierRecordOutput: sourceOutput({
      classification: 'POST_RECON_NONBLOCKED_FOLLOWUP_GAP_OBSERVED',
    }),
    ownerNextContourPacket: ownerPacket({
      selectedNextContourId: 'STAGE06A_PENDING_CONTOUR_CANDIDATE_001',
    }),
  }));

  assert.equal(result.outputDecision, 'STOP_OWNER_REVIEW_REQUIRED');
  assert.equal(result.nextContourCandidateRecorded, false);
  assert.equal(result.ownerPacketRecord.candidateRecorded, false);
  assert.equal(result.ownerPacketRecord.selectedNextContourId, '');
  assert.equal(result.reviewBom.nextContourCandidateCount, 0);
  assert.equal(result.reviewBom.nextContourSelectionCandidateRecordedCount, 0);
  assert.equal(result.blockedReasons.includes('FORBIDDEN_STAGE06_NEXT_CONTOUR_CANDIDATE'), true);
  assert.equal(result.stage06Opened, false);
  assert.equal(result.stage06PermissionGranted, false);
});

test('invalid owner packet claims do not leak nested candidate records', async () => {
  const { compilePostReconNextStepSelectionRecord } = await loadModule();
  const result = compilePostReconNextStepSelectionRecord(baseInput({
    stage05qPostReconFollowupGapClassifierRecordOutput: sourceOutput({
      classification: 'POST_RECON_NONBLOCKED_FOLLOWUP_GAP_OBSERVED',
    }),
    ownerNextContourPacket: ownerPacket({
      stage06PermissionClaimed: true,
      claimLanguage: 'permission granted',
    }),
  }));

  assert.equal(result.outputDecision, 'POST_RECON_NEXT_STEP_SELECTION_BLOCKED');
  assert.equal(result.nextContourCandidateRecorded, false);
  assert.equal(result.ownerPacketRecord.candidateRecorded, false);
  assert.equal(result.ownerPacketRecord.selectedNextContourId, '');
  assert.deepEqual(result.nextContourCandidateIds, []);
  assert.equal(result.reviewBom.nextContourCandidateCount, 0);
  assert.equal(result.reviewBom.nextContourSelectionCandidateRecordedCount, 0);
  assert.equal(result.blockedReasons.includes('FORBIDDEN_STAGE06_PERMISSION_CLAIM'), true);
  assert.equal(result.blockedReasons.includes('FORBIDDEN_PERMISSION_LANGUAGE_FOUND'), true);
});

test('unknown and conflicting classification block selection record', async () => {
  const { compilePostReconNextStepSelectionRecord } = await loadModule();
  const unknown = compilePostReconNextStepSelectionRecord(baseInput({
    stage05qPostReconFollowupGapClassifierRecordOutput: sourceOutput({
      classification: 'POST_RECON_CLASSIFICATION_UNKNOWN',
    }),
  }));
  const conflicting = compilePostReconNextStepSelectionRecord(baseInput({
    stage05qPostReconFollowupGapClassifierRecordOutput: sourceOutput({
      classification: 'POST_RECON_NO_FOLLOWUP_GAP_OBSERVED',
    }),
    stage05qPostReconFollowupGapClassification: 'POST_RECON_NONBLOCKED_FOLLOWUP_GAP_OBSERVED',
  }));

  assert.equal(unknown.outputDecision, 'POST_RECON_NEXT_STEP_SELECTION_BLOCKED');
  assert.equal(unknown.blockedReasons.includes('UNKNOWN_STAGE05Q_CLASSIFICATION'), true);
  assert.equal(conflicting.outputDecision, 'POST_RECON_NEXT_STEP_SELECTION_BLOCKED');
  assert.equal(conflicting.blockedReasons.includes('CONFLICTING_STAGE05Q_CLASSIFICATION'), true);
});

test('forbidden permission language blocks selection record', async () => {
  const { compilePostReconNextStepSelectionRecord } = await loadModule();
  const result = compilePostReconNextStepSelectionRecord(baseInput({
    claimLanguage: 'selection approved for open',
  }));

  assert.equal(result.outputDecision, 'POST_RECON_NEXT_STEP_SELECTION_BLOCKED');
  assert.equal(result.permissionLanguageFindingCount, 1);
  assert.equal(result.blockedReasons.includes('FORBIDDEN_PERMISSION_LANGUAGE_FOUND'), true);
});

test('forbidden claims block selection record', async () => {
  const { compilePostReconNextStepSelectionRecord } = await loadModule();
  const result = compilePostReconNextStepSelectionRecord(baseInput({
    nextContourOpenedClaimed: true,
    stage06PermissionClaimed: true,
    applyTxnClaimed: true,
  }));

  assert.equal(result.outputDecision, 'POST_RECON_NEXT_STEP_SELECTION_BLOCKED');
  assert.equal(result.blockedReasons.includes('FORBIDDEN_NEXT_CONTOUR_OPENING_CLAIM'), true);
  assert.equal(result.blockedReasons.includes('FORBIDDEN_STAGE06_PERMISSION_CLAIM'), true);
  assert.equal(result.blockedReasons.includes('FORBIDDEN_APPLYTXN_CLAIM'), true);
});

test('unknown callable or user project path fields block selection record', async () => {
  const { compilePostReconNextStepSelectionRecord } = await loadModule();
  const unknown = compilePostReconNextStepSelectionRecord(baseInput({ extraField: true }));
  const unknownPacket = compilePostReconNextStepSelectionRecord(baseInput({
    stage05qPostReconFollowupGapClassifierRecordOutput: sourceOutput({
      classification: 'POST_RECON_NONBLOCKED_FOLLOWUP_GAP_OBSERVED',
    }),
    ownerNextContourPacket: ownerPacket({ extraField: true }),
  }));
  const callable = compilePostReconNextStepSelectionRecord(baseInput({ claimLanguage: () => 'bad' }));
  const pathClaim = compilePostReconNextStepSelectionRecord(baseInput({ reviewLanguage: 'Users/example/project' }));

  assert.equal(unknown.outputDecision, 'POST_RECON_NEXT_STEP_SELECTION_BLOCKED');
  assert.equal(unknown.blockedReasons.includes('UNKNOWN_FIELD_FORBIDDEN'), true);
  assert.equal(unknownPacket.blockedReasons.includes('OWNER_NEXT_CONTOUR_PACKET_UNKNOWN_FIELD_FORBIDDEN'), true);
  assert.equal(callable.blockedReasons.includes('CALLABLE_FIELD_FORBIDDEN'), true);
  assert.equal(pathClaim.blockedReasons.includes('USER_PROJECT_PATH_FORBIDDEN'), true);
});

test('valid owner-packet record keeps all required false flags false', async () => {
  const { compilePostReconNextStepSelectionRecord } = await loadModule();
  const result = compilePostReconNextStepSelectionRecord(baseInput({
    stage05qPostReconFollowupGapClassifierRecordOutput: sourceOutput({
      classification: 'POST_RECON_NONBLOCKED_FOLLOWUP_GAP_OBSERVED',
    }),
    ownerNextContourPacket: ownerPacket(),
  }));

  assert.equal(result.outputDecision, 'POST_RECON_NEXT_STEP_SELECTION_RECORDED');
  for (const flag of FALSE_OUTPUT_FLAGS) {
    assert.equal(result[flag], false, flag);
  }
});
