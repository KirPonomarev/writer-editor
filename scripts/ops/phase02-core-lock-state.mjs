#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { evaluatePhase01ExecuteReadinessState } from './phase01-execute-readiness-state.mjs';

const FAIL_REASON_FORCED_NEGATIVE = 'E_PHASE02_CORE_LOCK_FORCED_NEGATIVE';
const FAIL_REASON_UNEXPECTED = 'E_PHASE02_CORE_LOCK_UNEXPECTED';
const LOCK_PACKET_PATH = 'docs/OPS/STATUS/PHASE02_CORE_LOCK_PACKET_V1.json';
const COMMAND_SURFACE_STATE_PATH = 'scripts/ops/command-surface-state.mjs';
const RECOVERY_IO_STATE_PATH = 'scripts/ops/recovery-io-state.mjs';
const MIGRATION_STATE_PATH = 'scripts/ops/migration-completeness-verifier-state.mjs';

function parseArgs(argv) {
  const out = { json: false, forceNegative: false };
  for (const token of argv) {
    if (token === '--json') out.json = true;
    if (token === '--force-negative') out.forceNegative = true;
  }
  return out;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(relativePath), 'utf8'));
}

function runNodeJsonScript(relativePath) {
  const result = spawnSync(process.execPath, [path.resolve(relativePath), '--json'], {
    encoding: 'utf8',
  });
  return {
    status: typeof result.status === 'number' ? result.status : 1,
    payload: JSON.parse(String(result.stdout || '{}')),
  };
}

function asCheck(status, measured, note) {
  return { status, measured, note };
}

function evaluatePhase02CoreLockState(input = {}) {
  const forceNegative = Boolean(input.forceNegative);

  try {
    const phase01ExecuteState = evaluatePhase01ExecuteReadinessState({});
    const lockPacketExists = fs.existsSync(path.resolve(LOCK_PACKET_PATH));
    const lockPacket = lockPacketExists ? readJson(LOCK_PACKET_PATH) : null;
    const commandSurface = runNodeJsonScript(COMMAND_SURFACE_STATE_PATH);
    const recoveryIo = runNodeJsonScript(RECOVERY_IO_STATE_PATH);
    const migration = runNodeJsonScript(MIGRATION_STATE_PATH);

    const phase01ExecutePass = phase01ExecuteState.overallStatus === 'PASS'
      && phase01ExecuteState.executeReadinessStatus === 'PASS';
    const lockPacketPass = lockPacket?.status === 'PASS';
    const lockPacketHold = lockPacket?.phase02ReadinessStatus === 'HOLD';
    const commandSurfacePass = commandSurface.status === 0
      && commandSurface.payload.ok === true
      && commandSurface.payload.COMMAND_SURFACE_ENFORCED_OK === 1;
    const recoveryIoPass = recoveryIo.status === 0
      && recoveryIo.payload.RECOVERY_IO_OK === 1;
    const migrationPass = migration.status === 0
      && migration.payload.MIGRATION_COMPLETENESS_VERIFIER_OK === 1;
    const targetIdsLocked = Array.isArray(lockPacket?.lockedTargetIds)
      && lockPacket.lockedTargetIds.includes('STABLE_SAVE_AND_RECOVERY')
      && lockPacket.lockedTargetIds.includes('ZERO_BYPASS_COMMAND_PATH')
      && lockPacket.lockedTargetIds.includes('MIGRATION_COMPLETENESS_AND_TRACEABILITY');
    const pendingGapRecorded = Array.isArray(lockPacket?.phase02PendingGapIds)
      && lockPacket.phase02PendingGapIds.length === 0;
    const lockPacketReady = lockPacket?.phase02ReadinessStatus === 'PASS';

    const checkStatusById = {
      PHASE01_EXECUTE_PASS: asCheck(phase01ExecutePass ? 'GREEN' : 'OPEN_GAP', true, phase01ExecutePass ? 'PHASE01_EXECUTE_PASS' : 'PHASE01_EXECUTE_NOT_PASS'),
      LOCK_PACKET_PRESENT: asCheck(lockPacketExists ? 'GREEN' : 'OPEN_GAP', true, lockPacketExists ? 'LOCK_PACKET_PRESENT' : 'LOCK_PACKET_MISSING'),
      LOCK_PACKET_PASS: asCheck(lockPacketPass ? 'GREEN' : 'OPEN_GAP', true, lockPacketPass ? 'LOCK_PACKET_PASS' : 'LOCK_PACKET_NOT_PASS'),
      LOCK_PACKET_READY: asCheck(lockPacketReady ? 'GREEN' : 'OPEN_GAP', true, lockPacketReady ? 'LOCK_PACKET_READY' : 'LOCK_PACKET_NOT_READY'),
      COMMAND_SURFACE_PASS: asCheck(commandSurfacePass ? 'GREEN' : 'OPEN_GAP', true, commandSurfacePass ? 'COMMAND_SURFACE_PASS' : 'COMMAND_SURFACE_NOT_PASS'),
      RECOVERY_IO_PASS: asCheck(recoveryIoPass ? 'GREEN' : 'OPEN_GAP', true, recoveryIoPass ? 'RECOVERY_IO_PASS' : 'RECOVERY_IO_NOT_PASS'),
      MIGRATION_COMPLETENESS_PASS: asCheck(migrationPass ? 'GREEN' : 'OPEN_GAP', true, migrationPass ? 'MIGRATION_COMPLETENESS_PASS' : 'MIGRATION_COMPLETENESS_NOT_PASS'),
      TARGET_IDS_LOCKED: asCheck(targetIdsLocked ? 'GREEN' : 'OPEN_GAP', true, targetIdsLocked ? 'TARGET_IDS_LOCKED' : 'TARGET_IDS_DRIFT'),
      PENDING_GAP_CLEARED: asCheck(pendingGapRecorded ? 'GREEN' : 'OPEN_GAP', true, pendingGapRecorded ? 'PENDING_GAP_CLEARED' : 'PENDING_GAP_DRIFT'),
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
        phase02ReadinessStatus: 'PASS',
        greenCheckIds,
        openGapIds: Array.from(new Set([...openGapIds, 'FORCED_NEGATIVE_PATH'])),
        checkStatusById,
        phase02PendingGapIds: lockPacket?.phase02PendingGapIds || [],
      };
    }

    return {
      ok: openGapIds.length === 0,
      failReason: '',
      overallStatus: openGapIds.length === 0 ? 'PASS' : 'HOLD',
      phase02ReadinessStatus: lockPacketReady ? 'PASS' : 'UNKNOWN',
      greenCheckIds,
      openGapIds,
      checkStatusById,
      phase02PendingGapIds: lockPacket?.phase02PendingGapIds || [],
    };
  } catch (error) {
    return {
      ok: false,
      failReason: FAIL_REASON_UNEXPECTED,
      overallStatus: 'HOLD',
      phase02ReadinessStatus: 'UNKNOWN',
      greenCheckIds: [],
      openGapIds: ['PHASE02_CORE_LOCK_EVALUATION_ERROR'],
      checkStatusById: {},
      phase02PendingGapIds: [],
      errorMessage: error && typeof error.message === 'string' ? error.message : 'UNKNOWN',
    };
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const state = evaluatePhase02CoreLockState({ forceNegative: args.forceNegative });

  if (args.json) {
    console.log(JSON.stringify(state, null, 2));
  } else {
    console.log(`PHASE02_CORE_LOCK_OK=${state.ok ? 1 : 0}`);
    console.log(`PHASE02_CORE_LOCK_OVERALL_STATUS=${state.overallStatus}`);
    console.log(`PHASE02_CORE_LOCK_READINESS_STATUS=${state.phase02ReadinessStatus}`);
    console.log(`PHASE02_CORE_LOCK_OPEN_GAP_IDS=${state.openGapIds.join(',')}`);
    console.log(`PHASE02_CORE_LOCK_FAIL_REASON=${state.failReason}`);
  }

  process.exit(state.ok ? 0 : 1);
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(selfPath)) {
  runCli();
}

export { evaluatePhase02CoreLockState };
