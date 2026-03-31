# CORE-A4-YALKEN-PHASE07-RELEASE-HARDENING-RECONCILIATION-001

## Scope
- Restore canonical export fallback contract in command layer.
- Reconcile phase07 release-ready foundation state logic with measured upstream hold state.
- Keep release-readiness HOLD where live measured boundaries remain open.

## Allowlist
- projectCommands.mjs
- sector-u-u3-export-wiring.test.js
- PHASE07_RELEASE_READY_CORE_WRITER_PATH_FOUNDATION_V1.json
- phase07-release-ready-core-writer-path-foundation-state.mjs
- phase07-release-ready-core-writer-path-foundation-state.contract.test.js

## Reconciliation rules
- Missing `exportDocxMin` backend hook must return:
  - `code: E_UNWIRED_EXPORT_BACKEND`
  - `reason: EXPORT_DOCXMIN_BACKEND_NOT_WIRED`
- Do not mask perf failures by changing perf runner or fixture.
- `phase07-release-ready-core-writer-path-foundation-state.mjs` must accept the honest previous foundation HOLD packet with measured pending gaps:
  - `PHASE07_SCENE_SWITCH_MEASUREMENT_NOT_BOUND`
  - `PHASE07_RESET_MEASUREMENT_NOT_BOUND`

## Targeted validation set
- sector-u-u3-export-wiring.test.js
- perf-runner-deterministic.contract.test.js
- phase07-startup-runtime-measurement-baseline.contract.test.js
- phase07-release-ready-core-writer-path-foundation-state.contract.test.js
- phase07-startup-project-open-scene-switch-reset-runtime-measurements-foundation-state.contract.test.js
