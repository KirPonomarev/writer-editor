const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');

const PARSER_PATH = 'src/io/revisionBridge/reviewTransportPackageParserV2.mjs';
const RECEIPT_PATH = 'docs/OPS/RTK/WORD_LATEST_SEMANTIC_ROUNDTRIP_V2_B03_MODERN_COMMENTS_RECEIPT.json';
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const W14_NS = 'http://schemas.microsoft.com/office/word/2010/wordml';
const W15_NS = 'http://schemas.microsoft.com/office/word/2012/wordml';
const W16CID_NS = 'http://schemas.microsoft.com/office/word/2016/wordml/cid';

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
};

async function loadParser() {
  return import(pathToFileURL(path.join(process.cwd(), PARSER_PATH)).href);
}

function documentXml(body) {
  return `<w:document xmlns:w="${W_NS}"><w:body>${body}</w:body></w:document>`;
}

function parts(document, comments = '') {
  return {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': document,
    ...(comments ? { 'word/comments.xml': comments } : {}),
  };
}

function modernCommentParts(document, comments, commentsEx = '', commentsIds = '') {
  return {
    ...parts(document, comments),
    'word/commentsExtended.xml': commentsEx || `<w15:commentsEx xmlns:w15="${W15_NS}"/>`,
    'word/commentsIds.xml': commentsIds || `<w16cid:commentsIds xmlns:w16cid="${W16CID_NS}"/>`,
  };
}

function commentIdsXml(count) {
  return `<w16cid:commentsIds xmlns:w16cid="${W16CID_NS}">${
    Array.from({ length: count }, (_, index) => {
      const id = index + 1;
      return `<w16cid:commentId w16cid:paraId="${hexParaId(id)}" w16cid:durableId="${hexParaId(id)}"/>`;
    }).join('')
  }</w16cid:commentsIds>`;
}

function hexParaId(value) {
  return value.toString(16).toUpperCase().padStart(8, '0');
}

test('B03 comment graph preserves reopened state durable identity ordering and recursive replies', async () => {
  const parser = await loadParser();
  const result = parser.parseReviewTransportPackageV2({
    expectedCommentThreads: [{ commentId: '7', durableId: 'durable-root', doneResolvedReopenedState: 'resolved' }],
    parts: {
      ...parts(
        documentXml('<w:p><w:commentRangeStart w:id="7"/><w:r><w:t>anchor text</w:t></w:r><w:commentRangeEnd w:id="7"/><w:r><w:commentReference w:id="7"/></w:r></w:p>'),
        `<w:comments xmlns:w="${W_NS}">
          <w:comment w:id="7" w:paraId="root" w:author="A" w:initials="AA"><w:p><w:r><w:t>Root</w:t></w:r></w:p></w:comment>
          <w:comment w:id="8" w:paraId="reply1" w:parentId="7" w:author="B"><w:p><w:r><w:t>Reply 1</w:t></w:r></w:p></w:comment>
          <w:comment w:id="9" w:paraId="reply2" w:parentId="8" w:author="C"><w:p><w:r><w:t>Reply 2</w:t></w:r></w:p></w:comment>
        </w:comments>`,
      ),
      'word/commentsExtended.xml': `<w15:commentsEx xmlns:w15="${W15_NS}"><w15:commentEx w15:paraId="root" w15:done="0"/></w15:commentsEx>`,
      'word/commentsIds.xml': `<w16cid:commentsIds xmlns:w16cid="${W16CID_NS}"><w16cid:commentId w16cid:paraId="root" w16cid:durableId="durable-root"/></w16cid:commentsIds>`,
      'word/commentsExtensible.xml': '<w16cex:commentsExtensible xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex"><w16cex:commentExtensible w16cex:paraId="root" w16cex:durableId="durable-root" w16cex:reopened="1"/></w16cex:commentsExtensible>',
      'word/people.xml': `<w15:people xmlns:w15="${W15_NS}"><w15:person w15:author="A" w15:userId="synthetic"/></w15:people>`,
    },
  }, { cryptoPort });

  assert.equal(result.ok, true);
  assert.equal(result.commentGraphCapability.status, 'PARSER_ONLY_NOT_CERTIFIED');
  assert.equal(result.commentGraphCapability.commentPassAllowed, false);
  assert.equal(result.commentGraphCapability.replyCount, 2);
  const thread = result.reviewIr.commentThreads[0];
  assert.equal(thread.durableId, 'durable-root');
  assert.equal(thread.doneResolvedReopenedState, 'reopened');
  assert.equal(thread.status, 'ANCHORED');
  assert.equal(thread.orderingKey, 0);
  assert.deepEqual(thread.replies.map((reply) => reply.parentRawId), ['7', '8']);
  assert.deepEqual(thread.replies.map((reply) => reply.body), ['Reply 1', 'Reply 2']);
});

test('B03 comment on deleted text keeps anchor quote and related delete revision without apply authority', async () => {
  const parser = await loadParser();
  const result = parser.parseReviewTransportPackageV2({
    parts: parts(
      documentXml('<w:p><w:del w:id="del-1" w:author="Editor"><w:commentRangeStart w:id="5"/><w:r><w:delText>doomed text</w:delText></w:r><w:commentRangeEnd w:id="5"/></w:del><w:r><w:commentReference w:id="5"/></w:r></w:p>'),
      `<w:comments xmlns:w="${W_NS}"><w:comment w:id="5" w:author="A"><w:p><w:r><w:t>Comment on deleted text</w:t></w:r></w:p></w:comment></w:comments>`,
    ),
  }, { cryptoPort });

  const thread = result.reviewIr.commentThreads[0];
  assert.equal(result.ok, true);
  assert.equal(thread.status, 'ANCHORED');
  assert.equal(thread.quotedAnchorText, 'doomed text');
  assert.equal(thread.relatedRevision.kind, 'delete');
  assert.equal(thread.relatedRevision.nativeRevisionId, 'del-1');
  assert.equal(result.reviewIr.textRevisions[0].operation, 'delete');
  assert.equal(result.canApply, false);
});

test('B03 orphan and missing expected comments are preserved as typed non-silent outcomes', async () => {
  const parser = await loadParser();
  const result = parser.parseReviewTransportPackageV2({
    expectedCommentThreads: [{ commentId: 'missing-1', durableId: 'durable-missing', bodyExcerpt: 'previous body' }],
    parts: parts(
      documentXml('<w:p><w:r><w:t>No live anchor remains</w:t></w:r></w:p>'),
      `<w:comments xmlns:w="${W_NS}"><w:comment w:id="10" w:author="A"><w:p><w:r><w:t>Orphan survives</w:t></w:r></w:p></w:comment></w:comments>`,
    ),
  }, { cryptoPort });

  assert.equal(result.ok, true);
  assert.equal(result.reviewIr.commentThreads.length, 2);
  assert.equal(result.reviewIr.commentThreads[0].status, 'ORPHAN');
  assert.equal(result.reviewIr.commentThreads[0].body, 'Orphan survives');
  assert.equal(result.reviewIr.commentThreads[1].status, 'UNSUPPORTED_BLOCKED');
  assert.equal(result.reviewIr.commentThreads[1].doneResolvedReopenedState, 'deleted-or-missing');
  assert.equal(result.reviewIr.commentThreads[1].bodyExcerpt, 'previous body');
  assert.equal(result.reasons.some((reason) => reason.code === 'RTK_COMMENT_UNSUPPORTED'), true);
});

test('B03 duplicate IDs and no-op empty comments never produce a comment support pass', async () => {
  const parser = await loadParser();
  const duplicate = parser.parseReviewTransportPackageV2({
    physicalWordReopenVisibility: true,
    parts: parts(
      documentXml('<w:p><w:r><w:t>Body</w:t></w:r></w:p>'),
      `<w:comments xmlns:w="${W_NS}">
        <w:comment w:id="1"><w:p><w:r><w:t>First</w:t></w:r></w:p></w:comment>
        <w:comment w:id="1"><w:p><w:r><w:t>Duplicate</w:t></w:r></w:p></w:comment>
      </w:comments>`,
    ),
  }, { cryptoPort });
  const noop = parser.parseReviewTransportPackageV2({
    physicalWordReopenVisibility: true,
    parts: parts(documentXml('<w:p><w:r><w:t>No comments here</w:t></w:r></w:p>')),
  }, { cryptoPort });

  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.reviewIr.commentThreads.some((thread) => thread.status === 'UNSUPPORTED_BLOCKED'), true);
  assert.equal(duplicate.commentGraphCapability.commentPassAllowed, false);
  assert.equal(noop.ok, true);
  assert.equal(noop.reviewIr.commentThreads.length, 0);
  assert.equal(noop.commentGraphCapability.commentPassAllowed, false);
  assert.equal(noop.commentGraphCapability.noOpSaveCountsAsPass, false);
});

test('B03 modern comments infer reply graph from last paragraph w14 paraId only', async () => {
  const parser = await loadParser();
  const result = parser.parseReviewTransportPackageV2({
    parts: modernCommentParts(
      documentXml('<w:p><w:r><w:t>Body</w:t></w:r></w:p>'),
      `<w:comments xmlns:w="${W_NS}" xmlns:w14="${W14_NS}">
        <w:comment w:id="21" w:author="Alice"><w:p><w:r><w:t>lead</w:t></w:r></w:p><w:p w14:paraId="00AA0001"><w:r><w:t>root</w:t></w:r></w:p></w:comment>
        <w:comment w:id="22" w:author="Bob"><w:p w14:paraId="00AA0002"><w:r><w:t>reply bob</w:t></w:r></w:p></w:comment>
        <w:comment w:id="23" w:author="Carol"><w:p w14:paraId="00AA0003"><w:r><w:t>reply carol</w:t></w:r></w:p></w:comment>
      </w:comments>`,
      `<w15:commentsEx xmlns:w15="${W15_NS}">
        <w15:commentEx w15:paraId="00AA0001"/>
        <w15:commentEx w15:paraId="00AA0002" w15:paraIdParent="00AA0001"/>
        <w15:commentEx w15:paraId="00AA0003" w15:paraIdParent="00AA0002"/>
      </w15:commentsEx>`,
      `<w16cid:commentsIds xmlns:w16cid="${W16CID_NS}">
        <w16cid:commentId w16cid:paraId="00AA0001" w16cid:durableId="00AA0001"/>
        <w16cid:commentId w16cid:paraId="00AA0002" w16cid:durableId="00AA0002"/>
        <w16cid:commentId w16cid:paraId="00AA0003" w16cid:durableId="00AA0003"/>
      </w16cid:commentsIds>`,
    ),
  }, { cryptoPort });

  const thread = result.reviewIr.commentThreads[0];
  assert.equal(result.ok, true);
  assert.deepEqual(thread.replies.map((reply) => [reply.rawId, reply.parentRawId]), [['22', '21'], ['23', '22']]);
  assert.deepEqual([thread.body, ...thread.replies.map((reply) => reply.body)], ['leadroot', 'reply bob', 'reply carol']);
  assert.deepEqual([thread.authorPersonIdentity.author, ...thread.replies.map((reply) => reply.author)], ['Alice', 'Bob', 'Carol']);
  assert.equal(result.reasons.some((reason) => reason.code.startsWith('RTK_COMMENT_PARENT_')), false);
});

test('B03 modern comment paraId fallback ignores ancestor namespace shadowing', async () => {
  const parser = await loadParser();
  const result = parser.parseReviewTransportPackageV2({
    parts: modernCommentParts(
      documentXml('<w:p><w:r><w:t>Body</w:t></w:r></w:p>'),
      `<w:comments xmlns:w="${W_NS}" xmlns:w14="${W14_NS}">
        <w:comment w:id="21" w:author="Alice" xmlns:w14="urn:yalken:foreign"><w:p w14:paraId="00AA0001"><w:r><w:t>root</w:t></w:r></w:p></w:comment>
        <w:comment w:id="22" w:author="Bob"><w:p w14:paraId="00AA0002"><w:r><w:t>reply bob</w:t></w:r></w:p></w:comment>
        <w:comment w:id="23" w:author="Carol"><w:p w14:paraId="00AA0003"><w:r><w:t>reply carol</w:t></w:r></w:p></w:comment>
      </w:comments>`,
      `<w15:commentsEx xmlns:w15="${W15_NS}">
        <w15:commentEx w15:paraId="00AA0001"/>
        <w15:commentEx w15:paraId="00AA0002" w15:paraIdParent="00AA0001"/>
        <w15:commentEx w15:paraId="00AA0003" w15:paraIdParent="00AA0002"/>
      </w15:commentsEx>`,
      `<w16cid:commentsIds xmlns:w16cid="${W16CID_NS}">
        <w16cid:commentId w16cid:paraId="00AA0001" w16cid:durableId="00AA0001"/>
        <w16cid:commentId w16cid:paraId="00AA0002" w16cid:durableId="00AA0002"/>
        <w16cid:commentId w16cid:paraId="00AA0003" w16cid:durableId="00AA0003"/>
      </w16cid:commentsIds>`,
    ),
  }, { cryptoPort });

  const edges = result.reviewIr.commentThreads.flatMap((thread) => (
    thread.replies.map((reply) => [reply.rawId, reply.parentRawId])
  ));
  const bodies = result.reviewIr.commentThreads.flatMap((thread) => [
    thread.body,
    ...thread.replies.map((reply) => reply.body),
  ]);

  assert.equal(result.ok, true);
  assert.deepEqual(edges, [['23', '22']]);
  assert.deepEqual(bodies, ['root', 'reply bob', 'reply carol']);
});

test('B03 malformed modern comment parent identities preserve comments with typed relation loss', async () => {
  const parser = await loadParser();
  const duplicate = parser.parseReviewTransportPackageV2({
    parts: modernCommentParts(
      documentXml('<w:p><w:r><w:t>Body</w:t></w:r></w:p>'),
      `<w:comments xmlns:w="${W_NS}" xmlns:w14="${W14_NS}">
        <w:comment w:id="1" w:author="A"><w:p w14:paraId="00BB0001"><w:r><w:t>root</w:t></w:r></w:p></w:comment>
        <w:comment w:id="2" w:author="B"><w:p w14:paraId="00BB0001"><w:r><w:t>reply</w:t></w:r></w:p></w:comment>
      </w:comments>`,
      `<w15:commentsEx xmlns:w15="${W15_NS}">
        <w15:commentEx w15:paraId="00BB0001"/>
        <w15:commentEx w15:paraId="00BB0001" w15:paraIdParent="00BB0001"/>
      </w15:commentsEx>`,
      `<w16cid:commentsIds xmlns:w16cid="${W16CID_NS}">
        <w16cid:commentId w16cid:paraId="00BB0001" w16cid:durableId="00BB0001"/>
      </w16cid:commentsIds>`,
    ),
  }, { cryptoPort });
  const self = parser.parseReviewTransportPackageV2({
    parts: modernCommentParts(
      documentXml('<w:p><w:r><w:t>Body</w:t></w:r></w:p>'),
      `<w:comments xmlns:w="${W_NS}" xmlns:w14="${W14_NS}"><w:comment w:id="1" w:author="A"><w:p w14:paraId="00CC0001"><w:r><w:t>self</w:t></w:r></w:p></w:comment></w:comments>`,
      `<w15:commentsEx xmlns:w15="${W15_NS}"><w15:commentEx w15:paraId="00CC0001" w15:paraIdParent="00CC0001"/></w15:commentsEx>`,
      `<w16cid:commentsIds xmlns:w16cid="${W16CID_NS}"><w16cid:commentId w16cid:paraId="00CC0001" w16cid:durableId="00CC0001"/></w16cid:commentsIds>`,
    ),
  }, { cryptoPort });
  const cycle = parser.parseReviewTransportPackageV2({
    parts: modernCommentParts(
      documentXml('<w:p><w:r><w:t>Body</w:t></w:r></w:p>'),
      `<w:comments xmlns:w="${W_NS}" xmlns:w14="${W14_NS}">
        <w:comment w:id="1" w:author="A"><w:p w14:paraId="00DD0001"><w:r><w:t>one</w:t></w:r></w:p></w:comment>
        <w:comment w:id="2" w:author="B"><w:p w14:paraId="00DD0002"><w:r><w:t>two</w:t></w:r></w:p></w:comment>
      </w:comments>`,
      `<w15:commentsEx xmlns:w15="${W15_NS}">
        <w15:commentEx w15:paraId="00DD0001" w15:paraIdParent="00DD0002"/>
        <w15:commentEx w15:paraId="00DD0002" w15:paraIdParent="00DD0001"/>
      </w15:commentsEx>`,
      `<w16cid:commentsIds xmlns:w16cid="${W16CID_NS}">
        <w16cid:commentId w16cid:paraId="00DD0001" w16cid:durableId="00DD0001"/>
        <w16cid:commentId w16cid:paraId="00DD0002" w16cid:durableId="00DD0002"/>
      </w16cid:commentsIds>`,
    ),
  }, { cryptoPort });

  assert.deepEqual(duplicate.reviewIr.commentThreads.map((thread) => thread.status), ['UNSUPPORTED_BLOCKED', 'UNSUPPORTED_BLOCKED']);
  assert.deepEqual(duplicate.reviewIr.commentThreads.map((thread) => thread.body), ['root', 'reply']);
  assert.equal(duplicate.reasons.some((reason) => reason.code === 'RTK_COMMENT_PARENT_AMBIGUOUS'), true);
  assert.deepEqual(self.reviewIr.commentThreads.map((thread) => thread.status), ['UNSUPPORTED_BLOCKED']);
  assert.deepEqual(self.reviewIr.commentThreads.map((thread) => thread.body), ['self']);
  assert.equal(self.reasons.some((reason) => reason.code === 'RTK_COMMENT_PARENT_SELF_REFERENCE'), true);
  assert.deepEqual(cycle.reviewIr.commentThreads.map((thread) => thread.status), ['UNSUPPORTED_BLOCKED', 'UNSUPPORTED_BLOCKED']);
  assert.deepEqual(cycle.reviewIr.commentThreads.map((thread) => thread.body), ['one', 'two']);
  assert.equal(cycle.reasons.filter((reason) => reason.code === 'RTK_COMMENT_PARENT_CYCLE').length, 2);
});

test('B03 long modern comment parent cycle is bounded and preserves every comment', async () => {
  const parser = await loadParser();
  const count = 64;
  const comments = Array.from({ length: count }, (_, index) => {
    const id = index + 1;
    return `<w:comment w:id="${id}" w:author="author-${id}"><w:p w14:paraId="${hexParaId(id)}"><w:r><w:t>body-${id}</w:t></w:r></w:p></w:comment>`;
  }).join('');
  const commentsEx = Array.from({ length: count }, (_, index) => {
    const id = index + 1;
    const parent = id === 1 ? count : id - 1;
    return `<w15:commentEx w15:paraId="${hexParaId(id)}" w15:paraIdParent="${hexParaId(parent)}"/>`;
  }).join('');
  const result = parser.parseReviewTransportPackageV2({
    parts: modernCommentParts(
      documentXml('<w:p><w:r><w:t>Body</w:t></w:r></w:p>'),
      `<w:comments xmlns:w="${W_NS}" xmlns:w14="${W14_NS}">${comments}</w:comments>`,
      `<w15:commentsEx xmlns:w15="${W15_NS}">${commentsEx}</w15:commentsEx>`,
      commentIdsXml(count),
    ),
  }, { cryptoPort });

  assert.equal(result.ok, true);
  assert.equal(result.reviewIr.commentThreads.length, count);
  assert.equal(result.reviewIr.commentThreads.every((thread) => thread.status === 'UNSUPPORTED_BLOCKED'), true);
  assert.equal(new Set(result.reviewIr.commentThreads.map((thread) => thread.body)).size, count);
  assert.equal(result.reasons.filter((reason) => reason.code === 'RTK_COMMENT_PARENT_CYCLE').length, count);
  assert.equal(result.reasons.filter((reason) => reason.code.startsWith('RTK_COMMENT_PARENT_')).length, count);
});

test('B03 receipt stays parser-only and does not certify latest Word comments', () => {
  const receipt = JSON.parse(fs.readFileSync(path.join(process.cwd(), RECEIPT_PATH), 'utf8'));

  assert.equal(receipt.status, 'B03_COMMENT_GRAPH_PARSER_READY_NOT_CERTIFIED');
  assert.equal(receipt.nonClaims.latestWordCertified, false);
  assert.equal(receipt.nonClaims.modernCommentsPhysicallyCertified, false);
  assert.equal(receipt.nonClaims.automaticApplyExpanded, false);
});
