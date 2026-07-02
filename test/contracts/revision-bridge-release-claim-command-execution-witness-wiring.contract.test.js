const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_PATH = 'src/main.js';
const KERNEL_PATH = 'src/command/commandSurfaceKernel.js';
const TEST_PATH = 'test/contracts/revision-bridge-release-claim-command-execution-witness-wiring.contract.test.js';
const DONOR_TEST_PATH = 'test/contracts/donor-port-command-surface-kernel.contract.test.js';
const RELEASE_CLAIM_COMMAND_ID = 'cmd.project.releaseClaim.execute';
const ALLOWLIST = [MAIN_PATH, KERNEL_PATH, TEST_PATH, DONOR_TEST_PATH];
const GUARDED_PATHS = [
  ...ALLOWLIST,
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
];
const SECTION_START = '// CONTOUR_12M_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_START';
const SECTION_END = '// CONTOUR_12M_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_END';

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

function changedFilesFromGitStatus(statusText) {
  return statusText
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).replace(/^"|"$/gu, ''));
}

function changedFilesOutsideAllowlist(changedFiles) {
  const allowed = new Set(ALLOWLIST);
  return changedFiles.filter((filePath) => !allowed.has(filePath));
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

function defaultReleaseCommands() {
  return [
    {
      commandId: 'node',
      argv: ['--test', 'test/contracts/revision-bridge-release-claim-attestation-gate.contract.test.js'],
    },
    {
      commandId: 'node',
      argv: ['--test', 'test/contracts/revision-bridge-release-claim-decision-gate.contract.test.js'],
    },
  ];
}

function defaultArtifactHashes() {
  return [
    {
      artifactId: 'release-report',
      digest: 'sha256:release-report-1',
    },
    {
      artifactId: 'release-packet',
      digest: 'sha256:release-packet-1',
    },
  ];
}

function validAttestationInput(bridge, mode, modeDecisionResult) {
  const executedCommands = mode === 'RELEASE_MODE' ? defaultReleaseCommands() : undefined;
  const artifactHashes = mode === 'RELEASE_MODE' ? defaultArtifactHashes() : undefined;

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
      emitterId: 'codex-contour-12m',
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

function instantiateWitnessHandler(loadRevisionBridgeModule) {
  const mainSource = readMainSource();
  const section = extractMarkedSection(mainSource, SECTION_START, SECTION_END);
  const context = {
    loadRevisionBridgeModule,
    module: { exports: {} },
    exports: {},
  };
  vm.runInNewContext(
    `${section}\nmodule.exports = { handleRevisionBridgeReleaseClaimCommandExecutionWitness };`,
    context,
    { filename: MAIN_PATH },
  );
  return context.module.exports.handleRevisionBridgeReleaseClaimCommandExecutionWitness;
}

test('Contour 12M command execution witness wiring exports the release-claim command id through kernel allowlist', () => {
  assert.equal(ALLOWED_COMMAND_IDS.includes(RELEASE_CLAIM_COMMAND_ID), true);

  const kernel = createCommandSurfaceKernel({
    [RELEASE_CLAIM_COMMAND_ID]: async () => ({ ok: true }),
  });

  assert.equal(kernel.listAllowedCommandIds().includes(RELEASE_CLAIM_COMMAND_ID), true);
});

test('Contour 12M command execution witness wiring path calls 12K execution gate and wraps accepted output', async () => {
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
  const handler = instantiateWitnessHandler(async () => {
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
    type: 'revisionBridge.releaseClaimCommandExecutionWitness',
    status: 'accepted',
    code: 'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_ACCEPTED',
    reason: 'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_ACCEPTED',
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
      witnessOnly: true,
    },
  });
});

test('Contour 12M blocks non-plain top-level payload before 12K execution gate', async () => {
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
  const handler = instantiateWitnessHandler(async () => {
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
  assert.equal(result.error.code, 'E_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_PAYLOAD_INVALID');
  assert.equal(result.error.op, RELEASE_CLAIM_COMMAND_ID);
  assert.equal(result.error.reason, 'PAYLOAD_PLAIN_OBJECT_REQUIRED');
});

test('Contour 12M blocks inherited top-level payload fields before 12K execution gate', async () => {
  const calls = [];
  let loadCount = 0;
  const inheritedPayload = Object.create({
    schemaVersion: 'revision-bridge.release-claim-execution-gate.v1',
    commandAdmissionInput: { commandId: 'cmd.release.claim.internalProof' },
    requestedMode: 'PR_MODE',
    requestedClaimSurface: 'INTERNAL',
  });
  const handler = instantiateWitnessHandler(async () => {
    loadCount += 1;
    return {
      evaluateRevisionBridgeReleaseClaimExecutionGate(payload) {
        calls.push(payload);
        return { ok: true };
      },
    };
  });

  const result = await handler(inheritedPayload);

  assert.equal(loadCount, 0);
  assert.deepEqual(calls, []);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_PAYLOAD_INVALID');
  assert.equal(result.error.reason, 'PAYLOAD_PLAIN_OBJECT_REQUIRED');
});

test('Contour 12M accepted 12K result returns witness-only result', async () => {
  const bridge = await loadBridge();
  const handler = instantiateWitnessHandler(async () => bridge);
  const payload = validExecutionGateInput(bridge, {
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });

  const result = await handler(payload);
  const expected = bridge.evaluateRevisionBridgeReleaseClaimExecutionGate(payload);

  assert.equal(result.ok, true);
  assert.equal(result.type, 'revisionBridge.releaseClaimCommandExecutionWitness');
  assert.equal(result.status, 'accepted');
  assert.equal(result.code, 'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_ACCEPTED');
  assert.equal(result.reason, 'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_ACCEPTED');
  assert.deepEqual(deepClone(result.binding), deepClone(expected.binding));
  assert.equal(result.summary.claimSurface, expected.summary.claimSurface);
  assert.equal(result.summary.packetId, expected.summary.packetId);
  assert.equal(result.summary.attestationId, expected.summary.attestationId);
  assert.equal(result.summary.commandId, RELEASE_CLAIM_COMMAND_ID);
  assert.equal(result.summary.admissionClass, expected.summary.admissionClass);
  assert.equal(result.summary.witnessOnly, true);
  assert.deepEqual(deepClone(result.reasons), []);
});

test('Contour 12M blocked 12K result returns blocked witness result', async () => {
  const bridge = await loadBridge();
  const handler = instantiateWitnessHandler(async () => bridge);
  const payload = validExecutionGateInput(bridge, {
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'INTERNAL',
    commandAdmissionInput: validCommandAdmissionInput(bridge, 'PR_MODE', 'INTERNAL'),
  });

  const result = await handler(payload);
  const expected = bridge.evaluateRevisionBridgeReleaseClaimExecutionGate(payload);

  assert.equal(result.ok, false);
  assert.equal(result.type, 'revisionBridge.releaseClaimCommandExecutionWitness');
  assert.equal(result.status, 'blocked');
  assert.equal(result.code, 'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_BLOCKED');
  assert.equal(result.reason, expected.reason);
  assert.deepEqual(deepClone(result.reasons), deepClone(expected.reasons));
  assert.deepEqual(deepClone(result.binding), deepClone(expected.binding));
  assert.equal(result.summary.claimSurface, expected.summary.claimSurface);
  assert.equal(result.summary.packetId, expected.summary.packetId);
  assert.equal(result.summary.attestationId, expected.summary.attestationId);
  assert.equal(result.summary.commandId, RELEASE_CLAIM_COMMAND_ID);
  assert.equal(result.summary.admissionClass, expected.summary.admissionClass);
  assert.equal(result.summary.witnessOnly, true);
});

test('Contour 12M diagnostics 12K result returns diagnostics witness result', async () => {
  const bridge = await loadBridge();
  const handler = instantiateWitnessHandler(async () => bridge);
  const payload = {
    schemaVersion: bridge.REVISION_BRIDGE_RELEASE_CLAIM_EXECUTION_GATE_SCHEMA,
    requestedMode: 'BROKEN_MODE',
    requestedClaimSurface: 'USER_FACING',
  };

  const result = await handler(payload);
  const expected = bridge.evaluateRevisionBridgeReleaseClaimExecutionGate(payload);

  assert.equal(expected.status, 'diagnostics');
  assert.equal(result.ok, false);
  assert.equal(result.type, 'revisionBridge.releaseClaimCommandExecutionWitness');
  assert.equal(result.status, 'diagnostics');
  assert.equal(result.code, 'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_EXECUTION_WITNESS_DIAGNOSTICS');
  assert.equal(result.reason, expected.reason);
  assert.deepEqual(deepClone(result.reasons), deepClone(expected.reasons));
  assert.deepEqual(deepClone(result.binding), deepClone(expected.binding));
  assert.equal(result.summary.claimSurface, expected.summary.claimSurface);
  assert.equal(result.summary.packetId, expected.summary.packetId);
  assert.equal(result.summary.attestationId, expected.summary.attestationId);
  assert.equal(result.summary.commandId, RELEASE_CLAIM_COMMAND_ID);
  assert.equal(result.summary.admissionClass, expected.summary.admissionClass);
  assert.equal(result.summary.witnessOnly, true);
});

test('Contour 12M direct non-bus route is blocked', () => {
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

test('Contour 12M real ui command bridge nests blocked or diagnostics witness result under outer failure envelope', () => {
  const mainSource = readMainSource();

  assert.match(
    mainSource,
    /if \(result && result\.ok === true\) \{\s*return \{ ok: true, value: result \};\s*\}\s*return \{\s*ok: false,\s*reason: 'COMMAND_EXECUTION_FAILED',\s*value: result && typeof result === 'object' \? result : null,\s*\};/u,
  );
});

test('Contour 12M command id not on allowlist is blocked', async () => {
  const kernel = createCommandSurfaceKernel({
    [RELEASE_CLAIM_COMMAND_ID]: async () => ({ ok: true }),
  });
  const result = await kernel.dispatch('cmd.project.releaseClaim.directBypass', {});

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_COMMAND_ID_NOT_ALLOWED');
  assert.equal(result.error.reason, 'COMMAND_ID_NOT_ALLOWED');
});

test('Contour 12M witness result is deterministic', async () => {
  const bridge = await loadBridge();
  const handler = instantiateWitnessHandler(async () => bridge);
  const payload = validExecutionGateInput(bridge, {
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });

  const first = await handler(payload);
  const second = await handler(payload);

  assert.deepEqual(first, second);
});

test('Contour 12M witness path is non-mutating', async () => {
  const bridge = await loadBridge();
  const handler = instantiateWitnessHandler(async () => bridge);
  const payload = validExecutionGateInput(bridge, {
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });
  const before = deepClone(payload);

  await handler(payload);

  assert.deepEqual(payload, before);
});

test('Contour 12M changed-files allowlist guard catches extra file', () => {
  const outsideAllowlist = changedFilesOutsideAllowlist([
    MAIN_PATH,
    KERNEL_PATH,
    TEST_PATH,
    DONOR_TEST_PATH,
    'README.md',
  ]);

  assert.deepEqual(outsideAllowlist, ['README.md']);
});

test('Contour 12M changed-files allowlist guard passes in clean or dirty trees', () => {
  const status = execFileSync('git', ['status', '--porcelain', '-uall', '--', ...GUARDED_PATHS], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  const changedFiles = changedFilesFromGitStatus(status);
  const packageManifestDiff = changedFiles.filter((filePath) => (
    filePath === 'package.json'
    || filePath === 'package-lock.json'
    || filePath === 'npm-shrinkwrap.json'
  ));

  assert.deepEqual(changedFilesOutsideAllowlist(changedFiles), []);
  assert.deepEqual(packageManifestDiff, []);
});

test('Contour 12M source section stays command-surface only and free of UI expansion tokens', () => {
  const section = extractMarkedSection(readMainSource(), SECTION_START, SECTION_END);
  const forbiddenPatterns = [
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
  ];

  assert.match(section, /\bisReleaseClaimCommandExecutionWitnessPlainPayload\s*\(/u);
  assert.match(section, /\bcloneReleaseClaimCommandExecutionWitnessValue\s*\(/u);
  assert.match(section, /\bevaluateRevisionBridgeReleaseClaimExecutionGate\s*\(/u);
  assert.match(section, /\bPAYLOAD_PLAIN_OBJECT_REQUIRED\b/u);
  assert.match(section, /\bwitnessOnly:\s*true/u);
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(section), false, `forbidden contour token: ${pattern.source}`);
  }
});
