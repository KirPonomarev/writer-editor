const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(relativePath) {
  const fileUrl = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(fileUrl);
}

async function paginate(nodes, rules = {}) {
  const pageMapMod = await loadModule('src/derived/pageMapService.mjs');
  return pageMapMod.paginateLayoutFlow({
    flow: { nodes },
    profile: {
      pageWidth: 210,
      pageHeight: 297,
      bodyWidth: 120,
      bodyHeight: 100,
    },
    measurements: nodes
      .filter((node) => !node.isPageBreak && node.semanticKind !== 'pageBreak')
      .map((node) => ({ nodeId: node.id, height: 1 })),
    rules,
  });
}

function pageNumberForNode(pageMap, nodeId) {
  const page = pageMap.pages.find((item) => item.nodeIds.includes(nodeId));
  return page?.pageNumber;
}

function createContractInput(overrides = {}) {
  return {
    textProvider: () => [
      'Chapter One',
      '',
      'Alpha beta gamma delta epsilon',
      '[[PAGE_BREAK]]',
      'Chapter Two',
      '',
      'Omega omega omega omega omega',
    ].join('\n'),
    bindingSource: 'currentTiptapPlainText',
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
    sourceId: 'runtime-contract-test',
    ...overrides,
  };
}

function collectKeys(value, output = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, output);
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  for (const key of Object.keys(value)) {
    output.add(key);
    collectKeys(value[key], output);
  }
  return output;
}

test('page map preserves derived numbering for consecutive explicit page breaks', async () => {
  const pageMap = await paginate([
    { id: 'break-1', semanticKind: 'pageBreak', isPageBreak: true },
    { id: 'break-2', semanticKind: 'pageBreak', isPageBreak: true },
    { id: 'body', semanticKind: 'paragraph', text: 'Body starts after two breaks' },
  ]);

  assert.equal(pageMap.pageBreaks.filter((item) => item.reason === 'explicit').length, 2);
  assert.equal(pageMap.meta.pageBreakCount, 2);
  assert.deepEqual(pageMap.pages.map((page) => page.pageNumber), [2, 3]);
  assert.deepEqual(pageMap.pages[0].nodeIds, []);
  assert.equal(pageNumberForNode(pageMap, 'body'), 3);
  assert.equal(pageMap.totalPageCount, pageMap.pages.length);
  assert.equal(pageMap.runtimeContractSchemaVersion, 'derived.pageMap.runtimeContract.v1');
  assert.deepEqual(pageMap.contract, {
    derived: true,
    derivedOnly: true,
    runtimeOnly: true,
    textTruth: false,
    notTextTruth: true,
    storageTruth: false,
    exportTruth: false,
    productRuntimeBinding: false,
    source: 'canonical-derived-layout-flow',
  });
  assert.equal(Array.isArray(pageMap.pageRects), true);
  assert.equal(Array.isArray(pageMap.gapRects), true);
  assert.equal(pageMap.pageRects.length, pageMap.pages.length);
  assert.equal(pageMap.gapRects.length, Math.max(0, pageMap.pages.length - 1));
  assert.equal(typeof pageMap.sourceRevisionToken, 'string');
  assert.equal(typeof pageMap.profileRevisionToken, 'string');
  assert.equal(pageMap.meta.pageRectCount, pageMap.pageRects.length);
  assert.equal(pageMap.meta.gapRectCount, pageMap.gapRects.length);
  assert.equal(pageMap.meta.sourceRevisionToken, pageMap.sourceRevisionToken);
  assert.equal(pageMap.meta.profileRevisionToken, pageMap.profileRevisionToken);
  assert.equal(typeof pageMap.meta.pageMapHash, 'string');
});

test('page map keeps chapter start next-page and continuous rules stable', async () => {
  const nextPageMap = await paginate([
    { id: 'intro', semanticKind: 'paragraph', text: 'Intro' },
    { id: 'chapter', semanticKind: 'sceneHeading', text: 'Chapter One', chapterStart: true },
    { id: 'body', semanticKind: 'paragraph', text: 'Body' },
  ], { chapterStartRule: 'next-page' });

  assert.equal(nextPageMap.pageBreaks.some((item) => item.reason === 'chapterStart' && item.nodeId === 'chapter'), true);
  assert.equal(pageNumberForNode(nextPageMap, 'chapter'), 2);
  assert.equal(pageNumberForNode(nextPageMap, 'body'), 2);

  const continuousMap = await paginate([
    { id: 'intro', semanticKind: 'paragraph', text: 'Intro' },
    { id: 'chapter', semanticKind: 'sceneHeading', text: 'Chapter One', chapterStart: true },
    { id: 'body', semanticKind: 'paragraph', text: 'Body' },
  ], { chapterStartRule: 'continuous' });

  assert.equal(continuousMap.pageBreaks.some((item) => item.reason === 'chapterStart'), false);
  assert.equal(pageNumberForNode(continuousMap, 'chapter'), 1);
  assert.equal(pageNumberForNode(continuousMap, 'body'), 1);
});

test('page map does not create a leading empty page for the first chapter', async () => {
  const pageMap = await paginate([
    { id: 'chapter', semanticKind: 'sceneHeading', text: 'Chapter One', chapterStart: true },
    { id: 'body', semanticKind: 'paragraph', text: 'Body' },
  ], { chapterStartRule: 'next-page' });

  assert.equal(pageMap.pageBreaks.some((item) => item.reason === 'chapterStart'), false);
  assert.deepEqual(pageMap.pages.map((page) => page.pageNumber), [1]);
  assert.equal(pageNumberForNode(pageMap, 'chapter'), 1);
});

test('page map honors existing node.style page break flags only', async () => {
  const beforeMap = await paginate([
    { id: 'intro', semanticKind: 'paragraph', text: 'Intro' },
    { id: 'break-before', semanticKind: 'paragraph', text: 'Break before', style: { pageBreakBefore: true } },
    { id: 'tail', semanticKind: 'paragraph', text: 'Tail' },
  ]);

  assert.equal(beforeMap.pageBreaks.some((item) => item.reason === 'stylePageBreakBefore' && item.nodeId === 'break-before'), true);
  assert.equal(pageNumberForNode(beforeMap, 'break-before'), 2);
  assert.equal(pageNumberForNode(beforeMap, 'tail'), 2);

  const leadingBeforeMap = await paginate([
    { id: 'first', semanticKind: 'paragraph', text: 'First', style: { pageBreakBefore: true } },
    { id: 'tail', semanticKind: 'paragraph', text: 'Tail' },
  ]);

  assert.equal(leadingBeforeMap.pageBreaks.some((item) => item.reason === 'stylePageBreakBefore'), false);
  assert.deepEqual(leadingBeforeMap.pages.map((page) => page.pageNumber), [1]);
  assert.equal(pageNumberForNode(leadingBeforeMap, 'first'), 1);

  const afterMap = await paginate([
    { id: 'intro', semanticKind: 'paragraph', text: 'Intro' },
    { id: 'break-after', semanticKind: 'paragraph', text: 'Break after', style: { pageBreakAfter: true } },
    { id: 'tail', semanticKind: 'paragraph', text: 'Tail' },
  ]);

  assert.equal(afterMap.pageBreaks.some((item) => item.reason === 'stylePageBreakAfter' && item.nodeId === 'break-after'), true);
  assert.equal(pageNumberForNode(afterMap, 'break-after'), 1);
  assert.equal(pageNumberForNode(afterMap, 'tail'), 2);

  const topLevelCompatMap = await paginate([
    { id: 'intro', semanticKind: 'paragraph', text: 'Intro' },
    { id: 'top-level-before', semanticKind: 'paragraph', text: 'Top level ignored', pageBreakBefore: true },
    { id: 'tail', semanticKind: 'paragraph', text: 'Tail' },
  ]);

  assert.equal(topLevelCompatMap.pageBreaks.some((item) => item.reason === 'stylePageBreakBefore'), false);
  assert.equal(pageNumberForNode(topLevelCompatMap, 'top-level-before'), 1);
  assert.equal(pageNumberForNode(topLevelCompatMap, 'tail'), 1);

  const topLevelAfterCompatMap = await paginate([
    { id: 'intro', semanticKind: 'paragraph', text: 'Intro' },
    { id: 'top-level-after', semanticKind: 'paragraph', text: 'Top level ignored', pageBreakAfter: true },
    { id: 'tail', semanticKind: 'paragraph', text: 'Tail' },
  ]);

  assert.equal(topLevelAfterCompatMap.pageBreaks.some((item) => item.reason === 'stylePageBreakAfter'), false);
  assert.equal(pageNumberForNode(topLevelAfterCompatMap, 'top-level-after'), 1);
  assert.equal(pageNumberForNode(topLevelAfterCompatMap, 'tail'), 1);
});

test('minimal TipTap page map runtime contract binds to explicit editor text provider', async () => {
  const layoutPreview = await loadModule('src/renderer/layoutPreview.mjs');

  const contract = layoutPreview.buildTiptapPageMapRuntimeContract(createContractInput());

  assert.equal(contract.contractVersion, 'renderer.tiptapPageMapRuntimeContract.v1');
  assert.equal(contract.derivedOnly, true);
  assert.equal(contract.runtimeOnly, true);
  assert.equal(contract.textTruth, false);
  assert.equal(contract.notTextTruth, true);
  assert.equal(contract.storageTruth, false);
  assert.equal(contract.exportTruth, false);
  assert.equal(contract.primaryTiptapBinding, true);
  assert.equal(contract.bindingSource, 'currentTiptapPlainText');
  assert.equal(typeof contract.sourceTextHash, 'string');
  assert.equal(typeof contract.sourceIdentityHash, 'string');
  assert.equal(typeof contract.profileHash, 'string');
  assert.equal(typeof contract.contractHash, 'string');
  assert.equal(contract.totalPageCount >= 2, true);
  assert.equal(Array.isArray(contract.derivedPageSummaries), true);
  assert.equal(contract.derivedPageSummaries.length, contract.totalPageCount);
  assert.equal(contract.derivedPageSummaries.every((page) => typeof page.pageNumber === 'number'), true);
  assert.equal(contract.confidence.level, 'approximate');
  assert.equal(contract.confidence.pagination, 'block-or-paragraph-derived');
  assert.equal(contract.confidence.geometry, 'no-real-rects-in-c01');
  assert.deepEqual(contract.limits.implementedScopes, ['runtimeDerivedPageMapContract']);
  assert.deepEqual(contract.limits.deferredScopes, ['visibleWindow', 'noBleedRenderer', 'realPageRects', 'realGapRects']);
  assert.equal(contract.limits.storageTruth, false);
  assert.equal(contract.limits.exportTruth, false);
  assert.equal(Object.prototype.hasOwnProperty.call(contract, 'pageRects'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(contract, 'gapRects'), false);
  assert.deepEqual(contract.derivedPageMapContract, {
    schemaVersion: 'derived.pageMap.runtimeContract.v1',
    derived: true,
    derivedOnly: true,
    runtimeOnly: true,
    textTruth: false,
    notTextTruth: true,
    storageTruth: false,
    exportTruth: false,
    productRuntimeBinding: false,
    source: 'canonical-derived-layout-flow',
    sourceRevisionToken: contract.derivedPageMapContract.sourceRevisionToken,
    profileRevisionToken: contract.derivedPageMapContract.profileRevisionToken,
    pageMapHash: contract.derivedPageMapContract.pageMapHash,
  });
  assert.equal(typeof contract.derivedPageMapContract.sourceRevisionToken, 'string');
  assert.equal(typeof contract.derivedPageMapContract.profileRevisionToken, 'string');
  assert.equal(typeof contract.derivedPageMapContract.pageMapHash, 'string');

  const keySet = collectKeys(contract);
  for (const forbiddenKey of [
    'projectManifest',
    'assets',
    'backups',
    'atomicWrite',
    'recovery',
    'storage',
    'exportPipeline',
    'docx',
    'text',
    'html',
    'content',
    'plainText',
    'pmDoc',
    'json',
    'marks',
    'attrs',
  ]) {
    assert.equal(keySet.has(forbiddenKey), false, `contract leaked forbidden key ${forbiddenKey}`);
  }
});

test('minimal TipTap page map runtime contract invalidates after text and profile changes', async () => {
  const layoutPreview = await loadModule('src/renderer/layoutPreview.mjs');
  const cache = layoutPreview.createLayoutPreviewSnapshotCache({ maxEntries: 4 });
  const firstInput = createContractInput();
  const first = layoutPreview.buildTiptapPageMapRuntimeContract(firstInput, cache);
  const firstRepeat = layoutPreview.buildTiptapPageMapRuntimeContract(firstInput, cache);

  assert.deepEqual(firstRepeat, first);

  const firstNoCache = layoutPreview.buildTiptapPageMapRuntimeContract(firstInput);
  const secondNoCache = layoutPreview.buildTiptapPageMapRuntimeContract(createContractInput());
  assert.equal(firstNoCache.sourceTextHash, secondNoCache.sourceTextHash);
  assert.equal(firstNoCache.sourceIdentityHash, secondNoCache.sourceIdentityHash);
  assert.equal(firstNoCache.profileHash, secondNoCache.profileHash);
  assert.equal(firstNoCache.contractHash, secondNoCache.contractHash);
  assert.deepEqual(firstNoCache.derivedPageSummaries, secondNoCache.derivedPageSummaries);

  const changedText = layoutPreview.buildTiptapPageMapRuntimeContract(createContractInput({
    textProvider: () => 'Changed text for runtime contract',
  }), cache);
  assert.notEqual(changedText.sourceTextHash, first.sourceTextHash);
  assert.notEqual(changedText.sourceIdentityHash, first.sourceIdentityHash);
  assert.equal(changedText.profileHash, first.profileHash);
  assert.notEqual(changedText.contractHash, first.contractHash);
  assert.notEqual(changedText.derivedPageMapContract.sourceRevisionToken, first.derivedPageMapContract.sourceRevisionToken);
  assert.notEqual(changedText.derivedPageMapContract.pageMapHash, first.derivedPageMapContract.pageMapHash);
  assert.notEqual(changedText.totalPageCount, 0);

  const changedProfile = layoutPreview.buildTiptapPageMapRuntimeContract(createContractInput({
    profile: {
      formatId: 'A4',
      chapterStartRule: 'continuous',
      allowExplicitPageBreaks: true,
    },
  }), cache);
  assert.equal(changedProfile.sourceTextHash, first.sourceTextHash);
  assert.equal(changedProfile.sourceIdentityHash, first.sourceIdentityHash);
  assert.notEqual(changedProfile.profileHash, first.profileHash);
  assert.notEqual(changedProfile.contractHash, first.contractHash);
  assert.notEqual(changedProfile.derivedPageMapContract.sourceRevisionToken, first.derivedPageMapContract.sourceRevisionToken);
  assert.notEqual(changedProfile.derivedPageMapContract.pageMapHash, first.derivedPageMapContract.pageMapHash);
  assert.equal(changedProfile.bindingSource, 'currentTiptapPlainText');

  const changedMetrics = layoutPreview.buildTiptapPageMapRuntimeContract(createContractInput({
    metrics: {
      pageWidthMm: 148,
      pageHeightMm: 210,
      pageWidthPx: 839,
      pageHeightPx: 1190,
      contentWidthPx: 590,
      contentHeightPx: 984,
    },
    profile: {
      formatId: 'A5',
      chapterStartRule: 'next-page',
      allowExplicitPageBreaks: true,
    },
  }), cache);
  assert.equal(changedMetrics.sourceTextHash, first.sourceTextHash);
  assert.equal(changedMetrics.sourceIdentityHash, first.sourceIdentityHash);
  assert.notEqual(changedMetrics.profileHash, first.profileHash);
  assert.notEqual(changedMetrics.contractHash, first.contractHash);
  assert.equal(changedMetrics.derivedPageMapContract.sourceRevisionToken, first.derivedPageMapContract.sourceRevisionToken);
  assert.notEqual(changedMetrics.derivedPageMapContract.profileRevisionToken, first.derivedPageMapContract.profileRevisionToken);
  assert.notEqual(changedMetrics.derivedPageMapContract.pageMapHash, first.derivedPageMapContract.pageMapHash);
  assert.equal(changedMetrics.bindingSource, 'currentTiptapPlainText');

  const changedSourceId = layoutPreview.buildTiptapPageMapRuntimeContract(createContractInput({
    sourceId: 'runtime-contract-test-alt-source',
  }), cache);
  assert.equal(changedSourceId.sourceTextHash, first.sourceTextHash);
  assert.notEqual(changedSourceId.sourceIdentityHash, first.sourceIdentityHash);
  assert.notEqual(changedSourceId.contractHash, first.contractHash);
});

test('page map runtime contract tokens are deterministic for identical inputs', async () => {
  const nodes = [
    { id: 'intro', semanticKind: 'paragraph', text: 'Intro text' },
    { id: 'chapter', semanticKind: 'sceneHeading', text: 'Chapter one', chapterStart: true },
    { id: 'tail', semanticKind: 'paragraph', text: 'Tail text' },
  ];
  const first = await paginate(nodes, { chapterStartRule: 'next-page' });
  const second = await paginate(nodes, { chapterStartRule: 'next-page' });

  assert.equal(first.sourceRevisionToken, second.sourceRevisionToken);
  assert.equal(first.profileRevisionToken, second.profileRevisionToken);
  assert.equal(first.meta.pageMapHash, second.meta.pageMapHash);
  assert.deepEqual(first.pageRects, second.pageRects);
  assert.deepEqual(first.gapRects, second.gapRects);

  const changedRule = await paginate(nodes, { chapterStartRule: 'continuous' });
  assert.notEqual(changedRule.sourceRevisionToken, first.sourceRevisionToken);
  assert.equal(changedRule.profileRevisionToken, first.profileRevisionToken);
  assert.notEqual(changedRule.meta.pageMapHash, first.meta.pageMapHash);

  const pageMapMod = await loadModule('src/derived/pageMapService.mjs');
  const stableProfileA = pageMapMod.paginateLayoutFlow({
    flow: { nodes },
    profile: {
      pageWidth: 210,
      pageHeight: 297,
      bodyWidth: 120,
      bodyHeight: 100,
    },
    measurements: nodes.map((node) => ({ nodeId: node.id, height: 1 })),
    rules: { chapterStartRule: 'next-page' },
  });
  const stableProfileB = pageMapMod.paginateLayoutFlow({
    flow: { nodes },
    profile: {
      bodyHeight: 100,
      bodyWidth: 120,
      pageHeight: 297,
      pageWidth: 210,
    },
    measurements: nodes.map((node) => ({ height: 1, nodeId: node.id })),
    rules: { chapterStartRule: 'next-page' },
  });
  assert.equal(stableProfileA.profileRevisionToken, stableProfileB.profileRevisionToken);
  assert.equal(stableProfileA.meta.pageMapHash, stableProfileB.meta.pageMapHash);
});
