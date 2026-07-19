const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function loadTxtImportResolverHelpers() {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('function normalizeTxtImportCreatedSceneIds(value)');
  const end = editor.indexOf('function summarizeDocxImportPreview(value)', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const section = editor.slice(start, end);
  return vm.runInNewContext(`${section}
({
  getTxtImportSceneLocatorsFromPlan,
  findTxtImportSceneNode,
})`, {
    getEffectiveDocumentKind: (node) => node?.effectiveKind || node?.kind || '',
    getEffectiveDocumentPath: (node) => node?.effectivePath || node?.path || '',
  });
}

test('TXT import preview UI flow: editor routes palette and runtime commands through dedicated flow', () => {
  const editor = read('src/renderer/editor.js');

  for (const marker of [
    'function openTxtImportPreviewFlow()',
    'function summarizeTxtImportPreview(value)',
    "const importTxtCommandId = 'cmd.project.importTxtV1';",
    'normalizedCommandId === importTxtCommandId',
    'window.confirm(`${previewSummary}\\n\\nCreate imported TXT scene?`)',
    'dispatchUiCommand(COMMAND_IDS.PROJECT_IMPORT_TXT_V1, {',
    'accept: true,',
    'txtImportPreviewPlan: plan,',
    'await loadTree();',
    'await openImportedTxtSceneAfterAccept(plan, createdSceneIds);',
    "if (commandId === COMMAND_IDS.PROJECT_IMPORT_TXT_V1) {",
    'openImportSurfaceModal(commandId);',
  ]) {
    assert.ok(editor.includes(marker), marker);
  }
});

test('TXT import preview UI flow: preview accept path does not mutate editor surface directly', () => {
  const editor = read('src/renderer/editor.js');
  const start = editor.indexOf('async function openTxtImportPreviewFlow()');
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

test('TXT import preview UI flow: accepted import opens only a plan-matched scene node', () => {
  const editor = read('src/renderer/editor.js');

  for (const marker of [
    'function getTxtImportSceneLocatorsFromPlan(plan, createdSceneIds)',
    'function findTxtImportSceneNode(root, locators)',
    'async function openImportedTxtSceneAfterAccept(plan, createdSceneIds)',
    'const createdSet = new Set(createdIds);',
    'expectedLabel: `${sanitizeTxtImportSceneLabelPart(title)} ${contentTextHash}`',
    "return { opened: false, reason: 'imported-txt-scene-not-found' };",
    'const opened = await openDocumentNode(node);',
    'renderTree();',
  ]) {
    assert.ok(editor.includes(marker), marker);
  }

  const helperStart = editor.indexOf('async function openImportedTxtSceneAfterAccept(plan, createdSceneIds)');
  const helperEnd = editor.indexOf('function summarizeDocxImportPreview(value)', helperStart);
  assert.notEqual(helperStart, -1);
  assert.notEqual(helperEnd, -1);
  const helperSection = editor.slice(helperStart, helperEnd);
  assert.equal(helperSection.includes('currentDocumentPath ='), false);
  assert.equal(helperSection.includes('window.electronAPI.invokeUiCommandBridge'), false);
});

test('TXT import preview UI flow: scene resolver executes exact match and fail-closed ambiguity', () => {
  const {
    getTxtImportSceneLocatorsFromPlan,
    findTxtImportSceneNode,
  } = loadTxtImportResolverHelpers();
  const plan = {
    candidateCreatePlan: {
      entries: [
        {
          sceneId: 'txt-import-scene-abcd1234ef',
          title: 'Imported TXT',
          contentTextHash: '1234567890',
        },
        {
          sceneId: 'txt-import-scene-deadbeef00',
          title: 'Ignored',
          contentTextHash: 'aaaaaaaaaa',
        },
      ],
    },
  };

  const locators = getTxtImportSceneLocatorsFromPlan(plan, [' txt-import-scene-abcd1234ef ']);
  assert.deepEqual(JSON.parse(JSON.stringify(locators)), [
    {
      sceneId: 'txt-import-scene-abcd1234ef',
      expectedLabel: 'Imported TXT 1234567890',
    },
  ]);

  const exactNode = {
    kind: 'scene',
    label: 'Imported TXT 1234567890',
    nodeId: 'tree-node-11111111111111111111111111111111',
  };
  assert.equal(findTxtImportSceneNode({ children: [exactNode] }, locators), exactNode);
  assert.equal(
    findTxtImportSceneNode({
      children: [
        { ...exactNode, nodeId: 'tree-node-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        { ...exactNode, nodeId: 'tree-node-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
      ],
    }, locators),
    null,
  );
  assert.equal(
    findTxtImportSceneNode({
      children: [{ ...exactNode, kind: 'chapter-file' }],
    }, locators),
    null,
  );
});

test('TXT import preview UI flow: generated bundle carries the shipped TXT accept path', () => {
  const bundle = read('src/renderer/editor.bundle.js');
  for (const marker of [
    'cmd.project.txt.previewLocalFile',
    'cmd.project.txt.importSafeCreate',
    'cmd.project.importTxtV1',
    'Create imported TXT scene?',
    'opened imported TXT scene',
    'imported-txt-scene-not-found',
    'no-created-txt-scene-locator',
  ]) {
    assert.ok(bundle.includes(marker), marker);
  }
});
