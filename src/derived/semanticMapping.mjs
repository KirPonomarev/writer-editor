const PAGE_BREAK_TOKEN_V1 = '[[PAGE_BREAK]]';
const SEMANTIC_MAPPING_SCHEMA_VERSION = 'derived.semanticMapping.v1';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeKind(value) {
  const kind = normalizeString(value).toLowerCase();
  if (!kind) return 'paragraph';
  if (kind === 'page-break' || kind === 'pagebreak' || kind === 'page_break') {
    return 'pageBreak';
  }
  if (kind === 'pagebreaktoken' || kind === 'page_break_token') {
    return 'pageBreak';
  }
  if (kind === 'scene-heading' || kind === 'sceneheading' || kind === 'scene_heading') {
    return 'sceneHeading';
  }
  if (kind === 'list-item' || kind === 'listitem' || kind === 'list_item') {
    return 'listItem';
  }
  if (kind === 'code-block' || kind === 'codeblock' || kind === 'code_block') {
    return 'codeBlock';
  }
  return kind;
}

function createEntryId(sourceId, ordinal, kind) {
  return `semantic:${sourceId || 'source'}:${String(ordinal).padStart(4, '0')}:${kind}`;
}

function normalizeBlockText(block) {
  if (typeof block === 'string') return block;
  if (!isPlainObject(block)) return '';
  if (typeof block.text === 'string') return block.text;
  if (typeof block.value === 'string') return block.value;
  return '';
}

function normalizeExplicitRange(block, fallbackStart, fallbackEnd) {
  if (!isPlainObject(block)) {
    return { startOffset: fallbackStart, endOffset: fallbackEnd };
  }
  if (isPlainObject(block.range)) {
    const start = Number(block.range.startOffset);
    const end = Number(block.range.endOffset);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return { startOffset: start, endOffset: end };
    }
  }
  const start = Number(block.startOffset);
  const end = Number(block.endOffset);
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
    return { startOffset: start, endOffset: end };
  }
  return { startOffset: fallbackStart, endOffset: fallbackEnd };
}

function buildEntriesFromText(sourceText, sourceId) {
  const text = String(sourceText || '');
  if (!text) return [];

  const lines = text.split(/\r?\n/u);
  const entries = [];
  let buffer = [];
  let bufferStart = 0;
  let cursor = 0;
  let ordinal = 0;

  function flushParagraph(endOffset) {
    if (buffer.length === 0) return;
    const paragraphText = buffer.join('\n');
    entries.push({
      id: createEntryId(sourceId, ordinal, 'paragraph'),
      ordinal,
      kind: 'paragraph',
      text: paragraphText,
      sourceId,
      sourceRange: {
        startOffset: bufferStart,
        endOffset,
      },
    });
    ordinal += 1;
    buffer = [];
  }

  for (const line of lines) {
    const lineLength = line.length;
    const lineStart = cursor;
    const lineEnd = cursor + lineLength;
    const trimmed = line.trim();

    if (trimmed === PAGE_BREAK_TOKEN_V1) {
      flushParagraph(lineStart);
      entries.push({
        id: createEntryId(sourceId, ordinal, 'pageBreak'),
        ordinal,
        kind: 'pageBreak',
        token: PAGE_BREAK_TOKEN_V1,
        text: PAGE_BREAK_TOKEN_V1,
        sourceId,
        sourceRange: {
          startOffset: lineStart,
          endOffset: lineEnd,
        },
      });
      ordinal += 1;
      bufferStart = lineEnd + 1;
      cursor = lineEnd + 1;
      continue;
    }

    if (!trimmed) {
      flushParagraph(lineStart);
      bufferStart = lineEnd + 1;
      cursor = lineEnd + 1;
      continue;
    }

    if (buffer.length === 0) {
      bufferStart = lineStart;
    }
    buffer.push(line);
    cursor = lineEnd + 1;
  }

  flushParagraph(text.length);
  return entries;
}

function buildEntriesFromBlocks(blocks, sourceId) {
  const entries = [];
  let ordinal = 0;

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    const text = normalizeBlockText(block);
    const kind = normalizeKind(isPlainObject(block) ? block.kind : '');
    if (kind === 'pageBreak' && text.trim() !== PAGE_BREAK_TOKEN_V1) {
      throw new Error('E_SEMANTIC_MAPPING_PAGE_BREAK_TOKEN_REQUIRED');
    }

    const fallbackStart = i;
    const fallbackEnd = i + Math.max(text.length, 1);
    const sourceRange = normalizeExplicitRange(block, fallbackStart, fallbackEnd);
    entries.push({
      id: createEntryId(sourceId, ordinal, kind),
      ordinal,
      kind,
      text: kind === 'pageBreak' ? PAGE_BREAK_TOKEN_V1 : text,
      sourceId,
      token: kind === 'pageBreak' ? PAGE_BREAK_TOKEN_V1 : undefined,
      sourceRange,
    });
    ordinal += 1;
  }

  return entries;
}

export function mapSemanticEntries(input = {}) {
  const sourceId = normalizeString(input.sourceId) || normalizeString(input.id) || 'source';
  const blocks = Array.isArray(input.blocks) ? input.blocks : null;
  const text = typeof input.text === 'string' ? input.text : '';

  if (blocks) {
    return {
      schemaVersion: SEMANTIC_MAPPING_SCHEMA_VERSION,
      sourceId,
      entries: buildEntriesFromBlocks(blocks, sourceId),
    };
  }

  return {
    schemaVersion: SEMANTIC_MAPPING_SCHEMA_VERSION,
    sourceId,
    entries: buildEntriesFromText(text, sourceId),
  };
}

export { PAGE_BREAK_TOKEN_V1, SEMANTIC_MAPPING_SCHEMA_VERSION };
