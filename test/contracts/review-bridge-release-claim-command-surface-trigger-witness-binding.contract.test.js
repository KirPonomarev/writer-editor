const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_PATH = 'src/main.js';
const STATUS_PATH = path.join(
  REPO_ROOT,
  'docs',
  'OPS',
  'STATUS',
  'REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_SURFACE_TRIGGER_WITNESS_BINDING_001_STATUS.json',
);
const STATUS_PATH_REL =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_SURFACE_TRIGGER_WITNESS_BINDING_001_STATUS.json';
const CONTRACT_PATH =
  'test/contracts/review-bridge-release-claim-command-surface-trigger-witness-binding.contract.test.js';
const COMMAND_SURFACE_TRIGGER_WIRING_TEST_PATH =
  'test/contracts/revision-bridge-release-claim-command-surface-trigger-witness-wiring.contract.test.js';
const COMMAND_EXECUTION_WIRING_TEST_PATH =
  'test/contracts/revision-bridge-release-claim-command-execution-witness-wiring.contract.test.js';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const CONTEXT_PATH = 'docs/CONTEXT.md';
const HANDOFF_PATH = 'docs/HANDOFF.md';
const WORKLOG_PATH = 'docs/WORKLOG.md';
const ALLOWLIST = [
  MAIN_PATH,
  STATUS_PATH_REL,
  CONTRACT_PATH,
  COMMAND_SURFACE_TRIGGER_WIRING_TEST_PATH,
  COMMAND_EXECUTION_WIRING_TEST_PATH,
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

function assertNoCommandSurfaceTriggerWitnessOverclaims(text, label) {
  const forbidden = [
    /\bcommand surface trigger witness accepted means command availability\b/iu,
    /\bcommand surface trigger witness accepted means command execution\b/iu,
    /\bcommand surface trigger witness accepted means release execution\b/iu,
    /\bcommand surface trigger witness accepted means product publication\b/iu,
    /\bcommand surface trigger witness accepted means release readiness\b/iu,
    /\bcommand surface trigger witness accepted means user-facing release\b/iu,
    /\btrigger witness record means runtime queue\b/iu,
    /\btrigger witness record means storage write\b/iu,
    /\bcommand availability is (?:available|supported|ready|complete|proven)\b/iu,
    /\bcommand execution is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease execution is (?:available|supported|ready|complete|proven)\b/iu,
    /\bruntime queue is (?:available|supported|ready|complete|proven|opened)\b/iu,
    /\bstorage write is (?:available|supported|ready|complete|proven|performed)\b/iu,
    /\bproduct publication is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease readiness is (?:available|supported|ready|complete|proven)\b/iu,
    /\buser-facing release is (?:available|supported|ready|complete|proven)\b/iu,
    /\bpublication authority is (?:available|supported|ready|complete|proven)\b/iu,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(text), false, `${label} contains overclaim: ${pattern.source}`);
  }
}

test('Review Bridge release claim command surface trigger witness binding status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_SURFACE_TRIGGER_WITNESS_BINDING_001');
  assert.equal(status.type, 'review_bridge_release_claim_command_surface_trigger_witness_binding');
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
  assert.equal(status.scope.releaseClaimCommandSurfaceTriggerWitnessRuntimeChanged, true);
  assert.equal(status.scope.releaseClaimCommandSurfaceTriggerWitnessBound, true);
  assert.equal(status.scope.releaseClaimCommandExecutionWitnessBoundPreviously, true);
  assert.equal(status.scope.releaseClaimCommandExecutionWitnessDeliveredPreviously, true);
  assert.equal(status.scope.commandSurfaceTriggerWitnessClaimed, true);
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

test('Review Bridge release claim command surface trigger witness binding is bound to 12N over 12M', () => {
  const status = readJson(STATUS_PATH);
  const mainSource = readText(['src', 'main.js']);
  const wiringTest = readText([
    'test',
    'contracts',
    'revision-bridge-release-claim-command-surface-trigger-witness-wiring.contract.test.js',
  ]);

  assert.equal(
    status.binding.previousContourTaskId,
    'REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_BINDING_001',
  );
  assert.equal(status.binding.previousContourStatus, 'delivered_merged_verified');
  assert.equal(
    status.binding.existingCommandSurfaceTriggerMarker,
    'CONTOUR_12N_RELEASE_CLAIM_COMMAND_SURFACE_TRIGGER_WITNESS',
  );
  assert.equal(
    status.binding.upstreamCommandExecutionWitnessMarker,
    'CONTOUR_12M_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS',
  );
  assert.equal(status.binding.upstreamExecutionGateMarker, 'CONTOUR_12K_RELEASE_CLAIM_EXECUTION_GATE');
  assert.equal(status.binding.commandSurfaceCommandId, 'cmd.project.releaseClaim.execute');
  assert.equal(status.binding.commandSurfaceRoute, 'command.bus');
  assert.equal(status.binding.triggerRegistryType, 'ephemeral_in_memory_packet_id_registry');
  assert.equal(status.binding.executionGateSchema, 'revision-bridge.release-claim-execution-gate.v1');

  assert.match(mainSource, /CONTOUR_12N_RELEASE_CLAIM_COMMAND_SURFACE_TRIGGER_WITNESS_START/u);
  assert.match(mainSource, /releaseClaimCommandSurfaceTriggerWitnessRegistry/u);
  assert.match(mainSource, /clearReleaseClaimCommandSurfaceTriggerWitnessRegistry/u);
  assert.match(mainSource, /readReleaseClaimCommandSurfaceTriggerWitnessRegistry/u);
  assert.match(mainSource, /registerReleaseClaimCommandSurfaceTriggerWitness/u);
  assert.match(
    mainSource,
    /REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_SURFACE_TRIGGER_WITNESS_DUPLICATE_PACKET_BLOCKED/u,
  );
  assert.match(
    mainSource,
    /REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_SURFACE_TRIGGER_WITNESS_PACKET_ID_REQUIRED/u,
  );
  assert.match(wiringTest, /accepted witness registers one in-memory trigger witness record/u);
  assert.match(wiringTest, /duplicate accepted packetId blocks/u);
  assert.match(wiringTest, /without packetId blocks before trigger witness record is stored/u);
  assert.match(wiringTest, /diagnostics and blocked witness outputs create no trigger witness record/u);
});

test('Review Bridge release claim command surface trigger witness binding preserves witness-only truth', () => {
  const status = readJson(STATUS_PATH);
  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.match(positiveText, /trigger witness-only evidence/u);
  assert.match(positiveText, /command surface kernel allowlist/u);
  assert.match(positiveText, /bus-route command surface dispatch/u);
  assert.match(positiveText, /already-bound 12M witness path/u);
  assert.match(positiveText, /exactly one deterministic in-memory trigger witness record keyed by packetId/u);
  assert.match(positiveText, /duplicate-packet blocked witness outcome/u);
  assert.match(positiveText, /Diagnostics or blocked 12M witness output writes no trigger witness record/u);
  assert.match(positiveText, /blocks missing packetId before any trigger witness record is written/u);

  for (const phrase of [
    'No command availability is claimed.',
    'No command execution is claimed.',
    'No release execution completion is claimed.',
    'No runtime queue semantics are claimed.',
    'No product publication is claimed.',
    'No release readiness is claimed.',
    'No user-facing release is claimed.',
    'No publication authority is claimed.',
    'No renderer runtime trigger is introduced.',
    'No UI state is changed.',
    'No import support is claimed.',
    'No export support is claimed.',
    'No project truth write is performed by release claim command surface trigger witness binding.',
    'No receipt or recovery evidence is created by release claim command surface trigger witness binding.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(layerText, /main-only witness evidence/u);
  assert.match(layerText, /ephemeral in-memory state only/u);
  assert.match(layerText, /does not execute release commands/u);
  assert.match(layerText, /does not prove command execution/u);
  assert.match(layerText, /does not admit command availability/u);
  assert.match(layerText, /does not admit release execution completion/u);
  assert.match(layerText, /does not open runtime queue semantics/u);
  assert.match(layerText, /does not write manuscript truth or project truth/u);
  assert.match(layerText, /does not publish anything/u);
  assert.equal(status.proofPoints.triggerWitnessRecordStoredOnAccepted, true);
  assert.equal(status.proofPoints.duplicatePacketBlocked, true);
  assert.equal(status.proofPoints.diagnosticsOrBlockedStoreNoTriggerWitnessRecord, true);
  assert.equal(status.proofPoints.missingPacketIdBlockedBeforeTriggerRecord, true);
  assert.equal(status.proofPoints.runtimeQueueOpened, false);
});

test('Review Bridge release claim command surface trigger witness binding keeps docs honest', () => {
  const status = readJson(STATUS_PATH);
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);
  const docsText = [context, handoff, worklog].join('\n');
  const statusText = JSON.stringify(status, null, 2);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_SURFACE_TRIGGER_WITNESS_BINDING_001/u);
    assert.match(text, /command surface trigger witness binding/iu);
    assert.match(text, /witness-only/iu);
    assert.match(text, /in-memory trigger witness record/iu);
    assert.match(text, /cmd\.project\.releaseClaim\.execute/u);
    assert.match(text, /command\.bus/u);
    assert.match(text, /12M|command execution witness/iu);
    assert.match(text, /not command availability/iu);
    assert.match(text, /not command execution/iu);
    assert.match(text, /not release execution completion/iu);
    assert.match(text, /not product publication/iu);
    assert.match(text, /not release readiness/iu);
    assert.match(text, /not a user-facing release/iu);
    assert.match(text, /not a user-facing UI state/iu);
    assert.match(text, /not runtime queue semantics/iu);
  }

  assertNoCommandSurfaceTriggerWitnessOverclaims(statusText, 'status');
  assertNoCommandSurfaceTriggerWitnessOverclaims(docsText, 'docs');
  assert.match(
    docsText,
    /no command availability, command execution, release execution completion, product publication, release readiness, user-facing release/iu,
  );
});

test('Review Bridge release claim command surface trigger witness binding changed files stay inside allowlist', () => {
  const status = execFileSync('git', ['status', '--porcelain', '-uall'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const changedFiles = changedFilesFromGitStatus(status);

  for (const filePath of changedFiles) {
    assert.equal(ALLOWLIST.includes(filePath), true, `changed file outside allowlist: ${filePath}`);
  }
});
