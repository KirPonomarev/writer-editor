const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'stage05ExitReviewFactsRecord.mjs';
const TEST_BASENAME = 'stage05ExitReviewFactsRecord.contract.test.js';
const TASK_BASENAME = 'STAGE05O_STAGE05_EXIT_REVIEW_FACTS_RECORD_ONLY_001.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function allowedChangedBasenames() {
  return [MODULE_BASENAME, TEST_BASENAME, TASK_BASENAME];
}

function stage05nOutput(selectedPolicyOption = 'INTERMEDIATE_REVIEW_ANCHOR_HANDLE_ONLY') {
  return {
    outputDecision: 'OWNER_IDENTITY_POLICY_DECISION_RECORDED',
    policyOptionRecord: {
      selectedPolicyOption,
      evidenceOnly: true,
      projectTruthAccepted: false,
      reviewAnchorHandlePromoted: false,
    },
    stage05ExitReady: false,
    stage06PreAdmitted: false,
    applyTxnAllowed: false,
  };
}

function baseInput(overrides = {}) {
  return {
    changedBasenames: allowedChangedBasenames(),
    stage05kBlockerRollupHash: 'stage05k-rollup-hash-001',
    stage05lOwnerPacketValidationHash: 'stage05l-validation-hash-001',
    stage05mEvidenceChainReviewBomHash: 'stage05m-bom-hash-001',
    stage05nOwnerPolicyDecisionRecordHash: 'stage05n-decision-record-hash-001',
    ownerPolicyOptionObserved: 'INTERMEDIATE_REVIEW_ANCHOR_HANDLE_ONLY',
    ...overrides,
  };
}

const REQUIRED_HASH_KEYS = [
  'stage05kBlockerRollupHash',
  'stage05lOwnerPacketValidationHash',
  'stage05mEvidenceChainReviewBomHash',
  'stage05nOwnerPolicyDecisionRecordHash',
];

const FALSE_OUTPUT_FLAGS = [
  'stage05ExitReady',
  'stage06PreAdmitted',
  'stage06AdmissionGranted',
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
  'projectTruthAccepted',
  'policyAcceptedAsProjectTruth',
  'automaticNextContourOpened',
];

const FORBIDDEN_CLAIM_KEYS = [
  'policyAcceptanceClaimed',
  'policyAcceptedClaimed',
  'ownerPolicyAcceptedClaimed',
  'projectTruthAcceptedClaimed',
  'projectTruthPolicyAcceptedClaimed',
  'ownerPolicyDecisionAcceptedAsProjectTruthClaimed',
  'stage05ExitReadyClaimed',
  'identityPolicyReadyClaimed',
  'readyStatusClaimed',
  'stage06PermissionClaimed',
  'stage06AdmissionClaimed',
  'stage06PreAdmittedClaimed',
  'stage06PreAdmissionClaimed',
  'applyTxnClaimed',
  'applyTxnPermissionClaimed',
  'applyTxnAllowedClaimed',
  'applyTxnCreatedClaimed',
  'runtimeApplyClaimed',
  'runtimeApplyPerformedClaimed',
  'applyOpCreatedClaimed',
  'applyOpPerformedClaimed',
  'storageMigrationClaimed',
  'storageMutationClaimed',
  'projectWriteClaimed',
  'projectWritePerformedClaimed',
  'stableIdCreationClaimed',
  'stableBlockInstanceIdCreatedClaimed',
  'persistStableBlockInstanceIdClaimed',
  'blockLineageCreatedClaimed',
  'blockLineagePersistedClaimed',
  'createBlockLineageClaimed',
  'reviewAnchorPromotedClaimed',
  'reviewAnchorHandlePromotedClaimed',
  'structuralAutoApplyClaimed',
  'moveSplitMergeAutoApplyClaimed',
  'uiClaimed',
  'docxClaimed',
  'networkClaimed',
  'dependencyChangeClaimed',
];

test('stage05o module stays pure deterministic in-memory facts record only', () => {
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

test('same input returns same facts record and canonical hash', async () => {
  const { compileStage05ExitReviewFactsRecord } = await loadModule();
  const first = compileStage05ExitReviewFactsRecord(baseInput());
  const second = compileStage05ExitReviewFactsRecord(baseInput());

  assert.deepEqual(first, second);
  assert.equal(first.canonicalHash, second.canonicalHash);
});

test('exports record-only canonical entrypoints and aliases', async () => {
  const {
    compileStage05ExitReviewFactsRecord,
    runStage05ExitReviewFactsRecord,
    compileStage05ExitReviewFactsRecordOnly,
    runStage05ExitReviewFactsRecordOnly,
  } = await loadModule();

  assert.equal(runStage05ExitReviewFactsRecord, compileStage05ExitReviewFactsRecord);
  assert.equal(compileStage05ExitReviewFactsRecordOnly, compileStage05ExitReviewFactsRecord);
  assert.equal(runStage05ExitReviewFactsRecordOnly, compileStage05ExitReviewFactsRecord);
});

test('valid hash-bound input records facts only and does not create exit readiness', async () => {
  const { compileStage05ExitReviewFactsRecord } = await loadModule();
  const result = compileStage05ExitReviewFactsRecord(baseInput());

  assert.equal(result.outputDecision, 'STAGE05_EXIT_REVIEW_FACTS_RECORDED');
  assert.equal(result.stage05ExitReviewFactsRecorded, true);
  assert.equal(result.stage05ExitReviewFactsRecordOnly, true);
  assert.equal(result.factsOnly, true);
  assert.equal(result.ownerPolicyOptionObservedOnly, true);
  assert.equal(result.ownerPolicyOptionObservation.acceptedAsProjectTruth, false);
  assert.equal(result.ownerPolicyOptionObservation.policyAccepted, false);
  assert.equal(result.nextStepPreview.previewOnly, true);
  assert.equal(result.nextStepPreview.automaticNextContourOpened, false);
});

test('valid record exposes all false-green output flags as false', async () => {
  const { compileStage05ExitReviewFactsRecord } = await loadModule();
  const result = compileStage05ExitReviewFactsRecord(baseInput());

  for (const flag of FALSE_OUTPUT_FLAGS) {
    assert.equal(result[flag], false, flag);
  }
});

test('review bom counts facts-only refs and zero permission signals', async () => {
  const { compileStage05ExitReviewFactsRecord } = await loadModule();
  const result = compileStage05ExitReviewFactsRecord(baseInput());

  assert.equal(result.reviewBom.factsOnly, true);
  assert.equal(result.reviewBom.requiredHashRefCount, 4);
  assert.equal(result.reviewBom.presentHashRefCount, 4);
  assert.equal(result.reviewBom.missingHashRefCount, 0);
  assert.equal(result.reviewBom.staleHashRefCount, 0);
  assert.equal(result.reviewBom.ownerPolicyOptionObservedOnlyCount, 1);
  assert.equal(result.reviewBom.permissionLanguageFindingCount, 0);
  assert.equal(result.reviewBom.forbiddenClaimCount, 0);
  assert.equal(result.reviewBom.stage05ExitReadyCount, 0);
  assert.equal(result.reviewBom.stage06AdmissionCount, 0);
  assert.equal(result.reviewBom.applyTxnPermissionCount, 0);
  assert.equal(result.reviewBom.runtimeApplyCount, 0);
  assert.equal(result.reviewBom.applyOpCreationCount, 0);
  assert.equal(result.reviewBom.projectWriteCount, 0);
  assert.equal(result.reviewBom.storageMigrationCount, 0);
  assert.equal(result.reviewBom.stableIdCreationCount, 0);
  assert.equal(result.reviewBom.lineageCreationCount, 0);
  assert.equal(result.reviewBom.reviewAnchorPromotionCount, 0);
  assert.equal(result.reviewBom.structuralAutoApplyCount, 0);
  assert.equal(result.reviewBom.permissionSignalCount, 0);
});

test('direct ref evidence hash takes precedence over top-level hash', async () => {
  const { compileStage05ExitReviewFactsRecord } = await loadModule();
  const result = compileStage05ExitReviewFactsRecord(baseInput({
    stage05mEvidenceChainReviewBomHash: 'top-level-stage05m-hash',
    stage05mEvidenceChainReviewBomRef: {
      evidenceHash: 'direct-stage05m-hash',
      expectedEvidenceHash: 'direct-stage05m-hash',
    },
  }));

  const ref = result.hashRefs.find((item) => item.refId === 'STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_REF');
  assert.equal(ref.evidenceHash, 'direct-stage05m-hash');
  assert.equal(ref.expectedEvidenceHash, 'direct-stage05m-hash');
  assert.equal(ref.stale, false);
  assert.equal(result.outputDecision, 'STAGE05_EXIT_REVIEW_FACTS_RECORDED');
});

test('missing changedBasenames or outside basename blocks facts record', async () => {
  const { compileStage05ExitReviewFactsRecord, STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES } = await loadModule();
  const missing = baseInput();
  delete missing.changedBasenames;
  const missingResult = compileStage05ExitReviewFactsRecord(missing);
  const outsideResult = compileStage05ExitReviewFactsRecord(baseInput({
    changedBasenames: [...allowedChangedBasenames(), 'package.json'],
  }));

  assert.equal(missingResult.outputDecision, 'STAGE05_EXIT_REVIEW_FACTS_BLOCKED');
  assert.equal(
    missingResult.blockedReasons.includes(
      STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE,
    ),
    true,
  );
  assert.equal(outsideResult.outputDecision, 'STAGE05_EXIT_REVIEW_FACTS_BLOCKED');
  assert.equal(
    outsideResult.blockedReasons.includes(STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES.FORBIDDEN_BASENAME_CHANGE),
    true,
  );
});

test('changedBasenames must exactly match the Stage05O delivery scope', async () => {
  const { compileStage05ExitReviewFactsRecord, STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES } = await loadModule();
  const exact = compileStage05ExitReviewFactsRecord(baseInput({
    changedBasenames: [...allowedChangedBasenames()].reverse(),
  }));
  const empty = compileStage05ExitReviewFactsRecord(baseInput({ changedBasenames: [] }));
  const subset = compileStage05ExitReviewFactsRecord(baseInput({
    changedBasenames: allowedChangedBasenames().slice(0, 2),
  }));
  const duplicate = compileStage05ExitReviewFactsRecord(baseInput({
    changedBasenames: [
      ...allowedChangedBasenames(),
      allowedChangedBasenames()[0],
    ],
  }));

  assert.equal(exact.outputDecision, 'STAGE05_EXIT_REVIEW_FACTS_RECORDED');
  for (const result of [empty, subset, duplicate]) {
    assert.equal(result.outputDecision, 'STAGE05_EXIT_REVIEW_FACTS_BLOCKED');
    assert.equal(
      result.blockedReasons.includes(
        STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE,
      ),
      true,
    );
  }
});

test('missing Stage05N hash stops on owner policy required', async () => {
  const { compileStage05ExitReviewFactsRecord, STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES } = await loadModule();
  const result = compileStage05ExitReviewFactsRecord(baseInput({
    stage05nOwnerPolicyDecisionRecordHash: '',
  }));

  assert.equal(result.outputDecision, 'STOP_OWNER_POLICY_REQUIRED');
  assert.equal(
    result.blockedReasons.includes(
      STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES.MISSING_STAGE05N_OWNER_POLICY_DECISION_RECORD_HASH,
    ),
    true,
  );
});

test('missing Stage05K Stage05L or Stage05M hash blocks facts record', async () => {
  const { compileStage05ExitReviewFactsRecord } = await loadModule();

  for (const hashKey of REQUIRED_HASH_KEYS.slice(0, 3)) {
    const result = compileStage05ExitReviewFactsRecord(baseInput({ [hashKey]: '' }));

    assert.equal(result.outputDecision, 'STAGE05_EXIT_REVIEW_FACTS_BLOCKED', hashKey);
    assert.equal(result.reviewBom.missingHashRefCount, 1, hashKey);
  }
});

test('stale required hash blocks facts record', async () => {
  const { compileStage05ExitReviewFactsRecord } = await loadModule();

  for (const hashKey of REQUIRED_HASH_KEYS) {
    const result = compileStage05ExitReviewFactsRecord(baseInput({
      [hashKey]: `${hashKey}-actual`,
      [`${hashKey}Expected`]: `${hashKey}-expected`,
    }));

    assert.equal(result.outputDecision, 'STAGE05_EXIT_REVIEW_FACTS_BLOCKED', hashKey);
    assert.equal(result.reviewBom.staleHashRefCount, 1, hashKey);
  }
});

test('missing owner policy option observation stops on owner policy required', async () => {
  const { compileStage05ExitReviewFactsRecord, STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES } = await loadModule();
  const input = baseInput();
  delete input.ownerPolicyOptionObserved;
  const result = compileStage05ExitReviewFactsRecord(input);

  assert.equal(result.outputDecision, 'STOP_OWNER_POLICY_REQUIRED');
  assert.equal(
    result.blockedReasons.includes(
      STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES.MISSING_OWNER_POLICY_OPTION_OBSERVATION,
    ),
    true,
  );
});

test('unknown owner policy option blocks without accepting project truth', async () => {
  const { compileStage05ExitReviewFactsRecord, STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES } = await loadModule();
  const result = compileStage05ExitReviewFactsRecord(baseInput({
    ownerPolicyOptionObserved: 'CREATE_STABLE_IDS_NOW',
  }));

  assert.equal(result.outputDecision, 'STAGE05_EXIT_REVIEW_FACTS_BLOCKED');
  assert.equal(result.ownerPolicyOptionObservation.optionKnown, false);
  assert.equal(result.ownerPolicyOptionObservation.acceptedAsProjectTruth, false);
  assert.equal(
    result.blockedReasons.includes(
      STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES.UNKNOWN_OWNER_POLICY_OPTION_OBSERVATION,
    ),
    true,
  );
});

test('owner policy option can be observed from Stage05N output only', async () => {
  const { compileStage05ExitReviewFactsRecord } = await loadModule();
  const input = baseInput({
    stage05nOwnerPolicyDecisionRecordOutput: stage05nOutput('STABLE_IDENTITY_POLICY_DEFERRED'),
  });
  delete input.ownerPolicyOptionObserved;
  const result = compileStage05ExitReviewFactsRecord(input);

  assert.equal(result.outputDecision, 'STAGE05_EXIT_REVIEW_FACTS_RECORDED');
  assert.equal(result.ownerPolicyOptionObservation.selectedPolicyOption, 'STABLE_IDENTITY_POLICY_DEFERRED');
  assert.equal(result.ownerPolicyOptionObservation.observedOnly, true);
  assert.equal(result.ownerPolicyOptionObservation.stableBlockInstanceIdCreated, false);
});

test('forbidden permission language blocks from array and string fields', async () => {
  const { compileStage05ExitReviewFactsRecord, STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES } = await loadModule();
  const cases = [
    { permissionLanguageClaims: ['stage05 ready'] },
    { claimLanguage: 'stage05 approved' },
    { reviewLanguage: 'stage05 green' },
  ];

  for (const item of cases) {
    const result = compileStage05ExitReviewFactsRecord(baseInput(item));

    assert.equal(result.outputDecision, 'STAGE05_EXIT_REVIEW_FACTS_BLOCKED');
    assert.equal(result.permissionLanguageFindingCount, 1);
    assert.equal(result.stage05ExitReady, false);
    assert.equal(result.stage06AdmissionGranted, false);
    assert.equal(
      result.blockedReasons.includes(
        STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES.FORBIDDEN_PERMISSION_LANGUAGE_FOUND,
      ),
      true,
    );
  }
});

test('truthy forbidden claim matrix blocks without false-green outputs', async () => {
  const { compileStage05ExitReviewFactsRecord } = await loadModule();

  for (const claimKey of FORBIDDEN_CLAIM_KEYS) {
    const result = compileStage05ExitReviewFactsRecord(baseInput({ [claimKey]: 'yes' }));

    assert.equal(result.outputDecision, 'STAGE05_EXIT_REVIEW_FACTS_BLOCKED', claimKey);
    assert.equal(result.projectTruthAccepted, false, claimKey);
    assert.equal(result.policyAcceptedAsProjectTruth, false, claimKey);
    assert.equal(result.stage05ExitReady, false, claimKey);
    assert.equal(result.stage06PreAdmitted, false, claimKey);
    assert.equal(result.stage06AdmissionGranted, false, claimKey);
    assert.equal(result.applyTxnAllowed, false, claimKey);
    assert.equal(result.projectWritePerformed, false, claimKey);
    assert.equal(result.storageMigrationPerformed, false, claimKey);
    assert.equal(result.stableBlockInstanceIdCreated, false, claimKey);
    assert.equal(result.blockLineageCreated, false, claimKey);
    assert.equal(result.reviewAnchorHandlePromoted, false, claimKey);
    assert.equal(result.structuralAutoApplyAllowed, false, claimKey);
  }
});

test('unknown callable or user project path fields block facts record', async () => {
  const { compileStage05ExitReviewFactsRecord, STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES } = await loadModule();
  const unknown = compileStage05ExitReviewFactsRecord(baseInput({ extraField: 'extra' }));
  const callable = compileStage05ExitReviewFactsRecord(baseInput({ claimLanguage: () => 'bad' }));
  const pathClaim = compileStage05ExitReviewFactsRecord(baseInput({ reviewLanguage: 'Users/example/project' }));

  assert.equal(
    unknown.blockedReasons.includes(STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES.UNKNOWN_FIELD_FORBIDDEN),
    true,
  );
  assert.equal(
    callable.blockedReasons.includes(STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES.CALLABLE_FIELD_FORBIDDEN),
    true,
  );
  assert.equal(
    pathClaim.blockedReasons.includes(STAGE05_EXIT_REVIEW_FACTS_RECORD_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN),
    true,
  );
});
