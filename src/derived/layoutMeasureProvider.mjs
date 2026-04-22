const LAYOUT_MEASURE_PROVIDER_SCHEMA_VERSION = 'derived.layoutMeasureProvider.v1';
const TEXT_MEASUREMENT_CACHE_MAX = 2048;

const PAGE_BREAK_MEASUREMENT = Object.freeze({
  width: 0,
  height: 0,
  lineCount: 0,
  charCount: 0,
  forcedBreak: true,
  styleKey: '',
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function normalizeConfig(config) {
  const source = isPlainObject(config) ? config : {};
  return {
    charWidth: normalizeNumber(source.charWidth, 1),
    lineHeight: normalizeNumber(source.lineHeight, 1),
    lineGap: normalizeNumber(source.lineGap, 0),
    bodyWidth: normalizeNumber(source.bodyWidth, 80),
    bodyHeight: normalizeNumber(source.bodyHeight, 40),
    pagePadding: normalizeNumber(source.pagePadding, 0),
  };
}

function resolveNodeText(node) {
  if (!isPlainObject(node)) return '';
  const text = node.text;
  if (typeof text === 'string') return text;
  const value = node.value;
  if (typeof value === 'string') return value;
  return '';
}

function measureText(text, config) {
  const normalizedText = String(text || '');
  const lines = normalizedText.split(/\r?\n/u);
  const charsPerLine = Math.max(1, Math.floor(config.bodyWidth / Math.max(config.charWidth, 1)));
  let maxLineLength = 0;
  let wrappedLineCount = 0;

  for (const line of lines) {
    const lineLength = line.length;
    maxLineLength = Math.max(maxLineLength, lineLength);
    wrappedLineCount += Math.max(1, Math.ceil(lineLength / charsPerLine));
  }

  const height = wrappedLineCount * config.lineHeight + Math.max(0, wrappedLineCount - 1) * config.lineGap;
  const width = Math.min(config.bodyWidth, maxLineLength * config.charWidth);
  return {
    width,
    height,
    lineCount: wrappedLineCount,
    charCount: normalizedText.length,
  };
}

function pruneTextMeasurementCache(cache) {
  while (cache.size > TEXT_MEASUREMENT_CACHE_MAX) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== 'string') break;
    cache.delete(oldestKey);
  }
}

export function createLayoutMeasureProvider(config = {}) {
  const normalizedConfig = normalizeConfig(config);
  const charsPerLine = Math.max(1, Math.floor(normalizedConfig.bodyWidth / Math.max(normalizedConfig.charWidth, 1)));
  const textMeasurementCache = new Map();
  const cacheStats = {
    textHits: 0,
    textMisses: 0,
  };

  function measureTextCached(text) {
    const normalizedText = String(text || '');
    const cached = textMeasurementCache.get(normalizedText);
    if (cached) {
      cacheStats.textHits += 1;
      textMeasurementCache.delete(normalizedText);
      textMeasurementCache.set(normalizedText, cached);
      return cached;
    }

    const measured = Object.freeze(measureText(normalizedText, normalizedConfig));
    cacheStats.textMisses += 1;
    textMeasurementCache.set(normalizedText, measured);
    pruneTextMeasurementCache(textMeasurementCache);
    return measured;
  }

  function measureNode(node) {
    if (!isPlainObject(node)) {
      throw new Error('E_LAYOUT_MEASURE_NODE_REQUIRED');
    }

    if (node.isPageBreak || node.semanticKind === 'pageBreak') {
      return { ...PAGE_BREAK_MEASUREMENT };
    }

    const text = resolveNodeText(node);
    const measured = measureTextCached(text);
    return {
      ...measured,
      forcedBreak: false,
      styleKey: typeof node.styleKey === 'string' ? node.styleKey : '',
    };
  }

  function measureFlow(flow) {
    const nodes = Array.isArray(flow) ? flow : Array.isArray(flow?.nodes) ? flow.nodes : [];
    const measurements = [];
    let totalHeight = 0;

    for (const node of nodes) {
      const measurement = measureNode(node);
      measurements.push({
        nodeId: typeof node?.id === 'string' ? node.id : '',
        ...measurement,
      });
      totalHeight += measurement.height;
    }

    return {
      schemaVersion: LAYOUT_MEASURE_PROVIDER_SCHEMA_VERSION,
      measurements,
      totalHeight,
      config: { ...normalizedConfig },
    };
  }

  return Object.freeze({
    schemaVersion: LAYOUT_MEASURE_PROVIDER_SCHEMA_VERSION,
    config: Object.freeze({ ...normalizedConfig }),
    measureText(text) {
      return { ...measureTextCached(text) };
    },
    getCacheStats() {
      return {
        textHits: cacheStats.textHits,
        textMisses: cacheStats.textMisses,
        textEntryCount: textMeasurementCache.size,
      };
    },
    measureNode,
    measureFlow,
  });
}

export { LAYOUT_MEASURE_PROVIDER_SCHEMA_VERSION };
