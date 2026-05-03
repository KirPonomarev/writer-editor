const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'localIdentityEvidenceAdmissionKernel.mjs';
const TEST_BASENAME = 'localIdentityEvidenceAdmissionKernel.contract.test.js';
const TASK_BASENAME = 'STAGE05D_LOCAL_IDENTITY_EVIDENCE_ADMISSION_KERNEL_001.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function allowedChangedBasenames() {
  return [MODULE_BASENAME, TEST_BASENAME, TASK_BASENAME];
}

function basePacket(overrides = {}) {
  return {
    packetId: 'pkt-001',
    projectIdEvidence: 'project-id-001',
    manifestProjectIdEvidence: 'manifest-project-id-001',
    localSceneIdEvidence: 'local-scene-id-001',
    localSceneEvidenceHash: 'local-scene-hash-001',
    reviewSceneRefEvidence: 'review-scene-ref-001',
    targetBlockRefEvidence: 'target-block-ref-001',
    optionalBlockInstanceIdProof: 'block-instance-proof-001',
    optionalBlockLineageIdProof: 'block-lineage-proof-001',
    blockVersionHashEvidence: 'block-version-hash-001',
    currentBlockVersionHash: 'block-version-hash-001',
    sourceAnchorHandleHash: '',
    reviewIdentityPreconditionEvidenceHash: 'review-precondition-hash-001',
    structuralChangeKind: 'NONE',
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    changedBasenames: allowedChangedBasenames(),
    packets: [basePacket()],
    ...overrides,
  };
}

function firstAdmission(result) {
  return result.admissions[0];
}

test('stage05d module stays pure deterministic in-memory compiler', () => {
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

test('same input returns same identity evidence packet and deterministic hash', async () => {
  const { compileLocalIdentityEvidenceAdmissionKernel } = await loadModule();
  const first = compileLocalIdentityEvidenceAdmissionKernel(baseInput());
  const second = compileLocalIdentityEvidenceAdmissionKernel(baseInput());

  assert.deepEqual(first, second);
  assert.equal(first.canonicalHash, second.canonicalHash);
  assert.equal(first.admissions.length, 1);
  assert.equal(firstAdmission(first).identityEvidenceHash, firstAdmission(second).identityEvidenceHash);
});

test('projectId without manifest evidence blocks readiness', async () => {
  const {
    compileLocalIdentityEvidenceAdmissionKernel,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES,
    LOCAL_IDENTITY_EVIDENCE_READINESS_CLASSES,
  } = await loadModule();
  const result = compileLocalIdentityEvidenceAdmissionKernel(baseInput({
    packets: [basePacket({ manifestProjectIdEvidence: '' })],
  }));

  assert.equal(result.futureApplyTxnReadiness, LOCAL_IDENTITY_EVIDENCE_READINESS_CLASSES.FUTURE_APPLYTXN_READINESS_ZERO);
  assert.equal(
    firstAdmission(result).reasonCodes.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.MISSING_MANIFEST_PROJECT_ID_EVIDENCE,
    ),
    true,
  );
});

test('localSceneId without scene evidence blocks readiness', async () => {
  const {
    compileLocalIdentityEvidenceAdmissionKernel,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES,
  } = await loadModule();
  const result = compileLocalIdentityEvidenceAdmissionKernel(baseInput({
    packets: [basePacket({ localSceneEvidenceHash: '' })],
  }));

  assert.equal(result.futureApplyTxnReadiness, 'FUTURE_APPLYTXN_READINESS_ZERO');
  assert.equal(
    firstAdmission(result).reasonCodes.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.MISSING_LOCAL_SCENE_ID_EVIDENCE,
    ),
    true,
  );
});

test('reviewSceneRef cannot count as project scene truth', async () => {
  const {
    compileLocalIdentityEvidenceAdmissionKernel,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES,
    LOCAL_IDENTITY_EVIDENCE_CLASSES,
  } = await loadModule();
  const result = compileLocalIdentityEvidenceAdmissionKernel(baseInput({
    packets: [basePacket({ localSceneIdEvidence: '', localSceneEvidenceHash: '', reviewSceneRefEvidence: 'review-only' })],
  }));

  assert.equal(firstAdmission(result).identityEvidenceClasses.includes(LOCAL_IDENTITY_EVIDENCE_CLASSES.REVIEW_SCENE_REF_ONLY), true);
  assert.equal(
    firstAdmission(result).reasonCodes.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.REVIEW_SCENE_REF_NOT_PROJECT_SCENE_TRUTH,
    ),
    true,
  );
});

test('missing blockVersionHash blocks readiness', async () => {
  const {
    compileLocalIdentityEvidenceAdmissionKernel,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES,
  } = await loadModule();
  const result = compileLocalIdentityEvidenceAdmissionKernel(baseInput({
    packets: [basePacket({ blockVersionHashEvidence: '' })],
  }));

  assert.equal(firstAdmission(result).futureApplyTxnReadiness, 'FUTURE_APPLYTXN_READINESS_ZERO');
  assert.equal(
    firstAdmission(result).reasonCodes.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.MISSING_BLOCK_VERSION_HASH_EVIDENCE,
    ),
    true,
  );
});

test('targetBlockRef without block instance proof is review ref only', async () => {
  const {
    compileLocalIdentityEvidenceAdmissionKernel,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES,
  } = await loadModule();
  const result = compileLocalIdentityEvidenceAdmissionKernel(baseInput({
    packets: [basePacket({ optionalBlockInstanceIdProof: '' })],
  }));

  assert.equal(firstAdmission(result).targetBlockRefEvidence, 'target-block-ref-001');
  assert.equal(
    firstAdmission(result).reasonCodes.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.TARGET_BLOCK_REF_NOT_PROJECT_TRUTH,
    ),
    true,
  );
});

test('blockInstance unproven blocks future applytxn readiness', async () => {
  const {
    compileLocalIdentityEvidenceAdmissionKernel,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES,
  } = await loadModule();
  const result = compileLocalIdentityEvidenceAdmissionKernel(baseInput({
    packets: [basePacket({ optionalBlockInstanceIdProof: '' })],
  }));

  assert.equal(firstAdmission(result).ownerDecisionRequired, true);
  assert.equal(firstAdmission(result).futureApplyTxnReadiness, 'FUTURE_APPLYTXN_READINESS_ZERO');
  assert.equal(
    firstAdmission(result).ownerDecisionReasonCodes.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.BLOCK_INSTANCE_ID_UNPROVEN,
    ),
    true,
  );
});

test('blockLineage unproven blocks structural readiness', async () => {
  const {
    compileLocalIdentityEvidenceAdmissionKernel,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES,
  } = await loadModule();
  const result = compileLocalIdentityEvidenceAdmissionKernel(baseInput({
    packets: [basePacket({ optionalBlockLineageIdProof: '', structuralChangeKind: 'MOVE' })],
  }));

  assert.equal(firstAdmission(result).ownerDecisionRequired, true);
  assert.equal(firstAdmission(result).futureApplyTxnReadiness, 'FUTURE_APPLYTXN_READINESS_ZERO');
  assert.equal(
    firstAdmission(result).reasonCodes.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.STRUCTURAL_IDENTITY_CHANGE_MANUAL_ONLY,
    ),
    true,
  );
  assert.equal(
    firstAdmission(result).ownerDecisionReasonCodes.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.BLOCK_LINEAGE_ID_UNPROVEN,
    ),
    true,
  );
});

test('sourceAnchorHandleHash cannot promote to project truth', async () => {
  const {
    compileLocalIdentityEvidenceAdmissionKernel,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES,
    LOCAL_IDENTITY_EVIDENCE_CLASSES,
  } = await loadModule();
  const result = compileLocalIdentityEvidenceAdmissionKernel(baseInput({
    packets: [basePacket({ sourceAnchorHandleHash: 'stage05a-anchor-handle-hash' })],
  }));

  assert.equal(firstAdmission(result).identityEvidenceClasses.includes(LOCAL_IDENTITY_EVIDENCE_CLASSES.PACKET_LOCAL_ONLY), true);
  assert.equal(
    firstAdmission(result).reasonCodes.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.SOURCE_ANCHOR_HANDLE_PACKET_LOCAL_ONLY,
    ),
    true,
  );
  assert.equal(result.projectStorageIdentityClaimed, false);
});

test('explicit identity promotion claim blocks output', async () => {
  const {
    compileLocalIdentityEvidenceAdmissionKernel,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES,
  } = await loadModule();
  const packetLevel = compileLocalIdentityEvidenceAdmissionKernel(baseInput({
    packets: [basePacket({ promoteIdentityEvidenceToProjectTruth: true })],
  }));
  const topLevel = compileLocalIdentityEvidenceAdmissionKernel(baseInput({
    promoteAnchorHandleToProjectTruthClaimed: true,
    packets: [basePacket()],
  }));

  assert.equal(packetLevel.outputDecision, 'LOCAL_IDENTITY_EVIDENCE_ADMISSION_BLOCKED');
  assert.equal(topLevel.outputDecision, 'LOCAL_IDENTITY_EVIDENCE_ADMISSION_BLOCKED');
  assert.equal(
    packetLevel.blockedReasons.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.FORBIDDEN_IDENTITY_PROMOTION_CLAIM,
    ),
    true,
  );
  assert.equal(
    topLevel.blockedReasons.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.FORBIDDEN_IDENTITY_PROMOTION_CLAIM,
    ),
    true,
  );
});

test('structural move split merge is manual only', async () => {
  const {
    compileLocalIdentityEvidenceAdmissionKernel,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES,
  } = await loadModule();

  for (const kind of ['MOVE', 'SPLIT', 'MERGE']) {
    const result = compileLocalIdentityEvidenceAdmissionKernel(baseInput({
      packets: [basePacket({ structuralChangeKind: kind })],
    }));
    assert.equal(firstAdmission(result).futureApplyTxnReadiness, 'FUTURE_APPLYTXN_READINESS_ZERO', kind);
    assert.equal(
      firstAdmission(result).reasonCodes.includes(
        LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.STRUCTURAL_IDENTITY_CHANGE_MANUAL_ONLY,
      ),
      true,
      kind,
    );
  }
});

test('stale identity evidence zero readiness', async () => {
  const {
    compileLocalIdentityEvidenceAdmissionKernel,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES,
  } = await loadModule();
  const result = compileLocalIdentityEvidenceAdmissionKernel(baseInput({
    packets: [basePacket({
      blockVersionHashEvidence: 'block-version-old',
      currentBlockVersionHash: 'block-version-new',
    })],
  }));

  assert.equal(firstAdmission(result).futureApplyTxnReadiness, 'FUTURE_APPLYTXN_READINESS_ZERO');
  assert.equal(
    firstAdmission(result).reasonCodes.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.STALE_IDENTITY_EVIDENCE_ZERO_READINESS,
    ),
    true,
  );
});

test('implicit stable block id claim requires owner decision', async () => {
  const {
    compileLocalIdentityEvidenceAdmissionKernel,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES,
  } = await loadModule();
  const result = compileLocalIdentityEvidenceAdmissionKernel(baseInput({
    packets: [basePacket({ implicitStableBlockIdClaimed: true })],
  }));

  assert.equal(result.outputDecision, 'LOCAL_IDENTITY_EVIDENCE_ADMISSION_BLOCKED');
  assert.equal(firstAdmission(result).ownerDecisionRequired, true);
  assert.equal(
    result.blockedReasons.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.IMPLICIT_STABLE_BLOCK_ID_FOUND_REQUIRES_OWNER_DECISION,
    ),
    true,
  );
});

test('outside changed basename blocks output', async () => {
  const {
    compileLocalIdentityEvidenceAdmissionKernel,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES,
  } = await loadModule();
  const missing = compileLocalIdentityEvidenceAdmissionKernel({ packets: [basePacket()] });
  const outside = compileLocalIdentityEvidenceAdmissionKernel({
    changedBasenames: [...allowedChangedBasenames(), 'package.json'],
    packets: [basePacket()],
  });

  assert.equal(missing.outputDecision, 'LOCAL_IDENTITY_EVIDENCE_ADMISSION_BLOCKED');
  assert.equal(
    missing.blockedReasons.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE,
    ),
    true,
  );
  assert.equal(outside.outputDecision, 'LOCAL_IDENTITY_EVIDENCE_ADMISSION_BLOCKED');
  assert.equal(
    outside.blockedReasons.includes(LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.FORBIDDEN_BASENAME_CHANGE),
    true,
  );
});

test('module exposes zero write apply storage and identity creation flags', async () => {
  const { compileLocalIdentityEvidenceAdmissionKernel } = await loadModule();
  const result = compileLocalIdentityEvidenceAdmissionKernel(baseInput());

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
});

test('owner decision packet and ReviewBOM expose identity gaps', async () => {
  const {
    compileLocalIdentityEvidenceAdmissionKernel,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES,
  } = await loadModule();
  const result = compileLocalIdentityEvidenceAdmissionKernel(baseInput({
    packets: [basePacket({ optionalBlockInstanceIdProof: '', optionalBlockLineageIdProof: '' })],
  }));

  assert.equal(result.ownerDecisionPacket.ownerDecisionRequired, true);
  assert.equal(result.reviewBom.gapCount > 0, true);
  assert.equal(
    result.ownerDecisionPacket.requestedDecisions.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.BLOCK_INSTANCE_ID_UNPROVEN,
    ),
    true,
  );
  assert.equal(
    result.ownerDecisionPacket.requestedDecisions.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.BLOCK_LINEAGE_ID_UNPROVEN,
    ),
    true,
  );
  assert.equal(result.reviewBom.ownerDecisionGapCount, 2);
});

test('missing evidence gap does not become owner identity policy decision', async () => {
  const {
    compileLocalIdentityEvidenceAdmissionKernel,
    LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES,
  } = await loadModule();
  const result = compileLocalIdentityEvidenceAdmissionKernel(baseInput({
    packets: [basePacket({ manifestProjectIdEvidence: '' })],
  }));

  assert.equal(firstAdmission(result).ownerDecisionRequired, false);
  assert.equal(result.ownerDecisionPacket.ownerDecisionRequired, false);
  assert.equal(
    result.ownerDecisionPacket.requestedDecisions.includes(
      LOCAL_IDENTITY_EVIDENCE_ADMISSION_REASON_CODES.MISSING_MANIFEST_PROJECT_ID_EVIDENCE,
    ),
    false,
  );
});
