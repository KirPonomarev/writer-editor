import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const REPO_ROOT = process.cwd();

const {
  DOCX_TEXT_XML_ERRORS,
  buildDocxRunContentXml,
  segmentDocxTextForSerialization,
} = require(path.join(REPO_ROOT, 'src', 'export', 'docx', 'docxTextXml.js'));
const { buildDocxMinBuffer } = require(path.join(REPO_ROOT, 'src', 'export', 'docx', 'docxMinBuilder.js'));
const { buildDocxReviewPacketBuffer } = require(path.join(REPO_ROOT, 'src', 'export', 'docx', 'docxReviewPacketBuilder.js'));
const { extractStoredZipEntries } = require(path.join(REPO_ROOT, 'src', 'export', 'docx', 'docxArtifactValidator.js'));
const wp703Fixtures = require(path.join(REPO_ROOT, 'test', 'fixtures', 'r24-wp703-docx-profile-fixtures.js'));

function createBuilderDependencies() {
  return {
    docxPageSetupBindModule: {
      buildDocxSectionPropertiesXml: () => '<w:sectPr/>',
    },
    semanticMappingModule: {
      PAGE_BREAK_TOKEN_V1: '[[PAGE_BREAK]]',
      mapSemanticEntries: ({ text }) => ({
        entries: String(text || '')
          .split('\n')
          .map((line) => ({ kind: 'paragraph', text: line })),
      }),
    },
    styleMapModule: {
      createStyleMap: () => ({
        resolve: () => ({}),
      }),
    },
  };
}

function documentXmlFromDocx(buffer) {
  return extractStoredZipEntries(buffer).get('word/document.xml')?.toString('utf8') || '';
}

function zipEntryFlags(buffer) {
  const entries = [];
  let offset = 0;
  const localFlags = new Map();
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const flags = buffer.readUInt16LE(offset + 6);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + fileNameLength).toString('utf8');
    localFlags.set(name, flags);
    offset += 30 + fileNameLength + extraLength + compressedSize;
  }
  while (offset + 46 <= buffer.length && buffer.readUInt32LE(offset) === 0x02014b50) {
    const flags = buffer.readUInt16LE(offset + 8);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8');
    entries.push({ name, localFlags: localFlags.get(name), centralFlags: flags });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function assertNoRawFormFeed(xml) {
  assert.equal(String(xml).includes('\f'), false, 'raw U+000C must not appear in serialized XML');
}

function assertOrderedStructuralPageBreak(xml, before = 'A', after = 'B') {
  assertNoRawFormFeed(xml);
  const beforeIndex = xml.indexOf(`<w:t xml:space="preserve">${before}</w:t>`);
  const breakIndex = xml.indexOf('<w:br w:type="page"/>');
  const afterIndex = xml.indexOf(`<w:t xml:space="preserve">${after}</w:t>`);
  assert.notEqual(beforeIndex, -1, 'text before page break must be in w:t');
  assert.notEqual(breakIndex, -1, 'page break must be structural w:br type page');
  assert.notEqual(afterIndex, -1, 'text after page break must be in w:t');
  assert.equal(beforeIndex < breakIndex && breakIndex < afterIndex, true, 'text/page-break/text order must be preserved');
}

function assertRejectsTextXml(fn, code) {
  assert.throws(fn, (error) => error?.message === code && error?.code === code);
}

function reviewPacketInput(text) {
  return {
    sceneText: text,
    blocks: [
      { blockId: 'block-u000c', paragraphId: 'p-u000c', paraId: '00112233', textId: '44556677', text },
    ],
    customProperties: [
      { name: 'YRTK_C01_AUTH', value: 'YRTK1.encoded-authority' },
      { name: 'YRTK2_TOKEN', value: 'YRT2-token-placeholder' },
      { name: 'YRTK_CORE_DIGEST', value: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    ],
  };
}

test('R24 DOCX text XML boundary segments controls before escaping and preserves non-BMP text', () => {
  const segments = segmentDocxTextForSerialization('A\tB\nC\rD\fE😀 &<>', { allowFormFeedPageBreak: true });
  assert.deepEqual(segments.map((segment) => segment.kind), [
    'text',
    'tab',
    'text',
    'lineBreak',
    'text',
    'lineBreak',
    'text',
    'pageBreak',
    'text',
  ]);

  const xml = buildDocxRunContentXml('A\tB\nC\rD\fE😀 &<>', { allowFormFeedPageBreak: true });
  assert.match(xml, /<w:t xml:space="preserve">A<\/w:t><w:tab\/><w:t xml:space="preserve">B<\/w:t><w:br\/>/u);
  assert.match(xml, /<w:t xml:space="preserve">D<\/w:t><w:br w:type="page"\/><w:t xml:space="preserve">E😀 &amp;&lt;&gt;<\/w:t>/u);
  assertNoRawFormFeed(xml);
});

test('R24 DOCX text XML boundary fail-closes unsupported controls and unpaired surrogates', () => {
  for (const codePoint of [0x0, 0x1, 0x8, 0xb, 0xe, 0x1f]) {
    const control = String.fromCodePoint(codePoint);
    assertRejectsTextXml(
      () => buildDocxRunContentXml(`A${control}B`, { allowFormFeedPageBreak: true }),
      DOCX_TEXT_XML_ERRORS.UNSUPPORTED_CONTROL,
    );
  }

  assertRejectsTextXml(
    () => buildDocxRunContentXml('A\fB'),
    DOCX_TEXT_XML_ERRORS.UNSUPPORTED_CONTROL,
  );
  assertRejectsTextXml(
    () => buildDocxRunContentXml(`A${String.fromCharCode(0xd800)}B`, { allowFormFeedPageBreak: true }),
    DOCX_TEXT_XML_ERRORS.UNPAIRED_SURROGATE,
  );
  assertRejectsTextXml(
    () => buildDocxRunContentXml(`A${String.fromCharCode(0xdc00)}B`, { allowFormFeedPageBreak: true }),
    DOCX_TEXT_XML_ERRORS.UNPAIRED_SURROGATE,
  );
});

test('R24 docx min builder emits U+000C page-break semantics as structural WordprocessingML', () => {
  const buffer = buildDocxMinBuffer({ plainText: 'A\fB\tC\nD\rE😀 & < >' }, createBuilderDependencies());
  const xml = documentXmlFromDocx(buffer);

  assertOrderedStructuralPageBreak(xml);
  assert.match(xml, /<w:t xml:space="preserve">B<\/w:t><w:tab\/><w:t xml:space="preserve">C<\/w:t>/u);
  assert.match(xml, /<w:t xml:space="preserve">E😀 &amp; &lt; &gt;<\/w:t>/u);
});

test('R24 docx min builder fail-closes hostile controls before XML serialization', () => {
  for (const codePoint of [0x0, 0x1, 0x8, 0xb, 0xe, 0x1f]) {
    const control = String.fromCodePoint(codePoint);
    assertRejectsTextXml(
      () => buildDocxMinBuffer({ plainText: `Alpha${control}Beta` }, createBuilderDependencies()),
      DOCX_TEXT_XML_ERRORS.UNSUPPORTED_CONTROL,
    );
  }

  assertRejectsTextXml(
    () => buildDocxMinBuffer({ plainText: `Alpha${String.fromCharCode(0xd800)}Beta` }, createBuilderDependencies()),
    DOCX_TEXT_XML_ERRORS.UNPAIRED_SURROGATE,
  );
});

test('R24 review packet builder preserves page-break controls and rejects hostile controls instead of stripping', () => {
  const buffer = buildDocxReviewPacketBuffer(reviewPacketInput('A\fB\tC\nD\rE😀 & < >'));
  const xml = documentXmlFromDocx(buffer);

  assertOrderedStructuralPageBreak(xml);
  assert.match(xml, /<w:t xml:space="preserve">B<\/w:t><w:tab\/><w:t xml:space="preserve">C<\/w:t><w:br\/>/u);
  assert.match(xml, /<w:t xml:space="preserve">E😀 &amp; &lt; &gt;<\/w:t>/u);

  assert.throws(
    () => buildDocxReviewPacketBuffer(reviewPacketInput('Alpha\u0001Beta')),
    /E_DOCX_TEXT_XML_UNSUPPORTED_CONTROL/u,
  );
});

test('R24 generated DOCX archives carry UTF-8 filename flags in local and central records', () => {
  const cases = [
    ['min', buildDocxMinBuffer({ plainText: 'A\fB' }, createBuilderDependencies())],
    ['review', buildDocxReviewPacketBuffer(reviewPacketInput('A\fB'))],
  ];

  for (const [name, bytes] of cases) {
    const flags = zipEntryFlags(bytes);
    assert.equal(flags.length > 0, true, `${name}: entries must be readable`);
    for (const entry of flags) {
      assert.equal((entry.localFlags & 0x0800) !== 0, true, `${name}:${entry.name}: local UTF-8 flag`);
      assert.equal((entry.centralFlags & 0x0800) !== 0, true, `${name}:${entry.name}: central UTF-8 flag`);
    }
  }
});

test('R24 core DOCX profile parses and re-exports page breaks without collapsing them into line breaks', async () => {
  const api = await import(path.join(REPO_ROOT, 'src', 'core', 'docx-profile-v1.mjs'));
  const document = {
    paragraphs: [
      wp703Fixtures.paragraph([
        wp703Fixtures.run('A\fB\tC\nD😀 & < >'),
      ]),
    ],
  };
  const created = api.createDocxProfileEnvelope({ identity: wp703Fixtures.identity(), document });
  assert.equal(created.ok, true, JSON.stringify(created));

  const output = api.serializeDocxProfile({ envelope: created.value, expectedIdentity: wp703Fixtures.identity(), sourceBytes: null });
  assert.equal(output.ok, true, JSON.stringify(output));
  const outputXml = documentXmlFromDocx(output.bytes);
  assertOrderedStructuralPageBreak(outputXml);
  assert.match(outputXml, /<w:t xml:space="preserve">B<\/w:t><w:tab\/><w:t xml:space="preserve">C<\/w:t><w:br\/>/u);

  const parsed = api.parseDocxProfile({ bytes: output.bytes, identity: wp703Fixtures.identity() });
  assert.equal(parsed.ok, true, JSON.stringify(parsed));
  assert.deepEqual(parsed.value.body.payload.document, document);

  const sourceBytes = wp703Fixtures.packageBytes({
    xml: wp703Fixtures.xml('<w:p><w:r><w:t>A</w:t><w:br w:type="page"/><w:t>B</w:t></w:r></w:p>'),
  });
  const sourceParsed = api.parseDocxProfile({ bytes: sourceBytes, identity: wp703Fixtures.identity() });
  assert.equal(sourceParsed.ok, true, JSON.stringify(sourceParsed));
  assert.equal(sourceParsed.value.body.payload.document.paragraphs[0].runs[0].text, 'A\fB');
  const reexport = api.serializeDocxProfile({ envelope: sourceParsed.value, expectedIdentity: wp703Fixtures.identity(), sourceBytes });
  assert.equal(reexport.ok, true, JSON.stringify(reexport));
  assertOrderedStructuralPageBreak(documentXmlFromDocx(reexport.bytes));
});

test('R24 core DOCX profile rejects raw invalid controls but admits page-break semantics', async () => {
  const api = await import(path.join(REPO_ROOT, 'src', 'core', 'docx-profile-v1.mjs'));
  const okDocument = {
    paragraphs: [
      wp703Fixtures.paragraph([wp703Fixtures.run('Scene A\fScene B')]),
    ],
  };
  const ok = api.createDocxProfileEnvelope({ identity: wp703Fixtures.identity(), document: okDocument });
  assert.equal(ok.ok, true, JSON.stringify(ok));

  const hostile = api.createDocxProfileEnvelope({
    identity: wp703Fixtures.identity(),
    document: {
      paragraphs: [
        wp703Fixtures.paragraph([wp703Fixtures.run('Alpha\u0001Beta')]),
      ],
    },
  });
  assert.equal(hostile.ok, false);
  assert.equal(hostile.error.code, 'E_DOCX_XML_CHARACTER');

  const surrogate = api.createDocxProfileEnvelope({
    identity: wp703Fixtures.identity(),
    document: {
      paragraphs: [
        wp703Fixtures.paragraph([wp703Fixtures.run(`Alpha${String.fromCharCode(0xd800)}Beta`)]),
      ],
    },
  });
  assert.equal(surrogate.ok, false);
  assert.equal(surrogate.error.code, 'E_DOCX_TEXT_NORMALIZATION');
});

test('R24 core DOCX profile rejects raw U+000C restored inside w:t parser mutant', async () => {
  const api = await import(path.join(REPO_ROOT, 'src', 'core', 'docx-profile-v1.mjs'));
  const mutantBytes = wp703Fixtures.packageBytes({
    xml: wp703Fixtures.xml('<w:p><w:r><w:t>A\fB</w:t></w:r></w:p>'),
  });
  const parsed = api.parseDocxProfile({ bytes: mutantBytes, identity: wp703Fixtures.identity() });
  assert.equal(parsed.ok, false);
  assert.equal(parsed.error.code, 'E_DOCX_XML_CHARACTER');
  assert.equal(parsed.semanticProjectionPublished, false);
});

test('R24 U+000C source profile repeated re-export saturation preserves page-break semantics', async () => {
  const api = await import(path.join(REPO_ROOT, 'src', 'core', 'docx-profile-v1.mjs'));
  const identity = wp703Fixtures.identity({
    entityId: 'docx-u000c-saturation',
    generation: 44,
    projectId: 'project-u000c-saturation',
    sourceRevision: 'rev-u000c-saturation',
  });
  const expectedDocument = {
    paragraphs: [
      wp703Fixtures.paragraph([wp703Fixtures.run('Opening😀\fMiddle\tTail\nLine')]),
      wp703Fixtures.paragraph([wp703Fixtures.run('Second scene & < >\fThird scene')]),
    ],
  };
  let envelope = api.createDocxProfileEnvelope({ identity, document: expectedDocument }).value;
  let sourceBytes = null;

  for (let cycle = 0; cycle < 8; cycle += 1) {
    const serialized = api.serializeDocxProfile({ envelope, expectedIdentity: identity, sourceBytes });
    assert.equal(serialized.ok, true, JSON.stringify(serialized));
    const xml = documentXmlFromDocx(serialized.bytes);
    assert.equal(xml.includes('\f'), false, `cycle ${cycle} must not serialize raw U+000C`);
    assert.equal((xml.match(/<w:br w:type="page"\/>/gu) || []).length, 2);
    const parsed = api.parseDocxProfile({ bytes: serialized.bytes, identity });
    assert.equal(parsed.ok, true, JSON.stringify(parsed));
    assert.deepEqual(parsed.value.body.payload.document, expectedDocument);
    envelope = parsed.value;
    sourceBytes = serialized.bytes;
  }
});

test('R24 U+000C large synthetic novel min export keeps every page break structural and ordered', () => {
  const sceneCount = 80;
  const text = Array.from({ length: sceneCount }, (_, index) => (
    `Scene ${String(index + 1).padStart(3, '0')} — 章😀 alpha & <omega>\fContinuation ${index + 1}`
  )).join('\n');
  const buffer = buildDocxMinBuffer({ plainText: text }, createBuilderDependencies());
  const xml = documentXmlFromDocx(buffer);

  assertNoRawFormFeed(xml);
  assert.equal((xml.match(/<w:br w:type="page"\/>/gu) || []).length, sceneCount);
  assert.equal(xml.includes('章😀 alpha &amp; &lt;omega&gt;'), true);
  assert.equal(xml.indexOf('Scene 001') < xml.indexOf('<w:br w:type="page"/>'), true);
  assert.equal(xml.lastIndexOf('<w:br w:type="page"/>') < xml.lastIndexOf('Continuation 80'), true);
});

test('R24 U+000C mutant oracle fails when raw form feed is restored inside w:t', () => {
  const buffer = buildDocxMinBuffer({ plainText: 'A\fB' }, createBuilderDependencies());
  const xml = documentXmlFromDocx(buffer);
  assertOrderedStructuralPageBreak(xml);

  const mutant = xml.replace('<w:br w:type="page"/>', '\f');
  assert.throws(() => assertOrderedStructuralPageBreak(mutant), /raw U\+000C must not appear/u);
});
