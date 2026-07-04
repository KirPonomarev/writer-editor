const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const STATUS_DIR = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS');
const GATE_STATUS_PATH = path.join(STATUS_DIR, 'REVIEW_BRIDGE_FIRST_USEFUL_RELEASE_GATE_001_STATUS.json');
const REVIEW_MUTATE_CONTRACT_PATH = path.join(
  REPO_ROOT,
  'test',
  'contracts',
  'revision-bridge-review-mutate-port.contract.test.js',
);
const DOCX_REVIEW_PREVIEW_CONTRACT_PATH = path.join(
  REPO_ROOT,
  'test',
  'contracts',
  'revision-bridge-docx-review-preview-session-command-surface.contract.test.js',
);
const DOCX_REVIEW_LOCAL_FILE_CONTRACT_PATH = path.join(
  REPO_ROOT,
  'test',
  'contracts',
  'revision-bridge-docx-review-local-file-entry-command-surface.contract.test.js',
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readStatus(basename) {
  return readJson(path.join(STATUS_DIR, basename));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertNoPendingActiveArtifact(gate) {
  for (const artifact of gate.referencedArtifacts) {
    assert.notEqual(
      artifact.status,
      'implemented_verified_pending_delivery',
      `${artifact.artifact} must not be active gate truth while pending delivery`,
    );
  }
}

function tailOutput(text, lineCount = 40) {
  return String(text || '')
    .trim()
    .split('\n')
    .slice(-lineCount)
    .join('\n');
}

test('Review Bridge first useful release gate binds only delivered active proof artifacts', () => {
  const gate = readJson(GATE_STATUS_PATH);

  assert.equal(gate.taskId, 'REVIEW_BRIDGE_FIRST_USEFUL_RELEASE_GATE_001');
  assert.equal(gate.type, 'review_bridge_first_useful_release_gate');
  assert.ok(
    ['implemented_local_verified_pending_delivery', 'delivered_merged_verified'].includes(gate.status),
    `unexpected gate status ${gate.status}`,
  );
  assert.equal(gate.featureExpansion, false);
  assert.equal(gate.scope.desktopFirst, true);
  assert.equal(gate.scope.offlineFirst, true);
  assert.equal(gate.scope.importExportMvpScopeExpanded, false);
  assert.equal(gate.scope.uiRedesign, false);
  assert.equal(gate.scope.runtimeProductionCodeChanged, false);
  assert.equal(gate.scope.newDependenciesAdded, false);
  assert.equal(gate.scope.releaseReadinessClaimed, false);
  assert.equal(gate.scope.y9Opened, false);

  const byArtifact = new Map(gate.referencedArtifacts.map((entry) => [entry.artifact, entry]));
  const expectedStatuses = new Map([
    ['IMPORT_EXPORT_PRODUCT_CLOSEOUT_BINDING_001_STATUS.json', 'FEATURE_CLOSED_FOR_MVP_SCOPE'],
    ['REVIEW_BRIDGE_CONTROLLED_MULTI_EXACT_APPLY_001_R2_STATUS_V1.json', 'delivered_merged_verified'],
    ['REVIEW_BRIDGE_APPLY_LANE_PRODUCT_CLOSEOUT_REBIND_001_STATUS.json', 'delivered_merged_verified'],
    ['REVIEW_BRIDGE_LOCAL_PACKET_PRODUCT_ENTRY_001_STATUS.json', 'delivered_merged_verified'],
    ['REVIEW_BRIDGE_LOCAL_PACKET_E2E_PRODUCT_PROOF_001_STATUS.json', 'delivered_merged_verified'],
    ['REVIEW_BRIDGE_DOCX_PREFLIGHT_001_STATUS.json', 'delivered_merged_verified'],
    ['REVIEW_BRIDGE_DOCX_PREVIEW_SESSION_ACTIVATION_001_STATUS.json', 'delivered_merged_verified'],
    ['REVIEW_BRIDGE_DOCX_REVIEW_LOCAL_FILE_ENTRY_001_STATUS.json', 'delivered_merged_verified'],
    ['REVIEW_BRIDGE_DOCX_COMMENT_ONLY_PRODUCT_PROOF_001_STATUS.json', 'delivered_merged_verified'],
  ]);

  assert.deepEqual([...byArtifact.keys()].sort(), [...expectedStatuses.keys()].sort());
  assertNoPendingActiveArtifact(gate);

  for (const [artifact, expectedStatus] of expectedStatuses) {
    const gateEntry = byArtifact.get(artifact);
    assert.equal(gateEntry.status, expectedStatus, `${artifact} gate entry status`);
    const source = readStatus(artifact);
    assert.equal(source.status, expectedStatus, `${artifact} source status`);
  }

  const superseded = gate.supersededPendingArtifacts.find(
    (entry) => entry.artifact === 'REVIEW_BRIDGE_SINGLE_EXACT_TEXT_SAFE_APPLY_ENABLEMENT_001_R2_STATUS_V1.json',
  );
  assert.ok(superseded, 'historical pending single-apply artifact must be explicitly superseded');
  assert.equal(superseded.status, 'implemented_verified_pending_delivery');
  assert.equal(superseded.supersededBy, 'REVIEW_BRIDGE_CONTROLLED_MULTI_EXACT_APPLY_001_R2_STATUS_V1.json');
});

test('Review Bridge first useful release gate keeps claims bounded to feature proof', () => {
  const gate = readJson(GATE_STATUS_PATH);

  assert.match(gate.mainClaim, /Local JSON review packet/u);
  assert.match(gate.mainClaim, /one exact text change/u);
  assert.match(gate.mainClaim, /safe writer/u);
  assert.match(gate.mainClaim, /receipt and recovery evidence/u);
  assert.ok(gate.additionalProvenSurfaces.some((claim) => /DOCX comments-only review preview/u.test(claim)));
  assert.ok(gate.additionalProvenSurfaces.some((claim) => /no apply authority/u.test(claim)));

  const positiveText = gate.positiveClaims.join('\n');
  assert.match(positiveText, /local JSON review packet/iu);
  assert.match(positiveText, /safe writer/u);
  assert.match(positiveText, /DOCX comments-only review preview/u);
  assert.doesNotMatch(positiveText, /release readiness|packaged readiness|cross-platform readiness/u);
  assert.doesNotMatch(positiveText, /full DOCX review import|DOCX tracked-change apply|exact apply from DOCX/u);
  assert.doesNotMatch(positiveText, /project truth writes|project truth write/u);

  const nonClaimText = gate.nonClaims.join('\n');
  for (const phrase of [
    'No full review import automation is claimed.',
    'No full DOCX review import is claimed.',
    'No DOCX tracked-change apply is claimed.',
    'No exact apply from DOCX is claimed.',
    'No structural auto-apply is claimed.',
    'No comment auto-apply is claimed.',
    'No cross-scene batch atomicity is claimed.',
    'No multi-file transaction truth is claimed.',
    'No import/export MVP scope expansion is claimed.',
    'No Word layout parity or full DOCX fidelity is claimed.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  const layerText = gate.layerDecisions.join('\n');
  assert.match(layerText, /Import layer can activate a Review session but cannot mutate manuscript truth/u);
  assert.match(layerText, /Receipt and recovery belong to apply/u);
  assert.match(layerText, /Review surface is UI\/session visibility only/u);
  assert.match(layerText, /DOCX remains external review evidence transport/u);
});

test('Review Bridge first useful release gate binds the local JSON packet product smoke', () => {
  const gate = readJson(GATE_STATUS_PATH);
  const source = readText(REVIEW_MUTATE_CONTRACT_PATH);

  assert.equal(
    gate.productSmokeProof.sourceTest,
    'revision-bridge-review-mutate-port.contract.test.js',
  );
  assert.equal(
    gate.productSmokeProof.primaryTestName,
    'review mutate port contract: local packet e2e exact apply writes only after local import',
  );
  assert.equal(gate.productSmokeProof.assertsImportReceiptAbsent, true);
  assert.equal(gate.productSmokeProof.assertsApplyReceiptPresent, true);
  assert.equal(gate.productSmokeProof.assertsRecoveryEvidenceReadable, true);
  assert.equal(gate.productSmokeProof.assertsRecoverySnapshotHashMatchesInput, true);
  assert.equal(gate.productSmokeProof.assertsManuscriptMutationAfterApplyOnly, true);

  assert.match(source, /review mutate port contract: local packet e2e exact apply writes only after local import/u);
  assert.match(source, /Object\.prototype\.hasOwnProperty\.call\(importedSurface, 'receipt'\), false/u);
  assert.match(source, /value\.receipt\.recovery\.snapshotCreated, true/u);
  assert.match(source, /value\.receipt\.recovery\.snapshotReadable, true/u);
  assert.match(source, /value\.receipt\.recovery\.snapshotHashMatchesInput, true/u);
  assert.match(source, /fs\.readFileSync\(value\.receipt\.recovery\.snapshotPath, 'utf8'\), 'Alpha beta gamma\.'/u);
});

test('Review Bridge first useful release gate fails closed when live review-bridge smoke contracts are red', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--test',
      REVIEW_MUTATE_CONTRACT_PATH,
      DOCX_REVIEW_PREVIEW_CONTRACT_PATH,
      DOCX_REVIEW_LOCAL_FILE_CONTRACT_PATH,
    ],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    },
  );

  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(
    result.status,
    0,
    [
      `live smoke exit status: ${result.status}`,
      tailOutput(result.stdout),
      tailOutput(result.stderr),
    ].filter(Boolean).join('\n'),
  );
});

test('Review Bridge first useful release gate keeps DOCX comments-only as preview boundary', () => {
  const gate = readJson(GATE_STATUS_PATH);
  const docxProof = readStatus('REVIEW_BRIDGE_DOCX_COMMENT_ONLY_PRODUCT_PROOF_001_STATUS.json');

  assert.equal(gate.docxBoundaryProof.commentsOnlyPreview, true);
  assert.equal(gate.docxBoundaryProof.manualCommentPlacements, true);
  assert.equal(gate.docxBoundaryProof.textChangesFromDocxTrackedChanges, false);
  assert.equal(gate.docxBoundaryProof.applyOpsCreated, false);
  assert.equal(gate.docxBoundaryProof.receiptCreated, false);
  assert.equal(gate.docxBoundaryProof.recoveryCreated, false);
  assert.equal(gate.docxBoundaryProof.projectTruthMutated, false);

  assert.equal(docxProof.status, 'delivered_merged_verified');
  assert.equal(docxProof.scope.projectTruthWrites, false);
  assert.equal(docxProof.scope.manuscriptWrites, false);
  assert.equal(docxProof.scope.receiptOrRecoveryCreated, false);
  assert.equal(docxProof.proofPoints.commentThreadsReachReviewSurface, true);
  assert.equal(docxProof.proofPoints.manualCommentPlacementsReachReviewSurface, true);
  assert.equal(docxProof.proofPoints.textChangesFromDocxTrackedChanges, false);
  assert.equal(docxProof.proofPoints.applyOpsCreated, false);
  assert.equal(docxProof.proofPoints.receiptCreated, false);
  assert.equal(docxProof.proofPoints.recoveryCreated, false);
  assert.equal(docxProof.proofPoints.projectTruthMutated, false);
});
