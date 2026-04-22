const ANCHOR_MAP_SCHEMA_VERSION = 'derived.anchorMap.v1';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeFlow(flow) {
  if (Array.isArray(flow)) return flow;
  if (isPlainObject(flow) && Array.isArray(flow.nodes)) return flow.nodes;
  return [];
}

function normalizeRange(range, fallbackStart, fallbackEnd) {
  if (!isPlainObject(range)) {
    return { startOffset: fallbackStart, endOffset: fallbackEnd };
  }
  const start = Number(range.startOffset);
  const end = Number(range.endOffset);
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
    return { startOffset: start, endOffset: end };
  }
  return { startOffset: fallbackStart, endOffset: fallbackEnd };
}

function extractNodeRange(node, fallbackStart) {
  if (!isPlainObject(node)) {
    return { startOffset: fallbackStart, endOffset: fallbackStart };
  }
  if (isPlainObject(node.sourceRange)) {
    return normalizeRange(node.sourceRange, fallbackStart, fallbackStart + 1);
  }
  if (isPlainObject(node.range)) {
    return normalizeRange(node.range, fallbackStart, fallbackStart + 1);
  }
  const text = typeof node.text === 'string' ? node.text : '';
  return { startOffset: fallbackStart, endOffset: fallbackStart + Math.max(1, text.length) };
}

function normalizeRequestedRanges(ranges) {
  if (!ranges) return [];
  if (Array.isArray(ranges)) return ranges;
  return [ranges];
}

function buildPageLookup(pageMap) {
  const lookup = new Map();
  const pages = Array.isArray(pageMap?.pages) ? pageMap.pages : [];
  for (const page of pages) {
    if (!isPlainObject(page)) continue;
    const pageNumber = Number(page.pageNumber);
    if (!Number.isFinite(pageNumber)) continue;
    for (const nodeId of Array.isArray(page.nodeIds) ? page.nodeIds : []) {
      if (typeof nodeId === 'string' && nodeId.trim()) {
        lookup.set(nodeId.trim(), pageNumber);
      }
    }
  }
  return lookup;
}

export function buildAnchorMap(input = {}) {
  const nodes = normalizeFlow(input.flow);
  const pageLookup = buildPageLookup(input.pageMap);
  const requestedRanges = normalizeRequestedRanges(input.ranges);
  const anchors = [];
  const ranges = [];
  let cursor = 0;

  for (let index = 0; index < nodes.length; index += 1) {
    const node = isPlainObject(nodes[index]) ? nodes[index] : null;
    if (!node) {
      throw new Error('E_ANCHOR_MAP_NODE_INVALID');
    }
    const nodeId = typeof node.id === 'string' && node.id.trim() ? node.id.trim() : `flow:${index}`;
    const range = extractNodeRange(node, cursor);
    cursor = Math.max(cursor, range.endOffset);
    anchors.push({
      anchorId: `anchor:${nodeId}`,
      nodeId,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      pageNumber: pageLookup.get(nodeId) || Number(node.pageNumber) || 0,
      semanticKind: typeof node.semanticKind === 'string' ? node.semanticKind : '',
      styleKey: typeof node.styleKey === 'string' ? node.styleKey : '',
    });
  }

  for (const rangeInput of requestedRanges) {
    const normalized = normalizeRange(rangeInput, 0, 0);
    if (normalized.endOffset < normalized.startOffset) {
      throw new Error('E_ANCHOR_MAP_RANGE_INVALID');
    }
    const startAnchor = anchors.find((anchor) => anchor.startOffset <= normalized.startOffset && anchor.endOffset >= normalized.startOffset) || null;
    const endAnchor = anchors.find((anchor) => anchor.startOffset <= normalized.endOffset && anchor.endOffset >= normalized.endOffset) || null;
    ranges.push({
      startOffset: normalized.startOffset,
      endOffset: normalized.endOffset,
      startAnchorId: startAnchor ? startAnchor.anchorId : '',
      endAnchorId: endAnchor ? endAnchor.anchorId : '',
      pageNumber: startAnchor?.pageNumber || endAnchor?.pageNumber || 0,
    });
  }

  return {
    schemaVersion: ANCHOR_MAP_SCHEMA_VERSION,
    anchors,
    ranges,
    meta: {
      anchorCount: anchors.length,
      rangeCount: ranges.length,
    },
  };
}

export { ANCHOR_MAP_SCHEMA_VERSION };
