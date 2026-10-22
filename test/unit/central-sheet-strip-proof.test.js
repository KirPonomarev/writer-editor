const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  CENTRAL_SHEET_MAX_PAGE_COUNT_OVERFLOW_REASON,
  resolveCentralSheetStripProofDecision,
} = require('../../src/renderer/centralSheetStripProofDecision.js');

const ROOT = path.resolve(__dirname, '..', '..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('central sheet strip proof: bounded snapshot window keeps renderable central feed', () => {
  const activeLayoutPreviewSnapshot = {
    schemaVersion: 'renderer.layoutPreview.v1',
    pageMap: {
      schemaVersion: 'renderer.pageMap.v1',
      pages: Array.from({ length: 7 }, (_, index) => ({ pageNumber: index + 1 })),
      meta: { pageCount: 7 },
    },
  };

  assert.deepEqual(
    resolveCentralSheetStripProofDecision({
      activeLayoutPreviewSnapshot,
      naturalHeight: 0,
      contentHeightPx: 300,
      maxPageCount: 5,
    }),
    {
      pageCount: 7,
      visiblePageCount: 5,
      overflowReason: CENTRAL_SHEET_MAX_PAGE_COUNT_OVERFLOW_REASON,
      shouldRender: true,
    },
  );
});

test('central sheet strip proof: measured height prevents page-map undercount false-green', () => {
  const activeLayoutPreviewSnapshot = {
    schemaVersion: 'renderer.layoutPreview.v1',
    pageMap: {
      schemaVersion: 'renderer.pageMap.v1',
      pages: Array.from({ length: 2 }, (_, index) => ({ pageNumber: index + 1 })),
      meta: { pageCount: 2 },
    },
  };

  assert.deepEqual(
    resolveCentralSheetStripProofDecision({
      activeLayoutPreviewSnapshot,
      naturalHeight: 1200,
      contentHeightPx: 300,
      maxPageCount: 5,
    }),
    {
      pageCount: 4,
      visiblePageCount: 4,
      overflowReason: '',
      shouldRender: true,
    },
  );
});


test('central sheet strip proof: source remains renderer-only and bounded', () => {
  const editorText = readFile('src/renderer/editor.js');
  const cssText = readFile('src/renderer/styles.css');

  assert.equal((editorText.match(/initTiptap\(/g) || []).length, 1);
  assert.ok(editorText.includes('const CENTRAL_SHEET_RUNTIME_WINDOW_DOM_BUDGET = 15;'));
  assert.ok(editorText.includes("editor.dataset.centralSheetFlow = 'vertical';"));
  assert.equal(editorText.includes("editor.dataset.centralSheetFlow = 'horizontal';"), false);
  assert.ok(editorText.includes('renderedPageCount'));
  assert.ok(editorText.includes('centralSheetTotalPageCount'));
  assert.ok(editorText.includes('centralSheetSourcePageCount'));
  assert.ok(editorText.includes('centralSheetDecisionPageCount'));
  assert.ok(editorText.includes('centralSheetStructuralRuntimePageCount'));
  assert.ok(editorText.includes('centralSheetBoundedOverflowReason'));
  assert.ok(editorText.includes('centralSheetBoundedOverflowSourcePageCount'));
  assert.ok(editorText.includes('centralSheetBoundedOverflowRuntimePageCount'));
  assert.ok(editorText.includes('centralSheetBoundedOverflowVisiblePageCount'));
  assert.ok(editorText.includes('centralSheetBoundedOverflowHiddenPageCount'));
  assert.ok(editorText.includes('--central-sheet-strip-height-px'));
  assert.ok(editorText.includes('--central-sheet-page-stride-px'));
  assert.ok(editorText.includes('--central-sheet-editor-height-px'));
  assert.ok(editorText.includes('const CENTRAL_SHEET_TEXT_MASK_BLEED_PX = 2;'));
  assert.ok(editorText.includes('const CENTRAL_SHEET_LARGE_PAYLOAD_ESTIMATED_CHARS_PER_PAGE = 520;'));
  assert.equal(editorText.includes('CENTRAL_SHEET_LARGE_PAYLOAD_ESTIMATED_CHARS_PER_PAGE = 246;'), false);
  assert.ok(editorText.includes("editor.style.setProperty('--central-sheet-mask-bleed-px'"));
  assert.ok(editorText.includes("editor.style.removeProperty('--central-sheet-mask-bleed-px');"));
  assert.ok(editorText.includes('const sourcePageCount = Math.max(1, decisionPageCount);'));
  assert.ok(editorText.includes('const runtimePageCount = Math.max(1, structuralMinimumPageCount);'));
  assert.ok(editorText.includes('const scrollPageCount = runtimePageCount;'));
  assert.ok(editorText.includes('sourcePageCount,'));
  assert.ok(editorText.includes('pageCount: runtimePageCount,'));
  assert.ok(editorText.includes("editor.dataset.centralSheetSourcePageCount = String(sourcePageCount || pageCount);"));
  assert.ok(editorText.includes("editor.dataset.centralSheetStructuralRuntimePageCount = String(structuralMinimumPageCount || pageCount);"));
  assert.ok(editorText.includes('scheduleCentralSheetStripProofRefresh({ scrollOnly: true });'));
  assert.ok(editorText.includes('return applyEstimatedCentralSheetStripRuntimeStateFromText(readCentralSheetLargePayloadFastPathText());'));
  assert.ok(editorText.includes('forceFull !== true'));
  assert.equal(editorText.includes('const sourcePageCount = Math.max(decisionPageCount, structuralMinimumPageCount);'), false);
  assert.equal(editorText.includes('pageCount: sourcePageCount,'), false);
  assert.equal(editorText.includes('editor.dataset.centralSheetBoundedOverflowSourcePageCount = String(pageCount);'), false);
  assert.ok(editorText.includes('buildVirtualViewportWindowMathContract'));
  assert.match(
    editorText,
    /clearCentralSheetStripProof\(\{ overflowReason: runtimeState\.overflowReason \}\);/,
  );
  assert.equal(editorText.includes("from '../derived/pageMapService.mjs'"), false);
  assert.equal(editorText.includes("from '../derived/layoutInvalidation.mjs'"), false);
  assert.equal(editorText.includes("from './layoutPreview.mjs'"), true);

  assert.ok(cssText.includes('#editor.tiptap-host.tiptap-host--central-sheet-strip-proof > .tiptap-page-wrap'));
  assert.ok(cssText.includes('.tiptap-sheet-strip > .tiptap-page-wrap'));
  assert.ok(cssText.includes('.tiptap-sheet-strip > .tiptap-sheet-strip__spacer'));
  assert.ok(cssText.includes('flex-direction: column;'));
  assert.ok(cssText.includes('overflow-anchor: none;'));
  assert.ok(cssText.includes('shape-outside: repeating-linear-gradient('));
  assert.ok(cssText.includes('calc(var(--central-sheet-line-top-guard-px) - var(--central-sheet-mask-bleed-px, 2px))'));
  assert.ok(cssText.includes('calc(var(--central-sheet-content-height-px) - var(--central-sheet-line-guard-px) + var(--central-sheet-mask-bleed-px, 2px))'));
  assert.ok(cssText.includes('.tiptap-sheet-strip > .tiptap-page-wrap + .tiptap-page-wrap'));
  assert.ok(cssText.includes('margin-top: var(--page-gap-px);'));
  assert.ok(cssText.includes('.tiptap-sheet-derived-text'));
  assert.ok(cssText.includes('--central-sheet-derived-text-top-guard-px'));
  assert.ok(cssText.includes('data-central-sheet-large-payload-fast-path-active="true"'));
  assert.ok(cssText.includes('contain: strict;'));
  assert.ok(cssText.includes('mask-image: none;'));
  assert.ok(cssText.includes('shape-outside: none;'));
  assert.equal(cssText.includes('column-width: var(--central-sheet-content-width-px);'), false);
  assert.equal(cssText.includes('column-gap: calc(var(--page-gap-px) + var(--page-margin-left-px) + var(--page-margin-right-px));'), false);
  assert.equal(cssText.includes('column-fill: auto;'), false);
  assert.ok(cssText.includes('pointer-events: auto;'));
});

// Execute the maintained presentation functions, with only DOM/derived-metrics
// ports supplied here. This does not simulate browser layout or native input.
const vm = require('node:vm');
function createExtentRuntime({ bottom = 272501, clipBottom = 261277, media = '' } = {}) {
  const source = readFile('src/renderer/editor.js');
  const state = { geometryReads: 0, builds: 0, renders: 0, frames: new Map(), nextFrame: 1 };
  class Element {
    constructor(rect = { top: 0, bottom: 0 }) {
      this.rect = rect;
      this.dataset = {};
      const props = new Map();
      this.style = { setProperty: (key, value) => props.set(key, value),
        removeProperty: (key) => props.delete(key), getPropertyValue: (key) => props.get(key) || '' };
      this.classes = new Set();
      this.classList = { add: (key) => this.classes.add(key), remove: (key) => this.classes.delete(key),
        contains: (key) => this.classes.has(key) };
    }
    getBoundingClientRect() { state.geometryReads += 1; return this.rect; }
    querySelector() { return null; }
    closest() { return outer; }
  }
  const outer = new Element();
  const host = new Element();
  const clip = new Element({ top: 0, bottom: clipBottom });
  const prose = new Element({ top: 0, bottom });
  let currentProse = prose;
  const last = new Element({ top: bottom - 19, bottom });
  prose.lastElementChild = last;
  prose.querySelector = (selector) => selector === media ? last : null;
  host.querySelector = (selector) => selector === '.ProseMirror' ? currentProse : selector === '.tiptap-editor' ? clip : null;
  const protectedState = { text: 'unchanged canonical text 🧭', selection: { from: 4, to: 9 },
    undo: ['original undo frame'], dirty: true, generation: 17 };
  const protectedBefore = JSON.stringify(protectedState);
  Object.defineProperty(host, 'innerHTML', { get: () => 'original canonical editor node',
    set: () => assert.fail('Presentation replaced the canonical editor node') });
  for (const element of [host, prose]) {
    for (const method of ['replaceChildren', 'replaceWith', 'removeChild']) {
      element[method] = () => assert.fail('Presentation replaced the canonical editor node');
    }
  }
  for (const key of ['innerHTML', 'textContent']) {
    Object.defineProperty(prose, key, { get: () => protectedState.text,
      set: () => assert.fail('Presentation rewrote the canonical editable payload') });
  }
  const runtimeState = { metrics: { pageHeightPx: 446, pageWidthPx: 322, marginTopPx: 36, marginBottomPx: 36 },
    contentWidthPx: 226, contentHeightPx: 374, pageGapPx: 7, lineGuardPx: 56,
    decisionPageCount: 406, sourcePageCount: 406, structuralMinimumPageCount: 577,
    pageCount: 577, scrollPageCount: 577, shouldRender: true, overflowReason: 'max-page-count' };
  const forbiddenWrite = () => assert.fail('Presentation invoked an authoring writer');
  const context = {
    HTMLElement: Element, editor: host, isTiptapMode: true, currentProjectId: 'project-a', currentDocumentId: 'scene-a',
    activeBookProfileState: Object.freeze({ formatId: 'test' }), editorZoom: 1,
    centralSheetStripContinuousFallbackIdentity: null, centralSheetStripLayoutGeneration: 0,
    centralSheetStripRefreshFrameId: null, centralSheetStripRefreshMode: 'full',
    centralSheetStripCachedRuntimeState: null, centralSheetStripCacheDirty: false,
    centralSheetStripLastScrollTop: 0, centralSheetStripLastAppliedSignature: '',
    centralSheetStripPendingStructuralInput: false, centralSheetStripStructuralGuardActive: false,
    centralSheetStripStructuralSettleFrameId: null, centralSheetStripStructuralSettleSignature: '',
    centralSheetStripStructuralStablePassCount: 0, centralSheetStripLargePayloadFastPathActive: false,
    centralSheetStripScrollContainer: outer, CENTRAL_SHEET_TEXT_MASK_BLEED_PX: 2,
    CENTRAL_SHEET_STRIP_PROOF_CLASS: 'tiptap-host--central-sheet-strip-proof',
    CENTRAL_SHEET_STRIP_MEASURING_CLASS: 'tiptap-host--central-sheet-strip-measuring',
    document: { documentElement: new Element() },
    window: { requestAnimationFrame: (callback) => { const id = state.nextFrame++; state.frames.set(id, callback); return id; },
      cancelAnimationFrame: (id) => state.frames.delete(id) },
    ...require('../../src/renderer/centralSheetStripProofDecision.js'),
    buildCentralSheetStripRuntimeState: () => { state.builds += 1; return runtimeState; },
    resolveCentralSheetViewportRuntimeWindow: () => ({ windowingEnabled: true, renderedPageCount: 15,
      totalVirtualHeight: 261349, totalPageCount: 577, firstRenderedPage: 563, lastRenderedPage: 577,
      visiblePageCount: 2, scrollTop: 260621 }),
    renderCentralSheetStripShellPages: () => { state.renders += 1; },
    syncDerivedPageMapRuntimeBridgeDataset: () => {}, buildDerivedPageMapRuntimeBridge: () => ({}),
    clearDerivedPageMapRuntimeBridgeDataset: () => {}, syncCentralSheetStripOverflowMetadata: () => {},
    bindCentralSheetStripScrollRefresh: () => {},
    setPlainText: forbiddenWrite, setSelectionRange: forbiddenWrite, markAsModified: forbiddenWrite,
    setTiptapDocumentSnapshot: forbiddenWrite, localDirty: true, localEditGeneration: 17,
  };
  const names = ['resetCentralSheetStripStructuralSettleState', 'beginCentralSheetStripStructuralTransition',
    'finishCentralSheetStripStructuralTransition', 'clearCentralSheetStripProof',
    'readCentralSheetStripPresentationIdentity', 'isCentralSheetStripContinuousFallbackCurrent',
    'resetCentralSheetStripContinuousFallback', 'validateCentralSheetStripEditableExtent',
    'resetCentralSheetStripForIncomingPayload', 'applyPageGeometryCssVars',
    'applyCentralSheetStripRuntimeState', 'syncCentralSheetStripWindowFromCachedRuntimeState',
    'refreshCentralSheetStripProof', 'scheduleCentralSheetStripProofRefreshOnScroll',
    'scheduleCentralSheetStripProofRefresh', 'scheduleCentralSheetStripPostStructuralRefresh'];
  const functions = names.map((name) => {
    const start = source.indexOf(`function ${name}(`);
    if (start < 0) return ''; // The pre-correction runtime must fail the behavioral assertion.
    const end = source.indexOf('\nfunction ', start + 1);
    return source.slice(start, end < 0 ? undefined : end);
  }).join('\n');
  vm.createContext(context);
  vm.runInContext(functions, context);
  return { context, state, host, clip, prose, last, runtimeState,
    replaceProse: () => { currentProse = new Element(prose.rect); currentProse.lastElementChild = last; },
    run: (expression) => vm.runInContext(expression, context),
    flush: () => { const callbacks = [...state.frames.values()]; state.frames.clear(); callbacks.forEach((callback) => callback()); },
    preserved: () => { assert.equal(JSON.stringify(protectedState), protectedBefore);
      assert.equal(prose.textContent, protectedState.text); assert.equal(prose.innerHTML, protectedState.text);
      assert.equal(context.localDirty, true); assert.equal(context.localEditGeneration, 17); } };
}

test('central sheet runtime rejects actual clipped extent without altering canonical authoring state', () => {
  const h = createExtentRuntime();
  assert.equal(h.run('refreshCentralSheetStripProof()'), false);
  assert.equal(h.host.dataset.centralSheetOverflowReason, 'editable-extent-continuous');
  assert.equal(h.host.classList.contains('tiptap-host--central-sheet-strip-proof'), false);
  assert.equal(h.host.querySelector('.ProseMirror'), h.prose);
  h.preserved();
});

test('central sheet runtime latch avoids remeasurement across input scroll and structural Undo notifications', () => {
  const h = createExtentRuntime();
  h.run('refreshCentralSheetStripProof()');
  const initial = { reads: h.state.geometryReads, builds: h.state.builds, renders: h.state.renders };
  for (let i = 0; i < 10; i += 1) {
    h.run('scheduleCentralSheetStripProofRefresh(); scheduleCentralSheetStripProofRefreshOnScroll();');
    h.run('beginCentralSheetStripStructuralTransition(); scheduleCentralSheetStripProofRefresh(); scheduleCentralSheetStripPostStructuralRefresh();');
    h.flush();
  }
  assert.deepEqual({ reads: h.state.geometryReads, builds: h.state.builds, renders: h.state.renders }, initial);
  assert.equal(h.state.frames.size, 0);
  assert.equal(h.context.centralSheetStripStructuralGuardActive, false);
  assert.equal(h.host.dataset.centralSheetOverflowReason, 'editable-extent-continuous');
  h.preserved();
});

test('central sheet runtime keeps fitting pagination and rechecks after incoming document or project replacement', () => {
  const h = createExtentRuntime();
  h.run('refreshCentralSheetStripProof()');
  for (const identity of [['project-a', 'scene-b'], ['project-b', 'scene-b']]) {
    h.context.currentProjectId = identity[0]; h.context.currentDocumentId = identity[1];
    h.run('resetCentralSheetStripForIncomingPayload()');
    h.prose.rect.bottom = 261277; h.last.rect.bottom = 261277;
    assert.equal(h.run('refreshCentralSheetStripProof()'), true);
    assert.equal(h.host.classList.contains('tiptap-host--central-sheet-strip-proof'), true);
    assert.equal(h.host.dataset.centralSheetOverflowReason, undefined);
  }
  assert.equal(h.state.builds, 3);
  h.preserved();
});

test('central sheet runtime invalidates its latch for actual layout tokens zoom typography or editor identity', () => {
  for (const change of [
    (h) => { h.context.editorZoom = 1.25; },
    (h) => { h.context.activeBookProfileState = { formatId: 'other' }; },
    (h) => { h.host.style.fontSize = '24px'; },
    (h) => { h.context.document.documentElement.style.setProperty('--page-gap-px', '32px'); },
    (h) => { h.run('resetCentralSheetStripContinuousFallback()'); },
    (h) => { h.context.currentDocumentId = 'different-without-reusing-old-element'; },
    (h) => { h.context.currentProjectId = 'other-project-with-same-scene-id'; },
    (h) => { h.replaceProse(); },
  ]) {
    const h = createExtentRuntime(); h.run('refreshCentralSheetStripProof()');
    change(h); h.last.rect.bottom = 261277;
    assert.equal(h.run('refreshCentralSheetStripProof()'), true);
    assert.equal(h.state.builds, 2);
    h.preserved();
  }
});

test('central sheet runtime same-ID publication and explicit page geometry reset release only the old latch', () => {
  for (const reset of ['resetCentralSheetStripForIncomingPayload()', 'applyPageGeometryCssVars({ pageWidthPx: 322, pageHeightPx: 446, marginTopPx: 36, marginBottomPx: 36, marginLeftPx: 48, marginRightPx: 48 })']) {
    const h = createExtentRuntime(); h.run('refreshCentralSheetStripProof()');
    h.run(reset); h.last.rect.bottom = 200;
    assert.equal(h.run('refreshCentralSheetStripProof()'), true);
    assert.equal(h.state.builds, 2); h.preserved();
  }
});

test('central sheet runtime no-op geometry application retains the current fallback without retry', () => {
  const h = createExtentRuntime();
  const apply = 'applyPageGeometryCssVars({ pageWidthPx: 322, pageHeightPx: 446, marginTopPx: 36, marginBottomPx: 36, marginLeftPx: 48, marginRightPx: 48 })';
  h.run(apply); h.run('refreshCentralSheetStripProof()');
  const reads = h.state.geometryReads;
  const generation = h.context.centralSheetStripLayoutGeneration;
  h.run(apply); h.run('scheduleCentralSheetStripProofRefresh(); scheduleCentralSheetStripProofRefreshOnScroll()');
  h.flush();
  assert.equal(h.context.centralSheetStripLayoutGeneration, generation);
  assert.equal(h.state.builds, 1); assert.equal(h.state.geometryReads, reads); h.preserved();
});

test('central sheet runtime discards cancelled old-layout callbacks before touching a replacement scene', () => {
  for (const scheduling of ['scheduleCentralSheetStripProofRefresh()',
    'beginCentralSheetStripStructuralTransition(); scheduleCentralSheetStripPostStructuralRefresh()']) {
    const h = createExtentRuntime(); h.run(scheduling);
    const staleCallback = [...h.state.frames.values()][0];
    assert.equal(typeof staleCallback, 'function');
    h.context.currentDocumentId = 'replacement-scene';
    h.run('resetCentralSheetStripForIncomingPayload(); scheduleCentralSheetStripProofRefresh()');
    h.last.rect.bottom = 200;
    const currentFrame = h.context.centralSheetStripRefreshFrameId;
    staleCallback();
    assert.equal(h.state.builds, 0);
    assert.equal(h.context.centralSheetStripRefreshFrameId, currentFrame);
    assert.equal(h.state.frames.size, 1);
    h.flush();
    assert.equal(h.state.builds, 1);
    assert.equal(h.host.dataset.centralSheetOverflowReason, undefined); h.preserved();
  }
});

test('central sheet runtime refuses unavailable terminal geometry without a false paginated result', () => {
  for (const invalid of [undefined, NaN, Infinity, -1]) {
    const h = createExtentRuntime(); h.last.rect.bottom = invalid;
    assert.equal(h.run('refreshCentralSheetStripProof()'), false);
    assert.equal(h.host.dataset.centralSheetOverflowReason, 'editable-extent-continuous');
    assert.equal(h.host.classList.contains('tiptap-host--central-sheet-strip-proof'), false); h.preserved();
  }
});

test('central sheet runtime preserves table and media fallback and the separate large payload presentation', () => {
  for (const [media, reason] of [['table', 'table-layout-continuous'], ['img', 'media-layout-continuous']]) {
    const h = createExtentRuntime({ media });
    assert.equal(h.run('refreshCentralSheetStripProof()'), false);
    assert.equal(h.host.dataset.centralSheetOverflowReason, reason);
    assert.equal(h.state.builds, 0); h.preserved();
  }
  const h = createExtentRuntime();
  h.context.centralSheetStripLargePayloadFastPathActive = true;
  assert.equal(h.run('applyCentralSheetStripRuntimeState(buildCentralSheetStripRuntimeState())'), true);
  assert.equal(h.state.geometryReads, 0); h.preserved();
});

test('central sheet continuous geometry fallback exposes autoheight wrappers without replacing the editable model', () => {
  const styles = readFile('src/renderer/styles.css');
  const selector = '.main-content--editor #editor.tiptap-host[data-central-sheet-overflow-reason="editable-extent-continuous"] .tiptap-page__content';
  const start = styles.indexOf(selector);
  assert.notEqual(start, -1);
  const rule = styles.slice(styles.indexOf('{', start) + 1, styles.indexOf('}', start));
  assert.match(rule, /height:\s*auto;/);
  assert.match(rule, /overflow:\s*visible;/);
  assert.doesNotMatch(rule, /clip|hidden|mask|contain|transform/);
});
