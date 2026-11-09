const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function markdownFlowContext(context) {
  return Object.assign({ crypto, currentProjectId: 'old-project', currentDocumentId: 'old-document', pendingMarkdownImportAttempt: null,
    EXTRA_COMMAND_IDS: { PROJECT_LIFECYCLE_CREATE: 'cmd.project.lifecycle.create', PROJECT_LIFECYCLE_OPEN: 'cmd.project.lifecycle.open' } }, context);
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
    nodeId: 'tree-node-11111111111111111111111111111111',
  };
  assert.equal(findMarkdownImportSceneNode({ children: [exactNode] }, locators), exactNode);
  assert.equal(
    findMarkdownImportSceneNode({
      children: [
        { ...exactNode, nodeId: 'tree-node-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        { ...exactNode, nodeId: 'tree-node-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
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

test('Markdown import product parity: local-file preview and new-project commands stay pathless and avoid editor mutation', () => {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('async function handleMarkdownImportUiPath()');
  assert.notEqual(start, -1);
  const functionEnd = editor.indexOf('async function handleMarkdownExportUiPath()', start);
  assert.notEqual(functionEnd, -1);
  const fullImportFunction = editor.slice(start, functionEnd);

  for (const marker of [
    'MARKDOWN_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID',
    'EXTRA_COMMAND_IDS.PROJECT_LIFECYCLE_CREATE',
    'EXTRA_COMMAND_IDS.PROJECT_LIFECYCLE_OPEN',
    'summarizeMarkdownLocalFilePreview(previewValue)',
    'window.confirm(',
    'markdownImportPreviewRef: previewId',
    'await loadTree();',
    'Markdown imported into a new project',
    'New project saved. Open it from the project library when ready.',
    'Create a new project from this Markdown file?',
  ]) {
    assert.ok(fullImportFunction.includes(marker), marker);
  }

  for (const forbidden of [
    'setPlainText(',
    'markAsModified(',
    'updateWordCount(',
    'getPlainText(',
    'window.prompt(',
    'runMarkdownImportCommand(',
    'sourcePath',
    'content:',
    'scene:',
    'currentDocumentPath =',
    'MARKDOWN_IMPORT_LOCAL_FILE_ACCEPT_COMMAND_ID',
  ]) {
    assert.equal(fullImportFunction.includes(forbidden), false, forbidden);
  }
  assert.ok(fullImportFunction.includes("updateStatusText('Import Markdown preview unavailable');"));
});

test('Markdown import product parity: confirmed preview creates a new project by token, then separately opens and refreshes it', async () => {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('async function handleMarkdownImportUiPath()');
  const end = editor.indexOf('async function handleMarkdownExportUiPath()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const source = editor.slice(start, end);
  const calls = [];
  const previewPayload = {
    sourceName: 'draft.md',
    safeCreatePlan: {
      mode: 'create-only',
      entries: [{ sceneId: 'scene-1234abcd90', title: 'Draft', contentTextHash: '1234abcd90' }],
    },
  };
  const context = {
    MARKDOWN_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID: 'cmd.project.markdown.previewLocalFile',
    MARKDOWN_IMPORT_LOCAL_FILE_ACCEPT_COMMAND_ID: 'cmd.project.markdown.acceptLocalPreview',
    window: {
      confirm: (message) => {
        calls.push(['confirm', message]);
        return true;
      },
    },
    invokePreloadUiCommandBridge: async (commandId, payload) => {
      calls.push(['bridge', commandId, payload]);
      if (commandId === 'cmd.project.markdown.previewLocalFile') {
        return {
          ok: true,
          value: {
            ok: true,
            previewId: 'mdp_1234567890abcdef12345678',
            sourceName: 'draft.md',
            byteLength: 17,
            lossReport: { count: 0, items: [] },
            previewResult: previewPayload,
          },
        };
      }
      throw new Error('unexpected bridge command');
    },
    dispatchUiCommand: async (commandId, payload) => {
      calls.push(['dispatch', commandId, payload]);
      if (commandId === 'cmd.project.lifecycle.create') return { ok: true,
        value: { created: true, target: 'new-project', projectId: 'new-project' } };
      if (commandId === 'cmd.project.lifecycle.open') return { ok: true };
      throw Error('unexpected lifecycle command');
    },
    resolveMarkdownLocalFileBridgeValue: (result) => result?.ok === true && result?.value?.ok === true
      ? result.value
      : null,
    summarizeMarkdownLocalFilePreview: (value) => {
      calls.push(['summarize', value.sourceName]);
      return 'Markdown: draft.md. Bytes: 17. Scenes ready: 1. Losses: 0.';
    },
    buildMarkdownPreviewReadyStatus: () => 'Markdown import preview ready',
    getMarkdownLossCount: () => 0,
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
handleMarkdownImportUiPath`, markdownFlowContext(context));

  await handleMarkdownImportUiPath();

  assert.deepEqual(calls.map((call) => call[0]), [
    'status',
    'bridge',
    'summarize',
    'confirm',
    'status',
    'dispatch',
    'dispatch',
    'loadTree',
    'status',
  ]);
  assert.deepEqual(Object.keys(calls[1][2]), ['requestId']);
  assert.deepEqual(Object.keys(calls[5][2]), ['requestId', 'markdownImportPreviewRef', 'action']);
  assert.equal(calls[5][1], 'cmd.project.lifecycle.create');
  assert.equal(calls[5][2].markdownImportPreviewRef, 'mdp_1234567890abcdef12345678');
  assert.equal(calls[5][2].action, 'create');
  assert.equal(calls[6][1], 'cmd.project.lifecycle.open');
  assert.equal(calls[6][2].projectId, 'new-project');
  assert.equal(calls[8][1], 'Markdown imported into a new project');
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
    MARKDOWN_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID: 'cmd.project.markdown.previewLocalFile',
    MARKDOWN_IMPORT_LOCAL_FILE_ACCEPT_COMMAND_ID: 'cmd.project.markdown.acceptLocalPreview',
    window: { confirm: () => true },
    invokePreloadUiCommandBridge: async () => ({ ok: true, value: { ok: true, imported: true } }),
    resolveMarkdownLocalFileBridgeValue: (result) => result.value,
    summarizeMarkdownLocalFilePreview: () => '',
    buildMarkdownPreviewReadyStatus: () => '',
    getMarkdownLossCount: () => 0,
    loadTree: async () => {
      throw new Error('tree refresh should not run without preview payload');
    },
    openImportedMarkdownSceneAfterSafeCreate: async () => {
      throw new Error('open should not run without preview payload');
    },
    updateStatusText: (message) => {
      calls.push(['status', message]);
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
handleMarkdownImportUiPath`, markdownFlowContext(context));

  await handleMarkdownImportUiPath();

  assert.deepEqual(calls, [
    ['status', 'Preparing Markdown import preview'],
    ['status', 'Import Markdown preview unavailable'],
  ]);
});

test('Markdown import product parity: preview decline never sends accept or writes', async () => {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('async function handleMarkdownImportUiPath()');
  const end = editor.indexOf('async function handleMarkdownExportUiPath()', start);
  const source = editor.slice(start, end);
  const calls = [];
  const previewValue = {
    ok: true,
    previewId: 'mdp_1234567890abcdef12345678',
    sourceName: 'draft.md',
    byteLength: 17,
    lossReport: { count: 1, items: [{ code: 'UNSUPPORTED_BLOCK_DOWNGRADED' }] },
    previewResult: {
      safeCreatePlan: { entries: [{ sceneId: 'scene-1234abcd90' }] },
    },
  };
  const context = {
    MARKDOWN_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID: 'cmd.project.markdown.previewLocalFile',
    MARKDOWN_IMPORT_LOCAL_FILE_ACCEPT_COMMAND_ID: 'cmd.project.markdown.acceptLocalPreview',
    window: { confirm: () => false },
    invokePreloadUiCommandBridge: async (commandId, payload) => {
      calls.push(['bridge', commandId, payload]);
      return { ok: true, value: previewValue };
    },
    resolveMarkdownLocalFileBridgeValue: (result) => result.value,
    summarizeMarkdownLocalFilePreview: () => 'loss summary',
    buildMarkdownPreviewReadyStatus: () => 'Markdown import preview ready; losses: 1',
    getMarkdownLossCount: () => 1,
    loadTree: async () => {
      throw new Error('declined preview must not refresh tree');
    },
    openImportedMarkdownSceneAfterSafeCreate: async () => {
      throw new Error('declined preview must not open a scene');
    },
    updateStatusText: (message) => calls.push(['status', message]),
  };
  const handleMarkdownImportUiPath = vm.runInNewContext(`${source}
handleMarkdownImportUiPath`, markdownFlowContext(context));

  await handleMarkdownImportUiPath();

  assert.equal(calls.filter((call) => call[0] === 'bridge').length, 1);
  assert.deepEqual(calls.at(-1), ['status', 'Markdown import preview ready; losses: 1']);
});

test('Markdown import product parity: generated bundle carries shipped create-then-open path', () => {
  const bundle = read('src/renderer/editor.bundle.js');
  for (const marker of [
    'Markdown imported into a new project',
    'New project saved. Open it from the project library when ready.',
    'markdownImportPreviewRef',
    'cmd.project.markdown.previewLocalFile',
    'cmd.project.lifecycle.create',
    'cmd.project.lifecycle.open',
  ]) {
    assert.ok(bundle.includes(marker), marker);
  }
});

function freshProjectFlow(options = {}) {
  const editor = read('src/renderer/editor.js'), start = editor.indexOf('async function handleMarkdownImportUiPath()');
  const source = editor.slice(start, editor.indexOf('async function handleMarkdownExportUiPath()', start));
  const calls = [], context = markdownFlowContext({
    MARKDOWN_IMPORT_LOCAL_FILE_PREVIEW_COMMAND_ID: 'cmd.project.markdown.previewLocalFile',
    window: { confirm: () => { calls.push(['confirm']); return true; } },
    invokePreloadUiCommandBridge: async () => {
      calls.push(['preview']);
      if (options.preview) await options.preview(context);
      return { ok: true, value: { ok: 1, previewId: 'mdp_1234567890abcdef12345678', previewResult: {}, lossReport: { count: 1 } } };
    },
    dispatchUiCommand: async (id, payload) => {
      calls.push([id, JSON.parse(JSON.stringify(payload))]);
      if (id === 'cmd.project.lifecycle.create') {
        if (options.create) await options.create(context);
        return options.failedCreate ? { ok: false } : { ok: true, value: { created: true, target: 'new-project', projectId: 'new-project' } };
      }
      if (options.open === 'throw') throw Error('OPEN_FAILED');
      if (options.open === 'cancel') return { ok: false, value: { cancelled: true } };
      context.currentProjectId = 'new-project'; context.currentDocumentId = 'new-document';
      return { ok: true };
    },
    resolveMarkdownLocalFileBridgeValue: result => result.value,
    summarizeMarkdownLocalFilePreview: () => 'Markdown preview; losses: 1', getMarkdownLossCount: () => 1,
    loadTree: async () => { calls.push(['tree']); if (options.tree) await options.tree(context); },
    updateStatusText: text => calls.push(['status', text]),
    setPlainText: () => { throw Error('AUTHORING_TEXT_MUTATION'); }, markAsModified: () => { throw Error('AUTHORING_STATE_MUTATION'); },
    openImportedMarkdownSceneAfterSafeCreate: () => { throw Error('OLD_PROJECT_SCENE_MUST_NOT_OPEN'); },
  });
  return { calls, context, run: vm.runInNewContext(source + '\nhandleMarkdownImportUiPath', context) };
}

for (const open of ['cancel', 'throw']) test(`Markdown new-project UI preserves completed creation after open ${open}`, async () => {
  const h = freshProjectFlow({ open }); await h.run();
  assert.equal(h.calls.filter(row => row[0] === 'cmd.project.lifecycle.create').length, 1);
  assert.equal(h.calls.filter(row => row[0] === 'cmd.project.lifecycle.open').length, 1);
  assert.equal(h.calls.some(row => row[0] === 'tree'), false);
  assert.deepEqual(h.calls.at(-1), ['status', 'New project saved. Open it from the project library when ready.']);
  assert.equal(h.context.currentProjectId, 'old-project'); assert.equal(h.context.currentDocumentId, 'old-document');
  assert.equal(h.context.pendingMarkdownImportAttempt, null);
});

test('Markdown new-project UI does not open or report imported text after unconfirmed creation', async () => {
  const h = freshProjectFlow({ failedCreate: true }); await h.run();
  assert.equal(h.calls.some(row => row[0] === 'cmd.project.lifecycle.open' || row[0] === 'tree'), false);
  assert.deepEqual(h.calls.at(-1), ['status', 'Markdown import could not be confirmed. Check the project library before trying again.']);
});

for (const boundary of ['preview', 'create', 'tree']) test(`Markdown new-project UI discards stale ${boundary} completion`, async () => {
  const h = freshProjectFlow({ [boundary]: async context => { context.currentProjectId = 'foreign-project'; } });
  await h.run();
  assert.equal(h.calls.some(row => row[0] === 'status' && row[1].includes('Markdown imported into')), false);
  if (boundary === 'preview') assert.equal(h.calls.some(row => row[0] === 'confirm'), false);
  if (boundary === 'create') assert.equal(h.calls.some(row => row[0] === 'cmd.project.lifecycle.open'), false);
  assert.equal(h.context.currentProjectId, 'foreign-project'); assert.equal(h.context.pendingMarkdownImportAttempt, null);
});

test('Markdown new-project UI rejects overlapping action while creation is pending, then opens with loss feedback', async () => {
  let release; const paused = new Promise(resolve => { release = resolve; });
  const h = freshProjectFlow({ create: async () => paused });
  const first = h.run();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.context.pendingMarkdownImportAttempt.phase, 'creating');
  await h.run(); assert.equal(h.calls.filter(row => row[0] === 'preview').length, 1);
  release(); await first;
  assert.equal(h.calls.filter(row => row[0] === 'cmd.project.lifecycle.create').length, 1);
  assert.deepEqual(h.calls.at(-1), ['status', 'Markdown imported into a new project; losses: 1']);
  assert.equal(h.context.currentProjectId, 'new-project'); assert.equal(h.context.currentDocumentId, 'new-document');
  assert.equal(h.context.pendingMarkdownImportAttempt, null);
});
