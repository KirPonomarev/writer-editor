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
    throw new Error(`E_PDF_EXPORT_HANDLER_DEP_MISSING:${name}`);
  }
  return value;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizePdfBookProfile(profile) {
  const source = isPlainObjectValue(profile) ? profile : {};
  return {
    schemaVersion: typeof source.schemaVersion === 'string' ? source.schemaVersion : 'book-profile.v1',
    profileId: typeof source.profileId === 'string' && source.profileId ? source.profileId : 'default-book-profile',
    formatId: typeof source.formatId === 'string' && source.formatId ? source.formatId : 'A4',
    widthMm: normalizeNumber(source.widthMm, 210),
    heightMm: normalizeNumber(source.heightMm, 297),
    orientation: source.orientation === 'landscape' ? 'landscape' : 'portrait',
    marginTopMm: normalizeNumber(source.marginTopMm, 25.4),
    marginRightMm: normalizeNumber(source.marginRightMm, 25.4),
    marginBottomMm: normalizeNumber(source.marginBottomMm, 25.4),
    marginLeftMm: normalizeNumber(source.marginLeftMm, 25.4),
    chapterStartRule: typeof source.chapterStartRule === 'string' && source.chapterStartRule
      ? source.chapterStartRule
      : 'next-page',
    allowExplicitPageBreaks: source.allowExplicitPageBreaks !== false,
  };
}

function normalizePdfScenes(scenes) {
  const sourceScenes = Array.isArray(scenes) ? scenes : [];
  return sourceScenes
    .map((scene, index) => {
      const source = isPlainObjectValue(scene) ? scene : {};
      const text = typeof source.text === 'string'
        ? source.text
        : typeof source.plainText === 'string'
          ? source.plainText
          : '';
      return {
        sceneId: typeof source.sceneId === 'string' ? source.sceneId : '',
        title: typeof source.title === 'string' && source.title.trim()
          ? source.title.trim()
          : `Scene ${index + 1}`,
        label: typeof source.label === 'string' ? source.label : '',
        text,
      };
    })
    .filter((scene) => scene.text.length > 0 || scene.title.length > 0);
}

function buildPdfParagraphs(text) {
  const normalizedText = typeof text === 'string' ? text.replace(/\r\n?/g, '\n') : '';
  const paragraphs = normalizedText.split(/\n{2,}/u);
  if (paragraphs.length === 0) {
    return '<p></p>';
  }
  return paragraphs
    .map((paragraph) => {
      const lines = paragraph
        .split('\n')
        .map((line) => escapeHtml(line))
        .join('<br>');
      return `<p>${lines}</p>`;
    })
    .join('\n');
}

function buildPdfPrintHtml(source) {
  const bookProfile = normalizePdfBookProfile(source && source.bookProfile);
  const scenes = normalizePdfScenes(source && source.scenes);
  const sceneMarkup = scenes
    .map((scene, index) => {
      const title = escapeHtml(scene.title);
      const separator = index > 0 ? '<div class="yalken-pdf-scene-separator" aria-hidden="true"></div>' : '';
      return `${separator}
<section class="yalken-pdf-scene" data-scene-id="${escapeHtml(scene.sceneId)}">
  <h1>${title}</h1>
  ${buildPdfParagraphs(scene.text)}
</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <title>Yalken PDF Export</title>
  <style>
    @page {
      size: ${bookProfile.widthMm}mm ${bookProfile.heightMm}mm;
      margin: ${bookProfile.marginTopMm}mm ${bookProfile.marginRightMm}mm ${bookProfile.marginBottomMm}mm ${bookProfile.marginLeftMm}mm;
      @bottom-center {
        content: counter(page);
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 9pt;
        color: #777;
      }
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #1f1c18;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.55;
    }

    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .yalken-pdf-print-projection {
      width: 100%;
    }

    .yalken-pdf-scene {
      break-inside: auto;
      page-break-inside: auto;
    }

    .yalken-pdf-scene + .yalken-pdf-scene {
      margin-top: 18pt;
    }

    .yalken-pdf-scene-separator {
      break-before: auto;
      margin: 20pt auto 14pt;
      width: 36mm;
      border-top: 0.2mm solid #d8d0c6;
    }

    h1 {
      margin: 0 0 14pt;
      font-size: 14pt;
      line-height: 1.25;
      font-weight: 600;
    }

    p {
      margin: 0 0 8pt;
      orphans: 2;
      widows: 2;
    }
  </style>
</head>
<body data-yalken-pdf-print-projection="isolated">
  <main class="yalken-pdf-print-projection">
${sceneMarkup}
  </main>
</body>
</html>`;
}

async function runPdfExport(payloadRaw, deps = {}) {
  const normalizePdfExportPayload = requireDependency(deps, 'normalizePdfExportPayload');
  const makeTypedPdfExportError = requireDependency(deps, 'makeTypedPdfExportError');
  const buildPathBoundaryDetails = typeof deps.buildPathBoundaryDetails === 'function'
    ? deps.buildPathBoundaryDetails
    : (error) => error;
  const resolvePdfExportPath = requireDependency(deps, 'resolvePdfExportPath');
  const validatePdfExportTarget = requireDependency(deps, 'validatePdfExportTarget');
  const readCanonicalPdfExportSource = requireDependency(deps, 'readCanonicalPdfExportSource');
  const renderPdfBuffer = requireDependency(deps, 'renderPdfBuffer');
  const queueDiskOperation = requireDependency(deps, 'queueDiskOperation');
  const writeBufferAtomic = requireDependency(deps, 'writeBufferAtomic');
  const updateStatus = requireDependency(deps, 'updateStatus');

  const payload = normalizePdfExportPayload(payloadRaw);
  if (!payload) {
    return makeTypedPdfExportError('E_EXPORT_PDF_PAYLOAD_INVALID', 'export_payload_invalid');
  }
  if (payload.ok === false) {
    return makeTypedPdfExportError(payload.code, payload.reason, payload.details);
  }
  if (payload.pathBoundaryError) {
    return makeTypedPdfExportError(
      'E_PATH_BOUNDARY_VIOLATION',
      'path_boundary_violation',
      buildPathBoundaryDetails(payload.pathBoundaryError),
    );
  }

  let source;
  try {
    source = await readCanonicalPdfExportSource(payload);
  } catch (error) {
    return makeTypedPdfExportError('E_EXPORT_PDF_SOURCE_UNAVAILABLE', 'canonical_source_unavailable', {
      message: getErrorMessage(error),
    });
  }

  const scenes = normalizePdfScenes(source && source.scenes);
  if (scenes.length === 0) {
    return makeTypedPdfExportError('E_EXPORT_PDF_SOURCE_EMPTY', 'pdf_source_empty');
  }

  let resolvedPath;
  try {
    resolvedPath = await resolvePdfExportPath(payload, source);
  } catch (error) {
    return makeTypedPdfExportError('E_EXPORT_PDF_DIALOG_FAILED', 'save_dialog_failed', {
      message: getErrorMessage(error),
    });
  }
  if (resolvedPath && resolvedPath.canceled === true) {
    return {
      ok: true,
      exported: false,
      canceled: true,
      outPath: '',
      bytesWritten: 0,
      sceneCount: 0,
    };
  }
  if (resolvedPath && resolvedPath.error) {
    return makeTypedPdfExportError(resolvedPath.error.code, resolvedPath.error.reason);
  }
  if (resolvedPath && resolvedPath.pathBoundaryError) {
    return makeTypedPdfExportError(
      'E_PATH_BOUNDARY_VIOLATION',
      'path_boundary_violation',
      buildPathBoundaryDetails(resolvedPath.pathBoundaryError),
    );
  }

  const outPath = resolvedPath && typeof resolvedPath.outPath === 'string' ? resolvedPath.outPath : '';
  const targetState = await validatePdfExportTarget(outPath, source);
  if (!targetState || targetState.ok !== true) {
    return makeTypedPdfExportError(
      'E_EXPORT_PDF_TARGET_FORBIDDEN',
      typeof targetState?.reason === 'string' && targetState.reason
        ? targetState.reason
        : 'export_target_forbidden',
    );
  }

  let pdfBuffer;
  try {
    pdfBuffer = await renderPdfBuffer(buildPdfPrintHtml({ ...source, scenes }), {
      bookProfile: normalizePdfBookProfile(source.bookProfile),
    });
  } catch (error) {
    return makeTypedPdfExportError('E_EXPORT_PDF_RENDER_FAILED', 'pdf_render_failed', {
      message: getErrorMessage(error),
    });
  }
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    return makeTypedPdfExportError('E_EXPORT_PDF_RENDER_INVALID_OUTPUT', 'pdf_render_invalid_output', {
      isBuffer: Buffer.isBuffer(pdfBuffer),
      bytes: Buffer.isBuffer(pdfBuffer) ? pdfBuffer.length : null,
    });
  }

  try {
    await queueDiskOperation(async () => {
      const currentTarget = await validatePdfExportTarget(outPath, source);
      if (!currentTarget || currentTarget.ok !== true) {
        const error = new Error(
          typeof currentTarget?.reason === 'string' && currentTarget.reason
            ? currentTarget.reason
            : 'export_target_forbidden',
        );
        error.reason = error.message;
        throw error;
      }
      await writeBufferAtomic(outPath, pdfBuffer);
    }, 'export pdf');
    updateStatus('PDF экспортирован');
    return {
      ok: true,
      exported: true,
      outPath,
      bytesWritten: pdfBuffer.length,
      sceneCount: scenes.length,
      bookProfile: normalizePdfBookProfile(source.bookProfile),
      failureReport: {
        unsupported: [],
        source: 'saved-canonical-scenes',
      },
    };
  } catch (error) {
    if (typeof error?.reason === 'string') {
      return makeTypedPdfExportError('E_EXPORT_PDF_TARGET_FORBIDDEN', error.reason);
    }
    return makeTypedPdfExportError('E_EXPORT_PDF_WRITE_FAILED', 'pdf_write_failed', {
      message: getErrorMessage(error),
      outPath,
    });
  }
}

module.exports = {
  buildPdfPrintHtml,
  normalizePdfBookProfile,
  normalizePdfScenes,
  runPdfExport,
};
