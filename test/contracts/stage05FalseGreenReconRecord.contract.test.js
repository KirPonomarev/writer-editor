const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'stage05FalseGreenReconRecord.mjs';
const TEST_BASENAME = 'stage05FalseGreenReconRecord.contract.test.js';
const TASK_BASENAME = 'STAGE05P_STAGE05_FALSE_GREEN_RECON_RECORD_ONLY_001.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function allowedChangedBasenames() {
  return [MODULE_BASENAME, TEST_BASENAME, TASK_BASENAME];
}

function baseInput(overrides = {}) {
  return {
    changedBasenames: allowedChangedBasenames(),
    stage05kBlockerRollupHash: 'stage05k-rollup-hash-001',
    stage05lOwnerPacketValidationHash: 'stage05l-validation-hash-001',
    stage05mEvidenceChainReviewBomHash: 'stage05m-bom-hash-001',
    stage05nOwnerPolicyDecisionRecordHash: 'stage05n-decision-record-hash-001',
    stage05oExitReviewFactsRecordHash: 'stage05o-exit-review-facts-hash-001',
    stage05nOwnerPolicyOptionObserved: 'INTERMEDIATE_REVIEW_ANCHOR_HANDLE_ONLY',
    stage05oOwnerPolicyOptionObserved: 'INTERMEDIATE_REVIEW_ANCHOR_HANDLE_ONLY',
    ...overrides,
  };
}

const REQUIRED_HASH_KEYS = [
  'stage05kBlockerRollupHash',
  'stage05lOwnerPacketValidationHash',
  'stage05mEvidenceChainReviewBomHash',
  'stage05nOwnerPolicyDecisionRecordHash',
  'stage05oExitReviewFactsRecordHash',
];

const FALSE_OUTPUT_FLAGS = [
  'falseGreenDetected',
  'falseGreenConfirmed',
  'falseGreenFlagCreated',
  'stage05ExitReady',
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
  'projectTruthAccepted',
  'policyAcceptedAsProjectTruth',
  'ownerPolicyOptionMatchAcceptedAsProjectTruth',
  'automaticNextContourOpened',
  'uiTouched',
  'docxTouched',
  'networkTouched',
  'dependencyTouched',
];

const FORBIDDEN_CLAIM_CASES = [
  ['policyAcceptanceClaimed', 'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM'],
  ['policyAcceptedClaimed', 'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM'],
  ['ownerPolicyAcceptedClaimed', 'FORBIDDEN_POLICY_ACCEPTANCE_CLAIM'],
  ['projectTruthAcceptedClaimed', 'FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM'],
  ['projectTruthPolicyAcceptedClaimed', 'FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM'],
  ['ownerPolicyDecisionAcceptedAsProjectTruthClaimed', 'FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM'],
  ['stage05ExitReadyClaimed', 'FORBIDDEN_STAGE05_EXIT_READY_CLAIM'],
  ['identityPolicyReadyClaimed', 'FORBIDDEN_STAGE05_EXIT_READY_CLAIM'],
  ['readyStatusClaimed', 'FORBIDDEN_STAGE05_EXIT_READY_CLAIM'],
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
  ['stableIdCreationClaimed', 'FORBIDDEN_STABLE_ID_CREATION_CLAIM'],
  ['stableBlockInstanceIdCreatedClaimed', 'FORBIDDEN_STABLE_ID_CREATION_CLAIM'],
  ['persistStableBlockInstanceIdClaimed', 'FORBIDDEN_STABLE_ID_CREATION_CLAIM'],
  ['blockLineageCreatedClaimed', 'FORBIDDEN_LINEAGE_CREATION_CLAIM'],
  ['blockLineagePersistedClaimed', 'FORBIDDEN_LINEAGE_CREATION_CLAIM'],
  ['createBlockLineageClaimed', 'FORBIDDEN_LINEAGE_CREATION_CLAIM'],
  ['reviewAnchorPromotedClaimed', 'FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM'],
  ['reviewAnchorHandlePromotedClaimed', 'FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM'],
  ['structuralAutoApplyClaimed', 'FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM'],
  ['moveSplitMergeAutoApplyClaimed', 'FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM'],
  ['uiClaimed', 'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM'],
  ['docxClaimed', 'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM'],
  ['networkClaimed', 'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM'],
  ['dependencyChangeClaimed', 'FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM'],
];

test('stage05p module stays pure deterministic in-memory recon record only', () => {
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

test('importing stage05p creates no files and exposes record-only aliases', async () => {
  const before = new Set(fs.readdirSync(path.join(process.cwd(), 'src', 'revisionBridge')));
  const {
    compileStage05FalseGreenReconRecord,
    runStage05FalseGreenReconRecord,
    compileStage05FalseGreenReconRecordOnly,
    runStage05FalseGreenReconRecordOnly,
  } = await loadModule();
  const after = new Set(fs.readdirSync(path.join(process.cwd(), 'src', 'revisionBridge')));

  assert.deepEqual(after, before);
  assert.equal(runStage05FalseGreenReconRecord, compileStage05FalseGreenReconRecord);
  assert.equal(compileStage05FalseGreenReconRecordOnly, compileStage05FalseGreenReconRecord);
  assert.equal(runStage05FalseGreenReconRecordOnly, compileStage05FalseGreenReconRecord);
});

test('same input returns same false-green recon record and canonical hash', async () => {
  const { compileStage05FalseGreenReconRecord } = await loadModule();
  const first = compileStage05FalseGreenReconRecord(baseInput());
  const second = compileStage05FalseGreenReconRecord(baseInput());

  assert.deepEqual(first, second);
  assert.equal(first.canonicalHash, second.canonicalHash);
});

test('valid hash-bound input records facts only without creating project truth', async () => {
  const { compileStage05FalseGreenReconRecord } = await loadModule();
  const result = compileStage05FalseGreenReconRecord(baseInput());

  assert.equal(result.outputDecision, 'STAGE05_FALSE_GREEN_RECON_FACTS_RECORDED');
  assert.equal(result.stage05FalseGreenReconFactsRecorded, true);
  assert.equal(result.stage05FalseGreenReconRecordOnly, true);
  assert.equal(result.factsOnly, true);
  assert.equal(result.reconOnly, true);
  assert.equal(result.ownerPolicyOptionObservedOnly, true);
  assert.equal(result.ownerPolicyOptionConsistency.observationsMatch, true);
  assert.equal(result.ownerPolicyOptionConsistency.matchAcceptedAsProjectTruth, false);
  assert.equal(result.nextStepPreview.previewOnly, true);
  assert.equal(result.nextStepPreview.automaticNextContourOpened, false);
});

test('valid record exposes zero false-green ready permission apply storage and identity flags', async () => {
  const { compileStage05FalseGreenReconRecord } = await loadModule();
  const result = compileStage05FalseGreenReconRecord(baseInput());

  for (const flag of FALSE_OUTPUT_FLAGS) {
    assert.equal(result[flag], false, flag);
  }
});

test('review bom counts five hash refs and zero permission apply storage identity counts', async () => {
  const { compileStage05FalseGreenReconRecord } = await loadModule();
  const result = compileStage05FalseGreenReconRecord(baseInput());

  assert.equal(result.reviewBom.factsOnly, true);
  assert.equal(result.reviewBom.reconOnly, true);
  assert.equal(result.reviewBom.requiredHashRefCount, 5);
  assert.equal(result.reviewBom.presentHashRefCount, 5);
  assert.equal(result.reviewBom.missingHashRefCount, 0);
  assert.equal(result.reviewBom.staleHashRefCount, 0);
  assert.equal(result.reviewBom.ownerPolicyOptionObservedOnlyCount, 2);
  assert.equal(result.reviewBom.ownerPolicyOptionMatchObservedOnlyCount, 1);
  assert.equal(result.reviewBom.permissionLanguageFindingCount, 0);
  assert.equal(result.reviewBom.forbiddenClaimCount, 0);
  assert.equal(result.reviewBom.falseGreenFlagCount, 0);
  assert.equal(result.reviewBom.stage05ExitReadyCount, 0);
  assert.equal(result.reviewBom.stage06PreAdmissionCount, 0);
  assert.equal(result.reviewBom.stage06AdmissionCount, 0);
  assert.equal(result.reviewBom.stage06PermissionCount, 0);
  assert.equal(result.reviewBom.applyTxnPermissionCount, 0);
  assert.equal(result.reviewBom.runtimeApplyCount, 0);
  assert.equal(result.reviewBom.applyOpCreationCount, 0);
  assert.equal(result.reviewBom.projectWriteCount, 0);
  assert.equal(result.reviewBom.storageMutationCount, 0);
  assert.equal(result.reviewBom.storageMigrationCount, 0);
  assert.equal(result.reviewBom.stableIdCreationCount, 0);
  assert.equal(result.reviewBom.lineageCreationCount, 0);
  assert.equal(result.reviewBom.reviewAnchorPromotionCount, 0);
  assert.equal(result.reviewBom.structuralAutoApplyCount, 0);
  assert.equal(result.reviewBom.uiDocxNetworkDependencyCount, 0);
  assert.equal(result.reviewBom.permissionSignalCount, 0);
});

test('direct ref evidence hash takes precedence over top-level hash', async () => {
  const { compileStage05FalseGreenReconRecord } = await loadModule();
  const result = compileStage05FalseGreenReconRecord(baseInput({
    stage05oExitReviewFactsRecordHash: 'top-level-stage05o-hash',
    stage05oExitReviewFactsRecordRef: {
      evidenceHash: 'direct-stage05o-hash',
      expectedEvidenceHash: 'direct-stage05o-hash',
    },
  }));

  const ref = result.hashRefs.find((item) => item.refId === 'STAGE05O_EXIT_REVIEW_FACTS_RECORD_REF');
  assert.equal(ref.evidenceHash, 'direct-stage05o-hash');
  assert.equal(ref.expectedEvidenceHash, 'direct-stage05o-hash');
  assert.equal(ref.stale, false);
  assert.equal(result.outputDecision, 'STAGE05_FALSE_GREEN_RECON_FACTS_RECORDED');
});

test('changedBasenames must exactly match the Stage05P delivery scope', async () => {
  const { compileStage05FalseGreenReconRecord, STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES } = await loadModule();
  const exact = compileStage05FalseGreenReconRecord(baseInput({
    changedBasenames: [...allowedChangedBasenames()].reverse(),
  }));
  const missing = baseInput();
  delete missing.changedBasenames;
  const missingResult = compileStage05FalseGreenReconRecord(missing);
  const empty = compileStage05FalseGreenReconRecord(baseInput({ changedBasenames: [] }));
  const subset = compileStage05FalseGreenReconRecord(baseInput({
    changedBasenames: allowedChangedBasenames().slice(0, 2),
  }));
  const duplicate = compileStage05FalseGreenReconRecord(baseInput({
    changedBasenames: [
      ...allowedChangedBasenames(),
      allowedChangedBasenames()[0],
    ],
  }));
  const outside = compileStage05FalseGreenReconRecord(baseInput({
    changedBasenames: [...allowedChangedBasenames(), 'package.json'],
  }));

  assert.equal(exact.outputDecision, 'STAGE05_FALSE_GREEN_RECON_FACTS_RECORDED');
  for (const result of [missingResult, empty, subset, duplicate]) {
    assert.equal(result.outputDecision, 'STAGE05_FALSE_GREEN_RECON_FACTS_BLOCKED');
    assert.equal(
      result.blockedReasons.includes(
        STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE,
      ),
      true,
    );
  }
  assert.equal(outside.outputDecision, 'STAGE05_FALSE_GREEN_RECON_FACTS_BLOCKED');
  assert.equal(
    outside.blockedReasons.includes(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_BASENAME_CHANGE),
    true,
  );
});

test('missing required hashes stop only on owner-review refs and otherwise block', async () => {
  const { compileStage05FalseGreenReconRecord } = await loadModule();

  for (const hashKey of REQUIRED_HASH_KEYS) {
    const result = compileStage05FalseGreenReconRecord(baseInput({ [hashKey]: '' }));
    const expectedDecision = ['stage05nOwnerPolicyDecisionRecordHash', 'stage05oExitReviewFactsRecordHash']
      .includes(hashKey)
      ? 'STOP_OWNER_REVIEW_REQUIRED'
      : 'STAGE05_FALSE_GREEN_RECON_FACTS_BLOCKED';

    assert.equal(result.outputDecision, expectedDecision, hashKey);
    assert.equal(result.reviewBom.missingHashRefCount, 1, hashKey);
  }
});

test('stale required hash blocks false-green recon record', async () => {
  const { compileStage05FalseGreenReconRecord } = await loadModule();

  for (const hashKey of REQUIRED_HASH_KEYS) {
    const result = compileStage05FalseGreenReconRecord(baseInput({
      [hashKey]: `${hashKey}-actual`,
      [`${hashKey}Expected`]: `${hashKey}-expected`,
    }));

    assert.equal(result.outputDecision, 'STAGE05_FALSE_GREEN_RECON_FACTS_BLOCKED', hashKey);
    assert.equal(result.reviewBom.staleHashRefCount, 1, hashKey);
  }
});

test('owner policy option match is observed only and not acceptance', async () => {
  const { compileStage05FalseGreenReconRecord } = await loadModule();
  const result = compileStage05FalseGreenReconRecord(baseInput({
    stage05nOwnerPolicyOptionObserved: 'STABLE_IDENTITY_POLICY_DEFERRED',
    stage05oOwnerPolicyOptionObserved: 'STABLE_IDENTITY_POLICY_DEFERRED',
  }));

  assert.equal(result.outputDecision, 'STAGE05_FALSE_GREEN_RECON_FACTS_RECORDED');
  assert.equal(result.ownerPolicyOptionConsistency.observationsMatch, true);
  assert.equal(result.ownerPolicyOptionConsistency.policyAccepted, false);
  assert.equal(result.projectTruthAccepted, false);
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(result.stableBlockInstanceIdCreated, false);
});

test('missing owner policy option observation stops on owner review required', async () => {
  const { compileStage05FalseGreenReconRecord, STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES } = await loadModule();
  for (const optionKey of ['stage05nOwnerPolicyOptionObserved', 'stage05oOwnerPolicyOptionObserved']) {
    const input = baseInput();
    delete input[optionKey];
    const result = compileStage05FalseGreenReconRecord(input);

    assert.equal(result.outputDecision, 'STOP_OWNER_REVIEW_REQUIRED', optionKey);
    assert.equal(
      result.blockedReasons.some((reason) => [
        STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.MISSING_STAGE05N_OWNER_POLICY_OPTION_OBSERVATION,
        STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.MISSING_STAGE05O_OWNER_POLICY_OPTION_OBSERVATION,
      ].includes(reason)),
      true,
      optionKey,
    );
  }
});

test('unknown owner policy option blocks without creating project truth', async () => {
  const { compileStage05FalseGreenReconRecord, STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES } = await loadModule();
  const result = compileStage05FalseGreenReconRecord(baseInput({
    stage05nOwnerPolicyOptionObserved: 'CREATE_STABLE_IDS_NOW',
  }));

  assert.equal(result.outputDecision, 'STAGE05_FALSE_GREEN_RECON_FACTS_BLOCKED');
  assert.equal(result.ownerPolicyOptionConsistency.stage05nOptionKnown, false);
  assert.equal(result.ownerPolicyOptionConsistency.acceptedAsProjectTruth, false);
  assert.equal(
    result.blockedReasons.includes(
      STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.UNKNOWN_STAGE05N_OWNER_POLICY_OPTION_OBSERVATION,
    ),
    true,
  );
});

test('owner policy option mismatch blocks without accepting project truth', async () => {
  const { compileStage05FalseGreenReconRecord, STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES } = await loadModule();
  const result = compileStage05FalseGreenReconRecord(baseInput({
    stage05nOwnerPolicyOptionObserved: 'INTERMEDIATE_REVIEW_ANCHOR_HANDLE_ONLY',
    stage05oOwnerPolicyOptionObserved: 'STABLE_IDENTITY_POLICY_DEFERRED',
  }));

  assert.equal(result.outputDecision, 'STAGE05_FALSE_GREEN_RECON_FACTS_BLOCKED');
  assert.equal(result.ownerPolicyOptionConsistency.observationsMatch, false);
  assert.equal(result.ownerPolicyOptionConsistency.matchAcceptedAsProjectTruth, false);
  assert.equal(
    result.blockedReasons.includes(
      STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.OWNER_POLICY_OPTION_OBSERVATION_MISMATCH,
    ),
    true,
  );
});

test('forbidden permission language terms block from array and string fields', async () => {
  const { compileStage05FalseGreenReconRecord, STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES } = await loadModule();
  const terms = ['READY', 'APPROVED', 'ACCEPTED', 'ALLOWED', 'ADMITTED', 'PERMISSION', 'PERMITTED', 'GREEN'];
  const cases = terms.flatMap((term) => [
    { permissionLanguageClaims: [`stage05 ${term}`] },
    { claimLanguage: `stage05 ${term}` },
    { reviewLanguage: `stage05 ${term}` },
  ]);

  for (const item of cases) {
    const result = compileStage05FalseGreenReconRecord(baseInput(item));

    assert.equal(result.outputDecision, 'STAGE05_FALSE_GREEN_RECON_FACTS_BLOCKED');
    assert.equal(result.permissionLanguageFindingCount, 1);
    assert.equal(result.stage05ExitReady, false);
    assert.equal(result.stage06PermissionGranted, false);
    assert.equal(
      result.blockedReasons.includes(
        STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.FORBIDDEN_PERMISSION_LANGUAGE_FOUND,
      ),
      true,
    );
  }
});

test('truthy forbidden claim matrix blocks without false-green outputs', async () => {
  const { compileStage05FalseGreenReconRecord } = await loadModule();

  for (const [claimKey, expectedReason] of FORBIDDEN_CLAIM_CASES) {
    const result = compileStage05FalseGreenReconRecord(baseInput({ [claimKey]: 'yes' }));

    assert.equal(result.outputDecision, 'STAGE05_FALSE_GREEN_RECON_FACTS_BLOCKED', claimKey);
    assert.equal(result.blockedReasons.includes(expectedReason), true, claimKey);
    for (const flag of FALSE_OUTPUT_FLAGS) {
      assert.equal(result[flag], false, `${claimKey}:${flag}`);
    }
  }
});

test('unknown callable or user project path fields block facts record', async () => {
  const { compileStage05FalseGreenReconRecord, STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES } = await loadModule();
  const unknown = compileStage05FalseGreenReconRecord(baseInput({ extraField: 'extra' }));
  const callable = compileStage05FalseGreenReconRecord(baseInput({ claimLanguage: () => 'bad' }));
  const pathClaim = compileStage05FalseGreenReconRecord(baseInput({ reviewLanguage: 'Users/example/project' }));

  assert.equal(
    unknown.blockedReasons.includes(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.UNKNOWN_FIELD_FORBIDDEN),
    true,
  );
  assert.equal(
    callable.blockedReasons.includes(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.CALLABLE_FIELD_FORBIDDEN),
    true,
  );
  assert.equal(
    pathClaim.blockedReasons.includes(STAGE05_FALSE_GREEN_RECON_RECORD_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN),
    true,
  );
});
