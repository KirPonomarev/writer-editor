import { buildAnchorMap } from '../derived/anchorMap.mjs';
import { createLayoutMeasureProvider } from '../derived/layoutMeasureProvider.mjs';
import { mapSemanticEntries, PAGE_BREAK_TOKEN_V1 } from '../derived/semanticMapping.mjs';
import { createStyleMap } from '../derived/styleMap.mjs';

const LAYOUT_PREVIEW_SCHEMA_VERSION = 'renderer.layoutPreview.v1';
const LAYOUT_PREVIEW_STATE_SCHEMA_VERSION = 'renderer.layoutPreview.state.v1';
const LAYOUT_PREVIEW_CACHE_SCHEMA_VERSION = 'renderer.layoutPreview.cache.v1';
const DEFAULT_LAYOUT_PREVIEW_PAGE_WINDOW_SIZE = 24;
const DEFAULT_LAYOUT_PREVIEW_CACHE_ENTRIES = 8;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeChapterStartRule(value) {
  return normalizeString(value).toLowerCase() === 'continuous' ? 'continuous' : 'next-page';
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function stableSerialize(value) {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }
  if (type === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return 'null';
}

function fnv1aHash(input) {
  let hash = 0x811c9dc5;
  const source = String(input || '');
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function hashValue(value) {
  return fnv1aHash(stableSerialize(value));
}

function normalizeSelectionRange(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const start = Number(source.start);
  const end = Number(source.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { startOffset: 0, endOffset: 0 };
  }
  return {
    startOffset: Math.max(0, Math.min(start, end)),
    endOffset: Math.max(0, Math.max(start, end)),
  };
}

function toSemanticKind(kind) {
  const normalized = normalizeString(kind).toLowerCase();
  if (!normalized) return 'paragraph';
  if (normalized === 'sceneheading' || normalized === 'scene-heading' || normalized === 'scene_heading') return 'sceneHeading';
  if (normalized === 'pagebreak' || normalized === 'page-break' || normalized === 'page_break') return 'pageBreak';
  if (normalized === 'listitem' || normalized === 'list-item' || normalized === 'list_item') return 'listItem';
  if (normalized === 'codeblock' || normalized === 'code-block' || normalized === 'code_block') return 'codeBlock';
  return normalized;
}

function toLineClass(semanticKind) {
  const normalized = toSemanticKind(semanticKind);
  if (normalized === 'sceneHeading') return 'layout-preview__line--scene-heading';
  if (normalized === 'codeBlock') return 'layout-preview__line--code-block';
  if (normalized === 'listItem') return 'layout-preview__line--list-item';
  if (normalized === 'quote') return 'layout-preview__line--quote';
  return 'layout-preview__line--paragraph';
}

function buildNormalizedFlow({ text, sourceId, chapterStartRule }) {
  const semanticMap = mapSemanticEntries({
    sourceId,
    text: typeof text === 'string' ? text : '',
  });
  const styleMap = createStyleMap();
  const chapterRule = normalizeChapterStartRule(chapterStartRule);
  const nodes = [];

  const entries = Array.isArray(semanticMap.entries) ? semanticMap.entries : [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = isPlainObject(entries[index]) ? entries[index] : null;
    if (!entry) {
      continue;
    }
    const semanticKind = toSemanticKind(entry.kind);
    const textValue = typeof entry.text === 'string' ? entry.text : '';
    const styleDescriptor = styleMap.resolve(entry);
    const chapterStart = Boolean(entry.chapterStart) || semanticKind === 'sceneHeading';
    const isPageBreak = semanticKind === 'pageBreak';
    nodes.push({
      id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : `flow:${index}`,
      ordinal: Number.isFinite(Number(entry.ordinal)) ? Number(entry.ordinal) : index,
      semanticKind,
      text: isPageBreak ? PAGE_BREAK_TOKEN_V1 : textValue,
      sourceId: typeof entry.sourceId === 'string' ? entry.sourceId : sourceId,
      sourceRange: isPlainObject(entry.sourceRange)
        ? {
            startOffset: Number.isFinite(Number(entry.sourceRange.startOffset)) ? Number(entry.sourceRange.startOffset) : index,
            endOffset: Number.isFinite(Number(entry.sourceRange.endOffset)) ? Number(entry.sourceRange.endOffset) : index + Math.max(1, textValue.length),
          }
        : {
            startOffset: index,
            endOffset: index + Math.max(1, textValue.length),
          },
      chapterStart,
      isPageBreak,
      styleKey: styleDescriptor.key,
      style: {
        key: styleDescriptor.key,
        role: styleDescriptor.role,
        pageBreakBefore: Boolean(styleDescriptor.pageBreakBefore) || (chapterStart && chapterRule === 'next-page') || isPageBreak,
        pageBreakAfter: Boolean(styleDescriptor.pageBreakAfter),
        exportNeutral: styleDescriptor.exportNeutral !== false,
      },
    });
  }

  return {
    styleMap,
    flow: {
      schemaVersion: 'renderer.normalizedLayoutFlow.v1',
      rules: Object.freeze({
        chapterStartRule: chapterRule,
        pageBreakToken: PAGE_BREAK_TOKEN_V1,
      }),
      nodes,
      meta: Object.freeze({
        flowHash: hashValue({
          rules: {
            chapterStartRule: chapterRule,
            pageBreakToken: PAGE_BREAK_TOKEN_V1,
          },
          nodes,
        }),
      }),
    },
  };
}

function buildPaginationProfile(metrics) {
  const source = isPlainObject(metrics) ? metrics : {};
  const contentWidthPx = Number(source.contentWidthPx);
  const contentHeightPx = Number(source.contentHeightPx);
  const bodyWidthChars = Number.isFinite(contentWidthPx) ? Math.max(40, Math.round(contentWidthPx / 11)) : 80;
  const bodyHeightLines = Number.isFinite(contentHeightPx) ? Math.max(20, Math.round(contentHeightPx / 28)) : 52;
  return {
    pageWidth: Number(source.pageWidthMm) || 210,
    pageHeight: Number(source.pageHeightMm) || 297,
    bodyWidth: bodyWidthChars,
    bodyHeight: bodyHeightLines,
    charWidth: 1,
    lineHeight: 1,
    lineGap: 0,
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

function paginateFlow(flow, metrics, chapterStartRule) {
  const profile = buildPaginationProfile(metrics);
  const measureProvider = createLayoutMeasureProvider({
    bodyWidth: profile.bodyWidth,
    bodyHeight: profile.bodyHeight,
    charWidth: profile.charWidth,
    lineHeight: profile.lineHeight,
    lineGap: profile.lineGap,
  });

  const pages = [];
  const pageBreaks = [];
  let nextPageNumber = 1;
  let currentPage = null;

  function startPage() {
    if (!currentPage) {
      currentPage = createPage(nextPageNumber);
    }
  }

  function finalizePage() {
    if (!currentPage) return;
    if (currentPage.nodeIds.length === 0 && !currentPage.explicitBreakBefore) {
      currentPage = null;
      return;
    }
    pages.push(currentPage);
    currentPage = null;
  }

  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = isPlainObject(nodes[index]) ? nodes[index] : null;
    if (!node) continue;
    const chapterStartBreak = Boolean(node.chapterStart) && chapterStartRule === 'next-page';

    if (node.isPageBreak) {
      if (currentPage && currentPage.nodeIds.length > 0) {
        finalizePage();
      }
      nextPageNumber += 1;
      pageBreaks.push({
        nodeId: node.id,
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
        nodeId: node.id,
        beforePageNumber: nextPageNumber,
        reason: 'chapterStart',
      });
      currentPage = createPage(nextPageNumber);
      currentPage.explicitBreakBefore = true;
    }

    startPage();
    const measurement = measureProvider.measureNode(node);
    const height = Number.isFinite(Number(measurement.height)) ? Number(measurement.height) : 0;
    if (currentPage.height > 0 && currentPage.height + height > profile.bodyHeight) {
      finalizePage();
      nextPageNumber += 1;
      currentPage = createPage(nextPageNumber);
    }
    currentPage.nodeIds.push(node.id);
    currentPage.height += height;
    currentPage.overflow = currentPage.height > profile.bodyHeight;
  }

  finalizePage();

  return {
    schemaVersion: 'renderer.pageMap.v1',
    profile: {
      pageWidth: profile.pageWidth,
      pageHeight: profile.pageHeight,
      bodyWidth: profile.bodyWidth,
      bodyHeight: profile.bodyHeight,
    },
    pages,
    pageBreaks,
    meta: {
      pageCount: pages.length,
      pageBreakCount: pageBreaks.length,
      overflowCount: pages.filter((page) => page.overflow).length,
    },
  };
}

function buildStyleSummary(styleMap) {
  return {
    schemaVersion: styleMap.schemaVersion,
    defaultStyleKey: styleMap.defaultStyleKey,
    styles: styleMap.styles,
  };
}

export function createLayoutPreviewState(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return Object.freeze({
    schemaVersion: LAYOUT_PREVIEW_STATE_SCHEMA_VERSION,
    enabled: Boolean(source.enabled),
    frameMode: source.frameMode !== false,
    pageWindowStart: normalizePositiveInteger(source.pageWindowStart, 1),
    pageWindowSize: normalizePositiveInteger(source.pageWindowSize, DEFAULT_LAYOUT_PREVIEW_PAGE_WINDOW_SIZE),
  });
}

export function buildLayoutPreviewSnapshotCacheKey(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return hashValue({
    text: typeof source.text === 'string' ? source.text : '',
    sourceId: normalizeString(source.sourceId) || 'renderer-editor',
    profile: isPlainObject(source.profile) ? source.profile : {},
    metrics: isPlainObject(source.metrics) ? source.metrics : {},
    selectionRange: normalizeSelectionRange(source.selectionRange),
  });
}

export function createLayoutPreviewSnapshotCache(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const maxEntries = normalizePositiveInteger(source.maxEntries, DEFAULT_LAYOUT_PREVIEW_CACHE_ENTRIES);
  const entries = new Map();

  return {
    schemaVersion: LAYOUT_PREVIEW_CACHE_SCHEMA_VERSION,
    maxEntries,
    get size() {
      return entries.size;
    },
    get(cacheKey) {
      if (!entries.has(cacheKey)) return null;
      const snapshot = entries.get(cacheKey);
      entries.delete(cacheKey);
      entries.set(cacheKey, snapshot);
      return snapshot;
    },
    set(cacheKey, snapshot) {
      if (!cacheKey || !isPlainObject(snapshot)) return null;
      if (entries.has(cacheKey)) {
        entries.delete(cacheKey);
      }
      entries.set(cacheKey, snapshot);
      while (entries.size > maxEntries) {
        const oldestKey = entries.keys().next().value;
        entries.delete(oldestKey);
      }
      return snapshot;
    },
    clear() {
      entries.clear();
    },
  };
}

export function buildLayoutPreviewSnapshot(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const profile = isPlainObject(source.profile) ? source.profile : {};
  const metrics = isPlainObject(source.metrics) ? source.metrics : {};
  const chapterStartRule = normalizeChapterStartRule(profile.chapterStartRule);
  const sourceId = normalizeString(source.sourceId) || 'renderer-editor';
  const { styleMap, flow } = buildNormalizedFlow({
    text: typeof source.text === 'string' ? source.text : '',
    sourceId,
    chapterStartRule,
  });
  const pageMap = paginateFlow(flow, metrics, chapterStartRule);
  const selectionRange = normalizeSelectionRange(source.selectionRange);
  const anchorMap = buildAnchorMap({
    flow,
    pageMap,
    ranges: [selectionRange],
  });
  const styleSummary = buildStyleSummary(styleMap);
  const profileHash = hashValue({
    formatId: profile.formatId || 'A4',
    pageWidthMm: metrics.pageWidthMm,
    pageHeightMm: metrics.pageHeightMm,
    contentWidthPx: metrics.contentWidthPx,
    contentHeightPx: metrics.contentHeightPx,
  });
  const styleHash = hashValue(styleSummary);
  const invalidation = {
    schemaVersion: 'renderer.layoutInvalidation.v1',
    profileHash,
    flowHash: flow.meta.flowHash,
    styleHash,
    changeScope: ['bookProfile', 'normalizedLayoutFlow', 'styleMap'],
    invalidationKey: hashValue({
      profileHash,
      flowHash: flow.meta.flowHash,
      styleHash,
      changeScope: ['bookProfile', 'normalizedLayoutFlow', 'styleMap'],
    }),
  };

  return {
    schemaVersion: LAYOUT_PREVIEW_SCHEMA_VERSION,
    profile: {
      formatId: profile.formatId || 'A4',
      chapterStartRule,
      allowExplicitPageBreaks: profile.allowExplicitPageBreaks !== false,
    },
    metrics: {
      pageWidthPx: Number(metrics.pageWidthPx) || 0,
      pageHeightPx: Number(metrics.pageHeightPx) || 0,
      contentWidthPx: Number(metrics.contentWidthPx) || 0,
      contentHeightPx: Number(metrics.contentHeightPx) || 0,
    },
    styleMap: styleSummary,
    flow,
    pageMap,
    anchorMap,
    invalidation,
  };
}

export function buildCachedLayoutPreviewSnapshot(input = {}, cache = null) {
  if (!cache || typeof cache.get !== 'function' || typeof cache.set !== 'function') {
    return buildLayoutPreviewSnapshot(input);
  }
  const cacheKey = buildLayoutPreviewSnapshotCacheKey(input);
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const snapshot = buildLayoutPreviewSnapshot(input);
  return cache.set(cacheKey, snapshot) || snapshot;
}

function resolvePageWindow(pages, state) {
  const pageCount = Array.isArray(pages) ? pages.length : 0;
  const pageWindowSize = normalizePositiveInteger(state?.pageWindowSize, DEFAULT_LAYOUT_PREVIEW_PAGE_WINDOW_SIZE);
  const pageWindowStart = Math.min(
    Math.max(1, normalizePositiveInteger(state?.pageWindowStart, 1)),
    Math.max(1, pageCount),
  );
  const startIndex = Math.max(0, pageWindowStart - 1);
  const endIndex = Math.min(pageCount, startIndex + pageWindowSize);
  return {
    startIndex,
    endIndex,
    startPageNumber: pageCount > 0 ? startIndex + 1 : 0,
    endPageNumber: pageCount > 0 ? endIndex : 0,
    pageCount,
    pageWindowSize,
  };
}

function normalizePositivePixel(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function applyPreviewPageMetrics(pageSurface, metrics = {}) {
  if (!(pageSurface instanceof HTMLElement) || !isPlainObject(metrics)) {
    return;
  }
  const widthPx = normalizePositivePixel(metrics.pageWidthPx);
  const heightPx = normalizePositivePixel(metrics.pageHeightPx);
  if (widthPx <= 0 || heightPx <= 0) {
    return;
  }
  pageSurface.dataset.pageWidthPx = String(widthPx);
  pageSurface.dataset.pageHeightPx = String(heightPx);
  pageSurface.dataset.pageOrientation = widthPx > heightPx ? 'landscape' : 'portrait';
  pageSurface.style.aspectRatio = `${widthPx} / ${heightPx}`;
  pageSurface.style.width = '100%';
}

export function renderLayoutPreviewSnapshot(host, snapshot, state = createLayoutPreviewState()) {
  if (!(host instanceof HTMLElement)) {
    return;
  }
  const resolvedState = createLayoutPreviewState(state);
  if (!isPlainObject(snapshot)) {
    host.replaceChildren();
    return;
  }

  host.dataset.previewEnabled = resolvedState.enabled ? 'true' : 'false';
  host.dataset.previewFrame = resolvedState.frameMode ? 'on' : 'off';

  const flowNodes = Array.isArray(snapshot.flow?.nodes) ? snapshot.flow.nodes : [];
  const nodeMap = new Map(flowNodes.map((node) => [node.id, node]));
  const pages = Array.isArray(snapshot.pageMap?.pages) ? snapshot.pageMap.pages : [];
  const pageWindow = resolvePageWindow(pages, resolvedState);
  const visiblePages = pages.slice(pageWindow.startIndex, pageWindow.endIndex);

  const root = document.createElement('section');
  root.className = 'layout-preview';

  const header = document.createElement('header');
  header.className = 'layout-preview__header';
  const title = document.createElement('h3');
  title.className = 'layout-preview__title';
  title.textContent = 'Layout Preview';
  const meta = document.createElement('div');
  meta.className = 'layout-preview__meta';
  const formatId = snapshot.profile?.formatId || 'A4';
  const pageCount = Number(snapshot.pageMap?.meta?.pageCount) || pages.length;
  meta.textContent = `${formatId} · pages ${pageCount}`;
  header.append(title, meta);
  root.appendChild(header);

  const pagesHost = document.createElement('div');
  pagesHost.className = 'layout-preview__pages';
  pagesHost.classList.toggle('is-frame-off', !resolvedState.frameMode);
  pagesHost.dataset.pageWindowStart = String(pageWindow.startPageNumber);
  pagesHost.dataset.pageWindowEnd = String(pageWindow.endPageNumber);
  pagesHost.dataset.pageCount = String(pageWindow.pageCount);

  if (pages.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'layout-preview__empty';
    empty.textContent = 'No pages generated for current content.';
    pagesHost.appendChild(empty);
  } else {
    if (visiblePages.length < pages.length) {
      const windowMeta = document.createElement('div');
      windowMeta.className = 'layout-preview__window-meta';
      windowMeta.textContent = `Showing pages ${pageWindow.startPageNumber}-${pageWindow.endPageNumber} of ${pageWindow.pageCount}`;
      pagesHost.appendChild(windowMeta);
    }

    for (const page of visiblePages) {
      const pageWrap = document.createElement('article');
      pageWrap.className = 'layout-preview__page-wrap';
      pageWrap.dataset.pageNumber = String(page.pageNumber);

      const pageLabel = document.createElement('div');
      pageLabel.className = 'layout-preview__page-label';
      pageLabel.textContent = `Page ${page.pageNumber}`;
      pageWrap.appendChild(pageLabel);

      const pageSurface = document.createElement('div');
      pageSurface.className = 'layout-preview__page';
      applyPreviewPageMetrics(pageSurface, snapshot.metrics);
      const pageContent = document.createElement('div');
      pageContent.className = 'layout-preview__page-content';

      const nodeIds = Array.isArray(page.nodeIds) ? page.nodeIds : [];
      for (const nodeId of nodeIds) {
        const node = nodeMap.get(nodeId);
        if (!node) continue;
        const line = document.createElement('div');
        line.className = `layout-preview__line ${toLineClass(node.semanticKind)}`;
        line.dataset.semanticKind = toSemanticKind(node.semanticKind);
        line.textContent = typeof node.text === 'string' ? node.text : '';
        pageContent.appendChild(line);
      }

      pageSurface.appendChild(pageContent);
      pageWrap.appendChild(pageSurface);
      pagesHost.appendChild(pageWrap);
    }
  }

  root.appendChild(pagesHost);
  host.replaceChildren(root);
}
