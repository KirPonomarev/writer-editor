const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/editor.js'), 'utf8');
// Execute the actual async command handler with controlled lifecycle/capability
// ports, so a delayed dialog response can race a document change deterministically.
function harness() {
  let respond;
  const effects = [];
  const context = vm.createContext({
    URL, isTiptapMode: true, currentProjectId: 'p1', currentDocumentId: 'd1',
    localEditGeneration: 4, content: 'original', allowed: true,
    window: { electronAPI: {} }, LINK_PROMPT_TITLE: 'Insert link',
    EXTRA_COMMAND_IDS: { INSERT_LINK_PROMPT: 'cmd.project.insert.linkPrompt' },
    state: { selectionEmpty: false, link: true, linkHref: 'https://example.invalid/old' },
    composeDocumentContent: () => context.content,
    getTiptapFormattingState: () => context.state,
    syncToolbarFormattingState: () => {},
    getTiptapSelectionOffsets: () => ({ start: 7, end: 16 }),
    setTiptapSelectionOffsets: (start, end) => { effects.push(['selection', start, end]); return { performed: true }; },
    handleTiptapFormatCommand: (name, payload) => { effects.push([name, payload?.href]); return { performed: true }; },
    openLinkDialog: () => new Promise((resolve) => { respond = resolve; }),
    withEditorModeCommandPayload: () => ({ editorMode: 'tiptap' }),
    enforceCapabilityForCommand: () => context.allowed ? { ok: true } : { ok: false, error: { reason: 'REVOKED' } },
  });
  vm.runInContext(source.slice(source.indexOf('function normalizeToolbarLinkPromptCandidate('), source.indexOf('function normalizeToolbarColorPickerMode(')), context);
  vm.runInContext(source.slice(source.indexOf('async function handleInsertLinkPrompt('), source.indexOf('function dispatchListTypeAction(')), context);
  return { context, effects, run: () => context.handleInsertLinkPrompt(), respond: (v) => respond(v) };
}

test('link authoring applies only to captured selection and supports explicit removal', async () => {
  for (const [input, expected] of [['https://example.invalid/new', 'setLink'], ['', 'unsetLink']]) {
    const h = harness(), pending = h.run(); h.respond(input);
    assert.equal((await pending).performed, true);
    assert.deepEqual(h.effects[0], ['selection', 7, 16]);
    assert.equal(h.effects[1][0], expected);
  }
});

test('delayed link response cannot mutate changed document, project, generation or content', async () => {
  for (const [key, value] of [['currentProjectId', 'p2'], ['currentDocumentId', 'd2'], ['localEditGeneration', 5], ['content', 'changed'], ['isTiptapMode', false]]) {
    const h = harness(), pending = h.run(); h.context[key] = value; h.respond('https://example.invalid/new');
    assert.equal((await pending).reason, 'STALE_DOCUMENT');
    assert.deepEqual(h.effects, []);
  }
});

test('link authoring revalidates capability after the dialog and cancels without effects', async () => {
  const h = harness(), pending = h.run(); h.context.allowed = false; h.respond('https://example.invalid/new');
  assert.equal((await pending).error.reason, 'REVOKED'); assert.deepEqual(h.effects, []);
  const c = harness(), cancelled = c.run(); c.respond(null);
  assert.equal((await cancelled).reason, 'USER_CANCELLED'); assert.deepEqual(c.effects, []);
  const empty = harness(); empty.context.state = { selectionEmpty: true, link: false };
  assert.equal((await empty.run()).reason, 'NO_SELECTION'); assert.deepEqual(empty.effects, []);
});

test('link input rejects executable, credentialed, control and oversized targets', () => {
  const h = harness();
  for (const href of ['javascript:alert(1)', 'file:///tmp/a', 'https://user:pass@example.invalid', 'https://example.invalid/\\foo', 'https://example.invalid/\u0001', 'https://example.invalid/' + 'a'.repeat(2048)]) {
    assert.equal(h.context.normalizeToolbarLinkPromptValue(href).ok, false, href.slice(0, 100));
  }
  assert.equal(h.context.normalizeToolbarLinkPromptValue('https://example.invalid/путь#фрагмент').ok, true);
});
