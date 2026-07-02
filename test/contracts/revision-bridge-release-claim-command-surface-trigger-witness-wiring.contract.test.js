const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_PATH = 'src/main.js';
const SECTION_START = '// CONTOUR_12M_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_START';
const SECTION_END = '// CONTOUR_12M_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_END';
const TRIGGER_MARKER_START = '// CONTOUR_12N_RELEASE_CLAIM_COMMAND_SURFACE_TRIGGER_WITNESS_START';
const TRIGGER_MARKER_END = '// CONTOUR_12N_RELEASE_CLAIM_COMMAND_SURFACE_TRIGGER_WITNESS_END';
const RELEASE_CLAIM_COMMAND_ID = 'cmd.project.releaseClaim.execute';

async function loadBridge() {
  return import(pathToFileURL(path.join(REPO_ROOT, 'src/io/revisionBridge/index.mjs')).href);
}

function readMainSource() {
  return fs.readFileSync(path.join(REPO_ROOT, MAIN_PATH), 'utf8');
}

function extractMarkedSection(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  assert.notEqual(start, -1, `missing marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing marker: ${endMarker}`);
  assert.ok(end > start, `marker order invalid: ${startMarker}`);
  return text.slice(start, end + endMarker.length);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasOwn(value, key) {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
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

function validClaim(bridge, goldenSet) {
  return {
    schemaVersion: 'revision-bridge.format-matrix-support-claim.v1',
    claimId: 'claim-1',
    matrixRowId: 'word-text-exact',
    claimScope: ['textExact', 'commentAnchor'],
    verifiedTests: ['rb12-word-text', 'rb12-word-comment', 'rb12-golden-hash'],
    goldenSetHash: bridge.createRevisionBridgeGoldenSetHash(goldenSet),
  };
}

function validDossier(bridge) {
  const goldenSet = validGoldenSet();
  return {
    schemaVersion: 'revision-bridge.release-claim-dossier.v1',
    dossierId: 'release-claim-dossier-1',
    items: [
      {
        schemaVersion: 'revision-bridge.release-claim-dossier-item.v1',
        itemId: 'dossier-item-1',
        goldenSet,
        claim: validClaim(bridge, goldenSet),
      },
    ],
  };
}

function validAdmission() {
  return {
    schemaVersion: 'revision-bridge.release-claim-admission.v1',
    claimId: 'release-claim-1',
    claimScope: ['textExact'],
    requiredClaimClasses: ['textual'],
  };
}

function validDecisionInput(bridge, mode) {
  return {
    schemaVersion: bridge.REVISION_BRIDGE_RELEASE_CLAIM_MODE_DECISION_SCHEMA,
    mode,
    formatMatrix: validFormatMatrix(),
    dossier: validDossier(bridge),
    admission: validAdmission(),
    claimClasses: ['textual', 'commentary'],
    baselineDebtFlag: false,
    releaseEvidenceId: 'release-evidence-1',
    releaseEvidenceHash: 'sha256:release-evidence-1',
    inputHash: 'sha256:input-1',
    outputHash: 'sha256:output-1',
    commandRunDigest: 'sha256:run-1',
    matrixId: 'format-matrix-1',
    dossierId: 'release-claim-dossier-1',
    claimId: 'release-claim-1',
  };
}

function acceptedModeDecisionResult(bridge, mode) {
  const result = bridge.evaluateRevisionBridgeReleaseClaimModeDecisionGate(validDecisionInput(bridge, mode));
  assert.equal(result.ok, true);
  return result;
}

function validAttestationInput(bridge, mode, modeDecisionResult) {
  const executedCommands = mode === 'RELEASE_MODE'
    ? [
      {
        commandId: 'node',
        argv: ['--test', 'test/contracts/revision-bridge-release-claim-attestation-gate.contract.test.js'],
      },
      {
        commandId: 'node',
        argv: ['--test', 'test/contracts/revision-bridge-release-claim-decision-gate.contract.test.js'],
      },
    ]
    : undefined;
  const artifactHashes = mode === 'RELEASE_MODE'
    ? [
      { artifactId: 'release-report', digest: 'sha256:release-report-1' },
      { artifactId: 'release-packet', digest: 'sha256:release-packet-1' },
    ]
    : undefined;

  return {
    schemaVersion: bridge.REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_SCHEMA,
    mode,
    modeDecisionResult,
    attestationId: 'attestation-1',
    attestationSchema: bridge.REVISION_BRIDGE_RELEASE_CLAIM_ATTESTATION_SCHEMA,
    inputHash: 'sha256:input-1',
    outputHash: 'sha256:output-1',
    commandRunDigest: bridge.createRevisionBridgeReleaseClaimCommandRunDigest(executedCommands || []),
    decisionHash: bridge.createRevisionBridgeReleaseClaimModeDecisionHash(modeDecisionResult),
    evidenceHash: bridge.createRevisionBridgeReleaseClaimEvidenceHash(artifactHashes || []),
    ...(executedCommands === undefined ? {} : { executedCommands }),
    ...(artifactHashes === undefined ? {} : { artifactHashes }),
    releaseEvidenceId: mode === 'RELEASE_MODE' ? 'release-evidence-1' : '',
    releaseEvidenceHash: mode === 'RELEASE_MODE' ? 'sha256:release-evidence-1' : '',
  };
}

function acceptedAttestationResult(bridge, mode, modeDecisionResult) {
  const result = bridge.evaluateRevisionBridgeReleaseClaimAttestationGate(
    validAttestationInput(bridge, mode, modeDecisionResult),
  );
  assert.equal(result.ok, true);
  return result;
}

function acceptedPacketEmitResult(bridge, mode) {
  const modeDecisionResult = acceptedModeDecisionResult(bridge, mode);
  const attestationResult = acceptedAttestationResult(bridge, mode, modeDecisionResult);
  const result = bridge.evaluateRevisionBridgeReleaseClaimPacketEmit({
    packetMeta: {
      packetId: 'release-claim-packet-1',
      createdAtUtc: '2026-05-15T12:00:00Z',
      emitterId: 'codex-contour-12n',
    },
    modeDecisionResult,
    attestationResult,
  });
  assert.equal(result.ok, true);
  return result;
}

function validCommandAdmissionInput(bridge, mode, claimSurface) {
  const packetEmitResult = acceptedPacketEmitResult(bridge, mode);
  return {
    commandId: claimSurface === 'USER_FACING'
      ? 'cmd.release.claim.publish'
      : 'cmd.release.claim.internalProof',
    requestedMode: mode,
    requestedClaimSurface: claimSurface,
    kernelFenceInput: {
      requestedMode: mode,
      requestedClaimSurface: claimSurface,
      publicationInput: {
        requestedMode: mode,
        requestedClaimSurface: claimSurface,
        boundaryInput: {
          requestedMode: mode,
          requestedClaimSurface: claimSurface,
          packetEmitResult,
        },
      },
    },
  };
}

function validExecutionGateInput(bridge, overrides = {}) {
  const requestedMode = overrides.requestedMode || 'RELEASE_MODE';
  const requestedClaimSurface = overrides.requestedClaimSurface || 'USER_FACING';
  const commandAdmissionInput = hasOwn(overrides, 'commandAdmissionInput')
    ? overrides.commandAdmissionInput
    : validCommandAdmissionInput(bridge, requestedMode, requestedClaimSurface);
  const commandAdmissionResult = hasOwn(overrides, 'commandAdmissionResult')
    ? overrides.commandAdmissionResult
    : undefined;

  return {
    schemaVersion: bridge.REVISION_BRIDGE_RELEASE_CLAIM_EXECUTION_GATE_SCHEMA,
    ...(commandAdmissionInput === undefined ? {} : { commandAdmissionInput }),
    ...(commandAdmissionResult === undefined ? {} : { commandAdmissionResult }),
    requestedMode,
    requestedClaimSurface,
    ...overrides.extraFields,
  };
}

function instantiateWitnessHarness(loadRevisionBridgeModule) {
  const mainSource = readMainSource();
  const section = extractMarkedSection(mainSource, SECTION_START, SECTION_END);
  const context = {
    loadRevisionBridgeModule,
    module: { exports: {} },
    exports: {},
  };
  vm.runInNewContext(
    `${section}\nmodule.exports = {
      handleRevisionBridgeReleaseClaimCommandExecutionWitness,
      clearReleaseClaimCommandSurfaceTriggerWitnessRegistry,
      readReleaseClaimCommandSurfaceTriggerWitnessRegistry,
    };`,
    context,
    { filename: MAIN_PATH },
  );
  return context.module.exports;
}

test('Contour 12N trigger witness section stays main-only and free of queue or storage semantics', () => {
  const section = extractMarkedSection(readMainSource(), SECTION_START, SECTION_END);
  const forbiddenPatterns = [
    /\bruntime-queue\b/iu,
    /\bqueue\b/u,
    /\bretry\b/u,
    /\bdrop\b/u,
    /\babandon\b/u,
    /\bwriteFile\b/u,
    /\bfetch\s*\(/u,
    /\bXMLHttpRequest\b/u,
    /\bWebSocket\b/u,
    /\bhttp\b/u,
    /\bhttps\b/u,
    /\bdialog\b/u,
    /\bsendCanonicalRuntimeCommand\b/u,
    /\brenderer\b/u,
    /\bipcMain\b/u,
  ];

  assert.match(section, new RegExp(TRIGGER_MARKER_START.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  assert.match(section, new RegExp(TRIGGER_MARKER_END.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  assert.match(section, /\breleaseClaimCommandSurfaceTriggerWitnessRegistry\b/u);
  assert.match(section, /\bclearReleaseClaimCommandSurfaceTriggerWitnessRegistry\b/u);
  assert.match(section, /\breadReleaseClaimCommandSurfaceTriggerWitnessRegistry\b/u);
  assert.match(section, /\bregisterReleaseClaimCommandSurfaceTriggerWitness\b/u);
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(section), false, `forbidden 12N token: ${pattern.source}`);
  }
});

test('Contour 12N accepted witness registers one in-memory trigger witness record', async () => {
  const bridge = await loadBridge();
  const harness = instantiateWitnessHarness(async () => bridge);
  harness.clearReleaseClaimCommandSurfaceTriggerWitnessRegistry();
  const payload = validExecutionGateInput(bridge, {
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });

  const result = await harness.handleRevisionBridgeReleaseClaimCommandExecutionWitness(payload);
  const registry = deepClone(harness.readReleaseClaimCommandSurfaceTriggerWitnessRegistry());

  assert.equal(result.ok, true);
  assert.deepEqual(registry, [
    {
      type: 'revisionBridge.releaseClaimCommandSurfaceTriggerWitness',
      packetId: result.summary.packetId,
      attestationId: result.summary.attestationId,
      claimSurface: result.summary.claimSurface,
      commandId: RELEASE_CLAIM_COMMAND_ID,
      admissionClass: result.summary.admissionClass,
      witnessOnly: true,
    },
  ]);
});

test('Contour 12N duplicate accepted packetId blocks and preserves one trigger witness record', async () => {
  const bridge = await loadBridge();
  const harness = instantiateWitnessHarness(async () => bridge);
  harness.clearReleaseClaimCommandSurfaceTriggerWitnessRegistry();
  const payload = validExecutionGateInput(bridge, {
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });

  const first = await harness.handleRevisionBridgeReleaseClaimCommandExecutionWitness(payload);
  const duplicate = await harness.handleRevisionBridgeReleaseClaimCommandExecutionWitness(payload);
  const registry = deepClone(harness.readReleaseClaimCommandSurfaceTriggerWitnessRegistry());

  assert.equal(first.ok, true);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.status, 'blocked');
  assert.equal(
    duplicate.code,
    'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_SURFACE_TRIGGER_WITNESS_DUPLICATE_PACKET_BLOCKED',
  );
  assert.equal(duplicate.summary.packetId, first.summary.packetId);
  assert.equal(duplicate.reasons[0].field, 'summary.packetId');
  assert.equal(duplicate.reasons[0].details.packetId, first.summary.packetId);
  assert.equal(registry.length, 1);
});

test('Contour 12N accepted witness without packetId blocks before trigger witness record is stored', async () => {
  const harness = instantiateWitnessHarness(async () => ({
    evaluateRevisionBridgeReleaseClaimExecutionGate() {
      return {
        ok: true,
        type: 'revisionBridge.releaseClaimExecutionGate',
        status: 'accepted',
        binding: { mode: 'RELEASE_MODE', claimId: 'claim-1' },
        summary: {
          claimSurface: 'USER_FACING',
          packetId: '',
          attestationId: 'attestation-1',
          admissionClass: 'USER_FACING_CLAIM_READY',
        },
      };
    },
  }));
  harness.clearReleaseClaimCommandSurfaceTriggerWitnessRegistry();

  const result = await harness.handleRevisionBridgeReleaseClaimCommandExecutionWitness({
    schemaVersion: 'revision-bridge.release-claim-execution-gate.v1',
    commandAdmissionInput: { commandId: 'cmd.release.claim.publish' },
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(
    result.code,
    'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_SURFACE_TRIGGER_WITNESS_PACKET_ID_REQUIRED',
  );
  assert.deepEqual(deepClone(harness.readReleaseClaimCommandSurfaceTriggerWitnessRegistry()), []);
});

test('Contour 12N diagnostics and blocked witness outputs create no trigger witness record', async () => {
  const bridge = await loadBridge();
  const harness = instantiateWitnessHarness(async () => bridge);
  harness.clearReleaseClaimCommandSurfaceTriggerWitnessRegistry();

  const diagnostics = await harness.handleRevisionBridgeReleaseClaimCommandExecutionWitness({
    schemaVersion: bridge.REVISION_BRIDGE_RELEASE_CLAIM_EXECUTION_GATE_SCHEMA,
    requestedMode: 'BROKEN_MODE',
    requestedClaimSurface: 'USER_FACING',
  });
  assert.equal(diagnostics.status, 'diagnostics');
  assert.deepEqual(deepClone(harness.readReleaseClaimCommandSurfaceTriggerWitnessRegistry()), []);

  const blocked = await harness.handleRevisionBridgeReleaseClaimCommandExecutionWitness(
    validExecutionGateInput(bridge, {
      requestedMode: 'RELEASE_MODE',
      requestedClaimSurface: 'INTERNAL',
      commandAdmissionInput: validCommandAdmissionInput(bridge, 'PR_MODE', 'INTERNAL'),
    }),
  );
  assert.equal(blocked.status, 'blocked');
  assert.deepEqual(deepClone(harness.readReleaseClaimCommandSurfaceTriggerWitnessRegistry()), []);
});
