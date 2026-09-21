'use strict';

const { buildStoredZip } = require('./docxMinBuilder');
const {
  buildDocxRunContentXml,
  escapeXml,
  normalizeDocxTextForSerialization,
} = require('./docxTextXml.js');
const { buildDocxColorPropertiesXml } = require('./docxInlineColors.js');
const { buildDocxTypographyPropertiesXml } = require('./docxInlineTypography.js');
const { toWordParagraphAlignment } = require('../../io/paragraphAlignment.cjs');
const { docxBlockStyleId, buildDocxBlockStyleDefinitions } = require('./docxBlockStyles.js');
const { commentPackageParts, commentMarkersForBlock } = require('./docxReviewPacketComments.js');

const WORD_MAIN_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const WORD_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const W14_NS = 'http://schemas.microsoft.com/office/word/2010/wordml';
const OFFICE_DOCUMENT_REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CUSTOM_PROPS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties';
const CUSTOM_PROPS_VT_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes';
const CUSTOM_XML_PROPS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/customXml';
const CORE_PROPS_NS = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties';
const DC_NS = 'http://purl.org/dc/elements/1.1/';
const DCTERMS_NS = 'http://purl.org/dc/terms/';
const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';
const CORE_PROPS_CONTENT_TYPE = 'application/vnd.openxmlformats-package.core-properties+xml';
const CORE_PROPS_REL_TYPE = 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties';
const WORD_SETTINGS_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml';
const WORD_SETTINGS_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings';
const WORD_NUMBERING_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml';
const WORD_NUMBERING_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering';
const WORD_STYLES_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml';
const WORD_STYLES_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles';
const WORD_COMPATIBILITY_URI = 'http://schemas.microsoft.com/office/word';
const FORMAT_IR_SCHEMA = 'yalken.rtk.format-ir.v1';
const WORD_DOCUMENT_SECTIONS_SCHEMA = 'yalken.rtk.word.document-sections.v1';
const RTK_WORD_BOOKMARK_V1_DOMAIN = 'word-bookmark-v1';

// EXPORT-01 (P0-20): the builder is FORBIDDEN from inventing a bookmark name.
// The single source of truth is deriveWordBookmarkNameV1 in
// src/io/revisionBridge/reviewTransportWordBookmarkV1.mjs; the declared name
// arrives in block.wordSignals[].bookmarkName.value.name (produced by the
// packet source / main.js) and is emitted BYTE-FOR-BYTE into w:bookmarkStart.
// When no declared bookmarkName signal is present the builder fails with a
// typed error rather than synthesizing one (synthesis was the P0-20 defect:
// the resolver could then fabricate authority for an undeclared bookmark).
function canonicalWordBookmarkIdentityJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalWordBookmarkIdentityJson(item)).join(',')}]`;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalWordBookmarkIdentityJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// EXPORT-01 (P0-20): re-export the unified generator so there is one importable
// entry point for CJS consumers (the canonical ESM module remains the single
// implementation; this is the byte-identical producer-inline copy, verified by
// contract EXPORT01-E2/E7). ESM consumers should import directly from
// reviewTransportWordBookmarkV1.mjs.
function deriveWordBookmarkNameV1(input = {}) {
  const crypto = require('crypto');
  const source = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
  const roundId = String(source.roundId ?? '');
  const sceneId = String(source.sceneId ?? '');
  const roundBlockOccurrenceId = String(source.roundBlockOccurrenceId ?? '');
  const identity = canonicalWordBookmarkIdentityJson({ roundBlockOccurrenceId, roundId, sceneId });
  const digest = crypto.createHash('sha256').update(`${RTK_WORD_BOOKMARK_V1_DOMAIN}${identity}`, 'utf8').digest('hex');
  return `YRTK_${digest.slice(0, 32)}`;
}

function readDeclaredBookmarkName(block) {
  const signals = Array.isArray(block?.wordSignals) ? block.wordSignals : [];
  for (const signal of signals) {
    if (signal && typeof signal === 'object' && signal.kind === 'bookmarkName') {
      const name = normalizeString(signal.value?.name);
      if (name) return name;
    }
  }
  return '';
}

function isPlainObjectValue(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeString(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeDocxXmlText(value) {
  return normalizeDocxTextForSerialization(normalizeString(value));
}

function normalizeReviewPacketBlocks(input = {}) {
  const sourceBlocks = Array.isArray(input.blocks) ? input.blocks : [];
  const fallbackText = normalizeDocxXmlText(input.sceneText);
  const fallbackBlocks = fallbackText.split('\n').map((text, index) => ({
    blockId: `block-${String(index + 1).padStart(4, '0')}`,
    paragraphId: `p-${String(index + 1).padStart(4, '0')}`,
    text,
  }));
  return (sourceBlocks.length > 0 ? sourceBlocks : fallbackBlocks)
    .filter(isPlainObjectValue)
    .map((block, index) => ({
      blockId: normalizeString(block.blockId) || `block-${String(index + 1).padStart(4, '0')}`,
      paragraphId: normalizeString(block.paragraphId) || `p-${String(index + 1).padStart(4, '0')}`,
      sceneId: normalizeString(block.sceneId),
      sceneOrdinal: Number.isInteger(block.sceneOrdinal) && block.sceneOrdinal >= 0 ? block.sceneOrdinal : null,
      sceneTitle: normalizeString(block.sceneTitle),
      sceneBoundary: block.sceneBoundary === true,
      paraId: normalizeString(block.paraId).replace(/[^a-fA-F0-9]/g, '').slice(0, 8).padStart(8, '0'),
      textId: normalizeString(block.textId).replace(/[^a-fA-F0-9]/g, '').slice(0, 8).padStart(8, '0'),
      text: normalizeDocxXmlText(block.text),
      formatIr: isPlainObjectValue(block.formatIr) && block.formatIr.schemaVersion === FORMAT_IR_SCHEMA
        ? JSON.parse(JSON.stringify(block.formatIr))
        : null,
      // EXPORT-01 (P0-20): carry the declared bookmark-name wordSignal through
      // normalization so buildParagraphXml can emit it BYTE-FOR-BYTE. The
      // builder never invents a name.
      wordSignals: Array.isArray(block.wordSignals) ? block.wordSignals.filter(isPlainObjectValue) : [],
    }));
}

// EXPORT-01 (P0-20): the builder is forbidden from synthesizing a bookmark name
// for the full-manuscript / single-scene product path — those blocks ALWAYS
// carry a declared bookmarkName signal (produced by deriveWordBookmarkNameV1),
// which buildParagraphXml emits BYTE-FOR-BYTE. A legacy minimal-packet caller
// (P0 review exporter fixture) may pass blocks without wordSignals; for that
// narrow legacy path the builder falls back to a deterministic blockId-derived
// name rather than crashing. This fallback does NOT grant resolver authority:
// the revisionBridge resolver (EXPORT-01) admits ONLY declared bookmarkName
// signals, so a fallback-emitted bookmark can never fabricate return-intake
// authority. The product full-manuscript path never hits this fallback because
// fullManuscriptDocxReviewPacketSource and main.js both emit declared signals.
function resolveBookmarkName(block, index) {
  const declaredName = readDeclaredBookmarkName(block);
  if (declaredName) return declaredName;
  const raw = normalizeString(block?.blockId).replace(/[^A-Za-z0-9_]/g, '');
  const safe = raw || `block${index + 1}`;
  return `YRTK_${String(index + 1).padStart(4, '0')}_${safe}`.slice(0, 40);
}

function buildRunPropertiesXml(inline = {}, preservedMarks = []) {
  const properties = [];
  if (preservedMarks.some((mark) => mark?.type === 'code')) {
    properties.push('<w:rStyle w:val="YalkenInlineCode"/>');
  }
  if (inline.bold === true) properties.push('<w:b/>');
  if (inline.italic === true) properties.push('<w:i/>');
  if (inline.underline === true) properties.push('<w:u w:val="single"/>');
  if (inline.strike === true) properties.push('<w:strike/>');
  const colors = buildDocxColorPropertiesXml(inline);
  if (colors) properties.push(colors);
  const typography = buildDocxTypographyPropertiesXml(inline);
  if (typography) properties.push(typography);
  return properties.length > 0 ? `<w:rPr>${properties.join('')}</w:rPr>` : '';
}

function buildRunContentXml(text) {
  return buildDocxRunContentXml(normalizeDocxXmlText(text), { allowFormFeedPageBreak: true });
}

function buildFormatIrRunsXml(block, hyperlinkByHref) {
  const runs = Array.isArray(block.formatIr?.runs) ? block.formatIr.runs : [];
  if (runs.length === 0) {
    const content = buildRunContentXml(block.text);
    return content ? `<w:r>${content}</w:r>` : '';
  }
  const text = runs.map((run) => normalizeString(run?.text)).join('');
  if (text !== block.text) throw new Error('DOCX_REVIEW_PACKET_FORMAT_IR_TEXT_MISMATCH');
  return runs.map((run) => {
    const content = buildRunContentXml(run.text);
    if (!content) return '';
    const preservedMarks = Array.isArray(run.preservedMarks) ? run.preservedMarks : [];
    const unsupported = preservedMarks.filter((mark) => !['link', 'code'].includes(mark?.type));
    if (unsupported.length > 0) throw new Error('DOCX_REVIEW_PACKET_FORMAT_IR_PRESERVED_MARK_UNSUPPORTED');
    const runXml = `<w:r>${buildRunPropertiesXml(run.inline, preservedMarks)}${content}</w:r>`;
    const link = preservedMarks.find((mark) => mark?.type === 'link');
    if (!link) return runXml;
    const href = normalizeString(link.attrs?.href);
    const relationshipId = hyperlinkByHref.get(href);
    if (!relationshipId) throw new Error('DOCX_REVIEW_PACKET_FORMAT_IR_LINK_RELATIONSHIP_MISSING');
    return `<w:hyperlink r:id="${escapeXml(relationshipId)}">${runXml}</w:hyperlink>`;
  }).join('');
}

function buildCommentedRunsXml(block, hyperlinkByHref, markers) {
  const runs = block.formatIr?.runs?.length ? block.formatIr.runs : [{ text: block.text }];
  if (runs.map(run => normalizeString(run.text)).join('') !== block.text) {
    throw new Error('DOCX_REVIEW_PACKET_FORMAT_IR_TEXT_MISMATCH');
  }
  const boundaries = [...markers.keys()].sort((a, b) => a - b);
  let offset = 0;
  const output = [];
  for (const run of runs) {
    const end = offset + run.text.length;
    const cuts = [offset, ...boundaries.filter(value => value > offset && value < end), end];
    for (let index = 0; index < cuts.length - 1; index += 1) {
      const start = cuts[index];
      if (markers.has(start)) { output.push(markers.get(start)); markers.delete(start); }
      const part = run.text.slice(start - offset, cuts[index + 1] - offset);
      output.push(buildFormatIrRunsXml({ ...block, text: part, formatIr: { runs: [{ ...run, text: part }] } }, hyperlinkByHref));
    }
    offset = end;
  }
  if (markers.has(offset)) { output.push(markers.get(offset)); markers.delete(offset); }
  if (markers.size) throw new Error('DOCX_COMMENT_ANCHOR_UNEMITTED');
  return output.join('');
}

function sectionInteger(value, code, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(code);
  return value;
}

function normalizeDocumentSections(input, blockCount) {
  if (!isPlainObjectValue(input)) return null;
  if (input.schemaVersion !== WORD_DOCUMENT_SECTIONS_SCHEMA) {
    throw new Error('DOCX_REVIEW_PACKET_DOCUMENT_SECTIONS_SCHEMA_INVALID');
  }
  const source = Array.isArray(input.protectedSections) ? input.protectedSections : [];
  if (source.length < 1 || !Number.isSafeInteger(blockCount) || blockCount < 1) {
    throw new Error('DOCX_REVIEW_PACKET_DOCUMENT_SECTIONS_REQUIRED');
  }
  const sections = source.map((section, index) => {
    if (!isPlainObjectValue(section) || section.ordinal !== index) {
      throw new Error('DOCX_REVIEW_PACKET_DOCUMENT_SECTION_ORDINAL_INVALID');
    }
    const startParagraphIndex = sectionInteger(
      section.startParagraphIndex,
      'DOCX_REVIEW_PACKET_DOCUMENT_SECTION_START_INVALID',
    );
    const endParagraphIndex = sectionInteger(
      section.endParagraphIndex,
      'DOCX_REVIEW_PACKET_DOCUMENT_SECTION_END_INVALID',
    );
    const final = index === source.length - 1;
    if (endParagraphIndex < startParagraphIndex
      || startParagraphIndex !== (index === 0 ? 0 : source[index - 1].endParagraphIndex + 1)
      || (final ? endParagraphIndex !== blockCount - 1 : endParagraphIndex >= blockCount - 1)
      || section.breakPlacement !== (final ? 'BODY_FINAL' : 'PARAGRAPH_PROPERTIES')) {
      throw new Error('DOCX_REVIEW_PACKET_DOCUMENT_SECTION_BOUNDARY_INVALID');
    }
    const properties = isPlainObjectValue(section.properties) ? section.properties : {};
    const pageSize = isPlainObjectValue(properties.pageSize) ? properties.pageSize : {};
    const margins = isPlainObjectValue(properties.margins) ? properties.margins : {};
    const columns = isPlainObjectValue(properties.columns) ? properties.columns : {};
    const type = normalizeString(properties.type);
    const orientation = normalizeString(pageSize.orientation);
    if (!['nextPage', 'continuous', 'evenPage', 'oddPage'].includes(type)
      || !['portrait', 'landscape'].includes(orientation)) {
      throw new Error('DOCX_REVIEW_PACKET_DOCUMENT_SECTION_PROPERTIES_INVALID');
    }
    return {
      ordinal: index,
      startParagraphIndex,
      endParagraphIndex,
      breakPlacement: section.breakPlacement,
      properties: {
        type,
        pageSize: {
          widthTwips: sectionInteger(pageSize.widthTwips, 'DOCX_REVIEW_PACKET_DOCUMENT_SECTION_PAGE_SIZE_INVALID', 1),
          heightTwips: sectionInteger(pageSize.heightTwips, 'DOCX_REVIEW_PACKET_DOCUMENT_SECTION_PAGE_SIZE_INVALID', 1),
          orientation,
        },
        margins: {
          topTwips: sectionInteger(margins.topTwips, 'DOCX_REVIEW_PACKET_DOCUMENT_SECTION_MARGINS_INVALID'),
          rightTwips: sectionInteger(margins.rightTwips, 'DOCX_REVIEW_PACKET_DOCUMENT_SECTION_MARGINS_INVALID'),
          bottomTwips: sectionInteger(margins.bottomTwips, 'DOCX_REVIEW_PACKET_DOCUMENT_SECTION_MARGINS_INVALID'),
          leftTwips: sectionInteger(margins.leftTwips, 'DOCX_REVIEW_PACKET_DOCUMENT_SECTION_MARGINS_INVALID'),
          headerTwips: sectionInteger(margins.headerTwips, 'DOCX_REVIEW_PACKET_DOCUMENT_SECTION_MARGINS_INVALID'),
          footerTwips: sectionInteger(margins.footerTwips, 'DOCX_REVIEW_PACKET_DOCUMENT_SECTION_MARGINS_INVALID'),
          gutterTwips: sectionInteger(margins.gutterTwips, 'DOCX_REVIEW_PACKET_DOCUMENT_SECTION_MARGINS_INVALID'),
        },
        columns: {
          count: sectionInteger(columns.count, 'DOCX_REVIEW_PACKET_DOCUMENT_SECTION_COLUMNS_INVALID', 1),
          spaceTwips: sectionInteger(columns.spaceTwips, 'DOCX_REVIEW_PACKET_DOCUMENT_SECTION_COLUMNS_INVALID'),
        },
      },
    };
  });
  return { schemaVersion: WORD_DOCUMENT_SECTIONS_SCHEMA, protectedSections: sections };
}

function buildSectionPropertiesXml(section, options = {}) {
  const properties = section.properties;
  const pageSize = properties.pageSize;
  const margins = properties.margins;
  const columns = properties.columns;
  return [
    '<w:sectPr>',
    ...(options.final === true ? [] : [`<w:type w:val="${escapeXml(properties.type)}"/>`]),
    `<w:pgSz w:w="${pageSize.widthTwips}" w:h="${pageSize.heightTwips}" w:orient="${escapeXml(pageSize.orientation)}"/>`,
    `<w:pgMar w:top="${margins.topTwips}" w:right="${margins.rightTwips}" w:bottom="${margins.bottomTwips}" w:left="${margins.leftTwips}" w:header="${margins.headerTwips}" w:footer="${margins.footerTwips}" w:gutter="${margins.gutterTwips}"/>`,
    `<w:cols w:num="${columns.count}" w:space="${columns.spaceTwips}"/>`,
    '</w:sectPr>',
  ].join('');
}

function buildParagraphXml(block, index, hyperlinkByHref, commentExport, sectionBreak = null) {
  const bookmarkId = String(index + 1);
  const bookmarkName = resolveBookmarkName(block, index);
  const markers = commentMarkersForBlock(commentExport, block);
  const textRun = markers.size ? buildCommentedRunsXml(block, hyperlinkByHref, markers)
    : buildFormatIrRunsXml(block, hyperlinkByHref);
  const textAlign = toWordParagraphAlignment(block.formatIr?.paragraph?.textAlign);
  const headingLevel = Number(block.formatIr?.paragraph?.headingLevel);
  const paragraphPropertyParts = [];
  if (textAlign) {
    paragraphPropertyParts.push(`<w:jc w:val="${textAlign}"/>`);
  }
  if (block.formatIr?.paragraph?.nodeType === 'heading') {
    if (!Number.isSafeInteger(headingLevel) || headingLevel < 1 || headingLevel > 6) {
      throw new Error('DOCX_REVIEW_PACKET_FORMAT_IR_HEADING_LEVEL_UNSUPPORTED');
    }
    paragraphPropertyParts.push(`<w:outlineLvl w:val="${headingLevel - 1}"/>`);
  }
  const blockquoteDepth = Number(block.formatIr?.paragraph?.blockquoteDepth || 0);
  const blockStyleId = docxBlockStyleId(block.formatIr?.paragraph?.nodeType === 'codeBlock', blockquoteDepth);
  if (blockStyleId) paragraphPropertyParts.unshift(`<w:pStyle w:val="${blockStyleId}"/>`);
  if (Number.isSafeInteger(blockquoteDepth) && blockquoteDepth > 0 && blockquoteDepth <= 8) {
    paragraphPropertyParts.push(`<w:ind w:left="${blockquoteDepth * 720}"/>`);
  }
  const list = block.formatIr?.paragraph?.list;
  if (isPlainObjectValue(list)) {
    const level = Number(list.level);
    const numId = Number(list.numId);
    if (!['bullet', 'ordered'].includes(list.kind)
      || !Number.isSafeInteger(level) || level < 0 || level > 8
      || !Number.isSafeInteger(numId) || numId < 1) {
      throw new Error('DOCX_REVIEW_PACKET_FORMAT_IR_LIST_UNSUPPORTED');
    }
    paragraphPropertyParts.push(`<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr>`);
  }
  if (block.formatIr?.paragraph?.nodeType === 'horizontalRule') {
    paragraphPropertyParts.push('<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr>');
  }
  if (sectionBreak) paragraphPropertyParts.push(buildSectionPropertiesXml(sectionBreak));
  const paragraphProperties = paragraphPropertyParts.length > 0
    ? `<w:pPr>${paragraphPropertyParts.join('')}</w:pPr>`
    : '';
  return [
    `<w:p w14:paraId="${escapeXml(block.paraId)}" w14:textId="${escapeXml(block.textId)}">`,
    paragraphProperties,
    `<w:bookmarkStart w:id="${bookmarkId}" w:name="${escapeXml(bookmarkName)}"/>`,
    textRun,
    `<w:bookmarkEnd w:id="${bookmarkId}"/>`,
    '</w:p>',
  ].join('');
}

function buildDocumentXml(blocks, hyperlinkByHref, commentExport, documentSections) {
  const normalizedSections = normalizeDocumentSections(documentSections, blocks.length);
  const paragraphBreaks = new Map((normalizedSections?.protectedSections || [])
    .filter((section) => section.breakPlacement === 'PARAGRAPH_PROPERTIES')
    .map((section) => [section.endParagraphIndex, section]));
  const paragraphs = blocks.map((block, index) => buildParagraphXml(
    block,
    index,
    hyperlinkByHref,
    commentExport,
    paragraphBreaks.get(index) || null,
  )).join('');
  const finalSection = normalizedSections?.protectedSections?.at(-1);
  const finalSectionXml = finalSection
    ? buildSectionPropertiesXml(finalSection, { final: true })
    : '<w:sectPr/>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${WORD_MAIN_NS}" xmlns:w14="${W14_NS}" xmlns:r="${OFFICE_DOCUMENT_REL_NS}">
  <w:body>
    ${paragraphs || '<w:p/>'}
    ${finalSectionXml}
  </w:body>
</w:document>`;
}

function normalizeCustomProperties(properties = []) {
  return (Array.isArray(properties) ? properties : [])
    .filter(isPlainObjectValue)
    .map((property) => ({
      name: normalizeString(property.name).trim(),
      value: normalizeString(property.value),
    }))
    .filter((property) => property.name && property.value);
}

function normalizeDocumentMetadata(input) {
  if (!isPlainObjectValue(input)) return null;
  if (input.schemaVersion !== 'yalken.rtk.word.document-metadata.v1') {
    throw new Error('DOCX_REVIEW_PACKET_DOCUMENT_METADATA_SCHEMA_INVALID');
  }
  const core = isPlainObjectValue(input.coreProperties) ? input.coreProperties : {};
  const coreProperties = {
    title: normalizeString(core.title),
    creator: normalizeString(core.creator),
    lastModifiedBy: normalizeString(core.lastModifiedBy),
    createdAtUtc: normalizeString(core.createdAtUtc),
    modifiedAtUtc: normalizeString(core.modifiedAtUtc),
    revision: normalizeString(core.revision),
    identifier: normalizeString(core.identifier),
  };
  if (Object.values(coreProperties).some((value) => !value)) {
    throw new Error('DOCX_REVIEW_PACKET_DOCUMENT_METADATA_FIELD_REQUIRED');
  }
  const publicCustomProperties = normalizeCustomProperties(input.publicCustomProperties);
  if (publicCustomProperties.length === 0) {
    throw new Error('DOCX_REVIEW_PACKET_DOCUMENT_METADATA_CUSTOM_PROPERTY_REQUIRED');
  }
  const names = publicCustomProperties.map((property) => property.name);
  if (new Set(names).size !== names.length) {
    throw new Error('DOCX_REVIEW_PACKET_DOCUMENT_METADATA_CUSTOM_PROPERTY_DUPLICATE');
  }
  return {
    schemaVersion: input.schemaVersion,
    coreProperties,
    publicCustomProperties,
  };
}

function buildCorePropertiesXml(input) {
  const metadata = normalizeDocumentMetadata(input);
  if (!metadata) throw new Error('DOCX_REVIEW_PACKET_DOCUMENT_METADATA_REQUIRED');
  const core = metadata.coreProperties;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="${CORE_PROPS_NS}" xmlns:dc="${DC_NS}" xmlns:dcterms="${DCTERMS_NS}" xmlns:xsi="${XSI_NS}">
  <dc:title>${escapeXml(core.title)}</dc:title>
  <dc:creator>${escapeXml(core.creator)}</dc:creator>
  <cp:lastModifiedBy>${escapeXml(core.lastModifiedBy)}</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(core.createdAtUtc)}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${escapeXml(core.modifiedAtUtc)}</dcterms:modified>
  <cp:revision>${escapeXml(core.revision)}</cp:revision>
  <dc:identifier>${escapeXml(core.identifier)}</dc:identifier>
</cp:coreProperties>`;
}

function buildCustomPropertiesXml(properties) {
  // Word interprets literal _xHHHH_ sequences in custom strings. Escape the
  // leading underscore before XML encoding so opaque signed tokens survive.
  const xstring = (value) => escapeXml(value.replace(/_(?=x[0-9a-fA-F]{4}_)/gu, '_x005F_'));
  const body = normalizeCustomProperties(properties)
    .map((property, index) => (
      `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${index + 2}" name="${xstring(property.name)}"><vt:lpwstr>${xstring(property.value)}</vt:lpwstr></property>`
    ))
    .join('\n    ');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="${CUSTOM_PROPS_NS}" xmlns:vt="${CUSTOM_PROPS_VT_NS}">
    ${body}
</Properties>`;
}

function buildCustomXmlPayloadXml(input = {}) {
  const source = isPlainObjectValue(input.advisoryManifest) ? input.advisoryManifest : {};
  // Full baseline maps already live in the authenticated main-owned capsule.
  // They are not a return-authority carrier, and duplicating them into advisory
  // XML can exceed the unchanged 10 MiB part limit on ordinary large books.
  // Keep signed carriers untouched; expose their public correlation digests.
  const compact = source.schemaVersion === 'yalken.rtk.word.product-review-docx-export.advisory-manifest.v1'
    && source.scope === 'full-manuscript'
    && isPlainObjectValue(source.coreManifest) && isPlainObjectValue(source.transportManifest);
  const { coreManifest, transportManifest, ...publicFields } = source;
  const payload = compact ? {
    ...publicFields,
    schemaVersion: 'yalken.rtk.word.product-review-docx-export.compact-advisory.v1',
    coreManifestDigest: coreManifest.coreManifestDigest,
    transportManifestDigest: transportManifest.payloadDigest,
    baselineStorage: 'MAIN_OWNED_AUTHENTICATED_LOCAL_CAPSULE',
  } : source;
  const json = JSON.stringify(payload);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<yrtk:reviewTransport xmlns:yrtk="urn:yalken:rtk:word-review-packet:v1" authorityRole="advisory-not-apply-authority">
  <yrtk:payload encoding="json">${escapeXml(json)}</yrtk:payload>
</yrtk:reviewTransport>`;
}

function buildCustomXmlItemPropsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ds:datastoreItem ds:itemID="{8D56F7D3-7A64-4B6C-8C4E-000000000001}" xmlns:ds="${CUSTOM_XML_PROPS_NS}">
  <ds:schemaRefs/>
</ds:datastoreItem>`;
}

function buildContentTypesXml(commentTypes = '', includeCoreProperties = false) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/settings.xml" ContentType="${WORD_SETTINGS_CONTENT_TYPE}"/>
  <Override PartName="/word/numbering.xml" ContentType="${WORD_NUMBERING_CONTENT_TYPE}"/>
  <Override PartName="/word/styles.xml" ContentType="${WORD_STYLES_CONTENT_TYPE}"/>
  <Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>
  ${includeCoreProperties ? `<Override PartName="/docProps/core.xml" ContentType="${CORE_PROPS_CONTENT_TYPE}"/>` : ''}
  ${commentTypes}
</Types>`;
}

function buildRootRelsXml(includeCoreProperties = false) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${WORD_REL_NS}">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rIdYrtkCustomProps" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/>
  ${includeCoreProperties ? `<Relationship Id="rIdYrtkCoreProps" Type="${CORE_PROPS_REL_TYPE}" Target="docProps/core.xml"/>` : ''}
  <Relationship Id="rIdYrtkCustomXml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml" Target="customXml/item1.xml"/>
</Relationships>`;
}

function buildDocumentRelsXml(hyperlinks = [], commentRelationships = '') {
  // PARSER-01 (P9) hyperlink emission form: the exact-text product profile keeps
  // emitting TargetMode="External" hyperlink relationships so a physical Word
  // reopen shows a clickable link, AND the bounded parser
  // (reviewTransportPackageParserV2.mjs) admits a bounded http(s) hyperlink rel
  // as INERT preserved evidence inside the declared profile — it is never
  // authority, never a locator, never a click target. Non-http(s) and
  // active/attached-template External rels remain RTK_HOSTILE_PACKAGE_BLOCKED.
  // This resolves the former builder↔parser self-conflict where the product's
  // own exported packet was rejected as hostile.
  const hyperlinkRelationships = hyperlinks.map((entry) => (
    `  <Relationship Id="${escapeXml(entry.relationshipId)}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(entry.href)}" TargetMode="External"/>`
  )).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${WORD_REL_NS}">
  <Relationship Id="rIdYrtkSettings" Type="${WORD_SETTINGS_REL_TYPE}" Target="settings.xml"/>
  <Relationship Id="rIdYrtkNumbering" Type="${WORD_NUMBERING_REL_TYPE}" Target="numbering.xml"/>
  <Relationship Id="rIdYrtkStyles" Type="${WORD_STYLES_REL_TYPE}" Target="styles.xml"/>
${hyperlinkRelationships}
${commentRelationships}
</Relationships>`;
}

function collectNumberingDefinitions(blocks) {
  const byNumId = new Map();
  for (const block of blocks) {
    const list = block.formatIr?.paragraph?.list;
    if (!isPlainObjectValue(list)) continue;
    const numId = Number(list.numId);
    const start = Number(list.start);
    const definition = {
      numId,
      kind: normalizeString(list.kind),
      start: Number.isSafeInteger(start) ? start : 1,
    };
    const existing = byNumId.get(numId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(definition)) {
      throw new Error('DOCX_REVIEW_PACKET_FORMAT_IR_LIST_ID_CONFLICT');
    }
    byNumId.set(numId, definition);
  }
  return [...byNumId.values()].sort((left, right) => left.numId - right.numId);
}

function buildNumberingXml(definitions) {
  const abstract = definitions.map((definition) => {
    const levels = Array.from({ length: 9 }, (_, level) => {
      const ordered = definition.kind === 'ordered';
      const levelText = ordered ? `%${level + 1}.` : ['•', '◦', '▪'][level % 3];
      return `<w:lvl w:ilvl="${level}"><w:start w:val="${definition.start}"/><w:numFmt w:val="${ordered ? 'decimal' : 'bullet'}"/><w:lvlText w:val="${escapeXml(levelText)}"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="${720 + level * 360}"/></w:tabs><w:ind w:left="${720 + level * 360}" w:hanging="360"/></w:pPr></w:lvl>`;
    }).join('');
    return `<w:abstractNum w:abstractNumId="${definition.numId}"><w:multiLevelType w:val="hybridMultilevel"/>${levels}</w:abstractNum>`;
  }).join('');
  const instances = definitions.map((definition) => (
    `<w:num w:numId="${definition.numId}"><w:abstractNumId w:val="${definition.numId}"/></w:num>`
  )).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${WORD_MAIN_NS}">${abstract}${instances}</w:numbering>`;
}

function buildStylesXml(blocks) {
  const ids = ['YalkenCodeBlock', ...blocks.map(block => docxBlockStyleId(
    block.formatIr?.paragraph?.nodeType === 'codeBlock', Number(block.formatIr?.paragraph?.blockquoteDepth || 0),
  )).filter(Boolean)];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${WORD_MAIN_NS}">
  ${buildDocxBlockStyleDefinitions(ids)}
  <w:style w:type="character" w:styleId="YalkenInlineCode"><w:name w:val="Yalken Inline Code"/><w:rPr><w:rFonts w:ascii="Menlo" w:hAnsi="Menlo"/><w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/></w:rPr></w:style>
</w:styles>`;
}

function collectDocumentHyperlinks(blocks) {
  const hrefs = [];
  for (const block of blocks) {
    for (const run of Array.isArray(block.formatIr?.runs) ? block.formatIr.runs : []) {
      for (const mark of Array.isArray(run?.preservedMarks) ? run.preservedMarks : []) {
        if (mark?.type !== 'link') continue;
        const href = normalizeString(mark.attrs?.href);
        if (href && !hrefs.includes(href)) hrefs.push(href);
      }
    }
  }
  return hrefs.map((href, index) => ({ href, relationshipId: `rIdYrtkLink${index + 1}` }));
}

function buildSettingsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="${WORD_MAIN_NS}">
  <w:compat>
    <w:compatSetting w:name="compatibilityMode" w:uri="${WORD_COMPATIBILITY_URI}" w:val="15"/>
  </w:compat>
</w:settings>`;
}

function storedZipEntryList(buffer) {
  const entries = [];
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (method !== 0 || dataEnd > buffer.length) return [];
    entries.push({
      name: buffer.slice(nameStart, nameStart + fileNameLength).toString('utf8'),
      text: buffer.slice(dataStart, dataEnd).toString('utf8'),
    });
    offset = dataEnd;
  }
  return entries;
}

function validateDocxReviewPacketModernMode15(buffer) {
  const entries = storedZipEntryList(buffer);
  const byName = (name) => entries.filter((entry) => entry.name === name);
  const settings = byName('word/settings.xml');
  const contentTypes = byName('[Content_Types].xml');
  const documentRels = byName('word/_rels/document.xml.rels');
  const failures = [];
  if (settings.length !== 1) failures.push('DOCX_REVIEW_PACKET_SETTINGS_PART_COUNT_INVALID');
  if (contentTypes.length !== 1) failures.push('DOCX_REVIEW_PACKET_CONTENT_TYPES_PART_COUNT_INVALID');
  if (documentRels.length !== 1) failures.push('DOCX_REVIEW_PACKET_DOCUMENT_RELS_PART_COUNT_INVALID');
  const settingsXml = settings[0]?.text || '';
  const modeEntries = settingsXml.match(/<w:compatSetting\b[^>]*\bw:name="compatibilityMode"[^>]*\/>/gu) || [];
  if (!/^<\?xml[\s\S]*<w:settings\b[\s\S]*<w:compat>[\s\S]*<\/w:compat>[\s\S]*<\/w:settings>\s*$/u.test(settingsXml)) {
    failures.push('DOCX_REVIEW_PACKET_SETTINGS_XML_MALFORMED');
  }
  if (modeEntries.length !== 1) failures.push('DOCX_REVIEW_PACKET_COMPATIBILITY_MODE_COUNT_INVALID');
  if (modeEntries.length === 1 && !/\bw:val="15"/u.test(modeEntries[0])) {
    failures.push('DOCX_REVIEW_PACKET_COMPATIBILITY_MODE_NOT_15');
  }
  if (modeEntries.length === 1 && !new RegExp(`\\bw:uri="${WORD_COMPATIBILITY_URI}"`, 'u').test(modeEntries[0])) {
    failures.push('DOCX_REVIEW_PACKET_COMPATIBILITY_MODE_URI_INVALID');
  }
  const overrideMatches = (contentTypes[0]?.text || '').match(/<Override\b[^>]*PartName="\/word\/settings\.xml"[^>]*>/gu) || [];
  if (overrideMatches.length !== 1 || !overrideMatches[0].includes(`ContentType="${WORD_SETTINGS_CONTENT_TYPE}"`)) {
    failures.push('DOCX_REVIEW_PACKET_SETTINGS_CONTENT_TYPE_INVALID');
  }
  const relationshipMatches = (documentRels[0]?.text || '').match(/<Relationship\b[^>]*Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/settings"[^>]*>/gu) || [];
  if (relationshipMatches.length !== 1 || !/\bTarget="settings\.xml"/u.test(relationshipMatches[0])) {
    failures.push('DOCX_REVIEW_PACKET_SETTINGS_RELATIONSHIP_INVALID');
  }
  return {
    ok: failures.length === 0,
    code: failures[0] || 'DOCX_REVIEW_PACKET_MODERN_MODE_15_VALID',
    failures,
    compatibilityMode: modeEntries.length === 1
      ? Number.parseInt(modeEntries[0].match(/\bw:val="(\d+)"/u)?.[1] || '', 10)
      : null,
  };
}

function buildCustomXmlRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${WORD_REL_NS}">
  <Relationship Id="rIdYrtkCustomXmlProps" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXmlProps" Target="itemProps1.xml"/>
</Relationships>`;
}

function assertNoEmbeddedSecret(buffer, forbiddenSecret) {
  const secret = normalizeString(forbiddenSecret);
  if (secret && buffer.includes(Buffer.from(secret, 'utf8'))) {
    throw new Error('DOCX_REVIEW_PACKET_SECRET_EMBEDDED');
  }
}

function buildDocxReviewPacketBuffer(input = {}) {
  const blocks = normalizeReviewPacketBlocks(input);
  const numberingDefinitions = collectNumberingDefinitions(blocks);
  const hyperlinks = collectDocumentHyperlinks(blocks);
  const hyperlinkByHref = new Map(hyperlinks.map((entry) => [entry.href, entry.relationshipId]));
  const documentMetadata = normalizeDocumentMetadata(input.documentMetadata);
  const customProperties = normalizeCustomProperties([
    ...(Array.isArray(input.customProperties) ? input.customProperties : []),
    ...(documentMetadata?.publicCustomProperties || []),
  ]);
  const customPropertyNames = customProperties.map((property) => property.name);
  if (new Set(customPropertyNames).size !== customPropertyNames.length) {
    throw new Error('DOCX_REVIEW_PACKET_CUSTOM_PROPERTY_DUPLICATE');
  }
  const comments = commentPackageParts(input.commentExport);
  if (customProperties.length === 0) {
    throw new Error('DOCX_REVIEW_PACKET_CUSTOM_PROPERTY_REQUIRED');
  }
  if (!customProperties.some((property) => property.name === 'YRTK_C01_AUTH')) {
    throw new Error('DOCX_REVIEW_PACKET_AUTHORITY_PROPERTY_REQUIRED');
  }
  if (!customProperties.some((property) => property.name === 'YRTK2_TOKEN')) {
    throw new Error('DOCX_REVIEW_PACKET_YRTK2_PROPERTY_REQUIRED');
  }

  const buffer = buildStoredZip([
    { name: '[Content_Types].xml', data: buildContentTypesXml(comments.contentTypes, Boolean(documentMetadata)) },
    { name: '_rels/.rels', data: buildRootRelsXml(Boolean(documentMetadata)) },
    { name: 'word/_rels/document.xml.rels', data: buildDocumentRelsXml(hyperlinks, comments.relationships) },
    { name: 'word/document.xml', data: buildDocumentXml(blocks, hyperlinkByHref, input.commentExport, input.documentSections) },
    { name: 'word/settings.xml', data: buildSettingsXml() },
    { name: 'word/numbering.xml', data: buildNumberingXml(numberingDefinitions) },
    { name: 'word/styles.xml', data: buildStylesXml(blocks) },
    ...(documentMetadata ? [{ name: 'docProps/core.xml', data: buildCorePropertiesXml(documentMetadata) }] : []),
    { name: 'docProps/custom.xml', data: buildCustomPropertiesXml(customProperties) },
    { name: 'customXml/_rels/item1.xml.rels', data: buildCustomXmlRelsXml() },
    { name: 'customXml/item1.xml', data: buildCustomXmlPayloadXml(input) },
    { name: 'customXml/itemProps1.xml', data: buildCustomXmlItemPropsXml() },
    ...comments.entries,
  ]);
  const modernMode = validateDocxReviewPacketModernMode15(buffer);
  if (!modernMode.ok) throw new Error(modernMode.code);
  assertNoEmbeddedSecret(buffer, input.forbiddenSecret);
  return buffer;
}

module.exports = {
  buildDocxReviewPacketBuffer,
  buildCorePropertiesXml,
  buildSettingsXml,
  normalizeDocumentMetadata,
  normalizeDocumentSections,
  normalizeReviewPacketBlocks,
  validateDocxReviewPacketModernMode15,
  deriveWordBookmarkNameV1,
  readDeclaredBookmarkName,
};
