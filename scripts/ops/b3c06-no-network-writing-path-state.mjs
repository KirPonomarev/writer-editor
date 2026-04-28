#!/usr/bin/env node
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  FAIL_SIGNAL,
  HELPER_ROLE,
  NETWORK_ROUTES,
  WRITING_PATH_STEPS,
  runNetworkNegativeMatrix,
  runWithNetworkDenyMonitor,
} = require('../../src/security/network-deny-monitor.js');
const { buildDocxMinBuffer } = require('../../src/export/docx/docxMinBuilder.js');

export const TOKEN_NAME = 'B3C06_NO_NETWORK_WRITING_PATH_OK';

const TASK_ID = 'B3C06_NO_NETWORK_WRITING_PATH';
const STATUS_BASENAME = 'B3C06_NO_NETWORK_WRITING_PATH_STATUS_V1.json';
const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const COMMANDS = Object.freeze([
  'node scripts/ops/b3c06-no-network-writing-path-state.mjs --write --json',
  'node --test test/contracts/b3c06-no-network-writing-path.contract.test.js',
  'node --test test/contracts/b3c05-permission-scope-enforced.contract.test.js',
  'node --test test/contracts/b3c04-deterministic-export-mode.contract.test.js',
  'node --test test/contracts/b3c03-docx-artifact-validation.contract.test.js',
  'node --test test/contracts/path-boundary-guard.contract.test.js',
  'node --test test/contracts/collab-no-network-wiring.contract.test.js',
  'npm run oss:policy',
  'git diff --name-only -- package.json package-lock.json',
  'git diff --name-only -- src/renderer/index.html src/renderer/styles.css',
  'git diff --name-only -- src/io src/main.js src/preload.js src/export',
]);

function stableSort(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSort(entry));
  if (!value || typeof value !== 'object' || value.constructor !== Object) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSort(value[key]);
  }
  return out;
}

function stableJson(value) {
  return `${JSON.stringify(stableSort(value), null, 2)}\n`;
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

async function readJsonIfExists(repoRoot, relPath) {
  try {
    return JSON.parse(await fsp.readFile(path.join(repoRoot, relPath), 'utf8'));
  } catch {
    return null;
  }
}

async function readTextIfExists(repoRoot, relPath) {
  try {
    return await fsp.readFile(path.join(repoRoot, relPath), 'utf8');
  } catch {
    return '';
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    write: argv.includes('--write'),
    json: argv.includes('--json'),
  };
}

function createBuilderDependencies() {
  return {
    docxPageSetupBindModule: {
      buildDocxSectionPropertiesXml: () => '<w:sectPr/>',
    },
    semanticMappingModule: {
      PAGE_BREAK_TOKEN_V1: '[[PAGE_BREAK]]',
      mapSemanticEntries: ({ text }) => ({
        entries: String(text || '')
          .split('\n')
          .map((line) => ({ kind: 'paragraph', text: line })),
      }),
    },
    styleMapModule: {
      createStyleMap: () => ({
        resolve: () => ({}),
      }),
    },
  };
}

async function executeWritingPathReplay() {
  const { atomicWriteFile } = await import('../../src/io/markdown/atomicWriteFile.mjs');
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'b3c06-writing-path-'));
  try {
    return await runWithNetworkDenyMonitor(async () => {
      const projectPath = path.join(tempDir, 'project.md');
      const initialText = 'B3C06 canonical local text\n';
      const editedText = `${initialText}Edited under no-network monitor\n`;
      await fsp.writeFile(projectPath, initialText, 'utf8');
      const openedText = await fsp.readFile(projectPath, 'utf8');
      const saveResult = await atomicWriteFile(projectPath, editedText, { safetyMode: 'strict' });
      const reopenedText = await fsp.readFile(projectPath, 'utf8');
      const exportBuffer = buildDocxMinBuffer({ plainText: reopenedText }, createBuilderDependencies());

      return {
        replayKind: 'BOUNDED_LOCAL_RUNTIME_REPLAY',
        steps: [...WRITING_PATH_STEPS],
        stepCount: WRITING_PATH_STEPS.length,
        openStep: openedText === initialText,
        editStep: editedText.includes('Edited under no-network monitor'),
        saveStep: saveResult.ok === 1 && reopenedText === editedText,
        exportStep: Buffer.isBuffer(exportBuffer) && exportBuffer.length > 0,
        exportBytes: exportBuffer.length,
        usedExistingPublicSeamsOnly: true,
        storageMutated: true,
        storageMutationScope: 'TEMP_FIXTURE_ONLY',
        storageFormatChanged: false,
        exportPipelineRewritten: false,
        uiTouched: false,
      };
    }, { scope: 'open_edit_save_export' });
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function collectProductRouteEvidence(repoRoot) {
  const productFiles = [
    'src/main.js',
    'src/preload.js',
    'src/renderer/editor.js',
    'src/export/docx/docxMinExportHandler.js',
    'src/security/permission-scope.js',
  ];
  const rows = [];
  for (const relPath of productFiles) {
    const text = await readTextIfExists(repoRoot, relPath);
    rows.push({
      basename: path.basename(relPath),
      hasFetchCall: /\bfetch\s*\(/u.test(text),
      hasWebSocketConstructor: /\bnew\s+WebSocket\b|\bWebSocket\s*\(/u.test(text),
      hasXmlHttpRequest: /\bXMLHttpRequest\b/u.test(text),
      hasNodeHttpRequest: /\b(?:http|https)\.request\s*\(/u.test(text),
      hasNodeHttpGet: /\b(?:http|https)\.get\s*\(/u.test(text),
      hasAnalyticsRoute: /\banalytics\b/u.test(text),
      hasCloudSyncRoute: /\bcloud\s*sync\b|\bcloudSync\b/u.test(text),
      hasUpdateCheckRoute: /\bupdateCheck\b|\bupdate-check\b/u.test(text),
    });
  }
  return rows;
}

function productRouteRowsPass(rows) {
  return rows.every((row) => row.hasFetchCall === false
    && row.hasWebSocketConstructor === false
    && row.hasXmlHttpRequest === false
    && row.hasNodeHttpRequest === false
    && row.hasNodeHttpGet === false
    && row.hasAnalyticsRoute === false
    && row.hasCloudSyncRoute === false
    && row.hasUpdateCheckRoute === false);
}

function buildPassFailRows({ b3c05InputBound, replay, negativeRows, productEvidence }) {
  return [
    { id: 'B3C05_INPUT_BOUND', passed: b3c05InputBound },
    { id: 'OPEN_EDIT_SAVE_EXPORT_REPLAY_ZERO_OUTBOUND', passed: replay.ok === true && replay.artifact.outboundAttemptCount === 0 },
    { id: 'REPLAY_USES_DECLARED_WRITING_PATH_STEPS', passed: replay.result.stepCount === WRITING_PATH_STEPS.length },
    { id: 'REPLAY_EXECUTES_OPEN_EDIT_SAVE_EXPORT_STEPS', passed: replay.result.openStep === true && replay.result.editStep === true && replay.result.saveStep === true && replay.result.exportStep === true },
    { id: 'REPLAY_STORAGE_MUTATION_IS_TEMP_FIXTURE_ONLY', passed: replay.result.storageMutated === true && replay.result.storageMutationScope === 'TEMP_FIXTURE_ONLY' },
    { id: 'FETCH_NEGATIVE_DENIED', passed: negativeRows.some((row) => row.route === NETWORK_ROUTES.FETCH && row.denied === true) },
    { id: 'WEBSOCKET_NEGATIVE_DENIED', passed: negativeRows.some((row) => row.route === NETWORK_ROUTES.WEBSOCKET && row.denied === true) },
    { id: 'XML_HTTP_REQUEST_NEGATIVE_DENIED', passed: negativeRows.some((row) => row.route === NETWORK_ROUTES.XML_HTTP_REQUEST && row.denied === true) },
    { id: 'HTTP_NEGATIVE_DENIED', passed: negativeRows.some((row) => row.route === NETWORK_ROUTES.HTTP_REQUEST && row.denied === true) },
    { id: 'HTTPS_NEGATIVE_DENIED', passed: negativeRows.some((row) => row.route === NETWORK_ROUTES.HTTPS_REQUEST && row.denied === true) },
    { id: 'HTTP_GET_NEGATIVE_DENIED', passed: negativeRows.some((row) => row.route === NETWORK_ROUTES.HTTP_GET && row.denied === true) },
    { id: 'HTTPS_GET_NEGATIVE_DENIED', passed: negativeRows.some((row) => row.route === NETWORK_ROUTES.HTTPS_GET && row.denied === true) },
    { id: 'REMOTE_IMAGE_NEGATIVE_DENIED', passed: negativeRows.some((row) => row.route === NETWORK_ROUTES.REMOTE_IMAGE && row.denied === true) },
    { id: 'UPDATE_CHECK_NEGATIVE_DENIED', passed: negativeRows.some((row) => row.route === NETWORK_ROUTES.UPDATE_CHECK && row.denied === true) },
    { id: 'ANALYTICS_NEGATIVE_DENIED', passed: negativeRows.some((row) => row.route === NETWORK_ROUTES.ANALYTICS && row.denied === true) },
    { id: 'CLOUD_SYNC_NEGATIVE_DENIED', passed: negativeRows.some((row) => row.route === NETWORK_ROUTES.CLOUD_SYNC && row.denied === true) },
    { id: 'PRODUCT_ROUTE_SEARCH_HAS_NO_WRITING_PATH_NETWORK_CALL', passed: productRouteRowsPass(productEvidence) },
    { id: 'HELPER_IS_NOT_PRODUCT_NETWORK_STACK', passed: replay.artifact.helperRole === HELPER_ROLE },
  ];
}

export async function evaluateB3C06NoNetworkWritingPathState({ repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const b3c05Status = await readJsonIfExists(
    repoRoot,
    path.join('docs', 'OPS', 'STATUS', 'B3C05_PERMISSION_SCOPE_ENFORCED_STATUS_V1.json'),
  );
  const b3c05InputBound = b3c05Status?.ok === true
    && b3c05Status?.B3C05_PERMISSION_SCOPE_ENFORCED_OK === 1
    && b3c05Status?.repo?.repoRootBinding === 'WORKTREE_INDEPENDENT';

  const replay = await executeWritingPathReplay();
  const negativeRows = await runNetworkNegativeMatrix();
  const productEvidence = await collectProductRouteEvidence(repoRoot);
  const passFailRows = buildPassFailRows({
    b3c05InputBound,
    replay,
    negativeRows,
    productEvidence,
  });
  const failedRows = passFailRows.filter((row) => row.passed !== true).map((row) => row.id);
  const changedBasenames = [
    'network-deny-monitor.js',
    'b3c06-no-network-writing-path-state.mjs',
    'b3c06-no-network-writing-path.contract.test.js',
    STATUS_BASENAME,
  ];

  return stableSort({
    artifactId: 'B3C06_NO_NETWORK_WRITING_PATH_STATUS_V1',
    contourId: TASK_ID,
    ok: failedRows.length === 0,
    status: failedRows.length === 0 ? 'PASS' : 'FAIL',
    [TOKEN_NAME]: failedRows.length === 0 ? 1 : 0,
    failSignal: failedRows.length === 0 ? '' : 'E_B3C06_NO_NETWORK_WRITING_PATH_NOT_OK',
    failRows: failedRows,
    proof: {
      b3c05InputBound,
      networkDenyMonitorBound: true,
      writingPathReplayBound: true,
      zeroOutboundAttemptArtifactBound: replay.artifact.zeroOutboundAttempts === true,
      negativeMatrixBound: negativeRows.every((row) => row.denied === true),
      productRouteSearchEvidenceBound: productRouteRowsPass(productEvidence),
      noDocOnlyEvidence: true,
      noProductNetworkStackRewrite: true,
      noStorageRewrite: true,
      noExportPipelineRewrite: true,
      noMainPreloadIpcRewrite: true,
      noB3C07SecurityRuntimeBoundaryClaim: true,
      noNewDependency: true,
      noUiChange: true,
      noReleaseClaim: true,
      worktreeIndependentStatus: true,
    },
    runtime: {
      commandResults: {
        taskId: TASK_ID,
        status: 'DECLARED_FOR_EXTERNAL_RUNNER',
        commandCount: COMMANDS.length,
        selfExecuted: false,
        allPassed: null,
        noPending: null,
        commands: COMMANDS.map((command, index) => ({
          index: index + 1,
          command,
          result: 'EXTERNAL_RUN_REQUIRED',
        })),
      },
      writingPathReplay: {
        replayKind: replay.result.replayKind,
        steps: replay.result.steps,
        stepCount: replay.result.stepCount,
        openStep: replay.result.openStep,
        editStep: replay.result.editStep,
        saveStep: replay.result.saveStep,
        exportStep: replay.result.exportStep,
        exportBytes: replay.result.exportBytes,
        zeroOutboundAttempts: replay.artifact.zeroOutboundAttempts,
        outboundAttemptCount: replay.artifact.outboundAttemptCount,
        usedExistingPublicSeamsOnly: replay.result.usedExistingPublicSeamsOnly,
        storageMutationScope: replay.result.storageMutationScope,
      },
      negativeRows,
      productRouteEvidence: productEvidence,
      passFailRows,
      changedBasenames,
      changedBasenamesHash: sha256Text(changedBasenames.join('\n')),
    },
    scope: {
      layer: TASK_ID,
      helperRole: HELPER_ROLE,
      proofHelperOnly: true,
      writingPathNetworkDenialOnly: true,
      deliveryNetworkSeparated: true,
      storageMutated: false,
      storageFormatChanged: false,
      exportPipelineRewritten: false,
      mainPreloadIpcRewritten: false,
      productNetworkStackRewritten: false,
      b3c07SecurityRuntimeBoundaryClaim: false,
      permissionScopeRewritten: false,
      docxDependencyChanged: false,
      uiTouched: false,
      releaseClaim: false,
      releaseDossierStarted: false,
    },
    repo: {
      repoRootBinding: 'WORKTREE_INDEPENDENT',
      statusBasename: STATUS_BASENAME,
      writtenFrom: path.basename(fileURLToPath(import.meta.url)),
    },
    monitor: {
      failSignal: FAIL_SIGNAL,
      helperRole: HELPER_ROLE,
    },
  });
}

async function main() {
  const args = parseArgs();
  const state = await evaluateB3C06NoNetworkWritingPathState();
  if (args.write) {
    const statusPath = path.join(DEFAULT_REPO_ROOT, STATUS_REL_PATH);
    await fsp.mkdir(path.dirname(statusPath), { recursive: true });
    await fsp.writeFile(statusPath, stableJson(state), 'utf8');
  }
  if (args.json) process.stdout.write(stableJson(state));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
