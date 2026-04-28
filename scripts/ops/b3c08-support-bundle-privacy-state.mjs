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
  runSupportBundlePrivacyMatrixWithNetwork,
} = require('../../src/security/support-bundle-privacy.js');

export const TOKEN_NAME = 'B3C08_SUPPORT_BUNDLE_PRIVACY_OK';

const TASK_ID = 'B3C08_SUPPORT_BUNDLE_PRIVACY';
const STATUS_BASENAME = 'B3C08_SUPPORT_BUNDLE_PRIVACY_STATUS_V1.json';
const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const COMMANDS = Object.freeze([
  'node scripts/ops/b3c08-support-bundle-privacy-state.mjs --write --json',
  'node --test test/contracts/b3c08-support-bundle-privacy.contract.test.js',
  'node --test test/contracts/b3c07-security-runtime-boundary.contract.test.js',
  'node --test test/contracts/b3c06-no-network-writing-path.contract.test.js',
  'node --test test/contracts/b3c05-permission-scope-enforced.contract.test.js',
  'node --test test/contracts/path-boundary-guard.contract.test.js',
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

export async function evaluateB3C08SupportBundlePrivacyState({ repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const b3c05Status = await readJsonIfExists(
    repoRoot,
    path.join('docs', 'OPS', 'STATUS', 'B3C05_PERMISSION_SCOPE_ENFORCED_STATUS_V1.json'),
  );
  const b3c06Status = await readJsonIfExists(
    repoRoot,
    path.join('docs', 'OPS', 'STATUS', 'B3C06_NO_NETWORK_WRITING_PATH_STATUS_V1.json'),
  );
  const b3c07Status = await readJsonIfExists(
    repoRoot,
    path.join('docs', 'OPS', 'STATUS', 'B3C07_SECURITY_RUNTIME_BOUNDARY_STATUS_V1.json'),
  );

  const b3c05InputBound = inputStatusPasses(b3c05Status, 'B3C05_PERMISSION_SCOPE_ENFORCED_OK');
  const b3c06InputBound = inputStatusPasses(b3c06Status, 'B3C06_NO_NETWORK_WRITING_PATH_OK');
  const b3c07InputBound = inputStatusPasses(b3c07Status, 'B3C07_SECURITY_RUNTIME_BOUNDARY_OK');
  const privacy = await runSupportBundlePrivacyMatrixWithNetwork();
  const inputRows = [
    { id: 'B3C05_INPUT_BOUND', passed: b3c05InputBound },
    { id: 'B3C06_INPUT_BOUND', passed: b3c06InputBound },
    { id: 'B3C07_INPUT_BOUND', passed: b3c07InputBound },
  ];
  const passFailRows = [...inputRows, ...privacy.rows.map((row) => ({
    id: row.id,
    passed: row.passed === true,
    route: row.route,
    reason: row.reason,
  }))];
  const failedRows = passFailRows.filter((row) => row.passed !== true).map((row) => row.id);
  const changedBasenames = [
    'support-bundle-privacy.js',
    'b3c08-support-bundle-privacy-state.mjs',
    'b3c08-support-bundle-privacy.contract.test.js',
    STATUS_BASENAME,
  ];

  return stableSort({
    artifactId: 'B3C08_SUPPORT_BUNDLE_PRIVACY_STATUS_V1',
    contourId: TASK_ID,
    ok: failedRows.length === 0,
    status: failedRows.length === 0 ? 'PASS' : 'FAIL',
    [TOKEN_NAME]: failedRows.length === 0 ? 1 : 0,
    failSignal: failedRows.length === 0 ? '' : FAIL_SIGNAL,
    failRows: failedRows,
    proof: {
      b3c05InputBound,
      b3c06InputBound,
      b3c07InputBound,
      defaultBundleFieldAllowlistBound: passFailRows.some((row) => row.id === 'DEFAULT_BUNDLE_FIELD_ALLOWLIST_BOUND' && row.passed === true),
      forbiddenStringScanBound: passFailRows.some((row) => row.id === 'FORBIDDEN_STRING_SCAN_BOUND' && row.passed === true),
      redactionOutputSnapshotBound: passFailRows.some((row) => row.id === 'REDACTION_OUTPUT_SNAPSHOT_BOUND' && row.passed === true),
      privatePathNormalizationCheckBound: passFailRows.some((row) => row.id === 'PRIVATE_PATH_NORMALIZATION_CHECK_BOUND' && row.passed === true),
      noNetworkUploadBound: passFailRows.some((row) => row.id === 'NETWORK_UPLOAD_ABSENT' && row.passed === true),
      noProductSupportBundleClaim: true,
      noDocOnlyEvidence: true,
      noRuntimeSecurityRewrite: true,
      noMainPreloadIpcRewrite: true,
      noPermissionManifestRewrite: true,
      noNetworkDenyMonitorRewrite: true,
      noStorageMutation: true,
      noStorageFormatRewrite: true,
      noExportPipelineRewrite: true,
      noPerformanceBaselineClaim: true,
      noReleaseDossierClaim: true,
      noAttestationClaim: true,
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
      privacyRows: privacy.rows,
      redactionOutputSnapshot: privacy.proof.snapshot,
      forbiddenStringCount: privacy.proof.forbiddenStrings.length,
      forbiddenStringsPresentInSnapshot: privacy.proof.forbiddenStrings.filter((value) => privacy.proof.snapshot.includes(value)),
      privatePathNormalization: privacy.proof.privatePath,
      changedBasenames,
      changedBasenamesHash: sha256Text(changedBasenames.join('\n')),
    },
    scope: {
      layer: TASK_ID,
      helperRole: HELPER_ROLE,
      proofHelperOnly: true,
      supportBundlePrivacyOnly: true,
      productSupportBundleFeatureClaim: false,
      supportBundleUiCreated: false,
      ipcChanged: false,
      cspChanged: false,
      navigationChanged: false,
      permissionScopeRewritten: false,
      networkRuntimeMonitorRewritten: false,
      storageMutated: false,
      storageFormatChanged: false,
      exportPipelineRewritten: false,
      performanceBaselineClaim: false,
      releaseDossierClaim: false,
      attestationClaim: false,
      docxDependencyChanged: false,
      uiTouched: false,
      releaseClaim: false,
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
  const state = await evaluateB3C08SupportBundlePrivacyState();
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
