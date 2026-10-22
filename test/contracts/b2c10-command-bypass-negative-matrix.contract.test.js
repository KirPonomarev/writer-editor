const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = process.cwd();
const MODULE_PATH = path.join(REPO_ROOT, 'scripts', 'ops', 'b2c10-command-bypass-negative-matrix-state.mjs');
const STATUS_PATH = path.join(REPO_ROOT, 'docs', 'OPS', 'STATUS', 'B2C10_COMMAND_BYPASS_NEGATIVE_MATRIX_STATUS_V1.json');

let modulePromise = null;

function loadModule() {
  if (!modulePromise) {
    modulePromise = import(pathToFileURL(MODULE_PATH).href);
  }
  return modulePromise;
}

function readStatusPacket() {
  return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
}

test('b2c10 bypass negative matrix: current canonical core remains green and advisory tails are explicit', async () => {
  const { evaluateB2C10CommandBypassNegativeMatrixState, TOKEN_NAME } = await loadModule();
  const state = evaluateB2C10CommandBypassNegativeMatrixState({ repoRoot: REPO_ROOT });

  assert.equal(state.ok, true, JSON.stringify(state, null, 2));
  assert.equal(state[TOKEN_NAME], 1);
  assert.equal(state.commandSurfaceCoreOk, true);
  assert.equal(state.callerTrustCoreOk, true);
  assert.equal(state.commandSurfaceState.tokenEnforced, 1);
  assert.equal(state.commandSurfaceState.tokenBypassTests, 1);
  assert.equal(state.callerTrustState.tokenOk, 1);
  assert.deepEqual(state.failRows, []);
});

test('b2c10 bypass negative matrix: mandatory bypass routes are machine-proved rejected', async () => {
  const { evaluateB2C10CommandBypassNegativeMatrixState } = await loadModule();
  const state = evaluateB2C10CommandBypassNegativeMatrixState({ repoRoot: REPO_ROOT });
  const provedRejected = new Map(
    state.coverageMatrix
      .filter((row) => row.status === 'PROVED_REJECTED')
      .map((row) => [row.routeId, row]),
  );

  for (const routeId of [
    'hotkey.direct',
    'palette.direct',
    'ipc.renderer-main.direct',
    'context.button.direct',
    'plugin.overlay.exec',
  ]) {
    assert.equal(provedRejected.has(routeId), true, routeId);
  }
});

test('b2c10 bypass negative matrix: extra existing mutation surfaces stay advisory and signals stay out of scope', async () => {
  const { evaluateB2C10CommandBypassNegativeMatrixState } = await loadModule();
  const state = evaluateB2C10CommandBypassNegativeMatrixState({ repoRoot: REPO_ROOT });

  assert.deepEqual(
    state.advisoryGapRows,
    [
      'autosave.request',
      'editor.paste-handler',
      'tree.document.direct-electron-api',
    ],
  );
  assert.deepEqual(
    state.outOfScopeSignalRows,
    [
      'dirty-state.signal-bridge',
      'save-lifecycle.signal-bridge',
    ],
  );
});

test('b2c10 bypass negative matrix: committed status packet matches executable state', async () => {
  const { evaluateB2C10CommandBypassNegativeMatrixState } = await loadModule();
  const state = evaluateB2C10CommandBypassNegativeMatrixState({ repoRoot: REPO_ROOT });
  const packet = readStatusPacket();
  assert.deepEqual(packet, state);
});

test('b2c10 guarded registration executes actual Main guards before observed product or menu dispatch', async () => {
  const { evaluateCommandBridgeRegistration } = await loadModule();
  const mainText = fs.readFileSync(path.join(REPO_ROOT, 'src/main.js'), 'utf8');
  const proof = evaluateCommandBridgeRegistration({ mainText, repoRoot: REPO_ROOT });
  assert.equal(proof.ok, true, JSON.stringify(proof));
  assert.equal(proof.sourceBound, true);
  assert.deepEqual(proof.cases.map(row => row.id), [
    'product.allowed', 'menu.allowed', 'caller.sender', 'caller.session',
    'caller.frame', 'caller.destroyed', 'caller.revoked', 'envelope.invalid',
    'route.invalid', 'command.denied', 'profile.denied',
  ]);
  assert.equal(proof.cases.every(row => row.pass), true);
});

test('b2c10 guarded registration rejects removed, weakened, reordered and bypassed guards', async t => {
  const { evaluateCommandBridgeRegistration } = await loadModule();
  const original = fs.readFileSync(path.join(REPO_ROOT, 'src/main.js'), 'utf8');
  const envelope = "  const envelopeVerdict = validateIpcEnvelope(request, 'ui:command-bridge');\n"
    + '  if (!envelopeVerdict.ok) {\n    return { ok: false, reason: envelopeVerdict.code };\n  }\n';
  const cases = [
    ['raw registration', "guardedProtocolHandle('ui:command-bridge', async (_, request) => {", "ipcMain.handle('ui:command-bridge', async (_, request) => {"],
    ['protocol wrapper bypass', "guardedProtocolHandle('ui:command-bridge', async (_, request) => {", "guardedHandle('ui:command-bridge', async (_, request) => {"],
    ['caller factory removed', 'const GUARDED_IPC_REGISTRATION = createGuardedIpcRegistration(ipcMain, IPC_CALLER_IDENTITY_POLICY);', 'const GUARDED_IPC_REGISTRATION = ipcMain;'],
    ['caller import changed', "} = require('./core/ipc-caller-identity-v1.cjs');", "} = require('./untrusted-guard.cjs');"],
    ['capability channel missing', "  'ui:command-bridge': 'command.dispatch',\n", ''],
    ['envelope removed', envelope, ''],
    ['envelope weakened', 'if (!envelopeVerdict.ok) {', 'if (false && !envelopeVerdict.ok) {'],
    ['envelope wrong input', "validateIpcEnvelope(request, 'ui:command-bridge')", "validateIpcEnvelope({ ...request, v: 1 }, 'ui:command-bridge')"],
    ['route weakened', 'if (route !== COMMAND_BUS_ROUTE) {', 'if (false && route !== COMMAND_BUS_ROUTE) {'],
    ['route inverted', 'if (route !== COMMAND_BUS_ROUTE) {', 'if (route === COMMAND_BUS_ROUTE) {'],
    ['allowlist weakened', 'if (!UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS.has(commandId)) {', 'if (false && !UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS.has(commandId)) {'],
    ['profile weakened', 'if (!profileAccess.allowed) {', 'if (false && !profileAccess.allowed) {'],
    ['profile wrong command', '    productCommandRecord: getProductCommandRecord(commandId),', "    productCommandRecord: getProductCommandRecord(commandId), commandId: 'cmd.menu',"],
    ['menu dispatch route bypass', "await dispatchMenuCommand(commandId, payload, { route: COMMAND_BUS_ROUTE, invocationSource: 'ui-command-bridge' });", "await dispatchMenuCommand(commandId, payload, { route: 'direct', invocationSource: 'ui-command-bridge' });"],
    ['dispatch before admission', "guardedProtocolHandle('ui:command-bridge', async (_, request) => {", "guardedProtocolHandle('ui:command-bridge', async (_, request) => {\n  await dispatchProductCommandBridge('cmd.product', {});"],
  ];
  for (const [name, from, to] of cases) {
    await t.test(name, () => {
      assert.equal(original.includes(from), true, `mutation anchor: ${name}`);
      const mainText = original.replace(from, to);
      const proof = evaluateCommandBridgeRegistration({ mainText, repoRoot: REPO_ROOT });
      assert.equal(proof.ok, false, name);
    });
  }
  await t.test('envelope after interpretation', () => {
    assert.equal(original.includes(envelope), true);
    const without = original.replace(envelope, '');
    const marker = '  if (route !== COMMAND_BUS_ROUTE) {';
    const mainText = without.replace(marker, envelope + marker);
    assert.equal(evaluateCommandBridgeRegistration({ mainText, repoRoot: REPO_ROOT }).ok, false);
  });
  await t.test('second raw registration despite guarded words', () => {
    const mainText = original + "\nipcMain.handle('ui:command-bridge', () => ({ ok: true }));\n";
    assert.equal(evaluateCommandBridgeRegistration({ mainText, repoRoot: REPO_ROOT }).ok, false);
  });
});
