const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function loadMarkdownExportHandler(context = {}) {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('function resolveMarkdownLocalFileBridgeValue(result)');
  const end = editor.indexOf('function getPlainText()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const source = editor.slice(start, end);
  return {
    source,
    handle: vm.runInNewContext(`${source}
handleMarkdownExportUiPath`, context),
  };
}

function makeContext(invokePreloadUiCommandBridge, calls) {
  return {
    MARKDOWN_EXPORT_LOCAL_FILE_COMMAND_ID: 'cmd.project.markdown.exportLocalFile',
    MARKDOWN_EXPORT_STATUS_MESSAGE: 'Exported Markdown v1',
    MARKDOWN_EXPORT_CANCELLED_STATUS_MESSAGE: 'Export Markdown cancelled',
    MARKDOWN_EXPORT_SAVE_FAILED_STATUS_MESSAGE: 'Export Markdown save failed',
    invokePreloadUiCommandBridge,
    updateStatusText: (message) => calls.push(['status', message]),
  };
}

test('Markdown export UI sends intent only and accepts pathless canonical-save proof', async () => {
  const calls = [];
  const context = makeContext(async (commandId, payload) => {
    calls.push(['bridge', commandId, payload]);
    return {
      ok: true,
      value: {
        ok: true,
        commandId,
        exported: true,
        bytesWritten: 16,
        canonicalSavedSceneSource: true,
        lossReport: { count: 0, items: [] },
      },
    };
  }, calls);
  const { handle } = loadMarkdownExportHandler(context);

  await handle();

  assert.equal(calls[0][0], 'bridge');
  assert.equal(calls[0][1], 'cmd.project.markdown.exportLocalFile');
  assert.deepEqual(Object.keys(calls[0][2]), ['requestId']);
  assert.match(calls[0][2].requestId, /^markdown-local-export-\d+$/u);
  assert.deepEqual(calls[1], ['status', 'Exported Markdown v1']);
});

test('Markdown export UI keeps serializer losses visible after confirmed write', async () => {
  const calls = [];
  const context = makeContext(async () => ({
    ok: true,
    value: {
      ok: true,
      exported: true,
      bytesWritten: 20,
      canonicalSavedSceneSource: true,
      lossReport: {
        count: 2,
        items: [
          { code: 'UNSUPPORTED_BLOCK_DOWNGRADED' },
          { code: 'UNSUPPORTED_MARK_DROPPED' },
        ],
      },
    },
  }), calls);
  const { handle } = loadMarkdownExportHandler(context);

  await handle();

  assert.deepEqual(calls, [['status', 'Exported Markdown v1; losses: 2']]);
});

test('Markdown export UI treats main-owned cancellation as a non-write status', async () => {
  const calls = [];
  const context = makeContext(async () => ({
    ok: true,
    value: {
      ok: true,
      exported: false,
      canceled: true,
      bytesWritten: 0,
      canonicalSavedSceneSource: true,
      lossReport: { count: 1, items: [{ code: 'UNSUPPORTED_BLOCK_DOWNGRADED' }] },
    },
  }), calls);
  const { handle } = loadMarkdownExportHandler(context);

  await handle();

  assert.deepEqual(calls, [['status', 'Export Markdown cancelled']]);
});

test('Markdown export UI fails closed without canonical saved-scene proof', async () => {
  const calls = [];
  const context = makeContext(async () => ({
    ok: true,
    value: {
      ok: true,
      exported: true,
      bytesWritten: 20,
      canonicalSavedSceneSource: false,
      lossReport: { count: 0, items: [] },
    },
  }), calls);
  const { handle } = loadMarkdownExportHandler(context);

  await handle();

  assert.deepEqual(calls, [['status', 'Export Markdown save failed']]);
});

test('Markdown export product path never reparses editor text or exposes a renderer path', () => {
  const { source } = loadMarkdownExportHandler({});
  for (const forbidden of [
    'getPlainText(',
    'runMarkdownImportCommand(',
    'runMarkdownExportCommand(',
    'navigator.clipboard',
    'window.prompt',
    'outPath',
    'scene:',
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
