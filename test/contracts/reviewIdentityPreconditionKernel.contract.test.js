const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'reviewIdentityPreconditionKernel.mjs';
const TASK_BASENAME = 'STAGE05C_REVIEW_IDENTITY_PRECONDITION_KERNEL_001.md';

async function loadModule() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function allowedChangedBasenames() {
  return [
    MODULE_BASENAME,
    'reviewIdentityPreconditionKernel.contract.test.js',
    TASK_BASENAME,
  ];
}

function basePacket(overrides = {}) {
  return {
    packetId: 'pkt-001',
    reviewSceneRef: 'scene-ref-001',
    targetBlockRef: 'block-ref-001',
    blockVersionHash: 'block-version-001',
    currentBlockVersionHash: 'block-version-001',
    projectIdEvidence: 'project-evidence-001',
    sourceAnchorHandleHash: 'anchor-handle-hash-001',
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

function firstPrecondition(input) {
  return input.preconditions[0];
}

test('stage05c module stays pure deterministic in-memory compiler', () => {
  const moduleText = fs.readFileSync(
    path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME),
    'utf8',
  );
  const forbidden = [
    /from\s+['"]node:fs['"]/u,
    /from\s+['"]node:child_process['"]/u,
    /from\s+['"]node:http['"]/u,
    /from\s+['"]node:https['"]/u,
    /from\s+['"]node:net['"]/u,
    /from\s+['"]electron['"]/u,
    /\bfetch\s*\(/u,
    /\bDate\.now\s*\(/u,
    /\bMath\.random\s*\(/u,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(moduleText), false, `forbidden pure pattern: ${pattern.source}`);
  }
});

test('same input returns same packet and deterministic hash', async () => {
  const { compileReviewIdentityPreconditionKernel } = await loadModule();
  const first = compileReviewIdentityPreconditionKernel(baseInput());
  const second = compileReviewIdentityPreconditionKernel(baseInput());

  assert.deepEqual(first, second);
  assert.equal(first.canonicalHash, second.canonicalHash);
  assert.equal(first.preconditions.length, 1);
  assert.equal(firstPrecondition(first).preconditionEvidenceHash, firstPrecondition(second).preconditionEvidenceHash);
});

test('different reviewSceneRef changes preconditionEvidenceHash', async () => {
  const { compileReviewIdentityPreconditionKernel } = await loadModule();
  const base = compileReviewIdentityPreconditionKernel(baseInput());
  const changed = compileReviewIdentityPreconditionKernel(baseInput({
    packets: [basePacket({ reviewSceneRef: 'scene-ref-002' })],
  }));

  assert.notEqual(
    firstPrecondition(base).preconditionEvidenceHash,
    firstPrecondition(changed).preconditionEvidenceHash,
  );
});

test('different targetBlockRef changes preconditionEvidenceHash', async () => {
  const { compileReviewIdentityPreconditionKernel } = await loadModule();
  const base = compileReviewIdentityPreconditionKernel(baseInput());
  const changed = compileReviewIdentityPreconditionKernel(baseInput({
    packets: [basePacket({ targetBlockRef: 'block-ref-002' })],
  }));

  assert.notEqual(
    firstPrecondition(base).preconditionEvidenceHash,
    firstPrecondition(changed).preconditionEvidenceHash,
  );
});

test('different blockVersionHash changes preconditionEvidenceHash', async () => {
  const { compileReviewIdentityPreconditionKernel } = await loadModule();
  const base = compileReviewIdentityPreconditionKernel(baseInput());
  const changed = compileReviewIdentityPreconditionKernel(baseInput({
    packets: [
      basePacket({
        blockVersionHash: 'block-version-002',
        currentBlockVersionHash: 'block-version-002',
      }),
    ],
  }));

  assert.notEqual(
    firstPrecondition(base).preconditionEvidenceHash,
    firstPrecondition(changed).preconditionEvidenceHash,
  );
});

test('missing projectIdEvidence forces zero precondition eligibility and manual only', async () => {
  const {
    compileReviewIdentityPreconditionKernel,
    REVIEW_IDENTITY_PRECONDITION_REASON_CODES,
  } = await loadModule();
  const result = compileReviewIdentityPreconditionKernel(baseInput({
    packets: [basePacket({ projectIdEvidence: '' })],
  }));

  assert.equal(firstPrecondition(result).preconditionEligibility, 0);
  assert.equal(firstPrecondition(result).automationPolicy, 'MANUAL_ONLY');
  assert.equal(
    firstPrecondition(result).manualReasonCodes.includes(
      REVIEW_IDENTITY_PRECONDITION_REASON_CODES.MISSING_PROJECT_ID_EVIDENCE_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY,
    ),
    true,
  );
});

test('missing reviewSceneRef forces zero precondition eligibility and manual only', async () => {
  const {
    compileReviewIdentityPreconditionKernel,
    REVIEW_IDENTITY_PRECONDITION_REASON_CODES,
  } = await loadModule();
  const result = compileReviewIdentityPreconditionKernel(baseInput({
    packets: [basePacket({ reviewSceneRef: '' })],
  }));

  assert.equal(firstPrecondition(result).preconditionEligibility, 0);
  assert.equal(firstPrecondition(result).automationPolicy, 'MANUAL_ONLY');
  assert.equal(
    firstPrecondition(result).manualReasonCodes.includes(
      REVIEW_IDENTITY_PRECONDITION_REASON_CODES.MISSING_REVIEW_SCENE_REF_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY,
    ),
    true,
  );
});

test('missing targetBlockRef forces zero precondition eligibility and manual only', async () => {
  const {
    compileReviewIdentityPreconditionKernel,
    REVIEW_IDENTITY_PRECONDITION_REASON_CODES,
  } = await loadModule();
  const result = compileReviewIdentityPreconditionKernel(baseInput({
    packets: [basePacket({ targetBlockRef: '' })],
  }));

  assert.equal(firstPrecondition(result).preconditionEligibility, 0);
  assert.equal(firstPrecondition(result).automationPolicy, 'MANUAL_ONLY');
  assert.equal(
    firstPrecondition(result).manualReasonCodes.includes(
      REVIEW_IDENTITY_PRECONDITION_REASON_CODES.MISSING_TARGET_BLOCK_REF_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY,
    ),
    true,
  );
});

test('missing blockVersionHash forces zero precondition eligibility and manual only', async () => {
  const {
    compileReviewIdentityPreconditionKernel,
    REVIEW_IDENTITY_PRECONDITION_REASON_CODES,
  } = await loadModule();
  const result = compileReviewIdentityPreconditionKernel(baseInput({
    packets: [basePacket({ blockVersionHash: '' })],
  }));

  assert.equal(firstPrecondition(result).preconditionEligibility, 0);
  assert.equal(firstPrecondition(result).automationPolicy, 'MANUAL_ONLY');
  assert.equal(
    firstPrecondition(result).manualReasonCodes.includes(
      REVIEW_IDENTITY_PRECONDITION_REASON_CODES.MISSING_BLOCK_VERSION_HASH_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY,
    ),
    true,
  );
});

test('missing sourceAnchorHandleHash forces zero precondition eligibility and manual only', async () => {
  const {
    compileReviewIdentityPreconditionKernel,
    REVIEW_IDENTITY_PRECONDITION_REASON_CODES,
  } = await loadModule();
  const result = compileReviewIdentityPreconditionKernel(baseInput({
    packets: [basePacket({ sourceAnchorHandleHash: '' })],
  }));

  assert.equal(firstPrecondition(result).preconditionEligibility, 0);
  assert.equal(firstPrecondition(result).automationPolicy, 'MANUAL_ONLY');
  assert.equal(
    firstPrecondition(result).manualReasonCodes.includes(
      REVIEW_IDENTITY_PRECONDITION_REASON_CODES.MISSING_SOURCE_ANCHOR_HANDLE_HASH_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY,
    ),
    true,
  );
});

test('stale mismatched blockVersionHash forces zero precondition eligibility and manual only', async () => {
  const {
    compileReviewIdentityPreconditionKernel,
    REVIEW_IDENTITY_PRECONDITION_REASON_CODES,
  } = await loadModule();
  const result = compileReviewIdentityPreconditionKernel(baseInput({
    packets: [
      basePacket({
        blockVersionHash: 'block-version-expected',
        currentBlockVersionHash: 'block-version-current',
      }),
    ],
  }));

  assert.equal(firstPrecondition(result).preconditionEligibility, 0);
  assert.equal(firstPrecondition(result).automationPolicy, 'MANUAL_ONLY');
  assert.equal(
    firstPrecondition(result).manualReasonCodes.includes(
      REVIEW_IDENTITY_PRECONDITION_REASON_CODES.STALE_BLOCK_VERSION_HASH_MANUAL_ONLY_ZERO_PRECONDITION_ELIGIBILITY,
    ),
    true,
  );
});

test('duplicate targetBlockRef becomes ReviewBOM anomaly and packets are not dropped', async () => {
  const {
    compileReviewIdentityPreconditionKernel,
    REVIEW_IDENTITY_PRECONDITION_REASON_CODES,
  } = await loadModule();
  const result = compileReviewIdentityPreconditionKernel(baseInput({
    packets: [
      basePacket({ packetId: 'pkt-a', targetBlockRef: 'dup-ref-1' }),
      basePacket({ packetId: 'pkt-b', targetBlockRef: 'dup-ref-1' }),
    ],
  }));

  assert.equal(result.preconditions.length, 2);
  assert.equal(result.reviewBom.preconditionCount, 2);
  assert.equal(
    result.anomalies.some(
      (entry) => entry.anomalyCode === REVIEW_IDENTITY_PRECONDITION_REASON_CODES.DUPLICATE_TARGET_BLOCK_REF_REVIEW_BOM_ANOMALY,
    ),
    true,
  );
});

test('sourceAnchorHandleHash may be referenced but not promoted to project truth', async () => {
  const { compileReviewIdentityPreconditionKernel } = await loadModule();
  const result = compileReviewIdentityPreconditionKernel(baseInput({
    packets: [basePacket({ sourceAnchorHandleHash: 'anchor-handle-hash-stage05a' })],
  }));

  assert.equal(firstPrecondition(result).preconditionEligibility, 1);
  assert.equal(firstPrecondition(result).automationPolicy, 'AUTO_ELIGIBLE');
  assert.equal(firstPrecondition(result).sourceAnchorHandleHash, 'anchor-handle-hash-stage05a');
  assert.equal(result.projectWritePerformed, false);
  assert.equal(result.persistedSceneIdClaimed, false);
  assert.equal(result.persistedBlockIdClaimed, false);
});

test('promotion request blocks output with explicit reason', async () => {
  const {
    compileReviewIdentityPreconditionKernel,
    REVIEW_IDENTITY_PRECONDITION_REASON_CODES,
  } = await loadModule();
  const result = compileReviewIdentityPreconditionKernel(baseInput({
    packets: [basePacket({ promoteAnchorHandleToProjectTruthRequested: true })],
  }));

  assert.equal(result.outputDecision, 'REVIEW_IDENTITY_PRECONDITION_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(
      REVIEW_IDENTITY_PRECONDITION_REASON_CODES.FORBIDDEN_STAGE05A_HANDLE_PROMOTION_TO_PROJECT_TRUTH,
    ),
    true,
  );
});

test('promotion claim blocks output with explicit reason', async () => {
  const {
    compileReviewIdentityPreconditionKernel,
    REVIEW_IDENTITY_PRECONDITION_REASON_CODES,
  } = await loadModule();
  const result = compileReviewIdentityPreconditionKernel(baseInput({
    packets: [basePacket({ promoteAnchorHandleToProjectTruthClaimed: true })],
  }));

  assert.equal(result.outputDecision, 'REVIEW_IDENTITY_PRECONDITION_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(
      REVIEW_IDENTITY_PRECONDITION_REASON_CODES.FORBIDDEN_STAGE05A_HANDLE_PROMOTION_TO_PROJECT_TRUTH,
    ),
    true,
  );
});

test('top-level promotion request blocks output with explicit reason', async () => {
  const {
    compileReviewIdentityPreconditionKernel,
    REVIEW_IDENTITY_PRECONDITION_REASON_CODES,
  } = await loadModule();
  const result = compileReviewIdentityPreconditionKernel(baseInput({
    promoteAnchorHandleToProjectTruthRequested: true,
    packets: [basePacket()],
  }));

  assert.equal(result.outputDecision, 'REVIEW_IDENTITY_PRECONDITION_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(
      REVIEW_IDENTITY_PRECONDITION_REASON_CODES.FORBIDDEN_STAGE05A_HANDLE_PROMOTION_TO_PROJECT_TRUTH,
    ),
    true,
  );
});

test('top-level promotion claim blocks output with explicit reason', async () => {
  const {
    compileReviewIdentityPreconditionKernel,
    REVIEW_IDENTITY_PRECONDITION_REASON_CODES,
  } = await loadModule();
  const result = compileReviewIdentityPreconditionKernel(baseInput({
    promoteAnchorHandleToProjectTruthClaimed: true,
    packets: [basePacket()],
  }));

  assert.equal(result.outputDecision, 'REVIEW_IDENTITY_PRECONDITION_BLOCKED');
  assert.equal(
    result.blockedReasons.includes(
      REVIEW_IDENTITY_PRECONDITION_REASON_CODES.FORBIDDEN_STAGE05A_HANDLE_PROMOTION_TO_PROJECT_TRUTH,
    ),
    true,
  );
});

test('structural move split merge is manual only', async () => {
  const {
    compileReviewIdentityPreconditionKernel,
    REVIEW_IDENTITY_PRECONDITION_REASON_CODES,
  } = await loadModule();
  const structuralKinds = ['MOVE', 'SPLIT', 'MERGE'];

  for (const kind of structuralKinds) {
    const result = compileReviewIdentityPreconditionKernel(baseInput({
      packets: [basePacket({ structuralChangeKind: kind })],
    }));
    assert.equal(firstPrecondition(result).preconditionEligibility, 0, kind);
    assert.equal(firstPrecondition(result).automationPolicy, 'MANUAL_ONLY', kind);
    assert.equal(
      firstPrecondition(result).manualReasonCodes.includes(
        REVIEW_IDENTITY_PRECONDITION_REASON_CODES.STRUCTURAL_MOVE_SPLIT_MERGE_MANUAL_ONLY,
      ),
      true,
      kind,
    );
  }
});

test('missing changedBasenames blocks output and outside allowlist blocks output', async () => {
  const {
    compileReviewIdentityPreconditionKernel,
    REVIEW_IDENTITY_PRECONDITION_REASON_CODES,
  } = await loadModule();
  const missing = compileReviewIdentityPreconditionKernel({
    packets: [basePacket()],
  });
  assert.equal(missing.outputDecision, 'REVIEW_IDENTITY_PRECONDITION_BLOCKED');
  assert.equal(
    missing.blockedReasons.includes(
      REVIEW_IDENTITY_PRECONDITION_REASON_CODES.MISSING_CHANGED_BASENAMES_EVIDENCE,
    ),
    true,
  );

  const outside = compileReviewIdentityPreconditionKernel({
    changedBasenames: [...allowedChangedBasenames(), 'package.json'],
    packets: [basePacket()],
  });
  assert.equal(outside.outputDecision, 'REVIEW_IDENTITY_PRECONDITION_BLOCKED');
  assert.equal(
    outside.blockedReasons.includes(REVIEW_IDENTITY_PRECONDITION_REASON_CODES.FORBIDDEN_BASENAME_CHANGE),
    true,
  );
});

test('module exposes all required mutation and identity claim flags as false', async () => {
  const { compileReviewIdentityPreconditionKernel } = await loadModule();
  const result = compileReviewIdentityPreconditionKernel(baseInput());

  assert.equal(result.projectWritePerformed, false);
  assert.equal(result.applyOpCreated, false);
  assert.equal(result.applyOpPerformed, false);
  assert.equal(result.applyTxnCreated, false);
  assert.equal(result.applyTxnPerformed, false);
  assert.equal(result.savedSceneFormatModified, false);
  assert.equal(result.persistedSceneIdClaimed, false);
  assert.equal(result.persistedBlockIdClaimed, false);
});
