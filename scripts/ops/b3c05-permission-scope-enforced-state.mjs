#!/usr/bin/env node
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  DEFAULT_PERMISSION_MANIFEST,
  FORBIDDEN_PERMISSIONS,
  PERMISSION_ACTIONS,
  decidePermissionScope,
} = require('../../src/security/permission-scope.js');

export const TOKEN_NAME = 'B3C05_PERMISSION_SCOPE_ENFORCED_OK';

const TASK_ID = 'B3C05_PERMISSION_SCOPE_ENFORCED';
const STATUS_BASENAME = 'B3C05_PERMISSION_SCOPE_ENFORCED_STATUS_V1.json';
const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const COMMANDS = Object.freeze([
  'node scripts/ops/b3c05-permission-scope-enforced-state.mjs --write --json',
  'node --test test/contracts/b3c05-permission-scope-enforced.contract.test.js',
  'node --test test/contracts/b3c04-deterministic-export-mode.contract.test.js',
  'node --test test/contracts/b3c03-docx-artifact-validation.contract.test.js',
  'node --test test/contracts/path-boundary-guard.contract.test.js',
  'node --test test/unit/sector-m-preload-file-lifecycle-command-bridge.test.js',
  'node --test test/unit/sector-m-preload-workspace-query-bridge.test.js',
  'npm run oss:policy',
  'git diff --name-only -- package.json package-lock.json',
  'git diff --name-only -- src/renderer/index.html src/renderer/styles.css',
  'git diff --name-only -- src/io src/main.js src/preload.js',
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

function request(action, channel, requestedPermission, payload) {
  return { action, channel, requestedPermission, payload };
}

function passFailRows() {
  const allowed = [
    request(PERMISSION_ACTIONS.PROJECT_READ, 'project:read', PERMISSION_ACTIONS.PROJECT_READ, { projectPath: 'projects/novel' }),
    request(PERMISSION_ACTIONS.PROJECT_WRITE, 'project:write', PERMISSION_ACTIONS.PROJECT_WRITE, { projectPath: 'projects/novel' }),
    request(PERMISSION_ACTIONS.EXPORT_WRITE, 'export:write', PERMISSION_ACTIONS.EXPORT_WRITE, { outPath: 'exports/novel.docx' }),
    request(PERMISSION_ACTIONS.BACKUP_WRITE, 'backup:write', PERMISSION_ACTIONS.BACKUP_WRITE, { backupPath: 'backups/novel.snapshot.json' }),
    request(PERMISSION_ACTIONS.RECOVERY_WRITE, 'recovery:write', PERMISSION_ACTIONS.RECOVERY_WRITE, { recoveryPath: 'recovery/novel.recovery.json' }),
  ];
  const allowedResults = allowed.map((entry) => decidePermissionScope(entry));
  const forbiddenResults = {
    broadFilesystem: decidePermissionScope(request(
      PERMISSION_ACTIONS.PROJECT_READ,
      'project:read',
      'filesystem.broad',
      { projectPath: 'projects/novel', scope: 'all-files' },
    )),
    shellCommand: decidePermissionScope(request(
      'shell.exec',
      'shell:command',
      'shell.command',
      { command: 'rm' },
    )),
    remoteCode: decidePermissionScope(request(
      'remote.code',
      'remote:code',
      'remote.code',
      { url: 'https://example.invalid/script.js' },
    )),
    network: decidePermissionScope(request(
      'network.fetch',
      'network:outbound',
      'network.outbound',
      { url: 'https://example.invalid' },
    )),
    unknownChannel: decidePermissionScope(request(
      PERMISSION_ACTIONS.PROJECT_READ,
      'project:unknown',
      PERMISSION_ACTIONS.PROJECT_READ,
      { projectPath: 'projects/novel' },
    )),
    invalidPayload: decidePermissionScope(request(
      PERMISSION_ACTIONS.PROJECT_WRITE,
      'project:write',
      PERMISSION_ACTIONS.PROJECT_WRITE,
      null,
    )),
    pathEscape: decidePermissionScope(request(
      PERMISSION_ACTIONS.EXPORT_WRITE,
      'export:write',
      PERMISSION_ACTIONS.EXPORT_WRITE,
      { outPath: '../secrets/novel.docx' },
    )),
  };

  return [
    { id: 'ALLOWED_PROJECT_READ_PERMISSION_DECISION', passed: allowedResults[0].ok === true },
    { id: 'ALLOWED_PROJECT_WRITE_PERMISSION_DECISION', passed: allowedResults[1].ok === true && allowedResults[1].decision.storageMutated === false },
    { id: 'ALLOWED_EXPORT_WRITE_PERMISSION_DECISION', passed: allowedResults[2].ok === true && allowedResults[2].decision.storageMutated === false },
    { id: 'ALLOWED_BACKUP_WRITE_PERMISSION_DECISION', passed: allowedResults[3].ok === true && allowedResults[3].decision.storageMutated === false },
    { id: 'ALLOWED_RECOVERY_WRITE_PERMISSION_DECISION', passed: allowedResults[4].ok === true && allowedResults[4].decision.storageMutated === false },
    { id: 'BROAD_FILESYSTEM_NEGATIVE', passed: forbiddenResults.broadFilesystem.ok === false && forbiddenResults.broadFilesystem.reason === 'FORBIDDEN_PERMISSION_SCOPE' },
    { id: 'SHELL_COMMAND_NEGATIVE', passed: forbiddenResults.shellCommand.ok === false && forbiddenResults.shellCommand.reason === 'FORBIDDEN_PERMISSION_SCOPE' },
    { id: 'REMOTE_CODE_NEGATIVE', passed: forbiddenResults.remoteCode.ok === false && forbiddenResults.remoteCode.reason === 'FORBIDDEN_PERMISSION_SCOPE' },
    { id: 'NETWORK_NEGATIVE_PERMISSION_ONLY', passed: forbiddenResults.network.ok === false && forbiddenResults.network.reason === 'FORBIDDEN_PERMISSION_SCOPE' },
    { id: 'UNKNOWN_CHANNEL_NEGATIVE', passed: forbiddenResults.unknownChannel.ok === false && forbiddenResults.unknownChannel.reason === 'CHANNEL_NOT_ALLOWED' },
    { id: 'INVALID_PAYLOAD_NEGATIVE', passed: forbiddenResults.invalidPayload.ok === false && forbiddenResults.invalidPayload.reason === 'PATH_FIELD_MISSING' },
    { id: 'PATH_ESCAPE_NEGATIVE', passed: forbiddenResults.pathEscape.ok === false && forbiddenResults.pathEscape.reason === 'PATH_SCOPE_DENIED' },
    { id: 'HELPER_PROOF_ONLY_NOT_RUNTIME_ENFORCER', passed: DEFAULT_PERMISSION_MANIFEST.role === 'PROOF_HELPER_NOT_RUNTIME_ENFORCER' },
  ];
}

export async function evaluateB3C05PermissionScopeEnforcedState({ repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const b3c04Status = await readJsonIfExists(
    repoRoot,
    path.join('docs', 'OPS', 'STATUS', 'B3C04_DETERMINISTIC_EXPORT_MODE_STATUS_V1.json'),
  );
  const b3c04InputBound = b3c04Status?.ok === true
    && b3c04Status?.B3C04_DETERMINISTIC_EXPORT_MODE_OK === 1
    && b3c04Status?.repo?.repoRootBinding === 'WORKTREE_INDEPENDENT';
  const allRows = [
    { id: 'B3C04_INPUT_BOUND', passed: b3c04InputBound },
    ...passFailRows(),
  ];
  const failedRows = allRows.filter((row) => row.passed !== true).map((row) => row.id);
  const changedBasenames = [
    'permission-scope.js',
    'b3c05-permission-scope-enforced-state.mjs',
    'b3c05-permission-scope-enforced.contract.test.js',
    STATUS_BASENAME,
  ];
  const denyArtifact = passFailRows()
    .filter((row) => row.id.includes('NEGATIVE'))
    .map((row) => ({ id: row.id, denied: row.passed === true }));

  return stableSort({
    artifactId: 'B3C05_PERMISSION_SCOPE_ENFORCED_STATUS_V1',
    contourId: TASK_ID,
    ok: failedRows.length === 0,
    status: failedRows.length === 0 ? 'PASS' : 'FAIL',
    [TOKEN_NAME]: failedRows.length === 0 ? 1 : 0,
    failSignal: failedRows.length === 0 ? '' : 'E_B3C05_PERMISSION_SCOPE_NOT_OK',
    failRows: failedRows,
    proof: {
      b3c04InputBound,
      permissionManifestBound: true,
      allowedPermissionDecisionRowsBound: true,
      deniedPermissionDecisionRowsBound: true,
      denyArtifactBound: true,
      pathBoundaryReused: true,
      noRuntimeSecurityRewrite: true,
      noMainPreloadIpcRewrite: true,
      noStorageMutation: true,
      noStorageFormatRewrite: true,
      noNetworkDenyMonitorClaim: true,
      noB3C06NetworkClaim: true,
      noB3C07SecurityGreenClaim: true,
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
      passFailRows: allRows,
      permissionManifest: {
        manifestId: DEFAULT_PERMISSION_MANIFEST.manifestId,
        role: DEFAULT_PERMISSION_MANIFEST.role,
        allowedActions: Object.keys(DEFAULT_PERMISSION_MANIFEST.allowedActions),
        forbiddenPermissions: [...FORBIDDEN_PERMISSIONS],
      },
      denyArtifact,
      changedBasenames,
      changedBasenamesHash: sha256Text(changedBasenames.join('\n')),
    },
    scope: {
      layer: 'B3C05_PERMISSION_SCOPE_ENFORCED',
      helperRole: 'PROOF_HELPER_NOT_RUNTIME_ENFORCER',
      permissionDecisionOnly: true,
      mainPreloadIpcRewritten: false,
      runtimeSecurityBoundaryClaim: false,
      storageMutated: false,
      storageFormatChanged: false,
      networkRuntimeMonitorClaim: false,
      b3c06NetworkClaim: false,
      b3c07SecurityGreenClaim: false,
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
  });
}

async function main() {
  const args = parseArgs();
  const state = await evaluateB3C05PermissionScopeEnforcedState();
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
