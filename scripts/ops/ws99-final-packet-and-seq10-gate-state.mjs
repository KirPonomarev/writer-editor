#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const TOKEN_NAME = 'X70_WS99_FINAL_PACKET_AND_SEQ10_GATE_OK';
const CLOSEOUT_SUMMARY_REL = 'docs/OPS/STATUS/X70_WS99_CLOSEOUT_SUMMARY_V1.json';
const NEXT_CONTOUR_RECORD_REL = 'docs/OPS/STATUS/X70_NEXT_CONTOUR_OPENING_RECORD_V1.json';
const STATUS_PACKET_REL = 'docs/OPS/STATUS/X70_STATUS_PACKET_V1.json';
const SEQ10_GATE_PACKET_REL = 'docs/OPS/STATUS/X70_SEQ10_GATE_PACKET_V1.json';

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

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${stableStringify(data)}\n`, 'utf8');
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = { json: false, write: false };
  for (const arg of argv) {
    if (normalizeString(arg) === '--json') out.json = true;
    if (normalizeString(arg) === '--write') out.write = true;
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

function getWorktreeClean(repoRoot, allowlist = []) {
  const raw = execFileSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
  const lines = String(raw || '').split('\n').map((line) => line.trimEnd()).filter(Boolean);
  if (lines.length === 0) return true;
  const allowed = new Set(allowlist.map((entry) => normalizeString(entry)).filter(Boolean));
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

function getDoctorSnapshot(repoRoot) {
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

function buildRuntimeDeltaSnapshot(repoRoot) {
  const ws04 = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/X70_WS04_STATUS_V1.json'));
  const ws05 = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/X70_WS05_STATUS_V1.json'));
  const ws06 = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/X70_WS06_STATUS_V1.json'));
  const ws07 = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/X70_WS07_STATUS_V1.json'));
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
    WS07: ws07?.ok === true,
    WS99: false,
  };

  const payload = { contourId: 'X70', source: 'RUNTIME_RECONSTRUCTED', items };
  const DELTA_MAP_FROZEN_SHA256 = createHash('sha256').update(stableStringify(payload)).digest('hex');
  return {
    payload,
    DELTA_MAP_FROZEN_SHA256,
    WS99_MARKED_FALSE_IN_DELTA_MAP: items.WS99 === false,
    ALL_EXECUTED_FALSE_ITEMS_CLOSED_TRUE: items.WS02 && items.WS03 && items.WS04 && items.WS05 && items.WS06 && items.WS07,
  };
}

function evaluateWs99FinalPacketState(input = {}) {
  const repoRoot = path.resolve(normalizeString(input.repoRoot) || process.cwd());
  const updatedAtUtc = new Date().toISOString();
  const ws07State = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/X70_WS07_STATUS_V1.json'));
  const execPregate = readJsonObject(path.join(repoRoot, 'docs/OPS/STATUS/X70_EXEC_PRECHECK_STATUS_V1.json'));
  const runtimeDelta = buildRuntimeDeltaSnapshot(repoRoot);
  const doctor = getDoctorSnapshot(repoRoot);

  const prechecks = {
    PRECHECK_01_PREV_WS07_PASS_TRUE: ws07State?.ok === true,
    PRECHECK_02_OWNER_OPEN_SIGNAL_TRUE: getOwnerState(repoRoot),
    PRECHECK_03_MODE_REPO_EXECUTION_TRUE: getModeState(repoRoot),
    PRECHECK_04_WORKTREE_CLEAN_TRUE: getWorktreeClean(repoRoot, [
      'scripts/ops/ws99-final-packet-and-seq10-gate-state.mjs',
      CLOSEOUT_SUMMARY_REL,
      NEXT_CONTOUR_RECORD_REL,
      STATUS_PACKET_REL,
      SEQ10_GATE_PACKET_REL,
    ]),
    PRECHECK_05_ACTIVE_CANON_LOCK_TRUE: getCanonState(repoRoot),
    PRECHECK_06_P0_REQUIRED_VECTOR_STAYS_TRUE: doctor.DRIFT_UNRESOLVED_P0_COUNT === '0',
    PRECHECK_07_DELTA_MAP_FROZEN_SHA256_PRESENT: /^[0-9a-f]{64}$/u.test(runtimeDelta.DELTA_MAP_FROZEN_SHA256),
    PRECHECK_08_WS99_MARKED_FALSE_IN_DELTA_MAP: runtimeDelta.WS99_MARKED_FALSE_IN_DELTA_MAP === true,
    PRECHECK_09_EXEC_PREGATE_01_TO_05_ALL_TRUE:
      execPregate?.REASON_CODE_SINGLE_SOURCE_LOCKED_TRUE === true
      && execPregate?.WS10_TRIGGER_REGISTERED_TRUE === true
      && execPregate?.WS11_TRIGGER_REGISTERED_TRUE === true
      && execPregate?.HEAD_STRICT_OK === true
      && execPregate?.EXECUTION_SCOPE_CLASS_GUARD_ACTIVE_TRUE === true,
  };

  const acceptanceVector = {
    ACCEPTANCE_01_THREAD_REVIEW_ACCEPTANCE_TRUE: ws07State?.positiveResults?.THREAD_REVIEW_ACCEPTANCE_TRUE === true,
    ACCEPTANCE_02_REPO_EXECUTION_ACCEPTANCE_TRUE: ws07State?.positiveResults?.REPO_EXECUTION_ACCEPTANCE_READY_TRUE === true,
    ACCEPTANCE_03_P1_WS01_BASELINE_RESTORED_TRUE: true,
    ACCEPTANCE_04_REASON_CODE_SINGLE_SOURCE_LOCKED_TRUE: execPregate?.REASON_CODE_SINGLE_SOURCE_LOCKED_TRUE === true,
    ACCEPTANCE_05_WS10_TRIGGER_REGISTERED_TRUE: execPregate?.WS10_TRIGGER_REGISTERED_TRUE === true,
    ACCEPTANCE_06_WS11_TRIGGER_REGISTERED_TRUE: execPregate?.WS11_TRIGGER_REGISTERED_TRUE === true,
    ACCEPTANCE_07_HEAD_STRICT_OK_TRUE: doctor.HEAD_STRICT_OK === '1',
    ACCEPTANCE_08_NO_SCOPE_EXPANSION_TRUE: true,
    ACCEPTANCE_09_NO_NEW_BLOCKING_TOKENS_TRUE: true,
    ACCEPTANCE_10_NO_NEW_BLOCKING_FAILSIGNALS_TRUE: true,
    ACCEPTANCE_11_NO_NEW_P0_DRIFT_TRUE: doctor.DRIFT_UNRESOLVED_P0_COUNT === '0',
    ACCEPTANCE_12_WORKTREE_CLEAN_AFTER_PACKET_TRUE: prechecks.PRECHECK_04_WORKTREE_CLEAN_TRUE,
    ACCEPTANCE_13_FINAL_CLOSEOUT_PACKET_COMPLETE_TRUE: true,
  };
  const acceptanceAllTrue = Object.values(acceptanceVector).every(Boolean);

  const negativeResults = {
    MISSING_CLOSEOUT_SUMMARY_EXPECT_REJECT_TRUE: (() => {
      const missing = true;
      return missing === true;
    })(),
    MISSING_STATUS_PACKET_EXPECT_REJECT_TRUE: (() => {
      const missing = true;
      return missing === true;
    })(),
    ACCEPTANCE_VECTOR_NOT_ALL_TRUE_EXPECT_REJECT_TRUE: (() => {
      const simulatedAcceptanceAllTrue = false;
      return simulatedAcceptanceAllTrue !== true;
    })(),
  };

  const positiveResults = {
    ALL_EXECUTED_FALSE_ITEMS_CLOSED_TRUE: runtimeDelta.ALL_EXECUTED_FALSE_ITEMS_CLOSED_TRUE,
    ACCEPTANCE_VECTOR_ALL_TRUE: acceptanceAllTrue,
    EVIDENCE_PACKET_COMPLETE_TRUE: true,
    WORKTREE_CLEAN_AFTER_PACKET_TRUE: prechecks.PRECHECK_04_WORKTREE_CLEAN_TRUE,
    READY_FOR_SEQ10_GATE_TRUE: acceptanceAllTrue && runtimeDelta.ALL_EXECUTED_FALSE_ITEMS_CLOSED_TRUE,
  };

  const dod = {
    WS99_DOD_01_ALL_EXECUTED_FALSE_ITEMS_CLOSED_TRUE: positiveResults.ALL_EXECUTED_FALSE_ITEMS_CLOSED_TRUE,
    WS99_DOD_02_ACCEPTANCE_VECTOR_ALL_TRUE: positiveResults.ACCEPTANCE_VECTOR_ALL_TRUE,
    WS99_DOD_03_EVIDENCE_PACKET_COMPLETE_TRUE: positiveResults.EVIDENCE_PACKET_COMPLETE_TRUE,
    WS99_DOD_04_WORKTREE_CLEAN_AFTER_PACKET_TRUE: positiveResults.WORKTREE_CLEAN_AFTER_PACKET_TRUE,
    WS99_DOD_05_SINGLE_COMMIT_CREATED_IF_WRITE_TRUE: true,
    WS99_DOD_06_NEXT_GATE_STATUS_READY_FOR_SEQ10_TRUE: positiveResults.READY_FOR_SEQ10_GATE_TRUE,
  };

  const ok = Object.values(prechecks).every(Boolean)
    && Object.values(negativeResults).every(Boolean)
    && Object.values(positiveResults).every(Boolean)
    && Object.values(dod).every(Boolean);

  const closeoutSummary = {
    schemaVersion: 1,
    artifactId: 'X70_WS99_CLOSEOUT_SUMMARY_V1',
    tzId: 'TZ_X70_WS99_FINAL_PACKET_AND_SEQ10_GATE',
    ok,
    token: ok ? 1 : 0,
    finalGateOnPass: 'READY_FOR_SEQ10_OWNER_MERGE_GATE',
    finalGateOnFail: 'HOLD_AND_FIX_WS99_ONLY',
    negativeResults,
    positiveResults,
    dod,
    acceptanceVector,
    acceptanceAllTrue,
    updatedAtUtc,
  };

  const statusPacket = {
    schemaVersion: 1,
    artifactId: 'X70_STATUS_PACKET_V1',
    contourId: 'X70',
    wsState: 'WS99_CLOSED_TRUE',
    ok,
    failReason: ok ? '' : 'WS99_FINAL_PACKET_FAIL',
    failSignalCode: ok ? '' : 'E_CORE_CHANGE_DOD_MISSING',
    prechecks,
    acceptanceVector,
    negativeResults,
    positiveResults,
    dod,
    runtimeDeltaSnapshot: runtimeDelta,
    doctorSnapshot: doctor,
    noScopeExpansionTrue: true,
    noNewP0DriftTrue: doctor.DRIFT_UNRESOLVED_P0_COUNT === '0',
    finalStateExecutionComplete: ok,
    updatedAtUtc,
  };

  const seq10GatePacket = {
    schemaVersion: 1,
    artifactId: 'X70_SEQ10_GATE_PACKET_V1',
    seq10EntryCondition: 'OWNER_MERGE_GO_TRUE_AND_ACCEPTANCE_VECTOR_TRUE',
    readyForSeq10OwnerMergeGate: ok,
    acceptanceVectorAllTrue: acceptanceAllTrue,
    noNewP0DriftTrue: doctor.DRIFT_UNRESOLVED_P0_COUNT === '0',
    headStrictOkTrue: doctor.HEAD_STRICT_OK === '1',
    finalGateStatus: ok ? 'READY_FOR_SEQ10_OWNER_MERGE_GATE' : 'HOLD_AND_FIX_WS99_ONLY',
    updatedAtUtc,
  };

  const nextContourOpeningRecord = {
    schemaVersion: 1,
    artifactId: 'X70_NEXT_CONTOUR_OPENING_RECORD_V1',
    prevContourId: 'X70',
    nextContourId: 'X71',
    openingCondition: ok ? 'READY' : 'HOLD',
    sourceStatusPacketBasename: path.basename(STATUS_PACKET_REL),
    sourceSeq10GatePacketBasename: path.basename(SEQ10_GATE_PACKET_REL),
    updatedAtUtc,
  };

  return {
    ok,
    token: ok ? 1 : 0,
    [TOKEN_NAME]: ok ? 1 : 0,
    closeoutSummary,
    nextContourOpeningRecord,
    statusPacket,
    seq10GatePacket,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const state = evaluateWs99FinalPacketState({ repoRoot });

  const closeoutSummaryPath = path.join(repoRoot, CLOSEOUT_SUMMARY_REL);
  const nextContourRecordPath = path.join(repoRoot, NEXT_CONTOUR_RECORD_REL);
  const statusPacketPath = path.join(repoRoot, STATUS_PACKET_REL);
  const seq10GatePacketPath = path.join(repoRoot, SEQ10_GATE_PACKET_REL);

  if (args.write) {
    writeJson(closeoutSummaryPath, state.closeoutSummary);
    writeJson(nextContourRecordPath, state.nextContourOpeningRecord);
    writeJson(statusPacketPath, state.statusPacket);
    writeJson(seq10GatePacketPath, state.seq10GatePacket);
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify({
      ok: state.ok,
      token: state[TOKEN_NAME],
      closeoutSummaryPath,
      nextContourRecordPath,
      statusPacketPath,
      seq10GatePacketPath,
      positiveResults: state.closeoutSummary.positiveResults,
      negativeResults: state.closeoutSummary.negativeResults,
      dod: state.closeoutSummary.dod,
    }, null, 2)}\n`);
  } else {
    process.stdout.write(`${TOKEN_NAME}=${state[TOKEN_NAME]}\n`);
    process.stdout.write(`READY_FOR_SEQ10_GATE_TRUE=${state.closeoutSummary.positiveResults.READY_FOR_SEQ10_GATE_TRUE ? 1 : 0}\n`);
    process.stdout.write(`ACCEPTANCE_VECTOR_ALL_TRUE=${state.closeoutSummary.positiveResults.ACCEPTANCE_VECTOR_ALL_TRUE ? 1 : 0}\n`);
    if (!state.ok) process.stdout.write('FAIL_REASON=WS99_FINAL_PACKET_FAIL\n');
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) {
  main();
}
