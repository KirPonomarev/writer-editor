# Project-scoped tree query across document replacement

TASK_ID: WORD_TREE_PROJECT_QUERY_SCOPE_MAC_20261014
PARENT_TASK_ID: YALKEN_MAC_WORD_FINISH_V4_1_20261013
STATUS: COMPONENT_VERIFIED_DELIVERY_OPEN
DOCUMENT_CLASS: PROCESS
CLAIM_BOUNDARY: Project query scope correction; no native cycle acceptance.
TYPE: CORE
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
MODE: HARD_TZ
BINDING_BASE_SHA: cf03bcf0a340dfd93f8e02c69fc7d708361db74d
OWNER_AUTHORITY: Owner V4.1 autonomous finish and Root delegated project-query regression correction.
DESIGN_TOOL_ROUTER: INACTIVE_BACKEND_CORRECTION; declaration validated unchanged surfaces.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_HEAD_VERIFICATION_REQUIRED=true

## MICRO_GOAL

Return the same verified project tree when an in-flight read overlaps an ordinary
same-project document/session replacement. Refuse changed project/root/bootstrap
owner or raw manifest/tree revision; preserve every scene-specific writer guard.

### MAP

O: Deferred real Main tree query returns both existing scene identities after
same-project document replacement, without writing any canonical bytes.
T: Existing public query route -> Main project context -> unchanged trusted Worker
and Core -> current project/owner/raw fences -> immutable project projection.
H: Main captures document commentAuthoringSessionId for a project-wide query;
setDirtyState(false,null) rotates it during open/replacement. Held Worker completion
therefore returns E_TREE_QUERY_STALE although all project operands are exact.
B: Core, Worker, renderer, storage, sessions on scene-specific writers, capabilities,
manifest/receipt fences, native failed profiles and all pre-existing assertions.
P: Maintained deterministic deferred RED then GREEN; stale project/owner/manifest/
receipt negatives, whole affected contract and risk port contract, normal mandatory
OPS/DATA/certificate/full RTK/official CI/merge and exact merged checks.
I: Exact binding above; isolated codex/word-tree-project-query-scope-mac-20261014;
pinned Node22.12.0. Native apps and old detached worktree untouched.

## ARTIFACT

Surgical Main query guard plus append-only existing Main fixture regressions and
required factual/mechanical companions. Runtime budget20 changed lines; tests200.
No new API, port, dependencies, UI, timeout or persistence schema.

## ALLOWLIST

- src/main.js
- test/contracts/rtk-word-scene-identity-main.contract.test.js
- docs/tasks/2026-10-14--word-tree-project-query-scope-mac.md
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

All other paths; Core/Worker/renderer/preload; dependencies/network runtime;
scene-specific lifecycle/session guards; native/profile/build effects; hidden
fallback/cache/retry; weakened assertions/limits; reset/stash/clean/rebase/force.

## CONTRACT / SHAPES

EXISTING_SEAM: query.projectTree is project-scoped, not scene-scoped.
Product Core owns raw project truth and verified tree revision; Command Kernel
query routing/capability remains intact; Main owns active project/root/bootstrap
context; existing read-only Worker owns execution, not authority. Project state is
read-only, derived projection is call-local immutable, authoring working state is
protected. No new feature, surface, command, event, migration or worker contract.
Current project and owner plus exact raw manifest and unchanged Worker receipt/
journal fences must hold immediately before query publication. All document save,
recording, pending projection and backup session guards remain byte-exact.
Missing/stale data returns existing typed failure; no blocking fallback or retry.
Rollback is one ordinary PR revert; failure artifacts remain on T777.

## IMPLEMENTATION_STEPS

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
Full ordered startup completed on cf03; fresh remote exact; mounts UUID/encryption/
unlocked/writable verified. Architecture01 preflight actual0 on clean writer.
Task E0 and Root task review before product change. Append causal fixture, preserve
RED, apply minimal correction, then complete declared full delivery.

## CHECKS

CHECK_01_PRE_IDENTITY: bootstrap, clean exact base/branch/remote/mount/preflight.
CHECK_02_POST_E0: canonical task OPS-GATE before runtime edit.
CHECK_03_POST_CAUSAL: held-read same-project replacement RED then GREEN; meaningful
cross-project/owner/manifest/receipt failures and complete no-write snapshots.
### Actual causal evidence

RED01: same-project real Main replacement returns E_TREE_QUERY_STALE before the
fix; appended receipt fixture also records one wrong expected code, corrected to
actual E_TREE_COHORT_RECEIPT. Focused01 actual6/6 selected, zero exclusions.
Complete affected/risk/mandatory delivery gates are IN_PROGRESS, not accepted.

CHECK_04_POST_CHAIN: full affected Main and risk tree-cohort contracts, compiler
checks, required cheap gates, committed certificate/full RTK and official CI.
CHECK_05_POST_MERGE: identical-tree clean merged source proof, relevant query/port
checks and required exact-head governance checks.

## STOP_CONDITION

Wider authority or semantic change, foreign WIP or third identical failure: STOP.
No native cycle is accepted by code tests. Preserve SOURCE52/53 failed evidence.

## REPORT_FORMAT

One text KEY:VALUE block; basenames only. Actual SHA/counts/exit/CI/merge and residual
native matrix open. Evidence/logs on T777; declared D03 test TMPDIR only.

## FAIL_PROTOCOL

Keep original failures and process/log/source hashes. No stale/skipped/count-only
proof. Full delivery required; never repair raw evidence or claim native success.
