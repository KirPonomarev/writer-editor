const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const PARSER_PATH = 'src/io/revisionBridge/reviewTransportPackageParserV2.mjs';
const INDEX_PATH = 'src/io/revisionBridge/index.mjs';
const RECEIPT_PATH = 'docs/OPS/RTK/WORD_LATEST_SEMANTIC_ROUNDTRIP_V2_B02_PACKAGE_PARSER_RECEIPT.json';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const W15_NS = 'http://schemas.microsoft.com/office/word/2012/wordml';
const W16CID_NS = 'http://schemas.microsoft.com/office/word/2016/wordml/cid';

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function makeCrc32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE = makeCrc32Table();

function crc32Text(value) {
  const buffer = Buffer.from(String(value || ''), 'utf8');
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const cryptoPort = {
  sha256Text(value) {
    return crypto.createHash('sha256').update(Buffer.from(String(value || ''), 'utf8')).digest('hex');
  },
  sha256Json(value) {
    return `sha256:${this.sha256Text(stableJson(value))}`;
  },
  byteLength(value) {
    return Buffer.byteLength(String(value || ''), 'utf8');
  },
  crc32(value) {
    return crc32Text(value);
  },
};

async function loadParser() {
  return import(pathToFileURL(path.join(process.cwd(), PARSER_PATH)).href);
}

async function loadIndex() {
  return import(pathToFileURL(path.join(process.cwd(), INDEX_PATH)).href);
}

function documentXml(body, prefix = 'w') {
  return `<${prefix}:document xmlns:${prefix}="${W_NS}"><${prefix}:body>${body}</${prefix}:body></${prefix}:document>`;
}

function baseParts(document) {
  return {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': document,
  };
}

function trackedReplacementParagraph(gap = '', ids = ['d1', 'i1'], author = 'Ada') {
  return `<w:p><w:del w:id="${ids[0]}" w:author="${author}"><w:r><w:delText>old</w:delText></w:r></w:del>${gap}<w:ins w:id="${ids[1]}" w:author="${author}"><w:r><w:t>new</w:t></w:r></w:ins></w:p>`;
}

function replacementGroupIds(result) {
  return [...new Set((result.reviewIr?.textRevisions || [])
    .map((item) => item.replacementGroupId)
    .filter(Boolean))];
}

function assertReviewAnalysisOnly(result) {
  assert.equal(result.ok, true);
  assert.equal(result.code, 'RTK_NO_WRITE_ANALYSIS_READY');
  assert.equal(result.canApply, false);
  assert.equal(result.canWriteManuscript, false);
}

test('B02 parser is namespace and attribute-order stable without regex XML authority', async () => {
  const parser = await loadParser();
  const first = parser.parseReviewTransportPackageV2({
    parts: baseParts(documentXml('<w:p><w:ins w:id="1" w:author="A" w:date="2026-07-30T10:00:00Z"><w:r><w:t>Alpha</w:t></w:r></w:ins></w:p>')),
  }, { cryptoPort });
  const second = parser.parseReviewTransportPackageV2({
    parts: baseParts(documentXml('<x:p><x:ins x:date="2026-07-30T10:00:00Z" x:author="A" x:id="1"><x:r><x:t>Alpha</x:t></x:r></x:ins></x:p>', 'x')),
  }, { cryptoPort });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.sourceMode, 'TRACKED');
  assert.equal(first.reviewIr.textRevisions.length, 1);
  assert.equal(first.reviewIr.textRevisions[0].operation, 'insert');
  assert.equal(first.reviewIr.textRevisions[0].sourceXmlProvenance.namespaceUri, W_NS);
  assert.equal(first.supportedSemanticDigest, second.supportedSemanticDigest);
  assert.equal(first.canApply, false);
  assert.equal(first.canWriteManuscript, false);
});

test('B02 parser preserves modern comment graph bodies authors replies resolve and anchors independently', async () => {
  const parser = await loadParser();
  const result = parser.parseReviewTransportPackageV2({
    parts: {
      ...baseParts(documentXml('<w:p><w:commentRangeStart w:id="7"/><w:r><w:t>quoted anchor</w:t></w:r><w:commentRangeEnd w:id="7"/><w:r><w:commentReference w:id="7"/></w:r></w:p>')),
      'word/comments.xml': `<w:comments xmlns:w="${W_NS}">
        <w:comment w:id="7" w:paraId="root" w:author="Author A" w:initials="AA" w:date="2026-07-30T10:00:00Z"><w:p><w:r><w:t>Root body</w:t></w:r></w:p></w:comment>
        <w:comment w:id="8" w:paraId="reply1" w:parentId="7" w:author="Author B" w:initials="BB"><w:p><w:r><w:t>Reply one</w:t></w:r></w:p></w:comment>
        <w:comment w:id="9" w:paraId="reply2" w:parentId="8" w:author="Author C" w:initials="CC"><w:p><w:r><w:t>Reply two</w:t></w:r></w:p></w:comment>
      </w:comments>`,
      'word/commentsExtended.xml': `<w15:commentsEx xmlns:w15="${W15_NS}"><w15:commentEx w15:paraId="root" w15:done="1"/></w15:commentsEx>`,
      'word/commentsIds.xml': `<w16cid:commentsIds xmlns:w16cid="${W16CID_NS}"><w16cid:commentId w16cid:paraId="root" w16cid:durableId="durable-root" w16cid:dateUtc="2026-07-30T10:00:00Z"/></w16cid:commentsIds>`,
      'word/people.xml': '<w15:people xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"><w15:person w15:author="Author A" w15:providerId="None" w15:userId="synthetic"/></w15:people>',
      'word/commentsExtensible.xml': '<w16cex:commentsExtensible xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex"/>',
    },
  }, { cryptoPort });

  assert.equal(result.ok, true);
  assert.equal(result.reviewIr.commentThreads.length, 1);
  const thread = result.reviewIr.commentThreads[0];
  assert.equal(thread.body, 'Root body');
  assert.equal(thread.durableId, 'durable-root');
  assert.equal(thread.status, 'RESOLVED');
  assert.equal(thread.doneResolvedReopenedState, 'resolved');
  assert.equal(thread.authorPersonIdentity.author, 'Author A');
  assert.equal(thread.quotedAnchorText, 'quoted anchor');
  assert.deepEqual(thread.replies.map((reply) => reply.body), ['Reply one', 'Reply two']);
  assert.equal(result.reviewIr.conservation.commentLaneIndependentFromTextLane, true);
  assert.equal(result.reviewIr.opaqueUnsupported.some((item) => item.typedDiagnostic === 'RTK_MODERN_COMMENT_EXTENSIBLE_NOT_CERTIFIED'), true);
});

test('B02 parser keeps revision property structure and formatting lanes separate', async () => {
  const parser = await loadParser();
  const result = parser.parseReviewTransportPackageV2({
    parts: baseParts(documentXml(`
      <w:p>
        <w:pPr><w:pStyle w:val="Heading1"/><w:jc w:val="center"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="4"/></w:numPr><w:pPrChange w:id="11" w:author="Editor"/></w:pPr>
        <w:del w:id="1" w:author="A"><w:r><w:delText>old</w:delText></w:r></w:del><w:ins w:id="2" w:author="A"><w:r><w:t>new</w:t></w:r></w:ins>
        <w:moveFrom w:id="9"><w:r><w:t>moved-out</w:t></w:r></w:moveFrom><w:moveTo w:id="9"><w:r><w:t>moved-in</w:t></w:r></w:moveTo>
        <w:r><w:rPr><w:b/><w:i/><w:u w:val="single"/><w:strike/><w:color w:val="FF0000"/><w:highlight w:val="yellow"/><w:rFonts w:ascii="Literata"/><w:sz w:val="24"/><w:rPrChange w:id="12"/></w:rPr><w:t>styled</w:t></w:r>
        <w:hyperlink r:id="rId5" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:r><w:t>link</w:t></w:r></w:hyperlink>
      </w:p>`)),
    untrackedDrift: true,
  }, { cryptoPort });

  assert.equal(result.ok, true);
  assert.equal(result.sourceMode, 'MIXED');
  assert.equal(result.reviewIr.textRevisions.length, 2);
  assert.match(result.reviewIr.textRevisions[0].replacementGroupId, /^[a-f0-9]{64}$/u);
  assert.equal(result.reviewIr.textRevisions[0].replacementGroupId, result.reviewIr.textRevisions[1].replacementGroupId);
  assert.equal(result.reviewIr.moveRevisions.length, 1);
  assert.equal(result.reviewIr.moveRevisions[0].reasonCode, 'RTK_BLOCKED_MOVE_REVISION');
  assert.equal(result.reviewIr.propertyRevisions.some((item) => item.propertyKind === 'pPrChange'), true);
  assert.equal(result.reviewIr.propertyRevisions.some((item) => item.propertyKind === 'rPrChange'), true);
  assert.equal(result.reviewIr.structureChanges.some((item) => item.structureKind === 'moveRevision'), true);
  assert.equal(result.reviewIr.formattingDeltas.some((item) => item.values.bold === true && item.values.font === 'Literata'), true);
  assert.equal(result.reviewIr.formattingDeltas.some((item) => item.formatKind === 'hyperlink' && item.values.relationshipId === 'rId5'), true);
  assert.equal(result.canApply, false);
});

test('B02 parser treats Word-normalized insert-delete replacements as tracked-only with advisory inventory', async () => {
  const parser = await loadParser();
  const result = parser.parseReviewTransportPackageV2({
    parts: {
      ...baseParts(documentXml(`
        <w:p>
          <w:r><w:t>Alpha </w:t></w:r>
          <w:ins w:id="i1" w:author="Word"><w:r><w:t>new</w:t></w:r></w:ins>
          <w:del w:id="d1" w:author="Word"><w:r><w:delText>old</w:delText></w:r></w:del>
          <w:r><w:t> omega</w:t></w:r>
        </w:p>
        <w:sectPr/>`)),
      'word/styles.xml': '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>',
    },
    baselineFinalText: 'Alpha old omega',
  }, { cryptoPort });

  assert.equal(result.ok, true);
  assert.equal(result.sourceMode, 'TRACKED');
  assert.equal(result.reviewIr.textRevisions.length, 2);
  assert.equal(result.reviewIr.textRevisions[0].operation, 'insert');
  assert.equal(result.reviewIr.textRevisions[1].operation, 'delete');
  assert.match(result.reviewIr.textRevisions[0].replacementGroupId, /^[a-f0-9]{64}$/u);
  assert.equal(result.reviewIr.textRevisions[0].replacementGroupId, result.reviewIr.textRevisions[1].replacementGroupId);
  assert.equal(result.reviewIr.structureChanges.some((item) => item.structureKind === 'sectPr'), false);
  assert.equal(result.reviewIr.opaqueUnsupported.some((item) => (
    item.typedDiagnostic === 'RTK_WORD_BODY_SECTION_PROPERTIES_INVENTORY'
    && item.writerAuthorityImpact === 'inventory-only'
  )), true);
  assert.equal(result.reviewIr.opaqueUnsupported.some((item) => (
    item.partName === 'word/styles.xml'
    && item.writerAuthorityImpact === 'inventory-only'
  )), true);
  assert.equal(result.reasons.some((reason) => reason.code === 'RTK_MANUAL_MIXED_RETURN'), false);
});

test('B02 parser does not form replacement groups across visible run boundaries', async () => {
  const parser = await loadParser();
  const adjacent = parser.parseReviewTransportPackageV2({
    parts: baseParts(documentXml(trackedReplacementParagraph())),
  }, { cryptoPort });
  assertReviewAnalysisOnly(adjacent);
  assert.equal(adjacent.reviewIr.textRevisions.length, 2);
  assert.equal(replacementGroupIds(adjacent).length, 1);

  const emptyText = parser.parseReviewTransportPackageV2({
    parts: baseParts(documentXml(trackedReplacementParagraph('<w:r><w:t></w:t></w:r>'))),
  }, { cryptoPort });
  assertReviewAnalysisOnly(emptyText);
  assert.equal(replacementGroupIds(emptyText).length, 1);

  const boundaryCases = [
    ['visible-text', '<w:r><w:t> keep visible boundary </w:t></w:r>'],
    ['preserved-space-text', '<w:r><w:t xml:space="preserve"> </w:t></w:r>'],
    ['tab', '<w:r><w:tab/></w:r>'],
    ['line-break', '<w:r><w:br/></w:r>'],
    ['page-break', '<w:r><w:br w:type="page"/></w:r>'],
    ['column-break', '<w:r><w:br w:type="column"/></w:r>'],
    ['carriage-return', '<w:r><w:cr/></w:r>'],
    ['soft-hyphen', '<w:r><w:softHyphen/></w:r>'],
    ['no-break-hyphen', '<w:r><w:noBreakHyphen/></w:r>'],
    ['symbol-wingdings', '<w:r><w:sym w:font="Wingdings" w:char="F04A"/></w:r>'],
    ['symbol-missing-char-conservative', '<w:r><w:sym w:font="Wingdings"/></w:r>'],
    ['positional-tab', '<w:r><w:ptab w:alignment="center" w:relativeTo="margin" w:leader="none"/></w:r>'],
    ['separator', '<w:r><w:separator/></w:r>'],
    ['continuation-separator', '<w:r><w:continuationSeparator/></w:r>'],
    ['footnote-ref', '<w:r><w:footnoteRef/></w:r>'],
    ['endnote-ref', '<w:r><w:endnoteRef/></w:r>'],
    ['annotation-ref', '<w:r><w:annotationRef/></w:r>'],
    ['comment-reference', '<w:r><w:commentReference w:id="7"/></w:r>'],
    ['footnote-reference', '<w:r><w:footnoteReference w:id="2"/></w:r>'],
    ['endnote-reference', '<w:r><w:endnoteReference w:id="3"/></w:r>'],
    ['drawing', '<w:r><w:drawing/></w:r>'],
    ['pict', '<w:r><w:pict/></w:r>'],
    ['object', '<w:r><w:object/></w:r>'],
    ['field-simple', '<w:fldSimple w:instr="DATE"><w:r><w:t>1 January 2026</w:t></w:r></w:fldSimple>'],
    ['instruction-text', '<w:r><w:instrText> HYPERLINK "https://example.invalid" </w:instrText></w:r>'],
  ];

  for (const [caseId, gap] of boundaryCases) {
    const result = parser.parseReviewTransportPackageV2({
      parts: baseParts(documentXml(trackedReplacementParagraph(gap))),
    }, { cryptoPort });
    assertReviewAnalysisOnly(result);
    assert.equal(result.reviewIr.textRevisions.length, 2, caseId);
    assert.equal(replacementGroupIds(result).length, 0, caseId);
  }
});

test('B02 parser replacement grouping uses a boundary index and stays count-stable on dense revisions', async () => {
  const parser = await loadParser();
  const source = fs.readFileSync(path.join(process.cwd(), PARSER_PATH), 'utf8');
  const groupLoopSection = source.slice(
    source.indexOf('const replacementBoundaryIndex = createRevisionReplacementGroupBoundaryIndex'),
    source.indexOf('return ordered;', source.indexOf('const replacementBoundaryIndex = createRevisionReplacementGroupBoundaryIndex')),
  );

  assert.equal(source.includes('function createRevisionReplacementGroupBoundaryIndex'), true);
  assert.equal(source.includes("'sym'"), true);
  assert.match(source, /const replacementBoundaryIndex = createRevisionReplacementGroupBoundaryIndex\(documentXml, documentScan\);\s*for \(let index = 0; index < ordered\.length - 1/u);
  assert.equal(groupLoopSection.includes('documentScan.tokens'), false);
  assert.equal(groupLoopSection.includes('replacementBoundaryIndex.hasBoundaryBetween(left, right)'), true);

  for (const pairCount of [32, 64, 128, 256]) {
    let body = '';
    for (let index = 0; index < pairCount; index += 1) {
      body += trackedReplacementParagraph('', [`d${index}`, `i${index}`], 'Ada');
    }
    const result = parser.parseReviewTransportPackageV2({
      parts: baseParts(documentXml(body)),
    }, { cryptoPort });
    assertReviewAnalysisOnly(result);
    assert.equal(result.reviewIr.textRevisions.length, pairCount * 2, `text revisions ${pairCount}`);
    assert.equal(replacementGroupIds(result).length, pairCount, `replacement groups ${pairCount}`);
  }
});

test('B02 parser blocks hostile package inventory external rel active content CRC mismatch and fake EOCD', async () => {
  const parser = await loadParser();
  const document = documentXml('<w:p><w:r><w:t>Safe text</w:t></w:r></w:p>');
  const result = parser.parseReviewTransportPackageV2({
    parts: {
      ...baseParts(document),
      '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>',
      'word/_rels/document.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rExternal" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid" TargetMode="External"/></Relationships>',
    },
    zipInventory: {
      eocdCount: 2,
      entries: [
        { name: 'word/document.xml', centralCrc32: 1, localCrc32: 2, dataStart: 0, dataEnd: 10 },
        { name: '[Content_Types].xml', centralCrc32: 3, localCrc32: 3, dataStart: 9, dataEnd: 20 },
      ],
    },
  }, { cryptoPort });

  assert.equal(result.ok, false);
  assert.equal(result.canApply, false);
  assert.equal(result.canWriteManuscript, false);
  assert.equal(result.reasons.some((reason) => reason.code === 'RTK_HOSTILE_PACKAGE_BLOCKED'), true);
  assert.equal(result.reasons.some((reason) => reason.code === 'RTK_ZIP_FAKE_EOCD'), true);
  assert.equal(result.reasons.some((reason) => reason.code === 'RTK_ZIP_LOCAL_CENTRAL_MISMATCH'), true);
});

test('B02 parser emits typed opaque unsupported and malformed XML never becomes a pass', async () => {
  const parser = await loadParser();
  const opaque = parser.parseReviewTransportPackageV2({
    parts: {
      ...baseParts(documentXml('<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="w14"><w:pict/></mc:Choice></mc:AlternateContent><w:tbl><w:tr/></w:tbl><w:p><w:r><w:t>Body</w:t></w:r></w:p>')),
      'word/embeddings/object1.bin': 'opaque',
    },
  }, { cryptoPort });
  const malformed = parser.parseReviewTransportPackageV2({
    parts: baseParts(documentXml('<w:p><w:ins><w:t>Broken</w:t></w:p>')),
  }, { cryptoPort });

  assert.equal(opaque.ok, true);
  assert.equal(opaque.reviewIr.opaqueUnsupported.some((item) => item.kind === 'unknown-part'), true);
  assert.equal(opaque.reviewIr.opaqueUnsupported.some((item) => item.elementName === 'AlternateContent'), true);
  assert.equal(opaque.reviewIr.opaqueUnsupported.some((item) => item.elementName === 'tbl'), true);
  assert.equal(opaque.reviewIr.conservation.unknownElementsNeverSilentlyDropped, true);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.code, 'RTK_XML_MALFORMED_BLOCKED');
});

test('B02 public export and receipt preserve non-certification and platform-neutral parser boundaries', async () => {
  const bridge = await loadIndex();
  const receipt = JSON.parse(fs.readFileSync(path.join(process.cwd(), RECEIPT_PATH), 'utf8'));
  const source = fs.readFileSync(path.join(process.cwd(), PARSER_PATH), 'utf8');

  assert.equal(typeof bridge.parseReviewTransportPackageV2, 'function');
  assert.equal(bridge.RTK_REVIEW_TRANSPORT_PACKAGE_PARSER_V2_PROFILE, 'yalken.rtk.package-aware-review-ir-parser.v2.b02');
  assert.equal(receipt.status, 'B02_PARSER_CONTRACT_READY_NOT_CERTIFIED');
  assert.equal(receipt.nonClaims.latestWordCertified, false);
  assert.equal(receipt.nonClaims.automaticApplyExpanded, false);
  for (const forbidden of ['node:', 'Buffer', 'child_process', 'fetch(', 'XMLHttpRequest', 'WebSocket', 'new RegExp', '.match(', '.matchAll(']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
