# DOCX import: bounded preview references

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: C1_IMPORT_BREADTH_REPAIR_20260916
BINDING_BASE_SHA: 0a45daf438c778143afad28ba02b519393a11f9b
AUTHORITY: Owner directly requested continuing the fast import/export implementation after the documented 64-paragraph failure.

## MICRO_GOAL

Repair the recorded 64-paragraph import failure through bounded main-owned references.

## ARTIFACT

Existing DOCX command adapters, bounded snapshot store, renderer bundle, executable regression cases and exact runtime/Lab qualification.

## ALLOWLIST

- src/main.js
- src/utils/docxImportPreviewReferences.js
- src/renderer/commands/projectCommands.mjs
- test/contracts/revision-bridge-docx-import-reference.contract.test.js
- docs/tasks/2026-09-16--docx-import-preview-reference.md
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/post-audit-certification-set.mjs
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- src/renderer/editor.bundle.js
- test/contracts/rtk-interop-100-denominator.contract.test.js
- docs/ARCH_DIFF_LOG.md

- test/contracts/revision-bridge-docx-import-preview-command-surface.contract.test.js

## DENYLIST

- src/core/ipc-envelope-v1.cjs
- src/renderer/index.html
- package.json
- package-lock.json
- scripts/ops/rtk-interop-data-c1-readback.py

## CONTRACT / SHAPES

### MAP

O: The saved 64-paragraph input completes native Word round trip, confirmed import, persisted/reopened readback and independent TEXT/ORDER acceptance with a measured full cycle.
T: Validated DOCX bytes -> main-owned immutable preview -> existing command validation and admission -> atomic project writer -> persisted scene and receipt -> independent raw checker.
H: The full content report exceeds the 256-key IPC budget. Main-owned snapshot references keep the message small while preserving all content and plan checks. The original inline payload must still fail the unchanged envelope guard.
B: Preserve old evidence, denominator, raw oracle, payload limits, capability checks, UI appearance, atomic persistence and existing inline compatibility. One PR plus local Lab driver qualification; revert both together.
P: Saved-byte command replay; negative reference/lifecycle tests; affected DOCX and IPC contracts; native 64-paragraph plus small control; independent oracle; inventory, guardrails, required CI, merged-head rerun.
I: Bound to the exact base above. Actual final candidate and merged identities belong in the external task report. Input is the existing synthetic paragraph-64-short-start fixture; no private documents.

### FEATURE_INTEGRATION_MANIFEST_V1

FEATURE_ID: DOCX_IMPORT_PREVIEW_REFERENCE_REPAIR_V1
INTEGRATION_MODE: BOUNDED_EXISTING_COMMAND_ADAPTER_REPAIR
PRODUCT_PLANE: Product Core owns parsed document and admitted import plan; the command adapter retains bounded, expiring snapshots.
INTERFACE_PLANE: Existing preview and confirmation consume unchanged projections and forward an opaque reference. No new surface or visual change.
COMMANDS: cmd.project.docx.previewContent; cmd.project.docx.previewLocalFile; cmd.project.docx.previewImportPlan; cmd.project.docx.importSafeCreate.
QUERIES: Existing preview projections; no new query route.
EVENTS: Existing import receipt; no new event bus.
EFFECTS: Existing bounded file reader and atomic project writer, exclusively through their current ports.
STATE_CLASSES: DERIVED_STATE for disposable snapshots; PROJECT_STATE only through existing import transaction. No authoring or shell state write.
IDENTITY: Random reference, immutable source snapshot, reference kind, main-owned project root and lifecycle generation; no path authority from input.
CAPABILITY: Unchanged envelope validation, command allowlist, profile gate, validated plan admission and persistence transaction.
ASYNC_PUBLICATION: Capture context before awaits; reject changed context before reference publication and before queued import effects.
FALLBACK: Missing, expired, evicted, malformed, wrong-kind or wrong-project reference requires fresh preview; no implicit success.
RECOVERY: References are disposable and not persisted. Atomic import, durable receipt and idempotent reapply remain in the existing writer.
PERFORMANCE: Bound entries, per-snapshot bytes, total bytes and TTL; no timer, no typing-path work. Time includes native run, acceptance and machine report.
ACCESSIBILITY: Existing modal, keyboard handling and statuses unchanged.
SURFACE_MANIFEST: EXISTING_SURFACE_UNCHANGED.
DESIGN_TOOL_ROUTER: DISABLED_FOR_NON_VISUAL_COMMAND_ADAPTER_REPAIR.
CURRENT: Original full-report IPC request fails on saved 64-paragraph case. No repaired outcome claimed before execution.
TARGET: Saved 64-paragraph case passes with unchanged raw preservation law. No claim about other routes, formatting, packaged profile or all 1120 cells.

## IMPLEMENTATION_STEPS

1. Preserve the old failing artifact and verify the declared base.
2. Bind immutable previews to bounded, expiring main-owned references and project lifecycle.
3. Forward references through the existing confirmation route and retain all domain and writer checks.
4. Run negative controls, independent replay and actual Word cases with timings.
5. Qualify the exact runtime and Lab driver, deliver and repeat on merged head.

## CHECKS

CHECK_1_PRE_IDENTITY: Bootstrap, canonical identity, clean branch, encrypted writable T7 and architecture preflight.
CHECK_2_POST_NEGATIVE: Reference forgery, mutation, mixed payload, kind, lifetime, storage budgets, project/ABA changes and async stale result; original oversized inline envelope still rejected.
CHECK_3_POST_CHAIN: The previous head had a stale assertion adding a blank paragraph between two paragraphs; correct it and separately assert preservation of an explicit empty paragraph. Actual parser and command adapter replay, existing DOCX preview/admission/atomic/idempotency contracts and unchanged IPC tests.
CHECK_4_POST_NATIVE: Actual Word plus renderer confirmation on final merged head; independent raw evidence and measured full cycle.
CHECK_5_POST_DELIVERY: Inventory, governance, guardrails, required CI, push, PR, merge and exact merged verification. Historical runs are not credited on a new runtime SHA.

## STOP_CONDITION

Ambiguous identity, foreign changes, weakened oracle, missing mandatory proof or wrong-project write stops delivery.

## REPORT_FORMAT

One text block: task, before/after/merged SHA, changed basenames, tests, commit, push, PR, CI, merge, exact-head evidence, limits and next step.

## FAIL_PROTOCOL

Preserve failing input, expected/actual, exact revision, hashes and seconds. After three identical failures stop that experiment and change the hypothesis. Never replace raw proof with a count or waive a failing oracle.
