'use strict';

const commentRanges = require('../../core/word-comment-ranges-v1.cjs');
const commentBody = require('../../core/word-comment-body-v1.cjs');
const { buildDocxWordParagraphLayoutXml, buildDocxWordParagraphSpacingXml } = require('./docxPendingRevisions.js');
const { buildDocxWordLanguageXml } = require('./docxInlineTypography.js');
const crypto = require('node:crypto');
const { buildDocxRunContentXml, escapeXml, segmentDocxTextForSerialization } = require('./docxTextXml.js');

const COMMENT_EXPORT_SCHEMA = 'yalken.rtk.canonical-comment-export.v1';
const COMMENT_STATE_SCHEMA = 'yalken.rtk.word.non-text-return-state.v1';
const NS = Object.freeze({
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  w14: 'http://schemas.microsoft.com/office/word/2010/wordml',
  w15: 'http://schemas.microsoft.com/office/word/2012/wordml',
  w16cid: 'http://schemas.microsoft.com/office/word/2016/wordml/cid',
  w16cex: 'http://schemas.microsoft.com/office/word/2018/wordml/cex',
});
const PARTS = Object.freeze([
  ['comments.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments'],
  ['commentsExtended.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.commentsExtended+xml', 'http://schemas.microsoft.com/office/2011/relationships/commentsExtended'],
  ['commentsIds.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.commentsIds+xml', 'http://schemas.microsoft.com/office/2016/09/relationships/commentsIds'],
  ['commentsExtensible.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.commentsExtensible+xml', 'http://schemas.microsoft.com/office/2018/08/relationships/commentsExtensible'],
]);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' ? value : '';
const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]`
  : plain(value) ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const digest = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const demand = (ok, code) => { if (!ok) throw new Error(code); };

// Metadata is literal provenance, never an identity or an authorization signal.
// Omitting this optional object preserves v1 metadata-free operation digests.
function normalizeCommentProvenance(value) {
  if (value === undefined) return {};
  demand(plain(value), 'RTK_COMMENT_PROVENANCE_INVALID');
  const result = {};
  for (const [key, limit] of [['author', 1024], ['initials', 128], ['date', 128], ['dateUtc', 128]]) {
    if (!Object.hasOwn(value, key)) continue;
    demand(typeof value[key] === 'string' && Buffer.byteLength(value[key], 'utf8') <= limit, 'RTK_COMMENT_PROVENANCE_INVALID');
    segmentDocxTextForSerialization(value[key]);
    if (value[key]) result[key] = value[key];
  }
  return result;
}

// Transport representation only: an explicit UTC instant needs no timezone
// inference. Preserve canonical provenance, including its original precision.
function explicitUtcTransportDate(provenance) {
  const value = provenance.date;
  if (provenance.dateUtc || typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value)) return '';
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString().replace('.000Z', 'Z') !== value.replace('.000Z', 'Z')) return '';
  return value;
}

function commentStateDigest(state) { return digest(stable(state)); }

function isUtf16Boundary(value, offset) {
  return Number.isSafeInteger(offset) && offset >= 0 && offset <= value.length
    && !(offset > 0 && offset < value.length
      && /[\uD800-\uDBFF]/u.test(value[offset - 1]) && /[\uDC00-\uDFFF]/u.test(value[offset]));
}

function exactCommentAnchor(thread, blocks) {
  const anchor = plain(thread.anchor) ? thread.anchor : {};
  const selectedText = text(anchor.selectedText);
  demand(anchor.sceneId === thread.sceneId && (anchor.kind === 'point'
    ? anchor.affinity === 'right' && anchor.selectedText === '' && Number.isSafeInteger(anchor.startUtf16) : !!selectedText)
    && anchor.selectedTextSha256 === digest(selectedText), 'DOCX_COMMENT_ANCHOR_INVALID');
  const sceneBlocks = blocks.filter(block => block.sceneId === thread.sceneId);
  if (anchor.kind === 'multi-paragraph-range') {
    const rows = sceneBlocks.map(b => ({ text: b.text, ...(b.formatIr?.table ? {table:b.formatIr.table} : {}) }));
    const derived = commentRanges.validateCommentAnchor({ sceneId: thread.sceneId, paragraphs: rows, anchor });
    const first = sceneBlocks[derived.sceneParagraphIndex], last = sceneBlocks[derived.endSceneParagraphIndex];
    return { kind: derived.kind, blockId: first.blockId, endBlockId: last.blockId, sceneId: thread.sceneId,
      documentParagraphIndex: first.documentParagraphIndex, endDocumentParagraphIndex: last.documentParagraphIndex,
      startUtf16: derived.startUtf16, endUtf16: derived.endUtf16, selectedText: derived.selectedText,
      blockTextSha256: derived.blockTextSha256, endBlockTextSha256: derived.endBlockTextSha256,
      coveredParagraphsSha256: derived.coveredParagraphsSha256 };
  }
  let block;
  if (Number.isSafeInteger(anchor.sceneParagraphIndex) && anchor.blockTextSha256) {
    block = sceneBlocks[anchor.sceneParagraphIndex];
    demand(block && digest(block.text) === anchor.blockTextSha256, 'DOCX_COMMENT_ANCHOR_STALE');
  } else {
    // Legacy anchors can export only while their exact block identity survives.
    // Moving to another paragraph based only on a matching quote is forbidden.
    const matches = sceneBlocks.filter(item => item.blockId === anchor.blockId);
    demand(matches.length === 1, 'DOCX_COMMENT_ANCHOR_STALE');
    [block] = matches;
  }
  const start = Number.isSafeInteger(anchor.startUtf16) ? anchor.startUtf16 : block.text.indexOf(selectedText);
  const end = start + selectedText.length;
  demand(start >= 0 && block.text.slice(start, end) === selectedText, 'DOCX_COMMENT_ANCHOR_STALE');
  if (!Number.isSafeInteger(anchor.startUtf16)) {
    demand(block.text.indexOf(selectedText, start + 1) < 0, 'DOCX_COMMENT_ANCHOR_AMBIGUOUS');
  }
  demand(isUtf16Boundary(block.text, start) && isUtf16Boundary(block.text, end), 'DOCX_COMMENT_ANCHOR_UTF16_BOUNDARY');
  return { ...(anchor.kind === 'point' ? {kind: 'point', affinity: 'right'} : {}), blockId: block.blockId, sceneId: block.sceneId, documentParagraphIndex: block.documentParagraphIndex,
    startUtf16: start, endUtf16: end, selectedText };
}

function buildCanonicalCommentExport(state, blocks, projectId, options = {}) {
  demand(plain(options) && Object.keys(options).every(key => ['sceneId', 'exportTypography'].includes(key))
    && (!Object.hasOwn(options, 'sceneId') || (typeof options.sceneId === 'string' && options.sceneId.length > 0)),
  'DOCX_COMMENT_SCOPE_INVALID');
  const exportTypography = options.exportTypography;
  demand(exportTypography === undefined || (plain(exportTypography)
    && Object.keys(exportTypography).sort().join(',') === 'fontSize,schemaVersion'
    && exportTypography.schemaVersion === 'yalken.review-docx.typography-defaults.v1'
    && require('../../io/inlineTypography.cjs').normalizeFontSize(exportTypography.fontSize) === exportTypography.fontSize),
  'DOCX_COMMENT_EXPORT_TYPOGRAPHY_INVALID');
  if (state === undefined) return null;
  demand(plain(state) && [COMMENT_STATE_SCHEMA, commentBody.STATE_V2, commentBody.STATE_V3, commentBody.STATE_V4, commentBody.STATE_V5].includes(state.schemaVersion) && state.projectId === projectId
    && Number.isSafeInteger(state.revision) && state.revision >= 0
    && Array.isArray(state.threads) && Array.isArray(state.events), 'DOCX_COMMENT_STATE_INVALID');
  if (state.schemaVersion === commentBody.STATE_V5 || state.threads.some(thread => thread.anchorEditHistory?.some(entry => entry.schemaVersion === 2))) require('../../core/word-comment-authoring-v1.cjs').readState(JSON.stringify(state), projectId);
  const ids = new Set();
  const paraIds = new Set();
  const durableIds = new Set();
  const threads = [];
  const tombstones = [];
  let ordinal = 0;
  const reserve = (set, value) => {
    demand(value && !set.has(value), 'DOCX_COMMENT_IDENTITY_COLLISION');
    set.add(value); return value;
  };
  const wordId = (kind, id) => ((Number.parseInt(digest(`${kind}:${id}`).slice(0, 8), 16) & 0x7fffffff) || 1)
    .toString(16).toUpperCase().padStart(8, '0');
  // Validate every identity and literal message before scope selection. A
  // malformed sibling must not become acceptable just because it is omitted.
  const validated = state.threads.map(thread => {
    demand(plain(thread) && typeof thread.threadId === 'string' && typeof thread.sceneId === 'string'
      && ['open', 'resolved', 'deleted'].includes(thread.status), 'DOCX_COMMENT_THREAD_INVALID');
    reserve(ids, thread.threadId);
    demand(Array.isArray(thread.messages) && thread.messages.length > 0, 'DOCX_COMMENT_MESSAGES_REQUIRED');
    demand(thread.deletedMessages === undefined || Array.isArray(thread.deletedMessages), 'DOCX_COMMENT_STATE_INVALID');
    const sourceMessages = [...thread.messages, ...(thread.deletedMessages || [])];
    demand(sourceMessages.length <= 129, 'DOCX_COMMENT_STATE_INVALID');
    const allMessages = sourceMessages.map((message, index) => {
      demand(plain(message) && typeof message.commentId === 'string'
        && message.kind === (index === 0 ? 'root' : 'reply')
        && typeof message.body === 'string' && message.body.trim()
        && Buffer.byteLength(message.body, 'utf8') <= 16384, 'DOCX_COMMENT_MESSAGE_INVALID');
      segmentDocxTextForSerialization(message.body);
      const content = commentBody.validateCommentMessageContent(message);
      demand(!content.richBody || [commentBody.STATE_V2, commentBody.STATE_V3, commentBody.STATE_V4, commentBody.STATE_V5].includes(state.schemaVersion), 'COMMENT_RICH_STATE_VERSION_REQUIRED');
      reserve(ids, message.commentId);
      demand(!message.body.includes('\r'), 'DOCX_COMMENT_BODY_NON_CANONICAL_NEWLINE');
      const transportRichBody = exportTypography ? commentBody.commentBodyWithTypography(content, exportTypography) : null;
      const provenance = normalizeCommentProvenance(message.provenance);
      const transportDateUtc = explicitUtcTransportDate(provenance);
      return {
        canonicalCommentId: message.commentId, kind: message.kind, ...content,
        ...(transportRichBody ? {transportRichBody} : {}),
        provenance, ...(transportDateUtc ? { transportDateUtc } : {}),
        paraId: reserve(paraIds, wordId('comment-paragraph', message.commentId)),
        ...(content.richBody ? { precedingParaIds: content.richBody.document.content.slice(0,-1).map((_,i) => reserve(paraIds,wordId('comment-paragraph-'+i,message.commentId))) } : {}),
        durableId: reserve(durableIds, wordId('comment-durable', message.commentId)),
      };
    });
    const messages = allMessages.slice(0, thread.messages.length);
    const deletedMessages = allMessages.slice(thread.messages.length);
    demand(messages[0].canonicalCommentId === thread.rootCommentId, 'DOCX_COMMENT_ROOT_IDENTITY_INVALID');
    if (thread.status !== 'deleted') {
      demand(thread.deleted !== true, 'DOCX_COMMENT_STATE_INVALID');
      const anchor = plain(thread.anchor) ? thread.anchor : {};
      demand(anchor.kind !== 'point' || [commentBody.STATE_V3, commentBody.STATE_V4, commentBody.STATE_V5].includes(state.schemaVersion), 'COMMENT_POINT_STATE_VERSION_REQUIRED');
      demand(anchor.sceneId === thread.sceneId && (anchor.kind === 'point'
        ? anchor.affinity === 'right' && anchor.selectedText === '' && Number.isSafeInteger(anchor.startUtf16) : !!text(anchor.selectedText))
        && anchor.selectedTextSha256 === digest(anchor.selectedText), 'DOCX_COMMENT_ANCHOR_INVALID');
      demand(anchor.kind !== 'multi-paragraph-range' || [commentBody.STATE_V4, commentBody.STATE_V5].includes(state.schemaVersion), 'COMMENT_ANCHOR_STATE_VERSION_REQUIRED');
      segmentDocxTextForSerialization(anchor.selectedText);
    }
    return { thread, allMessages, messages, deletedMessages };
  });
  for (const { thread, allMessages, messages, deletedMessages } of validated) {
    if (options.sceneId !== undefined && thread.sceneId !== options.sceneId) continue;
    // Transport ordinals reveal no excluded sibling count or ordering.
    for (const message of allMessages) message.commentId = String(ordinal++);
    if (thread.status === 'deleted') {
      tombstones.push({ threadId: thread.threadId, sceneId: thread.sceneId, status: 'deleted',
        messageIds: allMessages.map(message => message.canonicalCommentId),
        messageDurableIds: allMessages.map(message => message.durableId),
        outcome: 'CANONICAL_DELETION_NOT_EXPORTED', threadDigest: digest(stable(thread)) });
      continue;
    }
    if (deletedMessages.length) tombstones.push({ threadId: thread.threadId, sceneId: thread.sceneId,
      status: 'deleted-replies', messageIds: deletedMessages.map(m => m.canonicalCommentId),
      messageDurableIds: deletedMessages.map(m => m.durableId), outcome: 'CANONICAL_DELETION_NOT_EXPORTED',
      threadDigest: digest(stable(thread)) });
    threads.push({ threadId: thread.threadId, sceneId: thread.sceneId, status: thread.status,
      anchor: exactCommentAnchor(thread, blocks), messages });
  }
  return { schemaVersion: COMMENT_EXPORT_SCHEMA, projectId, stateRevision: state.revision,
    stateDigest: commentStateDigest(state), threads, tombstones };
}

const xmlAttribute = value => escapeXml(value).replaceAll('\t', '&#9;').replaceAll('\n', '&#10;').replaceAll('\r', '&#13;');
function commentPackageParts(projection) {
  if (!projection || projection.threads.length === 0) return { entries: [], contentTypes: '', relationships: '' };
  demand(projection.schemaVersion === COMMENT_EXPORT_SCHEMA, 'DOCX_COMMENT_EXPORT_SCHEMA_INVALID');
  const comments = [], extended = [], ids = [], extensible = [], links = new Map();
  for (const thread of projection.threads) {
    for (const message of thread.messages) {
      const { author = '', initials = '', date = '', dateUtc = message.transportDateUtc || '' } = message.provenance;
      const content = commentBody.validateCommentMessageContent(message);
      const paragraphs = content.richBody ? content.richBody.document.content.map((p,index,array) => {
        const id = index === array.length - 1 ? message.paraId : message.precedingParaIds[index];
        demand(/^[A-F0-9]{8}$/u.test(id), 'DOCX_COMMENT_PARAGRAPH_ID_INVALID');
        const align = p.attrs?.textAlign;
        const lang = buildDocxWordLanguageXml(p.attrs?.wordParagraphMarkLanguage);
        const props = (align ? `<w:jc w:val="${align === 'justify' ? 'both' : align}"/>` : '')
          + buildDocxWordParagraphSpacingXml(p.attrs?.wordParagraphSpacing)
          + buildDocxWordParagraphLayoutXml(p.attrs) + (lang ? `<w:rPr>${lang}</w:rPr>` : '');
        const runs = (p.content || []).map(node => {
          const run = node.type === 'hardBreak' ? {type:'text',text:'\n',...(node.marks ? {marks:node.marks} : {})} : node;
          const xml = require('./docxMinBuilder.js').buildDocxMarkedRunXml(run, true, true);
          const href = node.marks?.find(m => m.type === 'link')?.attrs?.href;
          if (!href) return xml;
          if (!links.has(href)) links.set(href, `commentLink${links.size + 1}`);
          return `<w:hyperlink r:id="${links.get(href)}">${xml}</w:hyperlink>`;
        }).join('');
        return `<w:p w14:paraId="${id}">${props ? `<w:pPr>${props}</w:pPr>` : ''}${runs}</w:p>`;
      }).join('') : `<w:p w14:paraId="${message.paraId}"><w:r>${buildDocxRunContentXml(message.body)}</w:r></w:p>`;
      comments.push(`<w:comment w:id="${message.commentId}" w:author="${xmlAttribute(author)}"${initials ? ` w:initials="${xmlAttribute(initials)}"` : ''}${date ? ` w:date="${xmlAttribute(date)}"` : ''}>${paragraphs}</w:comment>`);
      extended.push(`<w15:commentEx w15:paraId="${message.paraId}"${message.kind === 'reply' ? ` w15:paraIdParent="${thread.messages[0].paraId}"` : ''} w15:done="${thread.status === 'resolved' ? 1 : 0}"/>`);
      ids.push(`<w16cid:commentId w16cid:paraId="${message.paraId}" w16cid:durableId="${message.durableId}"/>`);
      extensible.push(`<w16cex:commentExtensible w16cex:durableId="${message.durableId}"${dateUtc ? ` w16cex:dateUtc="${xmlAttribute(dateUtc)}"` : ''}/>`);
    }
  }
  const xml = [
    `<w:comments xmlns:w="${NS.w}" xmlns:w14="${NS.w14}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${comments.join('')}</w:comments>`,
    `<w15:commentsEx xmlns:w15="${NS.w15}">${extended.join('')}</w15:commentsEx>`,
    `<w16cid:commentsIds xmlns:w16cid="${NS.w16cid}">${ids.join('')}</w16cid:commentsIds>`,
    `<w16cex:commentsExtensible xmlns:w16cex="${NS.w16cex}">${extensible.join('')}</w16cex:commentsExtensible>`,
  ];
  return {
    entries: [...PARTS.map(([name], index) => ({ name: `word/${name}`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${xml[index]}` })),
      ...(links.size ? [{ name: 'word/_rels/comments.xml.rels', data: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${[...links].map(([href,id]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlAttribute(href)}" TargetMode="External"/>`).join('')}</Relationships>` }] : [])],
    contentTypes: PARTS.map(([name, type]) => `<Override PartName="/word/${name}" ContentType="${type}"/>`).join(''),
    relationships: PARTS.map(([name, , type], index) => `<Relationship Id="rIdYalkenComment${index}" Type="${type}" Target="${name}"/>`).join(''),
  };
}

function commentMarkersForBlock(projection, block) {
  const markers = new Map();
  let ordinal = 0;
  const append = (offset, kind, event) => {
    const boundary = markers.get(offset) || { end: [], start: [] };
    boundary[kind].push(event); markers.set(offset, boundary);
  };
  for (const thread of projection?.threads || []) {
    const multi = thread.anchor.kind === 'multi-paragraph-range';
    const isStart = thread.anchor.blockId === block.blockId;
    const isEnd = (multi ? thread.anchor.endBlockId : thread.anchor.blockId) === block.blockId;
    if (!isStart && !isEnd) { ordinal += thread.messages.length; continue; }
    const { startUtf16: start, endUtf16: end, selectedText } = thread.anchor;
    demand(thread.sceneId === block.sceneId && (multi
      ? (!isStart || digest(block.text) === thread.anchor.blockTextSha256 && isUtf16Boundary(block.text, start))
        && (!isEnd || digest(block.text) === thread.anchor.endBlockTextSha256 && isUtf16Boundary(block.text, end))
      : block.text.slice(start, end) === selectedText
        && (thread.anchor.kind === 'point' ? start === end && thread.anchor.affinity === 'right' : start < end)
        && isUtf16Boundary(block.text, start) && isUtf16Boundary(block.text, end)), 'DOCX_COMMENT_ANCHOR_STALE');
    for (const message of thread.messages) {
      const event = { start, end, startParagraph: thread.anchor.documentParagraphIndex,
        endParagraph: multi ? thread.anchor.endDocumentParagraphIndex : thread.anchor.documentParagraphIndex,
        point: !multi && start === end, ordinal: ordinal++, id: message.commentId };
      if (isStart) append(start, 'start', event);
      if (isEnd) append(end, 'end', event);
    }
  }
  // Outer ranges open first and close last. Reverse exact ties on close so
  // identical root/reply ranges are nested too. This orders transport markers
  // only; canonical thread/message order and genuinely crossing ranges stay intact.
  return new Map([...markers].map(([offset, boundary]) => {
    const pointEvents = boundary.start.filter(event => event.point);
    const ends = boundary.end.filter(event => !event.point).sort((a, b) => b.startParagraph - a.startParagraph || b.start - a.start || b.ordinal - a.ordinal)
      .map(event => `<w:commentRangeEnd w:id="${event.id}"/>`).join('');
    // Word uses reference order when materializing threads on save. Closing a
    // reply's nested range first must not place its reference before its root.
    const references = boundary.end.filter(event => !event.point).sort((a, b) => a.ordinal - b.ordinal)
      .map(event => `<w:r><w:commentReference w:id="${event.id}"/></w:r>`).join('');
    const starts = boundary.start.filter(event => !event.point).sort((a, b) => b.endParagraph - a.endParagraph || b.end - a.end || a.ordinal - b.ordinal)
      .map(event => `<w:commentRangeStart w:id="${event.id}"/>`).join('');
    // Adjacent ranges close before another range opens at the same offset.
    const points = pointEvents.sort((a, b) => a.ordinal - b.ordinal)
      .map(event => `<w:commentRangeStart w:id="${event.id}"/><w:commentRangeEnd w:id="${event.id}"/><w:r><w:commentReference w:id="${event.id}"/></w:r>`).join('');
    return [offset, ends + references + points + starts];
  }));
}

// Used only after local signed-round verification. Provider metadata and IDs
// remain evidence: every mapped baseline message must agree before a no-op.
function compareCommentExportReadback(projection, returned) {
  if (!projection) return { ok: true, unchangedThreadIds: [], missing: [], changed: [] };
  const missing = [], changed = [], unchangedThreadIds = [];
  const deletedIds = new Set((projection.tombstones || []).flatMap(item => item.messageDurableIds || []));
  const byDurable = new Map();
  const expectedRoots = new Set(projection.threads.map(thread => thread.messages[0].durableId));
  for (const thread of returned || []) {
    if ([thread, ...(thread.replies || [])].some(message => deletedIds.has(message.durableId))) {
      changed.push({ code: 'COMMENT_DELETED_IDENTITY_REAPPEARED', durableId: thread.durableId });
    }
    if (!expectedRoots.has(thread.durableId)) changed.push({ code: 'COMMENT_ROOT_ADDED', durableId: thread.durableId });
    if (!thread.durableId) continue;
    if (byDurable.has(thread.durableId)) { changed.push({ code: 'COMMENT_DURABLE_ID_DUPLICATE', durableId: thread.durableId }); continue; }
    byDurable.set(thread.durableId, thread);
  }
  for (const expected of projection.threads) {
    const root = expected.messages[0];
    const actual = byDurable.get(root.durableId);
    if (!actual) { missing.push({ threadId: expected.threadId, canonicalCommentId: root.canonicalCommentId, code: 'COMMENT_ROOT_MISSING' }); continue; }
    const messages = [{ body: actual.body, richBody: actual.richBody, durableId: actual.durableId,
      provenance: { ...actual.authorPersonIdentity, date: actual.date, dateUtc: actual.dateUtc || actual.modernMetadata?.dateUtc } },
    ...(actual.replies || []).map(reply => ({ body: reply.body, richBody: reply.richBody, durableId: reply.durableId,
      provenance: { author: reply.author, initials: reply.initials, date: reply.date, dateUtc: reply.dateUtc } }))];
    const before = changed.length + missing.length;
    if (actual.quotedAnchorText !== expected.anchor.selectedText
      || actual.paragraphIndex !== expected.anchor.documentParagraphIndex
      || actual.anchorRange?.startUtf16 !== expected.anchor.startUtf16
      || actual.anchorRange?.endUtf16 !== expected.anchor.endUtf16
      || actual.anchorRange?.kind !== expected.anchor.kind && (actual.anchorRange?.kind === 'multi-paragraph-range' || expected.anchor.kind === 'multi-paragraph-range')
      || (expected.anchor.kind === 'multi-paragraph-range' && (actual.anchorRange?.endParagraphIndex !== expected.anchor.endDocumentParagraphIndex
        || actual.anchorRange?.coveredParagraphsSha256 !== expected.anchor.coveredParagraphsSha256
        || actual.anchorRange?.endBlockTextSha256 !== expected.anchor.endBlockTextSha256))
      || !['ANCHORED', 'RESOLVED'].includes(actual.status)
      || (actual.status === 'RESOLVED') !== (expected.status === 'resolved')) {
      changed.push({ threadId: expected.threadId, code: 'COMMENT_ANCHOR_OR_STATE_CHANGED' });
    }
    for (const [index, message] of expected.messages.entries()) {
      const seen = messages[index];
      if (!seen || seen.durableId !== message.durableId) {
        missing.push({ threadId: expected.threadId, canonicalCommentId: message.canonicalCommentId, code: 'COMMENT_MESSAGE_MISSING_OR_REORDERED' }); continue;
      }
      const actualMetadata = Object.fromEntries(Object.entries(seen.provenance).filter(([, value]) => typeof value === 'string' && value));
      let metadataEqual = false;
      try { metadataEqual = stable(normalizeCommentProvenance(actualMetadata)) === stable({ ...message.provenance,
        ...(message.transportDateUtc ? { dateUtc: message.transportDateUtc } : {}) }); } catch { /* Malformed provider provenance never grants continuity. */ }
      let contentEqual = false;
      try { contentEqual = commentBody.commentBodyEqual(seen, message.transportRichBody ? {...message,richBody:message.transportRichBody} : message); }
      catch { /* Invalid returned rich content is a publication mismatch, never continuity. */ }
      if (!contentEqual || !metadataEqual) {
        changed.push({ threadId: expected.threadId, canonicalCommentId: message.canonicalCommentId, code: 'COMMENT_BODY_OR_PROVENANCE_CHANGED' });
      }
    }
    if (messages.length !== expected.messages.length) changed.push({ threadId: expected.threadId, code: 'COMMENT_REPLY_SHAPE_CHANGED' });
    if (before === changed.length + missing.length) unchangedThreadIds.push(expected.threadId);
  }
  return { ok: missing.length === 0 && changed.length === 0, unchangedThreadIds, missing, changed };
}

module.exports = { COMMENT_EXPORT_SCHEMA, buildCanonicalCommentExport, commentStateDigest,
  normalizeCommentProvenance, commentPackageParts, commentMarkersForBlock, compareCommentExportReadback };
