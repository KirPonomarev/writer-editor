import { createHash } from 'node:crypto';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const MIN_EOCD_SIZE = 22;
const CENTRAL_DIRECTORY_HEADER_SIZE = 46;
const ZIP64_LIMIT_16 = 0xffff;
const ZIP64_LIMIT_32 = 0xffffffff;

export const SECURITY_STATUS = Object.freeze({
  ALLOWED: 'ALLOWED',
  BLOCKED: 'BLOCKED',
});

export const PACKAGE_SHAPE_STATUS = Object.freeze({
  DOCX_LIKE: 'DOCX_LIKE',
  DEGRADED: 'DEGRADED',
  UNKNOWN: 'UNKNOWN',
});

export const SECURITY_REASON_CODES = Object.freeze({
  ZIP_EOCD_MISSING: 'ZIP_EOCD_MISSING',
  ZIP_EOCD_AMBIGUOUS: 'ZIP_EOCD_AMBIGUOUS',
  ZIP_CENTRAL_DIRECTORY_INVALID: 'ZIP_CENTRAL_DIRECTORY_INVALID',
  ZIP64_UNSUPPORTED_IN_001A: 'ZIP64_UNSUPPORTED_IN_001A',
  EMPTY_ARCHIVE: 'EMPTY_ARCHIVE',
  ENTRY_COUNT_LIMIT_EXCEEDED: 'ENTRY_COUNT_LIMIT_EXCEEDED',
  TOTAL_COMPRESSED_SIZE_LIMIT_EXCEEDED: 'TOTAL_COMPRESSED_SIZE_LIMIT_EXCEEDED',
  TOTAL_UNCOMPRESSED_SIZE_LIMIT_EXCEEDED: 'TOTAL_UNCOMPRESSED_SIZE_LIMIT_EXCEEDED',
  COMPRESSION_RATIO_LIMIT_EXCEEDED: 'COMPRESSION_RATIO_LIMIT_EXCEEDED',
  PATH_TRAVERSAL: 'PATH_TRAVERSAL',
  ABSOLUTE_PATH: 'ABSOLUTE_PATH',
  DRIVE_LETTER_PATH: 'DRIVE_LETTER_PATH',
  BACKSLASH_PATH: 'BACKSLASH_PATH',
  EMPTY_ENTRY_NAME: 'EMPTY_ENTRY_NAME',
  DUPLICATE_ENTRY_NAME: 'DUPLICATE_ENTRY_NAME',
  ENCRYPTED_ENTRY: 'ENCRYPTED_ENTRY',
  UNSUPPORTED_COMPRESSION_METHOD: 'UNSUPPORTED_COMPRESSION_METHOD',
  SYMLINK_ENTRY: 'SYMLINK_ENTRY',
});

export const PACKAGE_SHAPE_OBSERVATIONS = Object.freeze({
  OPC_CONTENT_TYPES_PRESENT: 'OPC_CONTENT_TYPES_PRESENT',
  OPC_RELS_PRESENT: 'OPC_RELS_PRESENT',
  WORD_DOCUMENT_PART_PRESENT: 'WORD_DOCUMENT_PART_PRESENT',
  OPC_CONTENT_TYPES_MISSING: 'OPC_CONTENT_TYPES_MISSING',
  OPC_RELS_MISSING: 'OPC_RELS_MISSING',
  WORD_DOCUMENT_PART_MISSING: 'WORD_DOCUMENT_PART_MISSING',
});

export const DEFAULT_HOSTILE_PACKAGE_POLICY = Object.freeze({
  maxEntryCount: 256,
  maxTotalCompressedSize: 64 * 1024 * 1024,
  maxTotalUncompressedSize: 256 * 1024 * 1024,
  maxCompressionRatio: 100,
  allowedCompressionMethods: Object.freeze([0, 8]),
  zip64Policy: 'BLOCK',
  symlinkPolicy: 'BLOCK_WHEN_DETECTABLE',
  requireOpcShapeObservation: true,
});

function canonicalize(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('canonicalJson rejects non-finite numbers');
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item, seen));
  }
  if (typeof value === 'object') {
    if (seen.has(value)) {
      throw new TypeError('canonicalJson rejects cyclic values');
    }
    seen.add(value);
    const output = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = canonicalize(value[key], seen);
    }
    seen.delete(value);
    return output;
  }
  throw new TypeError(`canonicalJson rejects ${typeof value}`);
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function canonicalHash(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function uniqueSorted(items) {
  return Array.from(new Set(items.filter(Boolean))).sort();
}

function normalizePolicy(policy = {}) {
  const merged = {
    ...DEFAULT_HOSTILE_PACKAGE_POLICY,
    ...policy,
    allowedCompressionMethods: [
      ...(policy.allowedCompressionMethods || DEFAULT_HOSTILE_PACKAGE_POLICY.allowedCompressionMethods),
    ].sort((a, b) => a - b),
  };
  return Object.freeze(merged);
}

function makeBlockedReport({
  reasonCodes,
  policy,
  observations = [],
  packageShapeObservations = [],
  entryCount = 0,
}) {
  const reportCore = {
    gateVersion: 'DOCX_HOSTILE_PACKAGE_GATE_001A',
    status: SECURITY_STATUS.BLOCKED,
    securityStatus: SECURITY_STATUS.BLOCKED,
    packageShapeStatus: PACKAGE_SHAPE_STATUS.UNKNOWN,
    reasonCodes: uniqueSorted(reasonCodes),
    observations: uniqueSorted(observations),
    policy,
    entryCount,
    totalCompressedSize: 0,
    totalUncompressedSize: 0,
    maxDeclaredCompressionRatio: 0,
    normalizedEntryNames: [],
    rejectedEntries: [],
    packageShapeObservations: uniqueSorted(packageShapeObservations),
  };
  return {
    ...reportCore,
    gateHash: canonicalHash(reportCore),
  };
}

function findEocdOffsets(buffer) {
  const offsets = [];
  const start = Math.max(0, buffer.length - MIN_EOCD_SIZE - ZIP64_LIMIT_16);
  for (let offset = buffer.length - MIN_EOCD_SIZE; offset >= start; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      const commentLength = buffer.readUInt16LE(offset + 20);
      if (offset + MIN_EOCD_SIZE + commentLength === buffer.length) {
        offsets.push(offset);
      }
    }
  }
  return offsets.reverse();
}

function readEocd(buffer, policy) {
  if (buffer.length < MIN_EOCD_SIZE) {
    return { blocked: makeBlockedReport({ reasonCodes: [SECURITY_REASON_CODES.ZIP_EOCD_MISSING], policy }) };
  }
  const eocdOffsets = findEocdOffsets(buffer);
  if (eocdOffsets.length === 0) {
    return { blocked: makeBlockedReport({ reasonCodes: [SECURITY_REASON_CODES.ZIP_EOCD_MISSING], policy }) };
  }
  if (eocdOffsets.length > 1) {
    return { blocked: makeBlockedReport({ reasonCodes: [SECURITY_REASON_CODES.ZIP_EOCD_AMBIGUOUS], policy }) };
  }
  const offset = eocdOffsets[0];
  const diskNumber = buffer.readUInt16LE(offset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(offset + 6);
  const entryCountOnDisk = buffer.readUInt16LE(offset + 8);
  const entryCount = buffer.readUInt16LE(offset + 10);
  const centralDirectorySize = buffer.readUInt32LE(offset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(offset + 16);
  const zip64Markers = [
    entryCountOnDisk,
    entryCount,
  ].includes(ZIP64_LIMIT_16) || [
    centralDirectorySize,
    centralDirectoryOffset,
  ].includes(ZIP64_LIMIT_32);

  if (zip64Markers) {
    return { blocked: makeBlockedReport({ reasonCodes: [SECURITY_REASON_CODES.ZIP64_UNSUPPORTED_IN_001A], policy }) };
  }
  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entryCountOnDisk !== entryCount) {
    return {
      blocked: makeBlockedReport({ reasonCodes: [SECURITY_REASON_CODES.ZIP_CENTRAL_DIRECTORY_INVALID], policy }),
    };
  }
  if (entryCount === 0) {
    return { blocked: makeBlockedReport({ reasonCodes: [SECURITY_REASON_CODES.EMPTY_ARCHIVE], policy }) };
  }
  if (centralDirectoryOffset + centralDirectorySize > offset) {
    return {
      blocked: makeBlockedReport({ reasonCodes: [SECURITY_REASON_CODES.ZIP_CENTRAL_DIRECTORY_INVALID], policy }),
    };
  }
  return {
    eocd: {
      entryCount,
      centralDirectoryOffset,
      centralDirectorySize,
    },
  };
}

function decodeEntryName(buffer, flags) {
  const encoding = (flags & 0x0800) === 0x0800 ? 'utf8' : 'latin1';
  return buffer.toString(encoding);
}

function normalizeEntryName(entryName) {
  return entryName.normalize('NFC').replace(/^\.\/+/u, '');
}

function isSymlinkEntry(versionMadeBy, externalAttributes) {
  const hostSystem = versionMadeBy >> 8;
  const unixMode = (externalAttributes >>> 16) & 0xffff;
  return hostSystem === 3 && (unixMode & 0o170000) === 0o120000;
}

function inspectEntryPath(entryName, normalizedName) {
  const reasons = [];
  if (entryName.length === 0 || normalizedName.length === 0) {
    reasons.push(SECURITY_REASON_CODES.EMPTY_ENTRY_NAME);
  }
  if (entryName.includes('\\')) {
    reasons.push(SECURITY_REASON_CODES.BACKSLASH_PATH);
  }
  if (entryName.startsWith('/') || entryName.startsWith('\\')) {
    reasons.push(SECURITY_REASON_CODES.ABSOLUTE_PATH);
  }
  if (/^[A-Za-z]:/u.test(entryName)) {
    reasons.push(SECURITY_REASON_CODES.DRIVE_LETTER_PATH);
  }
  if (normalizedName.split('/').includes('..')) {
    reasons.push(SECURITY_REASON_CODES.PATH_TRAVERSAL);
  }
  return reasons;
}

function readCentralDirectory(buffer, eocd, policy) {
  const entries = [];
  let cursor = eocd.centralDirectoryOffset;
  const end = eocd.centralDirectoryOffset + eocd.centralDirectorySize;
  for (let index = 0; index < eocd.entryCount; index += 1) {
    if (cursor + CENTRAL_DIRECTORY_HEADER_SIZE > end) {
      return { invalid: true };
    }
    if (buffer.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
      return { invalid: true };
    }
    const versionMadeBy = buffer.readUInt16LE(cursor + 4);
    const flags = buffer.readUInt16LE(cursor + 8);
    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const externalAttributes = buffer.readUInt32LE(cursor + 38);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const recordLength = CENTRAL_DIRECTORY_HEADER_SIZE + nameLength + extraLength + commentLength;
    if (cursor + recordLength > end) {
      return { invalid: true };
    }
    if (
      compressedSize === ZIP64_LIMIT_32
      || uncompressedSize === ZIP64_LIMIT_32
      || localHeaderOffset === ZIP64_LIMIT_32
    ) {
      return { zip64: true };
    }
    const rawName = buffer.subarray(cursor + CENTRAL_DIRECTORY_HEADER_SIZE, cursor + CENTRAL_DIRECTORY_HEADER_SIZE + nameLength);
    const entryName = decodeEntryName(rawName, flags);
    const normalizedName = normalizeEntryName(entryName);
    entries.push({
      entryName,
      normalizedName,
      flags,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      versionMadeBy,
      externalAttributes,
      isEncrypted: (flags & 1) === 1,
      isSymlink: policy.symlinkPolicy === 'BLOCK_WHEN_DETECTABLE'
        && isSymlinkEntry(versionMadeBy, externalAttributes),
    });
    cursor += recordLength;
  }
  if (cursor !== end) {
    return { invalid: true };
  }
  return { entries };
}

function classifyPackageShape(normalizedNames) {
  const names = new Set(normalizedNames);
  const observations = [];
  observations.push(
    names.has('[Content_Types].xml')
      ? PACKAGE_SHAPE_OBSERVATIONS.OPC_CONTENT_TYPES_PRESENT
      : PACKAGE_SHAPE_OBSERVATIONS.OPC_CONTENT_TYPES_MISSING,
  );
  observations.push(
    names.has('_rels/.rels')
      ? PACKAGE_SHAPE_OBSERVATIONS.OPC_RELS_PRESENT
      : PACKAGE_SHAPE_OBSERVATIONS.OPC_RELS_MISSING,
  );
  observations.push(
    names.has('word/document.xml')
      ? PACKAGE_SHAPE_OBSERVATIONS.WORD_DOCUMENT_PART_PRESENT
      : PACKAGE_SHAPE_OBSERVATIONS.WORD_DOCUMENT_PART_MISSING,
  );
  const missing = observations.some((observation) => observation.endsWith('_MISSING'));
  return {
    packageShapeStatus: missing ? PACKAGE_SHAPE_STATUS.DEGRADED : PACKAGE_SHAPE_STATUS.DOCX_LIKE,
    packageShapeObservations: observations.sort(),
  };
}

export function inspectHostilePackage(inputBuffer, inputPolicy = {}) {
  const policy = normalizePolicy(inputPolicy);
  const buffer = Buffer.isBuffer(inputBuffer) ? inputBuffer : Buffer.from(inputBuffer || []);
  const eocdResult = readEocd(buffer, policy);
  if (eocdResult.blocked) {
    return eocdResult.blocked;
  }

  const directoryResult = readCentralDirectory(buffer, eocdResult.eocd, policy);
  if (directoryResult.invalid) {
    return makeBlockedReport({
      reasonCodes: [SECURITY_REASON_CODES.ZIP_CENTRAL_DIRECTORY_INVALID],
      policy,
      entryCount: eocdResult.eocd.entryCount,
    });
  }
  if (directoryResult.zip64) {
    return makeBlockedReport({ reasonCodes: [SECURITY_REASON_CODES.ZIP64_UNSUPPORTED_IN_001A], policy });
  }

  const entries = directoryResult.entries;
  const reasonCodes = [];
  const rejectedEntries = [];
  const normalizedEntryNames = [];
  const normalizedNameCounts = new Map();
  let totalCompressedSize = 0;
  let totalUncompressedSize = 0;
  let maxDeclaredCompressionRatio = 0;

  if (entries.length > policy.maxEntryCount) {
    reasonCodes.push(SECURITY_REASON_CODES.ENTRY_COUNT_LIMIT_EXCEEDED);
  }

  for (const entry of entries) {
    normalizedEntryNames.push(entry.normalizedName);
    normalizedNameCounts.set(entry.normalizedName, (normalizedNameCounts.get(entry.normalizedName) || 0) + 1);
    totalCompressedSize += entry.compressedSize;
    totalUncompressedSize += entry.uncompressedSize;
    const ratio = entry.compressedSize === 0
      ? (entry.uncompressedSize > 0 ? Number.MAX_SAFE_INTEGER : 0)
      : entry.uncompressedSize / entry.compressedSize;
    maxDeclaredCompressionRatio = Math.max(maxDeclaredCompressionRatio, ratio);

    const entryReasons = [
      ...inspectEntryPath(entry.entryName, entry.normalizedName),
    ];
    if (entry.isEncrypted) {
      entryReasons.push(SECURITY_REASON_CODES.ENCRYPTED_ENTRY);
    }
    if (!policy.allowedCompressionMethods.includes(entry.compressionMethod)) {
      entryReasons.push(SECURITY_REASON_CODES.UNSUPPORTED_COMPRESSION_METHOD);
    }
    if (entry.isSymlink) {
      entryReasons.push(SECURITY_REASON_CODES.SYMLINK_ENTRY);
    }
    if (entryReasons.length > 0) {
      reasonCodes.push(...entryReasons);
      rejectedEntries.push({
        entryName: entry.entryName,
        normalizedName: entry.normalizedName,
        reasonCodes: uniqueSorted(entryReasons),
      });
    }
  }

  for (const [normalizedName, count] of normalizedNameCounts.entries()) {
    if (count > 1) {
      reasonCodes.push(SECURITY_REASON_CODES.DUPLICATE_ENTRY_NAME);
      rejectedEntries.push({
        entryName: normalizedName,
        normalizedName,
        reasonCodes: [SECURITY_REASON_CODES.DUPLICATE_ENTRY_NAME],
      });
    }
  }

  if (totalCompressedSize > policy.maxTotalCompressedSize) {
    reasonCodes.push(SECURITY_REASON_CODES.TOTAL_COMPRESSED_SIZE_LIMIT_EXCEEDED);
  }
  if (totalUncompressedSize > policy.maxTotalUncompressedSize) {
    reasonCodes.push(SECURITY_REASON_CODES.TOTAL_UNCOMPRESSED_SIZE_LIMIT_EXCEEDED);
  }
  if (maxDeclaredCompressionRatio > policy.maxCompressionRatio) {
    reasonCodes.push(SECURITY_REASON_CODES.COMPRESSION_RATIO_LIMIT_EXCEEDED);
  }

  const sortedEntryNames = normalizedEntryNames.sort();
  const packageShape = classifyPackageShape(sortedEntryNames);
  const securityStatus = reasonCodes.length > 0 ? SECURITY_STATUS.BLOCKED : SECURITY_STATUS.ALLOWED;
  const reportCore = {
    gateVersion: 'DOCX_HOSTILE_PACKAGE_GATE_001A',
    status: securityStatus,
    securityStatus,
    packageShapeStatus: packageShape.packageShapeStatus,
    reasonCodes: uniqueSorted(reasonCodes),
    observations: [],
    policy,
    entryCount: entries.length,
    totalCompressedSize,
    totalUncompressedSize,
    maxDeclaredCompressionRatio,
    normalizedEntryNames: sortedEntryNames,
    rejectedEntries: rejectedEntries.sort((left, right) => (
      left.normalizedName < right.normalizedName ? -1 : Number(left.normalizedName > right.normalizedName)
    )),
    packageShapeObservations: packageShape.packageShapeObservations,
  };
  return {
    ...reportCore,
    gateHash: canonicalHash(reportCore),
  };
}
