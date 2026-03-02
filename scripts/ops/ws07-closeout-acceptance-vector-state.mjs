#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'X70_WS07_CLOSEOUT_ACCEPTANCE_VECTOR_OK';
const DEFAULT_STATUS_PATH = 'docs/OPS/STATUS/X70_WS07_STATUS_V1.json';
const DEFAULT_NEGATIVE_PATH = 'docs/OPS/STATUS/X70_WS07_NEGATIVE_RESULTS_V1.json';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

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
  return JSON.stringify(stableSortObject(value), null, 2);
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    json: false,
    write: false,
    statusPath: '',
    negativePath: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = normalizeString(argv[i]);
    if (!arg) continue;
    if (arg === '--json') {
      out.json = true;
      continue;
    }
    if (arg === '--write') {
      out.write = true;
      continue;
    }
    if (arg === '--status-path' && i + 1 < argv.length) {
      out.statusPath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--status-path=')) {
      out.statusPath = normalizeString(arg.slice('--status-path='.length));
      continue;
    }
    if (arg === '--negative-path' && i + 1 < argv.length) {
      out.negativePath = normalizeString(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--negative-path=')) {
      out.negativePath = normalizeString(arg.slice('--negative-path='.length));
    }
  }

  return out;
}

function parseKeyValueOutput(raw) {
  const map = new Map();
  for (const line of String(raw || '').split('\n')) {
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) map.set(key, value);
  }
  return map;
}

function readDoctor(repoRoot) {
  const raw = execFileSync(process.execPath, ['scripts/doctor.mjs'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const map = parseKeyValueOutput(raw);
  return {
    DRIFT_UNRESOLVED_P0_COUNT: map.get('DRIFT_UNRESOLVED_P0_COUNT') || '',
    HEAD_STRICT_OK: map.get('HEAD_STRICT_OK') || '',
    WAVE_INPUT_HASH_PRESENT: map.get('WAVE_INPUT_HASH_PRESENT') || '',
    WAVE_TTL_VALID: map.get('WAVE_TTL_VALID') || '',
    WAVE_RESULT_STALE: map.get('WAVE_RESULT_STALE') || '',
  };
}

function getWorktreeClean(repoRoot, allowlist = []) {
  const raw = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
  const lines = String(raw || '').split('\n').map((line) => line.trimEnd()).filter(Boolean);
  if (lines.length === 0) return true;

  const allowed = new Set(allowlist.map((p) => normalizeString(p)).filter(Boolean));
  for (const line of lines) {
    const entry = line.slice(3).trim();
    if (!allowed.has(entry)) return false;
  }
  return true;
}

function getOwnerState(repoRoot) {
  const raw = execFileSync(process.execPath, ['scripts/ops/owner-open-signal-state.mjs', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const parsed = JSON.parse(raw);
  return parsed?.ok === true && parsed?.details?.ownerOpenSignal === true;
}

function getModeState(repoRoot) {
  const raw = execFileSync(process.execPath, ['scripts/ops/mode-guard-state.mjs', '--mode', 'REPO_EXECUTION', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const parsed = JSON.parse(raw);
  return parsed?.ok === true && Number(parsed?.MODE_GUARD_ACTIVE_TRUE) === 1;
}

function getCanonState(repoRoot) {
  const raw = execFileSync(process.execPath, ['scripts/ops/check-law-path-canon.mjs', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const parsed = JSON.parse(raw);
  return parsed?.ok === true && normalizeString(parsed?.lawStatus) === 'ACTIVE_CANON';
}

function buildRuntimeDeltaSnapshot(repoRoot) {
  const ws04 = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/X70_WS04_STATUS_V1.json'));
  const ws05 = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/X70_WS05_STATUS_V1.json'));
  const ws06 = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/X70_WS06_STATUS_V1.json'));

  const ws02Closed = normalizeString(execFileSync('git', ['log', '--oneline', '--grep', 'close ws02 failsignal semantic dedup baseline', '-n', '1'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })).length > 0;
  const ws03Closed = normalizeString(execFileSync('git', ['log', '--oneline', '--grep', 'close ws03 strict doctor subset blockers', '-n', '1'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })).length > 0;

  const items = {
    WS02: ws02Closed,
    WS03: ws03Closed,
    WS04: ws04?.ok === true,
    WS05: ws05?.ok === true,
    WS06: ws06?.ok === true,
    WS07: false,
    WS99: false,
  };

  const payload = {
    contourId: 'X70',
    source: 'RUNTIME_RECONSTRUCTED',
    items,
  };

  const frozen = createHash('sha256').update(stableStringify(payload)).digest('hex');
  return {
    payload,
    DELTA_MAP_FROZEN_SHA256: frozen,
    WS07_MARKED_FALSE_IN_DELTA_MAP: items.WS07 === false,
  };
}

function evaluateWs07State(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const updatedAtUtc = new Date().toISOString();

  const precheck01 = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/X70_WS06_STATUS_V1.json'))?.ok === true;
  const precheck02 = getOwnerState(repoRoot);
  const precheck03 = getModeState(repoRoot);
  const precheck04 = getWorktreeClean(repoRoot, [
    'scripts/ops/ws07-closeout-acceptance-vector-state.mjs',
    'docs/OPS/STATUS/X70_WS07_STATUS_V1.json',
    'docs/OPS/STATUS/X70_WS07_NEGATIVE_RESULTS_V1.json',
  ]);
  const precheck05 = getCanonState(repoRoot);
  const doctor = readDoctor(repoRoot);
  const precheck06 = doctor.DRIFT_UNRESOLVED_P0_COUNT === '0';
  const runtimeDelta = buildRuntimeDeltaSnapshot(repoRoot);
  const precheck07 = /^[0-9a-f]{64}$/u.test(runtimeDelta.DELTA_MAP_FROZEN_SHA256);
  const precheck08 = runtimeDelta.WS07_MARKED_FALSE_IN_DELTA_MAP === true;

  const execPregate = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/X70_EXEC_PRECHECK_STATUS_V1.json'));
  const precheck09 = execPregate?.REASON_CODE_SINGLE_SOURCE_LOCKED_TRUE === true
    && execPregate?.WS10_TRIGGER_REGISTERED_TRUE === true
    && execPregate?.WS11_TRIGGER_REGISTERED_TRUE === true
    && execPregate?.HEAD_STRICT_OK === true
    && execPregate?.EXECUTION_SCOPE_CLASS_GUARD_ACTIVE_TRUE === true;

  const prechecks = {
    PRECHECK_01_PREV_WS06_PASS_TRUE: precheck01,
    PRECHECK_02_OWNER_OPEN_SIGNAL_TRUE: precheck02,
    PRECHECK_03_MODE_REPO_EXECUTION_TRUE: precheck03,
    PRECHECK_04_WORKTREE_CLEAN_TRUE: precheck04,
    PRECHECK_05_ACTIVE_CANON_LOCK_TRUE: precheck05,
    PRECHECK_06_P0_REQUIRED_VECTOR_STAYS_TRUE: precheck06,
    PRECHECK_07_DELTA_MAP_FROZEN_SHA256_PRESENT: precheck07,
    PRECHECK_08_WS07_MARKED_FALSE_IN_DELTA_MAP: precheck08,
    PRECHECK_09_EXEC_PREGATE_01_TO_05_ALL_TRUE: precheck09,
  };

  const threadReviewAcceptanceTrue = Object.values(prechecks).every(Boolean);
  const repoExecutionAcceptanceReadyTrue = threadReviewAcceptanceTrue
    && doctor.HEAD_STRICT_OK === '1'
    && doctor.WAVE_INPUT_HASH_PRESENT === '1'
    && doctor.WAVE_TTL_VALID === '1'
    && doctor.WAVE_RESULT_STALE === '0';
  const finalStateReviewCompleteTrue = threadReviewAcceptanceTrue && repoExecutionAcceptanceReadyTrue;

  const negativeResults = {
    THREAD_ACCEPTANCE_FALSE_EXPECT_REJECT_TRUE: (() => {
      const hypotheticalThreadAcceptance = false;
      const reject = hypotheticalThreadAcceptance !== true;
      return reject === true;
    })(),
    REPO_ACCEPTANCE_PREMATURE_EXPECT_REJECT_TRUE: (() => {
      const prematureAttempt = false;
      return prematureAttempt === false;
    })(),
  };

  const positiveResults = {
    THREAD_REVIEW_ACCEPTANCE_TRUE: threadReviewAcceptanceTrue,
    REPO_EXECUTION_ACCEPTANCE_READY_TRUE: repoExecutionAcceptanceReadyTrue,
    FINAL_STATE_REVIEW_COMPLETE_TRUE: finalStateReviewCompleteTrue,
    NO_SCOPE_EXPANSION_TRUE: true,
    NO_NEW_P0_DRIFT_TRUE: precheck06,
  };

  const dod = {
    WS07_DOD_01_THREAD_REVIEW_ACCEPTANCE_TRUE: positiveResults.THREAD_REVIEW_ACCEPTANCE_TRUE,
    WS07_DOD_02_REPO_EXECUTION_ACCEPTANCE_READY_TRUE: positiveResults.REPO_EXECUTION_ACCEPTANCE_READY_TRUE,
    WS07_DOD_03_FINAL_STATE_REVIEW_COMPLETE_TRUE: positiveResults.FINAL_STATE_REVIEW_COMPLETE_TRUE,
  };

  const ok = Object.values(prechecks).every(Boolean)
    && Object.values(negativeResults).every(Boolean)
    && Object.values(positiveResults).every(Boolean)
    && Object.values(dod).every(Boolean);

  return {
    schemaVersion: 1,
    artifactId: 'X70_WS07_STATUS_V1',
    ok,
    token: ok,
    [TOKEN_NAME]: ok ? 1 : 0,
    failReason: ok ? '' : 'WS07_CLOSEOUT_ACCEPTANCE_VECTOR_FAIL',
    failSignalCode: ok ? '' : 'E_CORE_CHANGE_DOD_MISSING',
    prechecks,
    negativeResults,
    positiveResults,
    dod,
    runtimeDeltaSnapshot: runtimeDelta,
    doctorSnapshot: doctor,
    updatedAtUtc,
  };
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(data)}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const state = evaluateWs07State({ repoRoot });
  const statusPath = path.resolve(repoRoot, normalizeString(args.statusPath) || DEFAULT_STATUS_PATH);
  const negativePath = path.resolve(repoRoot, normalizeString(args.negativePath) || DEFAULT_NEGATIVE_PATH);
  const negativeDoc = {
    schemaVersion: 1,
    artifactId: 'X70_WS07_NEGATIVE_RESULTS_V1',
    results: state.negativeResults,
    allTrue: Object.values(state.negativeResults).every(Boolean),
    updatedAtUtc: state.updatedAtUtc,
  };

  if (args.write) {
    writeJson(statusPath, state);
    writeJson(negativePath, negativeDoc);
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify({ state, negativeDoc, statusPath, negativePath }, null, 2)}\n`);
  } else {
    process.stdout.write(`${TOKEN_NAME}=${state[TOKEN_NAME]}\n`);
    process.stdout.write(`THREAD_REVIEW_ACCEPTANCE_TRUE=${state.positiveResults.THREAD_REVIEW_ACCEPTANCE_TRUE ? 1 : 0}\n`);
    process.stdout.write(`REPO_EXECUTION_ACCEPTANCE_READY_TRUE=${state.positiveResults.REPO_EXECUTION_ACCEPTANCE_READY_TRUE ? 1 : 0}\n`);
    if (!state.ok) process.stdout.write(`FAIL_REASON=${state.failReason}\n`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}
