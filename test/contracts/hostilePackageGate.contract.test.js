const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MODULE_BASENAME = 'hostilePackageGate.mjs';

async function loadGate() {
  return import(pathToFileURL(path.join(process.cwd(), 'src', 'revisionBridge', MODULE_BASENAME)).href);
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
