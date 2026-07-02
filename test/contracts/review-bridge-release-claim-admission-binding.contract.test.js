const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const STATUS_PATH = path.join(
  REPO_ROOT,
  'docs',
  'OPS',
  'STATUS',
  'REVIEW_BRIDGE_RELEASE_CLAIM_ADMISSION_BINDING_001_STATUS.json',
);
const CONTRACT_PATH = 'test/contracts/review-bridge-release-claim-admission-binding.contract.test.js';
const DOSSIER_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-dossier-binding.contract.test.js';
const ADMISSION_KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-admission-gate.contract.test.js';
const DOSSIER_KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-dossier-binding.contract.test.js';
const MODE_DECISION_TEST_PATH = 'test/contracts/revision-bridge-release-claim-decision-gate.contract.test.js';
const MODE_DECISION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-mode-decision-binding.contract.test.js';
const MODE_DECISION_BINDING_STATUS_PATH = 'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_MODE_DECISION_BINDING_001_STATUS.json';
const ATTESTATION_KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-attestation-gate.contract.test.js';
const ATTESTATION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-attestation-binding.contract.test.js';
const ATTESTATION_BINDING_STATUS_PATH = 'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_ATTESTATION_BINDING_001_STATUS.json';
const PACKET_KERNEL_TEST_PATH = 'test/contracts/revision-bridge-release-claim-packet-emit.contract.test.js';
const USER_FACING_BOUNDARY_TEST_PATH = 'test/contracts/revision-bridge-release-claim-user-facing-boundary-gate.contract.test.js';
const PUBLICATION_TEST_PATH = 'test/contracts/revision-bridge-release-claim-publication-gate.contract.test.js';
const EXECUTION_TEST_PATH = 'test/contracts/revision-bridge-release-claim-execution-gate.contract.test.js';
const STATUS_PATH_REL = 'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_ADMISSION_BINDING_001_STATUS.json';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const CONTEXT_PATH = 'docs/CONTEXT.md';
const HANDOFF_PATH = 'docs/HANDOFF.md';
const WORKLOG_PATH = 'docs/WORKLOG.md';
const ALLOWLIST = [
  MODULE_PATH,
  CONTRACT_PATH,
  DOSSIER_BINDING_TEST_PATH,
  ADMISSION_KERNEL_TEST_PATH,
  MODE_DECISION_BINDING_TEST_PATH,
  MODE_DECISION_BINDING_STATUS_PATH,
  MODE_DECISION_TEST_PATH,
  ATTESTATION_KERNEL_TEST_PATH,
  ATTESTATION_BINDING_TEST_PATH,
  ATTESTATION_BINDING_STATUS_PATH,
  PACKET_KERNEL_TEST_PATH,
  STATUS_PATH_REL,
  GOVERNANCE_APPROVALS_PATH,
  CONTEXT_PATH,
  HANDOFF_PATH,
  WORKLOG_PATH,
];

function readText(parts) {
  return fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function loadBridge() {
  return import(pathToFileURL(path.join(REPO_ROOT, MODULE_PATH)).href);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

function assertNoReleaseAdmissionOverclaims(text, label) {
  const forbidden = [
    /\brelease claim admission is (?:release-ready|ready|complete|published|available|supported)\b/iu,
    /\brelease admission is (?:release-ready|ready|complete|published|available|supported|proven)\b/iu,
    /\badmission accepted means release readiness\b/iu,
    /\badmission accepted proves release readiness\b/iu,
    /\brelease readiness is (?:available|supported|ready|complete|proven)\b/iu,
    /\buser-facing release is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease mode decision is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease execution is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease publication is (?:available|supported|ready|complete|proven)\b/iu,
    /\bWord support is (?:available|supported|ready|complete|proven)\b/iu,
    /\bGoogle Docs support is (?:available|supported|ready|complete|proven)\b/iu,
    /\bDOCX support is (?:available|supported|ready|complete|proven)\b/iu,
    /\bDOCX import is (?:available|supported|ready|complete|proven)\b/iu,
    /\bimport support is (?:available|supported|ready|complete|proven)\b/iu,
    /\bexport support is (?:available|supported|ready|complete|proven)\b/iu,
    /\broundtrip is (?:available|supported|ready|complete|proven)\b/iu,
    /\blayout parity is (?:available|supported|ready|complete|proven)\b/iu,
    /\bfull fidelity is (?:available|supported|ready|complete|proven)\b/iu,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(text), false, `${label} contains overclaim: ${pattern.source}`);
  }
}

function validFormatMatrix() {
  return {
    schemaVersion: 'revision-bridge.format-matrix.v1',
    matrixId: 'format-matrix-1',
    rows: [
      {
        rowId: 'word-text-exact',
        formatId: 'word',
        surface: ['textExact', 'commentAnchor'],
        requiredTests: ['rb12-word-text', 'rb12-word-comment'],
        goldenSetId: 'golden-word-v1',
      },
    ],
  };
}

function validGoldenSet() {
  return {
    schemaVersion: 'revision-bridge.golden-set.v1',
    goldenSetId: 'golden-word-v1',
    formatId: 'word',
    surface: ['textExact', 'commentAnchor'],
    requiredTests: ['rb12-golden-hash'],
    fixtures: [
      {
        fixtureId: 'fixture-word-main',
        digest: 'sha256:fixture-word-main',
      },
    ],
  };
}

function validClaim(bridge, goldenSet, overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.format-matrix-support-claim.v1',
    claimId: 'claim-1',
    matrixRowId: 'word-text-exact',
    claimScope: ['textExact', 'commentAnchor'],
    verifiedTests: ['rb12-word-text', 'rb12-word-comment', 'rb12-golden-hash'],
    goldenSetHash: bridge.createRevisionBridgeGoldenSetHash(goldenSet),
    ...overrides,
  };
}

function validDossierItem(bridge, overrides = {}) {
  const goldenSet = overrides.goldenSet || validGoldenSet();
  const claim = overrides.claim || validClaim(bridge, goldenSet);
  return {
    schemaVersion: 'revision-bridge.release-claim-dossier-item.v1',
    itemId: 'dossier-item-1',
    goldenSet,
    claim,
    ...overrides,
  };
}

function validDossier(bridge, overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.release-claim-dossier.v1',
    dossierId: 'release-claim-dossier-1',
    items: [validDossierItem(bridge)],
    ...overrides,
  };
}

function validDossierGateInput(bridge, overrides = {}) {
  return {
    formatMatrix: overrides.formatMatrix || validFormatMatrix(),
    dossier: overrides.dossier || validDossier(bridge),
  };
}

function validAdmission(overrides = {}) {
  return {
    schemaVersion: 'revision-bridge.release-claim-admission.v1',
    claimId: 'release-claim-1',
    claimScope: ['textExact', 'commentAnchor'],
    requiredClaimClasses: ['textual', 'commentary'],
    ...overrides,
  };
}

function acceptedDossierResult(bridge, overrides = {}) {
  const result = bridge.evaluateRevisionBridgeReleaseClaimDossierGate(validDossierGateInput(bridge, overrides));
  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  return result;
}

function validDossierPayload(bridge, overrides = {}) {
  return {
    dossierResult: overrides.dossierResult || acceptedDossierResult(bridge),
    claimClasses: overrides.claimClasses || ['commentary', 'textual'],
    baselineDebtFlag: overrides.baselineDebtFlag === true,
    ...overrides,
  };
}

function acceptedAdmissionResult(bridge) {
  return bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    validAdmission(),
    validDossierPayload(bridge),
  );
}

test('Review Bridge release claim admission binding status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_ADMISSION_BINDING_001');
  assert.equal(status.type, 'review_bridge_release_claim_admission_binding');
  assert.ok(
    ['implemented_verified_pending_delivery', 'delivered_merged_verified'].includes(status.status),
    `unexpected status ${status.status}`,
  );
  assert.equal(status.scope.desktopFirst, true);
  assert.equal(status.scope.offlineFirst, true);
  assert.equal(status.scope.reviewBridgeContour, true);
  assert.equal(status.scope.importExportMvpScopeExpanded, false);
  assert.equal(status.scope.uiRedesign, false);
  assert.equal(status.scope.newDependenciesAdded, false);
  assert.equal(status.scope.runtimeProductionCodeChanged, true);
  assert.equal(status.scope.rendererSurfaceChanged, false);
  assert.equal(status.scope.projectTruthWrites, false);
  assert.equal(status.scope.manuscriptWrites, false);
  assert.equal(status.scope.storageWrite, false);
  assert.equal(status.scope.receiptOrRecoveryCreated, false);
  assert.equal(status.scope.releaseClaimAdmissionRuntimeChanged, true);
  assert.equal(status.scope.releaseModeDecisionAccepted, false);
  assert.equal(status.scope.releaseExecutionAccepted, false);
  assert.equal(status.scope.releasePublicationAccepted, false);
  assert.equal(status.scope.userFacingReleaseClaimed, false);
  assert.equal(status.scope.docxImportSafeCreateChanged, false);
  assert.equal(status.scope.docxExportChanged, false);
  assert.equal(status.scope.autoApply, false);
  assert.equal(status.scope.releaseReadinessClaimed, false);
  assert.equal(status.scope.y9Opened, false);
});

test('Review Bridge release claim admission binding proves only bounded admission candidate truth', async () => {
  const bridge = await loadBridge();
  const status = readJson(STATUS_PATH);
  const result = acceptedAdmissionResult(bridge);
  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.equal(result.ok, true);
  assert.equal(result.type, 'revisionBridge.releaseClaimAdmissionGate');
  assert.equal(result.status, 'accepted');
  assert.equal(result.code, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_ACCEPTED');
  assert.equal(result.binding.claimId, 'release-claim-1');
  assert.equal(result.binding.dossierId, 'release-claim-dossier-1');
  assert.equal(result.binding.dossierStatus, 'accepted');
  assert.deepEqual(result.binding.claimScope, ['textExact', 'commentAnchor']);
  assert.deepEqual(result.binding.coveredScope, ['commentAnchor', 'textExact']);
  assert.deepEqual(result.binding.requiredClaimClasses, ['textual', 'commentary']);
  assert.deepEqual(result.binding.dossierClaimClasses, ['commentary', 'textual']);
  assert.equal(result.binding.baselineDebtFlag, false);

  assert.match(positiveText, /release claim admission gate/u);
  assert.match(positiveText, /bounded Review Bridge admission boundary/u);
  assert.match(positiveText, /accepted 12B release claim dossier result/u);
  assert.match(positiveText, /valid 12B provenance/u);
  assert.match(positiveText, /claimScope to be covered/u);
  assert.match(positiveText, /requiredClaimClasses/u);
  assert.match(positiveText, /baselineDebtFlag to be false/u);

  for (const phrase of [
    'No release readiness is claimed.',
    'No user-facing release is claimed.',
    'No release mode decision completion is claimed.',
    'No release execution completion is claimed.',
    'No release publication completion is claimed.',
    'No packet emit completion is claimed.',
    'No attestation completion is claimed.',
    'No Word support is claimed.',
    'No Google Docs support is claimed.',
    'No import support is claimed.',
    'No export support is claimed.',
    'No review import completion is claimed.',
    'No roundtrip is claimed.',
    'No layout parity is claimed.',
    'No full fidelity is claimed.',
    'No project truth write is performed by release claim admission binding.',
    'No receipt or recovery evidence is created by release claim admission binding.',
    'No import/export MVP closeout is widened.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(layerText, /admission candidate truth only/u);
  assert.match(layerText, /does not become project truth/u);
  assert.match(layerText, /does not decide release mode/u);
  assert.match(layerText, /does not admit execution or publication/u);
  assert.match(layerText, /not a mode decision contour/u);
  assert.match(layerText, /not a release execution contour/u);
  assert.match(layerText, /not a release publication contour/u);
  assert.match(layerText, /not content import/u);
  assert.match(layerText, /not export/u);
  assert.match(layerText, /not an apply plan/u);
});

test('Review Bridge release claim admission binding blocks invalid admission paths', async () => {
  const bridge = await loadBridge();

  const missingDossier = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(validAdmission());
  assert.equal(missingDossier.ok, false);
  assert.equal(missingDossier.status, 'blocked');
  assert.equal(missingDossier.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_DOSSIER_MISSING');

  const blockedDossierResult = bridge.evaluateRevisionBridgeReleaseClaimDossierGate(validDossierGateInput(bridge, {
    dossier: validDossier(bridge, {
      items: [
        validDossierItem(bridge, {
          claim: validClaim(bridge, validGoldenSet(), {
            goldenSetHash: 'rbgs_wrong_hash',
          }),
        }),
      ],
    }),
  }));
  const blockedDossier = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    validAdmission(),
    validDossierPayload(bridge, { dossierResult: blockedDossierResult }),
  );
  assert.equal(blockedDossier.ok, false);
  assert.equal(blockedDossier.status, 'blocked');
  assert.equal(blockedDossier.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_DOSSIER_BLOCKED');

  const syntheticDossier = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    validAdmission(),
    validDossierPayload(bridge, {
      dossierResult: {
        status: 'accepted',
        binding: {
          dossierId: 'release-claim-dossier-1',
          itemIds: ['dossier-item-1'],
        },
        itemEvaluations: [],
      },
    }),
  );
  assert.equal(syntheticDossier.ok, false);
  assert.equal(syntheticDossier.status, 'blocked');
  assert.equal(syntheticDossier.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_DOSSIER_PROVENANCE_INVALID');

  const acceptedDossier = acceptedDossierResult(bridge);
  const malformedItemEvaluations = deepClone(acceptedDossier.itemEvaluations);
  malformedItemEvaluations[0].ok = false;
  malformedItemEvaluations[0].status = 'blocked';
  malformedItemEvaluations[0].type = 'syntheticGate';
  const malformedItem = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    validAdmission(),
    validDossierPayload(bridge, {
      dossierResult: {
        ...deepClone(acceptedDossier),
        itemEvaluations: malformedItemEvaluations,
      },
    }),
  );
  assert.equal(malformedItem.ok, false);
  assert.equal(malformedItem.status, 'blocked');
  assert.equal(malformedItem.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_DOSSIER_PROVENANCE_INVALID');

  const uncoveredScope = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    validAdmission({ claimScope: ['textExact', 'structuralManual'] }),
    validDossierPayload(bridge),
  );
  assert.equal(uncoveredScope.ok, false);
  assert.equal(uncoveredScope.status, 'blocked');
  assert.equal(uncoveredScope.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_SCOPE_NOT_COVERED');
  assert.deepEqual(uncoveredScope.reasons[0].uncoveredScope, ['structuralManual']);

  const forgedCoveredScope = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    validAdmission({ claimScope: ['textExact', 'structuralManual'] }),
    validDossierPayload(bridge, {
      coveredScope: ['textExact', 'commentAnchor', 'structuralManual'],
    }),
  );
  assert.equal(forgedCoveredScope.ok, false);
  assert.equal(forgedCoveredScope.status, 'blocked');
  assert.equal(forgedCoveredScope.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_SCOPE_NOT_COVERED');
  assert.deepEqual(forgedCoveredScope.binding.coveredScope, ['commentAnchor', 'textExact']);
  assert.deepEqual(forgedCoveredScope.reasons[0].uncoveredScope, ['structuralManual']);

  const missingClasses = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    validAdmission({ requiredClaimClasses: ['textual', 'structural'] }),
    validDossierPayload(bridge, { claimClasses: ['textual'] }),
  );
  assert.equal(missingClasses.ok, false);
  assert.equal(missingClasses.status, 'blocked');
  assert.equal(missingClasses.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_REQUIRED_CLASSES_MISSING');
  assert.deepEqual(missingClasses.reasons[0].missingClaimClasses, ['structural']);

  const baselineDebt = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    validAdmission(),
    validDossierPayload(bridge, { baselineDebtFlag: true }),
  );
  assert.equal(baselineDebt.ok, false);
  assert.equal(baselineDebt.status, 'blocked');
  assert.equal(baselineDebt.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_BASELINE_DEBT_BLOCKED');

  const diagnostics = bridge.evaluateRevisionBridgeReleaseClaimAdmissionGate(
    {
      schemaVersion: 'revision-bridge.release-claim-admission.v0',
      claimId: '',
      claimScope: [''],
      requiredClaimClasses: 'textual',
    },
    validDossierPayload(bridge),
  );
  assert.equal(diagnostics.ok, false);
  assert.equal(diagnostics.status, 'diagnostics');
  assert.equal(diagnostics.code, 'E_REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_DIAGNOSTICS');
});

test('Review Bridge release claim admission binding is bound to existing kernel and downstream guards', () => {
  const status = readJson(STATUS_PATH);
  const bridgeSource = readText(['src', 'io', 'revisionBridge', 'index.mjs']);
  const admissionKernelTest = readText(['test', 'contracts', 'revision-bridge-release-claim-admission-gate.contract.test.js']);
  const dossierBindingTest = readText(['test', 'contracts', 'review-bridge-release-claim-dossier-binding.contract.test.js']);
  const dossierKernelTest = readText(['test', 'contracts', 'revision-bridge-release-claim-dossier-binding.contract.test.js']);
  const modeDecisionTest = readText(['test', 'contracts', 'revision-bridge-release-claim-decision-gate.contract.test.js']);
  const userFacingBoundaryTest = readText(['test', 'contracts', 'revision-bridge-release-claim-user-facing-boundary-gate.contract.test.js']);
  const publicationTest = readText(['test', 'contracts', 'revision-bridge-release-claim-publication-gate.contract.test.js']);
  const executionTest = readText(['test', 'contracts', 'revision-bridge-release-claim-execution-gate.contract.test.js']);

  assert.equal(status.binding.existingKernelMarker, 'CONTOUR_12C_RELEASE_CLAIM_ADMISSION_GATE');
  assert.equal(status.binding.releaseClaimDossierGateMarker, 'CONTOUR_12B_RELEASE_CLAIM_DOSSIER_GATE');
  assert.match(bridgeSource, /CONTOUR_12C_RELEASE_CLAIM_ADMISSION_GATE_START/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_SCHEMA/u);
  assert.match(bridgeSource, /evaluateRevisionBridgeReleaseClaimAdmissionGate/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_DOSSIER_MISSING/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_DOSSIER_PROVENANCE_INVALID/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_SCOPE_NOT_COVERED/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_REQUIRED_CLASSES_MISSING/u);
  assert.match(bridgeSource, /REVISION_BRIDGE_RELEASE_CLAIM_ADMISSION_BASELINE_DEBT_BLOCKED/u);

  assert.match(admissionKernelTest, /blocks when dossier payload is missing/u);
  assert.match(admissionKernelTest, /blocks when dossier status is blocked/u);
  assert.match(admissionKernelTest, /blocks synthetic accepted dossier payloads without 12B provenance/u);
  assert.match(admissionKernelTest, /blocks malformed dossier item evaluations/u);
  assert.match(admissionKernelTest, /blocks when claim scope is not covered/u);
  assert.match(admissionKernelTest, /blocks when required claim classes are missing/u);
  assert.match(admissionKernelTest, /blocks when baselineDebtFlag is true/u);
  assert.match(admissionKernelTest, /accepts only when dossier status, scope, classes, and debt checks all pass/u);
  assert.match(dossierBindingTest, /REVIEW_BRIDGE_RELEASE_CLAIM_DOSSIER_BINDING_001/u);
  assert.match(dossierKernelTest, /accepts a dossier only when all items pass the reused 12A gate/u);
  assert.match(modeDecisionTest, /propagates blocked admission gate state/u);
  assert.match(userFacingBoundaryTest, /blocks PR_MODE requests for USER_FACING boundary/u);
  assert.match(publicationTest, /blocks RELEASE_MODE USER_FACING publication when releaseClass is not ready/u);
  assert.match(executionTest, /accepts RELEASE_MODE USER_FACING execution gate only with ready class/u);
});

test('Review Bridge release claim admission binding keeps docs honest', () => {
  const status = readJson(STATUS_PATH);
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);
  const docsText = [context, handoff, worklog].join('\n');
  const statusText = JSON.stringify(status, null, 2);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_RELEASE_CLAIM_ADMISSION_BINDING_001/u);
    assert.match(text, /release claim admission binding/iu);
    assert.match(text, /not release readiness/iu);
  }

  assertNoReleaseAdmissionOverclaims(statusText, 'status');
  assertNoReleaseAdmissionOverclaims(docsText, 'docs');
  assert.match(
    docsText,
    /no release readiness, user-facing release, release mode decision completion, release execution completion, release publication completion/iu,
  );
});

test('Review Bridge release claim admission binding changed files stay inside allowlist', () => {
  const status = execFileSync('git', ['status', '--porcelain', '-uall'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const changedFiles = changedFilesFromGitStatus(status);

  for (const filePath of changedFiles) {
    assert.equal(ALLOWLIST.includes(filePath), true, `changed file outside allowlist: ${filePath}`);
  }
});
