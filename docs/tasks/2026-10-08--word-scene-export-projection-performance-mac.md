TASK_ID: WORD_SCENE_PENDING_EXPORT_PERFORMANCE_MAC_20261008
MILESTONE: macOS large-novel Word exchange; bounded scene-export performance step
TYPE: CORE
STATUS: CODE_PROOF_COMPLETE_DELIVERY_OPEN
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BINDING_BASE_SHA: 092387eae3a0a6ee606fdbe100ee0828c58b40a2
BRANCH: codex/word-scene-export-projection-perf-mac-20261008
COMMIT_REQUIRED: true
PUSH_REQUIRED: true
PR_REQUIRED: true
MERGE_REQUIRED: true
DESIGN_TOOL_ROUTER: bound to validated pre-edit declaration; existing UI unchanged

## MICRO_GOAL

Ordinary current-scene DOCX export with pending text and manuscript notes
must reuse one freshly validated local ledger and one schema3 note projection
during its synchronous readSource paragraph traversal. Preserve every output
byte and every existing source, capability, cohort and atomic-write guard.
This is one export outcome and one rollback. Save/redo optimisation, broader
schemas, resource caps and the full large-novel release remain separate and OPEN.

## ARTIFACT

A small Main query-placement correction, appended readable behavioral regression,
physical tiny-corpus DOCX artifacts and complete required delivery.
Root owns task/docs/OPS, proof review and Git. Separate code writer owns exactly
the two runtime/test paths below. Predecessor PR2093 is merged at binding base;
its exact merged focused248of248, ZIP14of14 and guardrails actually passed.
Native short proof ran at predecessor72272be9 with the identical whole tree;
it is not a new native run at this base or a full-novel release certificate.

## ALLOWLIST

- src/main.js
- test/unit/export-book-profile-binding.test.js
- docs/tasks/2026-10-08--word-scene-export-projection-performance-mac.md
- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/WORKLOG.md
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/post-audit-certification-set.mjs

Runtime budget: at most80 changed Main lines, confined to local readSource
projection placement. Behavior budget: at most500 appended test lines; old test
prefix and assertions stay byte-exact. Root documents stay concise.
Seven OPS companions may update exact source-binding hashes after writer HOLD
and append only this already declared task to admission/source bindings. Preserve
the complete old622-path and480-binding prefixes,1597 inventory paths and230
historical certification tuples; append one nonrecursive successor tuple.
No approval-only PR or alternate tracker. External proof uses owned evidence
directory, finite synthetic fixtures and the existing bounded runner.

## DENYLIST

Core, renderer/generated/preload, exporter and I/O implementation; dependencies,
commands/channels, schemas, format/caps/timeouts, public APIs, global/cross-call
cache, caller trust flags, skipped or weakened tests, private input, new writers,
new runtime network or UI. Do not edit the old199KB implementation task.
No old crash/failed heavy profile replay, native/Word launch during code phase,
AX/TCC/settings/install/macros, foreign process close, reset/stash/clean/rebase,
direct protected push, merge bypass or owner canonical checkout mutation.

## CONTRACT / SHAPES

FEATURE_INTEGRATION_MANIFEST_V1
MATERIALIZATION_MODE: EXISTING_SEAM
PRODUCT_PLANE: Core owns complete scene/ledger/notes/comments and all validation.
COMMAND_PLANE: cmd.project.export.docxMin keeps existing Kernel capability routing.
INTERFACE_PLANE: existing immutable export projections only; no UI contribution.
OPERATIONS: QUERY, COMMAND, EFFECT; no new Event or background worker.
PRODUCT_PORTS: current checked scene/annotation reads, export-target validation,
queueDiskOperation and writeBufferAtomic; no new port or writer.
DESIGN_OS_PORTS: none added; existing surfaces and typed slots unchanged.
STATE_CLASSES: PROJECT_STATE and AUTHORING_WORKING_STATE unchanged;
DERIVED_STATE is synchronous call-local data; SHELL_STATE/TRANSIENT_STATE unchanged.
READ_PATH: fresh canonical snapshot -> exact scene/notes/comments cohort ->
Core readLedger -> optional schema3 noteProjection -> existing noteBlocks/builder.
WRITE_PATH: existing Kernel dispatch -> handleExportDocxMin -> runDocxMinExport ->
target validation -> queued complete source revalidation -> atomic output.
IDENTITY_GUARDS: preserve file, project/root/id, scene, subject/lifecycle owner,
generation, dirty/autosave, full source/manifest/notes/comments cohort and target.
CAPABILITY: retain entry, source completion and queued pre-write revalidation.
FALLBACK_RECOVERY: existing typed refusal with zero output write; no silent empty
notes, stale cached result or conversion of invalid data into a valid projection.
SECURITY_INPUT: current raw input validation and bounds remain unchanged.
HOT_PATH: no new work on input; queries reused only after the last annotation await
inside one synchronous readSource body. Each invocation must query Core again.
PERFORMANCE: one proof process lane,900s finite groups,40,000,000,000-byte development
RSS limit. Old path is exercised only at10/20/40 paragraphs. Production30s/512MiB
and full native novel matrix remain OPEN. No arbitrary timing threshold.
ACCESSIBILITY: no UI, focus, keyboard, locale or visual changes.
MIGRATION_ROLLBACK: no migration; one ordinary PR/revert of this contour.
BASE_REALITY: Main directly reads the ledger P+2 times and invokes schema3
noteProjection P times before the builder; every projection independently validates
inside Core. Builder/bridge checks are mandatory and outside that counter boundary.
WORKING_CODE_OBSERVED: one direct local ledger query and one optional schema3
projection per readSource on the final frozen code. This proves eliminated
repeated calls on the tiny corpus; save/redo and full-novel timing are unmeasured.
SURFACE_MANIFEST_V1: no new or changed visual zone; existing surfaces preserved.

O: same complete physical DOCX and refusal behavior with bounded query counts.
T: Core truth -> Kernel capability -> existing queued atomic DOCX output.
H: hoist redundant local queries; tiny old/new complete artifacts match.
B: protect all canonical/source bytes, old assertions and every publication guard.
P: causal RED, full old/new artifacts, independent semantic review, affected whole
suites, idempotent compiler, required gates/CI and exact merged verification.
I: exact binding SHA, registered worktree, verified encrypted T7 identity,
immutable source/artifact hashes and explicit proof phase/build/profile identity.

## IMPLEMENTATION_STEPS

1. Root completes clean bootstrap, full applicable canon/source reads and preflight;
   prepares this HARD task and factual docs, then executes its exact E0 before code.
2. Writer verifies root release pins and appends tests using actual Main snapshot,
   cohort/capability/handler, real Core, builder, ZIP and bridge. Persist whole
   source/notes/comments/ZIP artifacts at10/20/40 paragraphs before runtime edit.
3. Execute causal RED on old Main. Full content/artifact observations precede the
   expected query-count failure. Keep raw failed log; count-only evidence is invalid.
4. Hoist the existing readLedger result and optional schemaVersion===3
   noteProjection before map, within the current active-notes/comments block.
   Do not broaden schema5, change guards, mutate inputs or cache across calls.
5. Run complete affected suites and audited compiler twice. Freeze code/test and
   physical artifacts at HOLD; root independently reviews source, full output,
   adversarial/stale controls, scope, old prefixes and generated byte identity.
6. Root updates only seven mechanical bindings, final factual docs and required
   gates; commit/push/PR/official CI/normal merge, then verify exact merged head.
   Native/large current-code proof needs a separate explicit admission afterward.

## CHECKS

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
CHECK_01_PRE_IDENTITY: clean registered branch/base/remote and verified T7;
bootstrap, full applicable reads and architecture preflight actually exit0.
The clean preparation admission precedes root task creation. Exact new-task E0
runs after creation and before writer code release; do not claim otherwise.
CHECK_02_POST_SCOPE: ONLY_ALLOWED_CHANGE_NODE_HARD baselinev1.3 exact allowlist,
git diff check, budgets, old source/test prefix and all denied paths preserved.
CHECK_03_POST_CAUSAL: actual old/new Main readSource at10/20/40, delegated real Core;
new direct counts1/1, full ZIP member/whole DOCX byte parity plus independent
Current/Original body,3rich notes/reference offsets, discussion/provenance/anchors.
CHECK_04_POST_NEGATIVE: malformed/forged visible-v-ledger, consumed/split notes,
schema1/2/5 and null/absent/plain controls; fresh repeated export after mutation;
late scene/notes/comments/manifest/identity/generation/capability/target drift.
Zero export writes and unchanged business state except deliberate injections.
CHECK_05_POST_AFFECTED: execute complete seven files, no test-name filtering:
test/unit/export-book-profile-binding.test.js;
test/unit/docx-min-export-handler.test.js;
test/unit/docx-min-builder.test.js;
test/unit/docx-scene-comments.test.js;
test/contracts/rtk-word-pending-notes.contract.test.js;
test/contracts/rtk-word-scene-comment-export.contract.test.js;
test/contracts/rtk-word-canonical-comment-reexport.contract.test.js.
CHECK_06_POST_COMPILER: audited scripts/build-renderer.mjs twice; exact136 compiler
inputs and generated/preload outputs preserved, second process idempotent.
CHECK_07_POST_GATES: exact task E0, current interop-data-C1 strict actual runner,
frozen R24 E0 behavior/mutants, OSS policy, npm audit and agent guardrails; official
required CI must execute actual full inventories rather than echoes/count claims.
CHECK_08_POST_DELIVERY: exact staged13path maximum, commit, push, attached PR,
all required actual CI, normal merge, exact remote/head/tree and clean merged
verification with relevant whole-suite repeat; report actual outcomes and limits.


ACTUAL_FROZEN_CODE_PROOF: whole seven-file suite183of183 passed with zero failed,
cancelled, skipped or todo tests;23.187s and sampled owned RSS508755968bytes.
Final code is Main f54b5d5688d85ab9ee478b21573b5c15f75a0b3e32091d8a235cf1822ce56fa1;
Main change6added/3removed lines,292test lines appended, old prefix unchanged.
Independent root reads compare complete Current/Original bodies, native revision
metadata,3rich note bodies/offsets and4discussion messages/provenance/anchors in
three10/20/40-paragraph DOCX cases. Whole ZIP and every member are byte-identical
to old output while direct readSource query counts become1/1 from P+2/P.
Thirty physical final cases include13queued drift refusals and5invalid source
refusals with zero output. Fresh source metadata and note bodies survive a second
export. Root rehashed all2336 retained corpus files and reviewed source/guards.
Both compiler processes actually exit0;136inputs and tracked generated source
remain exact base. Ignored dist outputs match pinned pre-build and both builds.
Two old32-test runs retain24pass/8fail; intermediate32of32 is not final evidence.
Root reader errors and corrected readers are retained separately from product
results. No failed evidence is converted to green. Root review receipt is
ROOT_SCENE_EXPORT_PERFORMANCE_SOURCE_REVIEW_01.json; this is not native acceptance.
DELIVERY_STATE: final root docs and exact mechanical bindings are prepared next;
mandatory final gates, commit/push/official CI/merge/exact merged proof remain OPEN.
FULL_RELEASE_STATE: genuine large-novel multi-round Word roles/scopes, save/redo
performance and production30s/512MiB acceptance remain OPEN. No full release PASS.

## STOP_CONDITION

Stop on ambiguous identity/authority, foreign dirty files, scope/budget drift,
changed guard/Core/schema/generated bytes, invalid full artifacts, missing/skipped
mandatory proof, no causal defect, runtime bound or third same failure signature.
Never substitute fixture/count-only/self-authored receipt for required oracle.
If target drifts and becomes unmergeable, stop; no silent rebase/base transfer.
No full-novel/native/performance PASS before those outcomes are actually observed.

## REPORT_FORMAT

Exactly one text code block, KEY: VALUE lines. Include task/status, before/after/
merged SHA, changed basenames, scope, tests with exclusions, commit/push/PR/CI/
merge, exact-head verification, residual limits, rollback and one next action.
No URL, slash paths or path:line in the final report.

## FAIL_PROTOCOL

Retain expected/actual, seed, exact HEAD/source/artifact hashes, argv/actual exit,
raw logs and one next hypothesis. Failed attempts stay immutable.
A process exit0 is process evidence only. Missing, stale, count-only or different
head evidence is UNKNOWN/FAIL. Root review and full delivery remain required.
