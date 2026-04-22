import { hashCanonicalValue } from './deriveView.mjs';
import { PAGE_BREAK_TOKEN_V1 } from './semanticMapping.mjs';
import { SEMANTIC_STYLE_KEYS } from './styleMap.mjs';

const NORMALIZED_LAYOUT_FLOW_SCHEMA_VERSION = 'derived.normalizedLayoutFlow.v1';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSemanticKind(value) {
  const kind = normalizeString(value).toLowerCase();
  if (!kind) return 'paragraph';
  if (kind === 'page-break' || kind === 'pagebreak' || kind === 'page_break') return 'pageBreak';
  if (kind === 'scene-heading' || kind === 'sceneheading' || kind === 'scene_heading') return 'sceneHeading';
  if (kind === 'list-item' || kind === 'listitem' || kind === 'list_item') return 'listItem';
  if (kind === 'code-block' || kind === 'codeblock' || kind === 'code_block') return 'codeBlock';
  return kind;
}

function normalizeEntries(semanticMap) {
  if (Array.isArray(semanticMap)) return semanticMap;
  if (isPlainObject(semanticMap) && Array.isArray(semanticMap.entries)) return semanticMap.entries;
  return [];
}

function cloneRange(range, fallbackStart, fallbackEnd) {
  if (isPlainObject(range)) {
    const start = Number(range.startOffset);
    const end = Number(range.endOffset);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return { startOffset: start, endOffset: end };
    }
  }
  return { startOffset: fallbackStart, endOffset: fallbackEnd };
}

function normalizeRules(rules) {
  const normalized = isPlainObject(rules) ? { ...rules } : {};
  normalized.pageBreakToken = normalizeString(normalized.pageBreakToken) || PAGE_BREAK_TOKEN_V1;
  normalized.dropEmptyParagraphs = normalized.dropEmptyParagraphs !== false;
  normalized.strictPageBreakToken = normalized.strictPageBreakToken !== false;
  normalized.chapterStartRule = normalizeString(normalized.chapterStartRule).toLowerCase() === 'continuous'
    ? 'continuous'
    : 'next-page';
  normalized.defaultStyleKey = normalizeString(normalized.defaultStyleKey) || SEMANTIC_STYLE_KEYS.DEFAULT;
  return normalized;
}

function normalizeStyleMap(styleMap) {
  if (!isPlainObject(styleMap) || typeof styleMap.resolve !== 'function') {
    return null;
  }
  return styleMap;
}

function isRawDomSource(entry) {
  if (!isPlainObject(entry)) return false;
  if (entry.rawDom === true) return true;
  const sourceType = normalizeString(entry.sourceType).toLowerCase();
  const sourceKind = normalizeString(entry.sourceKind).toLowerCase();
  const sourceLayer = normalizeString(entry.sourceLayer).toLowerCase();
  const marker = [sourceType, sourceKind, sourceLayer];
  if (marker.includes('raw-dom') || marker.includes('rawdom') || marker.includes('dom')) {
    return true;
  }
  if (typeof entry.domTag === 'string' && entry.domTag.trim()) return true;
  if (typeof entry.html === 'string' && entry.html.trim()) return true;
  return false;
}

export function buildNormalizedLayoutFlow(input = {}) {
  const semanticEntries = normalizeEntries(input.semanticMap);
  const styleMap = normalizeStyleMap(input.styleMap);
  const rules = normalizeRules(input.rules);

  if (!Array.isArray(semanticEntries)) {
    throw new Error('E_NORMALIZED_LAYOUT_FLOW_SEMANTIC_ENTRIES_REQUIRED');
  }
  if (!styleMap) {
    throw new Error('E_NORMALIZED_LAYOUT_FLOW_STYLE_MAP_REQUIRED');
  }

  const nodes = [];

  for (let index = 0; index < semanticEntries.length; index += 1) {
    const entry = isPlainObject(semanticEntries[index]) ? semanticEntries[index] : null;
    if (!entry) {
      throw new Error('E_NORMALIZED_LAYOUT_FLOW_ENTRY_INVALID');
    }
    if (isRawDomSource(entry)) {
      throw new Error('E_NORMALIZED_LAYOUT_FLOW_RAW_DOM_SOURCE_FORBIDDEN');
    }

    const semanticKind = normalizeSemanticKind(entry.kind);
    const text = typeof entry.text === 'string' ? entry.text : '';
    if (semanticKind === 'pageBreak') {
      const token = normalizeString(entry.token) || text.trim();
      if (rules.strictPageBreakToken && token !== rules.pageBreakToken) {
        throw new Error('E_NORMALIZED_LAYOUT_FLOW_PAGE_BREAK_TOKEN_REQUIRED');
      }
    }

    const style = styleMap.resolve(entry);
    const resolvedStyleKey = normalizeString(style?.key) || rules.defaultStyleKey;
    const sourceRange = cloneRange(entry.sourceRange, index, index + Math.max(text.length, 1));
    const chapterStart = Boolean(entry.chapterStart) || semanticKind === 'sceneHeading';
    const isPageBreak = semanticKind === 'pageBreak' || resolvedStyleKey === SEMANTIC_STYLE_KEYS.PAGE_BREAK;
    const pageBreakBefore = Boolean(style?.pageBreakBefore)
      || isPageBreak
      || (chapterStart && rules.chapterStartRule === 'next-page');

    if (rules.dropEmptyParagraphs && semanticKind === 'paragraph' && !text.trim()) {
      continue;
    }

    nodes.push({
      id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : `flow:${index}`,
      ordinal: Number.isFinite(Number(entry.ordinal)) ? Number(entry.ordinal) : index,
      semanticKind,
      text,
      token: semanticKind === 'pageBreak' ? rules.pageBreakToken : undefined,
      sourceId: typeof entry.sourceId === 'string' ? entry.sourceId : '',
      sourceRange,
      styleKey: resolvedStyleKey,
      chapterStart,
      style: {
        key: resolvedStyleKey,
        role: normalizeString(style?.role) || resolvedStyleKey,
        pageBreakBefore,
        pageBreakAfter: Boolean(style?.pageBreakAfter),
        exportNeutral: style?.exportNeutral !== false,
      },
      isPageBreak,
      layoutRole: isPageBreak ? 'pageBreak' : 'content',
    });
  }

  const flow = {
    schemaVersion: NORMALIZED_LAYOUT_FLOW_SCHEMA_VERSION,
    nodes,
    rules,
  };

  return {
    ...flow,
    meta: {
      flowHash: hashCanonicalValue({
        schemaVersion: flow.schemaVersion,
        nodes: flow.nodes,
        rules: flow.rules,
      }),
    },
  };
}

export { NORMALIZED_LAYOUT_FLOW_SCHEMA_VERSION };
