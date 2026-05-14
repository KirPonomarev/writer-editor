const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..', '..');

async function loadCommandModules() {
  const registryModule = await import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'registry.mjs')).href);
  const runnerModule = await import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'runCommand.mjs')).href);
  const projectModule = await import(pathToFileURL(path.join(ROOT, 'src', 'renderer', 'commands', 'projectCommands.mjs')).href);
  return { ...registryModule, ...runnerModule, ...projectModule };
}

function fixture(name) {
  return fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'sector-m', 'm3', name), 'utf8');
}

test('M3 commands: import/export markdown return deterministic success payloads', async () => {
  const {
    createCommandRegistry,
    createCommandRunner,
    registerProjectCommands,
    COMMAND_IDS,
  } = await loadCommandModules();

  const sourceMarkdown = fixture('simple.md');
  const expectedImport = JSON.parse(fixture('expected-import.json'));
  const expectedExport = JSON.parse(fixture('expected-export.json'));

  const electronAPI = {
    importMarkdownV1: async (payload) => {
      assert.equal(payload.text, sourceMarkdown);
      return {
        ok: 1,
        scene: {
          kind: expectedImport.kind,
          blocks: [],
          nodeCount: 0,
          lossReport: { count: expectedImport.lossCount, items: [] },
        },
        lossReport: { count: expectedImport.lossCount, items: [] },
      };
    },
    exportMarkdownV1: async (payload) => {
      assert.deepEqual(payload.scene, expectedExport.scene);
      return {
        ok: 1,
        markdown: expectedExport.markdown,
        lossReport: { count: 0, items: [] },
      };
    },
  };

  const registry = createCommandRegistry();
  registerProjectCommands(registry, { electronAPI });
  const runCommand = createCommandRunner(registry);

  const imported = await runCommand(COMMAND_IDS.PROJECT_IMPORT_MARKDOWN_V1, { text: sourceMarkdown });
  assert.deepEqual(imported, {
    ok: true,
    value: {
      imported: true,
      scene: {
        kind: expectedImport.kind,
        blocks: [],
        nodeCount: 0,
        lossReport: { count: expectedImport.lossCount, items: [] },
      },
      lossReport: { count: expectedImport.lossCount, items: [] },
    },
  });

  const exported = await runCommand(COMMAND_IDS.PROJECT_EXPORT_MARKDOWN_V1, { scene: expectedExport.scene });
  assert.deepEqual(exported, {
    ok: true,
    value: {
      exported: true,
      markdown: expectedExport.markdown,
      lossReport: { count: 0, items: [] },
    },
  });
});

test('M3 commands: import preview forwards preview flag and preserves preview envelope', async () => {
  const {
    createCommandRegistry,
    createCommandRunner,
    registerProjectCommands,
    COMMAND_IDS,
  } = await loadCommandModules();

  const sourceMarkdown = fixture('simple.md');
  const previewEnvelope = {
    schemaVersion: 'markdown-import-preview.v1',
    type: 'markdown.import.preview',
    status: 'preview',
    writeEffects: false,
    sourceName: 'fixture.md',
    sourcePath: '/tmp/fixture.md',
    scene: {
      kind: 'scene.v1',
      blocks: [],
      nodeCount: 0,
      lossReport: { count: 0, items: [] },
    },
    lossReport: { count: 0, items: [] },
  };

  const registry = createCommandRegistry();
  registerProjectCommands(registry, {
    electronAPI: {
      importMarkdownV1: async (payload) => {
        assert.equal(payload.preview, true);
        assert.equal(payload.text, sourceMarkdown);
        return {
          ok: 1,
          preview: true,
          scene: previewEnvelope.scene,
          lossReport: previewEnvelope.lossReport,
          previewResult: previewEnvelope,
        };
      },
    },
  });
  const runCommand = createCommandRunner(registry);

  const imported = await runCommand(COMMAND_IDS.PROJECT_IMPORT_MARKDOWN_V1, {
    text: sourceMarkdown,
    sourceName: 'fixture.md',
    sourcePath: '/tmp/fixture.md',
    preview: true,
  });

  assert.deepEqual(imported, {
    ok: true,
    value: {
      imported: true,
      preview: true,
      previewResult: previewEnvelope,
      scene: previewEnvelope.scene,
      lossReport: previewEnvelope.lossReport,
    },
  });
});

test('M3 commands: safe create import forwards approved preview payload and preserves receipt', async () => {
  const {
    createCommandRegistry,
    createCommandRunner,
    registerProjectCommands,
    COMMAND_IDS,
  } = await loadCommandModules();

  const approvedPreviewPayload = {
    schemaVersion: 'markdown-import-preview.v1',
    type: 'markdown.import.preview',
    status: 'preview',
    writeEffects: false,
    safeCreatePlan: {
      mode: 'create-only',
      entries: [
        {
          sceneId: 'scene-a',
          path: '/tmp/scene-a.txt',
          content: 'Alpha\n',
        },
      ],
    },
  };
  const receipt = {
    schemaVersion: 'markdown-import-safe-create-receipt.v1',
    type: 'markdown.import.safeCreate.receipt',
    reason: 'MARKDOWN_IMPORT_SAFE_CREATE_APPLIED',
    inputHash: 'a'.repeat(64),
    outputHash: 'b'.repeat(64),
    createdSceneIds: ['scene-a'],
    createdScenes: [
      {
        sceneId: 'scene-a',
        path: '/tmp/scene-a.txt',
        kind: 'chapter-file',
        bytesWritten: 6,
        outputHash: 'c'.repeat(64),
      },
    ],
  };

  const registry = createCommandRegistry();
  registerProjectCommands(registry, {
    electronAPI: {
      importMarkdownV1: async (payload) => {
        assert.equal(payload.safeCreate, true);
        assert.deepEqual(payload.previewPayload, approvedPreviewPayload);
        return {
          ok: 1,
          safeCreate: true,
          created: true,
          createdSceneIds: ['scene-a'],
          receipt,
        };
      },
    },
  });
  const runCommand = createCommandRunner(registry);

  const imported = await runCommand(COMMAND_IDS.PROJECT_IMPORT_MARKDOWN_V1, {
    safeCreate: true,
    previewPayload: approvedPreviewPayload,
  });

  assert.deepEqual(imported, {
    ok: true,
    value: {
      imported: true,
      safeCreate: true,
      created: true,
      createdSceneIds: ['scene-a'],
      receipt,
    },
  });
});

test('M3 commands: typed errors are stable and stack is not exposed', async () => {
  const {
    createCommandRegistry,
    createCommandRunner,
    registerProjectCommands,
    COMMAND_IDS,
  } = await loadCommandModules();

  const registry = createCommandRegistry();
  registerProjectCommands(registry, {
    electronAPI: {
      importMarkdownV1: async () => ({
        ok: 0,
        error: {
          code: 'MDV1_SECURITY_VIOLATION',
          op: 'm:cmd:project:import:markdownV1:v1',
          reason: 'raw_html_not_allowed',
        },
      }),
      exportMarkdownV1: async () => {
        throw new Error('backend exploded');
      },
    },
  });
  const runCommand = createCommandRunner(registry);

  const importResult = await runCommand(COMMAND_IDS.PROJECT_IMPORT_MARKDOWN_V1, { text: fixture('unsafe.html.md') });
  assert.equal(importResult.ok, false);
  assert.equal(importResult.error.code, 'MDV1_SECURITY_VIOLATION');
  assert.equal(importResult.error.reason, 'raw_html_not_allowed');
  assert.equal(Object.prototype.hasOwnProperty.call(importResult.error, 'stack'), false);

  const exportResult = await runCommand(COMMAND_IDS.PROJECT_EXPORT_MARKDOWN_V1, { scene: { kind: 'scene.v1', blocks: [] } });
  assert.equal(exportResult.ok, false);
  assert.equal(exportResult.error.code, 'MDV1_INTERNAL_ERROR');
  assert.equal(exportResult.error.reason, 'EXPORT_MARKDOWN_IPC_FAILED');
  assert.equal(Object.prototype.hasOwnProperty.call(exportResult.error, 'stack'), false);
});

test('M3 commands: export requires scene payload', async () => {
  const {
    createCommandRegistry,
    createCommandRunner,
    registerProjectCommands,
    COMMAND_IDS,
  } = await loadCommandModules();

  const registry = createCommandRegistry();
  registerProjectCommands(registry, {
    electronAPI: {
      exportMarkdownV1: async () => ({ ok: 1, markdown: 'x\n', lossReport: { count: 0, items: [] } }),
    },
  });
  const runCommand = createCommandRunner(registry);
  const result = await runCommand(COMMAND_IDS.PROJECT_EXPORT_MARKDOWN_V1, {});
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'MDV1_INTERNAL_ERROR');
  assert.equal(result.error.reason, 'EXPORT_MARKDOWN_SCENE_REQUIRED');
});
