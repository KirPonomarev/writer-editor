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
  'REVIEW_BRIDGE_RELEASE_CLAIM_PUBLICATION_EFFECT_BINDING_001_STATUS.json',
);
const PREVIOUS_STATUS_PATH = path.join(
  REPO_ROOT,
  'docs',
  'OPS',
  'STATUS',
  'REVIEW_BRIDGE_RELEASE_CLAIM_REAL_EXECUTION_EPHEMERAL_EFFECT_BINDING_001_STATUS.json',
);
const STATUS_PATH_REL =
  'docs/OPS/STATUS/REVIEW_BRIDGE_RELEASE_CLAIM_PUBLICATION_EFFECT_BINDING_001_STATUS.json';
const CONTRACT_PATH =
  'test/contracts/review-bridge-release-claim-publication-effect-binding.contract.test.js';
const PUBLICATION_WIRING_TEST_PATH =
  'test/contracts/revision-bridge-release-claim-publication-effect-wiring.contract.test.js';
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
  PUBLICATION_WIRING_TEST_PATH,
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

function assertNoPublicationEffectOverclaims(text, label) {
  const forbidden = [
    /\bpublication effect means product publication\b/iu,
    /\bpublication effect means publication authority\b/iu,
    /\bpublication effect means release publication completion\b/iu,
    /\bpublication effect means release readiness\b/iu,
    /\bpublication effect means user-facing release\b/iu,
    /\bproduct publication is (?:available|supported|ready|complete|proven)\b/iu,
    /\bpublication authority is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease publication completion is (?:available|supported|ready|complete|proven)\b/iu,
    /\brelease readiness is (?:available|supported|ready|complete|proven)\b/iu,
    /\buser-facing release is (?:available|supported|ready|complete|proven)\b/iu,
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

test('Review Bridge release claim publication effect binding status keeps scope narrow', () => {
  const status = readJson(STATUS_PATH);

  assert.equal(status.taskId, 'REVIEW_BRIDGE_RELEASE_CLAIM_PUBLICATION_EFFECT_BINDING_001');
  assert.equal(status.type, 'review_bridge_release_claim_publication_effect_binding');
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
  assert.equal(status.scope.releaseClaimPublicationEffectRuntimeChanged, true);
  assert.equal(status.scope.releaseClaimPublicationEffectBound, true);
  assert.equal(status.scope.releaseClaimRealExecutionEphemeralEffectDeliveredPreviously, true);
  assert.equal(status.scope.publicationEffectInMemoryOnly, true);
  assert.equal(status.scope.commandAvailabilityClaimed, false);
  assert.equal(status.scope.commandExecutionAccepted, false);
  assert.equal(status.scope.releaseExecutionAccepted, false);
  assert.equal(status.scope.productPublicationClaimed, false);
  assert.equal(status.scope.publicationAuthorityClaimed, false);
  assert.equal(status.scope.releasePublicationCompletionClaimed, false);
  assert.equal(status.scope.releaseReadinessClaimed, false);
  assert.equal(status.scope.userFacingReleaseClaimed, false);
  assert.equal(status.scope.docxImportSafeCreateChanged, false);
  assert.equal(status.scope.docxExportChanged, false);
  assert.equal(status.scope.autoApply, false);
  assert.equal(status.scope.y9Opened, false);
});

test('Review Bridge release claim publication effect binding is bound to delivered 12O over 12N and 12K', () => {
  const status = readJson(STATUS_PATH);
  const previousStatus = readJson(PREVIOUS_STATUS_PATH);
  const mainSource = readText(['src', 'main.js']);
  const wiringTest = readText([
    'test',
    'contracts',
    'revision-bridge-release-claim-publication-effect-wiring.contract.test.js',
  ]);

  assert.equal(
    status.binding.previousContourTaskId,
    'REVIEW_BRIDGE_RELEASE_CLAIM_REAL_EXECUTION_EPHEMERAL_EFFECT_BINDING_001',
  );
  assert.equal(status.binding.previousContourTaskId, previousStatus.taskId);
  assert.equal(status.binding.previousContourStatus, 'delivered_merged_verified');
  assert.equal(status.binding.previousContourMergeSha, previousStatus.delivery.featureMergeSha);
  assert.equal(status.binding.previousContourDeliveryRebindMergeSha, 'f2ddf16217fdc99b937492aa8386c5f3bd6125e7');
  assert.equal(
    status.binding.activePublicationEffectMarker,
    'CONTOUR_12P_RELEASE_CLAIM_PUBLICATION_EFFECT',
  );
  assert.equal(
    status.binding.upstreamRealExecutionEffectMarker,
    'CONTOUR_12O_RELEASE_CLAIM_REAL_EXECUTION_EPHEMERAL_EFFECT',
  );
  assert.equal(
    status.binding.upstreamCommandSurfaceTriggerWitnessMarker,
    'CONTOUR_12N_RELEASE_CLAIM_COMMAND_SURFACE_TRIGGER_WITNESS',
  );
  assert.equal(status.binding.upstreamExecutionGateMarker, 'CONTOUR_12K_RELEASE_CLAIM_EXECUTION_GATE');
  assert.equal(status.binding.commandSurfaceCommandId, 'cmd.project.releaseClaim.execute');
  assert.equal(status.binding.commandSurfaceRoute, 'command.bus');
  assert.equal(status.binding.publicationEffectRegistryType, 'ephemeral_in_memory_packet_id_registry');
  assert.equal(status.binding.publicationEffectLifetime, 'main_process_lifetime_only');
  assert.equal(
    status.binding.publicationEffectSelectorMode,
    'fixed_execute_command_to_publication_effect_mapping',
  );
  assert.equal(status.binding.executionGateSchema, 'revision-bridge.release-claim-execution-gate.v1');

  assert.match(mainSource, /CONTOUR_12P_RELEASE_CLAIM_PUBLICATION_EFFECT_START/u);
  assert.match(mainSource, /releaseClaimPublicationEffectRegistry/u);
  assert.match(mainSource, /handleRevisionBridgeReleaseClaimPublicationEffect/u);
  assert.match(
    mainSource,
    /handleRevisionBridgeReleaseClaimCommandExecutionEphemeralEffect\(payload\)/u,
  );
  assert.match(
    wiringTest,
    /records one execution effect record and one publication effect record/u,
  );
  assert.match(
    wiringTest,
    /duplicate accepted packetId returns deterministic blocked publication effect result/u,
  );
});

test('Review Bridge release claim publication effect binding preserves publication-effect-only truth', () => {
  const status = readJson(STATUS_PATH);
  const positiveText = status.positiveClaims.join('\n');
  const nonClaimText = status.nonClaims.join('\n');
  const layerText = status.layerDecisions.join('\n');

  assert.match(positiveText, /main-only publication effect contour/u);
  assert.match(positiveText, /command surface kernel allowlist/u);
  assert.match(positiveText, /bus-route command surface dispatch/u);
  assert.match(positiveText, /delivered 12O real execution effect sublayer directly from raw command input/u);
  assert.match(positiveText, /summary\.publicationEffectOnly true/u);
  assert.match(positiveText, /exactly one deterministic in-memory publication effect record keyed by packetId/u);
  assert.match(positiveText, /duplicate-packet blocked publication-effect outcome/u);
  assert.match(positiveText, /Diagnostics or blocked 12O output writes no publication effect record/u);
  assert.match(positiveText, /blocks missing packetId before any publication effect record is written/u);

  for (const phrase of [
    'No command availability is claimed.',
    'No broad command execution completion is claimed.',
    'No release execution completion is claimed.',
    'No runtime queue semantics are claimed.',
    'No product publication is claimed.',
    'No publication authority is claimed.',
    'No release publication completion is claimed.',
    'No release readiness is claimed.',
    'No user-facing release is claimed.',
    'No manuscript write is performed by release claim publication effect binding.',
    'No project truth write is performed by release claim publication effect binding.',
    'No storage write is performed by release claim publication effect binding.',
    'No receipt or recovery evidence is created by release claim publication effect binding.',
    'No import/export MVP closeout is widened.',
  ]) {
    assert.match(nonClaimText, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(layerText, /main-only in-memory effect evidence/u);
  assert.match(layerText, /ephemeral in-memory state only and does not become project truth/u);
  assert.match(layerText, /does not write storage truth and does not create receipt or recovery evidence/u);
  assert.match(layerText, /does not open runtime queue semantics/u);
  assert.match(layerText, /does not prove product publication completion/u);
  assert.match(layerText, /does not grant publication authority/u);
  assert.match(layerText, /fixed execute-command-to-publication-effect mapping/u);
  assert.equal(status.proofPoints.realPublicationEffectRecordStoredOnAccepted, true);
  assert.equal(status.proofPoints.duplicatePacketBlocked, true);
  assert.equal(status.proofPoints.diagnosticsOrBlockedStoreNoPublicationEffectRecord, true);
  assert.equal(status.proofPoints.missingPacketIdBlockedBeforePublicationEffectRecord, true);
  assert.equal(status.proofPoints.runtimeQueueOpened, false);
});

test('Review Bridge release claim publication effect binding keeps docs honest', () => {
  const status = readJson(STATUS_PATH);
  const context = readText(['docs', 'CONTEXT.md']);
  const handoff = readText(['docs', 'HANDOFF.md']);
  const worklog = readText(['docs', 'WORKLOG.md']);
  const docsText = [context, handoff, worklog].join('\n');
  const statusText = JSON.stringify(status, null, 2);

  for (const text of [context, handoff, worklog]) {
    assert.match(text, /REVIEW_BRIDGE_RELEASE_CLAIM_PUBLICATION_EFFECT_BINDING_001/u);
    assert.match(text, /publication effect binding/iu);
    assert.match(text, /cmd\.project\.releaseClaim\.execute/u);
    assert.match(text, /command\.bus/u);
    assert.match(text, /12O|real execution effect/iu);
    assert.match(text, /12K|execution gate/iu);
    assert.match(text, /publicationEffectOnly/iu);
    assert.match(text, /not product publication/iu);
    assert.match(text, /not publication authority/iu);
    assert.match(text, /not release readiness/iu);
    assert.match(text, /not a user-facing release/iu);
    assert.match(text, /not a user-facing UI state/iu);
    assert.match(text, /not runtime queue semantics/iu);
  }

  assertNoPublicationEffectOverclaims(statusText, 'status');
  assertNoPublicationEffectOverclaims(docsText, 'docs');
  assert.match(
    docsText,
    /no command availability, broad command execution completion, release execution completion, runtime queue semantics, retry, drop, abandon, product publication, publication authority, release publication completion, release readiness, user-facing release/iu,
  );
});

test('Review Bridge release claim publication effect binding changed files stay inside allowlist', () => {
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
