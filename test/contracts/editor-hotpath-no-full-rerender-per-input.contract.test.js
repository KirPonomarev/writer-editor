const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const EDITOR_PATH = path.join(process.cwd(), 'src/renderer/editor.js');

function readEditorSource() {
  return fs.readFileSync(EDITOR_PATH, 'utf8');
}

function extractBlockFrom(source, anchor) {
  const startIndex = source.indexOf(anchor);
  assert.ok(startIndex >= 0, `anchor not found: ${anchor}`);
  const braceStart = source.indexOf('{', startIndex);
  assert.ok(braceStart >= 0, `block start not found for anchor: ${anchor}`);
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(braceStart + 1, i);
      }
    }
  }
  throw new Error(`unclosed block for anchor: ${anchor}`);
}

test('editor hot-path: input handler avoids direct full rerender calls', () => {
  const source = readEditorSource();
  const inputBody = extractBlockFrom(extractEditorInputBranches(source).legacy, "editor.addEventListener('input', () =>");

  assert.match(inputBody, /scheduleIncrementalInputDomSync\(\);/);
  assert.match(inputBody, /syncPlainTextBufferFromEditorDom\(\);/);
  assert.match(inputBody, /scheduleDeferredHotpathRender\(\{\s*includePagination:\s*false/s);
  assert.match(inputBody, /scheduleDeferredPaginationRefresh\(\);/);

  assert.doesNotMatch(inputBody, /setPlainText\s*\(/);
  assert.doesNotMatch(inputBody, /renderStyledView\s*\(/);
  assert.doesNotMatch(inputBody, /paginateNodes\s*\(/);
  assert.doesNotMatch(inputBody, /editor\.innerHTML\s*=/);
});

test('editor hot-path: coalescing and deferred pagination are wired', () => {
  const source = readEditorSource();

  assert.match(source, /const HOTPATH_RENDER_DEBOUNCE_MS = 32;/);
  assert.match(source, /const HOTPATH_FULL_RENDER_MIN_INTERVAL_MS = 280;/);
  assert.match(source, /const HOTPATH_PAGINATION_IDLE_DELAY_MS = 220;/);

  const incrementalSyncBody = extractBlockFrom(source, 'function scheduleIncrementalInputDomSync()');
  assert.match(incrementalSyncBody, /requestAnimationFrame/);

  const deferredPaginationBody = extractBlockFrom(source, 'function scheduleDeferredPaginationRefresh()');
  assert.match(deferredPaginationBody, /requestIdleCallback/);
  assert.match(deferredPaginationBody, /scheduleDeferredHotpathRender\(\{\s*includePagination:\s*true/s);
});

test('editor hot-path: pagination path uses batched overflow checks', () => {
  const source = readEditorSource();
  const paginateBody = extractBlockFrom(source, 'function paginateNodes(nodes)');

  assert.match(paginateBody, /PAGINATION_MEASURE_BATCH_SIZE/);
  assert.match(paginateBody, /flushOverflowIfNeeded/);
  assert.doesNotMatch(paginateBody, /currentContent\.appendChild\(node\)\s*;\s*const limit = currentContent\.clientHeight/s);
});

function extractEditorInputBranches(source) {
  const observer = source.indexOf('function handleTiptapDocumentUpdate()');
  assert.ok(observer >= 0, 'transaction observer exists');
  const start = source.indexOf('\nif (isTiptapMode) {', observer);
  assert.ok(start > observer, 'input registration follows the transaction observer');
  const routing = source.slice(start);
  const tiptap = extractBlockFrom(routing, 'if (isTiptapMode) {');
  const afterTiptap = routing.slice(routing.indexOf('{') + tiptap.length + 2);
  assert.match(afterTiptap, /^\s*else\s*\{/, 'legacy is the paired else, not an unrelated listener');
  return { tiptap, legacy: extractBlockFrom(afterTiptap, 'else') };
}

function extractHotpathFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  const lineEnd = source.indexOf('\n', start);
  const open = source.lastIndexOf('{', lineEnd);
  assert.match(source.slice(start, open + 1), /\)\s*\{$/);
  // Start after the complete signature: options = {} is not the function body.
  return source.slice(start, open + 1) + extractBlockFrom(source.slice(open), '{') + '}';
}

function tiptapInputHarness(source) {
  const vm = require('node:vm');
  const branches = extractEditorInputBranches(source);
  const indexSource = fs.readFileSync(path.join(process.cwd(), 'src/renderer/tiptap/index.js'), 'utf8');
  assert.match(source, /initTiptap\(editor,\s*\{\s*attachIpc:\s*false,[\s\S]*?onDocumentUpdate:\s*handleTiptapDocumentUpdate,/);
  const onUpdate = extractBlockFrom(indexSource, 'onUpdate: () =>');
  const events = {}, frames = [], timers = [], signals = [], reads = [], notifications = [];
  const forbidden = name => { const error = new Error('DIRECT_FULL_RENDER:' + name); error.code = 'DIRECT_FULL_RENDER'; throw error; };
  const editor = { addEventListener(name, callback) {
    assert.equal(events[name], undefined, 'one actual registered handler per input type');
    events[name] = callback;
  } };
  Object.defineProperty(editor, 'innerHTML', { set() { forbidden('DIRECT_DOM_REPLACEMENT'); } });
  const context = vm.createContext({
    isTiptapMode: true, editor, centralSheetStripLargePayloadFastPathActive: false,
    centralSheetStripPendingStructuralInput: false, incrementalInputDomSyncScheduled: false,
    plainTextBuffer: 'unchanged', localEditGeneration: 7, localDirty: false, flowModeState: { active: false },
    deferredRenderIncludePagination: false, deferredRenderPreserveSelection: true,
    deferredRenderTimerId: null, deferredPaginationTimerId: null, lastFullRenderAtMs: 0,
    HOTPATH_RENDER_DEBOUNCE_MS: 32, HOTPATH_FULL_RENDER_MIN_INTERVAL_MS: 280,
    HOTPATH_PAGINATION_IDLE_DELAY_MS: 220, HOTPATH_PAGINATION_IDLE_TIMEOUT_MS: 1000,
    window: { requestAnimationFrame(callback) { frames.push(callback); },
      setTimeout(callback) { timers.push(callback); return timers.length; }, clearTimeout() {},
      requestIdleCallback(callback) { timers.push(callback); }, getSelection: () => null },
    Node: { TEXT_NODE: 3 }, nowMs: () => 1000,
    getTiptapPlainText() { reads.push('pm'); return 'Committed PM е\u0301 🧭'; },
    markCentralSheetLargePayloadFastPathDirty() { reads.push('fast-dirty'); },
    readCentralSheetLargePayloadFastPathText() { reads.push('fast'); return 'Working DOM е\u0301 🧭'; },
    invokeSaveLifecycleSignalBridge(command, payload) { signals.push({ command, ...payload }); },
    scheduleCentralSheetStripProofRefresh() { notifications.push('proof'); },
    scheduleCentralSheetStripPostStructuralRefresh() { notifications.push('structural'); },
    scheduleWordCountRefresh(text) { notifications.push(['words', text]); },
    recordWriterRuntimeBudget(...args) { notifications.push(args); },
    updateStatusText() {}, updateSaveStateText() {}, updatePerfHintText() {},
    updateInspectorSnapshot() {}, syncVisibleAuthoringSurfacesSurface() {}, scheduleAutoSave() {},
    notifyFormattingStateChange() { notifications.push('format'); },
    setPlainText() { forbidden('setPlainText'); }, renderStyledView() { forbidden('renderStyledView'); },
    paginateNodes() { forbidden('paginateNodes'); },
  });
  const functions = ['handleTiptapDocumentUpdate', 'syncPlainTextBufferFromEditorDom',
    'scheduleDeferredHotpathRender', 'scheduleDeferredPaginationRefresh',
    'scheduleIncrementalInputDomSync', 'normalizeActiveTextNodeWhitespace', 'markAsModified']
    .map(name => extractHotpathFunction(source, name)).join('\n');
  const script = new vm.Script(functions + '\n'
    + `if (isTiptapMode) {${branches.tiptap}} else {${branches.legacy}}\n`
    + 'const currentIpcSession = null; const options = { onDocumentUpdate: handleTiptapDocumentUpdate };\n'
    + 'function actualTransactionUpdate() {' + onUpdate + '}');
  script.runInContext(context);
  assert.equal(typeof events.input, 'function', 'real conditional registered its input listener');
  return { context, events, frames, timers, signals, reads, notifications,
    transactionUpdate: () => context.actualTransactionUpdate(), flush: () => frames.splice(0).forEach(callback => callback()) };
}

function assertTiptapInputRoutes(source) {
  const normal = tiptapInputHarness(source);
  normal.events.input();
  assert.equal(normal.context.localDirty, false, 'PM_DOM_INPUT_DUPLICATED_TRANSACTION');
  assert.equal(normal.context.localEditGeneration, 7, 'PM_DOM_INPUT_CHANGED_GENERATION');
  assert.deepEqual(normal.reads, [], 'PM_DOM_INPUT_READ_WORKING_STATE');
  normal.transactionUpdate();
  assert.equal(normal.context.plainTextBuffer, 'Committed PM е\u0301 🧭', 'TRANSACTION_TEXT_NOT_OBSERVED');
  assert.equal(normal.context.localEditGeneration, 8, 'TRANSACTION_GENERATION_NOT_OBSERVED');
  assert.equal(normal.context.localDirty, true, 'TRANSACTION_DIRTY_NOT_OBSERVED');
  assert.deepEqual(normal.reads, ['pm']);
  assert.deepEqual(normal.signals, [{ command: 'signal.localDirty.set', state: true, generation: 8 }]);
  assert.equal(normal.notifications.filter(value => value === 'format').length, 1);
  normal.events.input();
  assert.equal(normal.context.localEditGeneration, 8, 'PM_DOM_INPUT_DUPLICATED_TRANSACTION');
  assert.equal(normal.signals.length, 1);
  assert.equal(normal.timers.length, 0, 'TIPTAP_DEFERRED_LEGACY_RENDER_QUEUED');
  assert.equal(normal.frames.length, 1, 'incremental observer coalesced'); normal.flush();
  const fallback = tiptapInputHarness(source);
  fallback.context.centralSheetStripLargePayloadFastPathActive = true;
  fallback.events.input();
  assert.equal(fallback.context.plainTextBuffer, 'Working DOM е\u0301 🧭', 'FALLBACK_UPDATE_NOT_OBSERVED');
  assert.equal(fallback.context.localEditGeneration, 8, 'FALLBACK_GENERATION_NOT_OBSERVED');
  assert.equal(fallback.context.localDirty, true, 'FALLBACK_DIRTY_NOT_OBSERVED');
  assert.deepEqual(fallback.reads, ['fast-dirty', 'fast']);
  assert.deepEqual(fallback.signals, [{ command: 'signal.localDirty.set', state: true, generation: 8 }]);
  assert.equal(fallback.timers.length, 0, 'TIPTAP_DEFERRED_LEGACY_RENDER_QUEUED'); fallback.flush();
}

test('editor hot-path: actual Tiptap transaction and guarded fallback listeners update working state without direct rerender', () => {
  assertTiptapInputRoutes(readEditorSource());
});

test('editor hot-path: compiling guard update and full-render mutants fail the same semantic routing oracle', () => {
  const source = readEditorSource();
  const guardedCall = 'if (centralSheetStripLargePayloadFastPathActive) handleTiptapDocumentUpdate();';
  const observer = 'function handleTiptapDocumentUpdate() {';
  const variants = [
    ['removed-guard', guardedCall, 'handleTiptapDocumentUpdate();', 'PM_DOM_INPUT_DUPLICATED_TRANSACTION'],
    ['removed-update', guardedCall, 'if (centralSheetStripLargePayloadFastPathActive) {}', 'FALLBACK_UPDATE_NOT_OBSERVED'],
    ['direct-render', observer, observer + '\n  renderStyledView("forbidden");', 'DIRECT_FULL_RENDER'],
    ['direct-dom-replacement', observer, observer + '\n  editor.innerHTML = "forbidden";', 'DIRECT_DOM_REPLACEMENT'],
  ];
  for (const [name, before, after, reason] of variants) {
    assert.equal(source.split(before).length, 2, name + ' changes one actual site');
    const mutant = source.replace(before, after);
    tiptapInputHarness(mutant); // Compilation and registration must succeed first.
    assert.throws(() => assertTiptapInputRoutes(mutant), error => {
      assert.ok(!(error instanceof SyntaxError) && error.name !== 'ReferenceError', name);
      return (error.code === 'ERR_ASSERTION' || error.code === 'DIRECT_FULL_RENDER') && error.message.includes(reason);
    }, name + ' must fail its causal semantic assertion');
  }
});
