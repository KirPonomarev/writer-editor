'use strict';
// Test-only fixture: direct semantic/import tests now publish through the real
// manifest authority and disk-backed project lease instead of algorithmic ACKs.
const fs = require('node:fs');
const path = require('node:path');
const safe = require('../../src/utils/docxImportSafeCreate.js');
const DEFAULT_PROJECT_ID = 'docx-import-test-project';
async function withRealDocxImportAuthority(options) {
  const projectId = options.projectId || DEFAULT_PROJECT_ID;
  const manifestPath = options.manifestPath || path.join(options.projectRoot, 'project.craftsman.json');
  fs.mkdirSync(options.projectRoot, { recursive: true });
  if (!fs.existsSync(manifestPath)) fs.writeFileSync(manifestPath, JSON.stringify({ projectId, treeIdentity: { schemaVersion: 1, nodes: {} }, lastCommandId: 0 }));
  const { createMainProjectManifestAuthority } = await import('../../src/product/mainProjectManifestAuthority.mjs');
  const transactionAuthority = options.transactionAuthority || createMainProjectManifestAuthority({
    anchorRoot: path.join(options.projectRoot, '.test-authority'), useLeaseHeartbeatWorker: false,
  });
  return { ...options, projectId, manifestPath, manifestRaw: fs.readFileSync(manifestPath, 'utf8'), transactionAuthority };
}
async function applyDocxImportSafeCreate(input, options) {
  if (!safe.validateDocxImportPreviewPlan(input.docxImportPreviewPlan).ok || !safe.isDocxImportPreviewPlanAdmitted(input.docxImportPreviewPlan)) {
    return safe.applyDocxImportSafeCreate(input, options);
  }
  return safe.applyDocxImportSafeCreate(input, await withRealDocxImportAuthority(options));
}
module.exports = { ...safe, DEFAULT_PROJECT_ID, withRealDocxImportAuthority, applyDocxImportSafeCreate };
