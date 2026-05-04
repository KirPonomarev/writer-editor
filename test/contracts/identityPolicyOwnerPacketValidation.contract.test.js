const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'identityPolicyOwnerPacketValidation.mjs';
const TEST_BASENAME = 'identityPolicyOwnerPacketValidation.contract.test.js';
const TASK_BASENAME = 'STAGE05L_OWNER_POLICY_PACKET_VALIDATION_ONLY_001.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function allowedChangedBasenames() {
  return [MODULE_BASENAME, TEST_BASENAME, TASK_BASENAME];
}

function ownerPacket(overrides = {}) {
  return {
    packetKind: 'STAGE05L_OWNER_POLICY_PACKET_001',
    packetTarget: 'STAGE05L_OWNER_POLICY_PACKET_VALIDATION_ONLY_001',
    ownerDecisionId: 'owner-policy-decision-001',
    stage05kResultHash: 'stage05k-result-hash-001',
    stage05kDecisionHash: 'stage05k-decision-hash-001',
    ownerAssertions: [
      {
        assertionId: 'assertion-block-instance-policy',
        assertionClass: 'STABLE_BLOCK_INSTANCE_ID_POLICY_PREFERENCE',
      },
      {
        assertionId: 'assertion-block-lineage-policy',
        assertionClass: 'STABLE_BLOCK_LINEAGE_ID_POLICY_PREFERENCE',
      },
      {
        assertionId: 'assertion-anchor-limit',
        assertionClass: 'REVIEW_ANCHOR_HANDLE_LIMIT_PREFERENCE',
      },
      {
        assertionId: 'assertion-structural-manual',
        assertionClass: 'STRUCTURAL_MANUAL_ONLY_CONFIRMATION',
      },
    ],
    ownerUnderstandsEvidenceOnly: true,
    ownerUnderstandsNoProjectTruth: true,
    ownerUnderstandsNoStage05ExitReady: true,
    ownerUnderstandsNoStage06: true,
    ownerUnderstandsNoApplyTxn: true,
    ownerUnderstandsNoStorageMigration: true,
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    changedBasenames: allowedChangedBasenames(),
    stage05kResultHash: 'stage05k-result-hash-001',
    stage05kDecisionHash: 'stage05k-decision-hash-001',
    ownerPolicyPacket: ownerPacket(),
    ...overrides,
  };
}

test('stage05l module stays pure deterministic in-memory owner packet validation', () => {
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
});

test('same input returns same validation result and canonical hash', async () => {
  const { compileIdentityPolicyOwnerPacketValidation } = await loadModule();
  const first = compileIdentityPolicyOwnerPacketValidation(baseInput());
  const second = compileIdentityPolicyOwnerPacketValidation(baseInput());

  assert.deepEqual(first, second);
  assert.equal(first.canonicalHash, second.canonicalHash);
});

test('valid owner packet validates as evidence only', async () => {
  const { compileIdentityPolicyOwnerPacketValidation } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput());

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_VALIDATED_AS_EVIDENCE_ONLY');
  assert.equal(result.ownerPacketValidatedAsEvidenceOnly, true);
  assert.equal(result.blocked, false);
  assert.equal(result.nextReviewPreview.previewOnly, true);
  assert.equal(result.nextReviewPreview.nextContourRecommendationOnly, true);
  assert.equal(result.nextReviewPreview.ownerMayOpenStage05MReviewOnly, true);
});

test('valid owner packet does not accept policy or project truth', async () => {
  const { compileIdentityPolicyOwnerPacketValidation } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput());

  assert.equal(result.ownerPolicyAccepted, false);
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(result.projectTruthPolicyAccepted, false);
  assert.equal(result.reviewBom.acceptedProjectTruthCount, 0);
});

test('valid owner packet does not create stable ids lineage or review anchor promotion', async () => {
  const { compileIdentityPolicyOwnerPacketValidation } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput());

  assert.equal(result.stableIdCreated, false);
  assert.equal(result.stableBlockInstanceIdCreated, false);
  assert.equal(result.blockLineageCreated, false);
  assert.equal(result.blockLineagePersisted, false);
  assert.equal(result.reviewAnchorHandlePromoted, false);
});

test('valid owner packet does not open stage05 exit stage06 or applytxn', async () => {
  const { compileIdentityPolicyOwnerPacketValidation } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput());

  assert.equal(result.stage05ExitReady, false);
  assert.equal(result.stage06PreAdmitted, false);
  assert.equal(result.stage06AdmissionGranted, false);
  assert.equal(result.applyTxnAllowed, false);
  assert.equal(result.applyTxnCreated, false);
  assert.equal(result.nextReviewPreview.stage05ExitReady, false);
  assert.equal(result.nextReviewPreview.stage06PreAdmitted, false);
  assert.equal(result.nextReviewPreview.applyTxnAllowed, false);
});

test('missing changedBasenames blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation({
    stage05kResultHash: 'stage05k-result',
    stage05kDecisionHash: 'stage05k-decision',
    ownerPolicyPacket: ownerPacket(),
  });

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE),
    true,
  );
});

test('outside changed basename blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    changedBasenames: [...allowedChangedBasenames(), 'package.json'],
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_BASENAME_CHANGE),
    true,
  );
});

test('missing Stage05K result hash blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    stage05kResultHash: '',
    ownerPolicyPacket: ownerPacket({ stage05kResultHash: '' }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.MISSING_STAGE05K_RESULT_HASH),
    true,
  );
});

test('stale Stage05K result hash blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    stage05kResultHash: 'actual-stage05k-result',
    stage05kResultHashExpected: 'expected-stage05k-result',
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.STALE_STAGE05K_RESULT_HASH),
    true,
  );
});

test('missing Stage05K decision hash blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    stage05kDecisionHash: '',
    ownerPolicyPacket: ownerPacket({ stage05kDecisionHash: '' }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.MISSING_STAGE05K_DECISION_HASH),
    true,
  );
});

test('stale Stage05K decision hash blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    stage05kDecisionHash: 'actual-stage05k-decision',
    stage05kDecisionHashExpected: 'expected-stage05k-decision',
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.STALE_STAGE05K_DECISION_HASH),
    true,
  );
});

test('missing owner packet blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation({
    changedBasenames: allowedChangedBasenames(),
    stage05kResultHash: 'stage05k-result',
    stage05kDecisionHash: 'stage05k-decision',
  });

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.MISSING_OWNER_POLICY_PACKET),
    true,
  );
});

test('wrong owner packet target blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ packetTarget: 'WRONG_TARGET' }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.WRONG_OWNER_POLICY_PACKET_TARGET),
    true,
  );
});

test('wrong owner packet kind blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ packetKind: 'WRONG_PACKET_KIND' }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.WRONG_OWNER_POLICY_PACKET_TARGET),
    true,
  );
});

test('missing owner decision id blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ ownerDecisionId: '' }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.MISSING_OWNER_DECISION_ID),
    true,
  );
});

test('missing owner assertions blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ ownerAssertions: [] }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.MISSING_OWNER_ASSERTIONS),
    true,
  );
});

test('missing owner understanding flags block validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ ownerUnderstandsNoStage06: false }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.OWNER_UNDERSTANDING_FLAG_MISSING),
    true,
  );
});

test('ambiguous owner assertion blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({
      ownerAssertions: [{ assertionId: 'ambiguous' }],
    }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.AMBIGUOUS_OWNER_ASSERTION),
    true,
  );
});

test('unknown owner assertion class blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({
      ownerAssertions: [{ assertionId: 'unknown', assertionClass: 'UNSUPPORTED_OWNER_POLICY' }],
    }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.UNKNOWN_OWNER_ASSERTION_CLASS),
    true,
  );
});

test('unknown owner packet field blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ unexpectedAdmissionField: 'not-allowed' }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.OWNER_POLICY_PACKET_UNKNOWN_FIELD_FORBIDDEN),
    true,
  );
});

test('callable owner packet field blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ ownerAssertions: [{ assertionId: 'callable', assertionClass: 'STRUCTURAL_MANUAL_ONLY_CONFIRMATION', run: () => true }] }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.CALLABLE_FIELD_FORBIDDEN),
    true,
  );
});

test('user project path owner packet field blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ ownerAssertions: [{ assertionId: 'path', assertionClass: 'STRUCTURAL_MANUAL_ONLY_CONFIRMATION', projectPath: '/tmp/project' }] }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.USER_PROJECT_PATH_FORBIDDEN),
    true,
  );
});

test('scene identity assertion is trace only not acceptance', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({
      ownerAssertions: [{ assertionId: 'scene-policy', assertionClass: 'STABLE_SCENE_ID_POLICY_PREFERENCE' }],
    }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_VALIDATED_AS_EVIDENCE_ONLY');
  assert.equal(result.sceneIdentityAccepted, false);
  assert.equal(result.reviewBom.traceOnlyAssertionCount, 1);
  assert.equal(
    result.reviewBom.assertionReasonCodes.includes(
      IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.SCENE_IDENTITY_TRACE_ONLY_NOT_ACCEPTED,
    ),
    true,
  );
});

test('owner policy acceptance claim blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ ownerPolicyAcceptedClaimed: true }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(result.ownerPolicyAccepted, false);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_OWNER_POLICY_ACCEPTANCE_CLAIM),
    true,
  );
});

test('malformed truthy owner policy acceptance claim values block validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const variants = ['TRUE', 'yes', 1, { claimed: true }, ['true']];

  for (const ownerPolicyAcceptedClaimed of variants) {
    const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
      ownerPolicyPacket: ownerPacket({ ownerPolicyAcceptedClaimed }),
    }));

    assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
    assert.equal(result.ownerPolicyAccepted, false);
    assert.equal(
      result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_OWNER_POLICY_ACCEPTANCE_CLAIM),
      true,
    );
  }
});

test('explicit false forbidden claim values do not block validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation } = await loadModule();
  const variants = [false, '', 'false', 'FALSE', null, undefined];

  for (const ownerPolicyAcceptedClaimed of variants) {
    const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
      ownerPolicyPacket: ownerPacket({ ownerPolicyAcceptedClaimed }),
    }));

    assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_VALIDATED_AS_EVIDENCE_ONLY');
    assert.equal(result.ownerPolicyAccepted, false);
  }
});

test('project truth acceptance claim blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ projectTruthAcceptedClaimed: true }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_PROJECT_TRUTH_ACCEPTANCE_CLAIM),
    true,
  );
});

test('stage05 exit ready claim blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({ stage05ExitReadyClaimed: true }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(result.stage05ExitReady, false);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_STAGE05_EXIT_READY_CLAIM),
    true,
  );
});

test('stage06 permission or pre-admission claims block validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const permission = compileIdentityPolicyOwnerPacketValidation(baseInput({ stage06PermissionClaimed: true }));
  const preAdmission = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ stage06PreAdmittedClaimed: true }),
  }));

  assert.equal(permission.stage06AdmissionGranted, false);
  assert.equal(preAdmission.stage06PreAdmitted, false);
  assert.equal(
    permission.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_STAGE06_PERMISSION_CLAIM),
    true,
  );
  assert.equal(
    preAdmission.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_STAGE06_PRE_ADMISSION_CLAIM),
    true,
  );
});

test('applytxn claim blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ applyTxnAllowedClaimed: true }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(result.applyTxnAllowed, false);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_APPLYTXN_CLAIM),
    true,
  );
});

test('storage migration or project write claims block validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const storage = compileIdentityPolicyOwnerPacketValidation(baseInput({ storageMigrationClaimed: true }));
  const projectWrite = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ projectWriteClaimed: true }),
  }));

  assert.equal(storage.storageMigrationPerformed, false);
  assert.equal(projectWrite.projectWritePerformed, false);
  assert.equal(
    storage.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_STORAGE_MIGRATION_CLAIM),
    true,
  );
  assert.equal(
    projectWrite.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_PROJECT_WRITE_CLAIM),
    true,
  );
});

test('stable id or lineage creation claims block validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const stableId = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ stableBlockInstanceIdCreatedClaimed: true }),
  }));
  const lineage = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ blockLineageCreatedClaimed: true }),
  }));

  assert.equal(stableId.stableBlockInstanceIdCreated, false);
  assert.equal(lineage.blockLineageCreated, false);
  assert.equal(
    stableId.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_STABLE_ID_CREATION_CLAIM),
    true,
  );
  assert.equal(
    lineage.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_LINEAGE_CREATION_CLAIM),
    true,
  );
});

test('review anchor promotion claim blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ reviewAnchorHandlePromotedClaimed: true }),
  }));

  assert.equal(result.reviewAnchorHandlePromoted, false);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_REVIEW_ANCHOR_PROMOTION_CLAIM),
    true,
  );
});

test('structural auto apply claim blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ structuralAutoApplyClaimed: true }),
  }));

  assert.equal(result.outputDecision, 'OWNER_POLICY_PACKET_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_STRUCTURAL_AUTO_APPLY_CLAIM),
    true,
  );
});

test('ui docx network dependency claim blocks validation', async () => {
  const { compileIdentityPolicyOwnerPacketValidation, IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput({
    ownerPolicyPacket: ownerPacket({ uiClaimed: true }),
    networkClaimed: true,
  }));

  assert.equal(result.uiTouched, false);
  assert.equal(result.networkTouched, false);
  assert.equal(result.dependencyChanged, false);
  assert.equal(
    result.blockedReasons.includes(IDENTITY_POLICY_OWNER_PACKET_VALIDATION_REASON_CODES.FORBIDDEN_UI_DOCX_NETWORK_DEPENDENCY_CLAIM),
    true,
  );
});

test('output exposes zero write apply storage and no ready flags', async () => {
  const { compileIdentityPolicyOwnerPacketValidation } = await loadModule();
  const result = compileIdentityPolicyOwnerPacketValidation(baseInput());

  assert.equal(result.projectWritePerformed, false);
  assert.equal(result.runtimeApplyPerformed, false);
  assert.equal(result.applyOpCreated, false);
  assert.equal(result.applyOpPerformed, false);
  assert.equal(result.storageMutationPerformed, false);
  assert.equal(result.storageMigrationPerformed, false);
  assert.equal(result.stage05ExitReady, false);
  assert.equal(result.stage06PreAdmitted, false);
  assert.equal(result.stage06AdmissionGranted, false);
  assert.equal(result.applyTxnAllowed, false);
  assert.equal(result.applyTxnCreated, false);
  assert.equal(result.applyTxnPerformed, false);
});
