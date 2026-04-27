'use strict';

function isPlainObjectValue(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getErrorMessage(error) {
  return error && typeof error.message === 'string' ? error.message : 'UNKNOWN';
}

function requireDependency(deps, name) {
  const value = deps && deps[name];
  if (typeof value !== 'function') {
    throw new Error(`E_DOCX_EXPORT_HANDLER_DEP_MISSING:${name}`);
  }
  return value;
}

function normalizeCanonicalExportSnapshot(payload) {
  if (typeof payload === 'string') {
    return {
      content: payload,
      plainText: payload,
      bookProfile: null,
    };
  }

  const source = isPlainObjectValue(payload) ? payload : {};
  const content = typeof source.content === 'string'
    ? source.content
    : typeof source.text === 'string'
      ? source.text
      : '';
  if (!content) {
    return null;
  }

  return {
    content,
    plainText: typeof source.plainText === 'string' ? source.plainText : content,
    bookProfile: isPlainObjectValue(source.bookProfile) ? source.bookProfile : null,
  };
}

async function runDocxMinExport(payloadRaw, deps = {}) {
  const normalizeExportPayload = requireDependency(deps, 'normalizeExportPayload');
  const makeTypedExportError = requireDependency(deps, 'makeTypedExportError');
  const resolveDocxExportPath = requireDependency(deps, 'resolveDocxExportPath');
  const readCanonicalExportSnapshot = requireDependency(deps, 'readCanonicalExportSnapshot');
  const buildDocxMinBuffer = requireDependency(deps, 'buildDocxMinBuffer');
  const queueDiskOperation = requireDependency(deps, 'queueDiskOperation');
  const writeBufferAtomic = requireDependency(deps, 'writeBufferAtomic');
  const updateStatus = requireDependency(deps, 'updateStatus');
  const buildPathBoundaryDetails = typeof deps.buildPathBoundaryDetails === 'function'
    ? deps.buildPathBoundaryDetails
    : (error) => error;

  const payload = normalizeExportPayload(payloadRaw);
  if (!payload) {
    return makeTypedExportError('E_EXPORT_PAYLOAD_INVALID', 'PAYLOAD_INVALID');
  }
  if (payload.pathBoundaryError) {
    return makeTypedExportError(
      'E_PATH_BOUNDARY_VIOLATION',
      'PATH_BOUNDARY_VIOLATION',
      buildPathBoundaryDetails(payload.pathBoundaryError),
    );
  }

  let outPath = '';
  try {
    outPath = await resolveDocxExportPath(payload);
  } catch (error) {
    return makeTypedExportError('E_EXPORT_DIALOG_FAILED', 'EXPORT_DIALOG_FAILED', {
      message: getErrorMessage(error),
    });
  }
  if (!outPath) {
    return makeTypedExportError('E_EXPORT_CANCELED', 'EXPORT_DIALOG_CANCELED', {
      requestId: payload.requestId,
    });
  }

  let editorSnapshot;
  try {
    editorSnapshot = normalizeCanonicalExportSnapshot(await readCanonicalExportSnapshot(payload));
  } catch (error) {
    return makeTypedExportError('E_EXPORT_CANONICAL_SOURCE_UNAVAILABLE', 'CANONICAL_SOURCE_UNAVAILABLE', {
      message: getErrorMessage(error),
    });
  }
  if (!editorSnapshot) {
    return makeTypedExportError('E_EXPORT_CANONICAL_SOURCE_INVALID', 'CANONICAL_SOURCE_INVALID');
  }

  let documentBuffer;
  try {
    documentBuffer = await buildDocxMinBuffer(editorSnapshot);
  } catch (error) {
    return makeTypedExportError('E_EXPORT_BUILD_FAILED', 'DOCX_BUILD_FAILED', {
      message: getErrorMessage(error),
    });
  }

  try {
    await queueDiskOperation(() => writeBufferAtomic(outPath, documentBuffer), 'export docx min');
    updateStatus('DOCX MIN экспортирован');
    return {
      ok: 1,
      outPath,
      bytesWritten: documentBuffer.length,
    };
  } catch (error) {
    return makeTypedExportError('E_EXPORT_WRITE_FAILED', 'DOCX_WRITE_FAILED', {
      message: getErrorMessage(error),
      outPath,
    });
  }
}

module.exports = {
  runDocxMinExport,
};
