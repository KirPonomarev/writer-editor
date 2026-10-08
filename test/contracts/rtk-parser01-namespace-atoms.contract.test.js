const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const PARSER_PATH = 'src/io/revisionBridge/reviewTransportPackageParserV2.mjs';
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// ---------------------------------------------------------------------------
// Shared helpers (mirror the b02/b03 in-memory fixture + cryptoPort pattern).
// ---------------------------------------------------------------------------

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
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
    // Deterministic stub; real CRC32 is only exercised by ZIP inventory cases.
    let crc = 0xffffffff;
    for (const byte of Buffer.from(String(value || ''), 'utf8')) crc = ((crc ^ byte) & 0xff) ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  },
};

async function loadParser() {
  return import(pathToFileURL(path.join(process.cwd(), PARSER_PATH)).href);
}

// Document body wrapped with the Word main namespace under the given prefix.
function documentXml(body, prefix = 'w', extraNamespaces = '') {
  return `<${prefix}:document xmlns:${prefix}="${W_NS}"${extraNamespaces}><${prefix}:body>${body}</${prefix}:body></${prefix}:document>`;
}

// A default-namespace variant (no prefix) used by P4 to probe empty-namespace tokens.
function documentXmlDefaultNs(body, namespaceUri = '') {
  return `<document xmlns="${namespaceUri}"><body>${body}</body></document>`;
}

const CONTENT_TYPES = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
const ROOT_RELS = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';

function baseParts(document, extra = {}) {
  return {
    '[Content_Types].xml': CONTENT_TYPES,
    '_rels/.rels': ROOT_RELS,
    'word/document.xml': document,
    ...extra,
  };
}

// Reason helpers for terse assertions.
function hasReason(result, code) {
  return Boolean(result.reasons && result.reasons.some((item) => item.code === code));
}

// ===========================================================================
// P1 — QName close-tag mismatch must be typed, not silently accepted.
// ===========================================================================

test('PARSER01-P1-qname-close-mismatch-rejected', async () => {
  const parser = await loadParser();
  // Open <w:p>, close </x:p>: same localName, same namespace, different prefix.
  // RED REASON: parseXmlPart closes by localName only (line ~509), so </x:p> silently
  // matches the open <w:p> and ok=true. TARGET: typed RTK_XML_QNAME_MISMATCH.
  const document = documentXml('<w:p><w:r><w:t>hi</w:t></w:r></x:p>', 'w', ` xmlns:x="${W_NS}"`);
  const result = parser.parseReviewTransportPackageV2(
    { parts: baseParts(document) },
    { cryptoPort },
  );
  assert.equal(result.ok, false, 'RED: qname mismatch on close tag is silently accepted (ok=true); target is typed RTK_XML_QNAME_MISMATCH rejection');
  assert.equal(hasReason(result, 'RTK_XML_QNAME_MISMATCH'), true, 'RED: parser emits no RTK_XML_QNAME_MISMATCH diagnostic for prefix-mismatched close tag');
});

// ===========================================================================
// P2 — Unbound prefix must be typed, not coerced to empty namespace.
// ===========================================================================

test('PARSER01-P2-unbound-prefix-rejected', async () => {
  const parser = await loadParser();
  // <zz:ins> with no xmlns:zz declared.
  // RED REASON: unbound prefix resolves to namespaceUri '' (line ~524), isWordToken
  // accepts empty namespace (line ~949), so a foreign element becomes Word revision
  // evidence. TARGET: typed RTK_XML_NAMESPACE_UNBOUND.
  const document = documentXml('<zz:ins w:id="1" w:author="A"><w:r><w:t>x</w:t></w:r></zz:ins>');
  const result = parser.parseReviewTransportPackageV2(
    { parts: baseParts(document) },
    { cryptoPort },
  );
  assert.equal(result.ok, false, 'RED: unbound prefix zz becomes empty-namespace Word token instead of typed RTK_XML_NAMESPACE_UNBOUND');
  assert.equal(hasReason(result, 'RTK_XML_NAMESPACE_UNBOUND'), true, 'RED: parser emits no RTK_XML_NAMESPACE_UNBOUND diagnostic for undeclared prefix');
  if (result.ok) {
    const revisions = result.reviewIr.textRevisions || [];
    assert.equal(revisions.length, 0, 'RED: unbound-prefix element must not become Word revision evidence');
  }
});

// ===========================================================================
// P3 — Duplicate expanded attribute must be typed, not silently overwritten.
// ===========================================================================

test('PARSER01-P3-duplicate-expanded-attribute-rejected', async () => {
  const parser = await loadParser();
  // (a) same prefix duplicate: <w:p w:id="1" w:id="2">.
  // RED REASON: bindAttributes overwrites attrsByLocal/attrsByNs (line ~348), so the
  // second value silently wins. TARGET: typed RTK_XML_DUPLICATE_ATTRIBUTE.
  const samePrefixDoc = documentXml('<w:p w:id="1" w:id="2"><w:r><w:t>x</w:t></w:r></w:p>');
  const samePrefix = parser.parseReviewTransportPackageV2(
    { parts: baseParts(samePrefixDoc) },
    { cryptoPort },
  );
  assert.equal(samePrefix.ok, false, 'RED: duplicate same-prefix attribute is silently overwritten (ok=true); target is typed RTK_XML_DUPLICATE_ATTRIBUTE');
  assert.equal(hasReason(samePrefix, 'RTK_XML_DUPLICATE_ATTRIBUTE'), true, 'RED: parser emits no RTK_XML_DUPLICATE_ATTRIBUTE diagnostic for duplicate same-prefix attribute');

  // (b) different prefix, same localName, same expanded namespace: <w:p w:id="1" x:id="2">.
  // RED REASON: attrsByNs["{ns}|id"] overwrites (line ~350). TARGET: typed rejection.
  const diffPrefixDoc = documentXml('<w:p w:id="1" x:id="2"><w:r><w:t>x</w:t></w:r></w:p>', 'w', ` xmlns:x="${W_NS}"`);
  const diffPrefix = parser.parseReviewTransportPackageV2(
    { parts: baseParts(diffPrefixDoc) },
    { cryptoPort },
  );
  assert.equal(diffPrefix.ok, false, 'RED: duplicate expanded attribute (diff prefix, same ns) is silently overwritten; target is typed RTK_XML_DUPLICATE_ATTRIBUTE');
  assert.equal(hasReason(diffPrefix, 'RTK_XML_DUPLICATE_ATTRIBUTE'), true, 'RED: parser emits no RTK_XML_DUPLICATE_ATTRIBUTE diagnostic for duplicate expanded attribute');
});

// ===========================================================================
// P4 — Empty-namespace revision element must not be Word revision evidence.
// ===========================================================================

test('PARSER01-P4-empty-namespace-not-word', async () => {
  const parser = await loadParser();
  // <ins> with empty default namespace: no namespace at all.
  // RED REASON: isWordToken accepts empty namespaceUri (line ~949), so a no-namespace
  // <ins> becomes a Word TextRevision. TARGET: NOT Word revision (typed block or opaque).
  const document = documentXmlDefaultNs('<ins id="1" author="A"><r><t>x</t></r></ins>', '');
  const result = parser.parseReviewTransportPackageV2(
    { parts: baseParts(document) },
    { cryptoPort },
  );
  const revisions = result.ok ? (result.reviewIr.textRevisions || []) : [];
  assert.equal(
    revisions.length,
    0,
    'RED: empty-namespace <ins> yields a Word TextRevision (namespaceUri=""), so it is treated as Word revision evidence instead of non-Word',
  );

  // Foreign-namespace <f:ins> must also never be Word revision evidence.
  const foreignDoc = `<f:document xmlns:f="urn:foreign"><f:body><f:ins id="1" author="A"><f:r><f:t>x</f:t></f:r></f:ins></f:body></f:document>`;
  const foreign = parser.parseReviewTransportPackageV2(
    { parts: baseParts(foreignDoc) },
    { cryptoPort },
  );
  const foreignRevisions = foreign.ok ? (foreign.reviewIr.textRevisions || []) : [];
  assert.equal(
    foreignRevisions.length,
    0,
    'CONTROL: foreign-namespace <f:ins> is already filtered (namespaceUri != W_NS and != "")',
  );
});

// ===========================================================================
// P5 — Semantic whitespace atoms must be distinct and preserved.
// ===========================================================================

test('PARSER01-P5-semantic-whitespace-preserved', async () => {
  const parser = await loadParser();
  const digestOf = (document) => {
    const wrapped = documentXml(document);
    const result = parser.parseReviewTransportPackageV2(
      { parts: baseParts(wrapped) },
      { cryptoPort },
    );
    assert.equal(result.ok, true);
    return result;
  };

  // (a) xml:space="preserve" tracked whitespace is trimmed away by tokenText.
  // RED REASON: tokenText calls .trim() (line ~673), so ' beta ' becomes 'beta'.
  const tracked = digestOf('<w:p><w:ins w:id="1" w:author="A"><w:r><w:t xml:space="preserve"> beta </w:t></w:r></w:ins></w:p>');
  const trackedText = tracked.reviewIr.textRevisions[0].text;
  assert.equal(
    trackedText,
    ' beta ',
    'RED: tracked whitespace (xml:space="preserve") is trimmed to "beta" instead of preserved as " beta "',
  );

  // (b) softHyphen is indistinguishable from an empty run (colliding textDigest).
  // RED REASON: stripTagsToText has no softHyphen branch (line ~582), so its text is "".
  const softHyphen = digestOf('<w:p><w:ins w:id="1" w:author="A"><w:r><w:softHyphen/></w:r></w:ins></w:p>');
  const emptyRun = digestOf('<w:p><w:ins w:id="1" w:author="A"><w:r></w:r></w:ins></w:p>');
  assert.notEqual(
    softHyphen.reviewIr.textRevisions[0].textDigest,
    emptyRun.reviewIr.textRevisions[0].textDigest,
    'RED: softHyphen textDigest collides with empty-run digest (softHyphen == absent)',
  );

  // (c) <w:br/> and <w:br w:type="page"/> collide — line break == page break.
  // RED REASON: wordDocumentText/stripTagsToText map every br to "\n" with no type
  // awareness (line ~666, ~583).
  const brLine = digestOf('<w:p><w:ins w:id="1" w:author="A"><w:r><w:br/></w:r></w:ins></w:p>');
  const brPage = digestOf('<w:p><w:ins w:id="1" w:author="A"><w:r><w:br w:type="page"/></w:r></w:ins></w:p>');
  assert.notEqual(
    brLine.reviewIr.textRevisions[0].textDigest,
    brPage.reviewIr.textRevisions[0].textDigest,
    'RED: <w:br/> and <w:br w:type="page"/> share one textDigest (line break == page break)',
  );

  // (d) noBreakHyphen must be a distinct atom from a plain hyphen text run.
  const noBreakHyphen = digestOf('<w:p><w:ins w:id="1" w:author="A"><w:r><w:noBreakHyphen/></w:r></w:ins></w:p>');
  const plainHyphen = digestOf('<w:p><w:ins w:id="1" w:author="A"><w:r><w:t>-</w:t></w:r></w:ins></w:p>');
  assert.notEqual(
    noBreakHyphen.reviewIr.textRevisions[0].textDigest,
    plainHyphen.reviewIr.textRevisions[0].textDigest,
    'RED: <w:noBreakHyphen/> is not a distinct semantic atom from a plain "-" text run',
  );

  // (e) <w:tab/> must be a distinct tab atom (currently mapped to "\t", which is fine
  // as long as it does not collide with a literal tab text run).
  const tabAtom = digestOf('<w:p><w:ins w:id="1" w:author="A"><w:r><w:tab/></w:r></w:ins></w:p>');
  const emptyForTab = digestOf('<w:p><w:ins w:id="1" w:author="A"><w:r></w:r></w:ins></w:p>');
  assert.notEqual(
    tabAtom.reviewIr.textRevisions[0].textDigest,
    emptyForTab.reviewIr.textRevisions[0].textDigest,
    'RED: <w:tab/> textDigest collides with empty-run digest (tab == absent)',
  );
});

// ===========================================================================
// P6 — Paragraph-mark ins/del under pPr/rPr must be structural, not empty TextRevision.
// ===========================================================================

test('PARSER01-P6-paragraph-mark-structural', async () => {
  const parser = await loadParser();
  // Paragraph-mark deletion: <w:del> sits under pPr/rPr and marks the paragraph mark,
  // not run text. RTK_STRUCTURAL_PARAGRAPH_MARK_DELETED is already registered in core.
  const delDoc = documentXml('<w:p><w:pPr><w:rPr><w:del w:id="1" w:author="A" w:date="2026-08-08T10:00:00Z"/></w:rPr></w:pPr><w:r><w:t>body</w:t></w:r></w:p>');
  const delResult = parser.parseReviewTransportPackageV2(
    { parts: baseParts(delDoc) },
    { cryptoPort },
  );
  assert.equal(delResult.ok, true);
  const delTextRevisions = (delResult.reviewIr.textRevisions || []).filter((item) => item.kind === 'TextRevision');
  assert.equal(
    delTextRevisions.length,
    0,
    'RED: paragraph-mark <w:del> under pPr/rPr becomes an empty TextRevision instead of ParagraphMarkRevision',
  );
  assert.equal(
    (delResult.reviewIr.structureChanges || []).some((item) => item.reasonCode === 'RTK_STRUCTURAL_PARAGRAPH_MARK_DELETED' || item.structureKind === 'paragraphMarkDeleted'),
    true,
    'RED: paragraph-mark deletion is not classified structurally as RTK_STRUCTURAL_PARAGRAPH_MARK_DELETED',
  );

  // Paragraph-mark insertion variant.
  const insDoc = documentXml('<w:p><w:pPr><w:rPr><w:ins w:id="2" w:author="A" w:date="2026-08-08T10:00:00Z"/></w:rPr></w:pPr><w:r><w:t>body</w:t></w:r></w:p>');
  const insResult = parser.parseReviewTransportPackageV2(
    { parts: baseParts(insDoc) },
    { cryptoPort },
  );
  assert.equal(insResult.ok, true);
  const insTextRevisions = (insResult.reviewIr.textRevisions || []).filter((item) => item.kind === 'TextRevision');
  assert.equal(
    insTextRevisions.length,
    0,
    'RED: paragraph-mark <w:ins> under pPr/rPr becomes an empty TextRevision instead of ParagraphMarkRevision',
  );
  assert.equal(
    (insResult.reviewIr.structureChanges || []).some((item) => item.reasonCode === 'RTK_STRUCTURAL_PARAGRAPH_MARK_INSERTED' || item.structureKind === 'paragraphMarkInserted'),
    true,
    'RED: paragraph-mark insertion is not classified structurally as RTK_STRUCTURAL_PARAGRAPH_MARK_INSERTED',
  );
});

// ===========================================================================
// P7 — No cross-paragraph replacement group (red) + same-paragraph control (green).
// ===========================================================================

test('PARSER01-P7-no-cross-paragraph-replacement-group', async () => {
  const parser = await loadParser();
  // del in paragraph 1 (author A) + ins in paragraph 2 (author B), raw gap < 256.
  // RED REASON: parseTextRevisions groups by raw XML distance only (line ~1196),
  // with no story/paragraph boundary check, so both share replacementGroupId.
  const crossDoc = documentXml(
    '<w:p><w:del w:id="101" w:author="A"><w:r><w:delText>old</w:delText></w:r></w:del></w:p>'
    + '<w:p><w:ins w:id="102" w:author="B"><w:r><w:t>new</w:t></w:r></w:ins></w:p>',
  );
  const cross = parser.parseReviewTransportPackageV2(
    { parts: baseParts(crossDoc) },
    { cryptoPort },
  );
  assert.equal(cross.ok, true);
  const crossRevisions = cross.reviewIr.textRevisions || [];
  const sharedCrossGroup = crossRevisions.length === 2
    && crossRevisions[0].replacementGroupId
    && crossRevisions[0].replacementGroupId === crossRevisions[1].replacementGroupId;
  assert.equal(
    sharedCrossGroup,
    false,
    'RED: cross-paragraph del (author A) + ins (author B) share one replacementGroupId because grouping uses raw XML distance only',
  );
});

test('PARSER01-P7b-same-author-cross-paragraph-no-group', async () => {
  const parser = await loadParser();
  // del in paragraph 1 + ins in paragraph 2, SAME author (metadata check passes),
  // raw XML gap < 256. Isolates the paragraph-dimension pin: P7 (different authors)
  // is masked by the metadata check (different authors -> continue before the
  // paragraph guard is even meaningfully exercised), so removing the paragraph-index
  // check still passes P7. P7b forces grouping to be rejected by paragraph dimension
  // alone — both revisions must stay false-sentinel, never a shared groupId.
  // AMDG transparency: the single dimension under test is named explicitly.
  const crossDoc = documentXml(
    '<w:p><w:del w:id="101" w:author="A"><w:r><w:delText>old</w:delText></w:r></w:del></w:p>'
    + '<w:p><w:ins w:id="102" w:author="A"><w:r><w:t>new</w:t></w:r></w:ins></w:p>',
  );
  const cross = parser.parseReviewTransportPackageV2(
    { parts: baseParts(crossDoc) },
    { cryptoPort },
  );
  assert.equal(cross.ok, true);
  const crossRevisions = cross.reviewIr.textRevisions || [];
  const sharedCrossGroup = crossRevisions.length === 2
    && crossRevisions[0].replacementGroupId
    && crossRevisions[0].replacementGroupId === crossRevisions[1].replacementGroupId;
  assert.equal(
    sharedCrossGroup,
    false,
    'RED: same-author cross-paragraph del + ins share one replacementGroupId because the paragraph-index guard was removed and the (passing) metadata check no longer blocks grouping',
  );
});

test('PARSER01-P7c-same-paragraph-replacement-control', async () => {
  const parser = await loadParser();
  // CONTROL: same-paragraph adjacent del+ins (b02 fixture style) group into one pair.
  // Green now and MUST remain green after Pass 2.
  const sameDoc = documentXml(
    '<w:p><w:del w:id="101" w:author="A"><w:r><w:delText>old</w:delText></w:r></w:del>'
    + '<w:ins w:id="102" w:author="A"><w:r><w:t>new</w:t></w:r></w:ins></w:p>',
  );
  const same = parser.parseReviewTransportPackageV2(
    { parts: baseParts(sameDoc) },
    { cryptoPort },
  );
  assert.equal(same.ok, true);
  const revisions = same.reviewIr.textRevisions || [];
  assert.equal(revisions.length, 2);
  assert.match(revisions[0].replacementGroupId, /^[a-f0-9]{64}$/u);
  assert.equal(revisions[0].replacementGroupId, revisions[1].replacementGroupId);
});

// ===========================================================================
// P8 — Comment anchor violations must be typed, not exact/anchored candidates.
// ===========================================================================

test('PARSER01-P8-comment-anchor-violations-typed', async () => {
  const parser = await loadParser();
  const commentsXml = (inner) => `<w:comments xmlns:w="${W_NS}">${inner}</w:comments>`;

  // (a) lone anchor: commentRangeStart with no matching commentRangeEnd.
  // RED REASON: commentAnchorMap sets anchored=true even when rangeEnd is absent
  // (line ~1746), so a lone anchor looks exact.
  const loneDoc = documentXml('<w:p><w:commentRangeStart w:id="7"/><w:r><w:t>anchor</w:t></w:r></w:p>');
  const loneComments = commentsXml('<w:comment w:id="7" w:author="A"><w:p><w:r><w:t>body7</w:t></w:r></w:p></w:comment>');
  const lone = parser.parseReviewTransportPackageV2(
    { parts: baseParts(loneDoc, { 'word/comments.xml': loneComments }) },
    { cryptoPort },
  );
  assert.equal(lone.ok, true);
  const loneThread = lone.reviewIr.commentThreads[0];
  assert.equal(
    loneThread.status === 'ANCHORED' && loneThread.placement.anchored === true,
    false,
    'RED: lone anchor (rangeStart without end) is reported as exact/ANCHORED instead of typed RTK_COMMENT_ANCHOR_*',
  );

  // (b) Word accepts a unique reference-only point and serializes adjacent
  // zero-length markers. Neither missing half-ranges nor foreign references
  // acquire that meaning.
  const refDoc = documentXml('<w:p><w:r><w:t>x</w:t></w:r><w:r><w:commentReference w:id="8"/></w:r></w:p>');
  const refComments = commentsXml('<w:comment w:id="8" w:author="A"><w:p><w:r><w:t>body8</w:t></w:r></w:p></w:comment>');
  const ref = parser.parseReviewTransportPackageV2(
    { parts: baseParts(refDoc, { 'word/comments.xml': refComments }) },
    { cryptoPort },
  );
  assert.equal(ref.ok, true);
  const refThread = ref.reviewIr.commentThreads[0];
  assert.equal(refThread.status, 'ANCHORED');
  assert.equal(refThread.placement.anchored, true);
  assert.equal(refThread.body, 'body8');
  assert.deepEqual(refThread.anchorRange, {startUtf16:1,endUtf16:1,selectedText:'',
    blockTextSha256:cryptoPort.sha256Text('x')});
  for (const inner of [
    '<w:p><w:commentRangeEnd w:id="8"/><w:r><w:commentReference w:id="8"/></w:r></w:p>',
    '<w:p><w:commentRangeStart w:id="8"/><w:r><w:commentReference w:id="8"/></w:r></w:p>',
    '<w:p><w:r><w:commentReference w:id="8"/><w:commentReference w:id="8"/></w:r></w:p>',
    '<w:p><w:r><foreign:commentReference xmlns:foreign="urn:foreign" w:id="8"/></w:r></w:p>',
    '<w:p><w:r><w:t>x</w:t></w:r></w:p><w:r><w:commentReference w:id="8"/></w:r>',
  ]) {
    const malformed = parser.parseReviewTransportPackageV2(
      {parts:baseParts(documentXml(inner), {'word/comments.xml':refComments})}, {cryptoPort});
    assert.equal(malformed.reviewIr?.commentThreads?.some(t=>t.status==='ANCHORED'),false);
  }

  // (c) crossing intervals of two comments.
  // RED REASON: no non-crossing/acyclic check exists, so both crossing ranges look exact.
  const crossDoc = documentXml(
    '<w:p>'
    + '<w:commentRangeStart w:id="1"/><w:r><w:t>AAA</w:t></w:r>'
    + '<w:commentRangeStart w:id="2"/><w:r><w:t>BB</w:t></w:r>'
    + '<w:commentRangeEnd w:id="1"/><w:r><w:t>CC</w:t></w:r>'
    + '<w:commentRangeEnd w:id="2"/>'
    + '</w:p>',
  );
  const crossComments = commentsXml(
    '<w:comment w:id="1" w:author="A"><w:p><w:r><w:t>c1</w:t></w:r></w:p></w:comment>'
    + '<w:comment w:id="2" w:author="B"><w:p><w:r><w:t>c2</w:t></w:r></w:p></w:comment>',
  );
  const cross = parser.parseReviewTransportPackageV2(
    { parts: baseParts(crossDoc, { 'word/comments.xml': crossComments }) },
    { cryptoPort },
  );
  assert.equal(cross.ok, true);
  const exactCrossCount = (cross.reviewIr.commentThreads || [])
    .filter((thread) => thread.status === 'ANCHORED').length;
  assert.equal(
    exactCrossCount === 2,
    false,
    'RED: crossing comment intervals are both reported as exact/ANCHORED instead of typed RTK_COMMENT_ANCHOR_*',
  );

  // (d) duplicate anchor id: two commentRangeStart with the same id.
  // RED REASON: commentAnchorMap is first-wins (line ~1733), so the duplicate is
  // silently dropped rather than typed.
  const dupDoc = documentXml(
    '<w:p>'
    + '<w:commentRangeStart w:id="9"/><w:r><w:t>first</w:t></w:r><w:commentRangeEnd w:id="9"/>'
    + '<w:commentRangeStart w:id="9"/><w:r><w:t>second</w:t></w:r><w:commentRangeEnd w:id="9"/>'
    + '</w:p>',
  );
  const dupComments = commentsXml('<w:comment w:id="9" w:author="A"><w:p><w:r><w:t>body9</w:t></w:r></w:p></w:comment>');
  const dup = parser.parseReviewTransportPackageV2(
    { parts: baseParts(dupDoc, { 'word/comments.xml': dupComments }) },
    { cryptoPort },
  );
  assert.equal(dup.ok, true);
  assert.equal(
    hasReason(dup, 'RTK_COMMENT_ANCHOR_DUPLICATE') || (dup.reviewIr.commentThreads || []).some((thread) => thread.status !== 'ANCHORED'),
    true,
    'RED: duplicate comment anchor id is silently first-wins instead of typed RTK_COMMENT_ANCHOR_DUPLICATE',
  );
});

// ===========================================================================
// P9 — Own-hyperlink roundtrip must be consistent (red) + inert rel control (green).
// ===========================================================================

test('PARSER01-P9-own-hyperlink-roundtrip', async () => {
  const parser = await loadParser();
  // Product-exported packet style: document hyperlinks reference an External rel
  // emitted by the builder (docxReviewPacketBuilder.js line ~333).
  // RED REASON: parser blocks ALL External rels (line ~799), so the product's own
  // packet is rejected as RTK_HOSTILE_PACKAGE_BLOCKED — a self-conflict.
  const document = documentXml(
    '<w:p><w:hyperlink r:id="rIdLink"><w:r><w:t>click</w:t></w:r></w:hyperlink></w:p>',
    'w',
    ` xmlns:r="${R_NS}"`,
  );
  const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid" TargetMode="External"/></Relationships>`;
  const result = parser.parseReviewTransportPackageV2(
    { parts: baseParts(document, { 'word/_rels/document.xml.rels': rels }) },
    { cryptoPort },
  );
  assert.equal(
    result.ok && result.code !== 'RTK_HOSTILE_PACKAGE_BLOCKED',
    true,
    'RED: own product-exported hyperlink packet is blocked as RTK_HOSTILE_PACKAGE_BLOCKED (builder emits External, parser blocks External) — self-conflict; target is a consistent exact-text or declared-inert profile',
  );
});

test('PARSER01-P9c-external-active-rel-control', async () => {
  const parser = await loadParser();
  // CONTROL: External rel outside the hyperlink profile (attached template / executable)
  // MUST remain blocked now and after Pass 2.
  const document = documentXml('<w:p><w:r><w:t>safe</w:t></w:r></w:p>');
  const rels = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rTpl" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="https://evil.invalid/template.dotx" TargetMode="External"/></Relationships>`;
  const result = parser.parseReviewTransportPackageV2(
    { parts: baseParts(document, { 'word/_rels/document.xml.rels': rels }) },
    { cryptoPort },
  );
  assert.equal(result.ok, false);
  assert.equal(hasReason(result, 'RTK_HOSTILE_PACKAGE_BLOCKED'), true);
});

// ===========================================================================
// P10 — Namespace-invariance control (CANON-01 C7): green now and after Pass 2.
// ===========================================================================

test('PARSER01-P10-namespace-invariance-control', async () => {
  const parser = await loadParser();
  const first = parser.parseReviewTransportPackageV2(
    { parts: baseParts(documentXml('<w:p><w:ins w:id="1" w:author="A" w:date="2026-08-08T10:00:00Z"><w:r><w:t>Alpha</w:t></w:r></w:ins></w:p>')) },
    { cryptoPort },
  );
  const second = parser.parseReviewTransportPackageV2(
    { parts: baseParts(documentXml('<x:p><x:ins x:date="2026-08-08T10:00:00Z" x:author="A" x:id="1"><x:r><x:t>Alpha</x:t></x:r></x:ins></x:p>', 'x')) },
    { cryptoPort },
  );
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.supportedSemanticDigest, second.supportedSemanticDigest);
});

// Private-query observer: exact legacy bodies; production exports are unchanged.
const queryFs = require('node:fs');
const queryLegacy = {
  childTokensWithin: String.raw`function childTokensWithin(documentScan, parent) {
  return documentScan.tokens.filter((token) => (
    token.openStart >= parent.openEnd && token.closeEnd <= parent.closeStart
  ));
}`,
  paragraphIndexForOffset: String.raw`function paragraphIndexForOffset(documentScan, offset) {
  if (typeof offset !== 'number') return null;
  let index = 0;
  const tokens = documentScan.logicalTableParagraphs?.map(record => record.token) || documentScan.tokens;
  for (const token of tokens) {
    if (!isWordToken(token, 'p') || (!documentScan.logicalTableParagraphs && (token.path.length !== 3 || token.path[1] !== 'body'))) continue;
    if (offset >= token.openStart && offset <= token.closeEnd) return index;
    index += 1;
  }
  // Fall back to the count of top-level body paragraphs before the offset so a revision that
  // starts before/after a paragraph boundary still maps to a stable positional index.
  let position = 0;
  for (const token of tokens) {
    if (!isWordToken(token, 'p') || (!documentScan.logicalTableParagraphs && (token.path.length !== 3 || token.path[1] !== 'body'))) continue;
    if (token.openStart > offset) break;
    position += 1;
  }
  return position;
}`,
  extractSemanticAtoms: String.raw`function extractSemanticAtoms(xml, documentScan, container) {
  const atoms = [];
  const start = container.openEnd;
  const end = container.closeStart;
  const inner = documentScan.tokens.filter((token) => (
    token.openStart >= start && token.closeEnd <= end
  )).sort((left, right) => left.openStart - right.openStart || right.closeEnd - left.closeEnd);
  for (const token of inner) {
    if (token.namespaceUri !== W_NS) continue;
    if (token.localName === 't' || token.localName === 'delText') {
      const preserve = isXmlSpacePreserve(token, documentScan);
      const raw = decodeEntities(elementBody(xml, token));
      const text = preserve ? raw : raw;
      atoms.push({ kind: token.localName === 'delText' ? 'DeletedText' : 'Text', payload: text, order: token.openStart });
    } else if (token.localName === 'tab') {
      if(token.path?.at(-2)==='tabs'&&token.path?.at(-3)==='pPr')continue;
      atoms.push({ kind: 'Tab', payload: '\t', order: token.openStart });
    } else if (token.localName === 'br') {
      const type = attr(token, 'type');
      if (type === 'page') atoms.push({ kind: 'PageBreak', payload: '\f', order: token.openStart });
      else if (type === 'column') atoms.push({ kind: 'ColumnBreak', payload: '\u000B', order: token.openStart });
      else atoms.push({ kind: 'LineBreak', payload: '\n', order: token.openStart });
    } else if (token.localName === 'cr') {
      atoms.push({ kind: 'CarriageReturn', payload: '\r', order: token.openStart });
    } else if (token.localName === 'softHyphen') {
      atoms.push({ kind: 'SoftHyphen', payload: '\u00AD', order: token.openStart });
    } else if (token.localName === 'noBreakHyphen') {
      atoms.push({ kind: 'NoBreakHyphen', payload: '\u2011', order: token.openStart });
    } else if (token.localName === 'lastRenderedPageBreak') {
      atoms.push({ kind: 'LastRenderedPageBreak', payload: '', order: token.openStart });
    }
  }
  return atoms;
}`
};
function queryReplace(source, name, body) {
  const re = new RegExp('function ' + name + '\\([\\s\\S]*?\\n}');
  assert.match(source, re, name); return source.replace(re, () => body);
}
async function queryModule(legacy = false, trace = false) {
  const file = path.resolve(PARSER_PATH), oldFile = process.env.YALKEN_PARSER_QUERY_OLD_SOURCE;
  let source = queryFs.readFileSync(legacy && oldFile ? oldFile : file, 'utf8');
  if (legacy && oldFile) assert.equal(crypto.createHash('sha256').update(source).digest('hex'), 'e60a3c0853988b185be7b4d753ae4fbd95f84123da1877422bff491dd8cd7bb8');
  if (legacy && !oldFile) for (const [name, body] of Object.entries(queryLegacy)) source = queryReplace(source, name, body);
  if (trace) {
    const body = source.match(/function parseXmlPart\([\s\S]*?\n\}/u)[0];
    assert.equal(body.split('tokens.push(last);').length, 2); assert.equal(body.split('tokens.push(token);').length, 2);
    source = queryReplace(source, 'parseXmlPart', body.replace('tokens.push(last);', 'tokens.push(queryTrace(last));').replace('tokens.push(token);', 'tokens.push(queryTrace(token));'));
    source += `\nlet queryReads = 0;
function queryTrace(token) { return new Proxy(token, { get(target, key, receiver) {
  if (['openStart','closeEnd','localName','namespaceUri','path'].includes(key)) queryReads += 1;
  return Reflect.get(target, key, receiver); } }); }
export function queryReadCount(reset = false) { const result = queryReads; if (reset) queryReads = 0; return result; }`;
  }
  source = source.replace(/from (['"])(\.[^'"]+)\1/gu, (_, quote, rel) => 'from ' + quote + pathToFileURL(path.resolve(path.dirname(file), rel)).href + quote);
  source += '\nexport { parseXmlPart, normalizeBudgets, childTokensWithin, paragraphIndexForOffset, extractSemanticAtoms, crc32 };';
  return import('data:text/javascript;base64,' + Buffer.from(source + '\n// ' + legacy + trace).toString('base64'));
}
function queryPorts(module) { return { ...cryptoPort, crc32: value => module.crc32(Buffer.from(String(value), 'utf8')) }; }
function queryFreeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(queryFreeze); Object.freeze(value); } return value; }
function queryRecord(name, value) {
  const dir = process.env.YALKEN_PARSER_QUERY_EVIDENCE_DIR; if (!dir) return;
  queryFs.mkdirSync(dir, { recursive: true });
  queryFs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(value, (_, v) => typeof v === 'number' && !Number.isFinite(v) ? { number: String(v) } : v, 2) + '\n', { flag: 'wx' });
}
function queryDocument(count) { return documentXml(Array.from({ length: count }, (_, i) => '<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">' + i + ' Café 🧑‍💻</w:t><w:tab/><w:br/></w:r></w:p>').join('')); }
function queryScan(module, xml) { return module.parseXmlPart('word/document.xml', xml, module.normalizeBudgets(), queryPorts(module)); }

test('Parser query index preserves complete descendants, postorder and semantic atoms', async () => {
  const current = await queryModule(), old = await queryModule(true), observations = [];
  for (const xml of [queryDocument(3), ...['preserve','default'].map(value => documentXml('<w:p xml:space="' + value + '"><w:r><w:t>  α &amp; 中文 </w:t><w:delText>old</w:delText><w:cr/><w:softHyphen/><w:noBreakHyphen/><w:lastRenderedPageBreak/><w:br w:type="page"/><w:br w:type="column"/></w:r><w:pPr><w:tabs><w:tab/></w:tabs></w:pPr></w:p>', 'w', ' xmlns:xml="http://www.w3.org/XML/1998/namespace"')),
    documentXml('<w:p><w:r><w:t>A</w:t><f:t xmlns:f="urn:foreign">no</f:t><t>no</t><w:ins w:id="1"><w:r><w:t>B</w:t></w:r></w:ins></w:r></w:p>'),
    documentXmlDefaultNs('<p><r><t>default</t></r></p>', W_NS), documentXml('<w:p/><w:p><w:r/></w:p>'),
    documentXml('<w:p><w:r><w:t>unclosed</w:t></w:p></w:r>')]) {
    const scan = queryFreeze(queryScan(current, xml)), legacy = queryFreeze(queryScan(old, xml)); assert.deepEqual(scan, legacy);
    const containers = [...scan.tokens, ...scan.tokens.filter(t => t.localName === 'p').flatMap(t => [t.openEnd, ...scan.tokens.filter(child => child.openStart > t.openEnd && child.closeEnd < t.closeStart).map(child => child.openStart)].map(closeStart => ({ ...t, closeStart })))];
    const results = containers.map(container => {
      const children = current.childTokensWithin(scan, container), atoms = current.extractSemanticAtoms(xml, scan, container);
      assert.deepEqual(children, old.childTokensWithin(legacy, container)); assert.deepEqual(atoms, old.extractSemanticAtoms(xml, legacy, container));
      assert.ok(children.every(t => scan.tokens.includes(t))); return { container, children, atoms };
    }); observations.push({ xml, scan, results });
  }
  const xml = queryDocument(2), scan = queryScan(current, xml); scan.tokens.reverse(); queryFreeze(scan);
  for (const container of scan.tokens) {
    const children = current.childTokensWithin(scan, container), atoms = current.extractSemanticAtoms(xml, scan, container);
    assert.deepEqual(children, old.childTokensWithin(scan, container)); assert.deepEqual(atoms, old.extractSemanticAtoms(xml, scan, container));
    observations.push({ nonmonotonic: true, xml, scan, container, children, atoms });
  } queryRecord('descendants-atoms', observations);
});

test('Parser paragraph lookup retains inclusive boundaries and logical table order', async () => {
  const current = await queryModule(), old = await queryModule(true), xml = documentXml('<w:p/><w:p><w:r><w:t>outer</w:t></w:r><w:p/></w:p><f:p xmlns:f="urn:foreign"/>'), observations = [];
  for (const order of [null, [], [0, 2], [2, 0], [2, 1], [1, 2], [3, 0]]) {
    const scan = queryScan(current, xml), paragraphs = scan.tokens.filter(t => t.localName === 'p');
    if (order) scan.logicalTableParagraphs = order.map(i => ({ token: paragraphs[i] }));
    queryFreeze(scan); const snapshot = JSON.stringify(scan);
    const offsets = [undefined, null, '1', -Infinity, Infinity, NaN, -0, ...paragraphs.flatMap(t => [t.openStart - 1, t.openStart, t.openEnd, t.closeEnd - 1, t.closeEnd, t.closeEnd + 1])];
    const results = offsets.map(offset => { const actual = current.paragraphIndexForOffset(scan, offset); assert.equal(actual, old.paragraphIndexForOffset(scan, offset)); return { offset, actual }; });
    assert.equal(JSON.stringify(scan), snapshot); observations.push({ order, scan, results });
  }
  const scan = queryScan(current, xml), ps = scan.tokens.filter(t => t.localName === 'p' && t.path.length === 3 && t.namespaceUri === W_NS);
  assert.equal(ps[0].closeEnd, ps[1].openStart); assert.equal(current.paragraphIndexForOffset(scan, ps[1].openStart), 0);
  for (const order of [ps, [...ps].reverse(), []]) { scan.logicalTableParagraphs = order.map(token => ({ token })); assert.equal(current.paragraphIndexForOffset(scan, 100), old.paragraphIndexForOffset(scan, 100)); }
  const supplied = { tokens: [...scan.tokens].reverse() }; assert.equal(current.paragraphIndexForOffset(supplied, 100), old.paragraphIndexForOffset(supplied, 100));
  supplied.tokens.reverse(); assert.deepEqual(current.childTokensWithin(supplied, ps[1]), old.childTokensWithin(supplied, ps[1]));
  observations.push({ touchingBoundary: ps[1].openStart, fresh: queryScan(current, queryDocument(1)) }); queryRecord('paragraph-boundaries', observations);
});

test('Parser indexing preserves entire public outputs, typed refusals and immutable inputs', async () => {
  const current = await queryModule(), old = await queryModule(true), cases = [];
  for (const n of [10, 20, 40]) cases.push({ label: 'novel-' + n, parts: baseParts(queryDocument(n)), expectedOk: true });
  for (const [label, xml] of [['foreign', documentXml('<f:p xmlns:f="urn:foreign"><f:r><f:t>foreign</f:t></f:r></f:p>')], ['qname', documentXml('<w:p></x:p>', 'w', ` xmlns:x="${W_NS}"`)], ['unbound', documentXml('<zz:ins/>')], ['DTD', '<!DOCTYPE w:document>' + queryDocument(1)], ['malformed', queryDocument(1).replace('</w:r>', '</w:p>')]]) cases.push({ label, parts: baseParts(xml), ...(label !== 'foreign' ? { expectedOk: false } : {}) });
  cases.push({ label: 'tight-blocks', parts: baseParts(queryDocument(10)), budgets: { maxBlocks: 2 }, expectedOk: false }, { label: 'tight-output', parts: baseParts(queryDocument(10)), budgets: { maxWorkerOutputBytes: 1 }, expectedOk: false });
  for (const fixture of require('../fixtures/word-table-cell-shift-native-v1.json').cases) cases.push({ label: 'native-table-' + fixture.operation, parts: fixture.parts });
  const notes = require('../../src/export/docx/docxReviewPacketNotes.js'), model = require('../../src/core/word-manuscript-notes-v1.cjs');
  const block = { sceneId: 'roman/a.txt', blockId: 'b', documentParagraphIndex: 0, text: 'Text' };
  const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rich Café', marks: [{ type: 'bold' }] }, { type: 'hardBreak' }, { type: 'text', text: '中文' }] }, { type: 'paragraph' }] };
  const document = { schemaVersion: 1, projectId: 'p', notes: [{ id: 'a', scope: 'manuscript', title: '', body: 'Rich Café\n中文\n', manuscript: model.bindManuscriptPayload({ body, kind: 'footnote', sceneId: block.sceneId, offsetUtf16: 0, sceneContent: 'Text' }) }] };
  const projection = notes.buildCanonicalNotesExport(document, [], [block], 'p', { editableReturn: true }), noteParts = notes.notePackageParts(projection);
  const parts = baseParts(documentXml('<w:p>' + notes.noteMarkersForBlock(projection, block).get(0) + '<w:r><w:t>Text</w:t></w:r></w:p>'), Object.fromEntries(noteParts.entries.map(e => [e.name, e.data])));
  parts['[Content_Types].xml'] = CONTENT_TYPES.replace('</Types>', noteParts.contentTypes + '</Types>'); parts['word/_rels/document.xml.rels'] = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + noteParts.relationships + '</Relationships>';
  cases.push({ label: 'rich-note', parts, expectedOk: true });
  const comments = '<w:comments xmlns:w="' + W_NS + '"><w:comment w:id="7" w:author="Writer"><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>rich</w:t><w:br/><w:t>reply</w:t></w:r></w:p><w:p/></w:comment></w:comments>';
  cases.push({ label: 'comment', parts: baseParts(documentXml('<w:p><w:commentRangeStart w:id="7"/><w:r><w:t>anchor</w:t></w:r><w:commentRangeEnd w:id="7"/><w:r><w:commentReference w:id="7"/></w:r></w:p>'), { 'word/comments.xml': comments }), expectedOk: true });
  const observations = cases.map(input => {
    queryFreeze(input); const snapshot = JSON.stringify(input), options = { cryptoPort: queryPorts(current) };
    const expected = old.parseReviewTransportPackageV2({ parts: input.parts, budgets: input.budgets }, options), actual = current.parseReviewTransportPackageV2({ parts: input.parts, budgets: input.budgets }, options);
    assert.deepEqual(actual, expected, input.label); if (input.expectedOk !== undefined) assert.equal(actual.ok, input.expectedOk, input.label + ':' + JSON.stringify(actual.reasons));
    assert.equal(JSON.stringify(input), snapshot); assert.equal(actual.canApply, false); assert.equal(actual.canWriteManuscript, false); return { input, expected, actual };
  }); queryRecord('complete-public-parser', observations);
});

test('Parser query work scales with local ranges instead of every document token per lookup', async () => {
  const current = await queryModule(false, true), old = await queryModule(true, true), observations = [];
  for (const n of [32, 64, 128]) {
    const xml = queryDocument(n), scan = queryFreeze(queryScan(current, xml)), legacy = queryFreeze(queryScan(old, xml));
    const queries = scan.tokens.filter(t => ['pPr','rPr','p'].includes(t.localName)); current.queryReadCount(true); old.queryReadCount(true);
    const results = queries.map(container => {
      const children = current.childTokensWithin(scan, container), expectedChildren = old.childTokensWithin(legacy, container);
      assert.deepEqual(children, expectedChildren);
      const paragraph = current.paragraphIndexForOffset(scan, container.openStart), expectedParagraph = old.paragraphIndexForOffset(legacy, container.openStart); assert.equal(paragraph, expectedParagraph);
      const atoms = current.extractSemanticAtoms(xml, scan, container), expectedAtoms = old.extractSemanticAtoms(xml, legacy, container); assert.deepEqual(atoms, expectedAtoms);
      return { container, children, paragraph, atoms };
    }); observations.push({ n, xml, tokens: scan.tokens, results, currentReads: current.queryReadCount(), oldReads: old.queryReadCount() });
  }
  queryRecord('scaling', observations); // Save every result before the causal count assertion.
  for (const row of observations) assert.ok(row.currentReads <= 150 * row.n * (1 + Math.log2(row.n)), JSON.stringify({ n: row.n, actual: row.currentReads, old: row.oldReads }));
  assert.ok(observations[2].currentReads <= 2.7 * observations[1].currentReads, 'doubling must avoid quadratic repeated scans');
});
