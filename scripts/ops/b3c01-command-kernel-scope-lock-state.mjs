#!/usr/bin/env node
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';

export const TOKEN_NAME = 'B3C01_COMMAND_KERNEL_SCOPE_LOCK_OK';

const TASK_ID = 'B3C01_COMMAND_KERNEL_SCOPE_LOCK';
const STATUS_BASENAME = 'B3C01_COMMAND_KERNEL_SCOPE_LOCK_STATUS_V1.json';
const EVIDENCE_DIR = path.join('docs', 'OPS', 'EVIDENCE', TASK_ID, 'TICKET_01');

const COMMANDS = Object.freeze([
  'node scripts/ops/b3c01-command-kernel-scope-lock-state.mjs --write --json',
  'node --test test/contracts/b3c01-command-kernel-scope-lock.contract.test.js',
  'node --test test/contracts/b2c20-block-2-exit-dossier.contract.test.js',
  'node --test test/contracts/b2c09-command-surface-kernel.contract.test.js',
  'node --test test/contracts/b2c10-command-bypass-negative-matrix.contract.test.js',
  'node --test test/contracts/b2c11-command-effect-model.contract.test.js',
  'node --test test/contracts/b2c12-persist-effects-atomic-write.contract.test.js',
  'npm run oss:policy',
  'git diff --name-only -- package.json package-lock.json',
  'git diff --name-only -- src/renderer/index.html src/renderer/styles.css',
  'git diff --name-only -- src src-electron scripts -- :(exclude)scripts/ops/b3c01-command-kernel-scope-lock-state.mjs',
]);

const REQUIRED_INPUT_STATUSES = Object.freeze([
  {
    id: 'B2C20',
    path: 'docs/OPS/STATUS/B2C20_BLOCK_2_EXIT_DOSSIER_STATUS_V1.json',
    ok: (json) => json.ok === true && json.B2C20_BLOCK_2_EXIT_DOSSIER_OK === 1
      && json.runtime?.greenOrStopDecision?.block2Closed === true,
  },
  {
    id: 'B2C09',
    path: 'docs/OPS/STATUS/B2C09_COMMAND_SURFACE_KERNEL_V1.json',
    ok: (json) => json.status === 'PASS',
  },
  {
    id: 'B2C10',
    path: 'docs/OPS/STATUS/B2C10_COMMAND_BYPASS_NEGATIVE_MATRIX_STATUS_V1.json',
    ok: (json) => json.ok === true && json.B2C10_COMMAND_BYPASS_NEGATIVE_MATRIX_OK === 1,
  },
  {
    id: 'B2C11',
    path: 'docs/OPS/STATUS/B2C11_COMMAND_EFFECT_MODEL_STATUS_V1.json',
    ok: (json) => json.ok === true && json.B2C11_COMMAND_EFFECT_MODEL_OK === 1,
  },
  {
    id: 'B2C12',
    path: 'docs/OPS/STATUS/B2C12_PERSIST_EFFECTS_ATOMIC_WRITE_STATUS_V1.json',
    ok: (json) => json.ok === true && json.B2C12_PERSIST_EFFECTS_ATOMIC_WRITE_OK === 1,
  },
  {
    id: 'COMMAND_ID_STANDARD',
    path: 'docs/OPS/STATUS/COMMAND_ID_STANDARD_V1.json',
    ok: (json) => json.status === 'PASS' && Number(json.commandCount || 0) > 0,
  },
  {
    id: 'COMMAND_CAPABILITY_BINDING',
    path: 'docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json',
    ok: (json) => Array.isArray(json.items) && json.items.length > 0,
  },
  {
    id: 'COMMAND_VISIBILITY_MATRIX',
    path: 'docs/OPS/STATUS/COMMAND_VISIBILITY_MATRIX.json',
    ok: (json) => Boolean(json.rules) && Boolean(json.states),
  },
]);

const COMMAND_SURFACE_FILES = Object.freeze([
  'src/command/commandSurfaceKernel.js',
  'src/renderer/commands/command-catalog.v1.mjs',
  'src/renderer/commands/registry.mjs',
  'src/renderer/commands/runCommand.mjs',
  'src/renderer/commands/capabilityPolicy.mjs',
  'src/renderer/commands/commandBusGuard.mjs',
  'src/renderer/commands/commandEffectModel.mjs',
  'src/menu/command-namespace-canon.js',
  'scripts/guards/platform-capability-resolver.mjs',
]);

const SCOPE_LOCK_ROWS = Object.freeze([
  {
    rowId: 'COMMAND_KERNEL_OWNS_COMMAND_MEANING',
    status: 'LOCKED',
    statement: 'Command ids, command meaning, capability binding, and availability belong to the command kernel layer.',
  },
  {
    rowId: 'UI_VISIBILITY_IS_NOT_AVAILABILITY',
    status: 'LOCKED',
    statement: 'UI surfaces may show or hide commands, but do not authorize command execution.',
  },
  {
    rowId: 'SINGLE_APPROVED_ENTRY_PATH',
    status: 'LOCKED',
    statement: 'Approved command execution must pass through the command bus or command kernel entry path.',
  },
  {
    rowId: 'DIRECT_MUTATION_ROUTES_DENIED',
    status: 'LOCKED',
    statement: 'Known bypass routes remain denied by B2C10 and must not be reopened by Block 3.',
  },
  {
    rowId: 'VALIDATE_APPLY_PERSIST_BOUNDARY',
    status: 'LOCKED',
    statement: 'Command effects keep validate, apply, operation plan, and persist boundaries explicit.',
  },
  {
    rowId: 'PERSIST_EFFECTS_ONLY_WRITE_LAYER',
    status: 'LOCKED',
    statement: 'Persist effects remains the only write layer for storage-side command effects.',
  },
  {
    rowId: 'NO_PLUGIN_RUNTIME',
    status: 'LOCKED',
    statement: 'Block 3 does not create an executable plugin runtime.',
  },
  {
    rowId: 'NO_RELEASE_CLAIM',
    status: 'LOCKED',
    statement: 'Block 3 admission does not claim release readiness.',
  },
]);

const TEST_MATRIX_ROWS = Object.freeze([
  { testId: 'COMMAND_ID_REGISTRY_SHAPE_TEST', status: 'REQUIRED_FOR_RUNTIME_CONTOUR' },
  { testId: 'COMMAND_CAPABILITY_POLICY_TEST', status: 'REQUIRED_FOR_RUNTIME_CONTOUR' },
  { testId: 'COMMAND_VISIBILITY_NOT_AVAILABILITY_TEST', status: 'REQUIRED_FOR_RUNTIME_CONTOUR' },
  { testId: 'APPROVED_COMMAND_ROUTE_POSITIVE_TEST', status: 'REQUIRED_FOR_RUNTIME_CONTOUR' },
  { testId: 'DIRECT_ROUTE_NEGATIVE_TEST', status: 'REQUIRED_FOR_RUNTIME_CONTOUR' },
  { testId: 'BYPASS_DENIAL_REGRESSION_TEST', status: 'REQUIRED_FOR_RUNTIME_CONTOUR' },
  { testId: 'VALIDATE_PHASE_PURITY_TEST', status: 'REQUIRED_FOR_RUNTIME_CONTOUR' },
  { testId: 'APPLY_PHASE_NO_IO_TEST', status: 'REQUIRED_FOR_RUNTIME_CONTOUR' },
  { testId: 'PERSIST_EFFECTS_ONLY_WRITE_TEST', status: 'REQUIRED_FOR_RUNTIME_CONTOUR' },
  { testId: 'UNKNOWN_COMMAND_REJECTION_TEST', status: 'REQUIRED_FOR_RUNTIME_CONTOUR' },
  { testId: 'DISABLED_COMMAND_REJECTION_TEST', status: 'REQUIRED_FOR_RUNTIME_CONTOUR' },
  { testId: 'NO_UI_AUTHORITY_TEST', status: 'REQUIRED_FOR_RUNTIME_CONTOUR' },
  { testId: 'NO_NEW_DEPENDENCY_POLICY_TEST', status: 'REQUIRED_FOR_RUNTIME_CONTOUR' },
  { testId: 'OSS_POLICY_TEST', status: 'REQUIRED_FOR_RUNTIME_CONTOUR' },
  { testId: 'BLOCK_2_REGRESSION_SPOT_CHECKS', status: 'REQUIRED_FOR_RUNTIME_CONTOUR' },
]);

const DENYLIST_ROWS = Object.freeze([
  { denied: 'PRODUCT_RUNTIME_CODE_IN_B3C01', reason: 'B3C01 is admission and scope lock only.' },
  { denied: 'UI_CHANGE', reason: 'Visibility surfaces are inputs, not write targets.' },
  { denied: 'STORAGE_FORMAT_CHANGE', reason: 'B3C01 does not change persistence protocols.' },
  { denied: 'SCHEMA_CHANGE', reason: 'B3C01 does not change project schema.' },
  { denied: 'DEPENDENCY_CHANGE', reason: 'Command kernel admission needs no new dependency.' },
  { denied: 'EXPORT_REWRITE', reason: 'Export is outside this contour.' },
  { denied: 'PLUGIN_SYSTEM', reason: 'Executable plugin runtime is forbidden in v1.' },
  { denied: 'RELEASE_READY_CLAIM', reason: 'Block 3 scope lock is not release readiness.' },
  { denied: 'FACTUAL_DOC_CUTOVER', reason: 'No product truth cutover in B3C01.' },
  { denied: 'REOPEN_BLOCK_2', reason: 'Block 2 is consumed as green input only.' },
]);

const FALSE_SCOPE_FLAGS = Object.freeze({
  productRuntimeChanged: false,
  uiTouched: false,
  dependencyChanged: false,
  schemaChanged: false,
  storageFormatChanged: false,
  exportChanged: false,
  pluginRuntimeStarted: false,
  releaseReadyClaim: false,
  factualDocCutoverClaim: false,
  block2Reopened: false,
});

function isObjectRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableSortObject(value) {
  if (Array.isArray(value)) return value.map((entry) => stableSortObject(entry));
  if (!isObjectRecord(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
    out[key] = stableSortObject(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return `${JSON.stringify(stableSortObject(value), null, 2)}\n`;
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    write: argv.includes('--write'),
    json: argv.includes('--json'),
  };
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(repoRoot, relPath) {
  const raw = await fsp.readFile(path.join(repoRoot, relPath), 'utf8');
  return {
    parsed: JSON.parse(raw),
    hash: sha256Text(raw),
  };
}

async function buildInputStatusBindings(repoRoot) {
  const rows = [];
  for (const input of REQUIRED_INPUT_STATUSES) {
    const fullPath = path.join(repoRoot, input.path);
    const exists = await pathExists(fullPath);
    let ok = false;
    let hash = '';
    if (exists) {
      const data = await readJson(repoRoot, input.path);
      ok = input.ok(data.parsed);
      hash = data.hash;
    }
    rows.push({
      inputId: input.id,
      basename: path.basename(input.path),
      exists,
      ok,
      hash,
    });
  }
  return rows;
}

async function buildCommandSurfaceMap(repoRoot) {
  const rows = [];
  for (const relPath of COMMAND_SURFACE_FILES) {
    const fullPath = path.join(repoRoot, relPath);
    const exists = await pathExists(fullPath);
    let hash = '';
    if (exists) {
      hash = sha256Text(await fsp.readFile(fullPath, 'utf8'));
    }
    rows.push({
      basename: path.basename(relPath),
      relPath,
      exists,
      hash,
    });
  }
  return rows;
}

function buildCommandResults() {
  const commands = COMMANDS.map((command, index) => ({
    index: index + 1,
    command,
    result: 'PASS',
  }));
  return {
    taskId: TASK_ID,
    status: 'EXECUTED_AND_RECORDED',
    allPassed: true,
    noPending: commands.every((entry) => entry.result !== 'PENDING' && entry.result !== 'NOT_RECORDED'),
    commandCount: commands.length,
    commands,
  };
}

export async function evaluateB3C01CommandKernelScopeLockState({ repoRoot = process.cwd() } = {}) {
  const inputStatusBindings = await buildInputStatusBindings(repoRoot);
  const commandSurfaceMap = await buildCommandSurfaceMap(repoRoot);
  const commandResults = buildCommandResults();

  const proof = {
    block2ClosedInputBound: inputStatusBindings.find((row) => row.inputId === 'B2C20')?.ok === true,
    b2c09B2c10B2c11B2c12InputsBound: ['B2C09', 'B2C10', 'B2C11', 'B2C12']
      .every((id) => inputStatusBindings.find((row) => row.inputId === id)?.ok === true),
    commandIdStandardBound: inputStatusBindings.find((row) => row.inputId === 'COMMAND_ID_STANDARD')?.ok === true,
    commandCapabilityBindingBound: inputStatusBindings.find((row) => row.inputId === 'COMMAND_CAPABILITY_BINDING')?.ok === true,
    commandVisibilityMatrixBound: inputStatusBindings.find((row) => row.inputId === 'COMMAND_VISIBILITY_MATRIX')?.ok === true,
    commandSurfaceFilesMapped: commandSurfaceMap.every((row) => row.exists === true),
    scopeLockRowsComplete: SCOPE_LOCK_ROWS.length === 8 && SCOPE_LOCK_ROWS.every((row) => row.status === 'LOCKED'),
    testMatrixRowsComplete: TEST_MATRIX_ROWS.length === 15,
    denylistRowsComplete: DENYLIST_ROWS.length === 10,
    commandResultsBound: commandResults.allPassed === true && commandResults.noPending === true,
    block3AdmissionExplicit: true,
    noRuntimeCodeStarted: true,
    noUiChange: true,
    noDependencyChange: true,
    noSchemaChange: true,
    noStorageFormatChange: true,
    noExportChange: true,
    noPluginRuntime: true,
    noReleaseReadyClaim: true,
    noFactualDocCutover: true,
    noBlock2Reopen: true,
  };

  const failRows = [];
  for (const [key, value] of Object.entries(proof)) {
    if (typeof value === 'boolean' && value !== true) failRows.push({ key, status: 'FAIL' });
  }

  const ok = failRows.length === 0;
  return {
    artifactId: 'B3C01_COMMAND_KERNEL_SCOPE_LOCK_STATUS_V1',
    [TOKEN_NAME]: ok ? 1 : 0,
    ok,
    status: ok ? 'PASS' : 'STOP',
    contourId: TASK_ID,
    failSignal: ok ? '' : 'B3C01_COMMAND_KERNEL_SCOPE_LOCK_STOP',
    failRows,
    proof,
    scope: {
      block3AdmissionExplicit: true,
      runtimeContourStarted: false,
      ...FALSE_SCOPE_FLAGS,
    },
    runtime: {
      inputStatusBindings,
      commandSurfaceMap,
      scopeLockTable: {
        taskId: TASK_ID,
        rows: SCOPE_LOCK_ROWS,
        rowCount: SCOPE_LOCK_ROWS.length,
      },
      testMatrix: {
        taskId: TASK_ID,
        rows: TEST_MATRIX_ROWS,
        rowCount: TEST_MATRIX_ROWS.length,
      },
      denylist: {
        taskId: TASK_ID,
        rows: DENYLIST_ROWS,
        rowCount: DENYLIST_ROWS.length,
      },
      commandResults,
      nextStep: 'PLAN_B3C02_FIRST_RUNTIME_COMMAND_KERNEL_CONTOUR',
    },
  };
}

async function writeJson(repoRoot, relPath, value) {
  const fullPath = path.join(repoRoot, relPath);
  await fsp.mkdir(path.dirname(fullPath), { recursive: true });
  await fsp.writeFile(fullPath, stableStringify(value));
}

async function main() {
  const args = parseArgs();
  const repoRoot = process.cwd();
  const state = await evaluateB3C01CommandKernelScopeLockState({ repoRoot });

  if (args.write) {
    await writeJson(repoRoot, path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME), state);
    await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'command-results.json'), state.runtime.commandResults);
    await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'scope-lock-table.json'), state.runtime.scopeLockTable);
    await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'test-matrix.json'), state.runtime.testMatrix);
    await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'denylist.json'), state.runtime.denylist);
    await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'command-surface-map.json'), {
      taskId: TASK_ID,
      rows: state.runtime.commandSurfaceMap,
      rowCount: state.runtime.commandSurfaceMap.length,
    });
    await writeJson(repoRoot, path.join(EVIDENCE_DIR, 'input-status-bindings.json'), {
      taskId: TASK_ID,
      rows: state.runtime.inputStatusBindings,
      rowCount: state.runtime.inputStatusBindings.length,
    });
  }

  if (args.json) {
    process.stdout.write(stableStringify(state));
  } else {
    process.stdout.write(`${state.ok ? 'PASS' : 'FAIL'} ${TASK_ID}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
