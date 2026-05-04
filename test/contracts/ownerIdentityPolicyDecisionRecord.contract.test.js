const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'ownerIdentityPolicyDecisionRecord.mjs';
const TEST_BASENAME = 'ownerIdentityPolicyDecisionRecord.contract.test.js';
const TASK_BASENAME = 'STAGE05N_OWNER_IDENTITY_POLICY_DECISION_RECORD_ONLY_001.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function allowedChangedBasenames() {
  return [MODULE_BASENAME, TEST_BASENAME, TASK_BASENAME];
}

function ownerPacket(overrides = {}) {
  return {
    packetKind: 'STAGE05N_OWNER_IDENTITY_POLICY_DECISION_PACKET_001',
    packetTarget: 'STAGE05N_OWNER_IDENTITY_POLICY_DECISION_RECORD_ONLY_001',
    ownerDecisionId: 'owner-decision-stage05n-001',
    selectedPolicyOption: 'INTERMEDIATE_REVIEW_ANCHOR_HANDLE_ONLY',
    stage05kBlockerRollupHash: 'stage05k-rollup-hash-001',
    stage05lOwnerPacketValidationHash: 'stage05l-validation-hash-001',
    stage05mEvidenceChainReviewBomHash: 'stage05m-bom-hash-001',
    ownerUnderstandsDecisionRecordOnly: true,
    ownerUnderstandsNoProjectTruth: true,
    ownerUnderstandsNoStage05ExitReady: true,
    ownerUnderstandsNoStage06: true,
    ownerUnderstandsNoApplyTxn: true,
    ownerUnderstandsNoStorageMigration: true,
    ownerUnderstandsNoStableIdCreation: true,
    ownerUnderstandsNoLineageCreation: true,
    ownerUnderstandsNoReviewAnchorPromotion: true,
    ownerUnderstandsNoRuntimeWrite: true,
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    changedBasenames: allowedChangedBasenames(),
    stage05kBlockerRollupHash: 'stage05k-rollup-hash-001',
    stage05lOwnerPacketValidationHash: 'stage05l-validation-hash-001',
    stage05mEvidenceChainReviewBomHash: 'stage05m-bom-hash-001',
    ownerPolicyDecisionPacket: ownerPacket(),
    ...overrides,
  };
}

const REQUIRED_REF_HASH_KEYS = [
  'stage05kBlockerRollupHash',
  'stage05lOwnerPacketValidationHash',
  'stage05mEvidenceChainReviewBomHash',
];

const FORBIDDEN_CLAIM_KEYS = [
  'readyStatusClaimed',
  'ownerPolicyAcceptedClaimed',
  'policyAcceptanceClaimed',
  'policyAcceptedClaimed',
  'projectTruthAcceptedClaimed',
  'projectTruthPolicyAcceptedClaimed',
  'ownerPolicyDecisionAcceptedAsProjectTruthClaimed',
  'stage05ExitReadyClaimed',
  'identityPolicyReadyClaimed',
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

test('stage05n module stays pure deterministic in-memory decision record only', () => {
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

test('same input returns same decision record and canonical hash', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord } = await loadModule();
  const first = compileOwnerIdentityPolicyDecisionRecord(baseInput());
  const second = compileOwnerIdentityPolicyDecisionRecord(baseInput());

  assert.deepEqual(first, second);
  assert.equal(first.canonicalHash, second.canonicalHash);
});

test('valid owner option records evidence only without opening exit or Stage06', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord } = await loadModule();
  const result = compileOwnerIdentityPolicyDecisionRecord(baseInput());

  assert.equal(result.outputDecision, 'OWNER_IDENTITY_POLICY_DECISION_RECORDED');
  assert.equal(result.ownerIdentityPolicyDecisionRecorded, true);
  assert.equal(result.ownerPolicyDecisionRecordedAsEvidenceOnly, true);
  assert.equal(result.ownerPolicyDecisionRecordOnly, true);
  assert.equal(result.policyOptionRecord.selectedPolicyOption, 'INTERMEDIATE_REVIEW_ANCHOR_HANDLE_ONLY');
  assert.equal(result.policyOptionRecord.evidenceOnly, true);
  assert.equal(result.policyOptionRecord.projectTruthAccepted, false);
  assert.equal(result.policyOptionRecord.reviewAnchorHandlePromoted, false);
  assert.equal(result.nextStepPreview.previewOnly, true);
  assert.equal(result.nextStepPreview.automaticNextContourOpened, false);
});

test('valid record exposes zero project truth exit Stage06 apply storage and identity creation flags', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord } = await loadModule();
  const result = compileOwnerIdentityPolicyDecisionRecord(baseInput());

  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(result.ownerPolicyAccepted, false);
  assert.equal(result.ownerPolicyDecisionAcceptedAsProjectTruth, false);
  assert.equal(result.projectTruthAccepted, false);
  assert.equal(result.stage05ExitReady, false);
  assert.equal(result.stage06PreAdmitted, false);
  assert.equal(result.stage06AdmissionGranted, false);
  assert.equal(result.applyTxnAllowed, false);
  assert.equal(result.applyTxnCreated, false);
  assert.equal(result.applyTxnPerformed, false);
  assert.equal(result.projectWritePerformed, false);
  assert.equal(result.runtimeApplyPerformed, false);
  assert.equal(result.applyOpCreated, false);
  assert.equal(result.applyOpPerformed, false);
  assert.equal(result.storageMutationPerformed, false);
  assert.equal(result.storageMigrationPerformed, false);
  assert.equal(result.stableIdCreated, false);
  assert.equal(result.stableBlockInstanceIdCreated, false);
  assert.equal(result.blockLineageCreated, false);
  assert.equal(result.blockLineagePersisted, false);
  assert.equal(result.sceneIdentityAccepted, false);
  assert.equal(result.reviewAnchorHandlePromoted, false);
  assert.equal(result.structuralAutoApplyAllowed, false);
});

test('all owner policy options remain record only and do not execute identity policy', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord, OWNER_IDENTITY_POLICY_DECISION_OPTIONS } = await loadModule();

  for (const selectedPolicyOption of Object.values(OWNER_IDENTITY_POLICY_DECISION_OPTIONS)) {
    const result = compileOwnerIdentityPolicyDecisionRecord(baseInput({
      ownerPolicyDecisionPacket: ownerPacket({ selectedPolicyOption }),
    }));

    assert.equal(result.outputDecision, 'OWNER_IDENTITY_POLICY_DECISION_RECORDED', selectedPolicyOption);
    assert.equal(result.policyOptionRecord.selectedPolicyOption, selectedPolicyOption);
    assert.equal(result.policyOptionRecord.policyPreferenceRecordOnly, true);
    assert.equal(result.policyOptionRecord.stableBlockInstanceIdCreated, false);
    assert.equal(result.policyOptionRecord.blockLineageCreated, false);
    assert.equal(result.policyOptionRecord.reviewAnchorHandlePromoted, false);
    assert.equal(result.stage05ExitReady, false);
    assert.equal(result.stage06PreAdmitted, false);
    assert.equal(result.applyTxnAllowed, false);
  }
});

test('missing changedBasenames blocks record', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord, OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES } = await loadModule();
  const input = baseInput();
  delete input.changedBasenames;
  const result = compileOwnerIdentityPolicyDecisionRecord(input);

  assert.equal(result.outputDecision, 'OWNER_IDENTITY_POLICY_DECISION_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(
      OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE,
    ),
    true,
  );
});

test('outside changed basename blocks record', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord, OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES } = await loadModule();
  const result = compileOwnerIdentityPolicyDecisionRecord(baseInput({
    changedBasenames: [...allowedChangedBasenames(), 'package.json'],
  }));

  assert.equal(result.outputDecision, 'OWNER_IDENTITY_POLICY_DECISION_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_BASENAME_CHANGE),
    true,
  );
});

test('missing required Stage05 hashes block owner decision record', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord, OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES } = await loadModule();
  const result = compileOwnerIdentityPolicyDecisionRecord(baseInput({
    stage05kBlockerRollupHash: '',
    stage05lOwnerPacketValidationHash: '',
    stage05mEvidenceChainReviewBomHash: '',
    ownerPolicyDecisionPacket: ownerPacket({
      stage05kBlockerRollupHash: '',
      stage05lOwnerPacketValidationHash: '',
      stage05mEvidenceChainReviewBomHash: '',
    }),
  }));

  assert.equal(result.outputDecision, 'OWNER_IDENTITY_POLICY_DECISION_BLOCKED');
  assert.equal(result.reviewBom.missingHashRefCount, 3);
  assert.equal(
    result.blockedReasons.includes(
      OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.MISSING_STAGE05K_BLOCKER_ROLLUP_HASH,
    ),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(
      OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.MISSING_STAGE05L_OWNER_PACKET_VALIDATION_HASH,
    ),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(
      OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.MISSING_STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_HASH,
    ),
    true,
  );
});

test('stale required Stage05 hash blocks every ref pair', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord } = await loadModule();

  for (const hashKey of REQUIRED_REF_HASH_KEYS) {
    const result = compileOwnerIdentityPolicyDecisionRecord(baseInput({
      [hashKey]: `${hashKey}-actual`,
      [`${hashKey}Expected`]: `${hashKey}-expected`,
      ownerPolicyDecisionPacket: ownerPacket({ [hashKey]: `${hashKey}-actual` }),
    }));

    assert.equal(result.outputDecision, 'OWNER_IDENTITY_POLICY_DECISION_BLOCKED', hashKey);
    assert.equal(result.reviewBom.staleHashRefCount, 1, hashKey);
  }
});

test('direct ref evidence hash takes precedence over top-level and packet hash', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord } = await loadModule();
  const result = compileOwnerIdentityPolicyDecisionRecord(baseInput({
    stage05mEvidenceChainReviewBomHash: 'top-level-stage05m-hash',
    ownerPolicyDecisionPacket: ownerPacket({ stage05mEvidenceChainReviewBomHash: 'packet-stage05m-hash' }),
    stage05mEvidenceChainReviewBomRef: {
      evidenceHash: 'direct-stage05m-hash',
      expectedEvidenceHash: 'direct-stage05m-hash',
    },
  }));

  const ref = result.hashRefs.find((item) => item.refId === 'STAGE05M_EVIDENCE_CHAIN_REVIEW_BOM_REF');
  assert.equal(ref.evidenceHash, 'direct-stage05m-hash');
  assert.equal(ref.expectedEvidenceHash, 'direct-stage05m-hash');
  assert.equal(ref.stale, false);
  assert.equal(result.outputDecision, 'OWNER_IDENTITY_POLICY_DECISION_RECORDED');
});

test('missing owner decision packet stops on owner policy required', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord, OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES } = await loadModule();
  const result = compileOwnerIdentityPolicyDecisionRecord(baseInput({
    ownerPolicyDecisionPacket: null,
  }));

  assert.equal(result.outputDecision, 'STOP_OWNER_POLICY_REQUIRED');
  assert.equal(
    result.blockedReasons.includes(
      OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.MISSING_OWNER_POLICY_DECISION_PACKET,
    ),
    true,
  );
});

test('wrong packet kind or target blocks record', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord, OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES } = await loadModule();
  const wrongKind = compileOwnerIdentityPolicyDecisionRecord(baseInput({
    ownerPolicyDecisionPacket: ownerPacket({ packetKind: 'WRONG_KIND' }),
  }));
  const wrongTarget = compileOwnerIdentityPolicyDecisionRecord(baseInput({
    ownerPolicyDecisionPacket: ownerPacket({ packetTarget: 'WRONG_TARGET' }),
  }));

  assert.equal(wrongKind.outputDecision, 'OWNER_IDENTITY_POLICY_DECISION_BLOCKED');
  assert.equal(wrongTarget.outputDecision, 'OWNER_IDENTITY_POLICY_DECISION_BLOCKED');
  assert.equal(
    wrongKind.blockedReasons.includes(
      OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.WRONG_OWNER_POLICY_DECISION_PACKET_KIND,
    ),
    true,
  );
  assert.equal(
    wrongTarget.blockedReasons.includes(
      OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.WRONG_OWNER_POLICY_DECISION_PACKET_TARGET,
    ),
    true,
  );
});

test('missing owner decision id or option stops on owner policy required', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord } = await loadModule();
  const missingId = compileOwnerIdentityPolicyDecisionRecord(baseInput({
    ownerPolicyDecisionPacket: ownerPacket({ ownerDecisionId: '' }),
  }));
  const missingOption = compileOwnerIdentityPolicyDecisionRecord(baseInput({
    ownerPolicyDecisionPacket: ownerPacket({ selectedPolicyOption: '' }),
  }));

  assert.equal(missingId.outputDecision, 'STOP_OWNER_POLICY_REQUIRED');
  assert.equal(missingOption.outputDecision, 'STOP_OWNER_POLICY_REQUIRED');
});

test('unknown owner policy option blocks record without project truth', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord, OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES } = await loadModule();
  const result = compileOwnerIdentityPolicyDecisionRecord(baseInput({
    ownerPolicyDecisionPacket: ownerPacket({ selectedPolicyOption: 'CREATE_STABLE_IDS_NOW' }),
  }));

  assert.equal(result.outputDecision, 'OWNER_IDENTITY_POLICY_DECISION_BLOCKED');
  assert.equal(result.policyOptionRecord.optionKnown, false);
  assert.equal(result.policyOptionRecord.projectTruthAccepted, false);
  assert.equal(
    result.blockedReasons.includes(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.UNKNOWN_OWNER_POLICY_OPTION),
    true,
  );
});

test('missing understanding flag blocks record', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord, OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES } = await loadModule();
  const result = compileOwnerIdentityPolicyDecisionRecord(baseInput({
    ownerPolicyDecisionPacket: ownerPacket({ ownerUnderstandsNoStage06: false }),
  }));

  assert.equal(result.outputDecision, 'OWNER_IDENTITY_POLICY_DECISION_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.OWNER_UNDERSTANDING_FLAG_MISSING),
    true,
  );
});

test('unknown callable or user project path owner packet fields block', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord, OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES } = await loadModule();
  const unknown = compileOwnerIdentityPolicyDecisionRecord(baseInput({
    ownerPolicyDecisionPacket: ownerPacket({ extraField: 'extra' }),
  }));
  const callable = compileOwnerIdentityPolicyDecisionRecord(baseInput({
    ownerPolicyDecisionPacket: ownerPacket({ decisionLanguage: () => 'bad' }),
  }));
  const pathClaim = compileOwnerIdentityPolicyDecisionRecord(baseInput({
    ownerPolicyDecisionPacket: ownerPacket({ decisionLanguage: 'Users/example/project' }),
  }));

  assert.equal(
    unknown.blockedReasons.includes(
      OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.OWNER_POLICY_DECISION_PACKET_UNKNOWN_FIELD_FORBIDDEN,
    ),
    true,
  );
  assert.equal(
    callable.blockedReasons.includes(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.CALLABLE_FIELD_FORBIDDEN),
    true,
  );
  assert.equal(
    pathClaim.blockedReasons.includes(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN),
    true,
  );
});

test('forbidden permission language blocks record without creating permission', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord, OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES } = await loadModule();
  const terms = ['ready', 'approved', 'accepted', 'allowed', 'admitted', 'permission', 'permitted', 'green'];

  for (const term of terms) {
    const result = compileOwnerIdentityPolicyDecisionRecord(baseInput({
      ownerPolicyDecisionPacket: ownerPacket({ permissionLanguageClaims: [`stage05 ${term}`] }),
    }));

    assert.equal(result.outputDecision, 'OWNER_IDENTITY_POLICY_DECISION_BLOCKED', term);
    assert.equal(result.permissionLanguageFindingCount, 1, term);
    assert.equal(result.stage05ExitReady, false, term);
    assert.equal(result.stage06AdmissionGranted, false, term);
    assert.equal(
      result.blockedReasons.includes(
        OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_PERMISSION_LANGUAGE_FOUND,
      ),
      true,
      term,
    );
  }
});

test('truthy forbidden claim matrix blocks record without admitting policy', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord } = await loadModule();

  for (const claimKey of FORBIDDEN_CLAIM_KEYS) {
    const result = compileOwnerIdentityPolicyDecisionRecord(baseInput({
      ownerPolicyDecisionPacket: ownerPacket({ [claimKey]: 'yes' }),
    }));

    assert.equal(result.outputDecision, 'OWNER_IDENTITY_POLICY_DECISION_BLOCKED', claimKey);
    assert.equal(result.policyAcceptedAsProjectTruth, false, claimKey);
    assert.equal(result.ownerPolicyAccepted, false, claimKey);
    assert.equal(result.ownerPolicyDecisionAcceptedAsProjectTruth, false, claimKey);
    assert.equal(result.projectTruthAccepted, false, claimKey);
    assert.equal(result.stage05ExitReady, false, claimKey);
    assert.equal(result.stage06PreAdmitted, false, claimKey);
    assert.equal(result.stage06AdmissionGranted, false, claimKey);
    assert.equal(result.applyTxnAllowed, false, claimKey);
    assert.equal(result.projectWritePerformed, false, claimKey);
    assert.equal(result.storageMigrationPerformed, false, claimKey);
    assert.equal(result.stableBlockInstanceIdCreated, false, claimKey);
    assert.equal(result.blockLineageCreated, false, claimKey);
    assert.equal(result.reviewAnchorHandlePromoted, false, claimKey);
  }
});

test('top-level forbidden claims also block record', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord, OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES } = await loadModule();
  const result = compileOwnerIdentityPolicyDecisionRecord(baseInput({
    stage06PermissionClaimed: true,
    applyTxnAllowedClaimed: true,
    projectWriteClaimed: true,
  }));

  assert.equal(result.outputDecision, 'OWNER_IDENTITY_POLICY_DECISION_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM),
    true,
  );
  assert.equal(
    result.blockedReasons.includes(OWNER_IDENTITY_POLICY_DECISION_RECORD_REASON_CODES.FORBIDDEN_PROJECT_WRITE_CLAIM),
    true,
  );
});

test('review bom counts record-only facts and zero false green outcomes', async () => {
  const { compileOwnerIdentityPolicyDecisionRecord } = await loadModule();
  const result = compileOwnerIdentityPolicyDecisionRecord(baseInput());

  assert.equal(result.reviewBom.requiredHashRefCount, 3);
  assert.equal(result.reviewBom.presentHashRefCount, 3);
  assert.equal(result.reviewBom.missingHashRefCount, 0);
  assert.equal(result.reviewBom.staleHashRefCount, 0);
  assert.equal(result.reviewBom.policyPreferenceRecordOnlyCount, 1);
  assert.equal(result.reviewBom.projectTruthAcceptanceCount, 0);
  assert.equal(result.reviewBom.stage05ExitReadyCount, 0);
  assert.equal(result.reviewBom.stage06AdmissionCount, 0);
  assert.equal(result.reviewBom.applyTxnPermissionCount, 0);
  assert.equal(result.reviewBom.storageMigrationCount, 0);
  assert.equal(result.reviewBom.stableIdCreationCount, 0);
  assert.equal(result.reviewBom.lineageCreationCount, 0);
  assert.equal(result.reviewBom.reviewAnchorPromotionCount, 0);
});
