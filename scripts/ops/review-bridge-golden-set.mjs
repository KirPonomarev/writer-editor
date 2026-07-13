#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildDocxMinBuffer,
  buildStoredZip,
} = require('../../src/export/docx/docxMinBuilder.js');

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'test', 'fixtures', 'revision-bridge', 'v1');
const WRITE_MODE = process.argv.includes('--write');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function xmlEscape(value) {
  const entities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  };
  return String(value).replace(/[&<>"']/gu, (character) => entities[character]);
}

async function buildMinimalDocxFixture() {
  const [docxPageSetupBindModule, semanticMappingModule, styleMapModule] = await Promise.all([
    import('../../src/docxPageSetupBind.mjs'),
    import('../../src/derived/semanticMapping.mjs'),
    import('../../src/derived/styleMap.mjs'),
  ]);
  const doc = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Golden Book' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Golden Scene' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph before the page break.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: semanticMappingModule.PAGE_BREAK_TOKEN_V1 }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Paragraph after the page break.' }] },
    ],
  };
  return buildDocxMinBuffer(
    {
      content: '',
      plainText: 'Golden Book\nGolden Scene\nParagraph before the page break.\n[[PAGE_BREAK]]\nParagraph after the page break.',
      doc,
      bookProfile: { formatId: 'A4', orientation: 'portrait' },
    },
    {
      docxPageSetupBindModule,
      semanticMappingModule,
      styleMapModule,
    },
  );
}

function buildReviewEvidenceDocxFixture() {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>
</Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>
</Relationships>`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:commentRangeStart w:id="0"/><w:r><w:t>Anchored evidence</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Alpha </w:t></w:r><w:del w:id="1" w:author="reviewer" w:date="2026-07-12T00:00:00.000Z"><w:r><w:delText>beta</w:delText></w:r></w:del><w:ins w:id="2" w:author="reviewer" w:date="2026-07-12T00:00:00.000Z"><w:r><w:t>delta</w:t></w:r></w:ins><w:r><w:t xml:space="preserve"> gamma.</w:t></w:r></w:p>
  </w:body>
</w:document>`;
  const commentsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:comment w:id="0" w:author="reviewer" w:date="2026-07-12T00:00:00.000Z"><w:p><w:r><w:t>${xmlEscape('Keep this comment text.')}</w:t></w:r></w:p></w:comment>
</w:comments>`;

  return buildStoredZip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'word/_rels/document.xml.rels', data: documentRels },
    { name: 'word/comments.xml', data: commentsXml },
    { name: 'word/document.xml', data: documentXml },
  ]);
}

function buildReviewPacketFixture() {
  return Buffer.from(stableJson({
    packetVersion: 'review-packet.v1',
    projectId: 'golden-project-v1',
    sessionId: 'golden-review-session-v1',
    baselineHash: 'f4f08b8ce5f18ad760cb9b3e2865581585ad37cbb6ca092acb5b7567319e05b7',
    createdAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
    reviewPacket: {
      commentThreads: [
        {
          threadId: 'thread-1',
          authorId: 'reviewer-1',
          status: 'open',
          createdAt: '2026-07-12T00:00:00.000Z',
          updatedAt: '2026-07-12T00:00:00.000Z',
          messages: [{
            messageId: 'message-1',
            authorId: 'reviewer-1',
            body: 'Keep this review comment.',
            createdAt: '2026-07-12T00:00:00.000Z',
          }],
        },
      ],
      commentPlacements: [
        {
          placementId: 'placement-1',
          threadId: 'thread-1',
          targetScope: { type: 'scene', id: 'scene-1' },
          anchor: { kind: 'text', value: 'old words' },
          range: { from: 7, to: 16 },
          quote: 'old words',
          prefix: 'Before ',
          suffix: ' after.',
          confidence: 1,
          policy: 'exact',
          selector: { type: 'text-position', start: 7, end: 16 },
          createdAt: '2026-07-12T00:00:00.000Z',
        },
      ],
      textChanges: [
        {
          changeId: 'change-1',
          targetScope: { type: 'scene', id: 'scene-1' },
          match: { kind: 'exact', quote: 'old words' },
          replacementText: 'new words',
          createdAt: '2026-07-12T00:00:00.000Z',
        },
      ],
      structuralChanges: [],
      diagnosticItems: [
        {
          diagnosticId: 'diagnostic-1',
          severity: 'info',
          message: 'Tracked changes remain diagnostic evidence.',
          createdAt: '2026-07-12T00:00:00.000Z',
        },
      ],
      decisionStates: [
        {
          decisionId: 'decision-1',
          itemKind: 'textChange',
          itemId: 'change-1',
          status: 'pending',
        },
      ],
    },
  }), 'utf8');
}

async function buildFixtures() {
  return new Map([
    ['docx-minimal-export-v1.docx', await buildMinimalDocxFixture()],
    ['docx-review-evidence-v1.docx', buildReviewEvidenceDocxFixture()],
    ['review-packet-v1.json', buildReviewPacketFixture()],
    ['txt-content-v1.txt', Buffer.from('First imported paragraph.\nSecond imported paragraph.\nUnicode: Привет, мир.\n', 'utf8')],
    ['markdown-content-v1.md', Buffer.from('# Golden Markdown\n\nLiteral markers: \\# hash and \\- dash.\n\n- first item\n- second item\n\n```js\nconst value = `backtick`;\n```\n', 'utf8')],
  ]);
}

const fixtures = await buildFixtures();
const results = [];
let ok = true;

if (WRITE_MODE) fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [fileName, expectedBytes] of fixtures) {
  const filePath = path.join(OUT_DIR, fileName);
  if (WRITE_MODE) fs.writeFileSync(filePath, expectedBytes);
  const actualBytes = fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
  const matches = Buffer.isBuffer(actualBytes) && actualBytes.equals(expectedBytes);
  ok = ok && matches;
  results.push({
    fileName,
    byteSize: expectedBytes.length,
    sha256: sha256(expectedBytes),
    matchesGeneratedBytes: matches,
  });
}

process.stdout.write(`${JSON.stringify({
  ok,
  mode: WRITE_MODE ? 'write-and-check' : 'check',
  outputDirectory: 'test/fixtures/revision-bridge/v1',
  files: results,
}, null, 2)}\n`);

process.exit(ok ? 0 : 1);
