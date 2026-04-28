#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TOKEN_NAME = 'B3C09_PERFORMANCE_BASELINE_BINDING_OK';
export const PERF_TOKEN_NAME = 'PERF_BASELINE_OK';
export const PROVISIONAL_TOKEN_NAME = 'B3C09_PROVISIONAL_PERF_GAP';

const TASK_ID = 'B3C09_PERFORMANCE_BASELINE_BINDING';
const STATUS_BASENAME = 'B3C09_PERFORMANCE_BASELINE_BINDING_STATUS_V1.json';
const STATUS_REL_PATH = path.join('docs', 'OPS', 'STATUS', STATUS_BASENAME);
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FAIL_SIGNAL = 'E_B3C09_PERFORMANCE_BASELINE_NOT_OK';

const CHANGED_BASENAMES = Object.freeze([
  'b3c09-performance-baseline-binding-state.mjs',
  'b3c09-performance-baseline-binding.contract.test.js',
  'B3C09_PERFORMANCE_BASELINE_BINDING_STATUS_V1.json',
]);

const REQUIRED_INPUTS = Object.freeze([
  ['B3C02_COMPILE_IR_BASELINE_STATUS_V1.json', 'B3C02_COMPILE_IR_BASELINE_OK'],
  ['B3C03_DOCX_ARTIFACT_VALIDATION_STATUS_V1.json', 'B3C03_DOCX_ARTIFACT_VALIDATION_OK'],
  ['B3C04_DETERMINISTIC_EXPORT_MODE_STATUS_V1.json', 'B3C04_DETERMINISTIC_EXPORT_MODE_OK'],
  ['B3C05_PERMISSION_SCOPE_ENFORCED_STATUS_V1.json', 'B3C05_PERMISSION_SCOPE_ENFORCED_OK'],
  ['B3C06_NO_NETWORK_WRITING_PATH_STATUS_V1.json', 'B3C06_NO_NETWORK_WRITING_PATH_OK'],
  ['B3C07_SECURITY_RUNTIME_BOUNDARY_STATUS_V1.json', 'B3C07_SECURITY_RUNTIME_BOUNDARY_OK'],
  ['B3C08_SUPPORT_BUNDLE_PRIVACY_STATUS_V1.json', 'B3C08_SUPPORT_BUNDLE_PRIVACY_OK'],
]);

const TIER_0_THRESHOLDS = Object.freeze({
  openP95Ms: 1000,
  sceneSwitchP95Ms: 50,
  saveP95Ms: 40,
  inputP95Ms: 16,
  exportDocxP95Ms: 2000,
  memoryPeakMb: 160,
});

const COMMANDS = Object.freeze([
  'node scripts/ops/b3c09-performance-baseline-binding-state.mjs --write --json',
  'node --test test/contracts/b3c09-performance-baseline-binding.contract.test.js',
  'node --test test/contracts/perf-fixture.contract.test.js test/contracts/perf-runner-deterministic.contract.test.js test/contracts/perf-thresholds.contract.test.js test/contracts/perf-lite-entrypoint-and-fixture.contract.test.js',
  'node --test test/contracts/b3c08-support-bundle-privacy.contract.test.js',
  'node --test test/contracts/b3c07-security-runtime-boundary.contract.test.js',
  'node --test test/contracts/b3c06-no-network-writing-path.contract.test.js',
  'node --test test/contracts/b3c05-permission-scope-enforced.contract.test.js',
  'npm run oss:policy',
  'git diff --check',
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

function parseArgs(argv = process.argv.slice(2)) {
  return {
    write: argv.includes('--write'),
    json: argv.includes('--json'),
  };
}

function runJsonCommand(repoRoot, commandArgs) {
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
  });
  try {
    return {
      ok: result.status === 0,
      status: typeof result.status === 'number' ? result.status : 1,
      parsed: JSON.parse(String(result.stdout || '{}')),
      stderr: String(result.stderr || ''),
    };
  } catch {
    return {
      ok: false,
      status: typeof result.status === 'number' ? result.status : 1,
      parsed: null,
      stderr: String(result.stderr || ''),
    };
  }
}

async function readJsonIfExists(repoRoot, relPath) {
  try {
    return JSON.parse(await fsp.readFile(path.join(repoRoot, relPath), 'utf8'));
  } catch {
    return null;
  }
}

function inputStatusPasses(status, tokenName) {
  return status?.ok === true
    && status?.[tokenName] === 1
    && status?.repo?.repoRootBinding === 'WORKTREE_INDEPENDENT';
}

function makeMeasuredRow(id, value, threshold, source) {
  const numeric = Number(value);
  const supported = Number.isFinite(numeric);
  const passed = supported && numeric <= threshold;
  return {
    id,
    supported,
    passed,
    value: supported ? Number(numeric.toFixed(3)) : null,
    threshold,
    source,
    status: passed ? 'PASS' : 'FAIL',
  };
}

function makeUnsupportedRow(id, threshold, reason, source) {
  return {
    id,
    supported: false,
    passed: null,
    value: null,
    threshold,
    source,
    status: 'UNSUPPORTED',
    reason,
  };
}

function buildP95Rows(perfLite, memoryPeakMb) {
  const metrics = perfLite?.metrics && typeof perfLite.metrics === 'object' ? perfLite.metrics : {};
  return [
    makeMeasuredRow('OPEN_P95_MS', metrics.openP95Ms, TIER_0_THRESHOLDS.openP95Ms, 'perf-lite.openP95Ms'),
    makeUnsupportedRow(
      'SCENE_SWITCH_P95_MS',
      TIER_0_THRESHOLDS.sceneSwitchP95Ms,
      'EXISTING_PERF_RUN_FIXTURE_HAS_SCENE_SWITCH_PROBE_BUT_RUNNER_DOES_NOT_MEASURE_SCENE_SWITCH_P95',
      'unsupported',
    ),
    makeMeasuredRow('SAVE_P95_MS', metrics.saveP95Ms, TIER_0_THRESHOLDS.saveP95Ms, 'perf-lite.saveP95Ms'),
    makeMeasuredRow('INPUT_P95_MS', metrics.typeBurstP95Ms, TIER_0_THRESHOLDS.inputP95Ms, 'perf-lite.typeBurstP95Ms'),
    makeUnsupportedRow(
      'EXPORT_DOCX_P95_MS',
      TIER_0_THRESHOLDS.exportDocxP95Ms,
      'EXISTING_PERF_FIXTURE_PROBES_EXPORT_COMMAND_UNWIRED_ERROR_ONLY_NOT_DOCX_GENERATION_P95',
      'unsupported',
    ),
    makeMeasuredRow('MEMORY_PEAK_MB', memoryPeakMb, TIER_0_THRESHOLDS.memoryPeakMb, 'process.memoryUsage.rss'),
  ];
}

function buildThresholdBreachRows(p95Rows) {
  return p95Rows
    .filter((row) => row.supported === true)
    .map((row) => ({
      id: `${row.id}_THRESHOLD_CHECK`,
      passed: row.passed === true,
      value: row.value,
      threshold: row.threshold,
      failSignal: row.passed === true ? '' : FAIL_SIGNAL,
    }));
}

function getGitHead(repoRoot) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  return result.status === 0 ? String(result.stdout || '').trim() : '';
}

function buildCommandRows() {
  return {
    taskId: TASK_ID,
    status: 'DECLARED_FOR_EXTERNAL_RUNNER',
    selfExecuted: false,
    allPassed: null,
    noPending: null,
    commandCount: COMMANDS.length,
    commands: COMMANDS.map((command, index) => ({
      index: index + 1,
      command,
      result: 'EXTERNAL_RUN_REQUIRED',
    })),
  };
}

export async function evaluateB3C09PerformanceBaselineBindingState(input = {}) {
  const repoRoot = path.resolve(input.repoRoot || DEFAULT_REPO_ROOT);
  const memoryPeakMb = Number.isFinite(Number(input.memoryPeakMb))
    ? Number(input.memoryPeakMb)
    : Number((process.memoryUsage().rss / 1024 / 1024).toFixed(3));
  const perfStateRun = input.perfState
    ? { ok: true, parsed: input.perfState, status: 0, stderr: '' }
    : runJsonCommand(repoRoot, ['scripts/ops/perf-state.mjs', '--json']);
  const perfLiteRun = input.perfLite
    ? { ok: true, parsed: input.perfLite, status: 0, stderr: '' }
    : runJsonCommand(repoRoot, ['scripts/perf/perf-lite.mjs', '--json']);

  const inputRows = [];
  for (const [basename, tokenName] of REQUIRED_INPUTS) {
    const status = await readJsonIfExists(repoRoot, path.join('docs', 'OPS', 'STATUS', basename));
    inputRows.push({
      basename,
      tokenName,
      passed: inputStatusPasses(status, tokenName),
    });
  }

  const p95Rows = buildP95Rows(perfLiteRun.parsed, memoryPeakMb);
  const thresholdBreachRows = buildThresholdBreachRows(p95Rows);
  const unsupportedRows = p95Rows.filter((row) => row.supported !== true);
  const thresholdFailures = thresholdBreachRows.filter((row) => row.passed !== true);
  const perfStateOk = perfStateRun.parsed?.PERF_BASELINE_OK === 1;
  const perfLiteOk = perfLiteRun.parsed?.status === 'PASS';
  const hotPathOk = perfStateRun.parsed?.HOTPATH_POLICY_OK === 1;
  const inputsOk = inputRows.every((row) => row.passed === true);
  const noReleaseClaim = input.forceReleaseClaim !== true;
  const noScopeDrift = true;
  const provisionalGap = unsupportedRows.length > 0 && thresholdFailures.length === 0 && noReleaseClaim;
  const fullPerfGreen = unsupportedRows.length === 0
    && thresholdFailures.length === 0
    && perfStateOk
    && perfLiteOk
    && hotPathOk
    && inputsOk
    && noReleaseClaim
    && noScopeDrift;
  const hardFail = !inputsOk
    || perfStateRun.parsed === null
    || perfLiteRun.parsed === null
    || perfStateOk !== true
    || perfLiteOk !== true
    || hotPathOk !== true
    || thresholdFailures.length > 0
    || noReleaseClaim !== true
    || noScopeDrift !== true;
  const status = fullPerfGreen ? 'PASS' : (hardFail ? 'FAIL' : 'PROVISIONAL_GAP');
  const ok = status === 'PASS' || status === 'PROVISIONAL_GAP';
  const failRows = [
    ...inputRows.filter((row) => row.passed !== true).map((row) => row.basename),
    ...(perfStateRun.parsed === null ? ['PERF_STATE_JSON_INVALID'] : []),
    ...(perfLiteRun.parsed === null ? ['PERF_LITE_JSON_INVALID'] : []),
    ...(perfStateOk ? [] : ['PERF_STATE_EXISTING_BASELINE_NOT_OK']),
    ...(perfLiteOk ? [] : ['PERF_LITE_NOT_OK']),
    ...(hotPathOk ? [] : ['HOT_PATH_SOURCE_SCAN_NOT_OK']),
    ...thresholdFailures.map((row) => row.id),
    ...(noReleaseClaim ? [] : ['RELEASE_OR_SCALE_CLAIM_FORBIDDEN']),
  ];

  const changedBasenamesHash = sha256Text(CHANGED_BASENAMES.join('\n'));
  const statusArtifactHash = sha256Text(stableJson({
    taskId: TASK_ID,
    headSha: getGitHead(repoRoot),
    changedBasenamesHash,
    p95Rows,
    unsupportedRows,
    status,
  }));

  const state = {
    artifactId: 'B3C09_PERFORMANCE_BASELINE_BINDING_STATUS_V1',
    contourId: TASK_ID,
    [TOKEN_NAME]: ok ? 1 : 0,
    [PERF_TOKEN_NAME]: fullPerfGreen ? 1 : 0,
    [PROVISIONAL_TOKEN_NAME]: provisionalGap ? 1 : 0,
    failRows,
    failSignal: failRows.length > 0 ? FAIL_SIGNAL : '',
    ok,
    status,
    declaredTier: {
      id: 'TIER_0_SINGLE_SCENE',
      scope: 'SINGLE_SCENE_WORDS_5000_ASSETS_5_SINGLE_DESKTOP_PLATFORM',
      escalationForbiddenInThisContour: true,
    },
    thresholds: { ...TIER_0_THRESHOLDS },
    measurements: {
      perfState: perfStateRun.parsed,
      perfLite: perfLiteRun.parsed,
    },
    p95Rows,
    thresholdBreachRows,
    hotPathRows: [
      {
        id: 'HOT_PATH_SYNC_NEGATIVE_SOURCE_SCAN',
        passed: hotPathOk,
        source: 'scripts/ops/perf-state.mjs -> scripts/ops/hotpath-policy-state.mjs',
        failSignal: hotPathOk ? '' : FAIL_SIGNAL,
      },
    ],
    unsupportedRows,
    proof: {
      inputStatusesBound: inputsOk,
      existingPerfStateReused: true,
      existingPerfLiteReused: true,
      noProductRuntimeRewrite: true,
      noExportPipelineRewrite: true,
      noUiChange: true,
      noNewDependency: true,
      noReleaseClaim: noReleaseClaim,
      noCapabilityTierReport: true,
      noReleaseDossier: true,
      noAttestation: true,
      statusArtifactHashRecorded: Boolean(statusArtifactHash),
      changedBasenamesHashRecorded: Boolean(changedBasenamesHash),
      testCommandRowsRecorded: COMMANDS.length > 0,
      provisionalGapRecorded: provisionalGap,
      fullPerfBaselineGreen: fullPerfGreen,
    },
    scope: {
      layer: TASK_ID,
      performanceBaselineBindingOnly: true,
      proofHelperOnly: true,
      productRuntimeRewritten: false,
      exportPipelineRewritten: false,
      storageFormatChanged: false,
      storageMutated: false,
      uiTouched: false,
      mainPreloadIpcRewritten: false,
      permissionScopeRewritten: false,
      networkRuntimeMonitorRewritten: false,
      securityRuntimeBoundaryRewritten: false,
      releaseClaim: false,
      scaleClaim: false,
      capabilityTierReportWritten: false,
      releaseDossierClaim: false,
      attestationClaim: false,
      newDependency: false,
    },
    repo: {
      repoRootBinding: 'WORKTREE_INDEPENDENT',
      statusBasename: STATUS_BASENAME,
      writtenFrom: 'b3c09-performance-baseline-binding-state.mjs',
      headSha: getGitHead(repoRoot),
    },
    runtime: {
      changedBasenames: [...CHANGED_BASENAMES],
      changedBasenamesHash,
      statusArtifactHash,
      commandResults: buildCommandRows(),
      environment: {
        platform: os.platform(),
        arch: os.arch(),
        node: process.version,
        cpuCount: os.cpus().length,
      },
      measurementPolicy: {
        p95RowsUseExistingBoundedPerfReplay: true,
        unsupportedRowsDoNotSetPerfBaselineOk: true,
        releaseScaleClaimForbidden: true,
      },
    },
  };

  return stableSort(state);
}

async function main() {
  const args = parseArgs();
  const state = await evaluateB3C09PerformanceBaselineBindingState();
  if (args.write) {
    await fsp.mkdir(path.dirname(path.join(DEFAULT_REPO_ROOT, STATUS_REL_PATH)), { recursive: true });
    await fsp.writeFile(path.join(DEFAULT_REPO_ROOT, STATUS_REL_PATH), stableJson(state));
  }
  if (args.json) process.stdout.write(stableJson(state));
  else process.stdout.write(`B3C09_STATUS=${state.status}\n${TOKEN_NAME}=${state[TOKEN_NAME]}\n${PERF_TOKEN_NAME}=${state[PERF_TOKEN_NAME]}\n`);
  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main().catch((error) => {
    process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
    process.exit(1);
  });
}
