const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'postReconFollowupGapClassifierRecord.mjs';
const TEST_BASENAME = 'postReconFollowupGapClassifierRecord.contract.test.js';
const TASK_BASENAME = 'STAGE05Q_POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_ONLY_001.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function allowedChangedBasenames() {
  return [MODULE_BASENAME, TEST_BASENAME, TASK_BASENAME];
}

function baseInput(overrides = {}) {
  return {
    changedBasenames: allowedChangedBasenames(),
    stage05pFalseGreenReconRecordHash: 'stage05p-false-green-recon-record-hash-001',
    nonblockedFollowupGapObserved: true,
    ...overrides,
  };
}

const FALSE_OUTPUT_FLAGS = [
  'nextContourSelected',
  'automaticNextContourOpened',
  'projectTruth',
  'projectTruthAccepted',
  'projectTruthCreated',
  'policyAcceptedAsProjectTruth',
  'stage05Ready',
  'stage05ExitReady',
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
  'reviewAnchorHandlePromoted',
  'structuralAutoApplyAllowed',
  'structuralAutoApplyPerformed',
  'uiTouched',
  'docxTouched',
  'networkTouched',
  'dependencyTouched',
];

const FORBIDDEN_CLAIM_CASES = [
  ['nextContourSelectedClaimed', 'FORBIDDEN_NEXT_CONTOUR_SELECTION_CLAIM'],
  ['nextContourSelectionClaimed', 'FORBIDDEN_NEXT_CONTOUR_SELECTION_CLAIM'],
  ['nextContourClaimed', 'FORBIDDEN_NEXT_CONTOUR_SELECTION_CLAIM'],
  ['automaticNextContourOpenedClaimed', 'FORBIDDEN_NEXT_CONTOUR_OPENING_CLAIM'],
  ['nextContourOpenedClaimed', 'FORBIDDEN_NEXT_CONTOUR_OPENING_CLAIM'],
  ['stage06OpenedClaimed', 'FORBIDDEN_NEXT_CONTOUR_OPENING_CLAIM'],
  ['policyAcceptanceClaimed', 'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM'],
  ['policyAcceptedClaimed', 'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM'],
  ['ownerPolicyAcceptedClaimed', 'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM'],
  ['projectTruthAcceptedClaimed', 'FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM'],
  ['projectTruthPolicyAcceptedClaimed', 'FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM'],
  ['ownerPolicyDecisionAcceptedAsProjectTruthClaimed', 'FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM'],
  ['stage05ReadyClaimed', 'FORBIDDEN_STAGE05_READY_CLAIM'],
  ['stage05ExitReadyClaimed', 'FORBIDDEN_STAGE05_READY_CLAIM'],
  ['identityPolicyReadyClaimed', 'FORBIDDEN_STAGE05_READY_CLAIM'],
  ['readyStatusClaimed', 'FORBIDDEN_STAGE05_READY_CLAIM'],
  ['stage06PreAdmittedClaimed', 'FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM'],
  ['stage06PreAdmissionClaimed', 'FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM'],
  ['stage06PermissionClaimed', 'FORBIDDEN_STAGE06_PERMISSION_CLAIM'],
  ['stage06AdmissionClaimed', 'FORBIDDEN_STAGE06_PERMISSION_CLAIM'],
  ['applyTxnClaimed', 'FORBIDDEN_APPLYTXN_CLAIM'],
  ['applyTxnPermissionClaimed', 'FORBIDDEN_APPLYTXN_CLAIM'],
  ['applyTxnAllowedClaimed', 'FORBIDDEN_APPLYTXN_CLAIM'],
  ['applyTxnCreatedClaimed', 'FORBIDDEN_APPLYTXN_CLAIM'],
  ['runtimeApplyClaimed', 'FORBIDDEN_RUNTIME_APPLY_CLAIM'],
  ['runtimeApplyPerformedClaimed', 'FORBIDDEN_RUNTIME_APPLY_CLAIM'],
  ['applyOpCreatedClaimed', 'FORBIDDEN_RUNTIME_APPLY_CLAIM'],
  ['applyOpPerformedClaimed', 'FORBIDDEN_RUNTIME_APPLY_CLAIM'],
  ['storageMigrationClaimed', 'FORBIDDEN_STORAGE_CLAIM'],
  ['storageMutationClaimed', 'FORBIDDEN_STORAGE_CLAIM'],
  ['storageWriteClaimed', 'FORBIDDEN_STORAGE_CLAIM'],
  ['projectWriteClaimed', 'FORBIDDEN_PROJECT_WRITE_CLAIM'],
  ['projectWritePerformedClaimed', 'FORBIDDEN_PROJECT_WRITE_CLAIM'],
  ['stableIdCreationClaimed', 'FORBIDDEN_STABLE_ID_CLAIM'],
  ['stableBlockInstanceIdCreatedClaimed', 'FORBIDDEN_STABLE_ID_CLAIM'],
  ['persistStableBlockInstanceIdClaimed', 'FORBIDDEN_STABLE_ID_CLAIM'],
  ['blockLineageCreatedClaimed', 'FORBIDDEN_LINEAGE_CLAIM'],
  ['blockLineagePersistedClaimed', 'FORBIDDEN_LINEAGE_CLAIM'],
  ['createBlockLineageClaimed', 'FORBIDDEN_LINEAGE_CLAIM'],
  ['reviewAnchorPromotedClaimed', 'FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM'],
  ['reviewAnchorHandlePromotedClaimed', 'FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM'],
  ['structuralAutoApplyClaimed', 'FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM'],
  ['moveSplitMergeAutoApplyClaimed', 'FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM'],
  ['uiClaimed', 'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM'],
  ['docxClaimed', 'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM'],
  ['networkClaimed', 'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM'],
  ['dependencyChangeClaimed', 'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM'],
];

test('stage05q module stays pure deterministic in-memory record only', () => {
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

test('importing stage05q creates no files and exposes record-only aliases', async () => {
  const before = new Set(fs.readdirSync(path.join(process.cwd(), 'src', 'revisionBridge')));
  const {
    compilePostReconFollowupGapClassifierRecord,
    runPostReconFollowupGapClassifierRecord,
    compilePostReconFollowupGapClassifierRecordOnly,
    runPostReconFollowupGapClassifierRecordOnly,
  } = await loadModule();
  const after = new Set(fs.readdirSync(path.join(process.cwd(), 'src', 'revisionBridge')));

  assert.deepEqual(after, before);
  assert.equal(runPostReconFollowupGapClassifierRecord, compilePostReconFollowupGapClassifierRecord);
  assert.equal(compilePostReconFollowupGapClassifierRecordOnly, compilePostReconFollowupGapClassifierRecord);
  assert.equal(runPostReconFollowupGapClassifierRecordOnly, compilePostReconFollowupGapClassifierRecord);
});

test('same input returns same followup gap record and canonical hash', async () => {
  const { compilePostReconFollowupGapClassifierRecord } = await loadModule();
  const first = compilePostReconFollowupGapClassifierRecord(baseInput());
  const second = compilePostReconFollowupGapClassifierRecord(baseInput());

  assert.deepEqual(first, second);
  assert.equal(first.canonicalHash, second.canonicalHash);
});

test('valid stage05p hash records facts only and never exits or opens contours', async () => {
  const { compilePostReconFollowupGapClassifierRecord } = await loadModule();
  const result = compilePostReconFollowupGapClassifierRecord(baseInput());

  assert.equal(result.outputDecision, 'POST_RECON_FOLLOWUP_GAP_FACTS_RECORDED');
  assert.equal(result.postReconFollowupGapFactsRecorded, true);
  assert.equal(result.postReconFollowupGapClassifierRecordOnly, true);
  assert.equal(result.factsOnly, true);
  assert.equal(result.recordOnly, true);
  assert.equal(result.summaryPacket, false);
  assert.equal(result.summaryPacketCreated, false);
  assert.equal(result.stage05pHashAdvisoryFactsOnly, true);
  assert.equal(result.stage05pHashExitReadyInput, false);
  assert.equal(result.classification, 'POST_RECON_NONBLOCKED_FOLLOWUP_GAP_OBSERVED');
  assert.equal(result.nextContourSelected, false);
  assert.equal(result.automaticNextContourOpened, false);
  assert.equal(result.stage05Closed, false);
  assert.equal(result.stage06Opened, false);
});

test('valid record exposes zero false flags required by the plan', async () => {
  const { compilePostReconFollowupGapClassifierRecord } = await loadModule();
  const result = compilePostReconFollowupGapClassifierRecord(baseInput());

  for (const flag of FALSE_OUTPUT_FLAGS) {
    assert.equal(result[flag], false, flag);
  }
});

test('one observed signal maps to one corresponding classification and decision', async () => {
  const { compilePostReconFollowupGapClassifierRecord } = await loadModule();
  const cases = [
    [
      { nonblockedFollowupGapObserved: true, ownerReviewRequiredObserved: false, blockedDebtObserved: false },
      'POST_RECON_NONBLOCKED_FOLLOWUP_GAP_OBSERVED',
      'POST_RECON_FOLLOWUP_GAP_FACTS_RECORDED',
    ],
    [
      { nonblockedFollowupGapObserved: false, ownerReviewRequiredObserved: true, blockedDebtObserved: false },
      'POST_RECON_OWNER_REVIEW_REQUIRED_OBSERVED',
      'POST_RECON_FOLLOWUP_GAP_FACTS_RECORDED',
    ],
    [
      { nonblockedFollowupGapObserved: false, ownerReviewRequiredObserved: false, blockedDebtObserved: true },
      'POST_RECON_BLOCKED_DEBT_OBSERVED',
      'POST_RECON_FOLLOWUP_GAP_FACTS_BLOCKED',
    ],
  ];

  for (const [signals, expectedClassification, expectedDecision] of cases) {
    const result = compilePostReconFollowupGapClassifierRecord(baseInput(signals));

    assert.equal(result.signalRecord.trueSignalCount, 1);
    assert.equal(result.classification, expectedClassification);
    assert.equal(result.outputDecision, expectedDecision);
    assert.equal(result.ownerReviewRequired, false);
  }
});

test('owner review observed signal stays observation only and does not promote owner decision', async () => {
  const { compilePostReconFollowupGapClassifierRecord } = await loadModule();
  const result = compilePostReconFollowupGapClassifierRecord(baseInput({
    nonblockedFollowupGapObserved: false,
    ownerReviewRequiredObserved: true,
    blockedDebtObserved: false,
  }));

  assert.equal(result.classification, 'POST_RECON_OWNER_REVIEW_REQUIRED_OBSERVED');
  assert.equal(result.outputDecision, 'POST_RECON_FOLLOWUP_GAP_FACTS_RECORDED');
  assert.equal(result.ownerReviewRequired, false);
  assert.equal(result.blocked, false);
  assert.equal(result.postReconFollowupGapFactsRecorded, true);
});

test('zero observed signals records the no followup gap classification', async () => {
  const { compilePostReconFollowupGapClassifierRecord } = await loadModule();
  const result = compilePostReconFollowupGapClassifierRecord(baseInput({
    nonblockedFollowupGapObserved: false,
    ownerReviewRequiredObserved: false,
    blockedDebtObserved: false,
  }));

  assert.equal(result.outputDecision, 'POST_RECON_FOLLOWUP_GAP_FACTS_RECORDED');
  assert.equal(result.signalRecord.trueSignalCount, 0);
  assert.equal(result.classification, 'POST_RECON_NO_FOLLOWUP_GAP_OBSERVED');
});

test('multiple true observed signals block with conflict reason and no synthetic classification', async () => {
  const { compilePostReconFollowupGapClassifierRecord } = await loadModule();
  const result = compilePostReconFollowupGapClassifierRecord(baseInput({
    nonblockedFollowupGapObserved: true,
    ownerReviewRequiredObserved: true,
    blockedDebtObserved: false,
  }));

  assert.equal(result.outputDecision, 'POST_RECON_FOLLOWUP_GAP_FACTS_BLOCKED');
  assert.equal(result.signalRecord.conflictingObservedSignals, true);
  assert.equal(result.classification, null);
  assert.equal(result.blockedReasons.includes('CONFLICTING_OBSERVED_SIGNALS'), true);
});

test('direct stage05p ref evidence hash takes precedence over top-level fields', async () => {
  const { compilePostReconFollowupGapClassifierRecord } = await loadModule();
  const result = compilePostReconFollowupGapClassifierRecord(baseInput({
    stage05pFalseGreenReconRecordHash: 'top-level-stage05p-hash',
    stage05pFalseGreenReconRecordHashExpected: 'top-level-stage05p-hash',
    stage05pFalseGreenReconRecordHashStale: true,
    stage05pFalseGreenReconRecordRef: {
      evidenceHash: 'direct-stage05p-hash',
      expectedEvidenceHash: 'direct-stage05p-hash',
      stale: false,
    },
  }));

  assert.equal(result.stage05pHashRef.evidenceHash, 'direct-stage05p-hash');
  assert.equal(result.stage05pHashRef.expectedEvidenceHash, 'direct-stage05p-hash');
  assert.equal(result.stage05pHashRef.stale, false);
  assert.equal(result.outputDecision, 'POST_RECON_FOLLOWUP_GAP_FACTS_RECORDED');
});

test('changedBasenames must exactly match the Stage05Q delivery scope', async () => {
  const {
    compilePostReconFollowupGapClassifierRecord,
    POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES,
  } = await loadModule();
  const exact = compilePostReconFollowupGapClassifierRecord(baseInput({
    changedBasenames: [...allowedChangedBasenames()].reverse(),
  }));
  const missing = baseInput();
  delete missing.changedBasenames;
  const missingResult = compilePostReconFollowupGapClassifierRecord(missing);
  const empty = compilePostReconFollowupGapClassifierRecord(baseInput({ changedBasenames: [] }));
  const subset = compilePostReconFollowupGapClassifierRecord(baseInput({
    changedBasenames: allowedChangedBasenames().slice(0, 2),
  }));
  const duplicate = compilePostReconFollowupGapClassifierRecord(baseInput({
    changedBasenames: [
      ...allowedChangedBasenames(),
      allowedChangedBasenames()[0],
    ],
  }));
  const outside = compilePostReconFollowupGapClassifierRecord(baseInput({
    changedBasenames: [...allowedChangedBasenames(), 'package.json'],
  }));

  assert.equal(exact.outputDecision, 'POST_RECON_FOLLOWUP_GAP_FACTS_RECORDED');
  for (const result of [missingResult, empty, subset, duplicate]) {
    assert.equal(result.blockedReasons.includes(
      POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE,
    ), true);
  }
  assert.equal(outside.blockedReasons.includes(
    POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.FORBIDDEN_BASENAME_CHANGE,
  ), true);
});

test('missing stage05p hash stops for owner review and stale stage05p hash blocks', async () => {
  const { compilePostReconFollowupGapClassifierRecord } = await loadModule();
  const missingInput = baseInput();
  delete missingInput.stage05pFalseGreenReconRecordHash;
  const missing = compilePostReconFollowupGapClassifierRecord(missingInput);
  const staleFlag = compilePostReconFollowupGapClassifierRecord(baseInput({
    stage05pFalseGreenReconRecordHashStale: true,
  }));
  const staleExpectedMismatch = compilePostReconFollowupGapClassifierRecord(baseInput({
    stage05pFalseGreenReconRecordHash: 'actual-stage05p-hash',
    stage05pFalseGreenReconRecordHashExpected: 'expected-stage05p-hash',
  }));

  assert.equal(missing.outputDecision, 'STOP_OWNER_REVIEW_REQUIRED');
  assert.equal(missing.reviewBom.missingHashRefCount, 1);
  assert.equal(missing.blockedReasons.includes('MISSING_STAGE05P_FALSE_GREEN_RECON_RECORD_HASH'), true);
  for (const result of [staleFlag, staleExpectedMismatch]) {
    assert.equal(result.outputDecision, 'POST_RECON_FOLLOWUP_GAP_FACTS_BLOCKED');
    assert.equal(result.reviewBom.staleHashRefCount, 1);
    assert.equal(result.blockedReasons.includes('STALE_STAGE05P_FALSE_GREEN_RECON_RECORD_HASH'), true);
  }
});

test('forbidden permission language terms block from array and string fields', async () => {
  const { compilePostReconFollowupGapClassifierRecord } = await loadModule();
  const terms = ['READY', 'APPROVED', 'ACCEPTED', 'ALLOWED', 'ADMITTED', 'PERMISSION', 'PERMITTED', 'GREEN'];
  const cases = terms.flatMap((term) => [
    { permissionLanguageClaims: [`post recon ${term}`] },
    { claimLanguage: `post recon ${term}` },
    { reviewLanguage: `post recon ${term}` },
  ]);

  for (const item of cases) {
    const result = compilePostReconFollowupGapClassifierRecord(baseInput(item));

    assert.equal(result.outputDecision, 'POST_RECON_FOLLOWUP_GAP_FACTS_BLOCKED');
    assert.equal(result.permissionLanguageFindingCount, 1);
    assert.equal(result.blockedReasons.includes('FORBIDDEN_PERMISSION_LANGUAGE_FOUND'), true);
    for (const flag of FALSE_OUTPUT_FLAGS) {
      assert.equal(result[flag], false, `${item}:${flag}`);
    }
  }
});

test('forbidden next contour selection and opening claims block explicitly', async () => {
  const { compilePostReconFollowupGapClassifierRecord } = await loadModule();
  const selected = compilePostReconFollowupGapClassifierRecord(baseInput({ nextContourSelectedClaimed: true }));
  const opened = compilePostReconFollowupGapClassifierRecord(baseInput({ automaticNextContourOpenedClaimed: true }));

  assert.equal(selected.outputDecision, 'POST_RECON_FOLLOWUP_GAP_FACTS_BLOCKED');
  assert.equal(selected.blockedReasons.includes('FORBIDDEN_NEXT_CONTOUR_SELECTION_CLAIM'), true);
  assert.equal(selected.nextContourSelected, false);
  assert.equal(opened.outputDecision, 'POST_RECON_FOLLOWUP_GAP_FACTS_BLOCKED');
  assert.equal(opened.blockedReasons.includes('FORBIDDEN_NEXT_CONTOUR_OPENING_CLAIM'), true);
  assert.equal(opened.automaticNextContourOpened, false);
});

test('truthy forbidden claim matrix blocks without changing false outputs', async () => {
  const { compilePostReconFollowupGapClassifierRecord } = await loadModule();

  for (const [claimKey, expectedReason] of FORBIDDEN_CLAIM_CASES) {
    const result = compilePostReconFollowupGapClassifierRecord(baseInput({ [claimKey]: 'yes' }));

    assert.equal(result.outputDecision, 'POST_RECON_FOLLOWUP_GAP_FACTS_BLOCKED', claimKey);
    assert.equal(result.blockedReasons.includes(expectedReason), true, claimKey);
    for (const flag of FALSE_OUTPUT_FLAGS) {
      assert.equal(result[flag], false, `${claimKey}:${flag}`);
    }
  }
});

test('unknown callable or user project path fields block facts record', async () => {
  const {
    compilePostReconFollowupGapClassifierRecord,
    POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES,
  } = await loadModule();
  const unknown = compilePostReconFollowupGapClassifierRecord(baseInput({ extraField: 'extra' }));
  const unknownRef = compilePostReconFollowupGapClassifierRecord(baseInput({
    stage05pFalseGreenReconRecordRef: { evidenceHash: 'hash', extraRefField: 'extra' },
  }));
  const callable = compilePostReconFollowupGapClassifierRecord(baseInput({ claimLanguage: () => 'bad' }));
  const pathClaim = compilePostReconFollowupGapClassifierRecord(baseInput({ reviewLanguage: 'Users/example/project' }));

  assert.equal(
    unknown.blockedReasons.includes(POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.UNKNOWN_FIELD_FORBIDDEN),
    true,
  );
  assert.equal(
    unknownRef.blockedReasons.includes(
      POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.UNKNOWN_FIELD_FORBIDDEN,
    ),
    true,
  );
  assert.equal(
    callable.blockedReasons.includes(POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.CALLABLE_FIELD_FORBIDDEN),
    true,
  );
  assert.equal(
    pathClaim.blockedReasons.includes(
      POST_RECON_FOLLOWUP_GAP_CLASSIFIER_RECORD_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN,
    ),
    true,
  );
});
