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

async function runDocxMinExport(payloadRaw, deps = {}) {
  const normalizeExportPayload = requireDependency(deps, 'normalizeExportPayload');
  const makeTypedExportError = requireDependency(deps, 'makeTypedExportError');
  const resolveDocxExportPath = requireDependency(deps, 'resolveDocxExportPath');
  const requestEditorSnapshot = requireDependency(deps, 'requestEditorSnapshot');
  const buildDocxMinBuffer = requireDependency(deps, 'buildDocxMinBuffer');
  const queueDiskOperation = requireDependency(deps, 'queueDiskOperation');
  const writeBufferAtomic = requireDependency(deps, 'writeBufferAtomic');
  const updateStatus = requireDependency(deps, 'updateStatus');
  const buildPathBoundaryDetails = typeof deps.buildPathBoundaryDetails === 'function'
    ? deps.buildPathBoundaryDetails
    : (error) => error;
  const enrichRevisionBridgeExportSnapshot = typeof deps.enrichRevisionBridgeExportSnapshot === 'function'
    ? deps.enrichRevisionBridgeExportSnapshot
    : null;
  const evaluateRevisionBridgeExportRuntimeSnapshot = typeof deps.evaluateRevisionBridgeExportRuntimeSnapshot === 'function'
    ? deps.evaluateRevisionBridgeExportRuntimeSnapshot
    : null;
  const buildRevisionBridgeExportManifest = typeof deps.buildRevisionBridgeExportManifest === 'function'
    ? deps.buildRevisionBridgeExportManifest
    : null;

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

  let editorSnapshot = payload.bufferSource
    ? {
      content: payload.bufferSource,
      plainText: payload.bufferSource,
      bookProfile: isPlainObjectValue(payload.options.bookProfile) ? payload.options.bookProfile : null,
    }
    : null;
  if (!editorSnapshot) {
    try {
      editorSnapshot = await requestEditorSnapshot();
    } catch (error) {
      return makeTypedExportError('E_EXPORT_TEXT_UNAVAILABLE', 'EDITOR_TEXT_UNAVAILABLE', {
        message: getErrorMessage(error),
      });
    }
  }

  let revisionBridge = null;
  let exportSnapshot = editorSnapshot;
  if (enrichRevisionBridgeExportSnapshot) {
    try {
      exportSnapshot = await enrichRevisionBridgeExportSnapshot(editorSnapshot, payload);
    } catch (error) {
      return makeTypedExportError('E_EXPORT_REVISION_BRIDGE_ENRICH_FAILED', 'REVISION_BRIDGE_ENRICH_FAILED', {
        message: getErrorMessage(error),
      });
    }
  }

  if (evaluateRevisionBridgeExportRuntimeSnapshot) {
    const readiness = evaluateRevisionBridgeExportRuntimeSnapshot(exportSnapshot);
    revisionBridge = {
      readiness: {
        ok: Boolean(readiness && readiness.ok),
        status: readiness && typeof readiness.status === 'string' ? readiness.status : 'advisory',
        code: readiness && typeof readiness.code === 'string' ? readiness.code : '',
        reason: readiness && typeof readiness.reason === 'string' ? readiness.reason : '',
        requiredFields: Array.isArray(readiness && readiness.requiredFields) ? readiness.requiredFields.slice() : [],
        reasons: Array.isArray(readiness && readiness.reasons)
          ? readiness.reasons.map((item) => ({
            field: item && typeof item.field === 'string' ? item.field : '',
            code: item && typeof item.code === 'string' ? item.code : '',
            message: item && typeof item.message === 'string' ? item.message : '',
          }))
          : [],
      },
    };

    if (revisionBridge.readiness.ok && buildRevisionBridgeExportManifest) {
      const manifest = buildRevisionBridgeExportManifest(exportSnapshot, {
        id: payload.requestId,
        createdAt: typeof exportSnapshot?.exportedAtUtc === 'string' ? exportSnapshot.exportedAtUtc : '',
        sourceVersion: typeof exportSnapshot?.sourceVersion === 'string' ? exportSnapshot.sourceVersion : '',
      });
      revisionBridge.exportManifest = {
        schemaVersion: typeof manifest?.schemaVersion === 'string' ? manifest.schemaVersion : '',
        kind: typeof manifest?.kind === 'string' ? manifest.kind : '',
        id: typeof manifest?.id === 'string' ? manifest.id : '',
        projectId: typeof manifest?.projectId === 'string' ? manifest.projectId : '',
        baselineHash: typeof manifest?.baselineHash === 'string' ? manifest.baselineHash : '',
        docFingerprint: typeof manifest?.docFingerprint === 'string' ? manifest.docFingerprint : '',
        sourceVersion: typeof manifest?.sourceVersion === 'string' ? manifest.sourceVersion : '',
        sceneOrder: Array.isArray(manifest?.sceneOrder) ? manifest.sceneOrder.slice() : [],
        sceneCount: Array.isArray(manifest?.scenes) ? manifest.scenes.length : 0,
        blockCount: Array.isArray(manifest?.blocks) ? manifest.blocks.length : 0,
      };
    }
  }

  let documentBuffer;
  try {
    documentBuffer = await buildDocxMinBuffer(exportSnapshot);
  } catch (error) {
    return makeTypedExportError('E_EXPORT_BUILD_FAILED', 'DOCX_BUILD_FAILED', {
      message: getErrorMessage(error),
    });
  }

  try {
    await queueDiskOperation(() => writeBufferAtomic(outPath, documentBuffer), 'export docx min');
    updateStatus('DOCX MIN экспортирован');
    const result = {
      ok: 1,
      outPath,
      bytesWritten: documentBuffer.length,
    };
    if (revisionBridge) {
      result.revisionBridge = revisionBridge;
    }
    return result;
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
