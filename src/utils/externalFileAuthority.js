'use strict';

const fs = require('node:fs/promises');
const fsConstants = require('node:fs').constants;
const path = require('node:path');

const { resolveValidatedPath } = require('../core/io/path-boundary');

const EXTERNAL_FILE_AUTHORITY_ERROR = 'E_EXTERNAL_FILE_AUTHORITY';
const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;

function authorityError(reason, details = {}) {
  const error = new Error(reason);
  error.code = EXTERNAL_FILE_AUTHORITY_ERROR;
  error.reason = reason;
  error.details = details && typeof details === 'object' && !Array.isArray(details)
    ? { ...details }
    : {};
  return error;
}

function normalizePath(rawPath, field) {
  if (typeof rawPath !== 'string' || !rawPath.trim()) {
    throw authorityError('EXTERNAL_PATH_REQUIRED', { field });
  }
  try {
    return path.resolve(resolveValidatedPath(rawPath, { mode: 'any' }));
  } catch (error) {
    throw authorityError('EXTERNAL_PATH_INVALID', {
      field,
      nestedReason: typeof error?.failReason === 'string' ? error.failReason : '',
    });
  }
}

function normalizeExtensions(values) {
  return new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .map((value) => (value.startsWith('.') ? value : `.${value}`)));
}

function assertAllowedExtension(filePath, allowedExtensions, field) {
  const extensions = normalizeExtensions(allowedExtensions);
  if (extensions.size === 0) return;
  if (!extensions.has(path.extname(filePath).toLowerCase())) {
    throw authorityError('EXTERNAL_FILE_EXTENSION_DENIED', { field });
  }
}

function normalizeMaxBytes(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_MAX_BYTES;
}

function statValue(stat, field) {
  const value = stat?.[field];
  if (typeof value === 'bigint') return value.toString();
  if (Number.isFinite(value)) return String(Math.trunc(value));
  return '';
}

function statNanoseconds(stat, nsField, msField) {
  const nanoseconds = stat?.[nsField];
  if (typeof nanoseconds === 'bigint') return nanoseconds.toString();
  const milliseconds = Number(stat?.[msField]);
  return Number.isFinite(milliseconds) ? String(Math.round(milliseconds * 1e6)) : '';
}

function statSize(stat) {
  const raw = stat?.size;
  const size = typeof raw === 'bigint' ? Number(raw) : Number(raw);
  return Number.isSafeInteger(size) && size >= 0 ? size : null;
}

function buildIdentity(stat, realPath) {
  const size = statSize(stat);
  if (size === null) {
    throw authorityError('EXTERNAL_FILE_SIZE_INVALID');
  }
  return {
    realPath: path.resolve(realPath),
    dev: statValue(stat, 'dev'),
    ino: statValue(stat, 'ino'),
    mode: statValue(stat, 'mode'),
    size,
    mtimeNs: statNanoseconds(stat, 'mtimeNs', 'mtimeMs'),
    ctimeNs: statNanoseconds(stat, 'ctimeNs', 'ctimeMs'),
  };
}

function sameIdentity(left, right) {
  if (!left || !right) return false;
  return [
    'realPath',
    'dev',
    'ino',
    'mode',
    'size',
    'mtimeNs',
    'ctimeNs',
  ].every((field) => left[field] === right[field]);
}

function isPathInside(parentPath, childPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function comparableDirectoryPath(directoryPath) {
  const resolved = path.resolve(directoryPath);
  try {
    return path.resolve(await fs.realpath(resolved));
  } catch {
    return resolved;
  }
}

async function assertOutsideProject(filePath, realPath, projectRoot, reason) {
  if (typeof projectRoot !== 'string' || !projectRoot.trim()) return;
  const logicalRoot = path.resolve(projectRoot);
  const physicalRoot = await comparableDirectoryPath(logicalRoot);
  if (isPathInside(logicalRoot, filePath) || isPathInside(physicalRoot, realPath)) {
    throw authorityError(reason);
  }
}

async function inspectExternalReadSource(filePathRaw, options = {}) {
  const filePath = normalizePath(filePathRaw, 'sourcePath');
  assertAllowedExtension(filePath, options.allowedExtensions, 'sourcePath');

  let stat;
  try {
    stat = await fs.lstat(filePath, { bigint: true });
  } catch (error) {
    throw authorityError('EXTERNAL_SOURCE_STAT_FAILED', {
      nestedCode: typeof error?.code === 'string' ? error.code : '',
    });
  }
  if (stat.isSymbolicLink()) {
    throw authorityError('EXTERNAL_SOURCE_SYMLINK_DENIED');
  }
  if (!stat.isFile()) {
    throw authorityError('EXTERNAL_SOURCE_FILE_REQUIRED');
  }

  let realPath;
  try {
    realPath = await fs.realpath(filePath);
  } catch (error) {
    throw authorityError('EXTERNAL_SOURCE_REALPATH_FAILED', {
      nestedCode: typeof error?.code === 'string' ? error.code : '',
    });
  }
  await assertOutsideProject(
    filePath,
    realPath,
    options.projectRoot,
    'EXTERNAL_SOURCE_INSIDE_PROJECT_DENIED',
  );

  const identity = buildIdentity(stat, realPath);
  const maxBytes = normalizeMaxBytes(options.maxBytes);
  if (identity.size > maxBytes) {
    throw authorityError('EXTERNAL_SOURCE_TOO_LARGE', {
      maxBytes,
      actualBytes: identity.size,
    });
  }
  if (options.allowEmpty !== true && identity.size === 0) {
    throw authorityError('EXTERNAL_SOURCE_EMPTY');
  }
  if (Number.isSafeInteger(options.expectedBytes) && options.expectedBytes !== identity.size) {
    throw authorityError('EXTERNAL_SOURCE_CHANGED_DURING_READ', {
      expectedBytes: options.expectedBytes,
      actualBytes: identity.size,
    });
  }
  if (options.expectedIdentity && !sameIdentity(options.expectedIdentity, identity)) {
    throw authorityError('EXTERNAL_SOURCE_CHANGED_DURING_READ');
  }

  return { filePath, identity, maxBytes };
}

function openReadFlags() {
  if (process.platform !== 'win32' && Number.isInteger(fsConstants.O_NOFOLLOW)) {
    return fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW;
  }
  return 'r';
}

async function readFileHandleBounded(handle, expectedBytes, maxBytes) {
  const capacity = Math.min(maxBytes + 1, expectedBytes + 1);
  const buffer = Buffer.alloc(capacity);
  let offset = 0;
  while (offset < capacity) {
    const result = await handle.read(buffer, offset, capacity - offset, offset);
    if (!result || result.bytesRead === 0) break;
    offset += result.bytesRead;
  }
  if (offset > maxBytes) {
    throw authorityError('EXTERNAL_SOURCE_TOO_LARGE', {
      maxBytes,
      actualBytes: offset,
    });
  }
  return Buffer.from(buffer.subarray(0, offset));
}

async function readExternalFileBounded(filePathRaw, options = {}) {
  const before = await inspectExternalReadSource(filePathRaw, options);
  let handle;
  try {
    handle = await fs.open(before.filePath, openReadFlags());
  } catch (error) {
    throw authorityError(
      error?.code === 'ELOOP' ? 'EXTERNAL_SOURCE_SYMLINK_DENIED' : 'EXTERNAL_SOURCE_OPEN_FAILED',
      { nestedCode: typeof error?.code === 'string' ? error.code : '' },
    );
  }

  let bytes;
  try {
    const openedStat = await handle.stat({ bigint: true });
    if (!openedStat.isFile()) {
      throw authorityError('EXTERNAL_SOURCE_FILE_REQUIRED');
    }
    const openedIdentity = buildIdentity(openedStat, before.identity.realPath);
    if (!sameIdentity(before.identity, openedIdentity)) {
      throw authorityError('EXTERNAL_SOURCE_CHANGED_DURING_READ');
    }

    bytes = await readFileHandleBounded(handle, before.identity.size, before.maxBytes);
    if (typeof options.afterRead === 'function') {
      await options.afterRead({
        filePath: before.filePath,
        bytesRead: bytes.length,
        identity: { ...before.identity },
      });
    }

    const afterHandleStat = await handle.stat({ bigint: true });
    const afterHandleIdentity = buildIdentity(afterHandleStat, before.identity.realPath);
    if (
      bytes.length !== before.identity.size
      || !sameIdentity(before.identity, afterHandleIdentity)
    ) {
      throw authorityError('EXTERNAL_SOURCE_CHANGED_DURING_READ', {
        expectedBytes: before.identity.size,
        actualBytes: bytes.length,
      });
    }
  } finally {
    await handle.close().catch(() => {});
  }

  let after;
  try {
    after = await inspectExternalReadSource(before.filePath, {
      ...options,
      expectedBytes: before.identity.size,
    });
  } catch (error) {
    if (error?.reason === 'EXTERNAL_SOURCE_TOO_LARGE') throw error;
    throw authorityError('EXTERNAL_SOURCE_CHANGED_DURING_READ', {
      nestedReason: typeof error?.reason === 'string' ? error.reason : '',
    });
  }
  if (!sameIdentity(before.identity, after.identity)) {
    throw authorityError('EXTERNAL_SOURCE_CHANGED_DURING_READ');
  }

  return {
    filePath: before.filePath,
    bytes,
    byteLength: bytes.length,
    identity: { ...before.identity },
  };
}

async function resolvePhysicalCandidate(targetPath) {
  let probe = path.resolve(targetPath);
  const missingSegments = [];
  while (true) {
    try {
      const stat = await fs.lstat(probe, { bigint: true });
      if (missingSegments.length > 0 && !stat.isDirectory()) {
        throw authorityError('EXTERNAL_TARGET_PARENT_DIRECTORY_REQUIRED');
      }
      const realProbe = await fs.realpath(probe);
      return {
        existingPath: probe,
        existingStat: stat,
        physicalPath: path.resolve(realProbe, ...missingSegments),
        targetExists: missingSegments.length === 0,
      };
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      const parent = path.dirname(probe);
      if (parent === probe) {
        throw authorityError('EXTERNAL_TARGET_PARENT_DIRECTORY_REQUIRED');
      }
      missingSegments.unshift(path.basename(probe));
      probe = parent;
    }
  }
}

async function comparableFilePath(filePathRaw) {
  const filePath = normalizePath(filePathRaw, 'protectedPath');
  const resolved = await resolvePhysicalCandidate(filePath);
  return {
    logicalPath: filePath,
    physicalPath: resolved.physicalPath,
  };
}

async function validateExternalWriteTarget(targetPathRaw, options = {}) {
  const targetPath = normalizePath(targetPathRaw, 'targetPath');
  assertAllowedExtension(targetPath, options.allowedExtensions, 'targetPath');

  let physical;
  try {
    physical = await resolvePhysicalCandidate(targetPath);
  } catch (error) {
    if (error?.code === EXTERNAL_FILE_AUTHORITY_ERROR) throw error;
    throw authorityError('EXTERNAL_TARGET_STAT_FAILED', {
      nestedCode: typeof error?.code === 'string' ? error.code : '',
    });
  }
  if (physical.targetExists) {
    if (physical.existingStat.isSymbolicLink()) {
      throw authorityError('EXTERNAL_TARGET_SYMLINK_DENIED');
    }
    if (!physical.existingStat.isFile()) {
      throw authorityError('EXTERNAL_TARGET_FILE_REQUIRED');
    }
  }

  await assertOutsideProject(
    targetPath,
    physical.physicalPath,
    options.projectRoot,
    'EXTERNAL_TARGET_INSIDE_PROJECT_DENIED',
  );

  const protectedPaths = [
    ...(Array.isArray(options.sourcePaths) ? options.sourcePaths : []),
    ...(Array.isArray(options.protectedPaths) ? options.protectedPaths : []),
  ];
  for (const protectedPathRaw of protectedPaths) {
    if (typeof protectedPathRaw !== 'string' || !protectedPathRaw.trim()) continue;
    const protectedPath = await comparableFilePath(protectedPathRaw);
    if (
      targetPath === protectedPath.logicalPath
      || physical.physicalPath === protectedPath.physicalPath
    ) {
      throw authorityError('EXTERNAL_TARGET_MATCHES_PROTECTED_SOURCE');
    }
  }

  return {
    ok: true,
    targetPath,
    physicalPath: physical.physicalPath,
    targetExists: physical.targetExists,
  };
}

module.exports = {
  DEFAULT_MAX_BYTES,
  EXTERNAL_FILE_AUTHORITY_ERROR,
  inspectExternalReadSource,
  readExternalFileBounded,
  sameIdentity,
  validateExternalWriteTarget,
};
