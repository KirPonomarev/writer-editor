import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  buildWriterHomeProjection,
  countWriterHomeTextBlocks,
  WRITER_HOME_SURFACE_ID,
} from '../../src/core/writer-home-projection-v1.mjs';
import browserSafeAnchorLineage from '../../src/core/anchor-lineage-browser-safe-v1.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function node(id, kind, label, children = [], extra = {}) {
  return {
    id,
    nodeId: id,
    kind,
    label,
    children,
    ...extra,
  };
}

const PROJECT_ID = 'tree-node-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const BOOK_ID = 'tree-node-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const PART_ID = 'tree-node-cccccccccccccccccccccccccccccccc';
const CHAPTER_ID = 'tree-node-dddddddddddddddddddddddddddddddd';
const SCENE_ID = 'tree-node-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

test('WP300 writer home projection derives pathless hierarchy and current block identity', () => {
  const tree = node(PROJECT_ID, 'roman-tab-root', '/Volumes/T7-Secure/private-project', [
    node(BOOK_ID, 'roman-root', 'Роман', [
      node(PART_ID, 'part', 'Часть первая', [
        node(CHAPTER_ID, 'chapter-folder', 'Глава 1', [
          node(SCENE_ID, 'scene', 'Сцена у окна', [], {
            path: '/Volumes/T7-Secure/secret/scene.txt',
            bindingKey: 'file:///Volumes/T7-Secure/secret/scene.txt',
          }),
        ]),
      ]),
    ], {
      derivedCounters: {
        wordCount: 1200,
        sceneCount: 1,
        completedSceneCount: 1,
        progressPercent: 100,
      },
    }),
  ], {
    path: '/Users/example/Documents',
    effectivePath: '/tmp/yalken',
  });

  const projection = buildWriterHomeProjection({
    treeRoot: tree,
    projectId: PROJECT_ID,
    activeDocumentId: SCENE_ID,
    activeBlockCount: 3,
  });

  assert.equal(projection.schemaVersion, 1);
  assert.equal(projection.surfaceId, WRITER_HOME_SURFACE_ID);
  assert.equal(projection.projectId, PROJECT_ID);
  assert.equal(projection.summary.wordCount, 1200);
  assert.equal(projection.summary.sceneCount, 1);
  assert.equal(projection.hierarchy.map((row) => row.role).join('>'), 'project>book>part>chapter>scene>block');
  assert.equal(projection.hierarchy.find((row) => row.role === 'project').value, 'Локальный проект');
  assert.equal(projection.hierarchy.find((row) => row.role === 'scene').value, 'Сцена у окна');
  assert.equal(projection.hierarchy.find((row) => row.role === 'block').state, 'ready');
  assert.equal(projection.hierarchy.find((row) => row.role === 'block').count, 3);

  const serialized = JSON.stringify(projection);
  assert.equal(serialized.includes('/Volumes/'), false);
  assert.equal(serialized.includes('/Users/'), false);
  assert.equal(serialized.includes('/tmp/'), false);
  assert.equal(serialized.includes('secret'), false);
  assert.equal(serialized.includes('bindingKey'), false);
  assert.equal(serialized.includes('effectivePath'), false);
});

test('WP300 writer home actions remain bounded to existing UI command routes', () => {
  const projection = buildWriterHomeProjection({
    treeRoot: null,
    projectId: PROJECT_ID,
    activeDocumentId: '',
  });

  assert.deepEqual(
    projection.actions.map((action) => action.action),
    ['open', 'create-project', 'search', 'open-current-scene'],
  );
  assert.equal(projection.actions.every((action) => action.commandBoundary === 'EXISTING_UI_ACTION_REVALIDATED_BY_COMMAND_KERNEL'), true);
  assert.equal(projection.actions.find((action) => action.action === 'open').enabled, true);
  assert.equal(projection.actions.find((action) => action.action === 'create-project').enabled, true);
  assert.equal(projection.actions.find((action) => action.action === 'search').enabled, false);
  assert.equal(projection.actions.find((action) => action.action === 'open-current-scene').enabled, false);
});

test('WP300 block counter is derived from active text paragraphs only', () => {
  assert.equal(countWriterHomeTextBlocks(''), 0);
  assert.equal(countWriterHomeTextBlocks('one paragraph'), 1);
  assert.equal(countWriterHomeTextBlocks('one\n\n two\n\n\nthree'), 3);
});

test('WP300 renderer integration replaces fake startup document with Writer Home', () => {
  const editor = read('src/renderer/editor.js');
  const runtime = read('src/core/runtime.mjs');
  const html = read('src/renderer/index.html');
  const styles = read('src/renderer/styles.css');
  const surface = read('src/renderer/writerHomeSurface.mjs');
  const bundle = read('src/renderer/editor.bundle.js');

  assert.match(editor, /buildWriterHomeProjection/u);
  assert.match(editor, /renderWriterHomeSurface/u);
  assert.match(editor, /showWriterHomeSurface\(\);/u);
  assert.equal(editor.includes("showEditorPanelFor('Yalken');"), false);
  assert.match(runtime, /anchor-lineage-browser-safe-v1\.mjs/u);
  assert.equal(runtime.includes('anchor-lineage-v1.cjs'), false);
  assert.match(html, /data-writer-home/u);
  assert.match(html, /aria-label="Дом проекта"/u);
  assert.match(styles, /\.literal-stage-a \.empty-state\.writer-home:not\(\.hidden\)/u);
  assert.match(styles, /\.writer-home__identity/u);
  const writerHomeStyles = styles.slice(
    styles.indexOf('.empty-state.writer-home'),
    styles.indexOf('.editor-panel-wrapper', styles.indexOf('.empty-state.writer-home')),
  );
  assert.equal(/letter-spacing:\s*-/u.test(writerHomeStyles), false);
  assert.equal(surface.includes('innerHTML'), false);
  assert.match(surface, /textContent|createTextNode/u);
  assert.match(bundle, /writer\.home\.v1/u);
  assert.match(bundle, /writer-home__identity/u);
  assert.equal(bundle.includes('showEditorPanelFor("Yalken")'), false);
  assert.equal(bundle.includes('node:crypto'), false);
});

test('WP300 browser-safe anchor diagnosis preserves T1 stale-witness semantics for the renderer bundle', () => {
  const exact = browserSafeAnchorLineage.resolveAnchorByWitness(
    { quote: 'Anna', prefixContextHash: '', suffixContextHash: '' },
    'Before. Anna arrived.',
  );
  assert.equal(exact.status, browserSafeAnchorLineage.ANCHOR_STATUS.EXACT);
  assert.equal(exact.basis, 'quote');
  assert.deepEqual(
    { startOffset: exact.span.startOffset, endOffset: exact.span.endOffset },
    { startOffset: 8, endOffset: 12 },
  );

  const ambiguous = browserSafeAnchorLineage.resolveAnchorByWitness(
    { quote: 'Anna', prefixContextHash: '', suffixContextHash: '' },
    'Anna left. Anna arrived.',
  );
  assert.equal(ambiguous.status, browserSafeAnchorLineage.ANCHOR_STATUS.AMBIGUOUS);
  assert.deepEqual(
    ambiguous.candidates.map(({ startOffset, endOffset }) => ({ startOffset, endOffset })),
    [
      { startOffset: 0, endOffset: 4 },
      { startOffset: 11, endOffset: 15 },
    ],
  );

  const lost = browserSafeAnchorLineage.resolveAnchorByWitness(
    { quote: 'Anna', prefixContextHash: '', suffixContextHash: '' },
    'Nobody came.',
  );
  assert.equal(lost.status, browserSafeAnchorLineage.ANCHOR_STATUS.LOST);
  assert.equal(lost.reason, 'QUOTE_NOT_FOUND');
});


function homeCreationHandlerHost() {
  const source = read('src/renderer/editor.js');
  const calls = { queries: 0, commands: [], focus: 0, treeReads: 0, status: [] };
  const authoring = Object.freeze({ projectId: 'old-project', documentId: 'old-scene', text: '😀 é unsaved manuscript', generation: 7 });
  const host = {
    EXTRA_COMMAND_IDS: { PROJECT_NEW: 'cmd.project.new', PROJECT_LIFECYCLE_CREATE: 'cmd.project.lifecycle.create' },
    projectLibraryModal: { hidden: true },
    projectLibraryNameInput: { value: '', focus() { calls.focus += 1; } },
    projectLibraryCreateButton: { disabled: false },
    refreshProjectLibraryModal: async () => { calls.queries += 1; },
    dispatchUiCommand: async (id, payload) => { calls.commands.push({ id, payload }); return host.result; },
    unwrapBridgeResult: result => result?.value || result,
    setProjectLibraryStatus: text => { calls.status.push(text); },
    updateStatusText: text => { calls.status.push(text); },
    loadTree: async () => { calls.treeReads += 1; },
    result: { ok: true },
    authoring,
  };
  vm.createContext(host);
  for (const [start, end] of [
    ['function openSimpleModal(modal) {', 'function filterCommandPaletteEntries('],
    ['function openProjectLibraryModal() {', 'async function openSelectedProjectFromLibraryModal() {'],
    ['function handleUiAction(action) {', 'function triggerLeftToolbarAction(action) {'],
  ]) {
    const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a); assert.equal(source.indexOf(start, a + 1), -1);
    vm.runInContext(source.slice(a, b), host);
  }
  return { host, calls, authoring };
}

test('Home Create opens the existing named-project form without resetting or dispatching a product mutation', () => {
  const { host, calls, authoring } = homeCreationHandlerHost();
  const action = buildWriterHomeProjection({ projectId: 'old-project' }).actions.find(action => action.id === 'create-project');
  assert.equal(host.handleUiAction(action.action), true);
  assert.equal(host.projectLibraryModal.hidden, false, 'the promised project form must actually open');
  assert.equal(calls.queries, 1);
  assert.equal(calls.focus, 1, 'Home activation focuses the existing labelled name input');
  assert.deepEqual(calls.commands, [], 'opening a form must not reset a document or create a project');
  assert.equal(host.authoring, authoring);
  assert.equal(host.authoring.text, '😀 é unsaved manuscript');
  host.closeSimpleModal(host.projectLibraryModal);
  assert.equal(host.projectLibraryModal.hidden, true);
  assert.deepEqual(calls.commands, []);
  assert.equal(host.handleUiAction('new'), true);
  assert.deepEqual(calls.commands, [{ id: 'cmd.project.new', payload: undefined }], 'legacy New document keeps its current command meaning');
  assert.equal(host.handleUiAction('unknown-home-action'), false);
});

test('Existing Home create form keeps empty/denied drafts and only explicit valid submit invokes the canonical lifecycle', async () => {
  const { host, calls, authoring } = homeCreationHandlerHost();
  host.openProjectLibraryModal();
  host.projectLibraryNameInput.value = '   ';
  await host.createProjectFromLibraryModal();
  assert.deepEqual(calls.commands, []);
  assert.equal(calls.focus, 1);
  assert.equal(host.projectLibraryNameInput.value, '   ');
  assert.equal(host.projectLibraryModal.hidden, false);
  host.result = { ok: false, value: { reason: 'CAPABILITY_DENIED' } };
  host.projectLibraryNameInput.value = '  Новый проект 😀  ';
  await host.createProjectFromLibraryModal();
  assert.equal(calls.commands.length, 1);
  assert.equal(calls.commands[0].id, 'cmd.project.lifecycle.create');
  assert.equal(calls.commands[0].payload.projectName, 'Новый проект 😀');
  assert.equal(host.projectLibraryNameInput.value, '  Новый проект 😀  ');
  assert.equal(host.projectLibraryModal.hidden, false);
  assert.equal(host.projectLibraryCreateButton.disabled, false);
  assert.equal(calls.treeReads, 0);
  assert.ok(calls.status.includes('CAPABILITY_DENIED'));
  host.result = { ok: true };
  await host.createProjectFromLibraryModal();
  assert.equal(calls.commands.length, 2);
  assert.equal(calls.commands[1].id, 'cmd.project.lifecycle.create');
  assert.equal(calls.commands[1].payload.projectName, 'Новый проект 😀');
  assert.equal(host.projectLibraryNameInput.value, '');
  assert.equal(host.projectLibraryModal.hidden, true);
  assert.equal(host.projectLibraryCreateButton.disabled, false);
  assert.equal(calls.treeReads, 1);
  assert.equal(host.authoring, authoring);
});
