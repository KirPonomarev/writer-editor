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
const TEST_PATH = 'test/contracts/revision-bridge-release-claim-command-surface-admission-wiring.contract.test.js';
const DONOR_TEST_PATH = 'test/contracts/donor-port-command-surface-kernel.contract.test.js';
const RELEASE_CLAIM_COMMAND_ID = 'cmd.project.releaseClaim.admit';
const ALLOWLIST = [MAIN_PATH, KERNEL_PATH, TEST_PATH, DONOR_TEST_PATH];
const GUARDED_PATHS = [
  ...ALLOWLIST,
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
];
const SECTION_START = '// CONTOUR_12L_COMMAND_SURFACE_RELEASE_CLAIM_ADMISSION_START';
const SECTION_END = '// CONTOUR_12L_COMMAND_SURFACE_RELEASE_CLAIM_ADMISSION_END';

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

function syntheticAcceptedCommandAdmissionResult(overrides = {}) {
  const bindingOverrides = overrides.binding || {};
  const summaryOverrides = overrides.summary || {};
  return {
    ok: true,
    type: 'revisionBridge.releaseClaimCommandAdmission',
    status: 'accepted',
    code: 'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_ACCEPTED',
    reason: 'REVISION_BRIDGE_RELEASE_CLAIM_COMMAND_ADMISSION_ACCEPTED',
    ...overrides,
    binding: {
      mode: 'RELEASE_MODE',
      claimId: 'release-claim-1',
      dossierId: 'release-claim-dossier-1',
      matrixId: 'format-matrix-1',
      releaseClass: 'USER_FACING_CLAIM_READY',
      ...bindingOverrides,
    },
    summary: {
      claimSurface: 'USER_FACING',
      packetId: 'release-claim-packet-1',
      attestationId: 'attestation-1',
      commandId: 'cmd.release.claim.publish',
      admissionClass: 'USER_FACING',
      ...summaryOverrides,
    },
  };
}

function validExecutionGateInput(bridge, overrides = {}) {
  const requestedMode = overrides.requestedMode || 'RELEASE_MODE';
  const requestedClaimSurface = overrides.requestedClaimSurface || 'USER_FACING';
  const commandAdmissionResult = overrides.commandAdmissionResult
    || syntheticAcceptedCommandAdmissionResult({
      binding: {
        mode: requestedMode,
        releaseClass: requestedClaimSurface === 'USER_FACING'
          ? 'USER_FACING_CLAIM_READY'
          : 'INTERNAL_PROOF_ONLY',
      },
      summary: {
        claimSurface: requestedClaimSurface,
        commandId: requestedClaimSurface === 'USER_FACING'
          ? 'cmd.release.claim.publish'
          : 'cmd.release.claim.internalProof',
        admissionClass: requestedClaimSurface === 'USER_FACING'
          ? 'USER_FACING'
          : 'INTERNAL',
      },
    });

  return {
    schemaVersion: bridge.REVISION_BRIDGE_RELEASE_CLAIM_EXECUTION_GATE_SCHEMA,
    commandAdmissionResult,
    requestedMode,
    requestedClaimSurface,
  };
}

function instantiateAdmissionHandler(loadRevisionBridgeModule) {
  const mainSource = readMainSource();
  const section = extractMarkedSection(mainSource, SECTION_START, SECTION_END);
  const context = {
    loadRevisionBridgeModule,
    module: { exports: {} },
    exports: {},
  };
  vm.runInNewContext(
    `${section}\nmodule.exports = { handleRevisionBridgeReleaseClaimCommandSurfaceAdmission };`,
    context,
    { filename: MAIN_PATH },
  );
  return context.module.exports.handleRevisionBridgeReleaseClaimCommandSurfaceAdmission;
}

test('Contour 12L command surface admission wiring exports the release-claim command id through kernel allowlist', () => {
  assert.equal(ALLOWED_COMMAND_IDS.includes(RELEASE_CLAIM_COMMAND_ID), true);

  const kernel = createCommandSurfaceKernel({
    [RELEASE_CLAIM_COMMAND_ID]: async () => ({ ok: true }),
  });

  assert.equal(kernel.listAllowedCommandIds().includes(RELEASE_CLAIM_COMMAND_ID), true);
});

test('Contour 12L command surface admission wiring path calls 12K execution gate', async () => {
  const calls = [];
  let loadCount = 0;
  const expected = { ok: true, type: 'revisionBridge.releaseClaimExecutionGate', status: 'accepted' };
  const handler = instantiateAdmissionHandler(async () => {
    loadCount += 1;
    return {
      evaluateRevisionBridgeReleaseClaimExecutionGate(payload) {
        calls.push(payload);
        return expected;
      },
    };
  });
  const payload = {
    schemaVersion: 'revision-bridge.release-claim-execution-gate.v1',
    commandAdmissionResult: { ok: true },
    requestedMode: 'PR_MODE',
    requestedClaimSurface: 'INTERNAL',
  };

  const result = await handler(payload);

  assert.equal(loadCount, 1);
  assert.deepEqual(calls, [payload]);
  assert.deepEqual(result, expected);
});

test('Contour 12L accepted 12K result returns admission-only result', async () => {
  const bridge = await loadBridge();
  const handler = instantiateAdmissionHandler(async () => bridge);
  const payload = validExecutionGateInput(bridge, {
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });

  const result = await handler(payload);
  const expected = bridge.evaluateRevisionBridgeReleaseClaimExecutionGate(payload);

  assert.equal(result.ok, true);
  assert.equal(result.status, 'accepted');
  assert.deepEqual(result, expected);
});

test('Contour 12L blocked 12K result stops path', async () => {
  const bridge = await loadBridge();
  const handler = instantiateAdmissionHandler(async () => bridge);
  const payload = validExecutionGateInput(bridge, {
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
    commandAdmissionResult: syntheticAcceptedCommandAdmissionResult({
      binding: {
        mode: 'PR_MODE',
        releaseClass: 'USER_FACING_CLAIM_READY',
      },
      summary: {
        claimSurface: 'USER_FACING',
        admissionClass: 'USER_FACING',
      },
    }),
  });

  const result = await handler(payload);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(
    result.reason,
    'REVISION_BRIDGE_RELEASE_CLAIM_EXECUTION_GATE_REQUESTED_MODE_MISMATCH',
  );
});

test('Contour 12L direct non-bus route is blocked', () => {
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

test('Contour 12L command id not on allowlist is blocked', async () => {
  const kernel = createCommandSurfaceKernel({
    [RELEASE_CLAIM_COMMAND_ID]: async () => ({ ok: true }),
  });
  const result = await kernel.dispatch('cmd.project.releaseClaim.directBypass', {});

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'E_COMMAND_ID_NOT_ALLOWED');
  assert.equal(result.error.reason, 'COMMAND_ID_NOT_ALLOWED');
});

test('Contour 12L admission-only result is deterministic', async () => {
  const bridge = await loadBridge();
  const handler = instantiateAdmissionHandler(async () => bridge);
  const payload = validExecutionGateInput(bridge, {
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });

  const first = await handler(payload);
  const second = await handler(payload);

  assert.deepEqual(first, second);
});

test('Contour 12L admission-only path is non-mutating', async () => {
  const bridge = await loadBridge();
  const handler = instantiateAdmissionHandler(async () => bridge);
  const payload = validExecutionGateInput(bridge, {
    requestedMode: 'RELEASE_MODE',
    requestedClaimSurface: 'USER_FACING',
  });
  const before = deepClone(payload);

  await handler(payload);

  assert.deepEqual(payload, before);
});

test('Contour 12L changed-files allowlist guard catches extra file', () => {
  const outsideAllowlist = changedFilesOutsideAllowlist([
    MAIN_PATH,
    KERNEL_PATH,
    TEST_PATH,
    DONOR_TEST_PATH,
    'README.md',
  ]);

  assert.deepEqual(outsideAllowlist, ['README.md']);
});

test('Contour 12L changed-files allowlist guard passes in clean or dirty trees', () => {
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

test('Contour 12L source section stays command-surface only and free of UI expansion tokens', () => {
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

  assert.match(section, /\bevaluateRevisionBridgeReleaseClaimExecutionGate\s*\(/u);
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(section), false, `forbidden contour token: ${pattern.source}`);
  }
});
