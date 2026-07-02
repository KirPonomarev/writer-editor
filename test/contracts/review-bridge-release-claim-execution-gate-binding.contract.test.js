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
  'REVIEW_BRIDGE_RELEASE_CLAIM_EXECUTION_GATE_BINDING_001_STATUS.json',
);
const STATUS_PATH_REL =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_EXECUTION_GATE_BINDING_001_STATUS.json';
const CONTRACT_PATH =
  'test/contracts/review-bridge-release-claim-execution-gate-binding.contract.test.js';
const EXECUTION_TEST_PATH = 'test/contracts/revision-bridge-release-claim-execution-gate.contract.test.js';
const COMMAND_SURFACE_WIRING_TEST_PATH =
  'test/contracts/revision-bridge-release-claim-command-surface-admission-wiring.contract.test.js';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const CONTEXT_PATH = 'docs/CONTEXT.md';
const HANDOFF_PATH = 'docs/HANDOFF.md';
const WORKLOG_PATH = 'docs/WORKLOG.md';
const ALLOWLIST = [
  MODULE_PATH,
  STATUS_PATH_REL,
  CONTRACT_PATH,
  EXECUTION_TEST_PATH,
  COMMAND_SURFACE_WIRING_TEST_PATH,
  'test/contracts/review-bridge-release-claim-admission-binding.contract.test.js',
  'test/contracts/review-bridge-release-claim-attestation-binding.contract.test.js',
  'test/contracts/review-bridge-release-claim-command-admission-binding.contract.test.js',
  'test/contracts/review-bridge-release-claim-dossier-binding.contract.test.js',
  'test/contracts/review-bridge-release-claim-kernel-fence-binding.contract.test.js',
  'test/contracts/review-bridge-release-claim-mode-decision-binding.contract.test.js',
  'test/contracts/review-bridge-release-claim-packet-emit-binding.contract.test.js',
  'test/contracts/review-bridge-release-claim-publication-gate-binding.contract.test.js',
  'test/contracts/review-bridge-release-claim-user-facing-boundary-binding.contract.test.js',
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

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

function assertNoExecutionGateOverclaims(text, label) {
  const forbidden = [
    /\bexecution gate accepted means command execution\b/iu,
    /\bexecution gate accepted means release execution\b/iu,
    /\bexecution gate accepted means product publication\b/iu,
    /\bexecution gate accepted means release readiness\b/iu,
    /\bexecution gate accepted means user-facing release\b/iu,
    /\bcommand execution is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease execution is (?:available|supported|ready|complete|proven)\b/iu,
    /\bproduct publication is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease readiness is (?:available|supported|ready|complete|proven)\b/iu,
    /\buser-facing release is (?:available|supported|ready|complete|proven)\b/iu,
    /\bpublication authority is (?:available|supported|ready|complete|proven)\b/iu,
    /\bimport support is (?:available|supported|ready|complete|proven)\b/iu,
    /\bexport support is (?:available|supported|ready|complete|proven)\b/iu,
    /\bproject truth write is (?:available|supported|ready|complete|proven)\b/iu,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(text), false, `${label} contains overclaim: ${pattern.source}`);
  }
}

test('Review Bridge release claim execution gate binding status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_EXECUTION_GATE_BINDING_001');
  assert.equal(status.type, 'review_bridge_release_claim_execution_gate_binding');
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
  assert.equal(status.scope.releaseClaimExecutionGateRuntimeChanged, true);
  assert.equal(status.scope.releaseClaimExecutionGateBound, true);
  assert.equal(status.scope.releaseClaimCommandAdmissionDeliveredPreviously, true);
  assert.equal(status.scope.executionGateEvidenceClaimed, true);
  assert.equal(status.scope.commandAvailabilityClaimed, false);
  assert.equal(status.scope.commandExecutionAccepted, false);
  assert.equal(status.scope.releaseExecutionAccepted, false);
  assert.equal(status.scope.productPublicationClaimed, false);
  assert.equal(status.scope.releaseReadinessClaimed, false);
  assert.equal(status.scope.userFacingReleaseClaimed, false);
});

test('Review Bridge release claim execution gate binding is bound to existing 12K runtime', () => {
  const status = readJson(STATUS_PATH);
  const bridgeSource = readText(['src', 'io', 'revisionBridge', 'index.mjs']);
  const executionTest = readText([
    'test',
    'contracts',
    'revision-bridge-release-claim-execution-gate.contract.test.js',
  ]);
  const commandSurfaceTest = readText([
    'test',
    'contracts',
    'revision-bridge-release-claim-command-surface-admission-wiring.contract.test.js',
  ]);
  const sectionStart = bridgeSource.indexOf('// CONTOUR_12K_RELEASE_CLAIM_EXECUTION_GATE_START');
  const sectionEnd = bridgeSource.indexOf('// CONTOUR_12K_RELEASE_CLAIM_EXECUTION_GATE_END');

  assert.equal(status.binding.existingExecutionGateMarker, 'CONTOUR_12K_RELEASE_CLAIM_EXECUTION_GATE');
  assert.equal(status.binding.previousContourTaskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_BINDING_001');
  assert.equal(status.binding.previousContourStatus, 'delivered_merged_verified');
  assert.equal(status.binding.upstreamCommandAdmissionMarker, 'CONTOUR_12J_RELEASE_CLAIM_COMMAND_ADMISSION');
  assert.equal(status.binding.executionGateSchema, 'revision-bridge.release-claim-execution-gate.v1');
  assert.notEqual(sectionStart, -1);
  assert.notEqual(sectionEnd, -1);

  const executionSection = bridgeSource.slice(sectionStart, sectionEnd);
  assert.match(executionSection, /evaluateRevisionBridgeReleaseClaimExecutionGate/u);
  assert.match(executionSection, /evaluateRevisionBridgeReleaseClaimCommandAdmission/u);
  assert.match(executionSection, /cloneJsonSafe\(input\)/u);
  assert.match(executionSection, /commandAdmissionInput/u);
  assert.match(executionSection, /REVISION_BRIDGE_RELEASE_CLAIM_EXECUTION_GATE_COMMAND_ADMISSION_INPUT_MISSING/u);
  assert.match(executionSection, /REVISION_BRIDGE_RELEASE_CLAIM_EXECUTION_GATE_COMMAND_ADMISSION_RESULT_MISMATCH/u);
  assert.match(executionTest, /blocks synthetic accepted 12J result without raw commandAdmissionInput/u);
  assert.match(executionTest, /blocks fabricated accepted 12J witness with valid raw input/u);
  assert.match(executionTest, /blocks non-plain supplied 12J witness/u);
  assert.match(executionTest, /blocks inherited supplied 12J witness/u);
  assert.match(commandSurfaceTest, /validCommandAdmissionInput/u);
  assert.match(commandSurfaceTest, /admission-only path is non-mutating/u);
});

test('Review Bridge release claim execution gate binding proves bounded execution-gate truth', () => {
  const status = readJson(STATUS_PATH);
  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.match(positiveText, /bounded internal Review Bridge 12K execution-gate evidence/u);
  assert.match(positiveText, /requires raw 12J command admission input/u);
  assert.match(positiveText, /re-evaluates the 12J command admission/u);
  assert.match(positiveText, /stale, fabricated, inherited, or non-plain supplied values/iu);

  for (const phrase of [
    'No command availability is claimed.',
    'No command execution is claimed.',
    'No release execution completion is claimed.',
    'No product publication is claimed.',
    'No release readiness is claimed.',
    'No user-facing release is claimed.',
    'No publication authority is claimed.',
    'No import support is claimed.',
    'No export support is claimed.',
    'No project truth write is performed by release claim execution gate binding.',
    'No receipt or recovery evidence is created by release claim execution gate binding.',
    'No import/export MVP closeout is widened.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(layerText, /internal chain evidence only/u);
  assert.match(layerText, /does not execute release commands/u);
  assert.match(layerText, /does not prove command execution/u);
  assert.match(layerText, /does not admit release execution completion/u);
  assert.match(layerText, /does not admit command availability/u);
  assert.match(layerText, /does not publish anything/u);
  assert.match(layerText, /does not become project truth/u);
  assert.match(layerText, /12L command surface admission wiring remains a downstream regression surface/u);
  assert.equal(status.proofPoints.outputCannotMeanCommandAvailability, true);
  assert.equal(status.proofPoints.outputCannotMeanCommandExecution, true);
  assert.equal(status.proofPoints.outputCannotMeanReleaseExecutionCompletion, true);
});

test('Review Bridge release claim execution gate binding keeps docs honest', () => {
  const status = readJson(STATUS_PATH);
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);
  const docsText = [context, handoff, worklog].join('\n');
  const statusText = JSON.stringify(status, null, 2);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_RELEASE_CLAIM_EXECUTION_GATE_BINDING_001/u);
    assert.match(text, /execution gate binding/iu);
    assert.match(text, /raw 12J command admission input/iu);
    assert.match(text, /re-evaluates 12J/iu);
    assert.match(text, /not command availability/iu);
    assert.match(text, /not command execution/iu);
    assert.match(text, /not release execution completion/iu);
    assert.match(text, /not product publication/iu);
    assert.match(text, /not release readiness/iu);
    assert.match(text, /not a user-facing release/iu);
    assert.match(text, /not a user-facing UI state/iu);
  }

  assertNoExecutionGateOverclaims(statusText, 'status');
  assertNoExecutionGateOverclaims(docsText, 'docs');
  assert.match(
    docsText,
    /no command availability, command execution, release execution completion, product publication, release readiness, user-facing release/iu,
  );
});

test('Review Bridge release claim execution gate binding changed files stay inside allowlist', () => {
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
