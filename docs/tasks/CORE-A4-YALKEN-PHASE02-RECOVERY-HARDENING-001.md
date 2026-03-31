# CORE-A4-YALKEN-PHASE02-RECOVERY-HARDENING-001

## Task
- TASK_ID: CORE-A4-YALKEN-PHASE02-RECOVERY-HARDENING-001
- TASK_CLASS: CURRENT_LANE_PHASE02_RECOVERY_ONLY
- STATUS: BOUNDED_EXECUTION_SLICE

## Scope
- IN:
  - index.mjs: deterministic snapshot fallback traversal and typed mismatch payload details.
  - snapshotFile.mjs: canonical snapshot candidate filtering and deterministic ordering.
  - ioErrors.mjs: typed error propagation for pre-typed non-instance errors.
  - recovery-snapshot-fallback.contract.test.js, recovery-typed-errors.contract.test.js, recovery-replay.contract.test.js: recovery contract hardening.
- OUT:
  - command kernel surfaces,
  - UI/runtime bridge surfaces,
  - status and factual docs,
  - new dependencies.

## Contract Targets
1. Corrupt primary content can deterministically fall back to next valid snapshot when latest snapshot is damaged.
2. Snapshot mismatch stays typed and includes deterministic attempted snapshot list.
3. Recovery replay over identical artifacts stays deterministic.
4. Atomic-write and corruption guard contracts remain green.

## Guardrails
- Preserve existing atomic write boundary.
- Preserve existing projectId/data-core behavior from previous slice.
- Stop on any non-allowlist file need.

## Next
- NEXT_STEP_AFTER_SUCCESS: STOP_AND_WAIT_FOR_ONE_NEW_EXPLICIT_TASK_BRIEF_ONLY
