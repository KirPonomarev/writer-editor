const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MAIN_PATH = path.join(REPO_ROOT, 'src', 'main.js');
const SECTION_START = '// MARKDOWN_LOCAL_FILE_AUTHORITY_COMMAND_SURFACE_START';
const SECTION_END = '// MARKDOWN_LOCAL_FILE_AUTHORITY_COMMAND_SURFACE_END';

function extractMarkedSection(source) {
  const start = source.indexOf(SECTION_START);
  const end = source.indexOf(SECTION_END, start);
  assert.notEqual(start, -1, `missing marker: ${SECTION_START}`);
  assert.notEqual(end, -1, `missing marker: ${SECTION_END}`);
  return source.slice(start, end + SECTION_END.length);
}

function cloneJsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isPlainObjectValue(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function makeTypedMarkdownError(op, code, reason, details = {}) {
  return {
    ok: 0,
    error: {
      op,
      code,
      reason,
      details: isPlainObjectValue(details) ? cloneJsonSafe(details) : {},
    },
  };
}

function instantiateMarkdownLocalFilePort(options = {}) {
  const source = fs.readFileSync(MAIN_PATH, 'utf8');
  const section = extractMarkedSection(source);
  const calls = {
    imports: [],
    exports: [],
    picks: 0,
    reads: 0,
    snapshots: 0,
  };
  const sandbox = {
    Buffer,
    MARKDOWN_EXPORT_LOCAL_FILE_COMMAND_ID: 'cmd.project.markdown.exportLocalFile',
    MARKDOWN_IMPORT_LOCAL_FILE_ACCEPT_COMMAND_ID: 'cmd.project.markdown.acceptLocalPreview',
    MARKDOWN_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID: 'cmd.project.markdown.previewLocalFile',
    MARKDOWN_LOCAL_FILE_MAX_BYTES: 1024 * 1024,
    MARKDOWN_LOCAL_FILE_MAX_REQUEST_ID_CHARS: 120,
    MARKDOWN_LOCAL_FILE_PREVIEW_TTL_MS: 15 * 60 * 1000,
    calls,
    cloneJsonSafe,
    crypto,
    currentFilePath: '/project/roman/scene.txt',
    dialog: {
      showOpenDialog: async () => ({ canceled: true }),
    },
    fileManager: {
      getDocumentsPath: () => '/documents',
    },
    getProjectRootPath: () => '/project',
    handleExportMarkdownV1: async (payload) => {
      calls.exports.push(cloneJsonSafe(payload));
      if (typeof options.handleExportMarkdownV1 === 'function') {
        return options.handleExportMarkdownV1(payload);
      }
      return {
        ok: 1,
        canceled: false,
        outPath: '/external/secret-export.md',
        bytesWritten: 17,
        snapshotCreated: true,
        snapshotPath: '/external/recovery/secret.md',
        lossReport: { count: 0, items: [] },
      };
    },
    handleImportMarkdownV1: async (payload) => {
      calls.imports.push(cloneJsonSafe(payload));
      if (typeof options.handleImportMarkdownV1 === 'function') {
        return options.handleImportMarkdownV1(payload);
      }
      if (payload.safeCreate === true) {
        return {
          ok: 1,
          safeCreate: true,
          created: true,
          createdSceneIds: ['scene-1'],
          receipt: {
            schemaVersion: 'markdown-import-safe-create-receipt.v1',
            type: 'markdown.import.safeCreate.receipt',
            reason: 'ready',
            projectId: 'project-1',
            batchId: 'batch-1',
            inputHash: 'input-hash',
            outputHash: 'output-hash',
            createdSceneIds: ['scene-1'],
            createdScenes: [{
              sceneId: 'scene-1',
              path: '/project/roman/Imported/secret.txt',
              kind: 'scene',
              bytesWritten: 17,
              outputHash: 'scene-output-hash',
            }],
          },
        };
      }
      return {
        ok: 1,
        scene: { schemaVersion: 'markdown-scene.v1', blocks: [] },
        lossReport: { count: 0, items: [] },
        previewResult: {
          schemaVersion: 'markdown-import-preview.v1',
          type: 'markdown.import.preview',
          status: 'preview',
          writeEffects: false,
          sourcePath: '/external/secret-input.md',
          recovery: { snapshotPath: '/external/recovery/secret.md' },
          safeCreatePlan: {
            entries: [{
              sceneId: 'scene-1',
              path: '/project/roman/Imported/secret.txt',
              content: '# Literal',
            }],
          },
        },
      };
    },
    isPlainObjectValue,
    loadMarkdownTransformModule: async () => ({
      parseMarkdownV1(value) {
        return { schemaVersion: 'markdown-scene.v1', source: value };
      },
    }),
    mainWindow: {},
    makeTypedMarkdownError,
    module: { exports: {} },
    exports: {},
    path,
    pendingMarkdownLocalFilePreview: null,
    readExternalFileBounded: async () => {
      calls.reads += 1;
      return { bytes: Buffer.from('# Literal', 'utf8'), byteLength: 9 };
    },
    requestEditorSnapshot: async () => {
      calls.snapshots += 1;
      return { plainText: '# Literal' };
    },
  };

  vm.runInNewContext(
    `${section}
module.exports = {
  calls,
  handleMarkdownImportLocalFileAcceptCommandSurface,
  handleMarkdownImportLocalFilePreviewCommandSurface,
  handleMarkdownExportLocalFileCommandSurface,
};`,
    sandbox,
    { filename: MAIN_PATH },
  );
  return sandbox.module.exports;
}

test('Phase 03 Markdown preview keeps file authority in main and returns a pathless envelope', async () => {
  const port = instantiateMarkdownLocalFilePort();
  const result = await port.handleMarkdownImportLocalFilePreviewCommandSurface(
    { requestId: 'markdown-preview-1' },
    {
      pickLocalFile: async () => {
        port.calls.picks += 1;
        return {
          filePath: '/external/input.md',
          sourceName: 'input.md',
        };
      },
    },
  );

  assert.equal(result.ok, 1, JSON.stringify(result, null, 2));
  assert.equal(result.commandId, 'cmd.project.markdown.previewLocalFile');
  assert.match(result.previewId, /^mdp_[a-f0-9]{24}$/u);
  assert.equal(port.calls.picks, 1);
  assert.equal(port.calls.reads, 1);
  assert.equal(result.previewResult.sourcePath, undefined);
  assert.equal(result.previewResult.recovery, undefined);
  assert.equal(result.previewResult.safeCreatePlan.entries[0].path, undefined);
  assert.equal(JSON.stringify(result).includes('/external/'), false);
  assert.equal(JSON.stringify(result).includes('/project/'), false);

  const accepted = await port.handleMarkdownImportLocalFileAcceptCommandSurface({
    requestId: 'markdown-accept-1',
    previewId: result.previewId,
  });
  assert.equal(accepted.ok, 1, JSON.stringify(accepted, null, 2));
  assert.equal(accepted.commandId, 'cmd.project.markdown.acceptLocalPreview');
  assert.equal(port.calls.imports[1].previewPayload.safeCreatePlan.entries[0].path, '/project/roman/Imported/secret.txt');
  assert.equal(accepted.receipt.createdScenes[0].path, undefined);
  assert.equal(JSON.stringify(accepted).includes('/project/'), false);

  const replay = await port.handleMarkdownImportLocalFileAcceptCommandSurface({
    requestId: 'markdown-accept-replay',
    previewId: result.previewId,
  });
  assert.equal(replay.ok, 0);
  assert.equal(replay.error.reason, 'local_file_preview_stale');
});

test('Phase 03 Markdown intent routes reject renderer paths and content before any authority call', async () => {
  const port = instantiateMarkdownLocalFilePort();
  const preview = await port.handleMarkdownImportLocalFilePreviewCommandSurface({
    requestId: 'markdown-preview-denied',
    sourcePath: '/renderer/input.md',
    text: '# renderer content',
  }, {
    pickLocalFile: async () => {
      port.calls.picks += 1;
      return { canceled: true };
    },
  });
  assert.equal(preview.ok, 0);
  assert.equal(preview.error.reason, 'renderer_authority_denied');
  assert.equal(port.calls.picks, 0);
  assert.equal(port.calls.reads, 0);

  const exported = await port.handleMarkdownExportLocalFileCommandSurface({
    requestId: 'markdown-export-denied',
    outPath: '/renderer/output.md',
    scene: { blocks: [] },
  });
  assert.equal(exported.ok, 0);
  assert.equal(exported.error.reason, 'renderer_authority_denied');
  assert.equal(port.calls.snapshots, 0);
  assert.equal(port.calls.exports.length, 0);
});

test('Phase 03 Markdown Save As sends only intent input and hides target and recovery paths', async () => {
  const port = instantiateMarkdownLocalFilePort();
  const result = await port.handleMarkdownExportLocalFileCommandSurface({
    requestId: 'markdown-export-1',
  });

  assert.equal(result.ok, 1, JSON.stringify(result, null, 2));
  assert.equal(result.commandId, 'cmd.project.markdown.exportLocalFile');
  assert.equal(result.exported, true);
  assert.equal(result.outPath, undefined);
  assert.equal(result.snapshotPath, undefined);
  assert.equal(JSON.stringify(result).includes('/external/'), false);
  assert.equal(port.calls.snapshots, 1);
  assert.equal(port.calls.exports.length, 1);
  assert.equal(port.calls.exports[0].outPath, undefined);
  assert.equal(port.calls.exports[0].saveAs, true);
  assert.equal(port.calls.exports[0].scene.source, '# Literal');
});

test('Phase 03 Markdown low-level errors are remapped without private path details', async () => {
  const port = instantiateMarkdownLocalFilePort({
    handleExportMarkdownV1: async () => ({
      ok: 0,
      error: {
        code: 'E_MD_EXPORT_TARGET_FORBIDDEN',
        reason: 'EXTERNAL_TARGET_INSIDE_PROJECT_DENIED',
        details: {
          outPath: '/project/manifest.json',
          logPath: '/external/log.jsonl',
        },
      },
    }),
  });
  const result = await port.handleMarkdownExportLocalFileCommandSurface({ requestId: 'markdown-export-error' });

  assert.equal(result.ok, 0);
  assert.equal(result.error.op, 'cmd.project.markdown.exportLocalFile');
  assert.equal(result.error.code, 'E_MD_EXPORT_TARGET_FORBIDDEN');
  assert.equal(result.error.reason, 'EXTERNAL_TARGET_INSIDE_PROJECT_DENIED');
  assert.deepEqual(result.error.details, {});
  assert.equal(JSON.stringify(result).includes('/project/'), false);
  assert.equal(JSON.stringify(result).includes('/external/'), false);
});
