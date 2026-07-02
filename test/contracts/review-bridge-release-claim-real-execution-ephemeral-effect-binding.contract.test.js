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
  'REVIEW_BRIDGE_RELEASE_CLAIM_REAL_EXECUTION_EPHEMERAL_EFFECT_BINDING_001_STATUS.json',
);
const STATUS_PATH_REL =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_REAL_EXECUTION_EPHEMERAL_EFFECT_BINDING_001_STATUS.json';
const CONTRACT_PATH =
  'test/contracts/review-bridge-release-claim-real-execution-ephemeral-effect-binding.contract.test.js';
const EFFECT_WIRING_TEST_PATH =
  'test/contracts/revision-bridge-release-claim-command-execution-effect-wiring.contract.test.js';
const DONOR_TEST_PATH = 'test/contracts/donor-port-command-surface-kernel.contract.test.js';
const GOVERNANCE_APPROVALS_PATH = 'docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json';
const CONTEXT_PATH = 'docs/CONTEXT.md';
const HANDOFF_PATH = 'docs/HANDOFF.md';
const WORKLOG_PATH = 'docs/WORKLOG.md';
const ALLOWLIST = [
  MAIN_PATH,
  STATUS_PATH_REL,
  CONTRACT_PATH,
  EFFECT_WIRING_TEST_PATH,
  DONOR_TEST_PATH,
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

function assertNoExecutionEffectOverclaims(text, label) {
  const forbidden = [
    /\breal execution effect means product publication\b/iu,
    /\breal execution effect means release readiness\b/iu,
    /\breal execution effect means user-facing release\b/iu,
    /\breal execution effect means storage truth\b/iu,
    /\breal execution effect means project truth\b/iu,
    /\breal execution effect means manuscript truth\b/iu,
    /\breal execution effect means runtime queue\b/iu,
    /\bproduct publication is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease readiness is (?:available|supported|ready|complete|proven)\b/iu,
    /\buser-facing release is (?:available|supported|ready|complete|proven)\b/iu,
    /\bpublication authority is (?:available|supported|ready|complete|proven)\b/iu,
    /\bstorage write is (?:available|supported|ready|complete|proven)\b/iu,
    /(?<!\bno )\bstorage write is performed\b/iu,
    /\bproject truth write is (?:available|supported|ready|complete|proven)\b/iu,
    /(?<!\bno )\bproject truth write is performed\b/iu,
    /\bmanuscript write is (?:available|supported|ready|complete|proven)\b/iu,
    /(?<!\bno )\bmanuscript write is performed\b/iu,
    /\bruntime queue is (?:available|supported|ready|complete|proven|opened)\b/iu,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(text), false, `${label} contains overclaim: ${pattern.source}`);
  }
}

test('Review Bridge release claim real execution ephemeral effect binding status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_REAL_EXECUTION_EPHEMERAL_EFFECT_BINDING_001');
  assert.equal(status.type, 'review_bridge_release_claim_real_execution_ephemeral_effect_binding');
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
  assert.equal(status.scope.releaseClaimCommandExecutionEffectRuntimeChanged, true);
  assert.equal(status.scope.releaseClaimCommandExecutionEffectBound, true);
  assert.equal(status.scope.realExecutionEffectAccepted, true);
  assert.equal(status.scope.commandAvailabilityClaimed, false);
  assert.equal(status.scope.commandExecutionAccepted, false);
  assert.equal(status.scope.releaseExecutionAccepted, false);
  assert.equal(status.scope.productPublicationClaimed, false);
  assert.equal(status.scope.publicationAuthorityClaimed, false);
  assert.equal(status.scope.userFacingReleaseClaimed, false);
  assert.equal(status.scope.releaseReadinessClaimed, false);
  assert.equal(status.scope.autoApply, false);
  assert.equal(status.scope.y9Opened, false);
});

test('Review Bridge release claim real execution ephemeral effect binding is bound to 12O over delivered 12N and 12K', () => {
  const status = readJson(STATUS_PATH);
  const mainSource = readText(['src', 'main.js']);
  const wiringTest = readText([
    'test',
    'contracts',
    'revision-bridge-release-claim-command-execution-effect-wiring.contract.test.js',
  ]);

  assert.equal(
    status.binding.previousContourTaskId,
    'REVIEW_BRIDGE_RELEASE_CLAIM_COMMAND_SURFACE_TRIGGER_WITNESS_BINDING_001',
  );
  assert.equal(status.binding.previousContourStatus, 'delivered_merged_verified');
  assert.equal(
    status.binding.activeRealExecutionEffectMarker,
    'CONTOUR_12O_RELEASE_CLAIM_REAL_EXECUTION_EPHEMERAL_EFFECT',
  );
  assert.equal(
    status.binding.upstreamCommandSurfaceTriggerWitnessMarker,
    'CONTOUR_12N_RELEASE_CLAIM_COMMAND_SURFACE_TRIGGER_WITNESS',
  );
  assert.equal(
    status.binding.upstreamCommandExecutionWitnessMarker,
    'CONTOUR_12M_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS',
  );
  assert.equal(status.binding.upstreamExecutionGateMarker, 'CONTOUR_12K_RELEASE_CLAIM_EXECUTION_GATE');
  assert.equal(status.binding.commandSurfaceCommandId, 'cmd.project.releaseClaim.execute');
  assert.equal(status.binding.commandSurfaceRoute, 'command.bus');
  assert.equal(status.binding.effectRegistryType, 'ephemeral_in_memory_packet_id_registry');
  assert.equal(status.binding.executionGateSchema, 'revision-bridge.release-claim-execution-gate.v1');
  assert.equal(status.binding.effectSelectorMode, 'fixed_execute_command_to_single_effect_mapping');

  assert.match(mainSource, /CONTOUR_12O_RELEASE_CLAIM_REAL_EXECUTION_EPHEMERAL_EFFECT_START/u);
  assert.match(mainSource, /releaseClaimCommandExecutionEffectRegistry/u);
  assert.match(mainSource, /clearReleaseClaimCommandExecutionEffectRegistry/u);
  assert.match(mainSource, /readReleaseClaimCommandExecutionEffectRegistry/u);
  assert.match(mainSource, /registerReleaseClaimCommandExecutionEffect/u);
  assert.match(
    mainSource,
    /REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_EFFECT_DUPLICATE_PACKET_BLOCKED/u,
  );
  assert.match(
    mainSource,
    /REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_EFFECT_PACKET_ID_REQUIRED/u,
  );
  assert.match(wiringTest, /accepted effect path records one in-memory execution effect record/u);
  assert.match(wiringTest, /duplicate accepted packetId returns deterministic blocked real execution effect result/u);
  assert.match(wiringTest, /without packetId blocks before execution effect record is stored/u);
  assert.match(wiringTest, /blocked and diagnostics gate results create no execution effect record/u);
});

test('Review Bridge release claim real execution ephemeral effect binding preserves effect-only truth', () => {
  const status = readJson(STATUS_PATH);
  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.match(positiveText, /main-only execution effect contour/u);
  assert.match(positiveText, /command surface kernel allowlist/u);
  assert.match(positiveText, /bus-route command surface dispatch/u);
  assert.match(positiveText, /12K execution gate directly from raw command input/u);
  assert.match(positiveText, /summary\.ephemeralEffectOnly true/u);
  assert.match(positiveText, /exactly one deterministic in-memory execution effect record keyed by packetId/u);
  assert.match(positiveText, /duplicate-packet blocked effect outcome/u);
  assert.match(positiveText, /Diagnostics or blocked 12K output writes no execution effect record/u);
  assert.match(positiveText, /blocks missing packetId before any execution effect record is written/u);

  for (const phrase of [
    'No command availability is claimed.',
    'No broad command execution completion is claimed.',
    'No release execution completion is claimed.',
    'No runtime queue semantics are claimed.',
    'No product publication is claimed.',
    'No release readiness is claimed.',
    'No user-facing release is claimed.',
    'No publication authority is claimed.',
    'No renderer runtime trigger is introduced.',
    'No UI state is changed.',
    'No manuscript write is performed by release claim real execution ephemeral effect binding.',
    'No project truth write is performed by release claim real execution ephemeral effect binding.',
    'No storage write is performed by release claim real execution ephemeral effect binding.',
    'No receipt or recovery evidence is created by release claim real execution ephemeral effect binding.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(layerText, /main-only ephemeral effect evidence/u);
  assert.match(layerText, /ephemeral in-memory state only/u);
  assert.match(layerText, /does not become project truth/u);
  assert.match(layerText, /does not open runtime queue semantics/u);
  assert.match(layerText, /does not publish anything/u);
  assert.match(layerText, /does not prove release execution completion/u);
  assert.match(layerText, /fixed execute-command-to-effect mapping/u);
  assert.equal(status.proofPoints.realExecutionEffectRecordStoredOnAccepted, true);
  assert.equal(status.proofPoints.duplicatePacketBlocked, true);
  assert.equal(status.proofPoints.diagnosticsOrBlockedStoreNoExecutionEffectRecord, true);
  assert.equal(status.proofPoints.missingPacketIdBlockedBeforeExecutionEffectRecord, true);
  assert.equal(status.proofPoints.runtimeQueueOpened, false);
});

test('Review Bridge release claim real execution ephemeral effect binding keeps docs honest', () => {
  const status = readJson(STATUS_PATH);
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);
  const docsText = [context, handoff, worklog].join('\n');
  const statusText = JSON.stringify(status, null, 2);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_RELEASE_CLAIM_REAL_EXECUTION_EPHEMERAL_EFFECT_BINDING_001/u);
    assert.match(text, /real execution ephemeral effect binding/iu);
    assert.match(text, /cmd\.project\.releaseClaim\.execute/u);
    assert.match(text, /command\.bus/u);
    assert.match(text, /12N|trigger witness/iu);
    assert.match(text, /12K|execution gate/iu);
    assert.match(text, /ephemeralEffectOnly/iu);
    assert.match(text, /not command availability/iu);
    assert.match(text, /not release execution completion/iu);
    assert.match(text, /not product publication/iu);
    assert.match(text, /not release readiness/iu);
    assert.match(text, /not a user-facing release/iu);
    assert.match(text, /not a user-facing UI state/iu);
    assert.match(text, /not runtime queue semantics/iu);
  }

  assertNoExecutionEffectOverclaims(statusText, 'status');
  assertNoExecutionEffectOverclaims(docsText, 'docs');
  assert.match(
    docsText,
    /no command availability, broad command execution completion, release execution completion, runtime queue semantics, retry, drop, abandon, product publication, release readiness, user-facing release/iu,
  );
});

test('Review Bridge release claim real execution ephemeral effect binding changed files stay inside allowlist', () => {
  const status = execFileSync('git', ['status', '--porcelain', '-uall'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const changedFiles = changedFilesFromGitStatus(status);

  for (const filePath of changedFiles) {
    assert.equal(ALLOWLIST.includes(filePath), true, `changed file outside allowlist: ${filePath}`);
  }
  for (const filePath of ALLOWLIST) {
    assert.equal(changedFiles.includes(filePath), true, `expected changed file missing from worktree: ${filePath}`);
  }
});
