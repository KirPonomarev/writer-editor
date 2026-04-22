const LAYOUT_MEASURE_PROVIDER_SCHEMA_VERSION = 'derived.layoutMeasureProvider.v1';

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
  if (typeof node.text === 'string') return node.text;
  if (typeof node.value === 'string') return node.value;
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

export function createLayoutMeasureProvider(config = {}) {
  const normalizedConfig = normalizeConfig(config);

  function measureNode(node) {
    if (!isPlainObject(node)) {
      throw new Error('E_LAYOUT_MEASURE_NODE_REQUIRED');
    }
    if (node.isPageBreak || node.semanticKind === 'pageBreak') {
      return {
        width: 0,
        height: 0,
        lineCount: 0,
        charCount: 0,
        forcedBreak: true,
      };
    }

    const text = resolveNodeText(node);
    const measured = measureText(text, normalizedConfig);
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
      return measureText(text, normalizedConfig);
    },
    measureNode,
    measureFlow,
  });
}

export { LAYOUT_MEASURE_PROVIDER_SCHEMA_VERSION };
