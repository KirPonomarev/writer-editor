'use strict';

// Pure canonical document envelope; renderer consumes the same read-only API.
const DEFAULT_META = Object.freeze({
  synopsis: '',
  status: 'черновик',
  tags: Object.freeze({ pov: '', line: '', place: '' }),
});

const DOC_V2_HEADER_PATTERN = /^\[doc-v2 length=(\d+)\]/i;
const DOC_V2_ALLOWED_BLOCK_TYPES = new Set(['doc', 'paragraph', 'heading', 'text', 'hardBreak']);
const SCENE_DOCUMENT_V3_DECLARATION = '{"format":"yalken.scene-document","version":3,"requiredFeatures":["word-user-bookmarks.v1"]}';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultDocumentMeta() {
  return {
    synopsis: DEFAULT_META.synopsis,
    status: DEFAULT_META.status,
    tags: { ...DEFAULT_META.tags },
  };
}

function normalizeDocumentLineEndings(value = '') {
  return String(value ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

function trimLegacyTextContent(value = '') {
  return normalizeDocumentLineEndings(value)
    .replace(/\n{3,}/gu, '\n\n')
    .replace(/^\n+/u, '')
    .replace(/\n+$/u, '');
}

function buildParagraphDocumentFromText(text = '') {
  const lines = normalizeDocumentLineEndings(text).split('\n');
  const content = lines.map((line) => {
    if (!line) {
      return { type: 'paragraph' };
    }
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    };
  });

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  };
}

function parseIndentedValue(lines, startIndex) {
  const valueLines = [];
  const firstLine = lines[startIndex];
  const rawValue = firstLine.split(':').slice(1).join(':').trim();
  valueLines.push(rawValue);
  let index = startIndex + 1;
  while (index < lines.length) {
    const line = lines[index];
    if (/^[a-zA-Zа-яА-ЯёЁ]+\s*:/u.test(line)) {
      break;
    }
    if (line.startsWith('  ') || line.startsWith('\t')) {
      valueLines.push(line.trim());
    }
    index += 1;
  }
  return { value: valueLines.join('\n').trim(), nextIndex: index };
}

function parseTagsValue(value) {
  const tags = { pov: '', line: '', place: '' };
  String(value || '')
    .split(';')
    .forEach((chunk) => {
      const [rawKey, ...rest] = chunk.split('=');
      const key = (rawKey || '').trim().toLowerCase();
      const val = rest.join('=').trim();
      if (key === 'pov') tags.pov = val;
      if (key === 'линия') tags.line = val;
      if (key === 'место') tags.place = val;
    });
  return tags;
}

function parseMetaBlock(block) {
  const meta = createDefaultDocumentMeta();
  const lines = normalizeDocumentLineEndings(String(block || ''))
    .replace(/\[\/?meta\]/giu, '')
    .split('\n')
    .map((line) => line.trimEnd());

  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    if (line.startsWith('status:')) {
      meta.status = line.split(':').slice(1).join(':').trim() || meta.status;
      index += 1;
      continue;
    }
    if (line.startsWith('tags:')) {
      meta.tags = parseTagsValue(line.split(':').slice(1).join(':').trim());
      index += 1;
      continue;
    }
    if (line.startsWith('synopsis:')) {
      const parsed = parseIndentedValue(lines, index);
      meta.synopsis = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    index += 1;
  }

  return meta;
}

function parseCardBlock(block) {
  const card = { title: '', text: '', tags: '' };
  const lines = normalizeDocumentLineEndings(String(block || ''))
    .replace(/\[\/?card\]/giu, '')
    .split('\n')
    .map((line) => line.trimEnd());

  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    if (line.startsWith('title:')) {
      card.title = line.split(':').slice(1).join(':').trim();
      index += 1;
      continue;
    }
    if (line.startsWith('text:')) {
      const parsed = parseIndentedValue(lines, index);
      card.text = parsed.value;
      index = parsed.nextIndex;
      continue;
    }
    if (line.startsWith('tags:')) {
      card.tags = line.split(':').slice(1).join(':').trim();
      index += 1;
      continue;
    }
    index += 1;
  }

  return card;
}

function parseCardsBlock(block) {
  const cards = [];
  const body = normalizeDocumentLineEndings(String(block || '')).replace(/\[\/?cards\]/giu, '').trim();
  const regex = /\[card\][\s\S]*?\[\/card\]/giu;
  let match = regex.exec(body);
  while (match) {
    cards.push(parseCardBlock(match[0]));
    match = regex.exec(body);
  }
  return cards;
}

function composeMetaBlock(metaEnabled, meta) {
  if (!metaEnabled) return '';

  const safeMeta = isPlainObject(meta) ? meta : createDefaultDocumentMeta();
  const safeTags = isPlainObject(safeMeta.tags) ? safeMeta.tags : createDefaultDocumentMeta().tags;
  const lines = ['[meta]'];
  lines.push(`status: ${safeMeta.status || 'черновик'}`);
  lines.push(`tags: POV=${safeTags.pov || ''}; линия=${safeTags.line || ''}; место=${safeTags.place || ''}`);

  const synopsisLines = normalizeDocumentLineEndings(String(safeMeta.synopsis || '')).split('\n');
  if (synopsisLines.length > 0) {
    lines.push(`synopsis: ${synopsisLines[0] || ''}`);
    for (let index = 1; index < synopsisLines.length; index += 1) {
      lines.push(`  ${synopsisLines[index]}`);
    }
  } else {
    lines.push('synopsis:');
  }

  lines.push('[/meta]');
  return lines.join('\n');
}

function composeCardsBlock(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return '';

  const lines = ['[cards]'];
  cards.forEach((card) => {
    lines.push('[card]');
    lines.push(`title: ${card?.title || ''}`);
    const textLines = normalizeDocumentLineEndings(String(card?.text || '')).split('\n');
    lines.push(`text: ${textLines[0] || ''}`);
    for (let index = 1; index < textLines.length; index += 1) {
      lines.push(`  ${textLines[index]}`);
    }
    lines.push(`tags: ${card?.tags || ''}`);
    lines.push('[/card]');
  });
  lines.push('[/cards]');
  return lines.join('\n');
}

function canonicalizeJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item));
  }
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalizeJsonValue(value[key]);
        return acc;
      }, {});
  }
  return value;
}

// Keep the N-1 absent-feature path usable by isolated older consumers. Detect
// presence from raw data descriptors before loading the feature validator.
function documentHasWordLanguage(doc) {
  const stack = [{ node: doc }], ancestors = new Set(); let count = 0;
  const data = (object, key) => {
    const d = Object.getOwnPropertyDescriptor(object, key);
    if (d && !Object.hasOwn(d, 'value')) throw Error('WORD_LANGUAGE_INVALID');
    return d?.value;
  };
  while (stack.length) {
    const { node, exit } = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (exit) { ancestors.delete(node); continue; }
    if (++count > 200000 || ancestors.has(node)) throw Error('WORD_LANGUAGE_INVALID');
    ancestors.add(node); stack.push({ node, exit: true });
    const attrs = data(node, 'attrs');
    if (attrs && typeof attrs === 'object'
      && ['wordLanguage', 'wordParagraphMarkLanguage'].some(key => data(attrs, key) != null)) return true;
    for (const key of ['content', 'marks']) { const children = data(node, key); if (Array.isArray(children)) for (const child of children) stack.push({ node: child }); }
  }
  return false;
}

function documentHasParagraphSpacing(doc, layoutKeys = ['wordParagraphSpacing']) {
  const pending = [{ node: doc }], ancestors = new Set(); let count = 0;
  const own = (value, key) => {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (d && (!d.enumerable || !Object.hasOwn(d, 'value'))) throw Error('WORD_PARAGRAPH_SPACING_INVALID');
    return d?.value;
  };
  while (pending.length) {
    const { node, exit } = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (exit) { ancestors.delete(node); continue; }
    if (++count > 200000 || ancestors.has(node)) throw Error('WORD_PARAGRAPH_SPACING_INVALID');
    ancestors.add(node); pending.push({ node, exit: true });
    const attrs = own(node, 'attrs');
    if (attrs && typeof attrs === 'object' && layoutKeys.some(key => own(attrs, key) != null)) return true;
    for (const key of ['content', 'marks']) {
      const children = own(node, key);
      if (Array.isArray(children)) for (let i = 0; i < children.length; i++) pending.push({ node: own(children, String(i)) });
    }
  }
  return false;
}

function canonicalizeDocumentJson(doc) {
  if (!isPlainObject(doc)) {
    return buildParagraphDocumentFromText('');
  }
  // Optional domain state is validated raw before JSON normalization. Keep the
  // absent/null historical path dependency-identical for isolated sandboxes.
  const attrsDescriptor = Object.getOwnPropertyDescriptor(doc, 'attrs');
  const bookmarkDescriptor = attrsDescriptor?.value
    && Object.getOwnPropertyDescriptor(attrsDescriptor.value, 'wordUserBookmarks');
  if ((attrsDescriptor && !Object.hasOwn(attrsDescriptor, 'value'))
    || (bookmarkDescriptor && !Object.hasOwn(bookmarkDescriptor, 'value'))) {
    throw Object.assign(new Error('USER_BOOKMARK_SHAPE_INVALID'), { code: 'USER_BOOKMARK_SHAPE_INVALID' });
  }
  if (documentHasWordLanguage(doc)) require('./word-language-v1.cjs').inspectDocumentLanguage(doc);
  if (documentHasParagraphSpacing(doc, ['wordParagraphIndent','wordParagraphTabs','wordDefaultTabStop'])) require('./word-paragraph-layout-v1.cjs').inspectDocumentParagraphLayout(doc);
  if (documentHasParagraphSpacing(doc)) require('./word-paragraph-spacing-v1.cjs').inspectDocumentParagraphSpacing(doc);
  if (bookmarkDescriptor?.value != null) {
    require('./word-user-bookmarks-v1.cjs').readRegistry(doc, { checkBounds: false });
  }
  const storyDescriptor = attrsDescriptor?.value && Object.getOwnPropertyDescriptor(attrsDescriptor.value, 'wordStories');
  if (storyDescriptor && (!Object.hasOwn(storyDescriptor, 'value') || storyDescriptor.value != null)) require('./word-stories-projection-v1.cjs').readProjection(doc);
  const sectionDescriptor = attrsDescriptor?.value && Object.getOwnPropertyDescriptor(attrsDescriptor.value, 'wordSections');
  if (sectionDescriptor && (!Object.hasOwn(sectionDescriptor, 'value') || sectionDescriptor.value != null)) require('./word-sections-v1.cjs').read(doc);
  require('./word-pending-text-revisions-v1.cjs').readLedger(doc);
  require('./word-list-format-v1.cjs').inspectDocument(doc);
  require('./word-list-numbering-v1.cjs').resolve(doc);
  const breakNodes = [doc];
  while (breakNodes.length) {
    const node = breakNodes.pop();
    if (node?.attrs && Object.hasOwn(node.attrs, 'wordBreakType')) require('./word-typed-breaks-v1.cjs').kind(node);
    if (Array.isArray(node?.content)) for (const child of node.content) breakNodes.push(child);
  }
  const copied = cloneJsonValue(doc);
  if (copied.attrs?.wordStories === null) delete copied.attrs.wordStories;
  if (copied.attrs?.wordSections === null) delete copied.attrs.wordSections;
  require('./word-list-numbering-v1.cjs').normalize(copied);
  const pending = [copied];
  while (pending.length) {
    const node = pending.pop();
    // New optional schema defaults are representation-only; preserve every
    // explicit tuple, including its separate paragraph-mark scope.
    if (node?.attrs?.wordParagraphMarkLanguage === null) delete node.attrs.wordParagraphMarkLanguage;
    for (const key of ['wordParagraphIndent','wordParagraphTabs','wordDefaultTabStop']) if (node?.attrs?.[key] === null) delete node.attrs[key];
    if (node?.attrs?.wordParagraphSpacing === null) delete node.attrs.wordParagraphSpacing;
    for (const mark of node?.marks || []) if (mark?.attrs?.wordLanguage === null) delete mark.attrs.wordLanguage;
    if (node?.type === 'orderedList' && node.attrs?.type === null) delete node.attrs.type;
    if (node?.attrs?.wordListId === null) delete node.attrs.wordListId;
    if (node?.attrs?.wordListStart === null) delete node.attrs.wordListStart;
    if (node?.attrs?.wordNumbering === null) delete node.attrs.wordNumbering;
    if (node?.type === 'hardBreak' && node.attrs?.wordBreakType === null) {
      delete node.attrs.wordBreakType;
      if (!Object.keys(node.attrs).length) delete node.attrs;
    }
    if (node?.type === 'table') require('../io/documentTables.js').inspectTable(node);
    if (Array.isArray(node?.content)) for (const child of node.content) pending.push(child);
  }
  return canonicalizeJsonValue(copied);
}

function serializeDocumentJson(doc) {
  return JSON.stringify(canonicalizeDocumentJson(doc), null, 2);
}

// Retain the readable rich JSON and existing length frame. A separate feature
// declaration deliberately prevents older single-JSON readers from accepting
// a scene whose semantic registry they cannot preserve.
function documentHasTypedBreaks(doc) {
  const nodes = [doc];
  while (nodes.length) {
    const node = nodes.pop();
    if (node?.type === 'hardBreak' && node.attrs?.wordBreakType != null) return true;
    for (const child of node?.content || []) nodes.push(child);
  }
  return false;
}
function requiredSceneFeatures(doc) {
  return [...(doc.attrs?.wordStories != null ? ['word-stories.v1'] : []), ...(doc.attrs?.wordSections != null ? ['word-sections.v1'] : []),
    ...([doc.attrs?.wordSections?.final, ...(doc.attrs?.wordSections?.boundaries || []).map(item=>item.properties)].some(properties=>properties?.docGrid != null) ? ['word-section-doc-grid.v1'] : []), ...(doc.attrs?.wordUserBookmarks != null ? ['word-user-bookmarks.v1'] : []),
    ...(doc.attrs?.wordPendingRevisions?.schemaVersion === 3 ? ['word-pending-note-points.v1'] : []),
    ...(documentHasWordLanguage(doc) ? ['word-language.v1'] : []),
    ...(documentHasParagraphSpacing(doc, ['wordParagraphIndent','wordParagraphTabs','wordDefaultTabStop']) ? ['word-paragraph-layout.v1'] : []),
    ...(documentHasParagraphSpacing(doc) ? ['word-paragraph-spacing.v1'] : []),
    ...(require('./word-list-format-v1.cjs').inspectDocument(doc) ? ['word-list-format.v1'] : []),
    ...(require('./word-list-numbering-v1.cjs').resolve(doc).size ? ['word-list-numbering.v1'] : []),
    ...(require('./word-list-numbering-v1.cjs').resolveMarkers(doc).size ? ['word-list-pattern.v1'] : []),
    ...(documentHasTypedBreaks(doc) ? ['word-typed-breaks.v1'] : [])];
}
function encodeSceneDocument(doc) {
  const json = serializeDocumentJson(doc), requiredFeatures = requiredSceneFeatures(doc);
  return requiredFeatures.length ? `${JSON.stringify({ format: 'yalken.scene-document', version: 3, requiredFeatures })}\n${json}` : json;
}

function decodeSceneDocument(serializedDoc) {
  const fail = code => { throw Object.assign(new Error(code), { code }); };
  const isDeclaration = value => isPlainObject(value) && ['format', 'version', 'requiredFeatures']
    .some(key => Object.hasOwn(value, key));
  const newline = serializedDoc.indexOf('\n');
  const firstLine = newline < 0 ? serializedDoc : serializedDoc.slice(0, newline);
  let declaration;
  try { declaration = JSON.parse(firstLine); } catch { declaration = null; }
  const declared = isDeclaration(declaration);
  if (!declared) {
    const rawDoc = JSON.parse(serializedDoc);
    // A pretty or single-record declaration is not a legacy document. Never
    // let canonicalizeDocumentJson turn an unsupported header into blank text.
    if (isDeclaration(rawDoc)) {
      if (rawDoc.format !== 'yalken.scene-document' || rawDoc.version !== 3) fail('DOC_BLOCK_FORMAT_UNSUPPORTED');
      fail('DOC_BLOCK_FORMAT_DECLARATION_INVALID');
    }
    if (!isPlainObject(rawDoc) || rawDoc.type !== 'doc' || !Array.isArray(rawDoc.content)) fail('DOC_BLOCK_DOCUMENT_INVALID');
    if (requiredSceneFeatures(rawDoc).length) {
      if (rawDoc.attrs?.wordUserBookmarks != null) require('./word-user-bookmarks-v1.cjs').readRegistry(rawDoc, { checkBounds: false });
      fail('DOC_BLOCK_REQUIRED_DECLARATION_MISSING');
    }
    return { doc: canonicalizeDocumentJson(rawDoc), payloadVersion: 2 };
  }
  if (Object.keys(declaration).sort().join(',') !== 'format,requiredFeatures,version') fail('DOC_BLOCK_FORMAT_DECLARATION_INVALID');
  if (declaration.format !== 'yalken.scene-document' || declaration.version !== 3) fail('DOC_BLOCK_FORMAT_UNSUPPORTED');
  if (!Array.isArray(declaration.requiredFeatures) || !declaration.requiredFeatures.length
    || declaration.requiredFeatures.length > 12 || declaration.requiredFeatures.some(feature =>
      !['word-stories.v1', 'word-sections.v1', 'word-section-doc-grid.v1', 'word-user-bookmarks.v1', 'word-pending-note-points.v1', 'word-language.v1', 'word-paragraph-spacing.v1', 'word-paragraph-layout.v1', 'word-list-format.v1', 'word-list-numbering.v1', 'word-list-pattern.v1', 'word-typed-breaks.v1'].includes(feature))) fail('DOC_BLOCK_REQUIRED_FEATURES_UNSUPPORTED');
  if (newline < 0 || firstLine !== JSON.stringify({ format: 'yalken.scene-document', version: 3, requiredFeatures: declaration.requiredFeatures }))
    fail('DOC_BLOCK_FORMAT_DECLARATION_INVALID');
  const rawDoc = JSON.parse(serializedDoc.slice(newline + 1));
  if (!isPlainObject(rawDoc) || rawDoc.type !== 'doc' || !Array.isArray(rawDoc.content)
    || JSON.stringify(requiredSceneFeatures(rawDoc)) !== JSON.stringify(declaration.requiredFeatures)) fail('DOC_BLOCK_REQUIRED_FEATURE_MISSING');
  const expected = JSON.stringify({ format: 'yalken.scene-document', version: 3, requiredFeatures: requiredSceneFeatures(rawDoc) });
  if (firstLine !== expected || newline < 0) fail('DOC_BLOCK_FORMAT_DECLARATION_INVALID');
  if (rawDoc.attrs?.wordUserBookmarks != null) require('./word-user-bookmarks-v1.cjs').readRegistry(rawDoc, { checkBounds: false });
  return { doc: canonicalizeDocumentJson(rawDoc), payloadVersion: 3 };
}

function createDocumentPayloadIssue(code, reason, userMessage, details = {}) {
  return {
    code,
    reason,
    userMessage,
    details: isPlainObject(details) ? details : {},
  };
}

function extractDocBlock(rawContent) {
  const content = normalizeDocumentLineEndings(rawContent);
  const metaPrefixMatch = content.match(/^\[meta\][\s\S]*?\[\/meta\](?:\n{1,2})?/iu);
  const searchOffset = metaPrefixMatch ? metaPrefixMatch[0].length : 0;
  const docCandidate = content.slice(searchOffset);
  const match = DOC_V2_HEADER_PATTERN.exec(docCandidate);
  if (!match) {
    return {
      found: false,
      doc: null,
      restContent: content,
      issue: null,
    };
  }

  const length = Number.parseInt(match[1], 10);
  if (!Number.isInteger(length) || length < 0) {
    return {
      found: true,
      doc: null,
      restContent: content,
      issue: createDocumentPayloadIssue(
        'E_DOC_PAYLOAD_INVALID',
        'DOC_BLOCK_LENGTH_INVALID',
        'Document payload header is invalid.',
        { header: match[0] },
      ),
    };
  }

  const headerStart = searchOffset + match.index;
  const headerEnd = headerStart + match[0].length;
  const newlineOffset = content.startsWith('\n', headerEnd) ? 1 : 0;
  const docStart = headerEnd + newlineOffset;
  const docEnd = docStart + length;

  if (docEnd > content.length) {
    return {
      found: true,
      doc: null,
      restContent: content.slice(0, headerStart),
      issue: createDocumentPayloadIssue(
        'E_DOC_PAYLOAD_INVALID',
        'DOC_BLOCK_TRUNCATED',
        'Document payload is truncated.',
        { expectedLength: length, availableLength: Math.max(0, content.length - docStart) },
      ),
    };
  }

  const serializedDoc = content.slice(docStart, docEnd);
  const restContent = `${content.slice(0, headerStart)}${content.slice(docEnd)}`;
  try {
    const decoded = decodeSceneDocument(serializedDoc);
    return {
      found: true,
      doc: decoded.doc,
      payloadVersion: decoded.payloadVersion,
      restContent,
      issue: null,
    };
  } catch (error) {
    return {
      found: true,
      doc: null,
      restContent,
      issue: createDocumentPayloadIssue(
        'E_DOC_PAYLOAD_INVALID',
        error?.code?.startsWith('DOC_BLOCK_') ? error.code : 'DOC_BLOCK_JSON_INVALID',
        'Document payload JSON is invalid.',
        { message: error && typeof error.message === 'string' ? error.message : 'UNKNOWN' },
      ),
    };
  }
}

function deriveInlineText(node) {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') {
    return typeof node.text === 'string' ? node.text : '';
  }
  if (node.type === 'hardBreak') {
    return '\n';
  }
  if (!Array.isArray(node.content)) return '';
  return node.content.map((child) => deriveInlineText(child)).join('');
}

function deriveVisibleTextFromDocument(doc) {
  if (!isPlainObject(doc) || !Array.isArray(doc.content)) {
    return '';
  }

  const blocks = [];
  const visitBlock = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'codeBlock') {
      blocks.push(deriveInlineText(node));
      return;
    }
    if (node.type === 'horizontalRule') {
      blocks.push('');
      return;
    }
    if (node.type === 'text') {
      blocks.push(typeof node.text === 'string' ? node.text : '');
      return;
    }
    if (Array.isArray(node.content) && node.content.length > 0) {
      const childBlocksBefore = blocks.length;
      node.content.forEach((child) => visitBlock(child));
      if (blocks.length === childBlocksBefore) {
        blocks.push(deriveInlineText(node));
      }
      return;
    }
    if (node.type === 'hardBreak') {
      blocks.push('');
    }
  };

  doc.content.forEach((node) => visitBlock(node));
  return trimLegacyTextContent(blocks.join('\n'));
}

function analyzeDocumentPlainTextRoundTrip(doc) {
  const unsupportedNodeTypes = new Set();
  let markedTextPresent = false;
  let attributedNodePresent = false;
  let invalidHeadingAttrsPresent = false;

  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    const nodeType = typeof node.type === 'string' ? node.type : '';
    if (!DOC_V2_ALLOWED_BLOCK_TYPES.has(nodeType)) {
      unsupportedNodeTypes.add(nodeType || 'unknown');
    }
    if (Array.isArray(node.marks) && node.marks.length > 0) {
      markedTextPresent = true;
    }
    if (isPlainObject(node.attrs) && Object.keys(node.attrs).length > 0) {
      if (nodeType === 'heading') {
        const attrKeys = Object.keys(node.attrs);
        const level = Number(node.attrs.level);
        const validHeadingLevel = Number.isSafeInteger(level) && level >= 1 && level <= 6;
        const unknownHeadingAttrs = attrKeys.filter((key) => key !== 'level');
        if (!validHeadingLevel || unknownHeadingAttrs.length > 0) {
          invalidHeadingAttrsPresent = true;
        }
      } else {
        attributedNodePresent = true;
      }
    }
    if (Array.isArray(node.content)) {
      node.content.forEach((child) => visit(child));
    }
  };

  visit(doc);

  return {
    safe: unsupportedNodeTypes.size === 0
      && markedTextPresent === false
      && attributedNodePresent === false
      && invalidHeadingAttrsPresent === false,
    unsupportedNodeTypes: [...unsupportedNodeTypes].sort(),
    markedTextPresent,
    attributedNodePresent,
    invalidHeadingAttrsPresent,
  };
}

function parseObservablePayload(rawText = '') {
  const normalizedRaw = normalizeDocumentLineEndings(rawText);
  const docBlock = extractDocBlock(normalizedRaw);
  let content = docBlock.restContent;
  let meta = createDefaultDocumentMeta();
  let cards = [];
  let hasMetaBlock = false;
  let hasCardsBlock = false;

  const metaMatch = content.match(/\[meta\][\s\S]*?\[\/meta\]/iu);
  if (metaMatch) {
    meta = parseMetaBlock(metaMatch[0]);
    content = content.replace(metaMatch[0], '');
    hasMetaBlock = true;
  }

  const cardsMatch = content.match(/\[cards\][\s\S]*?\[\/cards\]/iu);
  if (cardsMatch) {
    cards = parseCardsBlock(cardsMatch[0]);
    content = content.replace(cardsMatch[0], '');
    hasCardsBlock = true;
  }

  const legacyText = trimLegacyTextContent(content);
  let issue = docBlock.issue;
  if (!issue && docBlock.doc && legacyText.length > 0) {
    issue = createDocumentPayloadIssue(
      'E_DOC_PAYLOAD_INVALID',
      'DOC_BLOCK_LEGACY_TEXT_CONFLICT',
      'Document payload contains conflicting plain text outside the rich document block.',
      { legacyTextLength: legacyText.length },
    );
  }

  return {
    version: docBlock.doc ? 2 : 1,
    payloadVersion: docBlock.doc ? docBlock.payloadVersion : 1,
    text: docBlock.doc ? deriveVisibleTextFromDocument(docBlock.doc) : legacyText,
    doc: docBlock.doc,
    meta,
    cards,
    issue,
    hasMetaBlock,
    hasCardsBlock,
  };
}

function composeObservablePayload({
  doc = null,
  text = '',
  metaEnabled = false,
  meta = createDefaultDocumentMeta(),
  cards = [],
} = {}) {
  const parts = [];
  const metaBlock = composeMetaBlock(metaEnabled, meta);
  if (metaBlock) {
    parts.push(metaBlock);
  }

  if (isPlainObject(doc)) {
    const serializedDoc = encodeSceneDocument(doc);
    parts.push(`[doc-v2 length=${serializedDoc.length}]\n${serializedDoc}`);
  } else {
    const legacyText = trimLegacyTextContent(text);
    if (legacyText) {
      parts.push(legacyText);
    }
  }

  const cardsBlock = composeCardsBlock(cards);
  if (cardsBlock) {
    parts.push(cardsBlock);
  }

  return parts.filter(Boolean).join('\n\n');
}

function composeDocumentContentFromBase({
  baseContent = '',
  nextVisibleText = '',
  metaEnabled = null,
} = {}) {
  const parsed = parseObservablePayload(baseContent);
  const normalizedNextVisibleText = trimLegacyTextContent(nextVisibleText);
  const metaEnabledValue = metaEnabled === null ? parsed.hasMetaBlock : Boolean(metaEnabled);

  if (parsed.doc) {
    const analysis = analyzeDocumentPlainTextRoundTrip(parsed.doc);
    const canonicalParsedDoc = serializeDocumentJson(parsed.doc);
    const canonicalParagraphDoc = serializeDocumentJson(buildParagraphDocumentFromText(parsed.text || ''));
    const matchesLegacyParagraphShape = canonicalParsedDoc === canonicalParagraphDoc;
    const unchangedVisibleText = normalizedNextVisibleText === trimLegacyTextContent(parsed.text || '');

    if (!analysis.safe) {
      return {
        ok: false,
        error: {
          code: 'M7_FLOW_SCENE_RICH_CONTENT_UNSUPPORTED',
          reason: 'flow_scene_rich_content_unsupported',
          details: analysis,
        },
      };
    }

    if (!matchesLegacyParagraphShape) {
      if (unchangedVisibleText) {
        return {
          ok: true,
          content: composeObservablePayload({
            doc: parsed.doc,
            metaEnabled: metaEnabledValue,
            meta: parsed.meta,
            cards: parsed.cards,
          }),
        };
      }

      return {
        ok: false,
        error: {
          code: 'M7_FLOW_SCENE_RICH_CONTENT_UNSUPPORTED',
          reason: 'flow_scene_rich_content_unsupported',
          details: {
            ...analysis,
            requiresStructuredDocPreservation: true,
          },
        },
      };
    }
  }

  return {
    ok: true,
    content: composeObservablePayload({
      doc: buildParagraphDocumentFromText(normalizedNextVisibleText),
      metaEnabled: metaEnabledValue,
      meta: parsed.meta,
      cards: parsed.cards,
    }),
  };
}

module.exports = { createDefaultDocumentMeta, normalizeDocumentLineEndings, buildParagraphDocumentFromText, composeMetaBlock, composeCardsBlock, canonicalizeDocumentJson, serializeDocumentJson, deriveVisibleTextFromDocument, analyzeDocumentPlainTextRoundTrip, parseObservablePayload, composeObservablePayload, composeDocumentContentFromBase };
