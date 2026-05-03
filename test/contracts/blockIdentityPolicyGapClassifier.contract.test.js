const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'blockIdentityPolicyGapClassifier.mjs';
const TEST_BASENAME = 'blockIdentityPolicyGapClassifier.contract.test.js';
const TASK_BASENAME = 'STAGE05E_BLOCK_IDENTITY_POLICY_GAP_CLASSIFIER_001.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function allowedChangedBasenames() {
  return [MODULE_BASENAME, TEST_BASENAME, TASK_BASENAME];
}

function baseCandidate(overrides = {}) {
  return {
    candidateId: 'candidate-001',
    candidateProofMode: 'NO_STABLE_BLOCK_IDENTITY_AVAILABLE',
    reviewAnchorHandleHash: '',
    targetBlockRef: '',
    blockVersionHash: '',
    externalBlockInstanceProof: '',
    blockLineageProof: '',
    structuralChangeKind: 'NONE',
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    changedBasenames: allowedChangedBasenames(),
    candidates: [baseCandidate()],
    ...overrides,
  };
}

function firstClassification(result) {
  return result.classifications[0];
}

test('stage05e module stays pure deterministic in-memory classifier', () => {
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

test('same input returns same gap packet and hash', async () => {
  const { compileBlockIdentityPolicyGapClassifier } = await loadModule();
  const first = compileBlockIdentityPolicyGapClassifier(baseInput());
  const second = compileBlockIdentityPolicyGapClassifier(baseInput());

  assert.deepEqual(first, second);
  assert.equal(first.canonicalHash, second.canonicalHash);
  assert.equal(firstClassification(first).policyGapHash, firstClassification(second).policyGapHash);
});

test('default classification blocks future Stage06 ApplyTxn', async () => {
  const {
    compileBlockIdentityPolicyGapClassifier,
    BLOCK_IDENTITY_POLICY_STAGE06_STATUSES,
    BLOCK_IDENTITY_POLICY_GAP_REASON_CODES,
  } = await loadModule();
  const result = compileBlockIdentityPolicyGapClassifier(baseInput());

  assert.equal(result.futureStage06Status, BLOCK_IDENTITY_POLICY_STAGE06_STATUSES.FUTURE_STAGE06_APPLYTXN_BLOCKED);
  assert.equal(result.stage06AdmissionGranted, false);
  assert.equal(result.applyTxnPermissionGranted, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.NO_STABLE_BLOCK_IDENTITY_AVAILABLE,
    ),
    true,
  );
});

test('blockVersionHash classifies as guard only', async () => {
  const {
    compileBlockIdentityPolicyGapClassifier,
    BLOCK_IDENTITY_POLICY_GAP_REASON_CODES,
    BLOCK_IDENTITY_POLICY_CANDIDATE_MODES,
  } = await loadModule();
  const result = compileBlockIdentityPolicyGapClassifier(baseInput({
    candidates: [baseCandidate({ blockVersionHash: 'block-version-001' })],
  }));

  assert.equal(firstClassification(result).blockVersionHashIdentityClaimed, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.BLOCK_VERSION_HASH_GUARD_ONLY,
    ),
    true,
  );
  assert.equal(
    firstClassification(result).candidateModes.includes(
      BLOCK_IDENTITY_POLICY_CANDIDATE_MODES.LOCAL_SCENE_AND_BLOCK_VERSION_GUARD_ONLY,
    ),
    true,
  );
});

test('targetBlockRef classifies as review reference only', async () => {
  const {
    compileBlockIdentityPolicyGapClassifier,
    BLOCK_IDENTITY_POLICY_GAP_REASON_CODES,
  } = await loadModule();
  const result = compileBlockIdentityPolicyGapClassifier(baseInput({
    candidates: [baseCandidate({ targetBlockRef: 'review-target-block-ref' })],
  }));

  assert.equal(firstClassification(result).targetBlockRefProjectTruthClaimed, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.TARGET_BLOCK_REF_NOT_PROJECT_TRUTH,
    ),
    true,
  );
});

test('sourceAnchorHandleHash classifies as packet local only', async () => {
  const {
    compileBlockIdentityPolicyGapClassifier,
    BLOCK_IDENTITY_POLICY_GAP_REASON_CODES,
    BLOCK_IDENTITY_POLICY_CANDIDATE_MODES,
  } = await loadModule();
  const result = compileBlockIdentityPolicyGapClassifier(baseInput({
    candidates: [baseCandidate({ sourceAnchorHandleHash: 'packet-local-anchor-hash' })],
  }));

  assert.equal(firstClassification(result).reviewAnchorHandleProjectTruthClaimed, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.REVIEW_ANCHOR_HANDLE_NOT_PROJECT_TRUTH,
    ),
    true,
  );
  assert.equal(
    firstClassification(result).candidateModes.includes(
      BLOCK_IDENTITY_POLICY_CANDIDATE_MODES.REVIEW_ANCHOR_HANDLE_PACKET_LOCAL_CANDIDATE_NOT_PROJECT_TRUTH,
    ),
    true,
  );
});

test('reviewAnchorHandle candidate never becomes project truth', async () => {
  const { compileBlockIdentityPolicyGapClassifier } = await loadModule();
  const result = compileBlockIdentityPolicyGapClassifier(baseInput({
    candidates: [baseCandidate({ reviewAnchorHandleHash: 'review-anchor-hash' })],
  }));

  assert.equal(firstClassification(result).acceptedAsProjectTruth, false);
  assert.equal(firstClassification(result).projectTruthPolicyAccepted, false);
  assert.equal(result.policyAcceptedAsProjectTruth, false);
});

test('external block instance proof is advisory only', async () => {
  const {
    compileBlockIdentityPolicyGapClassifier,
    BLOCK_IDENTITY_POLICY_GAP_REASON_CODES,
    BLOCK_IDENTITY_POLICY_CANDIDATE_MODES,
  } = await loadModule();
  const result = compileBlockIdentityPolicyGapClassifier(baseInput({
    candidates: [baseCandidate({ externalBlockInstanceProof: 'external-instance-proof' })],
  }));

  assert.equal(firstClassification(result).classification, 'ADVISORY_ONLY');
  assert.equal(firstClassification(result).acceptedAsProjectTruth, false);
  assert.equal(firstClassification(result).ownerDecisionRequired, true);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.BLOCK_INSTANCE_PROOF_ADVISORY_ONLY,
    ),
    true,
  );
  assert.equal(
    firstClassification(result).candidateModes.includes(
      BLOCK_IDENTITY_POLICY_CANDIDATE_MODES.EXTERNAL_BLOCK_INSTANCE_PROOF_ADVISORY_ONLY,
    ),
    true,
  );
});

test('block lineage proof is advisory only', async () => {
  const {
    compileBlockIdentityPolicyGapClassifier,
    BLOCK_IDENTITY_POLICY_GAP_REASON_CODES,
  } = await loadModule();
  const result = compileBlockIdentityPolicyGapClassifier(baseInput({
    candidates: [baseCandidate({ blockLineageProof: 'lineage-proof' })],
  }));

  assert.equal(firstClassification(result).classification, 'ADVISORY_ONLY');
  assert.equal(firstClassification(result).acceptedAsProjectTruth, false);
  assert.equal(firstClassification(result).ownerDecisionRequired, true);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.BLOCK_LINEAGE_PROOF_ADVISORY_ONLY,
    ),
    true,
  );
});

test('no candidate proof mode is accepted as project truth', async () => {
  const { compileBlockIdentityPolicyGapClassifier } = await loadModule();
  const result = compileBlockIdentityPolicyGapClassifier(baseInput({
    candidates: [
      baseCandidate({ candidateId: 'a', externalBlockInstanceProof: 'instance' }),
      baseCandidate({ candidateId: 'b', blockLineageProof: 'lineage' }),
      baseCandidate({ candidateId: 'c', reviewAnchorHandleHash: 'anchor' }),
      baseCandidate({ candidateId: 'd', blockVersionHash: 'version' }),
    ],
  }));

  assert.equal(result.reviewBom.acceptedProjectTruthCount, 0);
  assert.equal(result.classifications.every((item) => item.acceptedAsProjectTruth === false), true);
  assert.equal(result.classifications.every((item) => item.acceptedPolicyMode === false), true);
});

test('structural move split merge is manual only', async () => {
  const {
    compileBlockIdentityPolicyGapClassifier,
    BLOCK_IDENTITY_POLICY_GAP_REASON_CODES,
  } = await loadModule();

  for (const kind of ['MOVE', 'SPLIT', 'MERGE']) {
    const result = compileBlockIdentityPolicyGapClassifier(baseInput({
      candidates: [baseCandidate({ structuralChangeKind: kind })],
    }));
    assert.equal(result.futureStage06Status, 'FUTURE_STAGE06_APPLYTXN_BLOCKED', kind);
    assert.equal(
      firstClassification(result).reasonCodes.includes(
        BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.STRUCTURAL_POLICY_MANUAL_ONLY,
      ),
      true,
      kind,
    );
  }
});

test('exact text is future consumer not Stage05E apply path', async () => {
  const {
    compileBlockIdentityPolicyGapClassifier,
    BLOCK_IDENTITY_POLICY_GAP_REASON_CODES,
  } = await loadModule();
  const result = compileBlockIdentityPolicyGapClassifier(baseInput({
    candidates: [baseCandidate({ consumerKind: 'EXACT_TEXT' })],
  }));

  assert.equal(firstClassification(result).exactTextCurrentApplyPath, false);
  assert.equal(result.applyOpCreated, false);
  assert.equal(result.applyTxnCreated, false);
  assert.equal(
    firstClassification(result).reasonCodes.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.EXACT_TEXT_FUTURE_CONSUMER_ONLY,
    ),
    true,
  );
});

test('explicit block identity creation claim blocks output', async () => {
  const {
    compileBlockIdentityPolicyGapClassifier,
    BLOCK_IDENTITY_POLICY_GAP_REASON_CODES,
  } = await loadModule();
  const packetLevel = compileBlockIdentityPolicyGapClassifier(baseInput({
    candidates: [baseCandidate({ createStableBlockIdentityClaimed: true })],
  }));
  const topLevel = compileBlockIdentityPolicyGapClassifier(baseInput({
    createBlockIdentityClaimed: true,
    candidates: [baseCandidate()],
  }));

  assert.equal(packetLevel.outputDecision, 'BLOCK_IDENTITY_POLICY_GAP_CLASSIFIER_BLOCKED');
  assert.equal(topLevel.outputDecision, 'BLOCK_IDENTITY_POLICY_GAP_CLASSIFIER_BLOCKED');
  assert.equal(
    packetLevel.blockedReasons.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.FORBIDDEN_BLOCK_IDENTITY_CREATION_CLAIM,
    ),
    true,
  );
  assert.equal(
    topLevel.blockedReasons.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.FORBIDDEN_BLOCK_IDENTITY_CREATION_CLAIM,
    ),
    true,
  );
});

test('explicit ApplyTxn permission claim blocks output', async () => {
  const {
    compileBlockIdentityPolicyGapClassifier,
    BLOCK_IDENTITY_POLICY_GAP_REASON_CODES,
  } = await loadModule();
  const result = compileBlockIdentityPolicyGapClassifier(baseInput({
    candidates: [baseCandidate({ applyTxnPermissionClaimed: true })],
  }));

  assert.equal(result.outputDecision, 'BLOCK_IDENTITY_POLICY_GAP_CLASSIFIER_BLOCKED');
  assert.equal(result.stage06AdmissionGranted, false);
  assert.equal(result.applyTxnPermissionGranted, false);
  assert.equal(
    result.blockedReasons.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.FORBIDDEN_APPLYTXN_PERMISSION_CLAIM,
    ),
    true,
  );
});

test('owner decision required packet is request not outcome', async () => {
  const {
    compileBlockIdentityPolicyGapClassifier,
    BLOCK_IDENTITY_POLICY_GAP_REASON_CODES,
  } = await loadModule();
  const result = compileBlockIdentityPolicyGapClassifier(baseInput({
    candidates: [baseCandidate({ externalBlockInstanceProof: 'instance' })],
  }));

  assert.equal(result.ownerDecisionRequiredPacket.packetIsRequestOnly, true);
  assert.equal(result.ownerDecisionRequiredPacket.ownerDecisionOutcomeClaimed, false);
  assert.equal(result.ownerDecisionOutcomeClaimed, false);
  assert.equal(
    result.ownerDecisionRequiredPacket.requestedDecisions.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.OWNER_DECISION_REQUIRED_FOR_PROJECT_TRUTH_POLICY,
    ),
    true,
  );
});

test('Stage06 blockers preview is not Stage06 admission', async () => {
  const { compileBlockIdentityPolicyGapClassifier } = await loadModule();
  const result = compileBlockIdentityPolicyGapClassifier(baseInput());

  assert.equal(result.stage06BlockersPreview.previewOnly, true);
  assert.equal(result.stage06BlockersPreview.stage06AdmissionGranted, false);
  assert.equal(result.stage06BlockersPreview.applyTxnPermissionGranted, false);
  assert.equal(result.stage06BlockersPreview.futureStage06Status, 'FUTURE_STAGE06_APPLYTXN_BLOCKED');
});

test('Stage06 blockers preview excludes advisory and review-only reasons', async () => {
  const {
    compileBlockIdentityPolicyGapClassifier,
    BLOCK_IDENTITY_POLICY_GAP_REASON_CODES,
  } = await loadModule();
  const defaultResult = compileBlockIdentityPolicyGapClassifier(baseInput());
  const advisoryResult = compileBlockIdentityPolicyGapClassifier(baseInput({
    candidates: [
      baseCandidate({
        externalBlockInstanceProof: 'external-instance-proof',
        blockLineageProof: 'lineage-proof',
        targetBlockRef: 'review-target',
        reviewAnchorHandleHash: 'packet-anchor',
        blockVersionHash: 'block-version',
      }),
    ],
  }));

  assert.equal(
    defaultResult.stage06BlockersPreview.blockerCodes.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.OWNER_DECISION_REQUIRED_FOR_PROJECT_TRUTH_POLICY,
    ),
    false,
  );
  assert.equal(
    advisoryResult.stage06BlockersPreview.blockerCodes.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.BLOCK_INSTANCE_PROOF_ADVISORY_ONLY,
    ),
    false,
  );
  assert.equal(
    advisoryResult.stage06BlockersPreview.blockerCodes.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.BLOCK_LINEAGE_PROOF_ADVISORY_ONLY,
    ),
    false,
  );
  assert.equal(
    advisoryResult.stage06BlockersPreview.blockerCodes.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.TARGET_BLOCK_REF_NOT_PROJECT_TRUTH,
    ),
    false,
  );
  assert.equal(
    advisoryResult.stage06BlockersPreview.blockerCodes.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.REVIEW_ANCHOR_HANDLE_NOT_PROJECT_TRUTH,
    ),
    false,
  );
  assert.equal(
    advisoryResult.stage06BlockersPreview.blockerCodes.includes(
      BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.OWNER_DECISION_REQUIRED_FOR_PROJECT_TRUTH_POLICY,
    ),
    true,
  );
});

test('missing changedBasenames blocks output and outside basename blocks output', async () => {
  const {
    compileBlockIdentityPolicyGapClassifier,
    BLOCK_IDENTITY_POLICY_GAP_REASON_CODES,
  } = await loadModule();
  const missing = compileBlockIdentityPolicyGapClassifier({ candidates: [baseCandidate()] });
  const outside = compileBlockIdentityPolicyGapClassifier({
    changedBasenames: [...allowedChangedBasenames(), 'package.json'],
    candidates: [baseCandidate()],
  });

  assert.equal(missing.outputDecision, 'BLOCK_IDENTITY_POLICY_GAP_CLASSIFIER_BLOCKED');
  assert.equal(
    missing.blockedReasons.includes(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE),
    true,
  );
  assert.equal(outside.outputDecision, 'BLOCK_IDENTITY_POLICY_GAP_CLASSIFIER_BLOCKED');
  assert.equal(
    outside.blockedReasons.includes(BLOCK_IDENTITY_POLICY_GAP_REASON_CODES.FORBIDDEN_BASENAME_CHANGE),
    true,
  );
});

test('module exposes zero write apply storage and identity acceptance flags', async () => {
  const { compileBlockIdentityPolicyGapClassifier } = await loadModule();
  const result = compileBlockIdentityPolicyGapClassifier(baseInput());

  assert.equal(result.projectWritePerformed, false);
  assert.equal(result.runtimeApplyPerformed, false);
  assert.equal(result.applyOpCreated, false);
  assert.equal(result.applyOpPerformed, false);
  assert.equal(result.applyTxnCreated, false);
  assert.equal(result.applyTxnPerformed, false);
  assert.equal(result.atomicWritePerformed, false);
  assert.equal(result.recoveryWritePerformed, false);
  assert.equal(result.storageMigrationPerformed, false);
  assert.equal(result.savedSceneFormatModified, false);
  assert.equal(result.projectStorageIdentityClaimed, false);
  assert.equal(result.persistedSceneIdClaimed, false);
  assert.equal(result.persistedBlockIdClaimed, false);
  assert.equal(result.blockIdentityCreated, false);
  assert.equal(result.policyAcceptedAsProjectTruth, false);
  assert.equal(result.stage06AdmissionGranted, false);
  assert.equal(result.applyTxnPermissionGranted, false);
});
