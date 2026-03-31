# CORE-A4-YALKEN-PHASE02-COMMAND-KERNEL-LOCK-001

## Task
- TASK_ID: CORE-A4-YALKEN-PHASE02-COMMAND-KERNEL-LOCK-001
- TASK_CLASS: CURRENT_LANE_PHASE02_COMMAND_KERNEL_ONLY
- STATUS: BOUNDED_EXECUTION_SUBSLICE

## Scope
- IN:
  - commandBusGuard.mjs: fail-closed caller identity and payload contract checks in command bus entry.
  - command-surface-bus-only.contract.test.js: negative contract coverage for untrusted caller and non-object payload bypass attempts.
  - command-surface-caller-trust.contract.test.js: explicit trust fail-close proof for bus guard entrypoint.
- OUT:
  - main.js, editor.js, editor.bundle.js and all UI surfaces.
  - recovery surfaces.
  - runtime bridge and status docs.
  - new dependencies.

## Contract Targets
1. Single-entry command bus path remains mandatory.
2. Untrusted caller identity is rejected at command bus entry.
3. Payload contract violations are rejected at command bus entry.
4. Existing command namespace and catalog contracts remain green.

## Guardrails
- Keep command kernel changes narrow and fail-closed.
- Do not widen scope into UI, recovery, or status artifacts.
- Keep exact allowlist-only diff.

## Next
- NEXT_STEP_AFTER_SUCCESS: STOP_AND_WAIT_FOR_ONE_NEW_EXPLICIT_TASK_BRIEF_ONLY
