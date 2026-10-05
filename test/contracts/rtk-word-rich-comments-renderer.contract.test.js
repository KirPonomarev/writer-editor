'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/editor.js'), 'utf8');
const body = () => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rich\tcomment', marks: [{ type: 'bold' }] }, { type: 'hardBreak' }, { type: 'text', text: 'Second line' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Second paragraph' }] }] });
const rich = document => ({ schemaVersion: 'yalken.word.comment-body.v1', document });
const binding = { projectId: 'p', sceneId: 'scene', subjectId: 'subject', expectedStateSha256: 'state', expectedSceneSha256: 'scenehash' };
function harness() {
  let created = 0, destroyed = 0, sets = 0, renders = 0, changes, save;
  let editable = true, json, focused = 0;
  const slot = { append(host) { host.isConnected = true; } };
  const host = { events: {}, isConnected: false, addEventListener(name, fn) { this.events[name] = fn; }, remove() { this.isConnected = false; }, contains(target) { return target === this.focusChild; } };
  const focusChild = { isConnected: true, focus() { focused++; } }; host.focusChild = focusChild;
  const ctx = vm.createContext({
    wordCommentDraft: { requestId: 'draft1', binding, richBody: rich(body()) }, wordCommentEditor: null, wordCommentEditorHost: null, wordCommentEditorRequestId: null,
    wordCommentBusy: false, wordCommentComposing: false, wordCommentRenderPending: false,
    reviewSurfaceState: {}, reviewSurfaceExactTextApplyTransientState: null, RIGHT_RAIL_SURFACE_PROVIDERS: { comments: 'comments' },
    HTMLElement: Object, document: { activeElement: null, createElement: () => host }, queueMicrotask: fn => fn(),
    buildReviewSurfaceViewModel: () => ({ status: 'ready' }), renderReviewSurfaceMarkup: () => { renders++; return ''; },
    reviewSurfaceHost: { dataset: {}, querySelector: selector => selector.includes('editor-slot') ? slot : { click() { save++; } } },
    createManuscriptBodyEditor: (_host, options) => {
      assert.equal(options.profile, 'comment'); created++; changes = options.onChange; save = options.onSave;
      return { setDocument(value) { sets++; json = value; }, getJSON: () => json, setEditable(value) { editable = value; }, destroy() { destroyed++; }, focus() { focused++; } };
    },
  });
  const start = source.indexOf('function mountWordCommentDraftEditor()');
  vm.runInContext(source.slice(start, source.indexOf('function wordCommentSelectionIntent()', start)), ctx);
  const renderStart = source.indexOf('function renderReviewSurface()');
  vm.runInContext(source.slice(renderStart, source.indexOf('function setReviewSurfaceState(', renderStart)), ctx);
  return { ctx, host, focusChild, change: document => changes(document), counts: () => ({ created, destroyed, sets, renders, focused }), editable: () => editable };
}

test('projection refresh retains rich draft editor and history identity; busy and failed save do not replace document', () => {
  const h = harness(); h.ctx.renderReviewSurface();
  const editor = h.ctx.wordCommentEditor, draft = h.ctx.wordCommentDraft;
  const changed = body(); changed.content[0].content[0].marks = [{ type: 'italic' }]; h.change(changed);
  h.ctx.document.activeElement = h.focusChild;
  h.ctx.renderReviewSurface();
  assert.equal(h.ctx.wordCommentEditor, editor); assert.equal(h.ctx.wordCommentDraft, draft);
  assert.deepEqual(draft.richBody.document, changed); assert.equal(h.counts().sets, 1); assert.equal(h.counts().focused, 1);
  h.ctx.wordCommentBusy = true; h.ctx.renderReviewSurface(); assert.equal(h.editable(), false);
  h.change(body()); assert.deepEqual(draft.richBody.document, changed);
  h.ctx.wordCommentBusy = false; h.ctx.renderReviewSurface(); assert.equal(h.editable(), true);
  assert.equal(h.counts().sets, 1); assert.equal(h.counts().created, 1); assert.equal(h.counts().destroyed, 0);
});

test('IME composition defers destructive markup publication until composition ends', () => {
  const h = harness(); h.ctx.renderReviewSurface(); h.host.events.compositionstart();
  h.ctx.renderReviewSurface(); h.ctx.renderReviewSurface();
  assert.equal(h.counts().renders, 1); assert.equal(h.ctx.wordCommentRenderPending, true);
  h.host.events.compositionend(); assert.equal(h.counts().renders, 2); assert.equal(h.counts().sets, 1);
  assert.equal(h.ctx.wordCommentComposing, false); assert.equal(h.ctx.wordCommentRenderPending, false);
});

test('explicit cancellation disposes editor; a different draft initializes once and cannot retain prior history', () => {
  const h = harness(); h.ctx.renderReviewSurface(); h.ctx.wordCommentDraft = null; h.ctx.renderReviewSurface();
  assert.equal(h.counts().destroyed, 1); assert.equal(h.ctx.wordCommentEditor, null);
  h.ctx.wordCommentDraft = { requestId: 'draft2', binding, richBody: rich(body()) }; h.ctx.renderReviewSurface();
  assert.equal(h.counts().created, 2); assert.equal(h.counts().sets, 2);
});

test('comment editor actual schema admits rich paragraphs and excludes unsupported blocks; edits and undo preserve marks', async () => {
  const [{ Editor }, ui] = await Promise.all([import('@tiptap/core'), import('../../src/renderer/tiptap/manuscriptNotes.mjs')]);
  const editor = new Editor({ element: null, extensions: ui.manuscriptBodyExtensions({ profile: 'comment' }), content: body() });
  try {
    for (const type of ['table', 'image', 'bulletList', 'orderedList', 'listItem', 'heading', 'codeBlock']) assert.equal(editor.schema.nodes[type], undefined, type);
    const initial = ui.readManuscriptBodyDocument(editor);
    editor.commands.setTextSelection({ from: 1, to: 5 }); editor.commands.toggleItalic();
    assert.notDeepEqual(ui.readManuscriptBodyDocument(editor), initial);
    // A headless Tiptap Editor has no mounted view/plugins. Exercise actual
    // ProseMirror history with this exact comment schema instead.
    const { EditorState } = await import('@tiptap/pm/state');
    const { history, undo, redo } = await import('@tiptap/pm/history');
    let state = EditorState.create({ schema: editor.schema, doc: editor.schema.nodeFromJSON(initial), plugins: [history()] });
    const before = state.doc.toJSON(), dispatch = tr => { state = state.apply(tr); };
    dispatch(state.tr.addMark(1, 5, editor.schema.marks.italic.create()));
    assert.equal(undo(state, dispatch), true); assert.deepEqual(state.doc.toJSON(), before);
    assert.equal(redo(state, dispatch), true); assert.notDeepEqual(state.doc.toJSON(), before);
    assert.equal(editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', '\n'), 'Rich\tcomment\nSecond line\nSecond paragraph');
  } finally { editor.destroy(); }
});

test('opening legacy text preserves hard-break semantics and rich bodies preserve independent paragraph boundaries', async () => {
  const ui = await import('../../src/renderer/tiptap/manuscriptNotes.mjs');
  const legacy = ui.commentBodyDocumentForEditor({ body: 'A\nB\tC' });
  assert.equal(legacy.content.length, 1); assert.equal(legacy.content[0].content[1].type, 'hardBreak');
  const actual = ui.commentBodyDocumentForEditor({ body: 'Rich\tcomment\nSecond line\nSecond paragraph', richBody: rich(body()) });
  assert.equal(actual.content.length, 2); assert.equal(actual.content[0].content[1].type, 'hardBreak');
});

test('rich Save uses original command binding, retains failed draft and rejects stale projection without dispatch', async () => {
  const calls = [], draft = { binding, requestId: 'op1', action: 'edit', threadId: 't', commentId: 'c', richBody: rich(body()) };
  const ctx = vm.createContext({ TextEncoder, wordCommentEditor: null, wordCommentDraft: draft, wordCommentBusy: false, wordCommentNotice: '',
    reviewSurfaceState: { commentAuthoring: { available: true, ...binding } }, renderReviewSurface() {},
    reviewSurfaceUnwrapCommandResult: x => x, invokePreloadUiCommandBridge: async (id, payload) => { calls.push({ id, payload }); return { ok: false, reason: 'COMMENT_STATE_CONFLICT' }; },
    loadReviewSurfaceFromQuery: async () => {},
  });
  const start = source.indexOf('async function handleWordCommentAction(');
  vm.runInContext(source.slice(start, source.indexOf('function reviewSurfaceNormalizeState(', start)), ctx);
  const saveButton = { disabled: false, dataset: { wordCommentAction: 'save' } };
  await ctx.handleWordCommentAction(saveButton);
  assert.equal(calls.length, 1); assert.equal(calls[0].id, 'cmd.project.review.editComment');
  assert.deepEqual(JSON.parse(calls[0].payload.richBodyJson), draft.richBody); assert.equal(Object.hasOwn(calls[0].payload, 'richBody'), false); assert.equal(Object.hasOwn(calls[0].payload, 'body'), false);
  const { createEnvelope, validateIpcEnvelope } = require('../../src/core/ipc-envelope-v1.cjs');
  const wire = createEnvelope('ui:command-bridge', calls[0].id, calls[0].payload);
  assert.equal(validateIpcEnvelope(wire, 'ui:command-bridge').ok, true);
  const nested = createEnvelope('ui:command-bridge', calls[0].id, { ...calls[0].payload, richBody: draft.richBody });
  assert.equal(validateIpcEnvelope(nested, 'ui:command-bridge').code, 'E_ENVELOPE_DEPTH');
  assert.equal(calls[0].payload.expectedStateSha256, binding.expectedStateSha256);
  assert.equal(ctx.wordCommentDraft, draft); assert.equal(ctx.wordCommentBusy, false); assert.match(ctx.wordCommentNotice, /COMMENT_STATE_CONFLICT/);
  const large = { schemaVersion: 'yalken.word.comment-body.v1', document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '😀'.repeat(17000) }] }] } };
  ctx.wordCommentDraft = { ...draft, richBody: large };
  await ctx.handleWordCommentAction(saveButton); assert.equal(calls.length, 1); assert.equal(ctx.wordCommentDraft.richBody, large); assert.match(ctx.wordCommentNotice, /слишком большой/);
  ctx.wordCommentDraft = draft;
  for (const key of ['projectId', 'sceneId', 'subjectId', 'expectedStateSha256', 'expectedSceneSha256']) {
    ctx.reviewSurfaceState.commentAuthoring = { available: true, ...binding, [key]: 'changed' };
    await ctx.handleWordCommentAction(saveButton); assert.equal(calls.length, 1, key); assert.equal(ctx.wordCommentDraft, draft);
  }
});

function formattingHarness({ fallback = false, unsupported = false, readOnly = false, focus = true } = {}) {
  const code = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/tiptap/index.js'), 'utf8');
  const mutations = [], reads = [];
  function editor(name, auxiliary = false) {
    const commands = Object.fromEntries(['setTextSelection','setParagraph','setBlockquote','setHeading','toggleBold','toggleItalic','toggleUnderline','toggleCode','toggleBulletList','toggleOrderedList','setParagraphAlignment','setColor','unsetColor','setHighlight','unsetHighlight','setLink','unsetLink'].map(command => [command, () => { mutations.push({ name, command }); return true; }]));
    if (auxiliary && unsupported) for (const key of Object.keys(commands)) delete commands[key];
    const value = { name, commands, isEditable: !(auxiliary && readOnly), state: { doc: {}, selection: { empty: false, from: 3, to: 8 } } };
    if (!(auxiliary && fallback)) value.chain = () => {
      let pending;
      const chain = { focus() { return this; }, clearNodes() { return this; }, extendMarkRange() { return this; }, run() { return commands[pending](); } };
      for (const command of Object.keys(commands)) chain[command] = () => { pending = command; return chain; };
      return chain;
    };
    return value;
  }
  const main = editor('manuscript'), auxiliary = editor('comment', true);
  const ctx = vm.createContext({ currentEditorInstance: main, getFocusedManuscriptBodyEditor: () => focus ? auxiliary : null,
    STRUCTURED_PARAGRAPH_STYLE_OPTIONS: new Set(['paragraph-none','paragraph-heading1']), STRUCTURED_CHARACTER_STYLE_OPTIONS: new Set(['character-emphasis','character-code']),
    createStructuredStyleResult: (action, performed, reason) => ({ action, performed, reason }), getStructuredParagraphStyleOption: () => '',
    normalizeFormattingColor: value => value || '', notifyFormattingStateChange: target => reads.push(target?.name),
    readFormattingState: target => { reads.push(target.name); return { selectionEmpty: false, bulletList: true, orderedList: false }; },
  });
  vm.runInContext(code.slice(code.indexOf('function runFocusedChainCommand('), code.indexOf('function createIpcSession(')), ctx);
  vm.runInContext(code.slice(code.indexOf('export function getTiptapFormattingState('), code.indexOf('export function undoTiptap(')).replaceAll('export function', 'function'), ctx);
  vm.runInContext(code.slice(code.indexOf('function runTiptapStructuredParagraphStyle('), code.indexOf('export function applyTiptapParagraphStyle(')), ctx);
  return { ctx, mutations, reads, main, auxiliary };
}

test('actual formatting dispatch and state reads stay on focused comment for menu inline, color, link and fallback commands', () => {
  for (const fallback of [false, true]) {
    const h = formattingHarness({ fallback });
    const commands = fallback ? ['toggleUnderline','setColor','unsetColor','setHighlight','unsetHighlight','setLink','unsetLink','clearList']
      : ['toggleBold','toggleItalic','toggleUnderline','setParagraphAlignment','setColor','unsetColor','setHighlight','unsetHighlight','setLink','unsetLink','clearList'];
    for (const command of commands) {
      const result = h.ctx.runTiptapFormatCommand(command, { value: command === 'setParagraphAlignment' ? 'left' : '#123456', href: 'https://example.org' });
      assert.equal(result.performed, true, command);
    }
    h.ctx.getTiptapFormattingState();
    assert.equal(h.mutations.length, commands.length); assert(h.mutations.every(change => change.name === 'comment'));
    assert(h.reads.length > 0 && h.reads.every(name => name === 'comment'));
  }
});

test('unsupported or read-only auxiliary formatting never falls back to the manuscript; main remains usable without auxiliary focus', () => {
  for (const options of [{ unsupported: true }, { unsupported: true, fallback: true }, { readOnly: true }]) {
    const h = formattingHarness(options);
    for (const command of ['toggleBold','toggleItalic','toggleUnderline','setParagraphAlignment','setColor','unsetColor','setHighlight','unsetHighlight','setLink','unsetLink','clearList']) {
      assert.equal(h.ctx.runTiptapFormatCommand(command, { value: '#123456', href: 'https://example.org' }).performed, false, command);
    }
    assert.deepEqual(h.mutations, []);
  }
  const h = formattingHarness({ focus: false });
  assert.equal(h.ctx.runTiptapFormatCommand('toggleUnderline').performed, true);
  assert.deepEqual(h.mutations, [{ name: 'manuscript', command: 'toggleUnderline' }]);
});


test('structured style menu routes emphasis to auxiliary and refuses unsupported or read-only targets without touching manuscript', () => {
  for (const fallback of [false, true]) {
    const h = formattingHarness({ fallback });
    assert.equal(h.ctx.runTiptapStructuredCharacterStyle('character-emphasis').performed, true);
    assert.deepEqual(h.mutations, [{ name: 'comment', command: 'toggleItalic' }]);
  }
  for (const options of [{ unsupported: true }, { unsupported: true, fallback: true }, { readOnly: true }]) {
    const h = formattingHarness(options);
    assert.equal(h.ctx.runTiptapStructuredCharacterStyle('character-emphasis').performed, false);
    assert.equal(h.ctx.runTiptapStructuredCharacterStyle('character-code').performed, false);
    assert.equal(h.ctx.runTiptapStructuredParagraphStyle('paragraph-heading1').performed, false);
    assert.deepEqual(h.mutations, []);
  }
  const h = formattingHarness({ focus: false });
  assert.equal(h.ctx.runTiptapStructuredParagraphStyle('paragraph-heading1').performed, true);
  assert.deepEqual(h.mutations, [{ name: 'manuscript', command: 'setHeading' }]);
});


function linkDialogHarness() {
  const h = formattingHarness();
  const code = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/tiptap/index.js'), 'utf8');
  vm.runInContext(code.slice(code.indexOf('export function captureTiptapLinkTarget('), code.indexOf('export function getTiptapFormattingState(')).replace('export function', 'function'), h.ctx);
  let resolve;
  Object.assign(h.ctx, {
    isTiptapMode: true, normalizeToolbarFormattingState: value => value, syncToolbarFormattingState() {},
    currentProjectId: 'project', currentDocumentId: 'scene', localEditGeneration: 0, composeDocumentContent: () => 'main unchanged',
    window: { electronAPI: { invokeWorkspaceQueryBridge() {} } }, invokeWorkspaceQueryBridge: async () => { throw Error('auxiliary must not request main bookmarks'); },
    openLinkDialog: () => new Promise(done => { resolve = done; }), LINK_PROMPT_TITLE: 'Link', readToolbarLinkPromptInitialValue: () => '',
    normalizeToolbarLinkPromptValue: value => ({ ok: true, href: value }), enforceCapabilityForCommand: () => ({ ok: true }),
    EXTRA_COMMAND_IDS: { INSERT_LINK_PROMPT: 'insert' }, withEditorModeCommandPayload: () => ({}),
    getTiptapSelectionOffsets: () => { throw Error('must not read main selection'); }, setTiptapSelectionOffsets: () => { throw Error('must not restore main selection'); },
    handleTiptapFormatCommand: () => { throw Error('must not rediscover target after await'); },
  });
  vm.runInContext(source.slice(source.indexOf('async function handleInsertLinkPrompt('), source.indexOf('function dispatchListTypeAction(')), h.ctx);
  return { ...h, respond: value => resolve(value) };
}

test('actual asynchronous link dialog retains captured auxiliary identity when dialog focus moves to manuscript', async () => {
  const h = linkDialogHarness(); const pending = h.ctx.handleInsertLinkPrompt();
  h.ctx.getFocusedManuscriptBodyEditor = () => null;
  h.respond('https://example.org/comment'); assert.equal((await pending).performed, true);
  assert.deepEqual(h.mutations, [{ name: 'comment', command: 'setLink' }]);
});

test('link dialog cancellation, stale document, destroyed/read-only target and changed project never write either editor', async () => {
  for (const mutation of ['cancel','changedDoc','destroyed','readonly','project','bookmark']) {
    const h = linkDialogHarness(); const pending = h.ctx.handleInsertLinkPrompt();
    if (mutation === 'changedDoc') h.auxiliary.state.doc = {};
    if (mutation === 'destroyed') h.auxiliary.isDestroyed = true;
    if (mutation === 'readonly') h.auxiliary.isEditable = false;
    if (mutation === 'project') h.ctx.currentProjectId = 'foreign';
    h.respond(mutation === 'cancel' ? null : mutation === 'bookmark' ? { bookmarkId: 'main-only' } : 'https://example.org');
    assert.equal((await pending).performed, false, mutation); assert.deepEqual(h.mutations, [], mutation);
  }
});

test('whole-comment underline serializes Word language on soft breaks without discarding formatting or relaxing language validation', async () => {
  const [{ Editor }, ui] = await Promise.all([import('@tiptap/core'), import('../../src/renderer/tiptap/manuscriptNotes.mjs')]);
  const language = { bidi: 'ar-SA', eastAsia: 'ru-RU', val: 'en-US' };
  const style = { type: 'textStyle', attrs: { wordLanguage: language, fontFamily: 'Times New Roman', fontSize: '12pt' } };
  const document = { type: 'doc', content: [
    { type: 'paragraph', attrs: { wordParagraphMarkLanguage: language, wordParagraphSpacing: { after: 160, line: 278, lineRule: 'auto' } }, content: [{ type: 'text', text: 'ROOT_BOLD', marks: [style, { type: 'bold' }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Second\tparagraph', marks: [style] }, { type: 'hardBreak', marks: [style] }, { type: 'text', text: 'soft break ', marks: [style] }, { type: 'text', text: 'reference', marks: [style, { type: 'underline' }, { type: 'link', attrs: { href: 'https://example.org' } }] }] },
  ] };
  const editor = new Editor({ element: null, extensions: ui.manuscriptBodyExtensions({ profile: 'comment' }), content: document });
  try {
    editor.commands.selectAll(); editor.commands.toggleUnderline();
    const raw = editor.getJSON(), snapshot = JSON.stringify(raw);
    assert(raw.content[1].content.find(node => node.type === 'hardBreak').marks.some(mark => mark.attrs?.wordLanguage));
    const actual = ui.readManuscriptBodyDocument(editor, 'comment');
    const core = require('../../src/core/word-comment-body-v1.cjs');
    const checked = core.validateCommentRichBody(rich(actual));
    for (const paragraph of checked.richBody.document.content) for (const node of paragraph.content || []) {
      assert(node.marks.some(mark => mark.type === 'underline'), node.type);
      assert.deepEqual(node.marks.find(mark => mark.type === 'textStyle').attrs.wordLanguage, language);
    }
    assert.equal(JSON.stringify(editor.getJSON()), snapshot);
    const malformed = structuredClone(raw);
    malformed.content[1].content.find(node => node.type === 'hardBreak').marks.find(mark => mark.type === 'textStyle').attrs.wordLanguage.val = '../../invalid';
    assert.throws(() => ui.readManuscriptBodyDocument({ getJSON: () => malformed }, 'comment'), /WORD_LANGUAGE_INVALID/);
  } finally { editor.destroy(); }
});

test('Save serializes the live rich editor and refuses update errors instead of publishing a stale prior draft', async () => {
  const calls = [], prior = rich(body());
  const ctx = vm.createContext({ TextEncoder, wordCommentDraft: { binding, action: 'edit', requestId: 'savedraft', threadId: 't', commentId: 'c', richBody: prior },
    wordCommentEditor: { getJSON() { throw Error('WORD_LANGUAGE_INVALID'); } }, wordCommentBusy: false, wordCommentNotice: '',
    reviewSurfaceState: { commentAuthoring: { available: true, ...binding } }, renderReviewSurface() {}, reviewSurfaceUnwrapCommandResult: x => x,
    invokePreloadUiCommandBridge: async (_id, payload) => { calls.push(payload); return { ok: false, reason: 'TEST_RETAIN' }; }, loadReviewSurfaceFromQuery: async () => {},
  });
  const start = source.indexOf('async function handleWordCommentAction(');
  vm.runInContext(source.slice(start, source.indexOf('function reviewSurfaceNormalizeState(', start)), ctx);
  const button = { disabled: false, dataset: { wordCommentAction: 'save' } };
  await ctx.handleWordCommentAction(button); assert.equal(calls.length, 0); assert.equal(ctx.wordCommentDraft.richBody, prior); assert.match(ctx.wordCommentNotice, /WORD_LANGUAGE_INVALID/);
  const live = body(); live.content[0].content[0].marks.push({ type: 'underline' }); ctx.wordCommentEditor.getJSON = () => live;
  await ctx.handleWordCommentAction(button); assert.equal(calls.length, 1); assert.deepEqual(JSON.parse(calls[0].richBodyJson).document, live);
});

test('comment and manuscript break projections preserve valid language and adjacent marks while malformed metadata refuses', async () => {
  const ui = await import('../../src/renderer/tiptap/manuscriptNotes.mjs');
  const core = require('../../src/core/word-comment-body-v1.cjs');
  const languageMark = { type: 'textStyle', attrs: { wordLanguage: { val: 'en-US' } } };
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'before' },
    { type: 'hardBreak', marks: [languageMark, { type: 'bold' }] },
    { type: 'hardBreak', marks: [languageMark, { type: 'italic' }] },
    { type: 'text', text: 'after' },
  ] }] };
  const read = input => ui.readManuscriptBodyDocument({ getJSON: () => structuredClone(input) }, 'comment');
  const actual = read(doc);
  assert.deepEqual(actual.content[0].content, doc.content[0].content);
  assert.equal(core.validateCommentRichBody(rich(actual)).body, 'before\n\nafter');
  const unknownField = structuredClone(doc); unknownField.content[0].content[1].payload = 'must not disappear';
  assert.throws(() => read(unknownField), /COMMENT_RICH_BODY_PROFILE/);
  for (const mark of [{ type: 'unsupported' }, { type: 'bold', attrs: { unsupported: 'value' } }]) {
    const bad = structuredClone(doc); bad.content[0].content[1].marks.push(mark);
    assert.throws(() => core.validateCommentRichBody(rich(read(bad))));
  }
  const manuscript = ui.readManuscriptBodyDocument({ getJSON: () => structuredClone(doc) });
  assert.deepEqual(manuscript.content[0].content, doc.content[0].content);
  for (const language of [{ val: '../../invalid' }, { val: 'en-US', unknown: 'value' }, {}]) {
    const malformed = structuredClone(doc);
    malformed.content[0].content[1].marks[0].attrs.wordLanguage = language;
    assert.throws(() => ui.readManuscriptBodyDocument({ getJSON: () => malformed }), /WORD_LANGUAGE_INVALID/);
  }
});
