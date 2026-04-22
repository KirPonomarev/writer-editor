import { hashCanonicalValue } from './deriveView.mjs';
import { createLayoutMeasureProvider } from './layoutMeasureProvider.mjs';

const PAGE_MAP_SCHEMA_VERSION = 'derived.pageMap.v1';

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
  return {
    pageWidth: normalizeNumber(source.pageWidth, 80),
    pageHeight: normalizeNumber(source.pageHeight, 40),
    bodyWidth: normalizeNumber(source.bodyWidth, normalizeNumber(source.pageWidth, 80)),
    bodyHeight: normalizeNumber(source.bodyHeight, normalizeNumber(source.pageHeight, 40)),
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

export function paginateLayoutFlow(input = {}) {
  const flowNodes = normalizeFlow(input.flow);
  const profile = normalizeProfile(input.profile);
  const styleMap = isPlainObject(input.styleMap) && typeof input.styleMap.resolve === 'function' ? input.styleMap : null;
  const providedMeasurements = normalizeMeasurements(input.measurements);
  const measureProvider = isPlainObject(input.measureProvider) && typeof input.measureProvider.measureNode === 'function'
    ? input.measureProvider
    : createLayoutMeasureProvider(profile);
  const strictOverflow = Boolean(input.rules && input.rules.strictOverflow);

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

    if (isPageBreak) {
      if (currentPage && currentPage.nodeIds.length > 0) {
        finalizePage();
      }
      nextPageNumber += 1;
      pageBreaks.push({
        nodeId,
        beforePageNumber: nextPageNumber,
      });
      if (!currentPage) {
        currentPage = createPage(nextPageNumber);
      }
      currentPage.explicitBreakBefore = true;
      continue;
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
  }

  finalizePage();

  const pageMap = {
    schemaVersion: PAGE_MAP_SCHEMA_VERSION,
    profile,
    pages,
    pageBreaks,
  };

  return {
    ...pageMap,
    meta: {
      pageMapHash: hashCanonicalValue(pageMap),
      pageCount: pages.length,
      pageBreakCount: pageBreaks.length,
      overflowCount: pages.filter((page) => page.overflow).length,
      strictOverflow,
    },
  };
}

export { PAGE_MAP_SCHEMA_VERSION };
