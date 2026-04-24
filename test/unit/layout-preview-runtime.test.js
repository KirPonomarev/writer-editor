const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

function collectKeys(value, output = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, output);
    }
    return output;
  }
  if (!value || typeof value !== 'object') {
    return output;
  }
  for (const key of Object.keys(value)) {
    output.add(key);
    collectKeys(value[key], output);
  }
  return output;
}

function createPreviewInput(overrides = {}) {
  return {
    text: [
      'Chapter One',
      '',
      'Alpha beta gamma delta epsilon',
      '[[PAGE_BREAK]]',
      'Chapter Two',
      '',
      'Omega omega omega omega omega',
    ].join('\n'),
    profile: {
      formatId: 'A4',
      chapterStartRule: 'next-page',
      allowExplicitPageBreaks: true,
    },
    metrics: {
      pageWidthMm: 210,
      pageHeightMm: 297,
      pageWidthPx: 1197,
      pageHeightPx: 1693,
      contentWidthPx: 907,
      contentHeightPx: 1403,
    },
    selectionRange: { start: 0, end: 12 },
    sourceId: 'runtime-preview-test',
    ...overrides,
  };
}

function normalizePageMapBoundaries(pageMap) {
  return {
    pages: pageMap.pages.map((page) => ({
      pageNumber: page.pageNumber,
      nodeIds: page.nodeIds,
      overflow: Boolean(page.overflow),
    })),
    pageBreaks: pageMap.pageBreaks.map((item) => ({
      nodeId: item.nodeId,
      beforePageNumber: item.beforePageNumber,
      reason: item.reason,
    })),
    meta: {
      pageCount: pageMap.meta.pageCount,
      pageBreakCount: pageMap.meta.pageBreakCount,
      overflowCount: pageMap.meta.overflowCount,
    },
  };
}

function collectElementsByClass(root, className, output = []) {
  if (!root || typeof root !== 'object') return output;
  const classes = typeof root.className === 'string' ? root.className.split(/\s+/u) : [];
  if (classes.includes(className)) output.push(root);
  const children = Array.isArray(root.children) ? root.children : [];
  for (const child of children) {
    collectElementsByClass(child, className, output);
  }
  return output;
}

test('layout preview runtime: snapshot is derived, deterministic, and storage-clean', async () => {
  const mod = await loadModule('src/renderer/layoutPreview.mjs');

  const state = mod.createLayoutPreviewState();
  assert.equal(state.enabled, false);
  assert.equal(state.frameMode, true);

  const snapshotA = mod.buildLayoutPreviewSnapshot(createPreviewInput());
  const snapshotB = mod.buildLayoutPreviewSnapshot(createPreviewInput());

  assert.equal(snapshotA.schemaVersion, 'renderer.layoutPreview.v1');
  assert.equal(snapshotA.profile.formatId, 'A4');
  assert.equal(snapshotA.pageMap.pages.length >= 2, true);
  assert.equal(snapshotA.pageMap.pageBreaks.length >= 1, true);
  assert.equal(typeof snapshotA.flow.meta.flowHash, 'string');
  assert.equal(typeof snapshotA.invalidation.invalidationKey, 'string');
  assert.equal(snapshotA.invalidation.invalidationKey, snapshotB.invalidation.invalidationKey);
  assert.equal(snapshotA.anchorMap.anchors.length, snapshotA.flow.nodes.length);

  const keySet = collectKeys(snapshotA);
  const forbiddenCanonicalKeys = [
    'projectManifest',
    'assets',
    'backups',
    'atomicWrite',
    'recovery',
    'storage',
    'doc',
  ];
  for (const forbiddenKey of forbiddenCanonicalKeys) {
    assert.equal(keySet.has(forbiddenKey), false, `snapshot leaked canonical key ${forbiddenKey}`);
  }
});

test('layout preview runtime: pageMapService and preview pagination match for one landscape fixture', async () => {
  const layoutPreview = await loadModule('src/renderer/layoutPreview.mjs');
  const semanticMapping = await loadModule('src/derived/semanticMapping.mjs');
  const styleMapMod = await loadModule('src/derived/styleMap.mjs');
  const flowMod = await loadModule('src/derived/normalizedLayoutFlow.mjs');
  const measureMod = await loadModule('src/derived/layoutMeasureProvider.mjs');
  const pageMapMod = await loadModule('src/derived/pageMapService.mjs');

  const fixture = {
    text: [
      'Landscape proof intro alpha beta gamma',
      '',
      'Body paragraph before explicit page break',
      semanticMapping.PAGE_BREAK_TOKEN_V1,
      'Body paragraph after explicit page break',
      'Tail paragraph on second landscape page',
    ].join('\n'),
    profile: {
      formatId: 'A4',
      orientation: 'landscape',
      chapterStartRule: 'next-page',
      allowExplicitPageBreaks: true,
    },
    metrics: {
      pageWidthMm: 297,
      pageHeightMm: 210,
      pageWidthPx: 1693,
      pageHeightPx: 1197,
      contentWidthPx: 1403,
      contentHeightPx: 907,
    },
    selectionRange: { start: 0, end: 12 },
    sourceId: '05be-landscape-pair-proof',
  };

  assert.equal(fixture.metrics.pageWidthPx > fixture.metrics.pageHeightPx, true);
  assert.equal(fixture.metrics.pageWidthMm > fixture.metrics.pageHeightMm, true);
  assert.equal(fixture.text.includes(semanticMapping.PAGE_BREAK_TOKEN_V1), true);

  const previewSnapshot = layoutPreview.buildLayoutPreviewSnapshot(fixture);
  const styleMap = styleMapMod.createStyleMap();
  const semanticMap = semanticMapping.mapSemanticEntries({
    sourceId: fixture.sourceId,
    text: fixture.text,
  });
  const flow = flowMod.buildNormalizedLayoutFlow({
    semanticMap,
    styleMap,
    rules: {
      pageBreakToken: semanticMapping.PAGE_BREAK_TOKEN_V1,
      chapterStartRule: fixture.profile.chapterStartRule,
    },
  });
  const profile = {
    pageWidth: fixture.metrics.pageWidthMm,
    pageHeight: fixture.metrics.pageHeightMm,
    bodyWidth: Math.max(40, Math.round(fixture.metrics.contentWidthPx / 11)),
    bodyHeight: Math.max(20, Math.round(fixture.metrics.contentHeightPx / 28)),
  };
  const measureProvider = measureMod.createLayoutMeasureProvider({
    bodyWidth: profile.bodyWidth,
    bodyHeight: profile.bodyHeight,
    charWidth: 1,
    lineHeight: 1,
    lineGap: 0,
  });
  const servicePageMap = pageMapMod.paginateLayoutFlow({
    flow,
    profile,
    styleMap,
    measureProvider,
    rules: {
      chapterStartRule: fixture.profile.chapterStartRule,
    },
  });

  const previewBoundaries = normalizePageMapBoundaries(previewSnapshot.pageMap);
  const serviceBoundaries = normalizePageMapBoundaries(servicePageMap);
  assert.deepEqual(previewBoundaries, serviceBoundaries);
  assert.equal(previewBoundaries.meta.pageCount, 2);
  assert.deepEqual(
    previewBoundaries.pageBreaks,
    [{
      nodeId: 'semantic:05be-landscape-pair-proof:0002:pageBreak',
      beforePageNumber: 2,
      reason: 'explicit',
    }],
  );
});

test('layout preview runtime: invalidation cache hits stable inputs and evicts stale entries', async () => {
  const mod = await loadModule('src/renderer/layoutPreview.mjs');
  const cache = mod.createLayoutPreviewSnapshotCache({ maxEntries: 2 });

  const first = mod.buildCachedLayoutPreviewSnapshot(createPreviewInput(), cache);
  const second = mod.buildCachedLayoutPreviewSnapshot(createPreviewInput(), cache);
  assert.equal(second, first);
  assert.equal(cache.size, 1);

  const changedText = mod.buildCachedLayoutPreviewSnapshot(createPreviewInput({ text: 'Changed text' }), cache);
  assert.notEqual(changedText, first);
  assert.equal(cache.size, 2);

  const changedSource = mod.buildCachedLayoutPreviewSnapshot(createPreviewInput({ sourceId: 'other-source' }), cache);
  assert.notEqual(changedSource, first);
  assert.equal(cache.size, 2);

  const afterEviction = mod.buildCachedLayoutPreviewSnapshot(createPreviewInput(), cache);
  assert.notEqual(afterEviction, first);
  assert.equal(cache.size, 2);
});

test('layout preview runtime: render path windows visible pages without changing page map truth', async () => {
  const mod = await loadModule('src/renderer/layoutPreview.mjs');
  const previousHTMLElement = global.HTMLElement;
  const previousDocument = global.document;

  class FakeClassList {
    constructor() {
      this.tokens = new Set();
    }

    toggle(token, force) {
      if (force) this.tokens.add(token);
      else this.tokens.delete(token);
    }
  }

  class FakeElement {
    constructor(tagName) {
      this.tagName = String(tagName || '').toUpperCase();
      this.children = [];
      this.dataset = {};
      this.attributes = {};
      this.className = '';
      this.classList = new FakeClassList();
      this.style = {};
      this.textContent = '';
    }

    append(...children) {
      for (const child of children) this.appendChild(child);
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }

    replaceChildren(...children) {
      this.children = children;
    }

    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }
  }

  global.HTMLElement = FakeElement;
  global.document = {
    createElement(tagName) {
      return new FakeElement(tagName);
    },
  };

  try {
    const host = new FakeElement('div');
    const snapshot = {
      profile: { formatId: 'A4' },
      flow: {
        nodes: Array.from({ length: 5 }, (_, index) => ({
          id: `node-${index + 1}`,
          semanticKind: 'paragraph',
          text: `Node ${index + 1}`,
        })),
      },
      pageMap: {
        pages: Array.from({ length: 5 }, (_, index) => ({
          pageNumber: index + 1,
          nodeIds: [`node-${index + 1}`],
        })),
        meta: { pageCount: 5 },
      },
      metrics: {
        pageWidthPx: 1200,
        pageHeightPx: 800,
      },
    };

    mod.renderLayoutPreviewSnapshot(
      host,
      snapshot,
      mod.createLayoutPreviewState({ enabled: true, pageWindowStart: 2, pageWindowSize: 2 }),
    );

    const pageWraps = collectElementsByClass(host, 'layout-preview__page-wrap');
    assert.deepEqual(pageWraps.map((item) => item.dataset.pageNumber), ['2', '3']);
    assert.equal(snapshot.pageMap.pages.length, 5);

    const previewPages = collectElementsByClass(host, 'layout-preview__page');
    assert.equal(previewPages.length, 2);
    assert.deepEqual(
      previewPages.map((item) => ({
        width: item.dataset.pageWidthPx,
        height: item.dataset.pageHeightPx,
        orientation: item.dataset.pageOrientation,
        aspectRatio: item.style.aspectRatio,
        widthStyle: item.style.width,
      })),
      [
        {
          width: '1200',
          height: '800',
          orientation: 'landscape',
          aspectRatio: '1200 / 800',
          widthStyle: '100%',
        },
        {
          width: '1200',
          height: '800',
          orientation: 'landscape',
          aspectRatio: '1200 / 800',
          widthStyle: '100%',
        },
      ],
    );

    const windowMeta = collectElementsByClass(host, 'layout-preview__window-meta');
    assert.equal(windowMeta.length, 1);
    assert.equal(windowMeta[0].textContent, 'Showing pages 2-3 of 5');

    const pagesHost = collectElementsByClass(host, 'layout-preview__pages')[0];
    assert.equal(pagesHost.dataset.pageWindowStart, '2');
    assert.equal(pagesHost.dataset.pageWindowEnd, '3');
    assert.equal(pagesHost.dataset.pageCount, '5');
  } finally {
    global.HTMLElement = previousHTMLElement;
    global.document = previousDocument;
  }
});

test('layout preview runtime: editor-derived text marker is visible in rendered preview lines', async () => {
  const mod = await loadModule('src/renderer/layoutPreview.mjs');
  const previousHTMLElement = global.HTMLElement;
  const previousDocument = global.document;

  class FakeClassList {
    constructor() {
      this.tokens = new Set();
    }

    toggle(token, force) {
      if (force) this.tokens.add(token);
      else this.tokens.delete(token);
    }
  }

  class FakeElement {
    constructor(tagName) {
      this.tagName = String(tagName || '').toUpperCase();
      this.children = [];
      this.dataset = {};
      this.attributes = {};
      this.className = '';
      this.classList = new FakeClassList();
      this.style = {};
      this.textContent = '';
    }

    append(...children) {
      for (const child of children) this.appendChild(child);
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }

    replaceChildren(...children) {
      this.children = children;
    }

    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }
  }

  global.HTMLElement = FakeElement;
  global.document = {
    createElement(tagName) {
      return new FakeElement(tagName);
    },
  };

  try {
    const marker = 'k04OPreviewVisibleMarker';
    const input = createPreviewInput({
      text: [
        'Chapter One',
        '',
        `Horizontal sheet preview text ${marker}`,
        'Plain surrounding text',
      ].join('\n'),
      sourceId: 'horizontal-sheet-preview-text-visibility-parity',
    });
    const countMarker = (value) => String(value || '').split(marker).length - 1;

    assert.equal(countMarker(input.text), 1);

    const snapshot = mod.buildLayoutPreviewSnapshot(input);
    const snapshotMarkerCount = snapshot.flow.nodes.reduce(
      (count, node) => count + countMarker(node.text),
      0,
    );
    assert.equal(snapshotMarkerCount, 1);

    const host = new FakeElement('div');
    mod.renderLayoutPreviewSnapshot(
      host,
      snapshot,
      mod.createLayoutPreviewState({ enabled: true, pageWindowStart: 1, pageWindowSize: 10 }),
    );

    const lines = collectElementsByClass(host, 'layout-preview__line');
    const renderedMarkerCount = lines.reduce(
      (count, line) => count + countMarker(line.textContent),
      0,
    );
    assert.equal(renderedMarkerCount, 1);
  } finally {
    global.HTMLElement = previousHTMLElement;
    global.document = previousDocument;
  }
});

test('layout preview runtime: module has no storage or editable-page side effects', () => {
  const source = read('src/renderer/layoutPreview.mjs');
  const forbiddenTokens = [
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'writeFileAtomic',
    'electronAPI',
    'ipcRenderer',
    'contenteditable',
    'contentEditable',
    'document.execCommand',
  ];
  for (const token of forbiddenTokens) {
    assert.equal(source.includes(token), false, `layoutPreview leaked forbidden token ${token}`);
  }
});
