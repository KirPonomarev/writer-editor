const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function loadDocxImportResolverHelpers() {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('function normalizeDocxImportCreatedSceneIds(value)');
  const end = editor.indexOf('function summarizeDocxImportPreview(value)', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = editor.slice(start, end);
  return vm.runInNewContext(`${section}
({
  getDocxImportPublicSceneLocatorsFromValue,
  getDocxImportSceneLocatorsFromPlan,
  findDocxImportSceneNode,
})`, {
    getEffectiveDocumentKind: (node) => node?.effectiveKind || node?.kind || '',
    getEffectiveDocumentPath: (node) => node?.effectivePath || node?.path || '',
  });
}

test('DOCX import preview UI flow: existing modal surface exposes preview and accept hooks', () => {
  const html = read('src/renderer/index.html');
  const editor = read('src/renderer/editor.js');

  for (const marker of [
    'data-docx-import-preview-modal',
    'data-docx-import-preview-message',
    'data-docx-import-preview-loss',
    'data-docx-import-preview-cancel',
    'data-docx-import-preview-confirm',
  ]) {
    assert.ok(html.includes(marker), marker);
    assert.ok(editor.includes(marker), marker);
  }

  assert.ok(editor.includes('function openDocxImportPreviewFlow()'));
  assert.ok(editor.includes('function confirmDocxImportPreviewAndRun()'));
  assert.ok(editor.includes("const importDocxCommandId = 'cmd.project.importDocxV1';"));
  assert.ok(editor.includes('normalizedCommandId === importDocxCommandId'));
  assert.ok(editor.includes('dispatchUiCommand(COMMAND_IDS.PROJECT_IMPORT_DOCX_V1, {'));
  assert.ok(editor.includes('accept: true,'));
  assert.ok(editor.includes('localFilePreview: previewValue?.localFilePreview || null,'));
  assert.ok(editor.includes('docxContentPreviewReport: previewValue?.docxContentPreviewReport'));
  assert.ok(editor.includes('docxImportPreviewPlan: plan,'));
  assert.ok(editor.includes('await loadTree();'));
  assert.ok(editor.includes('await openImportedDocxSceneAfterAccept(plan, createdSceneIds, resultValue);'));
});

test('DOCX import preview UI flow: no editor-surface mutation is introduced by import accept', () => {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('async function confirmDocxImportPreviewAndRun()');
  const end = editor.indexOf('function applyCollabGate()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = editor.slice(start, end);

  for (const forbidden of [
    'setPlainText(',
    'setContent(',
    'window.electronAPI.invokeUiCommandBridge',
    'currentDocumentPath =',
  ]) {
    assert.equal(section.includes(forbidden), false, forbidden);
  }
});

test('DOCX import preview UI flow: accepted import opens only a plan-matched scene node', () => {
  const editor = read('src/renderer/editor.js');

  for (const marker of [
    'function normalizeDocxImportPublicSceneLocator(value)',
    'function getDocxImportPublicSceneLocatorsFromValue(value)',
    'function getDocxImportSceneLocatorsFromPlan(plan, createdSceneIds)',
    'function findDocxImportSceneNode(root, locators)',
    'async function openImportedDocxSceneAfterAccept(plan, createdSceneIds, acceptedValue = null)',
    'const createdSet = new Set(createdIds);',
    "source: 'public-scene-locator'",
    'expectedLabel: `${sanitizeDocxImportSceneLabelPart(title)} ${contentTextHash}`',
    "return { opened: false, reason: 'imported-scene-not-found' };",
    'const opened = await openDocumentNode(node);',
    'renderTree();',
  ]) {
    assert.ok(editor.includes(marker), marker);
  }

  const helperStart = editor.indexOf('async function openImportedDocxSceneAfterAccept(plan, createdSceneIds, acceptedValue = null)');
  const helperEnd = editor.indexOf('function summarizeDocxImportPreview(value)', helperStart);
  assert.notEqual(helperStart, -1);
  assert.notEqual(helperEnd, -1);
  const helperSection = editor.slice(helperStart, helperEnd);
  assert.equal(helperSection.includes('currentDocumentPath ='), false);
  assert.equal(helperSection.includes('window.electronAPI.invokeUiCommandBridge'), false);
});

test('DOCX import preview UI flow: scene resolver executes exact match and fail-closed ambiguity', () => {
  const {
    getDocxImportPublicSceneLocatorsFromValue,
    getDocxImportSceneLocatorsFromPlan,
    findDocxImportSceneNode,
  } = loadDocxImportResolverHelpers();
  const plan = {
    candidateCreatePlan: {
      entries: [
        {
          sceneId: 'docx-import-scene-abcd1234',
          title: 'Imported DOCX',
          contentTextHash: '11111111',
        },
        {
          sceneId: 'docx-import-scene-deadbeef',
          title: 'Ignored',
          contentTextHash: '22222222',
        },
      ],
    },
  };

  const locators = getDocxImportSceneLocatorsFromPlan(plan, [' docx-import-scene-abcd1234 ']);
  assert.deepEqual(JSON.parse(JSON.stringify(locators)), [
    {
      sceneId: 'docx-import-scene-abcd1234',
      expectedLabel: 'Imported DOCX 11111111',
    },
  ]);

  const publicLocator = {
    sceneId: 'docx-import-scene-abcd1234',
    nodeId: 'tree-node-11111111111111111111111111111111',
    label: 'Imported DOCX 11111111',
    kind: 'scene',
  };
  const publicLocators = getDocxImportPublicSceneLocatorsFromValue({
    publicSceneLocators: [publicLocator, publicLocator],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(publicLocators)), [
    {
      sceneId: 'docx-import-scene-abcd1234',
      nodeId: 'tree-node-11111111111111111111111111111111',
      expectedLabel: 'Imported DOCX 11111111',
      source: 'public-scene-locator',
    },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(getDocxImportPublicSceneLocatorsFromValue({
    publicSceneLocator: {
      sceneId: 'docx-import-scene-abcd1234',
      nodeId: 'tree-node-22222222222222222222222222222222',
      label: 'Imported DOCX 22222222',
      relativeFile: 'roman/Imported/Imported DOCX 22222222.txt',
      kind: 'scene',
    },
  }))), []);

  const exactNode = {
    kind: 'scene',
    label: 'Imported DOCX 11111111',
    nodeId: 'tree-node-11111111111111111111111111111111',
  };
  assert.equal(findDocxImportSceneNode({ children: [exactNode] }, publicLocators), exactNode);
  const treeNodeOnly = {
    kind: 'scene',
    label: 'Imported DOCX 11111111',
    treeNodeId: 'tree-node-11111111111111111111111111111111',
  };
  assert.equal(findDocxImportSceneNode({ children: [treeNodeOnly] }, publicLocators), treeNodeOnly);
  assert.equal(
    findDocxImportSceneNode({
      children: [{ ...exactNode, label: 'Imported DOCX stale label' }],
    }, publicLocators),
    null,
  );
  assert.equal(
    findDocxImportSceneNode({
      children: [
        {
          ...exactNode,
          nodeId: 'tree-node-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
      ],
    }, publicLocators),
    null,
  );
  assert.equal(findDocxImportSceneNode({ children: [exactNode] }, locators), exactNode);
  assert.equal(
    findDocxImportSceneNode({
      children: [
        { ...exactNode, nodeId: 'tree-node-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        { ...exactNode, nodeId: 'tree-node-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      ],
    }, locators),
    null,
  );
  assert.equal(
    findDocxImportSceneNode({
      children: [{ ...exactNode, kind: 'chapter-file' }],
    }, locators),
    null,
  );
});

test('DOCX import preview UI flow: project tree exposes Imported txt files as scene nodes', () => {
  const main = read('src/main.js');

  for (const marker of [
    'async function buildImportedRomanTree(romanPath)',
    "joinPathSegmentsWithinRoot(romanPath, ['Imported'],",
    "entry.isFile && entry.name.toLowerCase().endsWith('.txt')",
    "kind: 'scene',",
    "kind: 'chapter-folder',",
    'const importedNode = await buildImportedRomanTree(romanPath);',
    'childNodes.push(importedNode);',
    '...metadata,',
    "parts[1].toLowerCase() === 'imported'",
    "return { title: baseTitle, kind: 'scene', metaEnabled: true };",
  ]) {
    assert.ok(main.includes(marker), marker);
  }
  const readOnlyStart = main.indexOf('async function buildProjectTreeRootsWithIdentitiesReadOnly()');
  assert.notEqual(readOnlyStart, -1);
  const readOnlyEnd = main.indexOf('async function resolveProjectTreeNodeIdentity', readOnlyStart);
  assert.notEqual(readOnlyEnd, -1);
  const readOnlySection = main.slice(readOnlyStart, readOnlyEnd);
  for (const marker of [
    'const activeProjectName = currentProjectName || DEFAULT_PROJECT_NAME;',
    'await buildRomanTree(activeProjectName)',
    'await buildMindMapTree(activeProjectName)',
    'await buildPrintTree(activeProjectName)',
    'nodePath: getProjectRootPath(activeProjectName)',
    'await buildMaterialsTree(activeProjectName)',
    'await buildReferenceTree(activeProjectName)',
    'await annotateProjectTreeDerivedCounters(Object.values(roots), activeProjectName)',
  ]) {
    assert.ok(readOnlySection.includes(marker), marker);
  }
  const resolverEnd = main.indexOf('function normalizeProjectRelativeSceneId', readOnlyEnd);
  assert.notEqual(resolverEnd, -1);
  const resolverSection = main.slice(readOnlyEnd, resolverEnd);
  assert.ok(
    resolverSection.includes('await ensureProjectManifest(currentProjectName || DEFAULT_PROJECT_NAME)'),
    'resolveProjectTreeNodeIdentity uses active project manifest',
  );
});

test('DOCX import preview UI flow: shell reset and restore clear pending accept state', () => {
  const editor = read('src/renderer/editor.js');
  for (const functionName of ['performSafeResetShell', 'performRestoreLastStableShell']) {
    const start = editor.indexOf(`function ${functionName}()`);
    assert.notEqual(start, -1, functionName);
    const end = editor.indexOf('updateWordCount();', start);
    assert.notEqual(end, -1, functionName);
    const section = editor.slice(start, end);
    assert.ok(section.includes('closeDocxImportPreviewModal();'), functionName);
  }
});

test('DOCX import preview UI flow: generated bundle carries the shipped DOCX accept path', () => {
  const bundle = read('src/renderer/editor.bundle.js');
  for (const marker of [
    'cmd.project.docx.previewImportPlan',
    'cmd.project.docx.importSafeCreate',
    'cmd.project.importDocxV1',
    'docxContentPreviewReport',
    'localFilePreview',
    'opened imported scene',
    'imported-scene-not-found',
    'no-created-scene-locator',
  ]) {
    assert.ok(bundle.includes(marker), marker);
  }
});
