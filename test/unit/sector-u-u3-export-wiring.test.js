const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = process.cwd();
const FIXTURES_ROOT = path.join(ROOT, 'test', 'fixtures', 'sector-u', 'u3');
const projectCommandsModuleUrl = pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'projectCommands.mjs')).href;
const registryModuleUrl = pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'registry.mjs')).href;
const runnerModuleUrl = pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'runCommand.mjs')).href;

function readFixtureJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_ROOT, fileName), 'utf8'));
}

async function loadModules() {
  const registry = await import(registryModuleUrl);
  const runner = await import(runnerModuleUrl);
  const project = await import(projectCommandsModuleUrl);
  return {
    createCommandRegistry: registry.createCommandRegistry,
    createCommandRunner: runner.createCommandRunner,
    COMMAND_IDS: project.COMMAND_IDS,
    registerProjectCommands: project.registerProjectCommands,
  };
}

test('u3 export wiring: canonical fallback stub is preserved when backend hook is missing', async () => {
  const { createCommandRegistry, createCommandRunner, COMMAND_IDS, registerProjectCommands } = await loadModules();
  const registry = createCommandRegistry();
  registerProjectCommands(registry, { electronAPI: {} });
  const runCommand = createCommandRunner(registry);

  const result = await runCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN);
  assert.deepEqual(result, {
    ok: false,
    error: {
      code: 'E_UNWIRED_EXPORT_BACKEND',
      op: 'cmd.project.export.docxMin',
      reason: 'EXPORT_DOCXMIN_BACKEND_NOT_WIRED',
    },
  });
});

test('u3 export wiring: command uses electronAPI.exportDocxMin and returns deterministic success', async () => {
  const { createCommandRegistry, createCommandRunner, COMMAND_IDS, registerProjectCommands } = await loadModules();
  const fixtureRequest = readFixtureJson('export-request.json');
  let capturedPayload = null;
  const electronAPI = {
    exportDocxMin: async (payload) => {
      capturedPayload = payload;
      return { ok: 1, outPath: payload.outPath, bytesWritten: 123 };
    },
  };

  const registry = createCommandRegistry();
  registerProjectCommands(registry, { electronAPI });
  const runCommand = createCommandRunner(registry);

  const result = await runCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN, fixtureRequest);
  assert.deepEqual(capturedPayload, {
    requestId: 'u3-test-request',
    outPath: '/tmp/u3-test.docx',
    outDir: '',
    bufferSource: 'Line one\nLine two',
    options: {},
  });
  assert.deepEqual(result, {
    ok: true,
    value: {
      exported: true,
      outPath: '/tmp/u3-test.docx',
      bytesWritten: 123,
    },
  });
});

test('u3 export wiring: normalized DOCX command bridge success after side effect is exported success', async () => {
  const { createCommandRegistry, createCommandRunner, COMMAND_IDS, registerProjectCommands } = await loadModules();
  const fixtureRequest = readFixtureJson('export-request.json');
  let capturedRequest = null;
  const electronAPI = {
    invokeUiCommandBridge: async (request) => {
      capturedRequest = request;
      return {
        ok: true,
        value: {
          ok: true,
          outPath: fixtureRequest.outPath,
          bytesWritten: 123,
        },
      };
    },
  };

  const registry = createCommandRegistry();
  registerProjectCommands(registry, { electronAPI });
  const runCommand = createCommandRunner(registry);

  const result = await runCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN, fixtureRequest);
  assert.equal(capturedRequest.route, 'command.bus');
  assert.equal(capturedRequest.commandId, COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN);
  assert.deepEqual(result, {
    ok: true,
    value: {
      exported: true,
      outPath: fixtureRequest.outPath,
      bytesWritten: 123,
    },
  });
});

test('u3 export wiring: stale outer command bridge failure after DOCX side effect is not exported success', async () => {
  const { createCommandRegistry, createCommandRunner, COMMAND_IDS, registerProjectCommands } = await loadModules();
  const fixtureRequest = readFixtureJson('export-request.json');
  let capturedRequest = null;
  const electronAPI = {
    invokeUiCommandBridge: async (request) => {
      capturedRequest = request;
      return {
        ok: false,
        reason: 'COMMAND_EXECUTION_FAILED',
        value: {
          ok: 1,
          outPath: fixtureRequest.outPath,
          bytesWritten: 123,
        },
      };
    },
  };

  const registry = createCommandRegistry();
  registerProjectCommands(registry, { electronAPI });
  const runCommand = createCommandRunner(registry);

  const result = await runCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN, fixtureRequest);
  assert.equal(capturedRequest.route, 'command.bus');
  assert.equal(capturedRequest.commandId, COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN);
  assert.deepEqual(result, {
    ok: false,
    error: {
      code: 'E_COMMAND_FAILED',
      op: 'cmd.project.export.docxMin',
      reason: 'EXPORT_DOCXMIN_COMMAND_BRIDGE_FAILED',
      details: {
        bridgeReason: 'COMMAND_EXECUTION_FAILED',
      },
    },
  });
});

test('u3 export wiring: retry after outer command bridge failure can succeed on a fresh bridge call', async () => {
  const { createCommandRegistry, createCommandRunner, COMMAND_IDS, registerProjectCommands } = await loadModules();
  const fixtureRequest = readFixtureJson('export-request.json');
  const bridgeRequests = [];
  const electronAPI = {
    invokeUiCommandBridge: async (request) => {
      bridgeRequests.push(request);
      if (bridgeRequests.length === 1) {
        return {
          ok: false,
          reason: 'COMMAND_EXECUTION_FAILED',
          value: {
            ok: 1,
            outPath: fixtureRequest.outPath,
            bytesWritten: 123,
          },
        };
      }
      return {
        ok: true,
        value: {
          ok: 1,
          outPath: fixtureRequest.outPath,
          bytesWritten: 456,
        },
      };
    },
  };

  const registry = createCommandRegistry();
  registerProjectCommands(registry, { electronAPI });
  const runCommand = createCommandRunner(registry);

  const first = await runCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN, fixtureRequest);
  const second = await runCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN, fixtureRequest);
  assert.equal(bridgeRequests.length, 2);
  assert.deepEqual(bridgeRequests.map((request) => request.commandId), [
    COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN,
    COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN,
  ]);
  assert.deepEqual(first, {
    ok: false,
    error: {
      code: 'E_COMMAND_FAILED',
      op: 'cmd.project.export.docxMin',
      reason: 'EXPORT_DOCXMIN_COMMAND_BRIDGE_FAILED',
      details: {
        bridgeReason: 'COMMAND_EXECUTION_FAILED',
      },
    },
  });
  assert.deepEqual(second, {
    ok: true,
    value: {
      exported: true,
      outPath: fixtureRequest.outPath,
      bytesWritten: 456,
    },
  });
});

test('u3 export wiring: horizontal sheet text flows into export bufferSource payload', async () => {
  const { createCommandRegistry, createCommandRunner, COMMAND_IDS, registerProjectCommands } = await loadModules();
  const horizontalSheetText = 'Центральная лента листов: активный горизонтальный лист сохраняет plain text для DOCX export.';
  const request = {
    requestId: 'u3-horizontal-sheet-export-input',
    outPath: '/tmp/u3-horizontal-sheet.docx',
    bufferSource: horizontalSheetText,
  };
  let callCount = 0;
  let capturedPayload = null;
  const electronAPI = {
    exportDocxMin: async (payload) => {
      callCount += 1;
      capturedPayload = payload;
      return { ok: 1, outPath: payload.outPath, bytesWritten: 321 };
    },
  };

  const registry = createCommandRegistry();
  registerProjectCommands(registry, { electronAPI });
  const runCommand = createCommandRunner(registry);

  const result = await runCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN, request);
  assert.equal(callCount, 1);
  assert.equal(capturedPayload.requestId, request.requestId);
  assert.equal(capturedPayload.outPath, request.outPath);
  assert.equal(capturedPayload.bufferSource, horizontalSheetText);
  assert.deepEqual(result, {
    ok: true,
    value: {
      exported: true,
      outPath: request.outPath,
      bytesWritten: 321,
    },
  });
});

test('u3 export wiring: command maps typed backend error without random fields', async () => {
  const { createCommandRegistry, createCommandRunner, COMMAND_IDS, registerProjectCommands } = await loadModules();
  const fixtureError = readFixtureJson('export-error.json');
  const electronAPI = {
    exportDocxMin: async () => fixtureError,
  };

  const registry = createCommandRegistry();
  registerProjectCommands(registry, { electronAPI });
  const runCommand = createCommandRunner(registry);

  const result = await runCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN, { requestId: 'deterministic' });
  assert.deepEqual(result, {
    ok: false,
    error: {
      code: 'E_EXPORT_WRITE_FAILED',
      op: 'u:cmd:project:export:docxMin:v1',
      reason: 'DOCX_WRITE_FAILED',
    },
  });
});
