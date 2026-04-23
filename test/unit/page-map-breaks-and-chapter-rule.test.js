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
