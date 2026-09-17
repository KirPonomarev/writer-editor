'use strict';

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

function commentStateDigest(state) { return digest(stable(state)); }

function isUtf16Boundary(value, offset) {
  return Number.isSafeInteger(offset) && offset >= 0 && offset <= value.length
    && !(offset > 0 && offset < value.length
      && /[\uD800-\uDBFF]/u.test(value[offset - 1]) && /[\uDC00-\uDFFF]/u.test(value[offset]));
}

function exactCommentAnchor(thread, blocks) {
  const anchor = plain(thread.anchor) ? thread.anchor : {};
  const selectedText = text(anchor.selectedText);
  demand(anchor.sceneId === thread.sceneId && selectedText
    && anchor.selectedTextSha256 === digest(selectedText), 'DOCX_COMMENT_ANCHOR_INVALID');
  const sceneBlocks = blocks.filter(block => block.sceneId === thread.sceneId);
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
  return { blockId: block.blockId, sceneId: block.sceneId, documentParagraphIndex: block.documentParagraphIndex,
    startUtf16: start, endUtf16: end, selectedText };
}

function buildCanonicalCommentExport(state, blocks, projectId) {
  if (state === undefined) return null;
  demand(plain(state) && state.schemaVersion === COMMENT_STATE_SCHEMA && state.projectId === projectId
    && Number.isSafeInteger(state.revision) && state.revision >= 0
    && Array.isArray(state.threads) && Array.isArray(state.events), 'DOCX_COMMENT_STATE_INVALID');
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
  for (const thread of state.threads) {
    demand(plain(thread) && typeof thread.threadId === 'string' && typeof thread.sceneId === 'string'
      && ['open', 'resolved', 'deleted'].includes(thread.status), 'DOCX_COMMENT_THREAD_INVALID');
    reserve(ids, thread.threadId);
    demand(Array.isArray(thread.messages) && thread.messages.length > 0, 'DOCX_COMMENT_MESSAGES_REQUIRED');
    const messages = thread.messages.map((message, index) => {
      demand(plain(message) && typeof message.commentId === 'string'
        && message.kind === (index === 0 ? 'root' : 'reply')
        && typeof message.body === 'string' && message.body.trim()
        && Buffer.byteLength(message.body, 'utf8') <= 16384, 'DOCX_COMMENT_MESSAGE_INVALID');
      reserve(ids, message.commentId);
      segmentDocxTextForSerialization(message.body);
      demand(!message.body.includes('\r'), 'DOCX_COMMENT_BODY_NON_CANONICAL_NEWLINE');
      return {
        canonicalCommentId: message.commentId, kind: message.kind, body: message.body,
        provenance: normalizeCommentProvenance(message.provenance),
        commentId: String(ordinal++),
        paraId: reserve(paraIds, wordId('comment-paragraph', message.commentId)),
        durableId: reserve(durableIds, wordId('comment-durable', message.commentId)),
      };
    });
    demand(messages[0].canonicalCommentId === thread.rootCommentId, 'DOCX_COMMENT_ROOT_IDENTITY_INVALID');
    if (thread.status === 'deleted') {
      tombstones.push({ threadId: thread.threadId, sceneId: thread.sceneId, status: 'deleted',
        messageIds: messages.map(message => message.canonicalCommentId),
        messageDurableIds: messages.map(message => message.durableId),
        outcome: 'CANONICAL_DELETION_NOT_EXPORTED', threadDigest: digest(stable(thread)) });
      continue;
    }
    demand(thread.deleted !== true, 'DOCX_COMMENT_STATE_INVALID');
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
  const comments = [], extended = [], ids = [], extensible = [];
  for (const thread of projection.threads) {
    for (const message of thread.messages) {
      const { author = '', initials = '', date = '', dateUtc = '' } = message.provenance;
      comments.push(`<w:comment w:id="${message.commentId}" w:author="${xmlAttribute(author)}"${initials ? ` w:initials="${xmlAttribute(initials)}"` : ''}${date ? ` w:date="${xmlAttribute(date)}"` : ''}><w:p w14:paraId="${message.paraId}"><w:r>${buildDocxRunContentXml(message.body)}</w:r></w:p></w:comment>`);
      extended.push(`<w15:commentEx w15:paraId="${message.paraId}"${message.kind === 'reply' ? ` w15:paraIdParent="${thread.messages[0].paraId}"` : ''} w15:done="${thread.status === 'resolved' ? 1 : 0}"/>`);
      ids.push(`<w16cid:commentId w16cid:paraId="${message.paraId}" w16cid:durableId="${message.durableId}"/>`);
      extensible.push(`<w16cex:commentExtensible w16cex:durableId="${message.durableId}"${dateUtc ? ` w16cex:dateUtc="${xmlAttribute(dateUtc)}"` : ''}/>`);
    }
  }
  const xml = [
    `<w:comments xmlns:w="${NS.w}" xmlns:w14="${NS.w14}">${comments.join('')}</w:comments>`,
    `<w15:commentsEx xmlns:w15="${NS.w15}">${extended.join('')}</w15:commentsEx>`,
    `<w16cid:commentsIds xmlns:w16cid="${NS.w16cid}">${ids.join('')}</w16cid:commentsIds>`,
    `<w16cex:commentsExtensible xmlns:w16cex="${NS.w16cex}">${extensible.join('')}</w16cex:commentsExtensible>`,
  ];
  return {
    entries: PARTS.map(([name], index) => ({ name: `word/${name}`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${xml[index]}` })),
    contentTypes: PARTS.map(([name, type]) => `<Override PartName="/word/${name}" ContentType="${type}"/>`).join(''),
    relationships: PARTS.map(([name, , type], index) => `<Relationship Id="rIdYalkenComment${index}" Type="${type}" Target="${name}"/>`).join(''),
  };
}

function commentMarkersForBlock(projection, block) {
  const markers = new Map();
  const append = (offset, xml) => markers.set(offset, (markers.get(offset) || '') + xml);
  for (const thread of projection?.threads || []) {
    if (thread.anchor.blockId !== block.blockId) continue;
    const { startUtf16: start, endUtf16: end, selectedText } = thread.anchor;
    demand(thread.sceneId === block.sceneId && block.text.slice(start, end) === selectedText
      && start < end && isUtf16Boundary(block.text, start) && isUtf16Boundary(block.text, end), 'DOCX_COMMENT_ANCHOR_STALE');
    // Word drops an unreferenced reply on save even when commentEx names its parent.
    // Every message therefore has a matching range/reference on the same text.
    for (const message of thread.messages) append(start, `<w:commentRangeStart w:id="${message.commentId}"/>`);
    for (const message of thread.messages) {
      append(end, `<w:commentRangeEnd w:id="${message.commentId}"/><w:r><w:commentReference w:id="${message.commentId}"/></w:r>`);
    }
  }
  return markers;
}

// Used only after local signed-round verification. Provider metadata and IDs
// remain evidence: every mapped baseline message must agree before a no-op.
function compareCommentExportReadback(projection, returned) {
  if (!projection) return { ok: true, unchangedThreadIds: [], missing: [], changed: [] };
  const missing = [], changed = [], unchangedThreadIds = [];
  const deletedIds = new Set((projection.tombstones || []).flatMap(item => item.messageDurableIds || []));
  const byDurable = new Map();
  for (const thread of returned || []) {
    if ([thread, ...(thread.replies || [])].some(message => deletedIds.has(message.durableId))) {
      changed.push({ code: 'COMMENT_DELETED_IDENTITY_REAPPEARED', durableId: thread.durableId });
    }
    if (!thread.durableId) continue;
    if (byDurable.has(thread.durableId)) { changed.push({ code: 'COMMENT_DURABLE_ID_DUPLICATE', durableId: thread.durableId }); continue; }
    byDurable.set(thread.durableId, thread);
  }
  for (const expected of projection.threads) {
    const root = expected.messages[0];
    const actual = byDurable.get(root.durableId);
    if (!actual) { missing.push({ threadId: expected.threadId, canonicalCommentId: root.canonicalCommentId, code: 'COMMENT_ROOT_MISSING' }); continue; }
    const messages = [{ body: actual.body, durableId: actual.durableId,
      provenance: { ...actual.authorPersonIdentity, date: actual.date, dateUtc: actual.dateUtc || actual.modernMetadata?.dateUtc } },
    ...(actual.replies || []).map(reply => ({ body: reply.body, durableId: reply.durableId,
      provenance: { author: reply.author, initials: reply.initials, date: reply.date, dateUtc: reply.dateUtc } }))];
    const before = changed.length + missing.length;
    if (actual.quotedAnchorText !== expected.anchor.selectedText
      || actual.paragraphIndex !== expected.anchor.documentParagraphIndex
      || actual.anchorRange?.startUtf16 !== expected.anchor.startUtf16
      || actual.anchorRange?.endUtf16 !== expected.anchor.endUtf16
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
      try { metadataEqual = stable(normalizeCommentProvenance(actualMetadata)) === stable(message.provenance); } catch { /* Malformed provider provenance never grants continuity. */ }
      if (seen.body !== message.body || !metadataEqual) {
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
