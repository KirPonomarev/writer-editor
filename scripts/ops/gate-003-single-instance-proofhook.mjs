#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TASK_ID = 'GATE_003_SINGLE_INSTANCE_READINESS_001';
const FAIL_REASON_FORCED_NEGATIVE = 'E_GATE_003_SINGLE_INSTANCE_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_GATE_003_SINGLE_INSTANCE_UNEXPECTED';
const MAIN_PATH = 'src/main.js';

function parseArgs(argv) {
  const out = { json: false, forceNegative: false, rootDir: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
    if (token === '--root' && i + 1 < argv.length) {
      out.rootDir = String(argv[i + 1] || '').trim() || process.cwd();
      i += 1;
    }
  }
  return out;
}

function readText(rootDir, relativePath) {
  return fs.readFileSync(path.resolve(rootDir, relativePath), 'utf8');
}

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function evaluateGate003SingleInstanceReadiness(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const mainText = readText(input.rootDir || process.cwd(), MAIN_PATH);

    const lockVariableDeclared = /const singleInstanceLockAcquired = app\.requestSingleInstanceLock\(\);/u.test(mainText);
    const lockFailureTerminalPath = /if \(!singleInstanceLockAcquired\)\s*\{\s*app\.quit\(\);\s*\}/u.test(mainText);
    const secondInstanceHandlerRegistered = /app\.on\('second-instance',\s*\(\)\s*=>\s*\{\s*focusExistingMainWindow\(\);\s*\}\);/u.test(mainText);
    const focusHelperDeclared = /function focusExistingMainWindow\(\)\s*\{/u.test(mainText);
    const focusHelperRestoresMinimizedWindow = /function focusExistingMainWindow\(\)[\s\S]*?mainWindow\.isMinimized\(\)[\s\S]*?mainWindow\.restore\(\);/u.test(mainText);
    const focusHelperShowsHiddenWindow = /function focusExistingMainWindow\(\)[\s\S]*?mainWindow\.isVisible\(\)[\s\S]*?mainWindow\.show\(\);/u.test(mainText);
    const focusHelperFocusesWindow = /function focusExistingMainWindow\(\)[\s\S]*?mainWindow\.focus\(\);/u.test(mainText);
    const whenReadyGuardedByLock = /app\.whenReady\(\)\.then\(async \(\) => \{\s*if \(!singleInstanceLockAcquired\)\s*\{\s*return;\s*\}/u.test(mainText);

    const checkStatusById = {
      LOCK_VARIABLE_DECLARED: asCheck(lockVariableDeclared ? 'GREEN' : 'OPEN_GAP', true, lockVariableDeclared ? 'LOCK_VARIABLE_DECLARED' : 'LOCK_VARIABLE_MISSING'),
      LOCK_FAILURE_TERMINAL_PATH: asCheck(lockFailureTerminalPath ? 'GREEN' : 'OPEN_GAP', true, lockFailureTerminalPath ? 'LOCK_FAILURE_TERMINAL_PATH' : 'LOCK_FAILURE_TERMINAL_PATH_MISSING'),
      SECOND_INSTANCE_HANDLER_REGISTERED: asCheck(secondInstanceHandlerRegistered ? 'GREEN' : 'OPEN_GAP', true, secondInstanceHandlerRegistered ? 'SECOND_INSTANCE_HANDLER_REGISTERED' : 'SECOND_INSTANCE_HANDLER_MISSING'),
      FOCUS_HELPER_DECLARED: asCheck(focusHelperDeclared ? 'GREEN' : 'OPEN_GAP', true, focusHelperDeclared ? 'FOCUS_HELPER_DECLARED' : 'FOCUS_HELPER_MISSING'),
      FOCUS_HELPER_RESTORES_MINIMIZED_WINDOW: asCheck(focusHelperRestoresMinimizedWindow ? 'GREEN' : 'OPEN_GAP', true, focusHelperRestoresMinimizedWindow ? 'FOCUS_HELPER_RESTORES_MINIMIZED_WINDOW' : 'FOCUS_HELPER_RESTORE_MISSING'),
      FOCUS_HELPER_SHOWS_HIDDEN_WINDOW: asCheck(focusHelperShowsHiddenWindow ? 'GREEN' : 'OPEN_GAP', true, focusHelperShowsHiddenWindow ? 'FOCUS_HELPER_SHOWS_HIDDEN_WINDOW' : 'FOCUS_HELPER_SHOW_MISSING'),
      FOCUS_HELPER_FOCUSES_WINDOW: asCheck(focusHelperFocusesWindow ? 'GREEN' : 'OPEN_GAP', true, focusHelperFocusesWindow ? 'FOCUS_HELPER_FOCUSES_WINDOW' : 'FOCUS_HELPER_FOCUS_MISSING'),
      WHEN_READY_GUARDED_BY_LOCK: asCheck(whenReadyGuardedByLock ? 'GREEN' : 'OPEN_GAP', true, whenReadyGuardedByLock ? 'WHEN_READY_GUARDED_BY_LOCK' : 'WHEN_READY_LOCK_GUARD_MISSING'),
    };

    const greenCheckIds = Object.entries(checkStatusById)
      .filter(([, value]) => value.status === 'GREEN')
      .map(([id]) => id);
    const openGapIds = Object.entries(checkStatusById)
      .filter(([, value]) => value.status !== 'GREEN')
      .map(([id]) => id);

    if (forceNegative) {
      return {
        ok: false,
        failReason: FAIL_REASON_FORCED_NEGATIVE,
        overallStatus: 'HOLD',
        gate003SingleInstanceStatus: 'HOLD',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        taskId: TASK_ID,
      };
    }

    const overallPass = openGapIds.length === 0;
    return {
      ok: overallPass,
      failReason: '',
      overallStatus: overallPass ? 'PASS' : 'HOLD',
      gate003SingleInstanceStatus: overallPass ? 'PASS' : 'HOLD',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      taskId: TASK_ID,
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      gate003SingleInstanceStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['GATE_003_SINGLE_INSTANCE_EVALUATION_ERROR'],
      checkStatusById: {},
      taskId: TASK_ID,
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluateGate003SingleInstanceReadiness(args);

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`GATE_003_SINGLE_INSTANCE_OK=${state.ok ? 1 : 0}`);
    console.log(`GATE_003_SINGLE_INSTANCE_STATUS=${state.gate003SingleInstanceStatus}`);
    console.log(`GATE_003_SINGLE_INSTANCE_OPEN_GAP_IDS=${(state.openGapIds || []).join(',')}`);
    console.log(`GATE_003_SINGLE_INSTANCE_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluateGate003SingleInstanceReadiness };
