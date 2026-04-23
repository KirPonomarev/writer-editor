const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule(filePath) {
  return import(pathToFileURL(path.join(process.cwd(), filePath)).href);
}

function createParagraph(id, text, style = {}) {
  return {
    id,
    semanticKind: 'paragraph',
    text,
    style,
  };
}

function createChapter(id, text, style = {}) {
  return {
    id,
    semanticKind: 'chapter',
    text,
    style,
    layoutRole: 'chapter',
  };
}

function createPageBreak(id) {
  return {
    id,
    semanticKind: 'pageBreak',
    text: '[[PAGE_BREAK]]',
    isPageBreak: true,
    styleKey: 'semantic.pageBreak',
    style: {
      pageBreakBefore: true,
      pageBreakAfter: false,
    },
  };
}

test('page map keeps consecutive explicit breaks monotonic and counts only explicit break records', async () => {
  const pageMapMod = await loadModule('src/derived/pageMapService.mjs');

  const pageMap = pageMapMod.paginateLayoutFlow({
    flow: {
      nodes: [
        createPageBreak('break-1'),
        createPageBreak('break-2'),
        createParagraph('content-1', 'After two breaks'),
      ],
    },
    profile: {
      pageWidth: 80,
      pageHeight: 40,
      bodyWidth: 80,
      bodyHeight: 40,
    },
    measurements: [
      { nodeId: 'content-1', height: 1 },
    ],
  });

  assert.equal(pageMap.pageBreaks.length, 2);
  assert.equal(pageMap.pages.length, 2);
  assert.equal(pageMap.pages[0].pageNumber, 2);
  assert.equal(pageMap.pages[0].nodeIds.length, 0);
  assert.equal(pageMap.pages[1].pageNumber, 3);
  assert.equal(pageMap.pages[1].nodeIds.includes('content-1'), true);
  assert.equal(
    pageMap.pages.every((page, index) => index === 0 || page.pageNumber > pageMap.pages[index - 1].pageNumber),
    true,
  );
});

test('page map applies node style breaks and ignores top-level page break flags', async () => {
  const pageMapMod = await loadModule('src/derived/pageMapService.mjs');

  const styledBreakMap = pageMapMod.paginateLayoutFlow({
    flow: {
      nodes: [
        createParagraph('intro', 'Intro'),
        createParagraph('before', 'Break before me', { pageBreakBefore: true }),
        createParagraph('after', 'Break after me', { pageBreakAfter: true }),
        createParagraph('tail', 'Tail'),
      ],
    },
    profile: {
      pageWidth: 80,
      pageHeight: 40,
      bodyWidth: 80,
      bodyHeight: 40,
    },
    measurements: [
      { nodeId: 'intro', height: 1 },
      { nodeId: 'before', height: 1 },
      { nodeId: 'after', height: 1 },
      { nodeId: 'tail', height: 1 },
    ],
  });

  assert.equal(styledBreakMap.pageBreaks.length, 0);
  assert.equal(styledBreakMap.pages.length, 3);
  assert.equal(styledBreakMap.pages[0].pageNumber, 1);
  assert.equal(styledBreakMap.pages[1].pageNumber, 2);
  assert.equal(styledBreakMap.pages[2].pageNumber, 3);
  assert.equal(styledBreakMap.pages[1].nodeIds.includes('before'), true);
  assert.equal(styledBreakMap.pages[1].nodeIds.includes('after'), true);
  assert.equal(styledBreakMap.pages[2].nodeIds.includes('tail'), true);

  const leadingStyledBreakMap = pageMapMod.paginateLayoutFlow({
    flow: {
      nodes: [
        createParagraph('lead', 'Lead', { pageBreakBefore: true }),
        createParagraph('follow', 'Follow'),
      ],
    },
    profile: {
      pageWidth: 80,
      pageHeight: 40,
      bodyWidth: 80,
      bodyHeight: 40,
    },
    measurements: [
      { nodeId: 'lead', height: 1 },
      { nodeId: 'follow', height: 1 },
    ],
  });

  assert.equal(leadingStyledBreakMap.pages.length, 1);
  assert.equal(leadingStyledBreakMap.pages[0].pageNumber, 1);
  assert.equal(leadingStyledBreakMap.pages[0].nodeIds.includes('lead'), true);
  assert.equal(leadingStyledBreakMap.pages[0].nodeIds.includes('follow'), true);

  const ignoredTopLevelFlagsMap = pageMapMod.paginateLayoutFlow({
    flow: {
      nodes: [
        createParagraph('top-level-intro', 'Intro'),
        createParagraph('top-level-tail', 'Tail'),
      ],
    },
    profile: {
      pageWidth: 80,
      pageHeight: 40,
      bodyWidth: 80,
      bodyHeight: 40,
    },
    rules: {
      pageBreakBefore: true,
      pageBreakAfter: true,
    },
    measurements: [
      { nodeId: 'top-level-intro', height: 1 },
      { nodeId: 'top-level-tail', height: 1 },
    ],
  });

  assert.equal(ignoredTopLevelFlagsMap.pages.length, 1);
  assert.equal(ignoredTopLevelFlagsMap.pages[0].nodeIds.includes('top-level-intro'), true);
  assert.equal(ignoredTopLevelFlagsMap.pages[0].nodeIds.includes('top-level-tail'), true);
});

test('page map respects chapter start rules without leading empty pages', async () => {
  const pageMapMod = await loadModule('src/derived/pageMapService.mjs');

  const nextPageMap = pageMapMod.paginateLayoutFlow({
    flow: {
      nodes: [
        createParagraph('intro', 'Intro'),
        createChapter('chapter', 'Chapter one'),
        createParagraph('body', 'Body'),
      ],
    },
    profile: {
      pageWidth: 80,
      pageHeight: 40,
      bodyWidth: 80,
      bodyHeight: 40,
    },
    rules: {
      chapterStartRule: 'next-page',
    },
    measurements: [
      { nodeId: 'intro', height: 1 },
      { nodeId: 'chapter', height: 1 },
      { nodeId: 'body', height: 1 },
    ],
  });

  assert.equal(nextPageMap.pages.length, 2);
  assert.equal(nextPageMap.pages[0].nodeIds.includes('intro'), true);
  assert.equal(nextPageMap.pages[1].nodeIds.includes('chapter'), true);
  assert.equal(nextPageMap.pages[1].nodeIds.includes('body'), true);

  const continuousMap = pageMapMod.paginateLayoutFlow({
    flow: {
      nodes: [
        createParagraph('intro-2', 'Intro'),
        createChapter('chapter-2', 'Chapter two'),
        createParagraph('body-2', 'Body'),
      ],
    },
    profile: {
      pageWidth: 80,
      pageHeight: 40,
      bodyWidth: 80,
      bodyHeight: 40,
    },
    rules: {
      chapterStartRule: 'continuous',
    },
    measurements: [
      { nodeId: 'intro-2', height: 1 },
      { nodeId: 'chapter-2', height: 1 },
      { nodeId: 'body-2', height: 1 },
    ],
  });

  assert.equal(continuousMap.pages.length, 1);
  assert.equal(continuousMap.pages[0].nodeIds.includes('intro-2'), true);
  assert.equal(continuousMap.pages[0].nodeIds.includes('chapter-2'), true);
  assert.equal(continuousMap.pages[0].nodeIds.includes('body-2'), true);

  const leadingChapterMap = pageMapMod.paginateLayoutFlow({
    flow: {
      nodes: [
        createChapter('chapter-start', 'Opening chapter'),
        createParagraph('chapter-tail', 'Tail'),
      ],
    },
    profile: {
      pageWidth: 80,
      pageHeight: 40,
      bodyWidth: 80,
      bodyHeight: 40,
    },
    rules: {
      chapterStartRule: 'next-page',
    },
    measurements: [
      { nodeId: 'chapter-start', height: 1 },
      { nodeId: 'chapter-tail', height: 1 },
    ],
  });

  assert.equal(leadingChapterMap.pages.length, 1);
  assert.equal(leadingChapterMap.pages[0].pageNumber, 1);
  assert.equal(leadingChapterMap.pages[0].nodeIds[0], 'chapter-start');
  assert.equal(leadingChapterMap.pages[0].nodeIds.includes('chapter-tail'), true);
});
