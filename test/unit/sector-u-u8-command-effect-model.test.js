const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = process.cwd();
const moduleUrl = pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'commandEffectModel.mjs')).href;

async function loadModule() {
  return import(moduleUrl);
}

test('u8 command effect model: ui action operation plan is deterministic and build is side-effect free', async () => {
  const { captureCommandEffectCapabilities, buildCommandOperationPlan } = await loadModule();
  let calls = 0;
  const uiActions = {
    openSettings() {
      calls += 1;
      return { ok: true };
    },
  };

  const capabilities = captureCommandEffectCapabilities({ uiActions });
  const spec = {
    effectType: 'ui-action',
    commandId: 'cmd.project.view.openSettings',
    actionName: 'openSettings',
    payload: { section: 'write' },
  };

  const planA = buildCommandOperationPlan(spec, capabilities);
  const planB = buildCommandOperationPlan(spec, capabilities);

  assert.deepEqual(planA, planB);
  assert.equal(calls, 0);
  assert.equal(planA.ok, true);
  assert.equal(planA.value.kind, 'ui-action');
});

test('u8 command effect model: persist executes ui action and bridge only in persist phase', async () => {
  const {
    captureCommandEffectCapabilities,
    buildCommandOperationPlan,
    persistCommandOperationPlan,
    unwrapBridgeResponseValue,
  } = await loadModule();

  let uiCalls = 0;
  let bridgeCalls = 0;
  const uiActions = {
    openSettings(payload) {
      uiCalls += 1;
      return { ok: true, payload };
    },
  };
  const electronAPI = {
    invokeUiCommandBridge(request) {
      bridgeCalls += 1;
      return { ok: 1, value: request };
    },
  };

  const uiPlan = buildCommandOperationPlan(
    {
      effectType: 'ui-action',
      commandId: 'cmd.project.view.openSettings',
      actionName: 'openSettings',
      payload: { section: 'review' },
    },
    captureCommandEffectCapabilities({ uiActions }),
  );
  const bridgePlan = buildCommandOperationPlan(
    {
      effectType: 'electron-bridge-only',
      commandId: 'cmd.project.tree.createNode',
      payload: { parentPath: 'book', kind: 'scene', name: 'A' },
    },
    captureCommandEffectCapabilities({ electronAPI }),
  );

  assert.equal(uiCalls, 0);
  assert.equal(bridgeCalls, 0);

  const uiResult = await persistCommandOperationPlan(uiPlan.value, { uiActions });
  const bridgeResult = unwrapBridgeResponseValue(
    await persistCommandOperationPlan(bridgePlan.value, { electronAPI }),
  );

  assert.equal(uiCalls, 1);
  assert.equal(bridgeCalls, 1);
  assert.equal(uiResult.ok, true);
  assert.equal(bridgeResult.route, 'command.bus');
  assert.equal(bridgeResult.commandId, 'cmd.project.tree.createNode');
});

test('u8 command effect model: legacy fallback stays typed and bridge-preferred path remains machine-bound', async () => {
  const { captureCommandEffectCapabilities, buildCommandOperationPlan } = await loadModule();

  const bridgePlan = buildCommandOperationPlan(
    {
      effectType: 'electron-bridge-or-legacy',
      commandId: 'cmd.project.open',
      payload: {},
      fallbackMethodName: 'openFile',
      legacyPayload: { intent: 'open' },
    },
    captureCommandEffectCapabilities({
      electronAPI: {
        invokeUiCommandBridge() {},
        openFile() {},
      },
    }),
  );

  const legacyPlan = buildCommandOperationPlan(
    {
      effectType: 'electron-bridge-or-legacy',
      commandId: 'cmd.project.open',
      payload: {},
      fallbackMethodName: 'openFile',
      legacyPayload: { intent: 'open' },
    },
    captureCommandEffectCapabilities({
      electronAPI: {
        openFile() {},
      },
    }),
  );

  assert.equal(bridgePlan.ok, true);
  assert.equal(bridgePlan.value.kind, 'electron-bridge');
  assert.equal(legacyPlan.ok, true);
  assert.equal(legacyPlan.value.kind, 'electron-legacy');
});
