const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_PATH = 'src/main.js';
const KERNEL_PATH = 'src/command/commandSurfaceKernel.js';
const STATUS_PATH = path.join(
  REPO_ROOT,
  'docs',
  'OPS',
  'STATUS',
  'REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_BINDING_001_STATUS.json',
);
const STATUS_PATH_REL =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_BINDING_001_STATUS.json';
const CONTRACT_PATH =
  'test/contracts/review-bridge-release-claim-command-execution-witness-binding.contract.test.js';
const COMMAND_SURFACE_WIRING_TEST_PATH =
  'test/contracts/revision-bridge-release-claim-command-execution-witness-wiring.contract.test.js';
const COMMAND_SURFACE_ADMISSION_STATUS_PATH =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_SURFACE_ADMISSION_BINDING_001_STATUS.json';
const COMMAND_SURFACE_ADMISSION_BINDING_TEST_PATH =
  'test/contracts/review-bridge-release-claim-command-surface-admission-binding.contract.test.js';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const CONTEXT_PATH = 'docs/CONTEXT.md';
const HANDOFF_PATH = 'docs/HANDOFF.md';
const WORKLOG_PATH = 'docs/WORKLOG.md';
const DONOR_KERNEL_TEST_PATH = 'test/contracts/donor-port-command-surface-kernel.contract.test.js';
const ALLOWLIST = [
  MAIN_PATH,
  KERNEL_PATH,
  STATUS_PATH_REL,
  CONTRACT_PATH,
  COMMAND_SURFACE_WIRING_TEST_PATH,
  COMMAND_SURFACE_ADMISSION_STATUS_PATH,
  COMMAND_SURFACE_ADMISSION_BINDING_TEST_PATH,
  DONOR_KERNEL_TEST_PATH,
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

function assertNoCommandExecutionWitnessOverclaims(text, label) {
  const forbidden = [
    /\bcommand execution witness accepted means command availability\b/iu,
    /\bcommand execution witness accepted means command execution\b/iu,
    /\bcommand execution witness accepted means release execution\b/iu,
    /\bcommand execution witness accepted means product publication\b/iu,
    /\bcommand execution witness accepted means release readiness\b/iu,
    /\bcommand execution witness accepted means user-facing release\b/iu,
    /\bcommand availability is (?:available|supported|ready|complete|proven)\b/iu,
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

test('Review Bridge release claim command execution witness binding status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_BINDING_001');
  assert.equal(status.type, 'review_bridge_release_claim_command_execution_witness_binding');
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
  assert.equal(status.scope.releaseClaimCommandExecutionWitnessRuntimeChanged, true);
  assert.equal(status.scope.releaseClaimCommandExecutionWitnessBound, true);
  assert.equal(status.scope.releaseClaimCommandSurfaceAdmissionBoundPreviously, true);
  assert.equal(status.scope.releaseClaimCommandSurfaceAdmissionDeliveredPreviously, true);
  assert.equal(status.scope.commandExecutionWitnessClaimed, true);
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
});

test('Review Bridge release claim command execution witness binding is bound to 12M runtime', () => {
  const status = readJson(STATUS_PATH);
  const upstreamStatus = readJson(path.join(REPO_ROOT, COMMAND_SURFACE_ADMISSION_STATUS_PATH));
  const mainSource = readText(['src', 'main.js']);
  const kernelSource = readText(['src', 'command', 'commandSurfaceKernel.js']);
  const wiringTest = readText([
    'test',
    'contracts',
    'revision-bridge-release-claim-command-execution-witness-wiring.contract.test.js',
  ]);
  const sectionStart = mainSource.indexOf('// CONTOUR_12M_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_START');
  const sectionEnd = mainSource.indexOf('// CONTOUR_12M_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_END');

  assert.equal(status.binding.existingCommandSurfaceMarker, 'CONTOUR_12M_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS');
  assert.equal(
    status.binding.previousContourTaskId,
    'REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_SURFACE_ADMISSION_BINDING_001',
  );
  assert.equal(status.binding.previousContourStatus, 'delivered_merged_verified');
  assert.equal(upstreamStatus.status, 'delivered_merged_verified');
  assert.equal(
    status.binding.upstreamCommandSurfaceMarker,
    'CONTOUR_12L_COMMAND_SURFACE_RELEASE_CLAIM_ADMISSION',
  );
  assert.equal(status.binding.upstreamExecutionGateMarker, 'CONTOUR_12K_RELEASE_CLAIM_EXECUTION_GATE');
  assert.equal(status.binding.commandSurfaceCommandId, 'cmd.project.releaseClaim.execute');
  assert.equal(status.binding.commandSurfaceRoute, 'command.bus');
  assert.equal(status.binding.executionGateSchema, 'revision-bridge.release-claim-execution-gate.v1');
  assert.notEqual(sectionStart, -1);
  assert.notEqual(sectionEnd, -1);

  const section = mainSource.slice(sectionStart, sectionEnd);
  assert.match(section, /isReleaseClaimCommandExecutionWitnessPlainPayload/u);
  assert.match(section, /cloneReleaseClaimCommandExecutionWitnessValue/u);
  assert.match(section, /handleRevisionBridgeReleaseClaimCommandExecutionWitness/u);
  assert.match(section, /evaluateRevisionBridgeReleaseClaimExecutionGate/u);
  assert.match(section, /PAYLOAD_PLAIN_OBJECT_REQUIRED/u);
  assert.match(section, /E_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_PAYLOAD_INVALID/u);
  assert.match(section, /cmd\.project\.releaseClaim\.execute/u);
  assert.match(section, /witnessOnly:\s*true/u);
  assert.match(kernelSource, /'cmd\.project\.releaseClaim\.execute'/u);
  assert.match(kernelSource, /const TYPED_RESULT_COMMAND_IDS = new Set\(\[[\s\S]*'cmd\.project\.releaseClaim\.admit'[\s\S]*'cmd\.project\.releaseClaim\.execute'[\s\S]*\]\);/u);
  assert.match(kernelSource, /function isTypedCommandSurfaceResult\(input, commandId\)/u);
  assert.match(mainSource, /PROJECT_RELEASE_CLAIM_EXECUTE: 'cmd\.project\.releaseClaim\.execute'/u);
  assert.match(mainSource, /UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS = new Set\(\[[\s\S]*'cmd\.project\.releaseClaim\.execute'/u);
  assert.match(mainSource, /'cmd\.project\.releaseClaim\.execute': async \(payload = \{\}\) => \{[\s\S]*PROJECT_RELEASE_CLAIM_EXECUTE/u);
  assert.match(wiringTest, /wraps accepted output/u);
  assert.match(wiringTest, /diagnostics 12K result returns diagnostics witness result/u);
  assert.match(wiringTest, /outer failure envelope/u);
  assert.match(wiringTest, /blocks non-plain top-level payload before 12K execution gate/u);
  assert.match(wiringTest, /blocks inherited top-level payload fields before 12K execution gate/u);
  assert.match(wiringTest, /direct non-bus route is blocked/u);
  assert.match(wiringTest, /command id not on allowlist is blocked/u);
  assert.match(wiringTest, /witness result is deterministic/u);
  assert.match(wiringTest, /witness path is non-mutating/u);
});

test('Review Bridge release claim command execution witness binding preserves witness-only truth', () => {
  const status = readJson(STATUS_PATH);
  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.match(positiveText, /command execution witness-only evidence/u);
  assert.match(positiveText, /command surface kernel allowlist/u);
  assert.match(positiveText, /bus-route command surface dispatch/u);
  assert.match(positiveText, /already-bound 12K execution gate/u);
  assert.match(positiveText, /typed witness envelope/u);
  assert.match(positiveText, /accepted, diagnostics, or blocked/u);
  assert.match(positiveText, /outer command bridge failure envelope/u);
  assert.match(positiveText, /rejects non-plain or inherited top-level payload/u);

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
    'No project truth write is performed by release claim command execution witness binding.',
    'No receipt or recovery evidence is created by release claim command execution witness binding.',
    'No import/export MVP closeout is widened.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(layerText, /witness-only chain evidence/u);
  assert.match(layerText, /does not execute release commands/u);
  assert.match(layerText, /does not prove command execution/u);
  assert.match(layerText, /does not admit command availability/u);
  assert.match(layerText, /does not admit release execution completion/u);
  assert.match(layerText, /does not publish anything/u);
  assert.match(layerText, /does not become project truth/u);
  assert.match(layerText, /outer command bridge contract still reports non-ok witness through a nested failure envelope/u);
  assert.match(layerText, /Real command execution remains a separate future owner-approved contour/u);
  assert.equal(status.proofPoints.outputCannotMeanCommandAvailability, true);
  assert.equal(status.proofPoints.outputCannotMeanCommandExecution, true);
  assert.equal(status.proofPoints.outputCannotMeanReleaseExecutionCompletion, true);
  assert.equal(status.proofPoints.kernelPreservesTypedWitnessResult, true);
});

test('Review Bridge release claim command execution witness binding keeps docs honest', () => {
  const status = readJson(STATUS_PATH);
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);
  const docsText = [context, handoff, worklog].join('\n');
  const statusText = JSON.stringify(status, null, 2);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_BINDING_001/u);
    assert.match(text, /command execution witness binding/iu);
    assert.match(text, /witness-only/iu);
    assert.match(text, /cmd\.project\.releaseClaim\.execute/u);
    assert.match(text, /command\.bus/u);
    assert.match(text, /accepted 12L|command surface admission binding/iu);
    assert.match(text, /12K execution gate/iu);
    assert.match(text, /not command availability/iu);
    assert.match(text, /not command execution/iu);
    assert.match(text, /not release execution completion/iu);
    assert.match(text, /not product publication/iu);
    assert.match(text, /not release readiness/iu);
    assert.match(text, /not a user-facing release/iu);
    assert.match(text, /not a user-facing UI state/iu);
  }

  assert.match(
    context,
    /REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_SURFACE_ADMISSION_BINDING_001` is delivered, merged, and verified/u,
  );
  assert.match(
    handoff,
    /REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_SURFACE_ADMISSION_BINDING_001` is delivered, merged, and verified/u,
  );
  assertNoCommandExecutionWitnessOverclaims(statusText, 'status');
  assertNoCommandExecutionWitnessOverclaims(docsText, 'docs');
  assert.match(
    docsText,
    /no command availability, command execution, release execution completion, product publication, release readiness, user-facing release/iu,
  );
});

test('Review Bridge release claim command execution witness binding changed files stay inside allowlist', () => {
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
