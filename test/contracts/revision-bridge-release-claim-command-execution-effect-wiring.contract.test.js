const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_PATH = 'src/main.js';
const SECTION_START = '// CONTOUR_12O_RELEASE_CLAIM_REAL_EXECUTION_EPHEMERAL_EFFECT_START';
const SECTION_END = '// CONTOUR_12O_RELEASE_CLAIM_REAL_EXECUTION_EPHEMERAL_EFFECT_END';
const RELEASE_CLAIM_COMMAND_ID = 'cmd.project.releaseClaim.execute';

const { ALLOWED_COMMAND_IDS, createCommandSurfaceKernel } = require('../../src/command/commandSurfaceKernel.js');

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
      emitterId: 'codex-contour-12o',
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

function instantiateEffectHarness(loadRevisionBridgeModule) {
  const mainSource = readMainSource();
  const section = extractMarkedSection(mainSource, SECTION_START, SECTION_END);
  const context = {
    loadRevisionBridgeModule,
    module: { exports: {} },
    exports: {},
  };
  vm.runInNewContext(
    `${section}\nmodule.exports = {
      handleRevisionBridgeReleaseClaimCommandExecutionEphemeralEffect,
      clearReleaseClaimCommandExecutionEffectRegistry,
      readReleaseClaimCommandExecutionEffectRegistry,
    };`,
    context,
    { filename: MAIN_PATH },
  );
  return context.module.exports;
}

function instantiateEffectHandler(loadRevisionBridgeModule) {
  return instantiateEffectHarness(loadRevisionBridgeModule).handleRevisionBridgeReleaseClaimCommandExecutionEphemeralEffect;
}

test('Contour 12O command execution effect wiring exports the release-claim command id through kernel allowlist', () => {
  assert.equal(ALLOWED_COMMAND_IDS.includes(RELEASE_CLAIM_COMMAND_ID), true);

  const kernel = createCommandSurfaceKernel({
    [RELEASE_CLAIM_COMMAND_ID]: async () => ({ ok: true }),
  });

  assert.equal(kernel.listAllowedCommandIds().includes(RELEASE_CLAIM_COMMAND_ID), true);
});

test('Contour 12O active execute path routes through the real execution effect handler', () => {
  const mainSource = readMainSource();

  assert.match(mainSource, /CONTOUR_12O_RELEASE_CLAIM_REAL_EXECUTION_EPHEMERAL_EFFECT_START/u);
  assert.match(mainSource, /handleRevisionBridgeReleaseClaimCommandExecutionEphemeralEffect/u);
  assert.match(
    mainSource,
    /\[COMMAND_SURFACE_KERNEL_COMMAND_IDS\.PROJECT_RELEASE_CLAIM_EXECUTE\]: async \(payload = \{\}\) => \{\s*return handleRevisionBridgeReleaseClaimCommandExecutionEphemeralEffect\(payload\);/u,
  );
});

test('Contour 12O effect path calls 12K execution gate and wraps accepted output', async () => {
  const calls = [];
  let loadCount = 0;
  const expectedExecutionGateResult = {
    ok: true,
    type: 'revisionBridge.releaseClaimExecutionGate',
    status: 'accepted',
    binding: {
      mode: 'RELEASE_MODE',
      claimId: 'claim-1',
    },
    summary: {
      claimSurface: 'USER_FACING',
      packetId: 'release-claim-packet-1',
      attestationId: 'attestation-1',
      admissionClass: 'USER_FACING_CLAIM_READY',
    },
  };
  const handler = instantiateEffectHandler(async () => {
    loadCount += 1;
    return {
      evaluateRevisionBridgeReleaseClaimExecutionGate(payload) {
        calls.push(payload);
        return expectedExecutionGateResult;
      },
    };
  });
  const payload = {
    schemaVersion: 'revision-bridge.release-claim-execution-gate.v1',
    commandAdmissionInput: { commandId: 'cmd.release.claim.publish' },
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  };

  const result = await handler(payload);

  assert.equal(loadCount, 1);
  assert.deepEqual(calls, [payload]);
  assert.deepEqual(deepClone(result), {
    ok: true,
    type: 'revisionBridge.releaseClaimCommandExecutionEffect',
    status: 'accepted',
    code: 'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_EFFECT_ACCEPTED',
    reason: 'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_EFFECT_ACCEPTED',
    reasons: [],
    binding: {
      mode: 'RELEASE_MODE',
      claimId: 'claim-1',
    },
    summary: {
      claimSurface: 'USER_FACING',
      packetId: 'release-claim-packet-1',
      attestationId: 'attestation-1',
      commandId: 'cmd.project.releaseClaim.execute',
      admissionClass: 'USER_FACING_CLAIM_READY',
      ephemeralEffectOnly: true,
    },
  });
});

test('Contour 12O blocks non-plain top-level payload before 12K execution gate', async () => {
  const calls = [];
  let loadCount = 0;
  class ReleaseClaimPayload {
    constructor() {
      this.schemaVersion = 'revision-bridge.release-claim-execution-gate.v1';
      this.commandAdmissionInput = { commandId: 'cmd.release.claim.internalProof' };
      this.requestedMode = 'PR_MODE';
      this.requestedClaimSurface = 'INTERNAL';
    }
  }
  const handler = instantiateEffectHandler(async () => {
    loadCount += 1;
    return {
      evaluateRevisionBridgeReleaseClaimExecutionGate(payload) {
        calls.push(payload);
        return { ok: true };
      },
    };
  });

  const result = await handler(new ReleaseClaimPayload());

  assert.equal(loadCount, 0);
  assert.deepEqual(calls, []);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_RELEASE_CLAIM_COMMAND_EXECUTION_EFFECT_PAYLOAD_INVALID');
  assert.equal(result.error.op, RELEASE_CLAIM_COMMAND_ID);
  assert.equal(result.error.reason, 'PAYLOAD_PLAIN_OBJECT_REQUIRED');
});

test('Contour 12O accepted 12K result returns real execution effect result without witnessOnly', async () => {
  const bridge = await loadBridge();
  const handler = instantiateEffectHandler(async () => bridge);
  const payload = validExecutionGateInput(bridge, {
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });

  const result = await handler(payload);
  const expected = bridge.evaluateRevisionBridgeReleaseClaimExecutionGate(payload);

  assert.equal(result.ok, true);
  assert.equal(result.type, 'revisionBridge.releaseClaimCommandExecutionEffect');
  assert.equal(result.status, 'accepted');
  assert.equal(result.code, 'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_EFFECT_ACCEPTED');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_EFFECT_ACCEPTED');
  assert.deepEqual(deepClone(result.binding), deepClone(expected.binding));
  assert.equal(result.summary.claimSurface, expected.summary.claimSurface);
  assert.equal(result.summary.packetId, expected.summary.packetId);
  assert.equal(result.summary.attestationId, expected.summary.attestationId);
  assert.equal(result.summary.commandId, RELEASE_CLAIM_COMMAND_ID);
  assert.equal(result.summary.admissionClass, expected.summary.admissionClass);
  assert.equal(result.summary.ephemeralEffectOnly, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.summary, 'witnessOnly'), false);
  assert.deepEqual(deepClone(result.reasons), []);
});

test('Contour 12O accepted effect path records one in-memory execution effect record', async () => {
  const bridge = await loadBridge();
  const harness = instantiateEffectHarness(async () => bridge);
  harness.clearReleaseClaimCommandExecutionEffectRegistry();
  const payload = validExecutionGateInput(bridge, {
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });

  const result = await harness.handleRevisionBridgeReleaseClaimCommandExecutionEphemeralEffect(payload);
  const registry = deepClone(harness.readReleaseClaimCommandExecutionEffectRegistry());

  assert.equal(result.ok, true);
  assert.deepEqual(registry, [
    {
      type: 'revisionBridge.releaseClaimCommandExecutionEffectRecord',
      packetId: result.summary.packetId,
      attestationId: result.summary.attestationId,
      claimSurface: result.summary.claimSurface,
      commandId: RELEASE_CLAIM_COMMAND_ID,
      admissionClass: result.summary.admissionClass,
      ephemeralEffectOnly: true,
    },
  ]);
});

test('Contour 12O blocked and diagnostics gate results create no execution effect record', async () => {
  const bridge = await loadBridge();
  const harness = instantiateEffectHarness(async () => bridge);

  harness.clearReleaseClaimCommandExecutionEffectRegistry();
  const diagnosticsPayload = {
    schemaVersion: bridge.REVISION_BRIDGE_RELEASE_CLAIM_EXECUTION_GATE_SCHEMA,
    requestedMode: 'BROKEN_MODE',
    requestedClaimSurface: 'USER_FACING',
  };
  const diagnostics = await harness.handleRevisionBridgeReleaseClaimCommandExecutionEphemeralEffect(diagnosticsPayload);
  assert.equal(diagnostics.status, 'diagnostics');
  assert.deepEqual(deepClone(harness.readReleaseClaimCommandExecutionEffectRegistry()), []);

  const blockedPayload = validExecutionGateInput(bridge, {
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'INTERNAL',
    commandAdmissionInput: validCommandAdmissionInput(bridge, 'PR_MODE', 'INTERNAL'),
  });
  const blocked = await harness.handleRevisionBridgeReleaseClaimCommandExecutionEphemeralEffect(blockedPayload);
  assert.equal(blocked.status, 'blocked');
  assert.deepEqual(deepClone(harness.readReleaseClaimCommandExecutionEffectRegistry()), []);
});

test('Contour 12O duplicate accepted packetId returns deterministic blocked real execution effect result', async () => {
  const bridge = await loadBridge();
  const harness = instantiateEffectHarness(async () => bridge);
  harness.clearReleaseClaimCommandExecutionEffectRegistry();
  const payload = validExecutionGateInput(bridge, {
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });

  const first = await harness.handleRevisionBridgeReleaseClaimCommandExecutionEphemeralEffect(payload);
  const duplicateA = await harness.handleRevisionBridgeReleaseClaimCommandExecutionEphemeralEffect(payload);
  const duplicateB = await harness.handleRevisionBridgeReleaseClaimCommandExecutionEphemeralEffect(payload);
  const registry = deepClone(harness.readReleaseClaimCommandExecutionEffectRegistry());

  assert.equal(first.ok, true);
  assert.equal(duplicateA.ok, false);
  assert.equal(duplicateA.status, 'blocked');
  assert.equal(
    duplicateA.code,
    'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_EFFECT_DUPLICATE_PACKET_BLOCKED',
  );
  assert.equal(
    duplicateA.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_EFFECT_DUPLICATE_PACKET_BLOCKED',
  );
  assert.deepEqual(duplicateA, duplicateB);
  assert.equal(duplicateA.summary.packetId, first.summary.packetId);
  assert.equal(Array.isArray(duplicateA.reasons), true);
  assert.equal(duplicateA.reasons[0].field, 'summary.packetId');
  assert.equal(duplicateA.reasons[0].details.packetId, first.summary.packetId);
  assert.equal(registry.length, 1);
});

test('Contour 12O accepted effect without packetId blocks before execution effect record is stored', async () => {
  const harness = instantiateEffectHarness(async () => ({
    evaluateRevisionBridgeReleaseClaimExecutionGate() {
      return {
        ok: true,
        type: 'revisionBridge.releaseClaimExecutionGate',
        status: 'accepted',
        binding: {
          mode: 'RELEASE_MODE',
          claimId: 'claim-1',
        },
        summary: {
          claimSurface: 'USER_FACING',
          packetId: '',
          attestationId: 'attestation-1',
          admissionClass: 'USER_FACING_CLAIM_READY',
        },
      };
    },
  }));
  harness.clearReleaseClaimCommandExecutionEffectRegistry();

  const result = await harness.handleRevisionBridgeReleaseClaimCommandExecutionEphemeralEffect({
    schemaVersion: 'revision-bridge.release-claim-execution-gate.v1',
    commandAdmissionInput: { commandId: 'cmd.release.claim.publish' },
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.code,
    'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_EFFECT_PACKET_ID_REQUIRED',
  );
  assert.deepEqual(deepClone(harness.readReleaseClaimCommandExecutionEffectRegistry()), []);
});

test('Contour 12O direct non-bus route is blocked', () => {
  const mainSource = readMainSource();

  assert.match(
    mainSource,
    /ipcMain\.handle\('ui:command-bridge', async \(_, request\) => \{[\s\S]*if \(route !== COMMAND_BUS_ROUTE\) \{\s*return \{ ok: false, reason: 'COMMAND_ROUTE_UNSUPPORTED' \};\s*\}/,
  );
  assert.match(
    mainSource,
    /function dispatchMenuCommand\(commandId, payload = \{\}, options = \{\}\) \{[\s\S]*if \(route !== COMMAND_BUS_ROUTE\) \{\s*throw new Error\(`Unsupported menu command route: \$\{route\}`\);\s*\}/,
  );
});

test('Contour 12O real ui command bridge nests blocked or diagnostics effect result under outer failure envelope', () => {
  const mainSource = readMainSource();

  assert.match(
    mainSource,
    /if \(result && result\.ok === true\) \{\s*return \{ ok: true, value: result \};\s*\}\s*return \{\s*ok: false,\s*reason: 'COMMAND_EXECUTION_FAILED',\s*value: result && typeof result === 'object' \? result : null,\s*\};/u,
  );
});

test('Contour 12O source section stays effect-layer only and free of witness-only wording', () => {
  const section = extractMarkedSection(readMainSource(), SECTION_START, SECTION_END);
  const forbiddenPatterns = [
    /\bwitnessOnly\b/u,
    /\bBrowserWindow\b/u,
    /\bMenu\b/u,
    /\brenderer\b/u,
    /\bpreload\b/u,
    /\bindex\.html\b/u,
    /\bsubmenu\b/u,
    /\baccelerator\b/u,
    /\bipcMain\b/u,
    /\bdialog\b/u,
    /\bwriteFile\b/u,
    /\bfetch\s*\(/u,
    /\bXMLHttpRequest\b/u,
    /\bWebSocket\b/u,
    /\bhttp\b/u,
    /\bhttps\b/u,
    /\bpublication\b/u,
  ];

  assert.match(section, /\bisReleaseClaimCommandExecutionEffectPlainPayload\s*\(/u);
  assert.match(section, /\bcloneReleaseClaimCommandExecutionEffectValue\s*\(/u);
  assert.match(section, /\bevaluateRevisionBridgeReleaseClaimExecutionGate\s*\(/u);
  assert.match(section, /\bPAYLOAD_PLAIN_OBJECT_REQUIRED\b/u);
  assert.match(section, /\bephemeralEffectOnly:\s*true/u);
  assert.match(section, /\breleaseClaimCommandExecutionEffectRegistry\b/u);
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(section), false, `forbidden contour token: ${pattern.source}`);
  }
});
