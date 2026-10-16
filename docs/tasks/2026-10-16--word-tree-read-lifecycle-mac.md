# Bound verified tree reads through actual Worker retirement

TASK_ID: WORD_TREE_READ_LIFECYCLE_MAC_20261016
PARENT_TASK_ID: YALKEN_MAC_WORD_FINISH_V4_1_20261013
STATUS: SOURCE_PROOF_COMPLETE_REQUIRED_DELIVERY_PENDING
DOCUMENT_CLASS: PROCESS
CLAIM_BOUNDARY: Read execution lifecycle only; native book history and finite16 remain unaccepted.
TYPE: CORE
MODE: HARD_TZ
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
BINDING_BASE_SHA: cf6cd26381f9776965cd7fe0990f4d1cbff8cf53
OWNER_AUTHORITY: Direct owner go-ahead after reviewing the bounded lifecycle repair; Root sole executor under continuing Mac Word finish authority.
DESIGN_TOOL_ROUTER: OUT_OF_SCOPE_BACKEND_ONLY; existing read port, unchanged UI.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_HEAD_VERIFICATION_REQUIRED=true

## MICRO_GOAL

O: Different verified tree requests complete without overlapping heavy Workers,
including the interval between result delivery and confirmed Worker exit.
T: Existing Main query -> strict small descriptor -> bounded read admission ->
unchanged read-only Worker/Core -> final current fence -> immutable projection.
H: The current port admits eight Workers and retires requests before termination.
One actual large request passes, two parallel abort, the same two sequential pass.
B: Core, Worker, Main consumers, project format, authority, original Q2/SOURCE80,
all histories and the finite16 denominator remain protected.
P: Controlled lifetime/deadline/interleaving negatives, unchanged real Core parity,
whole affected contracts on both engines, mandatory gates, matched read-only
large inputs, ordinary delivery and separate exact-build native admission.
I: Exact base above; existing clean registered T7-Secure worktree and a new
codex/word-tree-read-lifecycle-mac-20261016 branch. Predecessor delivery is closed.

## ARTIFACT

One existing read-port correction; runtime changed-line budget180 and tests400.
Existing assertions change only where they specify the replaced concurrency or
fence scheduling; input/result/stale/no-write business assertions remain.
New materials/evidence use the dated word-tree-read-lifecycle-mac directories on
verified T777. Disposable test/runtime files use the declared owned APFS runtime;
no original project is written by component diagnosis. No dependency install.

## ALLOWLIST

- src/main/projectTreeReadPort.cjs
- test/contracts/rtk-word-project-tree-cohort.contract.test.js
- docs/tasks/2026-10-16--word-tree-read-lifecycle-mac.md
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

## DENYLIST

All other paths. No Core, Worker, Main consumer, renderer, preload, generated
bundle, package, schema, payload-size limit, oracle or authority relaxation.
No persistent cache, blocking fallback, retry, process migration, journal repair,
reset, stash, clean, rebase or force push. Native effects need fresh admission.

## CONTRACT / SHAPES

FEATURE_INTEGRATION_MANIFEST_V1: existing verified project-tree read seam.
Product plane: unchanged Core verification and project/authoring truth.
Command plane: unchanged Kernel and every Main capability/context guard.
Interface plane: same frozen treeRevision,lastMutation,original,structuralSeed.
State classes: call-local DERIVED_STATE only; PROJECT_STATE and
AUTHORING_WORKING_STATE are read-only and protected. No shell/transient changes.
Operations: existing QUERY, EFFECT and BACKGROUND_JOB; no command/event added.
Product ports: existing readVerifiedProjectTreeProjection/read-only FS adapter.
Design OS ports: existing read-only projections. SURFACE_MANIFEST_V1 is not
applicable: no new surface or interface behavior is introduced.
Admission: one active lifecycle and at most eight distinct active/waiting jobs;
queue stores validated small descriptors only, before any fence I/O. Identical
pending descriptors share one freshly admitted current snapshot and deadline;
there is no completed-result cache. Preserve all Worker and final fence checks.
Time: monotonic arrival-to-delivery deadline, capped at the existing120000ms;
expired queued work never spawns. Timeout may reject a caller while the resource
remains occupied until actual I/O and Worker retirement complete.
Retirement: await terminate/exit before releasing admission; failed termination
without confirmed exit makes this port unavailable, never starts another Worker.
Identity: strict request fields; admitted manifest/receipt/journal fences;
unchanged Core project/scene validation and Main lifecycle/revision guards.
Fallback/recovery: existing typed errors only, no hidden write or new trust.
Performance: no full graph in the queue or IPC; no heap/GPU flag changes.
Accessibility: unchanged existing surfaces/keyboard paths, no design delta.
Current: reproducible component overlap and native public-open Worker OOM.
Target: bounded execution; native success is not inferred from component tests.
Main read/write overlap is audited, not silently claimed solved by this port.

## IMPLEMENTATION_STEPS

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
CHECK_01_PRE_IDENTITY: bootstrap, ordered canon/source reads, mounts/registry,
clean exact base and fresh remote, predecessor closure, declaration/preflight.
CHECK_02_POST_E0: task grammar before runtime changes; retain causal RED.
CHECK_03_POST_BEHAVIOR: delayed result/exit, error, timeout, queued expiry,
overflow, deduplication, fence fanout, changed files and failed-stop negatives.
CHECK_04_POST_CHAIN: complete changed tree contract and existing Main port-consumer scenarios on
Node22 and shipped engine, mandatory TAP oracle, inventory/bindings/strict and
complete mandatory official CI full RTK/Main baseline.
CHECK_05_POST_DELIVERY: ordinary commit/push/PR/merge and clean exact merged
verification, then freshly admitted matched runtime/native validation.

## CHECKS

CHECK_01_PRE_IDENTITY: verified clean base/remote, storage and preflight above.
CHECK_02_POST_E0: canonical task grammar passes before product implementation.
CHECK_03_POST_BEHAVIOR: all lifecycle and freshness assertions really execute.
CHECK_04_POST_CHAIN: actual complete affected and mandatory gate results.
CHECK_05_POST_DELIVERY: exact merged verification; native credit stays separate.

Existing no-write, malformed input/projection, foreign/corrupt packet and stale
publication assertions remain mandatory. Both necessary different requests must
complete; an overload refusal is not a successful book cycle. No skips, todos,
zero-test, stale source or self-authored count may replace executed evidence.

### REFERENCES

Current exact port/Worker and complete existing tree/Main contracts;
READONLY_WORKER_PROCESS61.json; READONLY_WORKER_PROCESS62.process.json;
READONLY_WORKER_PROCESS63.process.json; NATIVE_PUBLIC_OPEN_CRASH60.json;
DELIVERY_CLOSURE56.json. Previous104 recovered and105 SOURCE80 files protected.

### ROLLBACK

One ordinary scoped PR revert, no format migration. Preserve raw failed evidence.

## STOP_CONDITION

Stop on authority/identity ambiguity, foreign WIP, mandatory failure or a third
identical failure signature. No broad architecture or product acceptance claim.

## REPORT_FORMAT

One text KEY: VALUE block with exact identities, scope, actual tests/delivery,
native limitations and one next step; basenames only.

## FAIL_PROTOCOL

Retain all failed raw runs. Diagnose one concrete divergence; never raise heap
limits, drop protected bytes, weaken validation or count busy as feature success.

### Observed causal and large component proof

RED03 fails the preserved first concurrency assertion on the exact base port.
GREEN04 and FOCUSED05 execute1of1 and13of13 with zero fail/cancel/skip/todo.
LARGE06 executes the old failing concurrent request pair through the corrected
actual port and two real default Electron Workers:44.823s, actual exit0, peak
live1, complete values equal the old sequential result. Independent streaming
SHA/roster checks preserve all104 original files and directories before/after.
No native window or acceptance credit. Initial E0 header/phase grammar failures
remain failures; corrected E0 passes before product edits.

### Complete-run execution binding

NODE_CHAIN08 hit the disposable capture helper CLI_AUX_WALL_900S after370
successful scenarios, with no complete TAP summary. It is FAILED/INCOMPLETE and
never accepted as a whole chain. Product/port/native budgets are unchanged.
Complete changed tree contracts run separately on Node22 and shipped Electron.
Main source is byte-exact to the base. Its existing project-query, backup,
pending-phase and stale-publication consumers run on both engines, alongside the
complete changed tree contract. The existing mandatory official CI full RTK graph
supplies complete Node Main and baseline coverage under its existing repository
runner deadlines; it must really pass before merge. Shipped combined09 is
superseded, stopped only after exact CLI PID/group verification, and unaccepted.
No scenario, assertion, required CI job or denominator is removed.

### Final lifecycle counterexample

TREE_NODE15 passes100of100 on the intermediate port. TREE_SHIPPED16 fails one
new control after55ms because a count of2000 event-loop turns is not an actual
completion/deadline barrier. Replace that test-only iteration count with a
monotonic observable-condition wait; every assertion remains. No application
limit changes. FENCE_RED17 independently reproduces the real remaining resource
hole: Promise.all rejects before its other started fence reads finish, allowing
a new Worker while those reads are held. The same port now drains all three
reads with allSettled and propagates the failure. Focused final14of14 passes.
Final complete101-case chains and the matched large pair are freshly rerun;
earlier100-case/large06 evidence stays bound to its intermediate source only.

### Final proof binding

Final port f0503474671b1ba710476fa35b5b5d1b1585862b64df7e98a0a54faa0c1c89b3
passes complete101of101 Node20/shipped21 and8of8 Main consumers23/24, with0
fail/cancel/skip/todo. LARGE22 repeats the actual concurrent pair in45.577s,
peak live1, complete values equal and all104 original files/directories exact.
The last test-only correction explicitly allows the existing5ms simulated whole
call deadline to expire before Worker allocation, while requiring exactly one
stop for every Worker actually started. Whole101 tests rerun as25/26 before
byte binding/delivery. No product source or runtime limit changes after LARGE22.

Final TREE_NODE25 and TREE_SHIPPED26 each pass101of101, actual process and
unchanged mandatory TAP exits0, zero fail/cancel/skip/todo and exact source/test
barriers. MAIN_NODE23 and MAIN_SHIPPED24 each pass8of8 selected actual consumers,
not a whole Main-file claim. Whole Main/full RTK acceptance is required from the
ordinary official CI before merge; no auxiliary partial run is credited.

### Exact generated approval correction and retained resource counterexample

PR2126 candidate7504e3a0415ac78bc160271d34ee23d285a1ca9b fails the mandatory
C1C shard: E_GENERATED_ARTIFACT_DRIFT for C2A approvals. The inventory itself is
canonical; its one approval had custom current-task metadata inconsistent with
the unchanged deterministic compiler. Restore the compiler's standing metadata,
change only the current inventory digest, require actual checkArtifacts and the
whole C2A contract, and refresh existing mechanical bindings. Original failed CI
and the superseded custom approval remain in Git and append-only approval history.
No test, runtime source, compiler or required gate is weakened.

MAIN_WORKER47 is an additional read-only counterexample on the same original
104-file Q2: one heavy Main Core read plus one actual Worker read aborts SIGTRAP
with V8 heap OOM at15.811s. MAIN_WORKER49 uses matched inputs sequentially and
passes41.177s with equal complete results, no explicit GC or heap flag. Full104
files and directories remain exact. Thus this port correction proves bounded
Worker-to-Worker admission only; safe Main/Worker overlap and full book history
remain open. Do not attempt or credit native bookUndoRedo from this proof. A
shared Main/Worker resource admission is the next bounded hypothesis after the
current required delivery closes. Native OPEN-only verification may be admitted
separately; native history/finite16/fullfeature status remains NOT_READY.
