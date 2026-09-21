'use strict';

const crypto = require('crypto');
const { buildDocxReviewPacketBuffer } = require('./docxReviewPacketBuilder');
const { buildCanonicalCommentExport } = require('./docxReviewPacketComments.js');
const { normalizeFontFamily, normalizeFontSize } = require('../../io/inlineTypography.cjs');

const FULL_MANUSCRIPT_REVIEW_DOCX_COMMAND_ID = 'cmd.project.review.exportFullManuscriptDocxReviewPacket';
const FULL_MANUSCRIPT_REVIEW_DOCX_CAPABILITY_ID = 'cap.project.review.exportFullManuscriptDocxReviewPacket';
const FULL_MANUSCRIPT_REVIEW_DOCX_PROFILE_ID = 'word-mac-16.112-26081010-product-review-export-c5v2-full-manuscript';
const REVIEW_DOCX_PACKET_AUTH_PROPERTY_NAME = 'YRTK_C01_AUTH';
const REVIEW_DOCX_PACKET_YRTK2_PROPERTY_NAME = 'YRTK2_TOKEN';
const REVIEW_DOCX_PACKET_CORE_DIGEST_PROPERTY_NAME = 'YRTK_CORE_DIGEST';
const WORD_DOCUMENT_METADATA_SCHEMA = 'yalken.rtk.word.document-metadata.v1';
const WORD_DOCUMENT_METADATA_POLICY = 'CANONICAL_PROJECT_METADATA_PROTECTED_PROVIDER_VOLATILE_V1';
const WORD_DOCUMENT_METADATA_CREATOR = 'Yalken';
const WORD_DOCUMENT_SECTIONS_SCHEMA = 'yalken.rtk.word.document-sections.v1';
const WORD_DOCUMENT_SECTIONS_POLICY = 'CANONICAL_SCENE_GROUPS_TO_WORD_SECTIONS_V1';
const FULL_MANUSCRIPT_FORMAT_IR_SCHEMA = 'yalken.rtk.format-ir.v1';
const FORMAT_IR_BOOLEAN_MARKS = new Set(['bold', 'italic', 'underline', 'strike']);
const FORMAT_IR_TEXT_STYLE_KEYS = new Set(['color', 'fontFamily', 'fontSize']);
const FORMAT_IR_TEXT_ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);

// EXPORT-01 (P0-20): unified bookmark-name generator. The single source of
// truth is src/io/revisionBridge/reviewTransportWordBookmarkV1.mjs
// (deriveWordBookmarkNameV1). This CJS module cannot synchronously import an
// ESM module, so when deps.deriveWordBookmarkNameV1 is supplied (main.js wires
// the real revisionBridge generator) it is used; otherwise this inline copy of
// the IDENTICAL formula runs. This is the same producer-inline + shared-builder
// pattern CANON-01 already uses for buildFullManuscriptHashTree. Contract
// EXPORT01-E2 asserts declared == emitted == resolved byte-for-byte, so any drift
// between this fallback and reviewTransportWordBookmarkV1.mjs is caught.
const RTK_WORD_BOOKMARK_V1_DOMAIN = 'word-bookmark-v1';
function canonicalWordBookmarkIdentityJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalWordBookmarkIdentityJson(item)).join(',')}]`;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalWordBookmarkIdentityJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function deriveWordBookmarkNameV1Fallback(input = {}) {
  const source = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
  const roundId = String(source.roundId ?? '');
  const sceneId = String(source.sceneId ?? '');
  const roundBlockOccurrenceId = String(source.roundBlockOccurrenceId ?? '');
  const identity = canonicalWordBookmarkIdentityJson({ roundBlockOccurrenceId, roundId, sceneId });
  const digest = crypto.createHash('sha256').update(`${RTK_WORD_BOOKMARK_V1_DOMAIN}${identity}`, 'utf8').digest('hex');
  return `YRTK_${digest.slice(0, 32)}`;
}

function isPlainObjectValue(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSceneText(value) {
  return typeof value === 'string'
    ? value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    : '';
}

function normalizeVisibleDocumentText(value) {
  return normalizeSceneText(value)
    .replace(/\n{3,}/gu, '\n\n')
    .replace(/^\n+/u, '')
    .replace(/\n+$/u, '');
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeFormatColor(value, code) {
  const color = normalizeString(value).toLowerCase();
  if (!/^#[a-f0-9]{6}$/u.test(color)) throw makeError(code, { value });
  return color;
}

function normalizeFormatFontSize(value) {
  try { return normalizeFontSize(value); } catch {
    throw makeError('FULL_MANUSCRIPT_FORMAT_IR_FONT_SIZE_UNSUPPORTED', { value });
  }
}

function normalizeFormatIrInlineMarks(marks, sceneId, paragraphOrdinal) {
  const inline = {};
  const preservedMarks = [];
  for (const mark of Array.isArray(marks) ? marks : []) {
    if (!isPlainObjectValue(mark)) {
      throw makeError('FULL_MANUSCRIPT_FORMAT_IR_MARK_INVALID', { sceneId, paragraphOrdinal });
    }
    const type = normalizeString(mark.type);
    const attrs = isPlainObjectValue(mark.attrs) ? mark.attrs : {};
    if (FORMAT_IR_BOOLEAN_MARKS.has(type)) {
      if (Object.keys(attrs).some((key) => attrs[key] !== null && attrs[key] !== undefined)) {
        throw makeError('FULL_MANUSCRIPT_FORMAT_IR_MARK_ATTR_UNSUPPORTED', { sceneId, paragraphOrdinal, type });
      }
      inline[type] = true;
      continue;
    }
    if (type === 'textStyle') {
      const unknownKeys = Object.keys(attrs).filter((key) => !FORMAT_IR_TEXT_STYLE_KEYS.has(key) && attrs[key] !== null && attrs[key] !== undefined);
      if (unknownKeys.length > 0) {
        throw makeError('FULL_MANUSCRIPT_FORMAT_IR_TEXT_STYLE_UNSUPPORTED', { sceneId, paragraphOrdinal, unknownKeys });
      }
      if (attrs.color !== null && attrs.color !== undefined && attrs.color !== '') {
        inline.color = normalizeFormatColor(attrs.color, 'FULL_MANUSCRIPT_FORMAT_IR_COLOR_UNSUPPORTED');
      }
      if (attrs.fontFamily !== null && attrs.fontFamily !== undefined && attrs.fontFamily !== '') {
        try { inline.fontFamily = normalizeFontFamily(attrs.fontFamily); } catch {
          throw makeError('FULL_MANUSCRIPT_FORMAT_IR_FONT_FAMILY_UNSUPPORTED', { sceneId, paragraphOrdinal });
        }
      }
      if (attrs.fontSize !== null && attrs.fontSize !== undefined && attrs.fontSize !== '') {
        inline.fontSize = normalizeFormatFontSize(attrs.fontSize);
      }
      continue;
    }
    if (type === 'highlight') {
      const unknownKeys = Object.keys(attrs).filter((key) => key !== 'color' && attrs[key] !== null && attrs[key] !== undefined);
      if (unknownKeys.length > 0) {
        throw makeError('FULL_MANUSCRIPT_FORMAT_IR_HIGHLIGHT_UNSUPPORTED', { sceneId, paragraphOrdinal, unknownKeys });
      }
      inline.highlight = normalizeFormatColor(
        attrs.color || '#ffff00',
        'FULL_MANUSCRIPT_FORMAT_IR_HIGHLIGHT_UNSUPPORTED',
      );
      continue;
    }
    if (type === 'link') {
      const unknownKeys = Object.keys(attrs).filter((key) => (
        !['href', 'target', 'rel', 'class'].includes(key)
        && attrs[key] !== null
        && attrs[key] !== undefined
      ));
      const href = normalizeString(attrs.href);
      if (
        unknownKeys.length > 0
        || !href
        || href.length > 2048
        || /[\u0000-\u001f\u007f]/u.test(href)
        || /^(?:javascript|data|vbscript):/iu.test(href)
      ) {
        throw makeError('FULL_MANUSCRIPT_FORMAT_IR_LINK_UNSUPPORTED', {
          sceneId,
          paragraphOrdinal,
          unknownKeys,
        });
      }
      preservedMarks.push({
        type: 'link',
        attrs: {
          href,
          target: normalizeString(attrs.target),
          rel: normalizeString(attrs.rel),
        },
      });
      continue;
    }
    if (type === 'code') {
      preservedMarks.push({ type: 'code' });
      continue;
    }
    throw makeError('FULL_MANUSCRIPT_FORMAT_IR_MARK_UNSUPPORTED', { sceneId, paragraphOrdinal, type });
  }
  return { inline, preservedMarks };
}

function buildFormatIrParagraphs(scene) {
  const sourceDoc = isPlainObjectValue(scene.doc) ? cloneJson(scene.doc) : null;
  const topLevelNodes = sourceDoc
    ? (sourceDoc.type === 'doc' && Array.isArray(sourceDoc.content) ? sourceDoc.content : null)
    : scene.text.split('\n').map((line) => ({
        type: 'paragraph',
        content: line ? [{ type: 'text', text: line }] : [],
      }));
  if (!topLevelNodes) {
    throw makeError('FULL_MANUSCRIPT_FORMAT_IR_DOCUMENT_STRUCTURE_UNSUPPORTED', { sceneId: scene.sceneId });
  }
  const result = [];
  let nextListNumId = 1;
  const appendTextBlock = (node, context) => {
    const paragraphOrdinal = result.length;
    const attrs = isPlainObjectValue(node.attrs) ? node.attrs : {};
    const allowedAttrs = node.type === 'heading'
      ? new Set(['textAlign', 'level'])
      : node.type === 'codeBlock'
        ? new Set(['language'])
        : new Set(['textAlign']);
    const unknownAttrs = Object.keys(attrs).filter((key) => (
      !allowedAttrs.has(key) && attrs[key] !== null && attrs[key] !== undefined
    ));
    if (unknownAttrs.length > 0) {
      throw makeError('FULL_MANUSCRIPT_FORMAT_IR_PARAGRAPH_ATTR_UNSUPPORTED', {
        sceneId: scene.sceneId,
        paragraphOrdinal,
        unknownAttrs,
      });
    }
    const paragraphFormat = { nodeType: node.type };
    if (node.type === 'heading') {
      const headingLevel = Number(attrs.level);
      if (!Number.isSafeInteger(headingLevel) || headingLevel < 1 || headingLevel > 6) {
        throw makeError('FULL_MANUSCRIPT_FORMAT_IR_HEADING_LEVEL_UNSUPPORTED', {
          sceneId: scene.sceneId,
          paragraphOrdinal,
        });
      }
      paragraphFormat.headingLevel = headingLevel;
    }
    if (node.type === 'codeBlock') {
      const language = normalizeString(attrs.language);
      if (language.length > 64 || /[\u0000-\u001f\u007f]/u.test(language)) {
        throw makeError('FULL_MANUSCRIPT_FORMAT_IR_CODE_LANGUAGE_UNSUPPORTED', {
          sceneId: scene.sceneId,
          paragraphOrdinal,
        });
      }
      paragraphFormat.codeLanguage = language;
    }
    if (context.blockquoteDepth > 0) paragraphFormat.blockquoteDepth = context.blockquoteDepth;
    const activeList = context.listStack.at(-1);
    if (activeList) {
      paragraphFormat.list = {
        kind: activeList.kind,
        level: context.listStack.length - 1,
        itemOrdinal: activeList.itemOrdinal,
        start: activeList.start,
        numId: activeList.numId,
      };
    }
    if (attrs.textAlign !== null && attrs.textAlign !== undefined && attrs.textAlign !== '') {
      const textAlign = normalizeString(attrs.textAlign).toLowerCase();
      if (!FORMAT_IR_TEXT_ALIGNMENTS.has(textAlign)) {
        throw makeError('FULL_MANUSCRIPT_FORMAT_IR_TEXT_ALIGN_UNSUPPORTED', { sceneId: scene.sceneId, paragraphOrdinal });
      }
      paragraphFormat.textAlign = textAlign;
    }
    let cursor = 0;
    const runs = [];
    for (const inlineNode of Array.isArray(node.content) ? node.content : []) {
      if (!isPlainObjectValue(inlineNode) || !['text', 'hardBreak'].includes(inlineNode.type)) {
        throw makeError('FULL_MANUSCRIPT_FORMAT_IR_INLINE_NODE_UNSUPPORTED', {
          sceneId: scene.sceneId,
          paragraphOrdinal,
          nodeType: normalizeString(inlineNode?.type),
        });
      }
      const text = inlineNode.type === 'hardBreak' ? '\n' : normalizeSceneText(inlineNode.text);
      if (inlineNode.type === 'text' && !text) continue;
      const normalizedMarks = inlineNode.type === 'text'
        ? normalizeFormatIrInlineMarks(inlineNode.marks, scene.sceneId, paragraphOrdinal)
        : { inline: {}, preservedMarks: [] };
      runs.push({
        from: cursor,
        to: cursor + text.length,
        text,
        inline: normalizedMarks.inline,
        preservedMarks: normalizedMarks.preservedMarks,
      });
      cursor += text.length;
    }
    const text = runs.map((run) => run.text).join('');
    result.push({
      text,
      formatIr: {
        schemaVersion: FULL_MANUSCRIPT_FORMAT_IR_SCHEMA,
        paragraph: paragraphFormat,
        runs,
      },
    });
  };
  const visit = (node, context = { blockquoteDepth: 0, listStack: [] }) => {
    if (!isPlainObjectValue(node)) {
      throw makeError('FULL_MANUSCRIPT_FORMAT_IR_DOCUMENT_STRUCTURE_UNSUPPORTED', { sceneId: scene.sceneId });
    }
    if (['paragraph', 'heading', 'codeBlock'].includes(node.type)) {
      appendTextBlock(node, context);
      return;
    }
    if (node.type === 'horizontalRule') {
      if ((Array.isArray(node.content) && node.content.length > 0) || Object.keys(node.attrs || {}).length > 0) {
        throw makeError('FULL_MANUSCRIPT_FORMAT_IR_HORIZONTAL_RULE_UNSUPPORTED', { sceneId: scene.sceneId });
      }
      result.push({
        text: '',
        formatIr: {
          schemaVersion: FULL_MANUSCRIPT_FORMAT_IR_SCHEMA,
          paragraph: { nodeType: 'horizontalRule' },
          runs: [],
        },
      });
      return;
    }
    if (node.type === 'blockquote') {
      if (Object.keys(node.attrs || {}).some((key) => node.attrs[key] !== null && node.attrs[key] !== undefined)) {
        throw makeError('FULL_MANUSCRIPT_FORMAT_IR_BLOCKQUOTE_ATTR_UNSUPPORTED', { sceneId: scene.sceneId });
      }
      for (const child of Array.isArray(node.content) ? node.content : []) {
        visit(child, { ...context, blockquoteDepth: context.blockquoteDepth + 1 });
      }
      return;
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const attrs = isPlainObjectValue(node.attrs) ? node.attrs : {};
      const unknownAttrs = Object.keys(attrs).filter((key) => key !== 'start' && attrs[key] !== null && attrs[key] !== undefined);
      const start = node.type === 'orderedList' ? Number(attrs.start ?? 1) : 1;
      if (unknownAttrs.length > 0 || !Number.isSafeInteger(start) || start < 1 || start > 32767) {
        throw makeError('FULL_MANUSCRIPT_FORMAT_IR_LIST_ATTR_UNSUPPORTED', { sceneId: scene.sceneId, unknownAttrs });
      }
      const items = Array.isArray(node.content) ? node.content : [];
      const numId = nextListNumId;
      nextListNumId += 1;
      for (const [itemOrdinal, item] of items.entries()) {
        if (!isPlainObjectValue(item) || item.type !== 'listItem') {
          throw makeError('FULL_MANUSCRIPT_FORMAT_IR_LIST_ITEM_UNSUPPORTED', { sceneId: scene.sceneId });
        }
        const listStack = [...context.listStack, {
          kind: node.type === 'orderedList' ? 'ordered' : 'bullet',
          start,
          itemOrdinal,
          numId,
        }];
        for (const child of Array.isArray(item.content) ? item.content : []) {
          visit(child, { ...context, listStack });
        }
      }
      return;
    }
    throw makeError('FULL_MANUSCRIPT_FORMAT_IR_DOCUMENT_STRUCTURE_UNSUPPORTED', {
      sceneId: scene.sceneId,
      nodeType: normalizeString(node.type),
    });
  };
  for (const node of topLevelNodes) visit(node);
  const authoredText = result.map((paragraph) => paragraph.text).join('\n');
  const derivedText = sourceDoc ? normalizeVisibleDocumentText(authoredText) : authoredText;
  if (derivedText !== scene.text) {
    throw makeError('FULL_MANUSCRIPT_FORMAT_IR_VISIBLE_TEXT_MISMATCH', { sceneId: scene.sceneId });
  }
  return result;
}

function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex')}`;
}

function sha256Json(value) {
  return sha256Text(JSON.stringify(value));
}

function hmacSha256Json(value, secret) {
  return `hmac-sha256:${crypto.createHmac('sha256', String(secret || '')).update(JSON.stringify(value), 'utf8').digest('hex')}`;
}

function createDefaultCryptoPort() {
  return {
    sha256Text,
    sha256Json,
    hmacSha256Json,
  };
}

function base64UrlEncode(value) {
  return Buffer.from(String(value || ''), 'utf8')
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

function buildAuthorityEnvelope(payload, hmacSecret, cryptoPort = createDefaultCryptoPort()) {
  const body = {
    schemaVersion: 'yalken.rtk.locator-authority-envelope.c01.v1',
    payload: JSON.parse(JSON.stringify(payload)),
    payloadDigest: cryptoPort.sha256Json(payload),
    signature: cryptoPort.hmacSha256Json(payload, hmacSecret),
    keyId: 'product-review-docx-local-secret-v1',
    secretEmbeddedInDocx: false,
  };
  return `YRTK1.${base64UrlEncode(JSON.stringify(body))}`;
}

function makeError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  if (isPlainObjectValue(details) && Object.keys(details).length > 0) {
    error.details = details;
  }
  return error;
}

function normalizeMetadataUtcTimestamp(value, code) {
  const text = normalizeString(value);
  const milliseconds = Date.parse(text);
  if (!text || !Number.isFinite(milliseconds)) throw makeError(code, { value: text });
  return new Date(milliseconds).toISOString();
}

function buildFullManuscriptDocumentMetadata(input = {}, cryptoPort = createDefaultCryptoPort()) {
  const projectId = normalizeString(input.projectId);
  const title = normalizeString(input.projectName) || projectId;
  const createdAtUtc = normalizeMetadataUtcTimestamp(
    input.projectCreatedAtUtc || input.exportedAtUtc,
    'FULL_MANUSCRIPT_DOCUMENT_METADATA_CREATED_AT_INVALID',
  );
  const modifiedAtUtc = normalizeMetadataUtcTimestamp(
    input.exportedAtUtc,
    'FULL_MANUSCRIPT_DOCUMENT_METADATA_MODIFIED_AT_INVALID',
  );
  if (!projectId) throw makeError('FULL_MANUSCRIPT_DOCUMENT_METADATA_PROJECT_ID_REQUIRED');
  if (!title) throw makeError('FULL_MANUSCRIPT_DOCUMENT_METADATA_TITLE_REQUIRED');
  const protectedProperties = {
    schemaVersion: WORD_DOCUMENT_METADATA_SCHEMA,
    projectId,
    title,
    createdAtUtc,
    creator: WORD_DOCUMENT_METADATA_CREATOR,
  };
  const protectedDigest = cryptoPort.sha256Json(protectedProperties);
  const policies = {
    authorship: 'APPLICATION_CREATOR_IS_YALKEN_PROJECT_AUTHOR_NOT_INFERRED',
    timestamps: 'PROJECT_CREATED_AT_PROTECTED_MODIFIED_AT_PROVIDER_VOLATILE',
    returnedAuthority: 'ADVISORY_ONLY_NO_PROJECT_METADATA_WRITE',
    unknownCustomProperties: 'LEDGER_ONLY_NO_AUTHORITY',
    policyId: WORD_DOCUMENT_METADATA_POLICY,
  };
  return {
    schemaVersion: WORD_DOCUMENT_METADATA_SCHEMA,
    protectedProperties,
    protectedDigest,
    policies,
    coreProperties: {
      title,
      creator: WORD_DOCUMENT_METADATA_CREATOR,
      lastModifiedBy: WORD_DOCUMENT_METADATA_CREATOR,
      createdAtUtc,
      modifiedAtUtc,
      revision: '1',
      identifier: projectId,
    },
    publicCustomProperties: [
      { name: 'YALKEN_METADATA_SCHEMA', value: WORD_DOCUMENT_METADATA_SCHEMA },
      { name: 'YALKEN_METADATA_POLICY', value: WORD_DOCUMENT_METADATA_POLICY },
      { name: 'YALKEN_PROJECT_ID', value: projectId },
      { name: 'YALKEN_PROJECT_TITLE', value: title },
      { name: 'YALKEN_PROJECT_CREATED_AT_UTC', value: createdAtUtc },
      { name: 'YALKEN_APPLICATION_CREATOR', value: WORD_DOCUMENT_METADATA_CREATOR },
      { name: 'YALKEN_METADATA_DIGEST', value: protectedDigest },
    ],
  };
}

function validateFullManuscriptDocumentMetadataReturn(input = {}) {
  const expected = isPlainObjectValue(input.expected) ? input.expected : null;
  if (!expected) {
    return { ok: true, applicable: false, status: 'DOCUMENT_METADATA_NOT_APPLICABLE' };
  }
  const returned = isPlainObjectValue(input.returned) ? input.returned : {};
  const mismatches = [];
  const expect = isPlainObjectValue(expected.protectedProperties) ? expected.protectedProperties : {};
  const actual = isPlainObjectValue(returned.protectedProperties) ? returned.protectedProperties : {};
  const signedDigest = normalizeString(input.signedDigest);
  const coreProtected = isPlainObjectValue(returned.coreProtectedProperties)
    ? returned.coreProtectedProperties
    : {};
  if (returned.schemaVersion !== WORD_DOCUMENT_METADATA_SCHEMA) mismatches.push('schemaVersion');
  if (returned.corePropertiesPresent !== true || returned.corePropertiesRootValid !== true) mismatches.push('coreProperties');
  if (returned.customPropertiesPresent !== true || returned.customPropertiesRootValid !== true) mismatches.push('customProperties');
  for (const key of ['schemaVersion', 'projectId', 'title', 'createdAtUtc', 'creator']) {
    if (normalizeString(actual[key]) !== normalizeString(expect[key])) mismatches.push(`protectedProperties.${key}`);
  }
  for (const key of ['projectId', 'title', 'creator']) {
    if (normalizeString(coreProtected[key]) !== normalizeString(expect[key])) mismatches.push(`coreProtectedProperties.${key}`);
  }
  const expectedCreatedAt = Date.parse(normalizeString(expect.createdAtUtc));
  const coreCreatedAt = Date.parse(normalizeString(coreProtected.createdAtUtc));
  if (!Number.isFinite(expectedCreatedAt) || !Number.isFinite(coreCreatedAt)
    || Math.floor(expectedCreatedAt / 60_000) !== Math.floor(coreCreatedAt / 60_000)) {
    mismatches.push('coreProtectedProperties.createdAtUtc');
  }
  if (returned.createdTimestampType !== 'dcterms:W3CDTF') mismatches.push('createdTimestampType');
  if (normalizeString(returned.protectedDigest) !== normalizeString(expected.protectedDigest)) mismatches.push('protectedDigest');
  if (signedDigest !== normalizeString(expected.protectedDigest)) mismatches.push('signedDigest');
  const expectedCustom = Object.fromEntries((Array.isArray(expected.publicCustomProperties)
    ? expected.publicCustomProperties : []).map((property) => [property.name, property.value]));
  const actualCustom = isPlainObjectValue(returned.publicCustomProperties) ? returned.publicCustomProperties : {};
  for (const [name, value] of Object.entries(expectedCustom)) {
    if (normalizeString(actualCustom[name]) !== normalizeString(value)) mismatches.push(`publicCustomProperties.${name}`);
  }
  const duplicateNames = Array.isArray(returned.duplicateCustomPropertyNames)
    ? returned.duplicateCustomPropertyNames.map(normalizeString).filter(Boolean)
    : [];
  if (duplicateNames.some((name) => Object.hasOwn(expectedCustom, name))) {
    mismatches.push('duplicateCustomPropertyNames');
  }
  if (mismatches.length > 0) {
    return {
      ok: false,
      applicable: true,
      status: 'DOCUMENT_METADATA_MISMATCH',
      code: 'FULL_MANUSCRIPT_DOCUMENT_METADATA_MISMATCH',
      mismatches: [...new Set(mismatches)].sort(),
    };
  }
  return {
    ok: true,
    applicable: true,
    status: 'VERIFIED_PROTECTED_DOCUMENT_METADATA',
    proof: {
      schemaVersion: WORD_DOCUMENT_METADATA_SCHEMA,
      authority: 'ADVISORY_ONLY_NO_PROJECT_METADATA_WRITE',
      protectedDigest: expected.protectedDigest,
      protectedProperties: cloneJson(actual),
      coreProtectedProperties: cloneJson(coreProtected),
      policies: cloneJson(expected.policies),
      volatileCoreProperties: isPlainObjectValue(returned.volatileCoreProperties)
        ? cloneJson(returned.volatileCoreProperties)
        : {},
      lossLedger: isPlainObjectValue(returned.lossLedger) ? cloneJson(returned.lossLedger) : {},
    },
  };
}

function canonicalSectionProperties() {
  return {
    type: 'nextPage',
    pageSize: {
      widthTwips: 11906,
      heightTwips: 16838,
      orientation: 'portrait',
    },
    margins: {
      topTwips: 1440,
      rightTwips: 1440,
      bottomTwips: 1440,
      leftTwips: 1440,
      headerTwips: 720,
      footerTwips: 720,
      gutterTwips: 0,
    },
    columns: {
      count: 1,
      spaceTwips: 720,
    },
  };
}

function sceneSectionGroupKey(sceneId) {
  const segments = normalizeString(sceneId).replaceAll('\\', '/').split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw makeError('FULL_MANUSCRIPT_DOCUMENT_SECTION_SCENE_ID_INVALID', { sceneId });
  }
  return segments.length > 1 ? segments.slice(0, -1).join('/') : '.';
}

function buildFullManuscriptDocumentSections(scenes, blocks, cryptoPort = createDefaultCryptoPort()) {
  if (!Array.isArray(scenes) || scenes.length < 1 || !Array.isArray(blocks) || blocks.length < 1) {
    throw makeError('FULL_MANUSCRIPT_DOCUMENT_SECTION_SOURCE_REQUIRED');
  }
  const groups = [];
  for (const scene of scenes) {
    const groupKey = sceneSectionGroupKey(scene.sceneId);
    const last = groups.at(-1);
    if (last && last.groupKey === groupKey) last.sceneIds.push(scene.sceneId);
    else groups.push({ groupKey, sceneIds: [scene.sceneId] });
  }
  const protectedSections = groups.map((group, ordinal) => {
    const sceneIdSet = new Set(group.sceneIds);
    const groupBlocks = blocks.filter((block) => sceneIdSet.has(block.sceneId));
    if (groupBlocks.length < 1) {
      throw makeError('FULL_MANUSCRIPT_DOCUMENT_SECTION_BLOCK_REQUIRED', { ordinal });
    }
    return {
      ordinal,
      startParagraphIndex: groupBlocks[0].documentParagraphIndex,
      endParagraphIndex: groupBlocks.at(-1).documentParagraphIndex,
      breakPlacement: ordinal === groups.length - 1 ? 'BODY_FINAL' : 'PARAGRAPH_PROPERTIES',
      carriers: {
        sectionProperties: true,
        pageSize: true,
        margins: true,
        columns: true,
      },
      properties: canonicalSectionProperties(),
    };
  });
  for (let index = 0; index < protectedSections.length; index += 1) {
    const section = protectedSections[index];
    const expectedStart = index === 0 ? 0 : protectedSections[index - 1].endParagraphIndex + 1;
    if (section.startParagraphIndex !== expectedStart
      || section.endParagraphIndex < section.startParagraphIndex
      || (index === protectedSections.length - 1 && section.endParagraphIndex !== blocks.length - 1)) {
      throw makeError('FULL_MANUSCRIPT_DOCUMENT_SECTION_BOUNDARY_INVALID', { index });
    }
  }
  const sourceBindings = groups.map((group, ordinal) => ({
    ordinal,
    sectionId: `section-${String(ordinal + 1).padStart(3, '0')}-${cryptoPort.sha256Text(group.groupKey).replace(/^sha256:/u, '').slice(0, 12)}`,
    groupKey: group.groupKey,
    sceneIds: [...group.sceneIds],
    firstSceneId: group.sceneIds[0],
    lastSceneId: group.sceneIds.at(-1),
  }));
  const protectedProjection = {
    schemaVersion: WORD_DOCUMENT_SECTIONS_SCHEMA,
    protectedSections,
  };
  return {
    ...protectedProjection,
    protectedDigest: cryptoPort.sha256Json(protectedProjection),
    policies: {
      policyId: WORD_DOCUMENT_SECTIONS_POLICY,
      sourceAuthority: 'CANONICAL_ORDERED_SCENE_DIRECTORY_GROUPS',
      returnedAuthority: 'ADVISORY_ONLY_NO_PROJECT_STRUCTURE_WRITE',
      providerExtensions: 'LOSS_LEDGER_ONLY_NO_AUTHORITY',
    },
    sourceBindings,
  };
}

function validateFullManuscriptDocumentSectionsReturn(input = {}) {
  const expected = isPlainObjectValue(input.expected) ? input.expected : null;
  if (!expected) {
    return { ok: true, applicable: false, status: 'DOCUMENT_SECTIONS_NOT_APPLICABLE' };
  }
  const returned = isPlainObjectValue(input.returned) ? input.returned : {};
  const mismatches = [];
  const expectedSections = Array.isArray(expected.protectedSections) ? expected.protectedSections : [];
  const returnedSections = Array.isArray(returned.protectedSections) ? returned.protectedSections : [];
  const expectedProjection = {
    schemaVersion: WORD_DOCUMENT_SECTIONS_SCHEMA,
    protectedSections: expectedSections,
  };
  const returnedProjection = {
    schemaVersion: returned.schemaVersion,
    protectedSections: returnedSections,
  };
  const expectedDigest = normalizeString(expected.protectedDigest);
  const signedDigest = normalizeString(input.signedDigest);
  if (returned.schemaVersion !== WORD_DOCUMENT_SECTIONS_SCHEMA) mismatches.push('schemaVersion');
  if (returned.applicable !== true) mismatches.push('applicable');
  if (returnedSections.length !== expectedSections.length) mismatches.push('sectionCount');
  if (JSON.stringify(returnedProjection) !== JSON.stringify(expectedProjection)) mismatches.push('protectedSections');
  if (normalizeString(returned.protectedDigest) !== expectedDigest) mismatches.push('protectedDigest');
  if (signedDigest !== expectedDigest) mismatches.push('signedDigest');
  if (mismatches.length > 0) {
    return {
      ok: false,
      applicable: true,
      status: 'DOCUMENT_SECTIONS_MISMATCH',
      code: 'FULL_MANUSCRIPT_DOCUMENT_SECTIONS_MISMATCH',
      mismatches: [...new Set(mismatches)].sort(),
    };
  }
  return {
    ok: true,
    applicable: true,
    status: 'VERIFIED_PROTECTED_DOCUMENT_SECTIONS',
    proof: {
      schemaVersion: WORD_DOCUMENT_SECTIONS_SCHEMA,
      authority: 'ADVISORY_ONLY_NO_PROJECT_STRUCTURE_WRITE',
      protectedDigest: expectedDigest,
      protectedSections: cloneJson(returnedSections),
      sourceBindings: Array.isArray(expected.sourceBindings) ? cloneJson(expected.sourceBindings) : [],
      policies: isPlainObjectValue(expected.policies) ? cloneJson(expected.policies) : {},
      lossLedger: isPlainObjectValue(returned.lossLedger) ? cloneJson(returned.lossLedger) : {},
    },
  };
}

function normalizeFullManuscriptScenes(input = {}) {
  const projectId = normalizeString(input.projectId);
  const projectName = normalizeString(input.projectName);
  const projectCreatedAtUtc = normalizeString(input.projectCreatedAtUtc);
  const projectRoot = normalizeString(input.projectRoot);
  const manifestPath = normalizeString(input.manifestPath);
  const sourceScenes = Array.isArray(input.scenes) ? input.scenes : [];
  if (!projectId) {
    throw makeError('FULL_MANUSCRIPT_PROJECT_ID_REQUIRED');
  }
  if (sourceScenes.length < 1) {
    throw makeError('FULL_MANUSCRIPT_SCENE_REQUIRED', { sceneCount: sourceScenes.length });
  }

  const expectedOrderedSceneIds = Array.isArray(input.expectedOrderedSceneIds)
    ? input.expectedOrderedSceneIds.map(normalizeString).filter(Boolean)
    : [];
  const seen = new Set();
  const scenes = sourceScenes.map((scene, index) => {
    if (!isPlainObjectValue(scene)) {
      throw makeError('FULL_MANUSCRIPT_SCENE_RECORD_INVALID', { index });
    }
    const sceneId = normalizeString(scene.sceneId);
    if (!sceneId) {
      throw makeError('FULL_MANUSCRIPT_SCENE_ID_REQUIRED', { index });
    }
    if (seen.has(sceneId)) {
      throw makeError('FULL_MANUSCRIPT_SCENE_ID_DUPLICATE', { sceneId });
    }
    seen.add(sceneId);
    const text = normalizeSceneText(scene.text);
    const observableContent = typeof scene.observableContent === 'string' ? scene.observableContent : text;
    const rawSha256 = normalizeString(scene.rawSha256) || sha256Text(observableContent);
    if (rawSha256 !== sha256Text(observableContent)) {
      throw makeError('FULL_MANUSCRIPT_SCENE_BASELINE_HASH_STALE', { sceneId });
    }
    return {
      sceneId,
      sceneOrdinal: index,
      order: Number.isInteger(scene.order) ? scene.order : index,
      title: normalizeString(scene.title),
      label: normalizeString(scene.label),
      scenePath: normalizeString(scene.scenePath || scene.path),
      text,
      doc: isPlainObjectValue(scene.doc) ? cloneJson(scene.doc) : null,
      observableContent,
      rawSha256,
      sceneRevision: normalizeString(scene.sceneRevision) || rawSha256,
    };
  });

  for (let index = 0; index < scenes.length; index += 1) {
    if (scenes[index].order !== index) {
      throw makeError('FULL_MANUSCRIPT_SCENE_ORDER_NON_CANONICAL', {
        sceneId: scenes[index].sceneId,
        order: scenes[index].order,
        expectedOrder: index,
      });
    }
  }
  if (expectedOrderedSceneIds.length > 0) {
    const actual = scenes.map((scene) => scene.sceneId);
    if (expectedOrderedSceneIds.length !== actual.length || expectedOrderedSceneIds.some((sceneId, index) => sceneId !== actual[index])) {
      throw makeError('FULL_MANUSCRIPT_SCENE_ORDER_MISMATCH', {
        expectedOrderedSceneIds,
        actualOrderedSceneIds: actual,
      });
    }
  }
  return {
    projectId,
    projectName,
    projectCreatedAtUtc,
    projectRoot,
    manifestPath,
    scenes,
  };
}

function buildFullManuscriptBlocks(scenes, cryptoPort = createDefaultCryptoPort(), options = {}) {
  const roundId = typeof options.roundId === 'string' ? options.roundId : '';
  const deriveWordBookmarkNameV1 = typeof options.deriveWordBookmarkNameV1 === 'function'
    ? options.deriveWordBookmarkNameV1
    : deriveWordBookmarkNameV1Fallback;
  const blocks = [];
  for (const scene of scenes) {
    const paragraphs = buildFormatIrParagraphs(scene);
    for (let index = 0; index < paragraphs.length; index += 1) {
      const { text, formatIr } = paragraphs[index];
      const seed = `${scene.sceneId}\n${scene.sceneOrdinal}\n${index}\n${text}`;
      const seedHash = crypto.createHash('sha256').update(seed, 'utf8').digest('hex');
      const blockId = `scene-${String(scene.sceneOrdinal + 1).padStart(2, '0')}-block-${String(index + 1).padStart(4, '0')}-${seedHash.slice(0, 16)}`;
      const paragraphId = `yrtk-${String(scene.sceneOrdinal + 1).padStart(2, '0')}-p-${seedHash.slice(0, 16)}`;
      const paraId = seedHash.slice(0, 8);
      const textId = crypto.createHash('sha256').update(`${seed}:textId`, 'utf8').digest('hex').slice(0, 8);
      const documentParagraphIndex = blocks.length;
      blocks.push({
        blockId,
        paragraphId,
        paraId,
        textId,
        text,
        sceneId: scene.sceneId,
        sceneOrdinal: scene.sceneOrdinal,
        documentParagraphIndex,
        sceneTitle: scene.title,
        canonicalTextSha256: sha256Text(text),
        canonicalMarksSha256: cryptoPort.sha256Json(formatIr),
        formatIr,
        wordSignals: [
          {
            kind: 'w14ParaIdTextId',
            value: { paraId, textId },
            applyAuthority: false,
          },
          {
            kind: 'bookmarkName',
            value: { name: deriveWordBookmarkNameV1({ roundId, sceneId: scene.sceneId, roundBlockOccurrenceId: index }) },
            applyAuthority: false,
          },
        ],
        locatorSignals: [
          {
            signalId: `${blockId}:signed-full-manuscript-scene-block-baseline`,
            kind: 'signed-scene-block-baseline-v1',
            authority: 'required-apply-authority',
            value: {
              scope: 'full-manuscript',
              sceneId: scene.sceneId,
              sceneOrdinal: scene.sceneOrdinal,
              documentParagraphIndex,
              blockId,
              paragraphId,
            },
          },
          {
            signalId: `${blockId}:w14-paraid-textid`,
            kind: 'w14-paraId-textId-v1',
            authority: 'word-native-placement-signal-only',
            value: { paraId, textId },
          },
        ],
      });
    }
  }
  return blocks;
}

// CANON-01: the full-manuscript hash tree is built with the SAME domain-separated bottom-up
// recipe the CoreManifest validator recomputes (domainBlock/domainScene/domainRoot). When the
// revisionBridge dependency surface exposes the shared builder, delegate to it so producer and
// validator are guaranteed to converge on one canonical tree; otherwise fall back to an inline
// implementation of the identical recipe.
function buildFullManuscriptHashTree({ projectId, scenes, blocks }, cryptoPort = createDefaultCryptoPort(), revisionBridge = {}) {
  const normOrdinal = (value) => (Number.isSafeInteger(value) ? value : null);
  const exportMap = {
    scenes: scenes.map((scene) => ({
      sceneId: scene.sceneId,
      sceneOrdinal: normOrdinal(scene.sceneOrdinal),
      sceneRevision: scene.sceneRevision,
      rawSha256: scene.rawSha256,
      blocks: blocks
        .filter((block) => block.sceneId === scene.sceneId)
        .map((block) => ({
          blockId: block.blockId,
          paragraphId: block.paragraphId,
          documentParagraphIndex: normOrdinal(block.documentParagraphIndex),
          canonicalTextSha256: block.canonicalTextSha256,
          canonicalMarksSha256: block.canonicalMarksSha256,
          formatIr: cloneJson(block.formatIr ?? null),
        })),
    })),
  };
  if (revisionBridge && typeof revisionBridge.buildWordV4ManifestHashTree === 'function') {
    const shared = revisionBridge.buildWordV4ManifestHashTree(exportMap, projectId, cryptoPort);
    if (shared && shared.ok) {
      return {
        rootDigest: shared.rootDigest,
        sceneDigests: shared.sceneDigests,
        blockDigests: shared.blockDigests,
      };
    }
  }
  const blocksBySceneId = new Map();
  for (const block of blocks) {
    if (!blocksBySceneId.has(block.sceneId)) blocksBySceneId.set(block.sceneId, []);
    blocksBySceneId.get(block.sceneId).push(block);
  }
  const blockDigests = blocks.map((block) => ({
    sceneId: block.sceneId,
    sceneOrdinal: normOrdinal(block.sceneOrdinal),
    documentParagraphIndex: normOrdinal(block.documentParagraphIndex),
    blockId: block.blockId,
    digest: cryptoPort.sha256Json({
      domain: 'domainBlock',
      sceneId: block.sceneId,
      sceneOrdinal: normOrdinal(block.sceneOrdinal),
      documentParagraphIndex: normOrdinal(block.documentParagraphIndex),
      blockId: block.blockId,
      paragraphId: block.paragraphId,
      canonicalTextSha256: block.canonicalTextSha256,
      canonicalMarksSha256: block.canonicalMarksSha256,
      formatIr: cloneJson(block.formatIr ?? null),
    }),
  }));
  const sceneDigests = scenes.map((scene) => {
    const sceneBlocks = blocksBySceneId.get(scene.sceneId) || [];
    return {
      sceneId: scene.sceneId,
      sceneOrdinal: normOrdinal(scene.sceneOrdinal),
      digest: cryptoPort.sha256Json({
        domain: 'domainScene',
        projectId,
        sceneId: scene.sceneId,
        sceneOrdinal: normOrdinal(scene.sceneOrdinal),
        sceneRevision: scene.sceneRevision,
        rawSha256: scene.rawSha256,
        blockDigests: sceneBlocks.map((block) => ({
          blockId: block.blockId,
          digest: blockDigests.find((entry) => entry.blockId === block.blockId)?.digest || '',
        })),
      }),
    };
  });
  return {
    rootDigest: cryptoPort.sha256Json({ domain: 'domainRoot', sceneDigests: sceneDigests.map((entry) => ({ sceneId: entry.sceneId, digest: entry.digest })) }),
    sceneDigests,
    blockDigests,
  };
}

function buildFullManuscriptCapabilityManifest(input = {}) {
  return {
    schemaVersion: 'yalken.rtk.word.full-manuscript-docx-review.capability-manifest.v1',
    commandId: FULL_MANUSCRIPT_REVIEW_DOCX_COMMAND_ID,
    capabilityId: FULL_MANUSCRIPT_REVIEW_DOCX_CAPABILITY_ID,
    route: [
      'capability-manifest',
      'typed-command-port',
      'command-surface-kernel',
      'canonical-project-truth-projection',
      'docx-review-packet-adapter',
      'existing-design-os-export-surface',
    ],
    scope: 'full-manuscript',
    preserves: [
      'ordered-scene-boundaries',
      'stable-scene-ids',
      'baseline-scene-revisions',
      'scene-hash-tree',
      'export-id',
      'hmac-authority',
      'no-loss-custom-xml-metadata',
    ],
    prohibits: [
      'direct-storage-mutation',
      'direct-ui-mutation',
      'harness-local-positive-authority',
      'synthetic-tail-positive-authority',
    ],
    sceneCount: Number.isInteger(input.sceneCount) ? input.sceneCount : 0,
    orderedSceneIds: Array.isArray(input.orderedSceneIds) ? input.orderedSceneIds.filter((sceneId) => typeof sceneId === 'string') : [],
  };
}

function buildFallbackRevisionBridgeManifest({
  profileId,
  projectId,
  roundId,
  exportId,
  exportedAtUtc,
  sceneSnapshots,
  hmacSecret,
  cryptoPort,
}) {
  const payload = {
    schemaVersion: 'yalken.rtk.review-transport-manifest.v2',
    profileId,
    manifestId: `transport-manifest-${roundId.replace(/^round-/u, '')}`,
    projectId,
    roundId,
    exportId,
    exportedAtUtc,
    sceneSnapshots,
  };
  return {
    ok: true,
    manifest: {
      ...payload,
      payloadDigest: cryptoPort.sha256Json(payload),
      signature: cryptoPort.hmacSha256Json(payload, hmacSecret),
      secretEmbeddedInDocx: false,
    },
  };
}

function buildFallbackCoreManifest({
  profileId,
  projectId,
  roundId,
  exportArtifactId,
  semanticReturnId,
  createdAtUtc,
  compileIrDigest,
  actualBaselineDigest,
  parserProfileDigest,
  capabilityProfileDigest,
  artifactIdentities,
  exportMap,
  hashTree,
  cryptoPort,
}) {
  const manifest = {
    schemaVersion: 'yalken.rtk.word-v4.core-manifest.v1',
    profileId,
    projectId,
    roundId,
    exportArtifactId,
    semanticReturnId,
    createdAtUtc,
    compileIrDigest,
    actualBaselineDigest,
    parserProfileDigest,
    capabilityProfileDigest,
    artifactIdentities,
    exportMap,
    hashTree,
  };
  return {
    ok: true,
    manifest,
    coreManifestDigest: cryptoPort.sha256Json(manifest),
  };
}

function buildFallbackYrtk2Token({ keyIdHex, roundIdHex, coreManifestDigest, hmacSecret, cryptoPort }) {
  const payload = {
    schemaVersion: 'yalken.rtk.word-v4-round-locator-token.v1',
    keyIdHex,
    roundIdHex,
    coreManifestDigest,
    secretEmbeddedInDocx: false,
  };
  const token = `YRTK2.${base64UrlEncode(JSON.stringify({
    ...payload,
    signature: cryptoPort.hmacSha256Json(payload, hmacSecret),
  }))}`;
  return {
    ok: true,
    ...payload,
    token,
    tokenLength: token.length,
  };
}

function buildFullManuscriptDocxReviewPacketSource(input = {}, deps = {}) {
  const cryptoPort = deps.cryptoPort || createDefaultCryptoPort();
  const normalized = normalizeFullManuscriptScenes(input);
  const { projectId, projectName, projectCreatedAtUtc, projectRoot, manifestPath, scenes } = normalized;
  const orderedSceneIds = scenes.map((scene) => scene.sceneId);
  const createdAtUtc = normalizeMetadataUtcTimestamp(
    typeof deps.createdAtUtc === 'string' ? deps.createdAtUtc : new Date().toISOString(),
    'FULL_MANUSCRIPT_EXPORT_CREATED_AT_INVALID',
  );
  const documentMetadata = buildFullManuscriptDocumentMetadata({
    projectId,
    projectName,
    projectCreatedAtUtc,
    exportedAtUtc: createdAtUtc,
  }, cryptoPort);
  const roundIdHex = typeof deps.roundIdHex === 'string' && /^[a-f0-9]{32}$/iu.test(deps.roundIdHex)
    ? deps.roundIdHex.toLowerCase()
    : crypto.randomBytes(16).toString('hex');
  const keyIdHex = typeof deps.keyIdHex === 'string' && /^[a-f0-9]{32}$/iu.test(deps.keyIdHex)
    ? deps.keyIdHex.toLowerCase()
    : crypto.randomBytes(16).toString('hex');
  const hmacSecret = typeof deps.hmacSecret === 'string' && deps.hmacSecret
    ? deps.hmacSecret
    : crypto.randomBytes(32).toString('hex');
  // ROUND-01 (V3): opaque keyRef + public correlation material. The raw
  // hmacSecret stays a local signing input; the durable capsule carries only
  // the keyRef so the secret never reaches disk / renderer / worker / DOCX.
  // main.js imports the secret into the main-process vault and OVERWRITES this
  // provisional keyRef with the real vault handle. When no keyRef is supplied
  // (e.g. test fixtures), a non-empty opaque local keyRef is generated so the
  // durable capsule always carries a resolvable keyRef correlation.
  const keyRef = typeof deps.keyRef === 'string' && deps.keyRef
    ? deps.keyRef
    : crypto.randomBytes(16).toString('hex');
  const roundId = `round-${roundIdHex}`;
  const exportId = `export-${roundIdHex}`;
  const exportArtifactId = `export-artifact-${roundIdHex}`;
  const semanticReturnId = `semantic-return-${roundIdHex}`;
  const blocks = buildFullManuscriptBlocks(scenes, cryptoPort, {
    roundId,
    deriveWordBookmarkNameV1: typeof deps.deriveWordBookmarkNameV1 === 'function'
      ? deps.deriveWordBookmarkNameV1
      : undefined,
  });
  const documentSections = buildFullManuscriptDocumentSections(scenes, blocks, cryptoPort);
  const commentExport = buildCanonicalCommentExport(input.nonTextReturnState, blocks, projectId);
  // Use authored paragraph boundaries, not the envelope's normalized display text.
  // This is computed from source blocks before serializing or parsing any DOCX.
  const sceneText = scenes.map((scene) => blocks
    .filter((block) => block.sceneId === scene.sceneId)
    .map((block) => block.text).join('\n')).join('\n\n');
  const sceneSnapshots = scenes.map((scene) => ({
    sceneId: scene.sceneId,
    sceneOrdinal: scene.sceneOrdinal,
    sceneRevision: scene.sceneRevision,
    rawSha256: scene.rawSha256,
    blocks: blocks
      .filter((block) => block.sceneId === scene.sceneId)
      .map((block) => ({
        blockId: block.blockId,
        paragraphId: block.paragraphId,
        documentParagraphIndex: block.documentParagraphIndex,
        canonicalTextSha256: block.canonicalTextSha256,
        canonicalMarksSha256: block.canonicalMarksSha256,
        formatIr: block.formatIr,
        locatorSignals: block.locatorSignals,
      })),
  }));
  const exportMap = {
    exportMapId: `export-map-${roundIdHex}`,
    profileId: FULL_MANUSCRIPT_REVIEW_DOCX_PROFILE_ID,
    scope: 'full-manuscript',
    roundId,
    ...(commentExport ? { commentExport } : {}),
    scenes: scenes.map((scene) => ({
      sceneId: scene.sceneId,
      sceneOrdinal: scene.sceneOrdinal,
      sceneRevision: scene.sceneRevision,
      rawSha256: scene.rawSha256,
      blocks: blocks
        .filter((block) => block.sceneId === scene.sceneId)
        .map((block) => ({
          blockId: block.blockId,
          paragraphId: block.paragraphId,
          documentParagraphIndex: block.documentParagraphIndex,
          canonicalTextSha256: block.canonicalTextSha256,
          canonicalMarksSha256: block.canonicalMarksSha256,
          formatIr: block.formatIr,
          wordSignals: block.wordSignals,
        })),
    })),
  };
  const revisionBridgeForHashTree = isPlainObjectValue(deps.revisionBridge) ? deps.revisionBridge : {};
  const hashTree = buildFullManuscriptHashTree({ projectId, scenes, blocks }, cryptoPort, revisionBridgeForHashTree);
  const fullBookRawSha256 = cryptoPort.sha256Json(scenes.map((scene) => ({
    sceneId: scene.sceneId,
    sceneOrdinal: scene.sceneOrdinal,
    rawSha256: scene.rawSha256,
  })));
  const capabilityManifest = buildFullManuscriptCapabilityManifest({
    sceneCount: scenes.length,
    orderedSceneIds,
  });
  const capabilityManifestDigest = cryptoPort.sha256Json(capabilityManifest);
  const parserProfileDigest = cryptoPort.sha256Json({
    parser: 'parseReviewTransportPackageV2',
    profile: FULL_MANUSCRIPT_REVIEW_DOCX_PROFILE_ID,
  });
  const provisionalBuffer = buildDocxReviewPacketBuffer({
    sceneText,
    blocks,
    commentExport,
    documentMetadata,
    documentSections,
    customProperties: [
      { name: REVIEW_DOCX_PACKET_AUTH_PROPERTY_NAME, value: 'YRTK1.provisional' },
      { name: REVIEW_DOCX_PACKET_YRTK2_PROPERTY_NAME, value: 'YRTK2.provisional' },
    ],
    advisoryManifest: {
      roundId,
      exportId,
      scope: 'full-manuscript',
      provisional: true,
    },
  });
  const provisionalDocxSha256 = `sha256:${crypto.createHash('sha256').update(provisionalBuffer).digest('hex')}`;
  const revisionBridge = isPlainObjectValue(deps.revisionBridge) ? deps.revisionBridge : {};
  const transportManifestResult = typeof revisionBridge.createReviewTransportManifestV2 === 'function'
    ? revisionBridge.createReviewTransportManifestV2({
        profileId: FULL_MANUSCRIPT_REVIEW_DOCX_PROFILE_ID,
        manifestId: `transport-manifest-${roundIdHex}`,
        projectId,
        roundId,
        exportId,
        exportedAtUtc: createdAtUtc,
        sceneSnapshots,
        hmacSecret,
        keyId: 'product-review-docx-local-secret-v1',
      }, { cryptoPort })
    : buildFallbackRevisionBridgeManifest({
        profileId: FULL_MANUSCRIPT_REVIEW_DOCX_PROFILE_ID,
        projectId,
        roundId,
        exportId,
        exportedAtUtc: createdAtUtc,
        sceneSnapshots,
        hmacSecret,
        cryptoPort,
      });
  if (!transportManifestResult || transportManifestResult.ok !== true) {
    throw makeError('FULL_MANUSCRIPT_TRANSPORT_MANIFEST_BLOCKED');
  }
  const coreManifestInput = {
    profileId: FULL_MANUSCRIPT_REVIEW_DOCX_PROFILE_ID,
    projectId,
    roundId,
    exportArtifactId,
    semanticReturnId,
    createdAtUtc,
    compileIrDigest: cryptoPort.sha256Json({ scope: 'full-manuscript', orderedSceneIds, blocks: blocks.map((block) => block.blockId),
      documentMetadataDigest: documentMetadata.protectedDigest,
      documentSectionsDigest: documentSections.protectedDigest,
      ...(commentExport ? { commentExportDigest: cryptoPort.sha256Json(commentExport) } : {}) }),
    actualBaselineDigest: fullBookRawSha256,
    parserProfileDigest,
    capabilityProfileDigest: capabilityManifestDigest,
    artifactIdentities: {
      provisionalDocxSha256,
      returnArtifactId: '',
      applyId: '',
      effectIds: [],
    },
    exportMap,
    hashTree,
  };
  const coreManifestResult = typeof revisionBridge.createWordV4CoreManifest === 'function'
    ? revisionBridge.createWordV4CoreManifest(coreManifestInput, { cryptoPort })
    : buildFallbackCoreManifest({ ...coreManifestInput, cryptoPort });
  if (!coreManifestResult || coreManifestResult.ok !== true) {
    throw makeError('FULL_MANUSCRIPT_CORE_MANIFEST_BLOCKED');
  }
  const yrtk2Result = typeof revisionBridge.createYrtk2RoundLocatorToken === 'function'
    ? revisionBridge.createYrtk2RoundLocatorToken({
        keyIdHex,
        roundIdHex,
        coreManifestDigest: coreManifestResult.coreManifestDigest,
        hmacSecret,
        secretEmbeddedInDocx: false,
      }, { cryptoPort })
    : buildFallbackYrtk2Token({
        keyIdHex,
        roundIdHex,
        coreManifestDigest: coreManifestResult.coreManifestDigest,
        hmacSecret,
        cryptoPort,
      });
  if (!yrtk2Result || yrtk2Result.ok !== true) {
    throw makeError('FULL_MANUSCRIPT_YRTK2_BLOCKED');
  }
  const authorityPayload = {
    schemaVersion: 'yalken.rtk.locator-authority-envelope.c01.v1',
    taskId: 'YALKEN_WORD_FULL_BOOK_EDITORIAL_ROUNDTRIP_CERTIFICATION_V2',
    profileId: FULL_MANUSCRIPT_REVIEW_DOCX_PROFILE_ID,
    caseId: 'product-review-docx-export-c5v2-full-manuscript',
    scope: 'full-manuscript',
    projectId,
    sceneCount: scenes.length,
    orderedSceneIds,
    sceneRevisions: scenes.map((scene) => ({
      sceneId: scene.sceneId,
      sceneOrdinal: scene.sceneOrdinal,
      sceneRevision: scene.sceneRevision,
      rawSha256: scene.rawSha256,
    })),
    fullBookRawSha256,
    roundId,
    exportId,
    exportArtifactId,
    semanticReturnId,
    coreManifestDigest: coreManifestResult.coreManifestDigest,
    transportManifestDigest: transportManifestResult.manifest.payloadDigest,
    yrtk2TokenDigest: cryptoPort.sha256Text(yrtk2Result.token),
    capabilityManifestDigest,
    documentMetadataDigest: documentMetadata.protectedDigest,
    documentSectionsDigest: documentSections.protectedDigest,
    blockCount: blocks.length,
    ...(commentExport ? { commentSummary: {
      stateRevision: commentExport.stateRevision,
      exportedThreadCount: commentExport.threads.length,
      exportedMessageCount: commentExport.threads.reduce((sum, thread) => sum + thread.messages.length, 0),
      intentionalDeletionCount: commentExport.tombstones.length,
    } } : {}),
    ...(commentExport ? { commentStateDigest: commentExport.stateDigest } : {}),
  };
  const authorityEncoded = buildAuthorityEnvelope(authorityPayload, hmacSecret, cryptoPort);
  const exportCapsule = {
    schemaVersion: 'yalken.rtk.word.product-review-docx-export.v1',
    ...(commentExport ? { commentSummary: { ...authorityPayload.commentSummary } } : {}),
    projectId,
    profileId: FULL_MANUSCRIPT_REVIEW_DOCX_PROFILE_ID,
    scope: 'full-manuscript',
    fullManuscript: true,
    sceneCount: scenes.length,
    orderedSceneIds,
    sceneId: '',
    sceneRevision: '',
    rawSha256: '',
    fullBookRawSha256,
    roundId,
    exportId,
    exportArtifactId,
    semanticReturnId,
    coreManifestDigest: coreManifestResult.coreManifestDigest,
    transportManifestDigest: transportManifestResult.manifest.payloadDigest,
    yrtk2TokenLength: yrtk2Result.tokenLength,
    capabilityManifestDigest,
    documentMetadataDigest: documentMetadata.protectedDigest,
    documentSectionsDigest: documentSections.protectedDigest,
    blockCount: blocks.length,
    authorityCarrier: 'customDocumentProperty',
    authorityPropertyName: REVIEW_DOCX_PACKET_AUTH_PROPERTY_NAME,
    secretEmbeddedInDocx: false,
    automaticApplyCertified: false,
    productRuntimeWired: true,
    returnIntakeWired: true,
  };
  const scenePathBySceneId = {};
  const baselineFinalTextBySceneId = {};
  for (const scene of scenes) {
    scenePathBySceneId[scene.sceneId] = scene.scenePath;
    baselineFinalTextBySceneId[scene.sceneId] = scene.text;
  }
  const localAuthorityCapsule = {
    schemaVersion: 'yalken.rtk.word.product-review-docx-export.local-authority.v1',
    projectRoot,
    manifestPath,
    profileId: FULL_MANUSCRIPT_REVIEW_DOCX_PROFILE_ID,
    scope: 'full-manuscript',
    scenePathBySceneId,
    baselineFinalTextBySceneId,
    // ROUND-01 (V3): opaque keyRef + public correlation material alongside the
    // in-memory hmacSecret. The DURABLE record (buildDocxReviewReturnAuthorityStoreRecord)
    // redacts hmacSecret and keeps only keyRef; the in-memory capsule retains the
    // secret so the downstream return-router proof binding can still compute its
    // HMAC during a live session without a vault round-trip.
    hmacSecret,
    keyRef,
    keyIdHex: yrtk2Result.keyIdHex,
    roundIdHex: yrtk2Result.roundIdHex,
    lifecycleState: 'ALLOCATED',
    recordVersion: 1,
    expectedAuthority: {
      profileId: FULL_MANUSCRIPT_REVIEW_DOCX_PROFILE_ID,
      scope: 'full-manuscript',
      sceneCount: scenes.length,
      orderedSceneIds,
      fullBookRawSha256,
      roundId,
      exportId,
      capabilityManifestDigest,
      documentMetadataDigest: documentMetadata.protectedDigest,
      documentSectionsDigest: documentSections.protectedDigest,
    },
    roundId,
    exportIdentity: exportId,
    manifestDigest: transportManifestResult.manifest.payloadDigest,
    coreManifestDigest: coreManifestResult.coreManifestDigest,
    documentMetadata: cloneJson(documentMetadata),
    documentSections: cloneJson(documentSections),
    parserProfileDigest,
    yrtk2: {
      schemaVersion: yrtk2Result.schemaVersion,
      tokenDigest: cryptoPort.sha256Text(yrtk2Result.token),
      tokenLength: yrtk2Result.tokenLength,
      keyIdHex: yrtk2Result.keyIdHex,
      roundIdHex: yrtk2Result.roundIdHex,
      coreManifestDigest: yrtk2Result.coreManifestDigest,
      secretEmbeddedInDocx: false,
    },
    exportMap,
    commentExport,
  };
  return {
    sceneText,
    blocks,
    commentExport,
    documentMetadata,
    documentSections,
    forbiddenSecret: hmacSecret,
    customProperties: [
      { name: REVIEW_DOCX_PACKET_AUTH_PROPERTY_NAME, value: authorityEncoded },
      { name: REVIEW_DOCX_PACKET_YRTK2_PROPERTY_NAME, value: yrtk2Result.token },
      { name: REVIEW_DOCX_PACKET_CORE_DIGEST_PROPERTY_NAME, value: coreManifestResult.coreManifestDigest },
    ],
    advisoryManifest: {
      schemaVersion: 'yalken.rtk.word.product-review-docx-export.advisory-manifest.v1',
      scope: 'full-manuscript',
      capabilityManifest,
      capabilityManifestDigest,
      documentMetadata: {
        schemaVersion: documentMetadata.schemaVersion,
        protectedProperties: documentMetadata.protectedProperties,
        protectedDigest: documentMetadata.protectedDigest,
        policies: documentMetadata.policies,
      },
      documentSections: {
        schemaVersion: documentSections.schemaVersion,
        protectedDigest: documentSections.protectedDigest,
        protectedSections: documentSections.protectedSections,
        sourceBindings: documentSections.sourceBindings,
        policies: documentSections.policies,
      },
      coreManifest: coreManifestResult.manifest,
      transportManifest: transportManifestResult.manifest,
      yrtk2: {
        schemaVersion: yrtk2Result.schemaVersion,
        tokenLength: yrtk2Result.tokenLength,
        keyIdHex: yrtk2Result.keyIdHex,
        roundIdHex: yrtk2Result.roundIdHex,
        coreManifestDigest: yrtk2Result.coreManifestDigest,
        secretEmbeddedInDocx: false,
      },
      authorityCarrier: {
        carrier: 'customDocumentProperty',
        propertyName: REVIEW_DOCX_PACKET_AUTH_PROPERTY_NAME,
        legacyC01Compatibility: true,
      },
      nonClaims: {
        customXmlApplyAuthority: false,
        automaticApplyCertified: false,
        harnessLocalPositiveAuthority: false,
      },
    },
    provisionalSelfParseArtifact: {
      schemaVersion: 'yalken.rtk.word.v4.provisional-docx-self-parse-artifact.v1',
      provisionalDocxSha256,
      bytes: provisionalBuffer,
      expectedDocumentTextSha256: cryptoPort.sha256Json({
        sceneText,
      }),
    },
    exportCapsule,
    localAuthorityCapsule,
  };
}

function validateFullManuscriptAuthorityReturn(returned = {}, localAuthority = {}) {
  const expected = isPlainObjectValue(localAuthority.expectedAuthority) ? localAuthority.expectedAuthority : {};
  const orderedSceneIds = Array.isArray(returned.orderedSceneIds) ? returned.orderedSceneIds.filter((sceneId) => typeof sceneId === 'string') : [];
  if (returned.scope !== 'full-manuscript') {
    return { ok: false, code: 'FULL_MANUSCRIPT_RETURN_SCOPE_REQUIRED' };
  }
  if (returned.roundId !== expected.roundId || returned.exportId !== expected.exportId) {
    return { ok: false, code: 'FULL_MANUSCRIPT_RETURN_EXPORT_ID_MISMATCH' };
  }
  if (returned.fullBookRawSha256 !== expected.fullBookRawSha256) {
    return { ok: false, code: 'FULL_MANUSCRIPT_RETURN_BASELINE_STALE_OR_TAMPERED' };
  }
  if (orderedSceneIds.length !== expected.orderedSceneIds?.length) {
    return { ok: false, code: 'FULL_MANUSCRIPT_RETURN_SCENE_COUNT_MISMATCH' };
  }
  for (let index = 0; index < orderedSceneIds.length; index += 1) {
    if (orderedSceneIds[index] !== expected.orderedSceneIds[index]) {
      return { ok: false, code: 'FULL_MANUSCRIPT_RETURN_SCENE_ORDER_MISMATCH' };
    }
  }
  return { ok: true };
}

module.exports = {
  FULL_MANUSCRIPT_REVIEW_DOCX_COMMAND_ID,
  FULL_MANUSCRIPT_REVIEW_DOCX_CAPABILITY_ID,
  FULL_MANUSCRIPT_REVIEW_DOCX_PROFILE_ID,
  FULL_MANUSCRIPT_FORMAT_IR_SCHEMA,
  WORD_DOCUMENT_SECTIONS_SCHEMA,
  REVIEW_DOCX_PACKET_AUTH_PROPERTY_NAME,
  REVIEW_DOCX_PACKET_YRTK2_PROPERTY_NAME,
  REVIEW_DOCX_PACKET_CORE_DIGEST_PROPERTY_NAME,
  buildFullManuscriptCapabilityManifest,
  buildFullManuscriptDocxReviewPacketSource,
  buildFullManuscriptDocumentMetadata,
  buildFullManuscriptDocumentSections,
  buildFullManuscriptBlocks,
  buildFormatIrParagraphs,
  normalizeFullManuscriptScenes,
  validateFullManuscriptDocumentMetadataReturn,
  validateFullManuscriptDocumentSectionsReturn,
  validateFullManuscriptAuthorityReturn,
};
