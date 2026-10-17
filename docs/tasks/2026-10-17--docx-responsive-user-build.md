# Responsive one-way manuscript preparation

TASK_ID: YALKEN_DOCX_RESPONSIVE_USER_BUILD_20261017
TYPE: CORE
DOCUMENT_CLASS: PROCESS
STATUS: IMPLEMENTATION_PENDING
CLAIM_BOUNDARY: Existing one-way DOCX to new project only; worker execution is not publication authority.
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
ACTIVE_EXECUTION_CANON: v3.13a-final
BINDING_BASE_SHA: 65122a9cbe344eab1a52cb518601479fff5066ac
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_HEAD_VERIFICATION_REQUIRED=true
ROLE: Sole coding agent, no delegated or other-thread writer.

## MICRO_GOAL

O: Large manuscript preparation keeps Main and existing modal responsive; Cancel retires only its owned request and late output cannot enable Create.
T: selected bounded bytes -> fixed pure Core computation port -> existing Main validation and private admitted references -> immutable preview -> author confirms -> unchanged safe create.
H: synchronous parse, plan construction and new-project summary block Main; isolated computation for all three removes this cause without changing Core results.
B: Preserve original inputs, old projects/profiles/authority, complete text and annotations, existing strict profile, fixed bounds and publication guards. No worker writer or inline fallback.
P: small causal heartbeat and cancellation tests, full output equality, existing affected command/UI/reference/create contracts, bounded actual packaged book check and mandatory CI/delivery.
I: clean65122a9, closed predecessor227, source/build/profile/input SHA binding and freshly verified mounts.

## ARTIFACT

One narrow DocxImportComputePort with fixed read-only worker entrypoint; existing Main command adapters delegate three pure preview computations. One owned request, bounded lifecycle/deadline, cancellation and stale-result guards. Existing modal presents preparing and Cancel; no visual redesign, styles, new command catalog or new surface.

## ALLOWLIST

- src/main/docxImportComputePort.cjs
- src/main/docxImportComputeWorker.cjs
- src/main.js
- src/utils/docxImportLocalFilePreview.js
- src/renderer/commands/projectCommands.mjs
- src/renderer/editor.js
- src/renderer/editor.bundle.js
- test/contracts/docx-import-compute-port.contract.test.js
- test/contracts/revision-bridge-docx-import-reference.contract.test.js
- test/contracts/revision-bridge-docx-import-local-file-preview-command-surface.contract.test.js
- test/contracts/revision-bridge-docx-import-preview-command-surface.contract.test.js
- test/contracts/revision-bridge-docx-import-e2e-command-chain.contract.test.js
- test/contracts/rtk-generic01-create-only-import.contract.test.js
- test/contracts/rtk-word-novel-import-partition.contract.test.js
- test/unit/docx-import-preview-ui-flow.test.js
- test/unit/docx-import-product-flow-command.test.js
- docs/tasks/2026-10-17--docx-responsive-user-build.md
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/post-audit-certification-set.mjs

## DENYLIST

- package.json
- package-lock.json
- src/renderer/index.html
- src/renderer/styles.css
- src/core
- src/product/docxNewProjectCreateV1.mjs
- Pre-existing manuscripts, profiles, SOURCE80, raw histories and trust.

## CONTRACT / SHAPES

FEATURE_INTEGRATION_MANIFEST_V1
featureId: docx.import.new-project.v1.responsive-preparation
productPlane: Existing Core content parsing, deterministic plan and prepareDocxNewProject; Main retains all mutation authority.
interfacePlane: Existing DOCX preview modal and Command Kernel, no new visual zone or slot.
Commands: Existing importDocxV1, previewLocalFile, previewImportPlan and lifecycle.create preview. Cancellation is a closed action on the existing preview command, matching the current private request only.
Queries: Existing immutable projections unchanged.
Events: Existing canonical project publication unchanged.
Effects: Existing picker/read; new bounded compute-process lifecycle through named port; existing atomic create adapter unchanged.
WorkerInput: Closed operation kind, private correlation nonce and data digest, bounded immutable bytes/report/plan/identity only. No file paths, commands, capabilities or secrets from renderer.
WorkerOutput: Closed matching correlation/result envelope, fixed output ceiling; full Core result retained. Startup/crash/timeout/cancel/malformed/oversize fails closed, no inline fallback.
Identity: Recheck capability/window/project/context/generation and live private source ref after async completion. Cancel invalidates before late publication; active writer cannot be cancelled as a preview.
StateClasses: Derived preparation, transient status, existing authoring and project truth protected.
Performance: One active lifecycle including confirmed worker exit, bounded admission and120s deadline. Whole-app RSS and Main heartbeat observed; no quota increase or heap flags.
Accessibility: Existing keyboard/focus/Escape/Cancel retained, Create disabled until ready, status in text and aria-busy. No animation or new styles.
Recovery: Cancellation before Create has no canonical write; worker loss produces actionable retry. Existing persistence/rollback unaffected.
DESIGN_TOOL_ROUTER_DECLARATION: Pure product computation plus mechanical existing-modal status/cancel wiring. ui-craft state/a11y applied; exact existing native modal evidence and brain refs used. Owner optional-service prohibition takes precedence over historical tool router.
RUNTIME_SCOPE: Fresh synthetic/public-domain fixtures and OWNER-marked APFS profiles only. Final scripts/materials/evidence in dated T777 folders. Installation is a subsequent separately bound action after this delivery closes.

## IMPLEMENTATION_STEPS

1. Fresh clean identity, declaration02 and task E0 before source edits.
2. Small causal tests and explicit typed compute port; keep Core and public safe create exact.
3. Wire owned cancellation and existing modal; prove stale and foreign requests cannot publish or mutate.
4. Focused affected regression, official generated bundle, mechanical existing byte companions, frozen packaged responsiveness and complete data proof.
5. Commit/push/PR, all required CI, merge and clean exact-head checks; only then corpus/install contour.

## CHECKS

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
CHECK_01_PRE_IDENTITY: Registered worktree clean65122a9, mandatory startup/canon reads, verified mounts and declaration02 PASS; predecessor227 closed.
CHECK_02_POST_E0: Original ops-gate validates this exact task before runtime edits.
CHECK_03_POST_COMPUTE: Actual pure Core outputs equal baseline; Main heartbeat live; malformed/bounds/nonce/operation/crash/timeout/failed-stop controls.
CHECK_04_POST_CANCEL: Owned current request only, Cancel and project/window change reject late results; no project writes; writer-phase cancellation refused.
CHECK_05_POST_AFFECTED: Existing import/helper/reference/admission/new-project atomicity, default legacy and UI flow contracts; zero skips/todo.
CHECK_06_POST_BINDINGS: Official builder idempotent; exact source/protected pins, inventory and prior approvals; guardrails, OSS and audit.
CHECK_07_POST_NATIVE: Exact packaged public preview/Cancel and book creation with independent complete persisted readback; no synthetic replacement for required native outcome.
CHECK_08_POST_DELIVERY: Full required CI, exact merge tree/head and fresh relevant checks, clean scope.

## STOP_CONDITION

Foreign WIP, stale authority/base, bypass, canonical output mismatch, unresolved failed process stop or mandatory missing evidence stops the contour. Three identical failures stop that loop with exact inputs/hashes and one new hypothesis. No reset/stash/clean/rebase/force-push, quotas/dependencies or external integration expansion.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1; one text block, KEY: VALUE, basenames only.

## FAIL_PROTOCOL

Preserve actual failed log with expected/actual/SHA/seed/input hashes. No self-PASS, no screenshot-only correctness, no count-only acceptance or historical native promotion.

SOURCE_OBSERVATIONS: Baseline03 actual100k native Word helper causes2602ms Main heartbeat gap. Worker07 complete result is byte-equivalent with identical SHA and18.9ms maximum observed gap; this is component evidence, not whole-app acceptance. Final maintained contracts11 pass169 cases and affected09 pass208 without fail/cancel/skip/todo. The18 new pure-process cases live in the existing maintained rtk-generic01 contract, preserving its complete old prefix, graph membership and inventory1600. Preliminary untracked test file was moved byte-for-byte into that maintained scope and removed, so no second test graph is introduced. Old UI ABA assertion now requires the newer preparing modal to remain visible and disabled; stale completion still cannot publish. Empty-job optional-ID equality defect found04 is corrected with explicit job existence. Worker retirement is bounded to1s after stop request and a failed/unconfirmed stop permanently refuses new work. Actual native, varied-book corpus, installation and full delivery remain pending.
