'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const safe = require('../../src/utils/docxImportSafeCreate.js');
(async () => {
  const [root, bytesPath, mode = 'replay', requestId = 'owned-request'] = process.argv.slice(2);
  const projectRoot = path.join(root, 'project'), romanRoot = path.join(projectRoot, 'roman');
  const manifestPath = path.join(projectRoot, 'project.craftsman.json');
  const bridge = await import('../../src/io/revisionBridge/index.mjs');
  const plan = bridge.buildDocxImportPreviewPlanFromContentPreview(bridge.buildDocxContentPreviewFromZipBytes(fs.readFileSync(bytesPath)));
  safe.rememberDocxImportPreviewPlanAdmission(plan);
  const { createMainProjectManifestAuthority } = await import('../../src/product/mainProjectManifestAuthority.mjs');
  const authority = createMainProjectManifestAuthority({ anchorRoot: path.join(root, 'anchors'), useLeaseHeartbeatWorker: false, leaseTtlMs: 1000 });
  if (mode === 'resume') await new Promise(resolve => setTimeout(resolve, 1500));
  const point = async name => { if (mode === name) { process.send({ point: name }); await new Promise(() => setInterval(() => {}, 1000)); } };
  if (mode === 'before-commit') { const link=fs.promises.link; fs.promises.link=async (from,to)=>{await link(from,to);if(String(to).endsWith('.txt'))await point(mode);}; }
  if (mode === 'after-commit') { const unlink=fs.promises.unlink; fs.promises.unlink=async target=>{await unlink(target);if(String(target).endsWith('.wp201-transaction.json'))await point(mode);}; }
  const sandbox = {
    captureDocxImportPreviewContext: () => 1,
    fs: fs.promises, path,
    ...require('../../src/core/project-transaction-v1.cjs'),
    ...require('../../src/core/io/path-boundary'),
    ...require('../../src/product/projectIdDomain.cjs'),
    currentProjectName: 'project', DEFAULT_PROJECT_NAME: 'project',
    getProjectManifestPath: () => manifestPath,
    readDocxImportAttempt: safe.readDocxImportAttempt,
    treeCohortError: code => Object.assign(Error(code), { code }),
    cloneJsonSafe: x => JSON.parse(JSON.stringify(x)), isPlainObjectValue: x => !!x && typeof x === 'object' && !Array.isArray(x),
    isDocxImportPreviewPlanAdmitted: safe.isDocxImportPreviewPlanAdmitted, applyDocxImportSafeCreate: safe.applyDocxImportSafeCreate,
    ensureProjectStructure: async () => {}, getProjectRootPath: () => projectRoot, getProjectSectionPath: () => romanRoot,
    resolveProjectBindingForFile: async () => ({ projectId: 'word-import-tx', manifestPath, manifestRaw: fs.readFileSync(manifestPath, 'utf8') }),
    getMainProjectManifestAuthority: async () => mode === 'replay' ? ({ ...authority, commitManifestText: async () => { throw Error('REPLAY_MUST_NOT_WRITE_MANIFEST'); } }) : authority,
    queueDiskOperation: op => op(), module: { exports: {} }, exports: {},
  };
  const main = fs.readFileSync(path.join(__dirname, '../../src/main.js'), 'utf8');
  const section = main.slice(main.indexOf('// DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE_START'), main.indexOf('// DOCX_IMPORT_SAFE_CREATE_COMMAND_SURFACE_END'));
  // Execute the actual Main recovery adapter with real Core and lease authority.
  // A missing journal is decided by Core; pending fault journals are reconciled.
  const recovery = main.slice(main.indexOf('async function recoverWriterProjectTransactionForFile('), main.indexOf('\nfunction isFileUrl(', main.indexOf('async function recoverWriterProjectTransactionForFile(')));
  const pathGuards = main.slice(main.indexOf('function isPathInside('), main.indexOf('\n// Проверка существования файла', main.indexOf('function isPathInside(')));
  const projectIdGuard = main.slice(main.indexOf('function normalizeStableProjectId('), main.indexOf('\nfunction canonicalizeComparableValue(', main.indexOf('function normalizeStableProjectId(')));
  vm.runInNewContext(recovery + pathGuards + projectIdGuard + section + '\nmodule.exports = handleDocxImportSafeCreateCommandSurface;', sandbox);
  const result = await sandbox.module.exports({ requestId, docxImportPreviewPlan: plan });
  process.stdout.write(JSON.stringify(result));
})().catch(error => { process.stderr.write(error.stack || JSON.stringify(error)); process.exitCode = 1; });
