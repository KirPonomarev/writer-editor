const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function loadMarkdownExportHandler() {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('async function handleMarkdownExportUiPath()');
  const end = editor.indexOf('function getPlainText()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const source = editor.slice(start, end);
  return {
    source,
    handle: (context) => vm.runInNewContext(`${source}
handleMarkdownExportUiPath`, context),
  };
}

test('Markdown export save-as UI path uses save dialog intent as primary path', async () => {
  const { handle } = loadMarkdownExportHandler();
  const scene = { kind: 'scene.v1', blocks: [] };
  const calls = [];
  const handleMarkdownExportUiPath = handle({
    MARKDOWN_EXPORT_STATUS_MESSAGE: 'Exported Markdown v1',
    MARKDOWN_EXPORT_CANCELLED_STATUS_MESSAGE: 'Export Markdown cancelled',
    MARKDOWN_EXPORT_SAVE_FAILED_STATUS_MESSAGE: 'Export Markdown save failed',
    getPlainText: () => 'current buffer',
    runMarkdownImportCommand: async (text, sourceName) => {
      calls.push(['import', text, sourceName]);
      return { ok: true, value: { scene } };
    },
    resolveSceneFromImportResult: (result) => result.value.scene,
    runMarkdownExportCommand: async (inputScene, options) => {
      calls.push(['export', inputScene, options]);
      return {
        ok: true,
        value: {
          exported: true,
          outPath: path.join(ROOT, 'tmp', 'editor-buffer.md'),
          bytesWritten: 16,
          lossReport: { count: 0, items: [] },
        },
      };
    },
    updateStatusText: (message) => {
      calls.push(['status', message]);
    },
    window: {
      prompt: () => {
        throw new Error('export prompt must not be primary path');
      },
    },
    navigator: {
      clipboard: {
        writeText: () => {
          throw new Error('clipboard must not be primary path');
        },
      },
    },
  });

  await handleMarkdownExportUiPath();

  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['import', 'current buffer', 'editor-buffer.md'],
    ['export', scene, { saveAs: true, defaultName: 'editor-buffer.md' }],
    ['status', 'Exported Markdown v1'],
  ]);
});

test('Markdown export save-as UI path treats cancel as non-write status', async () => {
  const { handle } = loadMarkdownExportHandler();
  const scene = { kind: 'scene.v1', blocks: [] };
  const calls = [];
  const handleMarkdownExportUiPath = handle({
    MARKDOWN_EXPORT_STATUS_MESSAGE: 'Exported Markdown v1',
    MARKDOWN_EXPORT_CANCELLED_STATUS_MESSAGE: 'Export Markdown cancelled',
    MARKDOWN_EXPORT_SAVE_FAILED_STATUS_MESSAGE: 'Export Markdown save failed',
    getPlainText: () => 'current buffer',
    runMarkdownImportCommand: async () => ({ ok: true, value: { scene } }),
    resolveSceneFromImportResult: (result) => result.value.scene,
    runMarkdownExportCommand: async (_inputScene, options) => {
      calls.push(['export', options]);
      return {
        ok: true,
        value: {
          exported: false,
          canceled: true,
          outPath: '',
          bytesWritten: 0,
          lossReport: { count: 0, items: [] },
        },
      };
    },
    updateStatusText: (message) => {
      calls.push(['status', message]);
    },
  });

  await handleMarkdownExportUiPath();

  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['export', { saveAs: true, defaultName: 'editor-buffer.md' }],
    ['status', 'Export Markdown cancelled'],
  ]);
});

test('Markdown export save-as UI path fails closed without saved file proof', async () => {
  const { handle } = loadMarkdownExportHandler();
  const scene = { kind: 'scene.v1', blocks: [] };
  const calls = [];
  const handleMarkdownExportUiPath = handle({
    MARKDOWN_EXPORT_STATUS_MESSAGE: 'Exported Markdown v1',
    MARKDOWN_EXPORT_CANCELLED_STATUS_MESSAGE: 'Export Markdown cancelled',
    MARKDOWN_EXPORT_SAVE_FAILED_STATUS_MESSAGE: 'Export Markdown save failed',
    getPlainText: () => 'current buffer',
    runMarkdownImportCommand: async () => ({ ok: true, value: { scene } }),
    resolveSceneFromImportResult: (result) => result.value.scene,
    runMarkdownExportCommand: async () => ({
      ok: true,
      value: {
        exported: true,
        markdown: '# old prompt-only response\n',
        outPath: '',
        bytesWritten: 0,
        lossReport: { count: 0, items: [] },
      },
    }),
    updateStatusText: (message) => {
      calls.push(['status', message]);
    },
  });

  await handleMarkdownExportUiPath();

  assert.deepEqual(calls, [['status', 'Export Markdown save failed']]);
});

test('Markdown export save-as UI path no longer uses clipboard or prompt as primary export', () => {
  const { source } = loadMarkdownExportHandler();
  assert.equal(source.includes('navigator.clipboard'), false);
  assert.equal(source.includes('window.prompt'), false);
  assert.equal(source.includes('MARKDOWN_EXPORT_PROMPT_COPY_HINT'), false);
});
