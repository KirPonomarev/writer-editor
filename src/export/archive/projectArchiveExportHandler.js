'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const ARCHIVE_SCHEMA_VERSION = 'yalken-project-archive.v1';
const ARCHIVE_MANIFEST_PATH = 'yalken-archive-manifest.v1.json';
const PROJECT_ARCHIVE_ROOT = 'project';
const PROJECT_MANIFEST_FILENAME = 'project.craftsman.json';
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;

let crc32Table = null;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function createArchiveError(code, reason, details = {}) {
  const error = new Error(reason);
  error.code = code;
  error.reason = reason;
  error.details = isPlainObject(details) ? { ...details } : {};
  return error;
}

function makeCrc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
}

function crc32(buffer) {
  if (!crc32Table) crc32Table = makeCrc32Table();
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function writeUInt32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

function writeUInt16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value & 0xffff, 0);
  return buffer;
}

function normalizeArchivePath(rawPath) {
  if (typeof rawPath !== 'string' || !rawPath.trim()) {
    throw createArchiveError('E_PROJECT_ARCHIVE_PATH_INVALID', 'archive_path_invalid');
  }
  const normalized = rawPath.split(path.sep).join('/').replace(/^\/+/u, '');
  const parts = normalized.split('/').filter(Boolean);
  if (
    parts.length === 0
    || parts.some((part) => part === '.' || part === '..' || part.includes('\0'))
    || path.posix.isAbsolute(normalized)
  ) {
    throw createArchiveError('E_PROJECT_ARCHIVE_PATH_INVALID', 'archive_path_invalid', { archivePath: rawPath });
  }
  return parts.join('/');
}

function compareArchiveEntries(left, right) {
  return left.archivePath.localeCompare(right.archivePath, 'en');
}

async function collectProjectArchiveSourceEntries(projectRootRaw) {
  const projectRoot = path.resolve(String(projectRootRaw || ''));
  if (!projectRoot || projectRoot === path.parse(projectRoot).root) {
    throw createArchiveError('E_PROJECT_ARCHIVE_ROOT_INVALID', 'project_archive_root_invalid');
  }
  const rootStat = await fs.lstat(projectRoot).catch((error) => {
    throw createArchiveError('E_PROJECT_ARCHIVE_ROOT_UNREADABLE', 'project_archive_root_unreadable', {
      nestedCode: typeof error?.code === 'string' ? error.code : '',
    });
  });
  if (!rootStat.isDirectory()) {
    throw createArchiveError('E_PROJECT_ARCHIVE_ROOT_INVALID', 'project_archive_root_invalid');
  }

  const files = [];
  async function visit(directoryPath, relativeParts = []) {
    const dirents = await fs.readdir(directoryPath, { withFileTypes: true }).catch((error) => {
      throw createArchiveError('E_PROJECT_ARCHIVE_READ_FAILED', 'project_archive_read_failed', {
        nestedCode: typeof error?.code === 'string' ? error.code : '',
      });
    });
    for (const dirent of dirents) {
      if (dirent.name === '.' || dirent.name === '..' || dirent.name.includes('\0')) {
        throw createArchiveError('E_PROJECT_ARCHIVE_PATH_INVALID', 'archive_path_invalid');
      }
      const childPath = path.join(directoryPath, dirent.name);
      const relative = [...relativeParts, dirent.name];
      const relativePath = normalizeArchivePath(relative.join('/'));
      const archivePath = normalizeArchivePath(`${PROJECT_ARCHIVE_ROOT}/${relativePath}`);
      const stat = await fs.lstat(childPath);
      if (stat.isSymbolicLink()) {
        throw createArchiveError('E_PROJECT_ARCHIVE_SYMLINK_DENIED', 'project_archive_symlink_denied', {
          archivePath,
        });
      }
      if (stat.isDirectory()) {
        await visit(childPath, relative);
      } else if (stat.isFile()) {
        const buffer = await fs.readFile(childPath);
        files.push({
          archivePath,
          relativePath,
          size: buffer.length,
          sha256: sha256Buffer(buffer),
          buffer,
        });
      }
    }
  }

  await visit(projectRoot);
  files.sort(compareArchiveEntries);
  return { projectRoot, files };
}

function readManifestFile(files) {
  const manifestEntry = files.find((entry) => entry.relativePath === PROJECT_MANIFEST_FILENAME);
  if (!manifestEntry) {
    throw createArchiveError('E_PROJECT_ARCHIVE_MANIFEST_MISSING', 'project_manifest_missing');
  }
  try {
    return JSON.parse(manifestEntry.buffer.toString('utf8'));
  } catch (error) {
    throw createArchiveError('E_PROJECT_ARCHIVE_MANIFEST_CORRUPT', 'project_manifest_corrupt', {
      nestedMessage: typeof error?.message === 'string' ? error.message : '',
    });
  }
}

function buildArchiveManifest(files, manifest, options = {}) {
  const projectId = typeof manifest?.projectId === 'string' ? manifest.projectId : '';
  const projectName = typeof manifest?.projectName === 'string' ? manifest.projectName : '';
  if (!projectId) {
    throw createArchiveError('E_PROJECT_ARCHIVE_PROJECT_ID_MISSING', 'project_id_missing');
  }
  return {
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    archiveKind: 'full-project',
    createdAtUtc: typeof options.createdAtUtc === 'string' && options.createdAtUtc
      ? options.createdAtUtc
      : new Date().toISOString(),
    project: {
      projectId,
      projectName,
      manifestSha256: files.find((entry) => entry.relativePath === PROJECT_MANIFEST_FILENAME)?.sha256 || '',
    },
    source: {
      localOnly: true,
      networkRequired: false,
      pathlessReceipt: true,
      sourceProjectMutated: false,
    },
    entries: files.map((entry) => ({
      archivePath: entry.archivePath,
      relativePath: entry.relativePath,
      size: entry.size,
      sha256: entry.sha256,
    })),
  };
}

function makeZipEntry(archivePath, buffer) {
  const name = Buffer.from(normalizeArchivePath(archivePath), 'utf8');
  const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
  const hash = crc32(body);
  const { dosTime, dosDate } = dosDateTime(new Date('2026-01-01T00:00:00.000Z'));
  return {
    name,
    nameText: name.toString('utf8'),
    body,
    crc32: hash,
    compressedSize: body.length,
    uncompressedSize: body.length,
    dosTime,
    dosDate,
  };
}

function buildZipArchive(rawEntries) {
  const entries = rawEntries.map((entry) => makeZipEntry(entry.archivePath, entry.buffer));
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const localHeader = Buffer.concat([
      writeUInt32(ZIP_LOCAL_FILE_SIGNATURE),
      writeUInt16(20),
      writeUInt16(0x0800),
      writeUInt16(0),
      writeUInt16(entry.dosTime),
      writeUInt16(entry.dosDate),
      writeUInt32(entry.crc32),
      writeUInt32(entry.compressedSize),
      writeUInt32(entry.uncompressedSize),
      writeUInt16(entry.name.length),
      writeUInt16(0),
      entry.name,
    ]);
    localParts.push(localHeader, entry.body);

    const centralHeader = Buffer.concat([
      writeUInt32(ZIP_CENTRAL_DIRECTORY_SIGNATURE),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(0x0800),
      writeUInt16(0),
      writeUInt16(entry.dosTime),
      writeUInt16(entry.dosDate),
      writeUInt32(entry.crc32),
      writeUInt32(entry.compressedSize),
      writeUInt32(entry.uncompressedSize),
      writeUInt16(entry.name.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(offset),
      entry.name,
    ]);
    centralParts.push(centralHeader);
    offset += localHeader.length + entry.body.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.concat([
    writeUInt32(ZIP_EOCD_SIGNATURE),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(entries.length),
    writeUInt16(entries.length),
    writeUInt32(centralDirectory.length),
    writeUInt32(offset),
    writeUInt16(0),
  ]);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) return offset;
  }
  throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_CORRUPT', 'zip_eocd_missing');
}

function readZipStoredEntries(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
    throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_CORRUPT', 'zip_buffer_invalid');
  }
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const count = buffer.readUInt16LE(eocdOffset + 10);
  const centralSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (centralOffset + centralSize > eocdOffset) {
    throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_CORRUPT', 'zip_central_directory_invalid');
  }

  const entries = new Map();
  let cursor = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_CORRUPT', 'zip_central_entry_invalid');
    }
    const method = buffer.readUInt16LE(cursor + 10);
    const expectedCrc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    const archivePath = normalizeArchivePath(name);
    if (method !== 0 || compressedSize !== uncompressedSize) {
      throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_UNSUPPORTED', 'zip_entry_method_unsupported', {
        archivePath,
      });
    }
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== ZIP_LOCAL_FILE_SIGNATURE) {
      throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_CORRUPT', 'zip_local_entry_invalid', { archivePath });
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataOffset + compressedSize;
    if (dataEnd > buffer.length) {
      throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_CORRUPT', 'zip_entry_truncated', { archivePath });
    }
    const data = buffer.subarray(dataOffset, dataEnd);
    if (crc32(data) !== expectedCrc) {
      throw createArchiveError('E_PROJECT_ARCHIVE_CHECKSUM_MISMATCH', 'zip_crc_mismatch', { archivePath });
    }
    entries.set(archivePath, Buffer.from(data));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function verifyProjectArchiveBuffer(buffer) {
  const entries = readZipStoredEntries(buffer);
  const manifestBuffer = entries.get(ARCHIVE_MANIFEST_PATH);
  if (!manifestBuffer) {
    throw createArchiveError('E_PROJECT_ARCHIVE_MANIFEST_MISSING', 'archive_manifest_missing');
  }
  let archiveManifest;
  try {
    archiveManifest = JSON.parse(manifestBuffer.toString('utf8'));
  } catch {
    throw createArchiveError('E_PROJECT_ARCHIVE_MANIFEST_CORRUPT', 'archive_manifest_corrupt');
  }
  if (archiveManifest.schemaVersion !== ARCHIVE_SCHEMA_VERSION) {
    throw createArchiveError('E_PROJECT_ARCHIVE_SCHEMA_UNSUPPORTED', 'archive_schema_unsupported');
  }
  const declaredEntries = Array.isArray(archiveManifest.entries) ? archiveManifest.entries : [];
  for (const declared of declaredEntries) {
    const archivePath = normalizeArchivePath(declared?.archivePath || '');
    const data = entries.get(archivePath);
    if (!data) {
      throw createArchiveError('E_PROJECT_ARCHIVE_ENTRY_MISSING', 'archive_entry_missing', { archivePath });
    }
    if (data.length !== declared.size || sha256Buffer(data) !== declared.sha256) {
      throw createArchiveError('E_PROJECT_ARCHIVE_CHECKSUM_MISMATCH', 'archive_checksum_mismatch', { archivePath });
    }
  }
  return {
    ok: true,
    manifest: archiveManifest,
    entryCount: declaredEntries.length,
    archiveSha256: sha256Buffer(buffer),
  };
}

function readProjectArchivePayload(buffer) {
  const entries = readZipStoredEntries(buffer);
  const manifestBuffer = entries.get(ARCHIVE_MANIFEST_PATH);
  if (!manifestBuffer) {
    throw createArchiveError('E_PROJECT_ARCHIVE_MANIFEST_MISSING', 'archive_manifest_missing');
  }
  let archiveManifest;
  try {
    archiveManifest = JSON.parse(manifestBuffer.toString('utf8'));
  } catch {
    throw createArchiveError('E_PROJECT_ARCHIVE_MANIFEST_CORRUPT', 'archive_manifest_corrupt');
  }
  if (archiveManifest.schemaVersion !== ARCHIVE_SCHEMA_VERSION) {
    throw createArchiveError('E_PROJECT_ARCHIVE_SCHEMA_UNSUPPORTED', 'archive_schema_unsupported');
  }
  const declaredEntries = Array.isArray(archiveManifest.entries) ? archiveManifest.entries : [];
  const projectEntries = declaredEntries.map((declared) => {
    const archivePath = normalizeArchivePath(declared?.archivePath || '');
    const relativePath = normalizeArchivePath(declared?.relativePath || '');
    if (archivePath !== normalizeArchivePath(`${PROJECT_ARCHIVE_ROOT}/${relativePath}`)) {
      throw createArchiveError('E_PROJECT_ARCHIVE_PATH_INVALID', 'archive_path_invalid', { archivePath });
    }
    const data = entries.get(archivePath);
    if (!data) {
      throw createArchiveError('E_PROJECT_ARCHIVE_ENTRY_MISSING', 'archive_entry_missing', { archivePath });
    }
    if (data.length !== declared.size || sha256Buffer(data) !== declared.sha256) {
      throw createArchiveError('E_PROJECT_ARCHIVE_CHECKSUM_MISMATCH', 'archive_checksum_mismatch', { archivePath });
    }
    return {
      archivePath,
      relativePath,
      size: data.length,
      sha256: sha256Buffer(data),
      buffer: Buffer.from(data),
    };
  });
  const undeclared = [...entries.keys()]
    .filter((archivePath) => archivePath !== ARCHIVE_MANIFEST_PATH)
    .filter((archivePath) => !projectEntries.some((entry) => entry.archivePath === archivePath));
  if (undeclared.length > 0) {
    throw createArchiveError('E_PROJECT_ARCHIVE_UNDECLARED_ENTRY', 'archive_undeclared_entry', {
      archivePath: undeclared.sort()[0],
    });
  }
  return {
    ok: true,
    manifest: archiveManifest,
    entries: projectEntries,
    entryCount: projectEntries.length,
    archiveSha256: sha256Buffer(buffer),
    fileCount: projectEntries.length,
    byteCount: projectEntries.reduce((sum, entry) => sum + entry.size, 0),
  };
}

async function buildProjectArchiveBuffer(projectRoot, options = {}) {
  const source = await collectProjectArchiveSourceEntries(projectRoot);
  const projectManifest = readManifestFile(source.files);
  const archiveManifest = buildArchiveManifest(source.files, projectManifest, options);
  const archiveManifestBuffer = Buffer.from(`${JSON.stringify(archiveManifest, null, 2)}\n`, 'utf8');
  const zipEntries = [
    {
      archivePath: ARCHIVE_MANIFEST_PATH,
      buffer: archiveManifestBuffer,
    },
    ...source.files.map((entry) => ({
      archivePath: entry.archivePath,
      buffer: entry.buffer,
    })),
  ];
  const archiveBuffer = buildZipArchive(zipEntries);
  const verification = verifyProjectArchiveBuffer(archiveBuffer);
  return {
    ok: true,
    buffer: archiveBuffer,
    manifest: archiveManifest,
    verification,
    fileCount: source.files.length,
    byteCount: source.files.reduce((sum, entry) => sum + entry.size, 0),
  };
}

async function runProjectArchiveExport(payloadRaw = {}, deps = {}) {
  const normalizePayload = deps.normalizeProjectArchiveExportPayload;
  const makeTypedError = deps.makeTypedProjectArchiveExportError;
  if (typeof normalizePayload !== 'function' || typeof makeTypedError !== 'function') {
    throw new Error('Project archive export dependencies are incomplete');
  }
  const payload = normalizePayload(payloadRaw);
  if (!payload || payload.ok === false) {
    return makeTypedError(
      payload?.code || 'E_PROJECT_ARCHIVE_EXPORT_PAYLOAD_INVALID',
      payload?.reason || 'project_archive_export_payload_invalid',
      isPlainObject(payload?.details) ? payload.details : {},
    );
  }
  if (payload.confirmed !== true) {
    return {
      ok: 1,
      preview: true,
      commandId: payload.commandId,
      requestId: payload.requestId,
    };
  }

  let source;
  try {
    source = await deps.readProjectArchiveExportSource();
  } catch (error) {
    return makeTypedError(
      'E_PROJECT_ARCHIVE_EXPORT_SOURCE_UNAVAILABLE',
      typeof error?.reason === 'string' ? error.reason : 'project_archive_source_unavailable',
      { message: typeof error?.message === 'string' ? error.message : 'UNKNOWN' },
    );
  }

  let resolvedPath;
  try {
    resolvedPath = await deps.resolveProjectArchiveExportPath(payload, source);
  } catch (error) {
    return makeTypedError(
      'E_PROJECT_ARCHIVE_EXPORT_SAVE_DIALOG_FAILED',
      'save_dialog_failed',
      { message: typeof error?.message === 'string' ? error.message : 'UNKNOWN' },
    );
  }
  if (resolvedPath?.canceled === true) {
    return {
      ok: 1,
      canceled: true,
      exported: false,
      bytesWritten: 0,
      archiveManifest: null,
    };
  }
  if (resolvedPath?.pathBoundaryError) {
    return makeTypedError(
      'E_PATH_BOUNDARY_VIOLATION',
      'path_boundary_violation',
      isPlainObject(resolvedPath.pathBoundaryError) ? resolvedPath.pathBoundaryError : {},
    );
  }
  if (resolvedPath?.error) {
    return makeTypedError(resolvedPath.error.code, resolvedPath.error.reason, resolvedPath.error.details);
  }
  if (!resolvedPath || !resolvedPath.outPath) {
    return makeTypedError('E_PROJECT_ARCHIVE_EXPORT_PATH_REQUIRED', 'export_path_required');
  }

  const targetCheck = await deps.validateProjectArchiveExportTarget(resolvedPath.outPath, source);
  if (!targetCheck || targetCheck.ok !== true) {
    return makeTypedError(
      targetCheck?.code || 'E_PROJECT_ARCHIVE_EXPORT_TARGET_FORBIDDEN',
      targetCheck?.reason || 'export_target_forbidden',
      isPlainObject(targetCheck?.details) ? targetCheck.details : {},
    );
  }

  try {
    const archive = await buildProjectArchiveBuffer(source.projectRoot, {
      createdAtUtc: payload.createdAtUtc,
    });
    const writeOperation = async () => {
      const secondTargetCheck = await deps.validateProjectArchiveExportTarget(targetCheck.outPath, source);
      if (!secondTargetCheck || secondTargetCheck.ok !== true) {
        throw createArchiveError(
          secondTargetCheck?.code || 'E_PROJECT_ARCHIVE_EXPORT_TARGET_FORBIDDEN',
          secondTargetCheck?.reason || 'export_target_forbidden',
          isPlainObject(secondTargetCheck?.details) ? secondTargetCheck.details : {},
        );
      }
      await deps.writeBufferAtomic(secondTargetCheck.outPath, archive.buffer);
      return true;
    };
    await deps.queueDiskOperation(writeOperation, 'export project archive');
    if (typeof deps.updateStatus === 'function') deps.updateStatus('Архив проекта экспортирован');
    return {
      ok: true,
      exported: true,
      outPath: targetCheck.outPath,
      bytesWritten: archive.buffer.length,
      archiveSha256: archive.verification.archiveSha256,
      archiveManifest: {
        schemaVersion: archive.manifest.schemaVersion,
        archiveKind: archive.manifest.archiveKind,
        projectId: archive.manifest.project.projectId,
        fileCount: archive.fileCount,
        byteCount: archive.byteCount,
        entryCount: archive.manifest.entries.length,
      },
      sourceProjectMutated: false,
      verified: true,
    };
  } catch (error) {
    return makeTypedError(
      typeof error?.code === 'string' ? error.code : 'E_PROJECT_ARCHIVE_EXPORT_FAILED',
      typeof error?.reason === 'string' ? error.reason : 'project_archive_export_failed',
      {
        message: typeof error?.message === 'string' ? error.message : 'UNKNOWN',
        ...(isPlainObject(error?.details) ? error.details : {}),
      },
    );
  }
}

module.exports = {
  ARCHIVE_MANIFEST_PATH,
  ARCHIVE_SCHEMA_VERSION,
  buildProjectArchiveBuffer,
  buildZipArchive,
  collectProjectArchiveSourceEntries,
  crc32,
  normalizeArchivePath,
  readProjectArchivePayload,
  runProjectArchiveExport,
  verifyProjectArchiveBuffer,
};
