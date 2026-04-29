import { hashCanonicalValue } from './deriveView.mjs';
import { createLayoutMeasureProvider } from './layoutMeasureProvider.mjs';

const PAGE_MAP_SCHEMA_VERSION = 'derived.pageMap.v1';
const PAGE_MAP_RUNTIME_CONTRACT_SCHEMA_VERSION = 'derived.pageMap.runtimeContract.v1';
const PAGE_MAP_DERIVED_SOURCE = 'canonical-derived-layout-flow';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function normalizeFlow(flow) {
  if (Array.isArray(flow)) return flow;
  if (isPlainObject(flow) && Array.isArray(flow.nodes)) return flow.nodes;
  return [];
}

function normalizeMeasurements(measurements) {
  if (!Array.isArray(measurements)) return new Map();
  const map = new Map();
  for (const measurement of measurements) {
    if (!isPlainObject(measurement)) continue;
    const nodeId = typeof measurement.nodeId === 'string' ? measurement.nodeId : '';
    if (!nodeId) continue;
    map.set(nodeId, measurement);
  }
  return map;
}

function normalizeProfile(profile) {
  const source = isPlainObject(profile) ? profile : {};
  const pageWidth = normalizeNumber(source.pageWidth, 80);
  const pageHeight = normalizeNumber(source.pageHeight, 40);
  const bodyWidth = normalizeNumber(source.bodyWidth, pageWidth);
  const bodyHeight = normalizeNumber(source.bodyHeight, pageHeight);
  const pageGap = normalizeNumber(source.pageGap, 1);
  return {
    pageWidth,
    pageHeight,
    bodyWidth,
    bodyHeight,
    pageGap,
  };
}

function normalizeRules(rules) {
  const source = isPlainObject(rules) ? rules : {};
  return {
    strictOverflow: Boolean(source.strictOverflow),
    chapterStartRule: String(source.chapterStartRule || '').trim().toLowerCase() === 'continuous'
      ? 'continuous'
      : 'next-page',
  };
}

function createPage(pageNumber) {
  return {
    pageNumber,
    nodeIds: [],
    height: 0,
    overflow: false,
    explicitBreakBefore: false,
  };
}

function toCanonicalMeasurements(measurementsMap) {
  if (!(measurementsMap instanceof Map) || measurementsMap.size === 0) return [];
  return Array.from(measurementsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nodeId, measurement]) => ({
      nodeId,
      height: normalizeNumber(measurement?.height, 0),
      forcedBreak: Boolean(measurement?.forcedBreak),
    }));
}

function buildPageRects(pages, profile) {
  const pageRects = [];
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const top = index * (profile.pageHeight + profile.pageGap);
    const bottom = top + profile.pageHeight;
    pageRects.push({
      pageNumber: page.pageNumber,
      index,
      top,
      bottom,
      left: 0,
      right: profile.pageWidth,
      width: profile.pageWidth,
      height: profile.pageHeight,
      contentTop: top,
      contentBottom: top + profile.bodyHeight,
      contentLeft: 0,
      contentRight: profile.bodyWidth,
      contentWidth: profile.bodyWidth,
      contentHeight: profile.bodyHeight,
    });
  }
  return pageRects;
}

function buildGapRects(pageRects, profile) {
  if (!Array.isArray(pageRects) || pageRects.length <= 1) return [];
  const gapRects = [];
  for (let index = 0; index < pageRects.length - 1; index += 1) {
    const fromPage = pageRects[index];
    const toPage = pageRects[index + 1];
    const top = fromPage.bottom;
    const bottom = top + profile.pageGap;
    gapRects.push({
      index,
      fromPageNumber: fromPage.pageNumber,
      toPageNumber: toPage.pageNumber,
      top,
      bottom,
      left: 0,
      right: profile.pageWidth,
      width: profile.pageWidth,
      height: profile.pageGap,
    });
  }
  return gapRects;
}

export function paginateLayoutFlow(input = {}) {
  const flowNodes = normalizeFlow(input.flow);
  const profile = normalizeProfile(input.profile);
  const styleMap = isPlainObject(input.styleMap) && typeof input.styleMap.resolve === 'function' ? input.styleMap : null;
  const rules = normalizeRules(input.rules);
  const providedMeasurements = normalizeMeasurements(input.measurements);
  const measureProvider = isPlainObject(input.measureProvider) && typeof input.measureProvider.measureNode === 'function'
    ? input.measureProvider
    : createLayoutMeasureProvider(profile);
  const strictOverflow = rules.strictOverflow;

  if (!Array.isArray(flowNodes)) {
    throw new Error('E_PAGE_MAP_FLOW_REQUIRED');
  }

  const pages = [];
  const pageBreaks = [];
  let currentPage = null;
  let nextPageNumber = 1;

  function finalizePage() {
    if (!currentPage) return;
    if (currentPage.nodeIds.length === 0 && !currentPage.explicitBreakBefore) {
      currentPage = null;
      return;
    }
    pages.push(currentPage);
    currentPage = null;
  }

  function startPage() {
    if (!currentPage) {
      currentPage = createPage(nextPageNumber);
    }
  }

  for (let index = 0; index < flowNodes.length; index += 1) {
    const node = isPlainObject(flowNodes[index]) ? flowNodes[index] : null;
    if (!node) {
      throw new Error('E_PAGE_MAP_NODE_INVALID');
    }

    const nodeId = typeof node.id === 'string' && node.id.trim() ? node.id.trim() : `flow:${index}`;
    const semanticKind = typeof node.semanticKind === 'string' ? node.semanticKind : '';
    const isPageBreak = Boolean(node.isPageBreak) || semanticKind === 'pageBreak' || node.styleKey === 'semantic.pageBreak';
    const chapterStart = Boolean(node.chapterStart) || semanticKind === 'sceneHeading';
    const chapterStartBreak = chapterStart && rules.chapterStartRule === 'next-page';
    const nodeStyle = isPlainObject(node.style) ? node.style : {};
    const stylePageBreakBefore = nodeStyle.pageBreakBefore === true && !chapterStart;
    const stylePageBreakAfter = nodeStyle.pageBreakAfter === true;

    if (isPageBreak) {
      finalizePage();
      nextPageNumber += 1;
      pageBreaks.push({
        nodeId,
        beforePageNumber: nextPageNumber,
        reason: 'explicit',
      });
      if (!currentPage) {
        currentPage = createPage(nextPageNumber);
      }
      currentPage.explicitBreakBefore = true;
      continue;
    }

    if (chapterStartBreak && currentPage && currentPage.nodeIds.length > 0) {
      finalizePage();
      nextPageNumber += 1;
      pageBreaks.push({
        nodeId,
        beforePageNumber: nextPageNumber,
        reason: 'chapterStart',
      });
      currentPage = createPage(nextPageNumber);
      currentPage.explicitBreakBefore = true;
    }

    if (stylePageBreakBefore && currentPage && currentPage.nodeIds.length > 0) {
      finalizePage();
      nextPageNumber += 1;
      pageBreaks.push({
        nodeId,
        beforePageNumber: nextPageNumber,
        reason: 'stylePageBreakBefore',
      });
      currentPage = createPage(nextPageNumber);
    }

    startPage();
    const measurement = providedMeasurements.get(nodeId) || measureProvider.measureNode(node, { profile, styleMap });
    const height = normalizeNumber(measurement?.height, 0);

    if (currentPage.height > 0 && currentPage.height + height > profile.bodyHeight) {
      if (strictOverflow) {
        throw new Error('E_PAGE_MAP_OVERFLOW_STRICT');
      }
      finalizePage();
      nextPageNumber += 1;
      currentPage = createPage(nextPageNumber);
    }

    currentPage.nodeIds.push(nodeId);
    currentPage.height += height;
    if (currentPage.height > profile.bodyHeight) {
      if (strictOverflow) {
        throw new Error('E_PAGE_MAP_OVERFLOW_STRICT');
      }
      currentPage.overflow = true;
    }

    if (stylePageBreakAfter) {
      finalizePage();
      nextPageNumber += 1;
      pageBreaks.push({
        nodeId,
        beforePageNumber: nextPageNumber,
        reason: 'stylePageBreakAfter',
      });
      currentPage = createPage(nextPageNumber);
    }
  }

  finalizePage();

  const sourceRevisionToken = hashCanonicalValue({
    flow: flowNodes,
    measurements: toCanonicalMeasurements(providedMeasurements),
    chapterStartRule: rules.chapterStartRule,
    strictOverflow,
  });
  const profileRevisionToken = hashCanonicalValue(profile);
  const pageRects = buildPageRects(pages, profile);
  const gapRects = buildGapRects(pageRects, profile);

  const pageMap = {
    schemaVersion: PAGE_MAP_SCHEMA_VERSION,
    runtimeContractSchemaVersion: PAGE_MAP_RUNTIME_CONTRACT_SCHEMA_VERSION,
    contract: {
      derived: true,
      derivedOnly: true,
      runtimeOnly: true,
      textTruth: false,
      notTextTruth: true,
      storageTruth: false,
      exportTruth: false,
      productRuntimeBinding: false,
      source: PAGE_MAP_DERIVED_SOURCE,
    },
    profile,
    totalPageCount: pages.length,
    pages,
    pageBreaks,
    pageRects,
    gapRects,
    sourceRevisionToken,
    profileRevisionToken,
  };

  return {
    ...pageMap,
    meta: {
      pageMapHash: hashCanonicalValue(pageMap),
      pageCount: pages.length,
      pageBreakCount: pageBreaks.length,
      overflowCount: pages.filter((page) => page.overflow).length,
      strictOverflow,
      chapterStartRule: rules.chapterStartRule,
      pageRectCount: pageRects.length,
      gapRectCount: gapRects.length,
      sourceRevisionToken,
      profileRevisionToken,
    },
  };
}

export { PAGE_MAP_DERIVED_SOURCE, PAGE_MAP_SCHEMA_VERSION, PAGE_MAP_RUNTIME_CONTRACT_SCHEMA_VERSION };
