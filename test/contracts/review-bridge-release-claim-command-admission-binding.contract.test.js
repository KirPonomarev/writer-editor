const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = 'src/io/revisionBridge/index.mjs';
const STATUS_PATH = path.join(
  REPO_ROOT,
  'docs',
  'OPS',
  'STATUS',
  'REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_BINDING_001_STATUS.json',
);
const STATUS_PATH_REL =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_BINDING_001_STATUS.json';
const CONTRACT_PATH =
  'test/contracts/review-bridge-release-claim-command-admission-binding.contract.test.js';
const COMMAND_ADMISSION_TEST_PATH =
  'test/contracts/revision-bridge-release-claim-command-admission.contract.test.js';
const EXECUTION_TEST_PATH = 'test/contracts/revision-bridge-release-claim-execution-gate.contract.test.js';
const DOSSIER_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-dossier-binding.contract.test.js';
const ADMISSION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-admission-binding.contract.test.js';
const MODE_DECISION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-mode-decision-binding.contract.test.js';
const ATTESTATION_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-attestation-binding.contract.test.js';
const PACKET_BINDING_TEST_PATH = 'test/contracts/review-bridge-release-claim-packet-emit-binding.contract.test.js';
const USER_FACING_BOUNDARY_BINDING_TEST_PATH =
  'test/contracts/review-bridge-release-claim-user-facing-boundary-binding.contract.test.js';
const PUBLICATION_BINDING_TEST_PATH =
  'test/contracts/review-bridge-release-claim-publication-gate-binding.contract.test.js';
const KERNEL_FENCE_BINDING_TEST_PATH =
  'test/contracts/review-bridge-release-claim-kernel-fence-binding.contract.test.js';
const KERNEL_FENCE_STATUS_PATH =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_KERNEL_FENCE_BINDING_001_STATUS.json';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const CONTEXT_PATH = 'docs/CONTEXT.md';
const HANDOFF_PATH = 'docs/HANDOFF.md';
const WORKLOG_PATH = 'docs/WORKLOG.md';
const EXECUTION_GATE_BINDING_STATUS_PATH =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_EXECUTION_GATE_BINDING_001_STATUS.json';
const EXECUTION_GATE_BINDING_TEST_PATH =
  'test/contracts/review-bridge-release-claim-execution-gate-binding.contract.test.js';
const COMMAND_SURFACE_WIRING_TEST_PATH =
  'test/contracts/revision-bridge-release-claim-command-surface-admission-wiring.contract.test.js';
const ALLOWLIST = [
  MODULE_PATH,
  STATUS_PATH_REL,
  CONTRACT_PATH,
  COMMAND_ADMISSION_TEST_PATH,
  EXECUTION_TEST_PATH,
  DOSSIER_BINDING_TEST_PATH,
  ADMISSION_BINDING_TEST_PATH,
  MODE_DECISION_BINDING_TEST_PATH,
  ATTESTATION_BINDING_TEST_PATH,
  PACKET_BINDING_TEST_PATH,
  USER_FACING_BOUNDARY_BINDING_TEST_PATH,
  PUBLICATION_BINDING_TEST_PATH,
  KERNEL_FENCE_BINDING_TEST_PATH,
  GOVERNANCE_APPROVALS_PATH,
  CONTEXT_PATH,
  HANDOFF_PATH,
  WORKLOG_PATH,
  EXECUTION_GATE_BINDING_STATUS_PATH,
  EXECUTION_GATE_BINDING_TEST_PATH,
  COMMAND_SURFACE_WIRING_TEST_PATH,
];

function readText(parts) {
  return fs.readFileSync(path.join(REPO_ROOT, ...parts), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

function assertNoCommandAdmissionOverclaims(text, label) {
  const forbidden = [
    /\bcommand admission accepted means command availability\b/iu,
    /\bcommand admission accepted means command execution\b/iu,
    /\bcommand admission accepted means product publication\b/iu,
    /\bcommand admission accepted means release readiness\b/iu,
    /\bcommand admission accepted means user-facing release\b/iu,
    /\bcommand availability is (?:available|supported|ready|complete|proven)\b/iu,
    /\bcommand execution is (?:available|supported|ready|complete|proven)\b/iu,
    /\bproduct publication is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease readiness is (?:available|supported|ready|complete|proven)\b/iu,
    /\buser-facing release is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease execution is (?:available|supported|ready|complete|proven)\b/iu,
    /\bpublication authority is (?:available|supported|ready|complete|proven)\b/iu,
    /\bimport support is (?:available|supported|ready|complete|proven)\b/iu,
    /\bexport support is (?:available|supported|ready|complete|proven)\b/iu,
    /\bproject truth write is (?:available|supported|ready|complete|proven)\b/iu,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(text), false, `${label} contains overclaim: ${pattern.source}`);
  }
}

test('Review Bridge release claim command admission binding status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_BINDING_001');
  assert.equal(status.type, 'review_bridge_release_claim_command_admission_binding');
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
  assert.equal(status.scope.releaseClaimCommandAdmissionRuntimeChanged, true);
  assert.equal(status.scope.releaseClaimCommandAdmissionBound, true);
  assert.equal(status.scope.releaseClaimKernelFenceBoundPreviously, true);
  assert.equal(status.scope.releaseClaimKernelFenceDeliveredPreviously, true);
  assert.equal(status.scope.commandAdmissionEvidenceClaimed, true);
  assert.equal(status.scope.commandAvailabilityClaimed, false);
  assert.equal(status.scope.commandExecutionAccepted, false);
  assert.equal(status.scope.releaseExecutionAccepted, false);
  assert.equal(status.scope.releasePublicationCompletionClaimed, false);
  assert.equal(status.scope.productPublicationClaimed, false);
  assert.equal(status.scope.publicationAuthorityClaimed, false);
  assert.equal(status.scope.userFacingReleaseClaimed, false);
  assert.equal(status.scope.releaseReadinessClaimed, false);
  assert.equal(status.scope.docxImportSafeCreateChanged, false);
  assert.equal(status.scope.docxExportChanged, false);
  assert.equal(status.scope.autoApply, false);
  assert.equal(status.scope.y9Opened, false);
}
);

test('Review Bridge release claim command admission binding is bound to existing 12J runtime', () => {
  const status = readJson(STATUS_PATH);
  const upstreamStatus = readJson(path.join(REPO_ROOT, KERNEL_FENCE_STATUS_PATH));
  const bridgeSource = readText(['src', 'io', 'revisionBridge', 'index.mjs']);
  const commandAdmissionTest = readText([
    'test',
    'contracts',
    'revision-bridge-release-claim-command-admission.contract.test.js',
  ]);
  const sectionStart = bridgeSource.indexOf('// CONTOUR_12J_RELEASE_CLAIM_COMMAND_ADMISSION_START');
  const sectionEnd = bridgeSource.indexOf('// CONTOUR_12J_RELEASE_CLAIM_COMMAND_ADMISSION_END');

  assert.equal(status.binding.existingCommandAdmissionMarker, 'CONTOUR_12J_RELEASE_CLAIM_COMMAND_ADMISSION');
  assert.equal(status.binding.previousContourTaskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_KERNEL_FENCE_BINDING_001');
  assert.equal(status.binding.previousContourStatus, 'delivered_merged_verified');
  assert.equal(upstreamStatus.status, 'delivered_merged_verified');
  assert.equal(status.binding.upstreamKernelFenceMarker, 'CONTOUR_12I_RELEASE_CLAIM_KERNEL_FENCE');
  assert.equal(status.binding.commandAdmissionSchema, 'revision-bridge.release-claim-command-admission.v1');
  assert.equal(status.binding.upstreamKernelFenceSchema, 'revision-bridge.release-claim-kernel-fence.v1');
  assert.notEqual(sectionStart, -1);
  assert.notEqual(sectionEnd, -1);

  const commandAdmissionSection = bridgeSource.slice(sectionStart, sectionEnd);
  assert.match(commandAdmissionSection, /evaluateRevisionBridgeReleaseClaimCommandAdmission/u);
  assert.match(commandAdmissionSection, /evaluateRevisionBridgeReleaseClaimKernelFence/u);
  assert.match(commandAdmissionSection, /cloneJsonSafe\(input\)/u);
  assert.match(commandAdmissionSection, /kernelFenceInput/u);
  assert.match(commandAdmissionSection, /REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_KERNEL_FENCE_INPUT_MISSING/u);
  assert.match(commandAdmissionSection, /REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_KERNEL_FENCE_RESULT_MISMATCH/u);
  assert.match(commandAdmissionTest, /blocks synthetic accepted kernel fence without raw input/u);
  assert.match(commandAdmissionTest, /blocks fabricated accepted kernel fence witness with valid raw input/u);
  assert.match(commandAdmissionTest, /blocks non-plain supplied kernelFenceResult witness/u);
  assert.match(commandAdmissionTest, /blocks inherited supplied kernelFenceResult witness/u);
});

test('Review Bridge release claim command admission binding proves bounded command admission truth', () => {
  const status = readJson(STATUS_PATH);
  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.match(positiveText, /command admission gate/u);
  assert.match(positiveText, /bounded internal Review Bridge 12J command admission evidence/u);
  assert.match(positiveText, /requires raw 12I kernel fence input/u);
  assert.match(positiveText, /re-evaluates the 12I kernel fence/u);
  assert.match(positiveText, /strips inherited prototype fields/u);
  assert.match(positiveText, /stale, fabricated, inherited, or non-plain supplied values/iu);

  for (const phrase of [
    'No command availability is claimed.',
    'No command execution is claimed.',
    'No product publication is claimed.',
    'No release readiness is claimed.',
    'No user-facing release is claimed.',
    'No release publication completion is claimed.',
    'No publication authority is claimed.',
    'No import support is claimed.',
    'No export support is claimed.',
    'No project truth write is performed by release claim command admission binding.',
    'No receipt or recovery evidence is created by release claim command admission binding.',
    'No import/export MVP closeout is widened.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(layerText, /internal chain evidence only/u);
  assert.match(layerText, /does not execute release commands/u);
  assert.match(layerText, /does not admit release execution/u);
  assert.match(layerText, /does not admit command availability/u);
  assert.match(layerText, /does not publish anything/u);
  assert.match(layerText, /does not become project truth/u);
  assert.match(layerText, /12K release claim execution gate remains a separate downstream contour/u);
  assert.equal(status.proofPoints.outputCannotMeanCommandAvailability, true);
  assert.equal(status.proofPoints.outputCannotMeanCommandExecution, true);
});

test('Review Bridge release claim command admission binding keeps docs honest', () => {
  const status = readJson(STATUS_PATH);
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);
  const docsText = [context, handoff, worklog].join('\n');
  const statusText = JSON.stringify(status, null, 2);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_BINDING_001/u);
    assert.match(text, /command admission binding/iu);
    assert.match(text, /raw 12I kernel fence input/iu);
    assert.match(text, /re-evaluates 12I/iu);
    assert.match(text, /not command availability/iu);
    assert.match(text, /not command execution/iu);
    assert.match(text, /not product publication/iu);
    assert.match(text, /not release readiness/iu);
    assert.match(text, /not a user-facing release/iu);
    assert.match(text, /not a user-facing UI state/iu);
  }

  assert.match(context, /REVIEW_BRIDGE_RELEASE_CLAIM_KERNEL_FENCE_BINDING_001` is delivered, merged, and verified/u);
  assert.match(handoff, /REVIEW_BRIDGE_RELEASE_CLAIM_KERNEL_FENCE_BINDING_001` is delivered, merged, and verified/u);
  assertNoCommandAdmissionOverclaims(statusText, 'status');
  assertNoCommandAdmissionOverclaims(docsText, 'docs');
  assert.match(
    docsText,
    /no command availability, command execution, product publication, release readiness, user-facing release/iu,
  );
});

test('Review Bridge release claim command admission binding changed files stay inside allowlist', () => {
  const status = execFileSync('git', ['status', '--porcelain', '-uall'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const changedFiles = changedFilesFromGitStatus(status);

  for (const filePath of changedFiles) {
    assert.equal(ALLOWLIST.includes(filePath), true, `changed file outside allowlist: ${filePath}`);
  }

  const packageManifestDiff = changedFiles.filter((filePath) => (
    filePath === 'package.json'
    || filePath === 'package-lock.json'
    || filePath === 'npm-shrinkwrap.json'
  ));
  assert.deepEqual(packageManifestDiff, []);
});
