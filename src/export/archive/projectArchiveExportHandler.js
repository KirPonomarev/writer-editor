'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { constants: fsConstants } = require('node:fs');
const path = require('node:path');
const { assertNoFollowComponents } = require('../../core/io/path-capability-v1.cjs');

const ARCHIVE_SCHEMA_VERSION = 'yalken-project-archive.v1';
const ARCHIVE_MANIFEST_PATH = 'yalken-archive-manifest.v1.json';
// Historical V1 exports are also consumed by the closed Core WP704 profile.
// Only the physical-snapshot writer below selects the new topology carrier.
const ARCHIVE_SCHEMA_VERSION_V2 = 'yalken-project-archive.v2';
const ARCHIVE_MANIFEST_PATH_V2 = 'yalken-archive-manifest.v2.json';
const ARCHIVE_MAX_BYTES = 256 * 1024 * 1024;
const PROJECT_ARCHIVE_ROOT = 'project';
const PROJECT_MANIFEST_FILENAME = 'project.craftsman.json';
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;

let crc32Table = null;
const sealedSources = new WeakMap();

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
  // Validate external spelling before normalization can erase ambiguity.
  if (rawPath.includes('\\') || /[\u0000-\u001f\u007f]/u.test(rawPath)
    || rawPath.startsWith('/') || /^[a-zA-Z]:/u.test(rawPath) || rawPath.trim() !== rawPath
    || rawPath.startsWith(PROJECT_ARCHIVE_ROOT + '/') && rawPath.slice(PROJECT_ARCHIVE_ROOT.length + 1).trim() !== rawPath.slice(PROJECT_ARCHIVE_ROOT.length + 1)) {
    throw createArchiveError('E_PROJECT_ARCHIVE_PATH_INVALID', 'archive_path_invalid');
  }
  const normalized = rawPath;
  const parts = normalized.split('/');
  if (
    parts.length === 0
    || parts.some((part) => !part || part === '.' || part === '..')
    || path.posix.isAbsolute(normalized)
  ) {
    throw createArchiveError('E_PROJECT_ARCHIVE_PATH_INVALID', 'archive_path_invalid', { archivePath: rawPath });
  }
  return parts.join('/');
}

function archivePathRegistry() {
  // Component nodes avoid copying every full prefix of an untrusted deep name.
  const root = { children: new Map() };
  return (raw, type = 'file') => {
    const name = normalizeArchivePath(raw);
    const parts = name.split('/');
    let parent = root;
    for (let i = 1; i <= parts.length; i += 1) {
      const spelling = parts[i - 1], key = spelling.normalize('NFC').toLowerCase();
      const previous = parent.children.get(key);
      if (previous && previous.spelling !== spelling) throw createArchiveError('E_PROJECT_ARCHIVE_PATH_COLLISION', 'archive_path_collision');
      const terminal = i === parts.length;
      if (previous?.type === 'file' && (!terminal || type !== 'file')
        || terminal && type === 'file' && previous?.type === 'directory') {
        throw createArchiveError('E_PROJECT_ARCHIVE_PATH_CONFLICT', 'archive_path_conflict');
      }
      if (terminal && previous?.explicit) throw createArchiveError('E_PROJECT_ARCHIVE_DUPLICATE_ENTRY', 'archive_duplicate_entry');
      // A physical directory may follow its implicit file parent exactly once.
      const node = { spelling, type: terminal ? type : 'directory',
        explicit: terminal || previous?.explicit === true, children: previous?.children || new Map() };
      parent.children.set(key, node); parent = node;
    }
    return name;
  };
}

function compareArchiveEntries(left, right) {
  return left.archivePath.localeCompare(right.archivePath, 'en');
}

async function collectProjectArchiveSourceEntries(projectRootRaw) {
  if (typeof projectRootRaw !== 'string' || !projectRootRaw.trim() || !path.isAbsolute(projectRootRaw)) {
    throw createArchiveError('E_PROJECT_ARCHIVE_ROOT_INVALID', 'project_archive_root_invalid');
  }
  const requestedRoot = path.resolve(String(projectRootRaw || ''));
  const projectRoot = await fs.realpath(requestedRoot);
  if (!projectRoot || projectRoot === path.parse(projectRoot).root) {
    throw createArchiveError('E_PROJECT_ARCHIVE_ROOT_INVALID', 'project_archive_root_invalid');
  }
  const rootStat = await fs.lstat(requestedRoot).catch((error) => {
    throw createArchiveError('E_PROJECT_ARCHIVE_ROOT_UNREADABLE', 'project_archive_root_unreadable', {
      nestedCode: typeof error?.code === 'string' ? error.code : '',
    });
  });
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw createArchiveError('E_PROJECT_ARCHIVE_ROOT_INVALID', 'project_archive_root_invalid');
  }

  assertNoFollowComponents(projectRoot);
  const identity = stat => ['dev', 'ino', 'mode', 'nlink', 'size', 'mtimeNs', 'ctimeNs'].map(key => String(stat[key])).join(':');
  const stale = () => createArchiveError('E_PROJECT_ARCHIVE_SOURCE_CHANGED', 'project_archive_source_changed');
  async function roster() {
    const rows = [];
    async function visit(directoryPath, relativeParts = []) {
      const directoryStat = await fs.lstat(directoryPath, { bigint: true });
      if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw stale();
      rows.push({ relativePath: relativeParts.join('/'), type: 'directory', identity: identity(directoryStat) });
      const dirents = await fs.readdir(directoryPath, { withFileTypes: true }).catch((error) => {
        throw createArchiveError('E_PROJECT_ARCHIVE_READ_FAILED', 'project_archive_read_failed', {
          nestedCode: typeof error?.code === 'string' ? error.code : '',
        });
      });
      for (const dirent of dirents.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
        if (dirent.name === '.' || dirent.name === '..' || dirent.name.includes('\0')) {
          throw createArchiveError('E_PROJECT_ARCHIVE_PATH_INVALID', 'archive_path_invalid');
        }
        const childPath = path.join(directoryPath, dirent.name);
        const relative = [...relativeParts, dirent.name];
        const relativePath = normalizeArchivePath(relative.join('/'));
        const archivePath = normalizeArchivePath(`${PROJECT_ARCHIVE_ROOT}/${relativePath}`);
        const stat = await fs.lstat(childPath, { bigint: true });
        if (stat.isSymbolicLink()) {
          throw createArchiveError('E_PROJECT_ARCHIVE_SYMLINK_DENIED', 'project_archive_symlink_denied', { archivePath });
        }
        if (stat.isDirectory()) {
          await visit(childPath, relative);
        } else if (stat.isFile()) {
          if (stat.nlink !== 1n || stat.size > 0xffffffffn) throw createArchiveError('E_PROJECT_ARCHIVE_SOURCE_UNSUPPORTED', 'project_archive_source_unsupported');
          rows.push({ archivePath, relativePath, type: 'file', size: Number(stat.size), identity: identity(stat) });
        } else throw createArchiveError('E_PROJECT_ARCHIVE_SOURCE_UNSUPPORTED', 'project_archive_source_unsupported');
      }
    }
    await visit(projectRoot);
    return rows;
  }
  // Finish the WHOLE initial roster before reading any content. Per-file
  // stat/read/stat alone cannot establish a common capture interval.
  const before = await roster(), files = [];
  const directories = before.filter(row => row.type === 'directory' && row.relativePath)
    .map(row => ({ type: 'directory', relativePath: row.relativePath,
      archivePath: `${PROJECT_ARCHIVE_ROOT}/${row.relativePath}/` }));
  if (before.length > 0xffff || before.filter(row => row.type === 'file')
    .reduce((sum, row) => sum + row.size, 0) > ARCHIVE_MAX_BYTES) {
    throw createArchiveError('E_PROJECT_ARCHIVE_LIMIT', 'archive_size_or_count_limit');
  }
  const registerPath = archivePathRegistry();
  for (const row of before.filter(row => row.relativePath)) registerPath(`${PROJECT_ARCHIVE_ROOT}/${row.relativePath}`, row.type);
  for (const entry of before.filter(row => row.type === 'file')) {
    const childPath = path.join(projectRoot, entry.relativePath);
    assertNoFollowComponents(childPath);
    const handle = await fs.open(childPath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0) | (fsConstants.O_NONBLOCK || 0));
    try {
      if (identity(await handle.stat({ bigint: true })) !== entry.identity) throw stale();
      const buffer = await handle.readFile();
      if (identity(await handle.stat({ bigint: true })) !== entry.identity
        || identity(await fs.lstat(childPath, { bigint: true })) !== entry.identity) throw stale();
      files.push({ archivePath: entry.archivePath, relativePath: entry.relativePath,
        size: buffer.length, sha256: sha256Buffer(buffer), buffer });
    } finally { await handle.close(); }
  }
  if (JSON.stringify(before) !== JSON.stringify(await roster()) || await fs.realpath(requestedRoot) !== projectRoot) throw stale();
  files.sort(compareArchiveEntries);
  const exposed = files.map(({ buffer, ...metadata }) => Object.freeze({ ...metadata, get buffer() { return Buffer.from(buffer); } }));
  directories.sort(compareArchiveEntries);
  const snapshot = Object.freeze({ projectRoot, files: Object.freeze(exposed),
    directories: Object.freeze(directories.map(row => Object.freeze({ ...row }))) });
  sealedSources.set(snapshot, { projectRoot, files, directories });
  return snapshot;
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

function buildArchiveManifest(files, directories, manifest, options = {}) {
  const projectId = typeof manifest?.projectId === 'string' ? manifest.projectId : '';
  const projectName = typeof manifest?.projectName === 'string' ? manifest.projectName : '';
  if (!projectId) {
    throw createArchiveError('E_PROJECT_ARCHIVE_PROJECT_ID_MISSING', 'project_id_missing');
  }
  return {
    schemaVersion: ARCHIVE_SCHEMA_VERSION_V2,
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
      type: 'file',
      archivePath: entry.archivePath,
      relativePath: entry.relativePath,
      size: entry.size,
      sha256: entry.sha256,
    })),
    directories: directories.map(row => ({ ...row })),
  };
}

function makeZipEntry(archivePath, buffer, type = 'file') {
  const directory = type === 'directory';
  if (!['file', 'directory'].includes(type) || directory && !archivePath.endsWith('/')) {
    throw createArchiveError('E_PROJECT_ARCHIVE_ENTRY_TYPE', 'archive_entry_type_invalid');
  }
  const name = Buffer.from(normalizeArchivePath(directory ? archivePath.slice(0, -1) : archivePath) + (directory ? '/' : ''), 'utf8');
  const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
  if (directory && body.length) throw createArchiveError('E_PROJECT_ARCHIVE_ENTRY_TYPE', 'archive_directory_payload');
  if (name.length > 0xffff || body.length > ARCHIVE_MAX_BYTES) throw createArchiveError('E_PROJECT_ARCHIVE_LIMIT', 'archive_size_or_count_limit');
  const hash = crc32(body);
  const { dosTime, dosDate } = dosDateTime(new Date('2026-01-01T00:00:00.000Z'));
  return {
    name,
    directory,
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
  if (rawEntries.length > 0xffff) throw createArchiveError('E_PROJECT_ARCHIVE_LIMIT', 'archive_size_or_count_limit');
  const entries = rawEntries.map((entry) => makeZipEntry(entry.archivePath, entry.buffer, entry.type));
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
      writeUInt32(entry.directory ? 0x10 : 0),
      writeUInt32(offset),
      entry.name,
    ]);
    centralParts.push(centralHeader);
    offset += localHeader.length + entry.body.length;
    if (offset > ARCHIVE_MAX_BYTES) throw createArchiveError('E_PROJECT_ARCHIVE_LIMIT', 'archive_size_or_count_limit');
  }

  const centralDirectory = Buffer.concat(centralParts);
  if (offset + centralDirectory.length + 22 > ARCHIVE_MAX_BYTES) throw createArchiveError('E_PROJECT_ARCHIVE_LIMIT', 'archive_size_or_count_limit');
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
  if (buffer.length > ARCHIVE_MAX_BYTES) throw createArchiveError('E_PROJECT_ARCHIVE_LIMIT', 'archive_size_or_count_limit');
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const count = buffer.readUInt16LE(eocdOffset + 10);
  const centralSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (centralOffset + centralSize !== eocdOffset || eocdOffset + 22 + buffer.readUInt16LE(eocdOffset + 20) !== buffer.length
    || buffer.readUInt16LE(eocdOffset + 4) !== 0 || buffer.readUInt16LE(eocdOffset + 6) !== 0) {
    throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_CORRUPT', 'zip_central_directory_invalid');
  }
  if (buffer.readUInt16LE(eocdOffset + 8) !== count) throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_CORRUPT', 'zip_central_count_mismatch');

  const entries = new Map();
  const types = new Map(), localRanges = [];
  const registerPath = archivePathRegistry();
  let cursor = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_CORRUPT', 'zip_central_entry_invalid');
    }
    const method = buffer.readUInt16LE(cursor + 10);
    const flags = buffer.readUInt16LE(cursor + 8), attributes = buffer.readUInt32LE(cursor + 38);
    const expectedCrc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    if (cursor + 46 + nameLength + extraLength + commentLength > centralOffset + centralSize) {
      throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_CORRUPT', 'zip_central_entry_invalid');
    }
    let name;
    try { name = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(cursor + 46, cursor + 46 + nameLength)); }
    catch { throw createArchiveError('E_PROJECT_ARCHIVE_PATH_INVALID', 'archive_path_invalid'); }
    const directory = name.endsWith('/'), mode = (attributes >>> 16) & 0xf000;
    if (attributes & 0x08 || (directory ? !(attributes & 0x10) || mode && mode !== 0x4000 : (attributes & 0x10) || mode && mode !== 0x8000)
      || directory && (compressedSize !== 0 || uncompressedSize !== 0 || expectedCrc !== 0)) {
      throw createArchiveError('E_PROJECT_ARCHIVE_ENTRY_TYPE', 'archive_entry_type_invalid');
    }
    const type = directory ? 'directory' : 'file';
    const canonicalPath = registerPath(directory ? name.slice(0, -1) : name, type);
    const archivePath = canonicalPath + (directory ? '/' : '');
    if (flags & ~0x0800) throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_UNSUPPORTED', 'zip_entry_flags_unsupported');
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
    if (buffer.readUInt16LE(localOffset + 6) !== flags || buffer.readUInt16LE(localOffset + 8) !== method
      || buffer.readUInt32LE(localOffset + 14) !== expectedCrc
      || buffer.readUInt32LE(localOffset + 18) !== compressedSize || buffer.readUInt32LE(localOffset + 22) !== uncompressedSize) {
      throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_CORRUPT', 'zip_local_metadata_mismatch');
    }
    if (!buffer.subarray(localOffset + 30, localOffset + 30 + localNameLength)
      .equals(buffer.subarray(cursor + 46, cursor + 46 + nameLength))) {
      throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_CORRUPT', 'zip_local_name_mismatch');
    }
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataOffset + compressedSize;
    if (dataEnd > centralOffset) {
      throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_CORRUPT', 'zip_entry_truncated', { archivePath });
    }
    const data = buffer.subarray(dataOffset, dataEnd);
    if (crc32(data) !== expectedCrc) {
      throw createArchiveError('E_PROJECT_ARCHIVE_CHECKSUM_MISMATCH', 'zip_crc_mismatch', { archivePath });
    }
    entries.set(archivePath, Buffer.from(data));
    types.set(archivePath, type); localRanges.push([localOffset, dataEnd]);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor !== centralOffset + centralSize) {
    throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_CORRUPT', 'zip_central_count_mismatch');
  }
  let end = 0;
  for (const range of localRanges.sort((a, b) => a[0] - b[0])) {
    if (range[0] !== end) throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_CORRUPT', 'zip_local_roster_mismatch');
    end = range[1];
  }
  if (end !== centralOffset) throw createArchiveError('E_PROJECT_ARCHIVE_ZIP_CORRUPT', 'zip_local_roster_mismatch');
  return { entries, types };
}

function readArchiveManifest(entries) {
  if (entries.has(ARCHIVE_MANIFEST_PATH) && entries.has(ARCHIVE_MANIFEST_PATH_V2)) {
    throw createArchiveError('E_PROJECT_ARCHIVE_SCHEMA_UNSUPPORTED', 'archive_manifest_conflict');
  }
  const manifestPath = entries.has(ARCHIVE_MANIFEST_PATH_V2) ? ARCHIVE_MANIFEST_PATH_V2 : ARCHIVE_MANIFEST_PATH;
  const bytes = entries.get(manifestPath);
  if (!bytes) throw createArchiveError('E_PROJECT_ARCHIVE_MANIFEST_MISSING', 'archive_manifest_missing');
  let manifest;
  try { manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw createArchiveError('E_PROJECT_ARCHIVE_MANIFEST_CORRUPT', 'archive_manifest_corrupt'); }
  if (!isPlainObject(manifest) || manifest.schemaVersion !== (manifestPath === ARCHIVE_MANIFEST_PATH_V2 ? ARCHIVE_SCHEMA_VERSION_V2 : ARCHIVE_SCHEMA_VERSION)) {
    throw createArchiveError('E_PROJECT_ARCHIVE_SCHEMA_UNSUPPORTED', 'archive_schema_unsupported');
  }
  if (manifestPath === ARCHIVE_MANIFEST_PATH_V2 && !bytes.equals(Buffer.from(JSON.stringify(manifest, null, 2) + '\n'))) {
    throw createArchiveError('E_PROJECT_ARCHIVE_MANIFEST_CORRUPT', 'archive_manifest_noncanonical');
  }
  return manifest;
}

function readV2Payload(buffer, entries, types, manifest) {
  const invalid = reason => { throw createArchiveError('E_PROJECT_ARCHIVE_MANIFEST_CORRUPT', reason); };
  const exact = (value, keys) => isPlainObject(value) && Object.keys(value).sort().join(',') === keys.slice().sort().join(',');
  if (!exact(manifest, ['schemaVersion', 'archiveKind', 'createdAtUtc', 'project', 'source', 'entries', 'directories'])
    || manifest.archiveKind !== 'full-project' || typeof manifest.createdAtUtc !== 'string'
    || !exact(manifest.project, ['projectId', 'projectName', 'manifestSha256'])
    || typeof manifest.project.projectId !== 'string' || !manifest.project.projectId || manifest.project.projectId.length > 256
    || typeof manifest.project.projectName !== 'string'
    || !exact(manifest.source, ['localOnly', 'networkRequired', 'pathlessReceipt', 'sourceProjectMutated'])
    || manifest.source.localOnly !== true || manifest.source.networkRequired !== false
    || manifest.source.pathlessReceipt !== true || manifest.source.sourceProjectMutated !== false
    || !Array.isArray(manifest.entries) || !manifest.entries.length || !Array.isArray(manifest.directories)) invalid('archive_manifest_shape');
  if (manifest.entries.length + manifest.directories.length + 1 !== entries.size) invalid('archive_roster_mismatch');
  const register = archivePathRegistry(), declared = new Set([ARCHIVE_MANIFEST_PATH_V2]);
  const directories = manifest.directories.map(row => {
    if (!exact(row, ['type', 'relativePath', 'archivePath']) || row.type !== 'directory') invalid('archive_directory_shape');
    const relativePath = normalizeArchivePath(row.relativePath);
    if (row.archivePath !== `${PROJECT_ARCHIVE_ROOT}/${relativePath}/`) invalid('archive_directory_path');
    register(`${PROJECT_ARCHIVE_ROOT}/${relativePath}`, 'directory'); declared.add(row.archivePath);
    if (types.get(row.archivePath) !== 'directory' || entries.get(row.archivePath)?.length !== 0) invalid('archive_directory_missing');
    return { type: 'directory', relativePath, archivePath: row.archivePath };
  });
  const files = manifest.entries.map(row => {
    if (!exact(row, ['type', 'relativePath', 'archivePath', 'size', 'sha256']) || row.type !== 'file'
      || !Number.isSafeInteger(row.size) || row.size < 0 || row.size > 0xffffffff || !/^[a-f0-9]{64}$/u.test(row.sha256)) invalid('archive_file_shape');
    const relativePath = normalizeArchivePath(row.relativePath), archivePath = register(row.archivePath, 'file');
    if (archivePath !== `${PROJECT_ARCHIVE_ROOT}/${relativePath}`) invalid('archive_file_path');
    const data = entries.get(archivePath);
    if (types.get(archivePath) !== 'file' || !data) invalid('archive_file_missing');
    if (data.length !== row.size || sha256Buffer(data) !== row.sha256) {
      throw createArchiveError('E_PROJECT_ARCHIVE_CHECKSUM_MISMATCH', 'archive_checksum_mismatch');
    }
    declared.add(archivePath);
    return { ...row, buffer: Buffer.from(data) };
  });
  const directoryNames = new Set(directories.map(row => row.relativePath));
  for (const row of [...directories, ...files]) {
    const parts = row.relativePath.split('/');
    for (let i = 1; i < parts.length; i++) if (!directoryNames.has(parts.slice(0, i).join('/'))) invalid('archive_directory_ancestor_missing');
  }
  if ([...entries.keys()].some(name => !declared.has(name))) invalid('archive_undeclared_entry');
  const projectFile = files.find(row => row.relativePath === PROJECT_MANIFEST_FILENAME);
  if (!projectFile || projectFile.sha256 !== manifest.project.manifestSha256) invalid('archive_project_manifest_binding');
  let project;
  try { project = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(projectFile.buffer)); }
  catch { invalid('archive_project_manifest_invalid'); }
  if (project?.projectId !== manifest.project.projectId || (typeof project.projectName === 'string' ? project.projectName : '') !== manifest.project.projectName) invalid('archive_project_manifest_binding');
  return { ok: true, manifest, entries: files, directories, directoryCoverage: 'COMPLETE_PHYSICAL_ROSTER',
    entryCount: files.length + directories.length, fileCount: files.length, directoryCount: directories.length,
    archiveSha256: sha256Buffer(buffer), byteCount: files.reduce((sum, row) => sum + row.size, 0) };
}

function verifyProjectArchiveBuffer(buffer) {
  const { entries, types } = readZipStoredEntries(buffer);
  const parsed = readArchiveManifest(entries);
  if (parsed.schemaVersion === ARCHIVE_SCHEMA_VERSION_V2) {
    const payload = readV2Payload(buffer, entries, types, parsed);
    return { ok: true, manifest: parsed, entryCount: payload.entryCount, directoryCount: payload.directoryCount,
      fileCount: payload.fileCount, archiveSha256: payload.archiveSha256 };
  }
  // Deliberately preserve the historical V1 verification envelope. Strict
  // extraction is readProjectArchivePayload; WP704 distinguishes the two.
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
  const { entries, types } = readZipStoredEntries(buffer);
  const parsed = readArchiveManifest(entries);
  if (parsed.schemaVersion === ARCHIVE_SCHEMA_VERSION_V2) return readV2Payload(buffer, entries, types, parsed);
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
  const registerDeclared = archivePathRegistry();
  const projectEntries = declaredEntries.map((declared) => {
    const archivePath = registerDeclared(declared?.archivePath || '');
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
  const parents = new Set();
  for (const entry of projectEntries) {
    const parts = entry.relativePath.split('/');
    for (let i = 1; i < parts.length; i++) parents.add(parts.slice(0, i).join('/'));
  }
  return {
    ok: true,
    manifest: archiveManifest,
    entries: projectEntries,
    directories: [...parents].sort().map(relativePath => ({ type: 'directory', relativePath,
      archivePath: `${PROJECT_ARCHIVE_ROOT}/${relativePath}/` })),
    directoryCount: parents.size,
    directoryCoverage: 'FILE_PARENTS_ONLY',
    entryCount: projectEntries.length,
    archiveSha256: sha256Buffer(buffer),
    fileCount: projectEntries.length,
    byteCount: projectEntries.reduce((sum, entry) => sum + entry.size, 0),
  };
}

async function buildProjectArchiveBuffer(projectRoot, options = {}) {
  return buildProjectArchiveFromSnapshot(await collectProjectArchiveSourceEntries(projectRoot), options);
}

function buildProjectArchiveFromSnapshot(snapshot, options = {}) {
  const source = sealedSources.get(snapshot);
  if (!source) throw createArchiveError('E_PROJECT_ARCHIVE_SNAPSHOT_REQUIRED', 'project_archive_owned_snapshot_required');
  const projectManifest = readManifestFile(source.files);
  const archiveManifest = buildArchiveManifest(source.files, source.directories, projectManifest, options);
  const archiveManifestBuffer = Buffer.from(`${JSON.stringify(archiveManifest, null, 2)}\n`, 'utf8');
  const zipEntries = [
    {
      archivePath: ARCHIVE_MANIFEST_PATH_V2,
      buffer: archiveManifestBuffer,
    },
    ...source.files.map((entry) => ({
      archivePath: entry.archivePath,
      buffer: entry.buffer,
    })),
    ...source.directories.map(entry => ({ archivePath: entry.archivePath, type: 'directory', buffer: Buffer.alloc(0) })),
  ];
  const archiveBuffer = buildZipArchive(zipEntries);
  const verification = verifyProjectArchiveBuffer(archiveBuffer);
  return {
    ok: true,
    buffer: archiveBuffer,
    manifest: archiveManifest,
    verification,
    fileCount: source.files.length,
    directoryCount: source.directories.length,
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
    const snapshot = typeof deps.captureProjectArchiveSource === 'function'
      ? await deps.captureProjectArchiveSource(source)
      : await deps.queueDiskOperation(() => collectProjectArchiveSourceEntries(source.projectRoot), 'capture project archive');
    const archive = buildProjectArchiveFromSnapshot(snapshot, {
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
      if (typeof source.assertPublication === 'function') await source.assertPublication();
      const publish = deps.publishProjectArchiveOutput || require('../../main/projectArchiveOutputPublication.cjs').publishProjectArchiveOutput;
      return publish({ outPath: secondTargetCheck.outPath, buffer: archive.buffer,
        assertCurrent: source.assertPublication, signal: deps.signal });
    };
    const output = await deps.queueDiskOperation(writeOperation, 'export project archive');
    if (typeof deps.updateStatus === 'function') deps.updateStatus('Архив проекта экспортирован');
    return {
      ok: true,
      exported: true,
      outPath: targetCheck.outPath,
      bytesWritten: archive.buffer.length,
      archiveSha256: output.archiveSha256,
      archiveManifest: {
        schemaVersion: archive.manifest.schemaVersion,
        archiveKind: archive.manifest.archiveKind,
        projectId: archive.manifest.project.projectId,
        fileCount: archive.fileCount,
        directoryCount: archive.directoryCount,
        byteCount: archive.byteCount,
        entryCount: archive.manifest.entries.length + archive.directoryCount,
      },
      sourceProjectMutated: false,
      verified: output.publication?.readbackVerified === true,
      publication: output.publication,
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
  ARCHIVE_SCHEMA_VERSION_V2,
  ARCHIVE_MANIFEST_PATH_V2,
  buildProjectArchiveBuffer,
  buildProjectArchiveFromSnapshot,
  buildZipArchive,
  collectProjectArchiveSourceEntries,
  crc32,
  normalizeArchivePath,
  readProjectArchivePayload,
  runProjectArchiveExport,
  verifyProjectArchiveBuffer,
};
