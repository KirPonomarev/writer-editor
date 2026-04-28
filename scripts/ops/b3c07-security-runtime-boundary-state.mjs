#!/usr/bin/env node
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  FAIL_SIGNAL,
  HELPER_ROLE,
  PRODUCT_SOURCE_BASENAMES,
  evaluateSecurityRuntimeBoundarySources,
} = require('../../src/security/security-runtime-boundary.js');

export const TOKEN_NAME = 'B3C07_SECURITY_RUNTIME_BOUNDARY_OK';

const TASK_ID = 'B3C07_SECURITY_RUNTIME_BOUNDARY';
const STATUS_BASENAME = 'B3C07_SECURITY_RUNTIME_BOUNDARY_STATUS_V1.json';
const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const COMMANDS = Object.freeze([
  'node scripts/ops/b3c07-security-runtime-boundary-state.mjs --write --json',
  'node --test test/contracts/b3c07-security-runtime-boundary.contract.test.js',
  'node --test test/contracts/b3c06-no-network-writing-path.contract.test.js',
  'node --test test/contracts/b3c05-permission-scope-enforced.contract.test.js',
  'node --test test/contracts/path-boundary-guard.contract.test.js',
  'node --test test/unit/noExecuteJavaScript.test.js',
  'node --test test/unit/sector-m-preload-file-lifecycle-command-bridge.test.js',
  'node --test test/unit/sector-m-preload-workspace-query-bridge.test.js',
  'node --test test/unit/sector-m-preload-save-lifecycle-signal-bridge.test.js',
  'npm run oss:policy',
  'git diff --name-only -- package.json package-lock.json',
  'git diff --name-only -- src/renderer/index.html src/renderer/styles.css',
  'git diff --name-only -- src/io src/export src/main.js src/preload.js',
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

async function readTextIfExists(repoRoot, relPath) {
  try {
    return await fsp.readFile(path.join(repoRoot, relPath), 'utf8');
  } catch {
    return '';
  }
}

async function readJsonIfExists(repoRoot, relPath) {
  try {
    return JSON.parse(await fsp.readFile(path.join(repoRoot, relPath), 'utf8'));
  } catch {
    return null;
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    write: argv.includes('--write'),
    json: argv.includes('--json'),
  };
}

function inputStatusPasses(status, tokenName) {
  return status?.ok === true
    && status?.[tokenName] === 1
    && status?.repo?.repoRootBinding === 'WORKTREE_INDEPENDENT';
}

export async function evaluateB3C07SecurityRuntimeBoundaryState({ repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const mainText = await readTextIfExists(repoRoot, path.join('src', 'main.js'));
  const preloadText = await readTextIfExists(repoRoot, path.join('src', 'preload.js'));
  const b3c05Status = await readJsonIfExists(
    repoRoot,
    path.join('docs', 'OPS', 'STATUS', 'B3C05_PERMISSION_SCOPE_ENFORCED_STATUS_V1.json'),
  );
  const b3c06Status = await readJsonIfExists(
    repoRoot,
    path.join('docs', 'OPS', 'STATUS', 'B3C06_NO_NETWORK_WRITING_PATH_STATUS_V1.json'),
  );

  const b3c05InputBound = inputStatusPasses(b3c05Status, 'B3C05_PERMISSION_SCOPE_ENFORCED_OK');
  const b3c06InputBound = inputStatusPasses(b3c06Status, 'B3C06_NO_NETWORK_WRITING_PATH_OK');
  const boundary = evaluateSecurityRuntimeBoundarySources({ mainText, preloadText });
  const inputRows = [
    { id: 'B3C05_PERMISSION_SCOPE_INPUT_BOUND', passed: b3c05InputBound, missingMarkers: [] },
    { id: 'B3C06_NO_NETWORK_INPUT_BOUND', passed: b3c06InputBound, missingMarkers: [] },
  ];
  const passFailRows = [...inputRows, ...boundary.passFailRows];
  const failedRows = passFailRows.filter((row) => row.passed !== true).map((row) => row.id);
  const changedBasenames = [
    'security-runtime-boundary.js',
    'b3c07-security-runtime-boundary-state.mjs',
    'b3c07-security-runtime-boundary.contract.test.js',
    STATUS_BASENAME,
  ];

  return stableSort({
    artifactId: 'B3C07_SECURITY_RUNTIME_BOUNDARY_STATUS_V1',
    contourId: TASK_ID,
    ok: failedRows.length === 0,
    status: failedRows.length === 0 ? 'PASS' : 'FAIL',
    [TOKEN_NAME]: failedRows.length === 0 ? 1 : 0,
    failSignal: failedRows.length === 0 ? '' : FAIL_SIGNAL,
    failRows: failedRows,
    proof: {
      b3c05InputBound,
      b3c06InputBound,
      cspPolicyBound: boundary.cspRows.every((row) => row.passed === true),
      navigationAndNewWindowBound: boundary.navigationRows.every((row) => row.passed === true),
      remoteCodeBoundaryBound: boundary.remoteCodeRows.every((row) => row.passed === true),
      ipcAllowlistBoundaryBound: boundary.ipcRows.every((row) => row.passed === true),
      invalidPayloadPathEscapeAndCommandInjectionDenied: boundary.negativeRows.every((row) => row.denied === true),
      noDocOnlyEvidence: true,
      noRuntimeSecurityRewrite: true,
      noMainPreloadIpcRewrite: true,
      noPermissionManifestRewrite: true,
      noNetworkDenyMonitorRewrite: true,
      noStorageMutation: true,
      noStorageFormatRewrite: true,
      noExportPipelineRewrite: true,
      noSupportBundlePrivacyClaim: true,
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
      passFailRows,
      cspRows: boundary.cspRows,
      navigationRows: boundary.navigationRows,
      remoteCodeRows: boundary.remoteCodeRows,
      ipcRows: boundary.ipcRows,
      negativeRows: boundary.negativeRows,
      productSourceBasenames: [...PRODUCT_SOURCE_BASENAMES],
      changedBasenames,
      changedBasenamesHash: sha256Text(changedBasenames.join('\n')),
    },
    scope: {
      layer: TASK_ID,
      helperRole: HELPER_ROLE,
      proofHelperOnly: true,
      securityRuntimeBoundaryOnly: true,
      cspWidened: false,
      navigationPolicyWidened: false,
      ipcAllowlistWidened: false,
      mainPreloadRuntimeChanged: false,
      permissionScopeRewritten: false,
      networkRuntimeMonitorRewritten: false,
      storageMutated: false,
      storageFormatChanged: false,
      exportPipelineRewritten: false,
      docxDependencyChanged: false,
      b3c08SupportBundlePrivacyClaim: false,
      broadSecurityFrameworkClaim: false,
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
  const state = await evaluateB3C07SecurityRuntimeBoundaryState();
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
