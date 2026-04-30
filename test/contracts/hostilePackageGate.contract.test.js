const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'hostilePackageGate.mjs';
const MAIN_BASENAME = 'main.js';
const REQUIRED_SECURITY_CORE_EXPORT_NAME = 'inspectDocxIntakeEnvelopeDecision';
const FORBIDDEN_SECURITY_CORE_EXPORT_NAME_PATTERNS = Object.freeze([
  /enable/iu,
  /authori[sz]e/iu,
  /authori[sz]ed/iu,
  /admission/iu,
  /quarantine/iu,
  /semantic/iu,
  /parse/iu,
  /callback/iu,
  /runtime/iu,
  /import/iu,
  /apply/iu,
]);
const FORBIDDEN_DOCX_INTAKE_RUNTIME_ACTIONS = Object.freeze(['IMPORT', 'PARSE', 'APPLY']);

async function loadGate() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
}

function readMainSource() {
  return fs.readFileSync(path.join(process.cwd(), 'src', MAIN_BASENAME), 'utf8');
}

function readProjectSource(...parts) {
  return fs.readFileSync(path.join(process.cwd(), ...parts), 'utf8');
}

function extractFunctionSource(source, name) {
  const signature = `function ${name}(`;
  const signatureStart = source.indexOf(signature);
  assert.ok(signatureStart > -1, `${name} must exist`);
  const asyncPrefix = 'async ';
  const start = source.slice(Math.max(0, signatureStart - asyncPrefix.length), signatureStart) === asyncPrefix
    ? signatureStart - asyncPrefix.length
    : signatureStart;
  const braceStart = source.indexOf('{', start);
  assert.ok(braceStart > start, `${name} body must exist`);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unclosed function body for ${name}`);
}

function instantiateMainFunctions(functionNames, context = {}) {
  const source = readMainSource();
  const script = `${functionNames.map((name) => extractFunctionSource(source, name)).join('\n\n')}\nmodule.exports = { ${functionNames.join(', ')} };`;
  const sandbox = {
    module: { exports: {} },
    exports: {},
    Buffer,
    ...context,
  };
  vm.runInNewContext(script, sandbox, { filename: 'docx-diagnostic-envelope-probe.main-snippet.js' });
  return sandbox.module.exports;
}

function inspectSecurityCoreExportSurface(exportNames) {
  const normalizedExportNames = [...new Set(exportNames)].sort();
  const forbiddenExportNames = normalizedExportNames.filter((name) => (
    FORBIDDEN_SECURITY_CORE_EXPORT_NAME_PATTERNS.some((pattern) => pattern.test(name))
  ));

  return {
    hasRequiredIntakeEnvelopeDecisionExport: normalizedExportNames.includes(REQUIRED_SECURITY_CORE_EXPORT_NAME),
    forbiddenExportNames,
    normalizedExportNames,
  };
}

function assertSecurityCoreExportSurface(exportNames) {
  const surface = inspectSecurityCoreExportSurface(exportNames);

  assert.equal(surface.hasRequiredIntakeEnvelopeDecisionExport, true);
  assert.deepEqual(surface.forbiddenExportNames, []);
  return surface;
}

function inspectDocxIntakeEnvelopeResultShape(result) {
  const forbiddenRuntimeAction = FORBIDDEN_DOCX_INTAKE_RUNTIME_ACTIONS.includes(result.runtimeAction);
  const violations = [];

  if (result.docxImportAuthorized === true) {
    violations.push('DOCX_IMPORT_AUTHORIZED_TRUE');
  }
  if (forbiddenRuntimeAction) {
    violations.push(`RUNTIME_ACTION_${result.runtimeAction}`);
  }

  return {
    decisionStatus: result.decisionStatus,
    docxImportAuthorized: result.docxImportAuthorized,
    runtimeAction: result.runtimeAction,
    violations,
  };
}

function assertDocxIntakeEnvelopeResultShape(result) {
  const shape = inspectDocxIntakeEnvelopeResultShape(result);

  assert.notEqual(shape.docxImportAuthorized, true);
  assert.equal(FORBIDDEN_DOCX_INTAKE_RUNTIME_ACTIONS.includes(shape.runtimeAction), false);
  assert.deepEqual(shape.violations, []);
  return shape;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
}

function centralDirectoryEntry(input = {}) {
  const name = Buffer.from(input.name ?? '[Content_Types].xml', 'utf8');
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(input.versionMadeBy ?? 20, 4);
  header.writeUInt16LE(input.versionNeeded ?? 20, 6);
  header.writeUInt16LE(input.flags ?? 0x0800, 8);
  header.writeUInt16LE(input.method ?? 0, 10);
  header.writeUInt32LE(input.crc32 ?? 0, 16);
  header.writeUInt32LE(input.compressedSize ?? 0, 20);
  header.writeUInt32LE(input.uncompressedSize ?? 0, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(input.extraLength ?? 0, 30);
  header.writeUInt16LE(input.commentLength ?? 0, 32);
  header.writeUInt16LE(input.diskStart ?? 0, 34);
  header.writeUInt16LE(input.internalAttributes ?? 0, 36);
  header.writeUInt32LE(input.externalAttributes ?? 0, 38);
  header.writeUInt32LE(input.localHeaderOffset ?? 0, 42);
  return Buffer.concat([
    header,
    name,
    Buffer.alloc(input.extraLength ?? 0),
    Buffer.alloc(input.commentLength ?? 0),
  ]);
}

function localFileHeader(input = {}) {
  const name = Buffer.from(input.name ?? '[Content_Types].xml', 'utf8');
  const content = Buffer.isBuffer(input.content) ? input.content : Buffer.from(input.content ?? '', 'utf8');
  const compressed = input.method === 8 ? zlib.deflateRawSync(content) : content;
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(input.flags ?? 0x0800, 6);
  header.writeUInt16LE(input.method ?? 0, 8);
  header.writeUInt32LE(input.crc32 ?? 0, 14);
  header.writeUInt32LE(input.compressedSize ?? compressed.length, 18);
  header.writeUInt32LE(input.uncompressedSize ?? content.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(input.extraLength ?? 0, 28);
  return {
    buffer: Buffer.concat([header, name, Buffer.alloc(input.extraLength ?? 0), compressed]),
    compressedSize: input.compressedSize ?? compressed.length,
    uncompressedSize: input.uncompressedSize ?? content.length,
  };
}

function eocd({ entryCount, cdSize, cdOffset, comment = Buffer.alloc(0), forceZip64 = false } = {}) {
  const header = Buffer.alloc(22);
  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(forceZip64 ? 0xffff : entryCount, 8);
  header.writeUInt16LE(forceZip64 ? 0xffff : entryCount, 10);
  header.writeUInt32LE(forceZip64 ? 0xffffffff : cdSize, 12);
  header.writeUInt32LE(forceZip64 ? 0xffffffff : cdOffset, 16);
  header.writeUInt16LE(comment.length, 20);
  return Buffer.concat([header, comment]);
}

function zipWithEntries(entries, options = {}) {
  const centralDirectory = Buffer.concat(entries.map(centralDirectoryEntry));
  const cdOffset = options.prefix?.length ?? 0;
  return Buffer.concat([
    options.prefix || Buffer.alloc(0),
    centralDirectory,
    eocd({
      entryCount: entries.length,
      cdSize: centralDirectory.length,
      cdOffset,
      forceZip64: options.forceZip64,
    }),
  ]);
}

function minimalDocxLikeZip(extraEntries = [], options = {}) {
  return zipWithEntries([
    { name: '[Content_Types].xml', compressedSize: 10, uncompressedSize: 10 },
    { name: '_rels/.rels', compressedSize: 10, uncompressedSize: 10 },
    { name: 'word/document.xml', compressedSize: 10, uncompressedSize: 10 },
    ...extraEntries,
  ], options);
}

function zipWithLocalFiles(fileEntries, options = {}) {
  const localEntries = [];
  let offset = 0;
  for (const entry of fileEntries) {
    const local = localFileHeader(entry);
    localEntries.push({
      ...entry,
      localHeaderOffset: offset,
      compressedSize: local.compressedSize,
      uncompressedSize: local.uncompressedSize,
      localBuffer: local.buffer,
    });
    offset += local.buffer.length;
  }
  const localBytes = Buffer.concat(localEntries.map((entry) => entry.localBuffer));
  const centralDirectory = Buffer.concat(localEntries.map(centralDirectoryEntry));
  return Buffer.concat([
    localBytes,
    centralDirectory,
    eocd({
      entryCount: localEntries.length,
      cdSize: centralDirectory.length,
      cdOffset: localBytes.length,
      forceZip64: options.forceZip64,
    }),
  ]);
}

function safeXmlPackage(extraEntries = []) {
  return zipWithLocalFiles([
    { name: '[Content_Types].xml', content: '<Types></Types>' },
    { name: '_rels/.rels', content: '<Relationships></Relationships>' },
    { name: 'word/document.xml', content: '<document><body>safe</body></document>' },
    ...extraEntries,
  ]);
}

test('minimal docx-like package inventory is allowed and deterministic', async () => {
  const { inspectHostilePackage, SECURITY_STATUS, PACKAGE_SHAPE_STATUS } = await loadGate();
  const first = inspectHostilePackage(minimalDocxLikeZip());
  const second = inspectHostilePackage(minimalDocxLikeZip());

  assert.deepEqual(first, second);
  assert.equal(first.securityStatus, SECURITY_STATUS.ALLOWED);
  assert.equal(first.packageShapeStatus, PACKAGE_SHAPE_STATUS.DOCX_LIKE);
  assert.deepEqual(first.reasonCodes, []);
  assert.equal(first.entryCount, 3);
  assert.equal(first.normalizedEntryNames.includes('word/document.xml'), true);
});

test('package gate hash changes when policy changes', async () => {
  const { inspectHostilePackage } = await loadGate();
  const base = inspectHostilePackage(minimalDocxLikeZip());
  const changedPolicy = inspectHostilePackage(minimalDocxLikeZip(), { maxEntryCount: 10 });

  assert.notEqual(base.gateHash, changedPolicy.gateHash);
});

test('missing OPC parts are package shape observations, not security blockers', async () => {
  const {
    inspectHostilePackage,
    SECURITY_STATUS,
    PACKAGE_SHAPE_STATUS,
    PACKAGE_SHAPE_OBSERVATIONS,
  } = await loadGate();
  const report = inspectHostilePackage(zipWithEntries([
    { name: 'plain.txt', compressedSize: 1, uncompressedSize: 1 },
  ]));

  assert.equal(report.securityStatus, SECURITY_STATUS.ALLOWED);
  assert.equal(report.packageShapeStatus, PACKAGE_SHAPE_STATUS.DEGRADED);
  assert.deepEqual(report.reasonCodes, []);
  assert.equal(report.packageShapeObservations.includes(PACKAGE_SHAPE_OBSERVATIONS.WORD_DOCUMENT_PART_MISSING), true);
});

test('entry count, size, and compression ratio budgets block package intake', async () => {
  const { inspectHostilePackage, SECURITY_REASON_CODES } = await loadGate();

  assert.equal(
    inspectHostilePackage(minimalDocxLikeZip(), { maxEntryCount: 2 }).reasonCodes
      .includes(SECURITY_REASON_CODES.ENTRY_COUNT_LIMIT_EXCEEDED),
    true,
  );
  assert.equal(
    inspectHostilePackage(minimalDocxLikeZip([{ name: 'a', compressedSize: 99, uncompressedSize: 99 }]), {
      maxTotalCompressedSize: 20,
    }).reasonCodes.includes(SECURITY_REASON_CODES.TOTAL_COMPRESSED_SIZE_LIMIT_EXCEEDED),
    true,
  );
  assert.equal(
    inspectHostilePackage(minimalDocxLikeZip([{ name: 'b', compressedSize: 1, uncompressedSize: 1000 }]), {
      maxCompressionRatio: 10,
    }).reasonCodes.includes(SECURITY_REASON_CODES.COMPRESSION_RATIO_LIMIT_EXCEEDED),
    true,
  );
  assert.equal(
    inspectHostilePackage(minimalDocxLikeZip([{ name: 'c', compressedSize: 1, uncompressedSize: 1000 }]), {
      maxTotalUncompressedSize: 20,
    }).reasonCodes.includes(SECURITY_REASON_CODES.TOTAL_UNCOMPRESSED_SIZE_LIMIT_EXCEEDED),
    true,
  );
});

test('hostile path names are blocked before semantic parse', async () => {
  const { inspectHostilePackage, SECURITY_REASON_CODES } = await loadGate();
  const report = inspectHostilePackage(minimalDocxLikeZip([
    { name: '../escape.xml' },
    { name: '/absolute.xml' },
    { name: 'C:/drive.xml' },
    { name: 'word\\bad.xml' },
  ]));

  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.PATH_TRAVERSAL), true);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.ABSOLUTE_PATH), true);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.DRIVE_LETTER_PATH), true);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.BACKSLASH_PATH), true);
});

test('empty entry names are blocked before semantic parse', async () => {
  const { inspectHostilePackage, SECURITY_REASON_CODES } = await loadGate();
  const report = inspectHostilePackage(minimalDocxLikeZip([
    { name: '' },
  ]));

  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.EMPTY_ENTRY_NAME), true);
});

test('duplicate normalized entry names are blocked', async () => {
  const { inspectHostilePackage, SECURITY_REASON_CODES } = await loadGate();
  const report = inspectHostilePackage(minimalDocxLikeZip([
    { name: './word/duplicate.xml' },
    { name: 'word/duplicate.xml' },
  ]));

  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.DUPLICATE_ENTRY_NAME), true);
});

test('encrypted, unsupported method, and symlink entries are blocked', async () => {
  const { inspectHostilePackage, SECURITY_REASON_CODES } = await loadGate();
  const report = inspectHostilePackage(minimalDocxLikeZip([
    { name: 'word/encrypted.xml', flags: 0x0801 },
    { name: 'word/method.xml', method: 12 },
    { name: 'word/link.xml', versionMadeBy: 0x031e, externalAttributes: (0o120777 << 16) >>> 0 },
  ]));

  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.ENCRYPTED_ENTRY), true);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.UNSUPPORTED_COMPRESSION_METHOD), true);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.SYMLINK_ENTRY), true);
});

test('missing EOCD, ambiguous EOCD, invalid central directory, and ZIP64 are blocked', async () => {
  const { inspectHostilePackage, SECURITY_REASON_CODES } = await loadGate();
  const noEocd = inspectHostilePackage(Buffer.from('not a zip'));
  const valid = minimalDocxLikeZip();
  const corruptedCentral = Buffer.from(valid);
  corruptedCentral.writeUInt32LE(0, 0);
  const firstEocdWithComment = eocd({
    entryCount: 1,
    cdSize: 0,
    cdOffset: 0,
    comment: Buffer.concat([u32(0x06054b50), Buffer.alloc(18)]),
  });
  const ambiguous = Buffer.concat([firstEocdWithComment]);
  const zip64 = zipWithEntries([{ name: 'a' }], { forceZip64: true });
  const emptyArchive = Buffer.concat([eocd({ entryCount: 0, cdSize: 0, cdOffset: 0 })]);

  assert.equal(noEocd.reasonCodes.includes(SECURITY_REASON_CODES.ZIP_EOCD_MISSING), true);
  assert.equal(inspectHostilePackage(ambiguous).reasonCodes.includes(SECURITY_REASON_CODES.ZIP_EOCD_AMBIGUOUS), true);
  assert.equal(
    inspectHostilePackage(corruptedCentral).reasonCodes
      .includes(SECURITY_REASON_CODES.ZIP_CENTRAL_DIRECTORY_INVALID),
    true,
  );
  assert.equal(inspectHostilePackage(zip64).reasonCodes.includes(SECURITY_REASON_CODES.ZIP64_UNSUPPORTED_IN_001A), true);
  assert.equal(inspectHostilePackage(emptyArchive).reasonCodes.includes(SECURITY_REASON_CODES.EMPTY_ARCHIVE), true);
});

test('hostile package gate module remains pure and decoupled from parser and Review IR layers', () => {
  const moduleText = fs.readFileSync(
    path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME),
    'utf8',
  );
  const forbidden = [
    /from\s+['"]node:fs['"]/u,
    /from\s+['"]node:child_process['"]/u,
    /from\s+['"]node:http['"]/u,
    /from\s+['"]node:https['"]/u,
    /from\s+['"]electron['"]/u,
    /\bfetch\s*\(/u,
    /from\s+['"].*docx/u,
    /xml2js/u,
    /sax/u,
    /reviewIrKernel/u,
    /DOMParser/u,
  ];

  for (const pattern of forbidden) {
    assert.equal(pattern.test(moduleText), false, `forbidden package gate pattern: ${pattern.source}`);
  }
});

test('XML preflight allows safe minimal XML package and reports selected entries', async () => {
  const { inspectHostilePackageXmlPreflight, SECURITY_STATUS } = await loadGate();
  const first = inspectHostilePackageXmlPreflight(safeXmlPackage());
  const second = inspectHostilePackageXmlPreflight(safeXmlPackage());

  assert.deepEqual(first, second);
  assert.equal(first.securityStatus, SECURITY_STATUS.ALLOWED);
  assert.equal(first.selectedEntries.includes('word/document.xml'), true);
  assert.equal(first.xmlPreflightReport.inspectedXmlEntries.length, 3);
  assert.equal(first.relationshipPolicyReport.relationshipEntryCount, 1);
});

test('XML preflight hash changes when policy changes', async () => {
  const { inspectHostilePackageXmlPreflight } = await loadGate();
  const base = inspectHostilePackageXmlPreflight(safeXmlPackage());
  const changedPolicy = inspectHostilePackageXmlPreflight(safeXmlPackage(), { maxXmlTokenLength: 100 });

  assert.notEqual(base.gateHash, changedPolicy.gateHash);
});

test('package gate blocked result short-circuits XML preflight', async () => {
  const { inspectHostilePackageXmlPreflight, SECURITY_REASON_CODES, XML_PREFLIGHT_OBSERVATIONS } = await loadGate();
  const report = inspectHostilePackageXmlPreflight(Buffer.from('not a zip'));

  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.PACKAGE_GATE_BLOCKED), true);
  assert.equal(report.selectedEntries.length, 0);
  assert.equal(report.xmlPreflightReport.inspectedXmlEntries.length, 0);
  assert.equal(report.observations.includes(XML_PREFLIGHT_OBSERVATIONS.PACKAGE_GATE_BLOCKED_BEFORE_XML_PREFLIGHT), true);
});

test('selected XML entry count and size budgets block XML preflight', async () => {
  const { inspectHostilePackageXmlPreflight, SECURITY_REASON_CODES } = await loadGate();
  const manyXml = safeXmlPackage([
    { name: 'custom/a.xml', content: '<a></a>' },
    { name: 'custom/b.xml', content: '<b></b>' },
  ]);
  const entrySize = safeXmlPackage([{ name: 'word/big.xml', content: '<x>123456789</x>' }]);
  const totalSize = safeXmlPackage([{ name: 'word/total.xml', content: '<x>123456789</x>' }]);

  assert.equal(
    inspectHostilePackageXmlPreflight(manyXml, { maxSelectedXmlEntryCount: 2 }).reasonCodes
      .includes(SECURITY_REASON_CODES.SELECTED_XML_ENTRY_COUNT_LIMIT_EXCEEDED),
    true,
  );
  assert.equal(
    inspectHostilePackageXmlPreflight(manyXml, { maxSelectedXmlEntryCount: 2 })
      .xmlPreflightReport.inspectedXmlEntries.length,
    0,
  );
  assert.equal(
    inspectHostilePackageXmlPreflight(entrySize, { maxXmlEntryBytes: 8 }).reasonCodes
      .includes(SECURITY_REASON_CODES.SELECTED_ENTRY_SIZE_LIMIT_EXCEEDED),
    true,
  );
  assert.equal(
    inspectHostilePackageXmlPreflight(totalSize, { maxTotalXmlBytes: 20 }).reasonCodes
      .includes(SECURITY_REASON_CODES.TOTAL_XML_SIZE_LIMIT_EXCEEDED),
    true,
  );
});

test('bounded deflate selected entry output limit blocks oversized inflated XML', async () => {
  const { inspectHostilePackageXmlPreflight, SECURITY_REASON_CODES } = await loadGate();
  const report = inspectHostilePackageXmlPreflight(safeXmlPackage([
    { name: 'word/deflated.xml', method: 8, content: '<x>expanded</x>' },
  ]), { maxXmlEntryBytes: 8 });

  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.SELECTED_ENTRY_SIZE_LIMIT_EXCEEDED), true);
});

test('large XML token and entity declarations block XML preflight', async () => {
  const { inspectHostilePackageXmlPreflight, SECURITY_REASON_CODES } = await loadGate();
  const report = inspectHostilePackageXmlPreflight(safeXmlPackage([
    { name: 'word/token.xml', content: `<x>${'a'.repeat(20)}</x>` },
    { name: 'word/dtd.xml', content: '<!DTD root []><root />' },
    { name: 'word/doctype.xml', content: '<!DOCTYPE root><root />' },
    { name: 'word/entity.xml', content: '<!ENTITY xxe SYSTEM "file:///etc/passwd"><root />' },
  ]), { maxXmlTokenLength: 10 });

  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.XML_TOKEN_LIMIT_EXCEEDED), true);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.XML_DTD_DECLARATION_PRESENT), true);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.XML_DOCTYPE_DECLARATION_PRESENT), true);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.XML_ENTITY_DECLARATION_PRESENT), true);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.XML_EXTERNAL_ENTITY_PATTERN_PRESENT), true);
});

test('relationship target text preflight blocks external and hostile targets without fetch', async () => {
  const { inspectHostilePackageXmlPreflight, SECURITY_REASON_CODES, XML_PREFLIGHT_OBSERVATIONS } = await loadGate();
  const report = inspectHostilePackageXmlPreflight(safeXmlPackage([
    {
      name: 'word/_rels/document.xml.rels',
      content: [
        '<Relationships>',
        '<Relationship TargetMode="External" Target="https://example.test/a" />',
        '<Relationship Target="/absolute/path" />',
        '<Relationship Target="../escape.xml" />',
        '<Relationship Target="C:/drive.xml" />',
        '<Relationship Target="word\\bad.xml" />',
        '</Relationships>',
      ].join(''),
    },
  ]));

  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.RELATIONSHIP_TARGETMODE_EXTERNAL), true);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.RELATIONSHIP_TARGET_ABSOLUTE_PATH), true);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.RELATIONSHIP_TARGET_TRAVERSAL), true);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.RELATIONSHIP_TARGET_DRIVE_LETTER), true);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.RELATIONSHIP_TARGET_BACKSLASH), true);
  assert.equal(
    report.relationshipPolicyReport.relationshipPolicyObservations
      .includes(XML_PREFLIGHT_OBSERVATIONS.RELATIONSHIP_TARGETS_PRESENT),
    true,
  );
});

test('security surface policy reports safe package without authorizing DOCX import', async () => {
  const {
    inspectHostilePackageSecuritySurfacePolicy,
    SECURITY_RISK_CLASS,
    SECURITY_STATUS,
    SECURITY_SURFACE_DECISION_STATUS,
  } = await loadGate();
  const report = inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage());

  assert.equal(report.docxImportAuthorized, false);
  assert.equal(report.runtimeAction, 'NONE');
  assert.equal(report.securityStatus, SECURITY_STATUS.ALLOWED);
  assert.equal(
    report.securitySurfacePolicyDecision.decisionStatus,
    SECURITY_SURFACE_DECISION_STATUS.NO_HIGH_RISK_SURFACE_OBSERVED,
  );
  assert.equal(report.securitySurfacePolicyDecision.securityRiskClass, SECURITY_RISK_CLASS.LOW);
  assert.equal(report.securitySurfacePolicyDecision.docxImportAuthorized, false);
  assert.equal(report.securitySurfacePolicyDecision.runtimeAction, 'NONE');
  assert.deepEqual(report.securitySurfacePolicyDecision.evidenceObservationHashes, []);
});

test('security surface policy short-circuits package and XML blockers before surface observation', async () => {
  const {
    inspectHostilePackageSecuritySurfacePolicy,
    SECURITY_RISK_CLASS,
    SECURITY_REASON_CODES,
    SECURITY_STATUS,
    SECURITY_SURFACE_DECISION_STATUS,
  } = await loadGate();
  const packageBlocked = inspectHostilePackageSecuritySurfacePolicy(Buffer.from('not a zip'));
  const xmlBlocked = inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage([
    { name: 'word/_rels/document.xml.rels', content: '<Relationships><Relationship TargetMode="External" /></Relationships>' },
  ]));

  assert.equal(packageBlocked.securityStatus, SECURITY_STATUS.BLOCKED);
  assert.equal(packageBlocked.priorGate, 'DOCX_HOSTILE_PACKAGE_GATE_001A');
  assert.equal(packageBlocked.reasonCodes.includes(SECURITY_REASON_CODES.PACKAGE_GATE_BLOCKED), true);
  assert.equal(packageBlocked.docxImportAuthorized, false);
  assert.equal(packageBlocked.runtimeAction, 'NONE');
  assert.equal(
    packageBlocked.securitySurfacePolicyDecision.decisionStatus,
    SECURITY_SURFACE_DECISION_STATUS.BLOCKED_PRIOR_GATE,
  );
  assert.equal(packageBlocked.securitySurfaceEvidence.length, 0);
  assert.equal(xmlBlocked.securityStatus, SECURITY_STATUS.BLOCKED);
  assert.equal(xmlBlocked.priorGate, 'DOCX_HOSTILE_PACKAGE_GATE_001B');
  assert.equal(xmlBlocked.reasonCodes.includes(SECURITY_REASON_CODES.XML_PREFLIGHT_BLOCKED), true);
  assert.equal(xmlBlocked.docxImportAuthorized, false);
  assert.equal(xmlBlocked.runtimeAction, 'NONE');
  assert.equal(xmlBlocked.securitySurfacePolicyDecision.securityRiskClass, SECURITY_RISK_CLASS.HIGH);
  assert.equal(xmlBlocked.securitySurfaceEvidence.length, 0);
});

test('security surface policy observes vbaProject entry name without binary parsing', async () => {
  const {
    inspectHostilePackageSecuritySurfacePolicy,
    SECURITY_RISK_CLASS,
    SECURITY_REASON_CODES,
    SECURITY_STATUS,
    SECURITY_SURFACE_DECISION_STATUS,
    SECURITY_SURFACE_OBSERVATIONS,
  } = await loadGate();
  const report = inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage([
    { name: 'word/vbaProject.bin', content: Buffer.from([0, 1, 2, 3]) },
  ]));

  assert.equal(
    report.securitySurfacePolicyDecision.decisionStatus,
    SECURITY_SURFACE_DECISION_STATUS.HIGH_RISK_SURFACE_OBSERVED,
  );
  assert.equal(report.securityStatus, SECURITY_STATUS.BLOCKED);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.MACRO_SURFACE_PRESENT), true);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.SECURITY_SURFACE_POLICY_HIGH_RISK_SURFACE), true);
  assert.equal(report.securitySurfacePolicyDecision.securityRiskClass, SECURITY_RISK_CLASS.HIGH);
  assert.equal(report.observations.includes(SECURITY_SURFACE_OBSERVATIONS.VBA_PROJECT_ENTRY_NAME), true);
  assert.equal(report.macroSurfaceReport.surfaceCount, 1);
});

test('security surface policy observes macro content type from bounded Content_Types text', async () => {
  const {
    inspectHostilePackageSecuritySurfacePolicy,
    SECURITY_REASON_CODES,
    SECURITY_STATUS,
    SECURITY_SURFACE_DECISION_STATUS,
    SECURITY_SURFACE_OBSERVATIONS,
  } = await loadGate();
  const report = inspectHostilePackageSecuritySurfacePolicy(zipWithLocalFiles([
    {
      name: '[Content_Types].xml',
      content: '<Types><Override ContentType="application/vnd.ms-office.vbaProject" /></Types>',
    },
    { name: '_rels/.rels', content: '<Relationships></Relationships>' },
    { name: 'word/document.xml', content: '<document><body>safe</body></document>' },
  ]));

  assert.equal(
    report.securitySurfacePolicyDecision.decisionStatus,
    SECURITY_SURFACE_DECISION_STATUS.HIGH_RISK_SURFACE_OBSERVED,
  );
  assert.equal(report.securityStatus, SECURITY_STATUS.BLOCKED);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.MACRO_SURFACE_PRESENT), true);
  assert.equal(report.observations.includes(SECURITY_SURFACE_OBSERVATIONS.MACRO_CONTENT_TYPE), true);
  assert.equal(report.macroSurfaceReport.surfaceCount, 1);
});

test('security surface policy observes macro relationship type from bounded .rels text', async () => {
  const {
    inspectHostilePackageSecuritySurfacePolicy,
    SECURITY_REASON_CODES,
    SECURITY_STATUS,
    SECURITY_SURFACE_DECISION_STATUS,
    SECURITY_SURFACE_OBSERVATIONS,
  } = await loadGate();
  const report = inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage([
    {
      name: 'word/_rels/document.xml.rels',
      content: [
        '<Relationships>',
        '<Relationship Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin" />',
        '</Relationships>',
      ].join(''),
    },
  ]));

  assert.equal(
    report.securitySurfacePolicyDecision.decisionStatus,
    SECURITY_SURFACE_DECISION_STATUS.HIGH_RISK_SURFACE_OBSERVED,
  );
  assert.equal(report.securityStatus, SECURITY_STATUS.BLOCKED);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.MACRO_SURFACE_PRESENT), true);
  assert.equal(report.observations.includes(SECURITY_SURFACE_OBSERVATIONS.MACRO_RELATIONSHIP_TYPE), true);
  assert.equal(report.macroSurfaceReport.surfaceCount, 1);
});

test('security surface policy observes embedding entry name without OLE binary parsing', async () => {
  const {
    inspectHostilePackageSecuritySurfacePolicy,
    SECURITY_REASON_CODES,
    SECURITY_STATUS,
    SECURITY_SURFACE_OBSERVATIONS,
  } = await loadGate();
  const report = inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage([
    { name: 'word/embeddings/oleObject1.bin', content: Buffer.from([208, 207, 17, 224]) },
  ]));

  assert.equal(report.securityStatus, SECURITY_STATUS.BLOCKED);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.OLE_SURFACE_PRESENT), true);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.SECURITY_SURFACE_POLICY_HIGH_RISK_SURFACE), true);
  assert.equal(report.observations.includes(SECURITY_SURFACE_OBSERVATIONS.EMBEDDING_ENTRY_NAME), true);
  assert.equal(report.oleSurfaceReport.surfaceCount, 1);
  assert.equal(report.securitySurfacePolicyDecision.runtimeAction, 'NONE');
});

test('security surface policy observes OLE relationship type from bounded .rels text', async () => {
  const {
    inspectHostilePackageSecuritySurfacePolicy,
    SECURITY_REASON_CODES,
    SECURITY_STATUS,
    SECURITY_SURFACE_OBSERVATIONS,
  } = await loadGate();
  const report = inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage([
    {
      name: 'word/_rels/document.xml.rels',
      content: [
        '<Relationships>',
        '<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject" Target="embeddings/oleObject1.bin" />',
        '</Relationships>',
      ].join(''),
    },
  ]));

  assert.equal(report.securityStatus, SECURITY_STATUS.BLOCKED);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.OLE_SURFACE_PRESENT), true);
  assert.equal(report.observations.includes(SECURITY_SURFACE_OBSERVATIONS.OLE_RELATIONSHIP_TYPE), true);
  assert.equal(report.oleSurfaceReport.surfaceCount, 1);
});

test('security surface policy observes activeX entry name without active content semantics', async () => {
  const {
    inspectHostilePackageSecuritySurfacePolicy,
    SECURITY_REASON_CODES,
    SECURITY_STATUS,
    SECURITY_SURFACE_OBSERVATIONS,
  } = await loadGate();
  const report = inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage([
    { name: 'word/activeX/activeX1.bin', content: Buffer.from([1, 2, 3]) },
  ]));

  assert.equal(report.securityStatus, SECURITY_STATUS.BLOCKED);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.ACTIVE_CONTENT_SURFACE_PRESENT), true);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.SECURITY_SURFACE_POLICY_HIGH_RISK_SURFACE), true);
  assert.equal(report.observations.includes(SECURITY_SURFACE_OBSERVATIONS.ACTIVEX_ENTRY_NAME), true);
  assert.equal(report.activeContentSurfaceReport.surfaceCount, 1);
});

test('security surface policy observes active content relationship type from bounded .rels text', async () => {
  const {
    inspectHostilePackageSecuritySurfacePolicy,
    SECURITY_REASON_CODES,
    SECURITY_STATUS,
    SECURITY_SURFACE_OBSERVATIONS,
  } = await loadGate();
  const report = inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage([
    {
      name: 'word/_rels/document.xml.rels',
      content: [
        '<Relationships>',
        '<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/activeXControl" Target="activeX/activeX1.xml" />',
        '</Relationships>',
      ].join(''),
    },
  ]));

  assert.equal(report.securityStatus, SECURITY_STATUS.BLOCKED);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.ACTIVE_CONTENT_SURFACE_PRESENT), true);
  assert.equal(report.observations.includes(SECURITY_SURFACE_OBSERVATIONS.ACTIVE_CONTENT_RELATIONSHIP_TYPE), true);
  assert.equal(report.activeContentSurfaceReport.surfaceCount, 1);
});

test('security surface policy never authorizes runtime import for any 001C outcome', async () => {
  const { inspectHostilePackageSecuritySurfacePolicy } = await loadGate();
  const reports = [
    inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage()),
    inspectHostilePackageSecuritySurfacePolicy(Buffer.from('not a zip')),
    inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage([
      { name: 'word/_rels/document.xml.rels', content: '<Relationships><Relationship TargetMode="External" /></Relationships>' },
    ])),
    inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage([
      { name: 'word/vbaProject.bin', content: 'opaque' },
    ])),
    inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage([
      { name: 'word/embeddings/oleObject1.bin', content: 'opaque' },
    ])),
    inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage([
      { name: 'word/activeX/activeX1.bin', content: 'opaque' },
    ])),
  ];

  for (const report of reports) {
    assert.equal(report.docxImportAuthorized, false);
    assert.equal(report.runtimeAction, 'NONE');
    assert.equal(report.securitySurfacePolicyDecision.docxImportAuthorized, false);
    assert.equal(report.securitySurfacePolicyDecision.runtimeAction, 'NONE');
  }
});

test('security surface policy hash is deterministic and changes when policy changes', async () => {
  const { inspectHostilePackageSecuritySurfacePolicy } = await loadGate();
  const first = inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage([
    { name: 'word/vbaProject.bin', content: 'opaque' },
  ]));
  const second = inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage([
    { name: 'word/vbaProject.bin', content: 'opaque' },
  ]));
  const changedPolicy = inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage([
    { name: 'word/vbaProject.bin', content: 'opaque' },
  ]), { securitySurfacePolicyVersion: 'DOCX_HOSTILE_PACKAGE_GATE_001C_CHANGED' });

  assert.deepEqual(first, second);
  assert.notEqual(first.gateHash, changedPolicy.gateHash);
});

test('security surface policy evidence observation hashes are deterministic and evidence-bound', async () => {
  const { inspectHostilePackageSecuritySurfacePolicy } = await loadGate();
  const first = inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage([
    { name: 'word/vbaProject.bin', content: 'opaque' },
  ]));
  const renamed = inspectHostilePackageSecuritySurfacePolicy(safeXmlPackage([
    { name: 'custom/vbaProject.bin', content: 'opaque' },
  ]));
  const hashes = first.securitySurfacePolicyDecision.evidenceObservationHashes;

  assert.equal(hashes.length, 1);
  assert.match(hashes[0], /^[a-f0-9]{64}$/u);
  assert.deepEqual(hashes, first.securitySurfaceEvidence.map((evidence) => evidence.observationHash));
  assert.notDeepEqual(hashes, renamed.securitySurfacePolicyDecision.evidenceObservationHashes);
});

test('security surface policy production exports do not expose runtime admission or quarantine terms', async () => {
  const gate = await loadGate();
  const productionExportNames = Object.keys(gate);

  assert.equal(productionExportNames.some((name) => /admission|quarantine/iu.test(name)), false);
});

test('DOCX intake envelope clears safe package without authorizing import', async () => {
  const {
    inspectDocxIntakeEnvelopeDecision,
    DOCX_INTAKE_ENVELOPE_DECISION_STATUS,
    SECURITY_REASON_CODES,
  } = await loadGate();
  const report = inspectDocxIntakeEnvelopeDecision(safeXmlPackage());

  assert.equal(
    report.decisionStatus,
    DOCX_INTAKE_ENVELOPE_DECISION_STATUS.ENVELOPE_GATE_CLEARED_NOT_IMPORT_AUTHORIZED,
  );
  assert.equal(report.docxImportAuthorized, false);
  assert.equal(report.runtimeAction, 'NONE');
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.ENVELOPE_GATE_CLEARED), true);
  assert.equal(
    report.reasonCodes.includes(SECURITY_REASON_CODES.DOCX_IMPORT_REQUIRES_SEPARATE_OWNER_APPROVED_CONTOUR),
    true,
  );
  assert.equal(report.completedGateVersions.includes('DOCX_HOSTILE_PACKAGE_GATE_001A'), true);
  assert.equal(report.completedGateVersions.includes('DOCX_HOSTILE_PACKAGE_GATE_001B'), true);
  assert.equal(report.completedGateVersions.includes('DOCX_HOSTILE_PACKAGE_GATE_001C'), true);
  assert.match(report.envelopeDecisionHash, /^[a-f0-9]{64}$/u);
  assert.equal(report.gateHash, report.envelopeDecisionHash);
});

test('DOCX intake envelope safe result includes all three subordinate gate hashes', async () => {
  const { inspectDocxIntakeEnvelopeDecision } = await loadGate();
  const report = inspectDocxIntakeEnvelopeDecision(safeXmlPackage());

  assert.match(report.gateHashes.packageGateHash, /^[a-f0-9]{64}$/u);
  assert.match(report.gateHashes.xmlPreflightGateHash, /^[a-f0-9]{64}$/u);
  assert.match(report.gateHashes.securitySurfacePolicyGateHash, /^[a-f0-9]{64}$/u);
  assert.equal(report.gateHashes.packageGateHash, report.packageReport.gateHash);
  assert.equal(report.gateHashes.xmlPreflightGateHash, report.xmlPreflightReport.gateHash);
  assert.equal(report.gateHashes.securitySurfacePolicyGateHash, report.securitySurfacePolicyReport.gateHash);
});

test('DOCX intake envelope short-circuits on blocked package gate', async () => {
  const {
    inspectDocxIntakeEnvelopeDecision,
    DOCX_INTAKE_ENVELOPE_DECISION_STATUS,
    SECURITY_REASON_CODES,
  } = await loadGate();
  const report = inspectDocxIntakeEnvelopeDecision(Buffer.from('not a zip'));

  assert.equal(report.decisionStatus, DOCX_INTAKE_ENVELOPE_DECISION_STATUS.ENVELOPE_PACKAGE_GATE_BLOCKED);
  assert.equal(report.blockedGateVersion, 'DOCX_HOSTILE_PACKAGE_GATE_001A');
  assert.equal(report.gateHashes.blockedGateHash, report.packageReport.gateHash);
  assert.equal(report.gateHashes.xmlPreflightGateHash, undefined);
  assert.equal(report.gateHashes.securitySurfacePolicyGateHash, undefined);
  assert.equal(report.xmlPreflightReport, null);
  assert.equal(report.securitySurfacePolicyReport, null);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.ZIP_EOCD_MISSING), true);
  assert.equal(report.docxImportAuthorized, false);
  assert.equal(report.runtimeAction, 'NONE');
});

test('DOCX intake envelope short-circuits on blocked XML preflight gate', async () => {
  const {
    inspectDocxIntakeEnvelopeDecision,
    DOCX_INTAKE_ENVELOPE_DECISION_STATUS,
    SECURITY_REASON_CODES,
  } = await loadGate();
  const report = inspectDocxIntakeEnvelopeDecision(safeXmlPackage([
    {
      name: 'word/_rels/document.xml.rels',
      content: '<Relationships><Relationship TargetMode="External" /></Relationships>',
    },
  ]));

  assert.equal(report.decisionStatus, DOCX_INTAKE_ENVELOPE_DECISION_STATUS.ENVELOPE_XML_PREFLIGHT_BLOCKED);
  assert.equal(report.blockedGateVersion, 'DOCX_HOSTILE_PACKAGE_GATE_001B');
  assert.equal(report.gateHashes.packageGateHash, report.packageReport.gateHash);
  assert.equal(report.gateHashes.blockedGateHash, report.xmlPreflightReport.gateHash);
  assert.equal(report.gateHashes.securitySurfacePolicyGateHash, undefined);
  assert.equal(report.securitySurfacePolicyReport, null);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.RELATIONSHIP_TARGETMODE_EXTERNAL), true);
  assert.equal(report.docxImportAuthorized, false);
  assert.equal(report.runtimeAction, 'NONE');
});

test('DOCX intake envelope blocks security surface policy only after package and XML gates pass', async () => {
  const {
    inspectDocxIntakeEnvelopeDecision,
    DOCX_INTAKE_ENVELOPE_DECISION_STATUS,
    SECURITY_REASON_CODES,
  } = await loadGate();
  const report = inspectDocxIntakeEnvelopeDecision(safeXmlPackage([
    { name: 'word/vbaProject.bin', content: 'opaque' },
  ]));

  assert.equal(report.decisionStatus, DOCX_INTAKE_ENVELOPE_DECISION_STATUS.ENVELOPE_SECURITY_SURFACE_BLOCKED);
  assert.equal(report.blockedGateVersion, 'DOCX_HOSTILE_PACKAGE_GATE_001C');
  assert.equal(report.gateHashes.packageGateHash, report.packageReport.gateHash);
  assert.equal(report.gateHashes.xmlPreflightGateHash, report.xmlPreflightReport.gateHash);
  assert.equal(report.gateHashes.blockedGateHash, report.securitySurfacePolicyReport.gateHash);
  assert.equal(report.reasonCodes.includes(SECURITY_REASON_CODES.MACRO_SURFACE_PRESENT), true);
  assert.equal(report.docxImportAuthorized, false);
  assert.equal(report.runtimeAction, 'NONE');
});

test('DOCX intake envelope never authorizes runtime import for any aggregate outcome', async () => {
  const { inspectDocxIntakeEnvelopeDecision } = await loadGate();
  const reports = [
    inspectDocxIntakeEnvelopeDecision(safeXmlPackage()),
    inspectDocxIntakeEnvelopeDecision(Buffer.from('not a zip')),
    inspectDocxIntakeEnvelopeDecision(safeXmlPackage([
      { name: 'word/_rels/document.xml.rels', content: '<Relationships><Relationship TargetMode="External" /></Relationships>' },
    ])),
    inspectDocxIntakeEnvelopeDecision(safeXmlPackage([
      { name: 'word/vbaProject.bin', content: 'opaque' },
    ])),
  ];

  for (const report of reports) {
    assert.equal(report.docxImportAuthorized, false);
    assert.equal(report.runtimeAction, 'NONE');
  }
});

test('DOCX intake envelope hash is deterministic and policy-bound', async () => {
  const { inspectDocxIntakeEnvelopeDecision } = await loadGate();
  const first = inspectDocxIntakeEnvelopeDecision(safeXmlPackage());
  const second = inspectDocxIntakeEnvelopeDecision(safeXmlPackage());
  const changedPolicy = inspectDocxIntakeEnvelopeDecision(safeXmlPackage(), { maxEntryCount: 10 });

  assert.deepEqual(first, second);
  assert.match(first.gateHash, /^[a-f0-9]{64}$/u);
  assert.match(first.envelopeDecisionHash, /^[a-f0-9]{64}$/u);
  assert.equal(first.gateHash, first.envelopeDecisionHash);
  assert.notEqual(first.gateHash, changedPolicy.gateHash);
});

test('DOCX intake envelope production API exposes no semantic parse callback or enablement names', async () => {
  const gate = await loadGate();
  const productionExportNames = Object.keys(gate);

  assert.equal(gate.inspectDocxIntakeEnvelopeDecision.length, 1);
  assert.equal(
    productionExportNames.some((name) => /enable|admission|quarantine|semantic|parse|callback|authorized/iu.test(name)),
    false,
  );
});

test('security core export surface guard exposes intake envelope decision without import enablement names', async () => {
  const gate = await loadGate();
  const productionExportNames = Object.keys(gate);
  const firstSurface = assertSecurityCoreExportSurface(productionExportNames);
  const secondSurface = assertSecurityCoreExportSurface([...productionExportNames].reverse());

  assert.equal(typeof gate.inspectDocxIntakeEnvelopeDecision, 'function');
  assert.equal(gate.inspectDocxIntakeEnvelopeDecision.length, 1);
  assert.equal(firstSurface.hasRequiredIntakeEnvelopeDecisionExport, true);
  assert.deepEqual(firstSurface.forbiddenExportNames, []);
  assert.deepEqual(firstSurface, secondSurface);
});

test('security core export surface guard rejects local forbidden export fixture', () => {
  const forbiddenExportNames = [
    REQUIRED_SECURITY_CORE_EXPORT_NAME,
    'applyDocxToRuntime',
    'authorizeDocxImport',
    'docxImportAuthorized',
    'enableDocxImport',
    'parseDocxSemanticPayload',
    'runtimeAdmissionCallback',
  ];
  const surface = inspectSecurityCoreExportSurface(forbiddenExportNames);

  assert.deepEqual(surface.forbiddenExportNames, [
    'applyDocxToRuntime',
    'authorizeDocxImport',
    'docxImportAuthorized',
    'enableDocxImport',
    'parseDocxSemanticPayload',
    'runtimeAdmissionCallback',
  ]);
  assert.throws(() => assertSecurityCoreExportSurface(forbiddenExportNames), { name: 'AssertionError' });
});

test('DOCX intake envelope result-shape guard accepts current safe 001D result', async () => {
  const {
    inspectDocxIntakeEnvelopeDecision,
    DOCX_INTAKE_ENVELOPE_DECISION_STATUS,
  } = await loadGate();
  const report = inspectDocxIntakeEnvelopeDecision(safeXmlPackage());
  const firstShape = assertDocxIntakeEnvelopeResultShape(report);
  const secondShape = assertDocxIntakeEnvelopeResultShape({ ...report });

  assert.equal(firstShape.docxImportAuthorized, false);
  assert.equal(firstShape.runtimeAction, 'NONE');
  assert.equal(
    firstShape.decisionStatus,
    DOCX_INTAKE_ENVELOPE_DECISION_STATUS.ENVELOPE_GATE_CLEARED_NOT_IMPORT_AUTHORIZED,
  );
  assert.deepEqual(firstShape, secondShape);
});

test('DOCX intake envelope result-shape guard rejects import authorization and runtime actions', () => {
  const safeShapeFixture = {
    decisionStatus: 'ENVELOPE_GATE_CLEARED_NOT_IMPORT_AUTHORIZED',
    docxImportAuthorized: false,
    runtimeAction: 'NONE',
  };
  const authorizedFixture = {
    ...safeShapeFixture,
    docxImportAuthorized: true,
  };

  assert.deepEqual(
    inspectDocxIntakeEnvelopeResultShape(authorizedFixture).violations,
    ['DOCX_IMPORT_AUTHORIZED_TRUE'],
  );
  assert.throws(() => assertDocxIntakeEnvelopeResultShape(authorizedFixture), { name: 'AssertionError' });

  for (const runtimeAction of FORBIDDEN_DOCX_INTAKE_RUNTIME_ACTIONS) {
    const runtimeFixture = {
      ...safeShapeFixture,
      runtimeAction,
    };

    assert.deepEqual(
      inspectDocxIntakeEnvelopeResultShape(runtimeFixture).violations,
      [`RUNTIME_ACTION_${runtimeAction}`],
    );
    assert.throws(() => assertDocxIntakeEnvelopeResultShape(runtimeFixture), { name: 'AssertionError' });
  }
});

test('DOCX diagnostic envelope probe is private main scope only', () => {
  const mainSource = readMainSource();
  const preloadSource = readProjectSource('src', 'preload.js');
  const commandCatalogSource = readProjectSource('src', 'renderer', 'commands', 'command-catalog.v1.mjs');
  const projectCommandsSource = readProjectSource('src', 'renderer', 'commands', 'projectCommands.mjs');
  const probeSource = extractFunctionSource(mainSource, 'inspectDocxDiagnosticEnvelopeForTest');

  assert.equal(mainSource.includes('function inspectDocxDiagnosticEnvelopeForTest('), true);
  assert.equal(/ipcMain\.handle\([^)]*inspectDocxDiagnosticEnvelopeForTest/u.test(mainSource), false);
  assert.equal(/UI_COMMAND_BRIDGE_ALLOWED_COMMAND_IDS[\s\S]*inspectDocxDiagnosticEnvelopeForTest/u.test(mainSource), false);
  assert.equal(/MENU_COMMAND_HANDLERS[\s\S]*inspectDocxDiagnosticEnvelopeForTest/u.test(mainSource), false);
  assert.equal(preloadSource.includes('inspectDocxDiagnosticEnvelopeForTest'), false);
  assert.equal(commandCatalogSource.includes('inspectDocxDiagnosticEnvelopeForTest'), false);
  assert.equal(projectCommandsSource.includes('inspectDocxDiagnosticEnvelopeForTest'), false);
  assert.equal(/writeFile|writeBufferAtomic|fileManager|currentFilePath|createRevision|RevisionSession/u.test(probeSource), false);
});

test('DOCX diagnostic envelope probe returns 001D safe decision without import authorization', async () => {
  const gate = await loadGate();
  const { inspectDocxDiagnosticEnvelopeForTest } = instantiateMainFunctions(
    ['inspectDocxDiagnosticEnvelopeForTest'],
    {
      loadDocxIntakeEnvelopeModule: async () => ({
        inspectDocxIntakeEnvelopeDecision: gate.inspectDocxIntakeEnvelopeDecision,
      }),
    },
  );

  assert.equal(inspectDocxDiagnosticEnvelopeForTest.length, 1);
  const report = await inspectDocxDiagnosticEnvelopeForTest(safeXmlPackage());

  assert.equal(
    report.decisionStatus,
    gate.DOCX_INTAKE_ENVELOPE_DECISION_STATUS.ENVELOPE_GATE_CLEARED_NOT_IMPORT_AUTHORIZED,
  );
  assert.equal(report.diagnosticProbeVersion, 'DOCX_DIAGNOSTIC_ENVELOPE_PROBE_001');
  assert.equal(report.diagnosticOnly, true);
  assert.equal(report.docxImportAuthorized, false);
  assert.equal(report.runtimeAction, 'NONE');
});

test('DOCX diagnostic envelope probe preserves blocked 001D outcomes without writes', async () => {
  const gate = await loadGate();
  const { inspectDocxDiagnosticEnvelopeForTest } = instantiateMainFunctions(
    ['inspectDocxDiagnosticEnvelopeForTest'],
    {
      loadDocxIntakeEnvelopeModule: async () => ({
        inspectDocxIntakeEnvelopeDecision: gate.inspectDocxIntakeEnvelopeDecision,
      }),
    },
  );
  const reports = [
    await inspectDocxDiagnosticEnvelopeForTest(Buffer.from('not a zip')),
    await inspectDocxDiagnosticEnvelopeForTest(safeXmlPackage([
      { name: 'word/_rels/document.xml.rels', content: '<Relationships><Relationship TargetMode="External" /></Relationships>' },
    ])),
    await inspectDocxDiagnosticEnvelopeForTest(safeXmlPackage([
      { name: 'word/vbaProject.bin', content: 'opaque' },
    ])),
  ];

  assert.equal(
    reports[0].decisionStatus,
    gate.DOCX_INTAKE_ENVELOPE_DECISION_STATUS.ENVELOPE_PACKAGE_GATE_BLOCKED,
  );
  assert.equal(
    reports[1].decisionStatus,
    gate.DOCX_INTAKE_ENVELOPE_DECISION_STATUS.ENVELOPE_XML_PREFLIGHT_BLOCKED,
  );
  assert.equal(
    reports[2].decisionStatus,
    gate.DOCX_INTAKE_ENVELOPE_DECISION_STATUS.ENVELOPE_SECURITY_SURFACE_BLOCKED,
  );
  for (const report of reports) {
    assert.equal(report.diagnosticOnly, true);
    assert.equal(report.docxImportAuthorized, false);
    assert.equal(report.runtimeAction, 'NONE');
  }
});
