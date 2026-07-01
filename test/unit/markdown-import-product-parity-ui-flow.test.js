const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function loadMarkdownImportResolverHelpers(extraContext = {}) {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('function normalizeMarkdownImportCreatedSceneIds(value)');
  const end = editor.indexOf('async function runMarkdownImportCommand(markdownText, sourceName, options = {})', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = editor.slice(start, end);
  return vm.runInNewContext(`${section}
({
  getMarkdownImportSceneLocatorsFromPreview,
  findMarkdownImportSceneNode,
  openImportedMarkdownSceneAfterSafeCreate,
})`, {
    getEffectiveDocumentKind: (node) => node?.effectiveKind || node?.kind || '',
    getEffectiveDocumentPath: (node) => node?.effectivePath || node?.path || '',
    ...extraContext,
  });
}

test('Markdown import product parity: preview plan carries semantic scene locators', () => {
  const main = read('src/main.js');

  for (const marker of [
    'title: safeBaseName,',
    'contentTextHash: digest,',
    'expectedLabel: sceneLabel,',
    'sceneId: `scene-${sceneDigest}`,',
    "joinPathSegmentsWithinRoot(romanRoot, ['Imported', fileName]",
  ]) {
    assert.ok(main.includes(marker), marker);
  }
});

test('Markdown import product parity: accepted safe create resolves tree scene and fails closed', () => {
  const {
    getMarkdownImportSceneLocatorsFromPreview,
    findMarkdownImportSceneNode,
  } = loadMarkdownImportResolverHelpers();
  const previewPayload = {
    sourceName: 'draft.md',
    safeCreatePlan: {
      mode: 'create-only',
      entries: [
        {
          sceneId: 'scene-1234abcd90',
          title: 'Draft',
          contentTextHash: '1234abcd90',
        },
        {
          sceneId: 'scene-deadbeef12',
          title: 'Ignored',
          contentTextHash: 'deadbeef12',
        },
      ],
    },
  };

  const locators = getMarkdownImportSceneLocatorsFromPreview(previewPayload, [' scene-1234abcd90 ']);
  assert.deepEqual(JSON.parse(JSON.stringify(locators)), [
    {
      sceneId: 'scene-1234abcd90',
      expectedLabel: 'Draft 1234abcd90',
    },
  ]);

  const exactNode = {
    kind: 'scene',
    label: 'Draft 1234abcd90',
    path: 'roman/Imported/Draft 1234abcd90.txt',
  };
  assert.equal(findMarkdownImportSceneNode({ children: [exactNode] }, locators), exactNode);
  assert.equal(
    findMarkdownImportSceneNode({
      children: [
        { ...exactNode, path: 'roman/Imported/a.txt' },
        { ...exactNode, path: 'roman/Imported/b.txt' },
      ],
    }, locators),
    null,
  );
  assert.equal(
    findMarkdownImportSceneNode({
      children: [{ ...exactNode, kind: 'chapter-file' }],
    }, locators),
    null,
  );
  assert.equal(
    findMarkdownImportSceneNode({
      children: [{ ...exactNode, sceneId: 'scene-1234abcd90', label: 'Wrong title 1234abcd90' }],
    }, locators),
    null,
  );
});

test('Markdown import product parity: explicit preview label is preferred over derived naming', () => {
  const {
    getMarkdownImportSceneLocatorsFromPreview,
  } = loadMarkdownImportResolverHelpers();
  const previewPayload = {
    sourceName: 'draft.md',
    safeCreatePlan: {
      mode: 'create-only',
      entries: [
        {
          sceneId: 'scene-fedcba9876',
          title: 'Draft',
          contentTextHash: '1234abcd90',
          expectedLabel: 'Imported from plan fedcba9876',
        },
      ],
    },
  };

  assert.deepEqual(
    JSON.parse(JSON.stringify(getMarkdownImportSceneLocatorsFromPreview(previewPayload, ['scene-fedcba9876']))),
    [
      {
        sceneId: 'scene-fedcba9876',
        expectedLabel: 'Imported from plan fedcba9876',
      },
    ],
  );
});

test('Markdown import product parity: resolver derives fallback label without entry path', () => {
  const {
    getMarkdownImportSceneLocatorsFromPreview,
  } = loadMarkdownImportResolverHelpers();
  const previewPayload = {
    sourceName: 'fallback.md',
    safeCreatePlan: {
      mode: 'create-only',
      entries: [
        {
          sceneId: 'scene-aaaaaaaaaa',
        },
      ],
    },
  };

  assert.deepEqual(
    JSON.parse(JSON.stringify(getMarkdownImportSceneLocatorsFromPreview(previewPayload, ['scene-aaaaaaaaaa']))),
    [
      {
        sceneId: 'scene-aaaaaaaaaa',
        expectedLabel: 'fallback aaaaaaaaaa',
      },
    ],
  );

  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('function getMarkdownImportSceneLocatorsFromPreview(previewPayload, createdSceneIds)');
  const end = editor.indexOf('function findMarkdownImportSceneNode(root, locators)', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = editor.slice(start, end);
  assert.equal(section.includes('entry.path'), false);
});

test('Markdown import product parity: safe-create branch opens tree node without editor mutation', () => {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('async function handleMarkdownImportUiPath()');
  assert.notEqual(start, -1);
  const safeCreateStart = editor.indexOf('if (previewPayload) {', start);
  const safeCreateEnd = editor.indexOf("updateStatusText('Import Markdown preview unavailable');", safeCreateStart);
  assert.notEqual(safeCreateStart, -1);
  assert.notEqual(safeCreateEnd, -1);
  const section = editor.slice(safeCreateStart, safeCreateEnd);
  const functionEnd = editor.indexOf('async function handleMarkdownExportUiPath()', start);
  assert.notEqual(functionEnd, -1);
  const fullImportFunction = editor.slice(start, functionEnd);

  for (const marker of [
    'await loadTree();',
    'await openImportedMarkdownSceneAfterSafeCreate(previewPayload, createdSceneIds);',
    'Imported Markdown scenes:',
    'opened imported scene',
    'createdSceneIds.length > 0',
  ]) {
    assert.ok(section.includes(marker), marker);
  }

  for (const forbidden of [
    'setPlainText(',
    'markAsModified(',
    'updateWordCount(',
    'window.electronAPI.invokeUiCommandBridge',
    'currentDocumentPath =',
  ]) {
    assert.equal(section.includes(forbidden), false, forbidden);
    assert.equal(fullImportFunction.includes(forbidden), false, forbidden);
  }
  assert.ok(fullImportFunction.includes("updateStatusText('Import Markdown preview unavailable');"));
});

test('Markdown import product parity: safe-create branch executes refresh and open path', async () => {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('async function handleMarkdownImportUiPath()');
  const end = editor.indexOf('async function handleMarkdownExportUiPath()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const source = editor.slice(start, end);
  const calls = [];
  const previewPayload = {
    safeCreatePlan: {
      mode: 'create-only',
      entries: [{ sceneId: 'scene-1234abcd90', title: 'Draft', contentTextHash: '1234abcd90' }],
    },
  };
  const context = {
    MARKDOWN_IMPORT_PROMPT_TITLE: 'Import Markdown v1',
    window: {
      prompt: (title, currentText) => {
        calls.push(['prompt', title, currentText]);
        return '# Draft';
      },
    },
    getPlainText: () => 'current text',
    runMarkdownImportCommand: async (markdownText, sourceName, options = {}) => {
      calls.push(['import', markdownText, sourceName, options]);
      if (options.preview === true) {
        return { ok: true, value: { previewResult: previewPayload } };
      }
      if (options.safeCreate === true) {
        return {
          ok: true,
          value: {
            safeCreate: true,
            createdSceneIds: ['scene-1234abcd90'],
          },
        };
      }
      throw new Error('unexpected import branch');
    },
    loadTree: async () => {
      calls.push(['loadTree']);
    },
    openImportedMarkdownSceneAfterSafeCreate: async (payload, createdSceneIds) => {
      calls.push(['openImportedMarkdownSceneAfterSafeCreate', payload, createdSceneIds]);
      return { opened: true, reason: 'opened-imported-markdown-scene' };
    },
    updateStatusText: (message) => {
      calls.push(['status', message]);
    },
    resolveSceneFromImportResult: () => {
      throw new Error('fallback import branch should not run');
    },
    runMarkdownExportCommand: async () => {
      throw new Error('fallback export branch should not run');
    },
    setPlainText: () => {
      throw new Error('safe-create branch must not mutate editor text');
    },
    updateWordCount: () => {
      throw new Error('safe-create branch must not update word count directly');
    },
    markAsModified: () => {
      throw new Error('safe-create branch must not mark editor modified');
    },
  };
  const handleMarkdownImportUiPath = vm.runInNewContext(`${source}
handleMarkdownImportUiPath`, context);

  await handleMarkdownImportUiPath();

  assert.deepEqual(calls.map((call) => call[0]), [
    'prompt',
    'import',
    'import',
    'loadTree',
    'openImportedMarkdownSceneAfterSafeCreate',
    'status',
  ]);
  assert.deepEqual(calls[4][2], ['scene-1234abcd90']);
  assert.equal(calls[5][1], 'Imported Markdown scenes: 1; opened imported scene');
});

test('Markdown import product parity: missing preview payload fails closed without mutation', async () => {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('async function handleMarkdownImportUiPath()');
  const end = editor.indexOf('async function handleMarkdownExportUiPath()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const source = editor.slice(start, end);
  const calls = [];
  const context = {
    MARKDOWN_IMPORT_PROMPT_TITLE: 'Import Markdown v1',
    window: {
      prompt: () => '# Draft',
    },
    getPlainText: () => 'current text',
    runMarkdownImportCommand: async () => ({ ok: true, value: { imported: true } }),
    loadTree: async () => {
      throw new Error('tree refresh should not run without preview payload');
    },
    openImportedMarkdownSceneAfterSafeCreate: async () => {
      throw new Error('open should not run without preview payload');
    },
    updateStatusText: (message) => {
      calls.push(['status', message]);
    },
    resolveSceneFromImportResult: () => {
      throw new Error('legacy fallback should not run');
    },
    runMarkdownExportCommand: async () => {
      throw new Error('legacy export fallback should not run');
    },
    setPlainText: () => {
      throw new Error('legacy editor mutation should not run');
    },
    updateWordCount: () => {
      throw new Error('legacy word-count mutation should not run');
    },
    markAsModified: () => {
      throw new Error('legacy dirty mutation should not run');
    },
  };
  const handleMarkdownImportUiPath = vm.runInNewContext(`${source}
handleMarkdownImportUiPath`, context);

  await handleMarkdownImportUiPath();

  assert.deepEqual(calls, [['status', 'Import Markdown preview unavailable']]);
});

test('Markdown import product parity: generated bundle carries shipped accept-open path', () => {
  const bundle = read('src/renderer/editor.bundle.js');
  for (const marker of [
    'opened-imported-markdown-scene',
    'imported-markdown-scene-not-found',
    'no-created-markdown-scene-locator',
    'Imported Markdown scenes:',
  ]) {
    assert.ok(bundle.includes(marker), marker);
  }
});
