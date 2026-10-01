'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const core = require('../../src/core/word-user-bookmarks-v1.cjs');
const source = fs.readFileSync(path.join(__dirname, '../../src/renderer/editor.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
function handlerHarness() {
  let respond; const effects = [];
  const record = { id: 'ubm-' + '1'.repeat(32), name: 'Цель_Ω', state: 'active' };
  const c = vm.createContext({ URL, Date, Math, crypto: require('node:crypto').webcrypto, isTiptapMode: true, currentProjectId: 'p', currentDocumentId: 'd', localEditGeneration: 1,
    content: 'captured', state: { selectionEmpty: false, link: true, linkHref: 'https://example.invalid' }, allowed: true,
    window: { electronAPI: { invokeWorkspaceQueryBridge() {} } }, LINK_PROMPT_TITLE: 'Link', EXTRA_COMMAND_IDS: { INSERT_LINK_PROMPT: 'link' },
    composeDocumentContent: () => c.content, getTiptapSelectionOffsets: () => ({ start: 2, end: 5 }),
    getTiptapFormattingState: () => c.state, syncToolbarFormattingState() {}, withEditorModeCommandPayload: () => ({}),
    enforceCapabilityForCommand: () => c.allowed ? { ok: true } : { ok: false, error: { reason: 'REVOKED' } },
    setTiptapSelectionOffsets: (...v) => { effects.push(['selection', ...v]); return { performed: true }; },
    handleTiptapFormatCommand: (action,payload) => { effects.push([action, payload]); return { performed: true }; },
    openLinkDialog: options => { c.dialog = options; return new Promise(resolve => { respond = resolve; }); },
    invokeWorkspaceQueryBridge: async () => ({ ok: true, available: true, bookmarks: c.records || [record], projectId: 'p', sceneId: 'a', subjectId: 's',
      expectedSceneSha256: 'digest', registryRevision: 1 }),
    invokePreloadUiCommandBridge: async (command,payload) => { effects.push([command,payload]); return { ok: true }; },
    updateStatusText() {},
  });
  vm.runInContext(source.slice(source.indexOf('function normalizeToolbarLinkPromptCandidate('), source.indexOf('function normalizeToolbarColorPickerMode(')), c);
  vm.runInContext(source.slice(source.indexOf('async function handleUserBookmarkManage('), source.indexOf('function dispatchListTypeAction(')), c);
  return { c, effects, record, respond: value => respond(value), ready: () => new Promise(resolve => setImmediate(resolve)) };
}
test('existing link command sends stable typed target intent and removal remains explicit', async () => {
  const h = handlerHarness(), pending = h.c.handleInsertLinkPrompt(); await h.ready();
  assert.equal(h.c.dialog.bookmarks[0].name, 'Цель_Ω'); h.respond({ bookmarkId: h.record.id });
  assert.equal((await pending).performed, true);
  assert.equal(h.effects[1][0], 'setLink'); assert.deepEqual(clone(h.effects[1][1]), { href: '#Цель_Ω', wordBookmarkId: h.record.id, wordBookmarkName: 'Цель_Ω' });
  const removed = handlerHarness(), p = removed.c.handleInsertLinkPrompt(); await removed.ready(); removed.respond('');
  assert.equal((await p).performed, true); assert.equal(removed.effects[1][0], 'unsetLink');
});
test('delayed target inventory or dialog never grants stale document or capability mutation', async () => {
  for (const kind of ['project', 'generation', 'content', 'capability', 'deleted', 'foreign']) {
    const h = handlerHarness(); if (kind === 'deleted') h.c.records = [{ ...h.record, state: 'deleted' }];
    const pending = h.c.handleInsertLinkPrompt(); await h.ready();
    if (kind === 'project') h.c.currentProjectId = 'foreign';
    if (kind === 'generation') h.c.localEditGeneration++;
    if (kind === 'content') h.c.content = 'owner changed';
    if (kind === 'capability') h.c.allowed = false;
    h.respond({ bookmarkId: kind === 'foreign' ? 'foreign-id' : h.record.id });
    assert.notEqual((await pending).performed, true); assert.equal(h.effects.some(effect => effect[0] === 'setLink'), false);
  }
});
test('bookmark dialog captures selection intent and kernel-bound immutable source identities', async () => {
  const h = handlerHarness(), pending = h.c.handleUserBookmarkManage(); await h.ready();
  h.respond({ action: 'create', name: 'Цель_Ω' }); await pending;
  assert.equal(h.effects[0][0], 'cmd.project.save');
  const command = h.effects[1]; assert.equal(command[0], 'cmd.project.bookmarks.create');
  assert.equal(command[1].selectionStart, 2); assert.equal(command[1].selectionEnd, 5);
  assert.equal(command[1].expectedSceneSha256, 'digest'); assert.equal(command[1].subjectId, 's');
  const stale = handlerHarness(), p = stale.c.handleUserBookmarkManage(); await stale.ready(); stale.c.localEditGeneration++;
  stale.respond({ action: 'delete', bookmarkId: stale.record.id });
  assert.equal((await p).reason, 'STALE_DOCUMENT'); assert.equal(stale.effects.length, 1);
});
async function editorHarness() {
  const { getSchema } = await import('@tiptap/core');
  const { default: StarterKit } = await import('@tiptap/starter-kit');
  const { EditorState, TextSelection } = await import('@tiptap/pm/state');
  const { history, undo, redo } = await import('@tiptap/pm/history');
  const api = await import('../../src/renderer/tiptap/userBookmarks.mjs');
  const schema = getSchema([StarterKit.configure({ link: false, undoRedo: false }), api.UserBookmarks, api.UserBookmarkLink]);
  let initial = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'A', marks: [{ type: 'link', attrs: { href: 'https://example.invalid/a', target: '_blank', rel: 'noopener' } }] },
    { type: 'text', text: 'BCDEF', marks: [{ type: 'bold' }] },
  ] }] };
  initial = core.planMutation({ doc: initial, action: 'create', name: 'Target', requestId: 'seed', projectId: 'p', sceneId: 's', start: { paragraphIndex: 0, offsetUtf16: 2, edge: 'text' },
    end: { paragraphIndex: 0, offsetUtf16: 5, edge: 'text' } }).doc;
  const editor = { schema, state: EditorState.create({ schema, doc: schema.nodeFromJSON(initial), plugins: [history()] }) };
  editor.view = { dispatch: tr => { editor.state = editor.state.apply(tr); } };
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 4)));
  return { editor, api, undo: () => undo(editor.state, editor.view.dispatch), redo: () => redo(editor.state, editor.view.dispatch) };
}
test('plain clipboard text inherits the current typed link without an identity-losing HTML roundtrip', async () => {
  const h = await editorHarness(), e = h.editor;
  const { TextSelection } = await import('@tiptap/pm/state');
  const record = core.readRegistry(e.state.doc.toJSON()).bookmarks[0];
  e.view.dispatch(e.state.tr.addMark(2, 7, e.schema.marks.link.create(core.linkAttrs(record))));
  const before = e.state.doc.toJSON();
  const plugins = h.api.UserBookmarkLink.config.addProseMirrorPlugins.call({ parent: () => [] });
  const parser = plugins.map(plugin => plugin.props.clipboardTextParser).find(Boolean);
  assert.equal(typeof parser, 'function');
  e.view.dispatch(e.state.tr.setSelection(TextSelection.create(e.state.doc, 4)));
  const slice = parser('LOCAL Ω🙂 ', e.state.selection.$from, true, { state: e.state });
  e.view.dispatch(e.state.tr.replaceSelection(slice));
  const saved = core.planSave({ beforeDoc: before, workingDoc: e.state.doc.toJSON() });
  assert.equal(e.state.doc.textContent, 'ABCLOCAL Ω🙂 DEF');
  assert.equal(saved.registry.bookmarks[0].end.offsetUtf16, 15);
  const inserted = e.state.doc.nodeAt(4);
  assert.equal(inserted.marks.find(mark => mark.type.name === 'link').attrs.wordBookmarkId, record.id);
  assert.equal(h.undo(), true);
  assert.equal(e.state.doc.textContent, 'ABCDEF');
  assert.equal(h.redo(), true);
  assert.equal(e.state.doc.textContent, 'ABCLOCAL Ω🙂 DEF');
});
test('clipboard parser stays literal and never accepts HTML identity or changes unrelated paste contexts', async () => {
  const h = await editorHarness(), e = h.editor;
  const record = core.readRegistry(e.state.doc.toJSON()).bookmarks[0];
  const plugins = h.api.UserBookmarkLink.config.addProseMirrorPlugins.call({ parent: () => [] });
  const parser = plugins.map(plugin => plugin.props.clipboardTextParser).find(Boolean);
  assert.equal(typeof parser, 'function');
  assert.equal(parser('x', e.state.doc.resolve(1)), undefined); // External link.
  assert.equal(parser('x', e.state.doc.resolve(4)), undefined); // Bold prose.
  e.view.dispatch(e.state.tr.addMark(2, 7, e.schema.marks.link.create(core.linkAttrs(record))));
  const context = e.state.doc.resolve(4), raw = '<a href="#forged" wordBookmarkId="forged">x</a>';
  const slice = parser(raw + '\r\nΩ\n\nend', context);
  assert.equal(slice.content.childCount, 3);
  assert.equal(slice.content.firstChild.textContent, raw);
  slice.content.descendants(node => {
    if (node.isText) assert.equal(node.marks.find(mark => mark.type.name === 'link').attrs.wordBookmarkId, record.id);
  });
  assert.equal(parser('', context).content.firstChild.textContent, '');
  const attrs = h.api.UserBookmarkLink.config.addAttributes.call({ parent: () => ({}) });
  assert.equal(attrs.wordBookmarkId.parseHTML({ getAttribute: () => record.id }), null);
  assert.equal(attrs.wordBookmarkName.parseHTML({ getAttribute: () => record.name }), null);
});
test('actual ProseMirror metadata ACK preserves text, external attrs, selection and text Undo/Redo', async () => {
  const h = await editorHarness(), e = h.editor, before = e.state.doc.toJSON();
  e.view.dispatch(e.state.tr.insertText('X', 1));
  const working = e.state.doc.toJSON(), mapped = core.planSave({ beforeDoc: before, workingDoc: working });
  const selection = e.state.selection.toJSON(), external = working.content[0].content[1].marks.find(mark => mark.type === 'link');
  assert.equal(h.api.applyUserBookmarkPublication(e, mapped.doc), true);
  assert.deepEqual(e.state.selection.toJSON(), selection); assert.equal(e.state.doc.textContent, 'XABCDEF');
  assert.deepEqual(e.state.doc.toJSON().content[0].content[1].marks.find(mark => mark.type === 'link'), external);
  assert.equal(h.undo(), true); assert.equal(e.state.doc.textContent, 'ABCDEF');
  const restored = core.planSave({ beforeDoc: mapped.doc, workingDoc: e.state.doc.toJSON() });
  assert.equal(restored.registry.bookmarks[0].start.offsetUtf16, 2);
  assert.equal(h.redo(), true); assert.equal(e.state.doc.textContent, 'XABCDEF');
});
test('publication cannot change external targets or nonlink rich semantics under a root-only ACK', async () => {
  for (const kind of ['external', 'text', 'bold']) {
    const h = await editorHarness(), before = h.editor.state.doc.toJSON(), forged = clone(before);
    if (kind === 'external') forged.content[0].content[0].marks[0].attrs.href = 'https://evil.invalid';
    if (kind === 'text') forged.content[0].content[1].text = 'OWNER';
    if (kind === 'bold') forged.content[0].content[1].marks = [];
    assert.equal(h.api.applyUserBookmarkPublication(h.editor, forged), false);
    assert.deepEqual(h.editor.state.doc.toJSON(), before);
  }
});
test('rename publication changes only the selected stable target and preserves external attributes', async () => {
  const h = await editorHarness(), e = h.editor;
  const id = core.readRegistry(e.state.doc.toJSON()).bookmarks[0].id;
  const record = core.readRegistry(e.state.doc.toJSON()).bookmarks[0];
  e.view.dispatch(e.state.tr.addMark(2, 4, e.schema.marks.link.create(core.linkAttrs(record))));
  const before = e.state.doc.toJSON(), renamed = core.planMutation({ doc: before, action: 'rename', bookmarkId: id, name: 'Renamed' }).doc;
  const external = clone(before.content[0].content[0].marks.find(mark => mark.type === 'link'));
  assert.equal(h.api.applyUserBookmarkPublication(e, renamed), false);
  assert.equal(h.api.applyUserBookmarkPublication(e, renamed, id), true);
  assert.deepEqual(clone(e.state.doc.toJSON().content[0].content[0].marks.find(mark => mark.type === 'link')), external);
  assert.equal(e.state.doc.textContent, 'ABCDEF');
  assert.equal(e.state.doc.toJSON().content[0].content[1].marks.find(mark => mark.type === 'link').attrs.href, '#Renamed');
  const forged = clone(e.state.doc.toJSON()); forged.content[0].content[0].marks[0].attrs.rel = 'changed';
  assert.equal(h.api.applyUserBookmarkPublication(e, forged, id), false);
});


test('renderer Manage admission refusal never sends its first automatic save', async () => {
  const h = handlerHarness(); let calls = 0;
  h.c.invokeWorkspaceQueryBridge = async (id, payload) => {
    calls++; assert.equal(id, 'query.project.userBookmarks'); assert.equal(payload.admissionOnly, true);
    return { ok: false, available: false, reason: 'USER_BOOKMARK_PROJECT_READ_ONLY' };
  };
  assert.equal((await h.c.handleUserBookmarkManage()).reason, 'USER_BOOKMARK_PROJECT_READ_ONLY');
  assert.equal(calls, 1); assert.equal(h.effects.length, 0); assert.equal(h.c.dialog, undefined);
});
