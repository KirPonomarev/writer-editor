'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const safe = require('../../src/utils/docxImportSafeCreate.js');
(async () => {
  const [root, bytesPath] = process.argv.slice(2);
  const projectRoot = path.join(root, 'project'), romanRoot = path.join(projectRoot, 'roman');
  const manifestPath = path.join(projectRoot, 'project.craftsman.json');
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(bridge.buildDocxContentPreviewFromZipBytes(fs.readFileSync(bytesPath)));
  safe.rememberDocxImportPreviewPlanAdmission(plan);
  const { createMainProjectManifestAuthority } = await import('../../src/product/mainProjectManifestAuthority.mjs');
  const authority = createMainProjectManifestAuthority({ anchorRoot: path.join(root, 'anchors'), useLeaseHeartbeatWorker: false });
  const sandbox = {
    cloneJsonSafe: x => JSON.parse(JSON.stringify(x)), isPlainObjectValue: x => !!x && typeof x === 'object' && !Array.isArray(x),
    isDocxImportPreviewPlanAdmitted: safe.isDocxImportPreviewPlanAdmitted, applyDocxImportSafeCreate: safe.applyDocxImportSafeCreate,
    ensureProjectStructure: async () => {}, getProjectRootPath: () => projectRoot, getProjectSectionPath: () => romanRoot,
    resolveProjectBindingForFile: async () => ({ projectId: 'word-import-tx', manifestPath, manifestRaw: fs.readFileSync(manifestPath, 'utf8') }),
    getMainProjectManifestAuthority: async () => ({ ...authority, commitManifestText: async () => { throw Error('REPLAY_MUST_NOT_WRITE_MANIFEST'); } }),
    queueDiskOperation: op => op(), module: { exports: {} }, exports: {},
  };
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const section = main.slice(main.indexOf('// DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE_START'), main.indexOf('// DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE_END'));
  vm.runInNewContext(section + '\nmodule.exports = handleDocxImportSafeCreateCommandSurface;', sandbox);
  const result = await sandbox.module.exports({ requestId: 'owned-request', docxImportPreviewPlan: plan });
  process.stdout.write(JSON.stringify(result));
})().catch(error => { process.stderr.write(error.stack || JSON.stringify(error)); process.exitCode = 1; });
