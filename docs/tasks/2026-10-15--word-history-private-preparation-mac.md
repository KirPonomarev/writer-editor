# Prepare complete Word history once inside Core

TASK_ID: WORD_HISTORY_PRIVATE_PREPARATION_MAC_20261015
PARENT_TASK_ID: YALKEN_MAC_WORD_FINISH_V4_1_20261013
STATUS: CANDIDATE_LOCAL_PROOFS_COMPLETE_DELIVERY_PENDING
DOCUMENT_CLASS: PROCESS
CLAIM_BOUNDARY: bounded private history preparation only; no native or whole-feature acceptance
TYPE: CORE
MODE: HARD_TZ
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
BINDING_BASE_SHA: 1a51cb983f62eb136e5e2116462c10b4041421f6
OWNER_AUTHORITY: continuing direct autonomous finish; Root SOLE_EXECUTOR
DESIGN_TOOL_ROUTER: OUT_OF_SCOPE_CORE_ONLY (no visual contract changes)
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_HEAD_VERIFICATION_REQUIRED=true

## MICRO_GOAL

Existing public Word Undo/Redo keeps multiple complete large plans and repeats
current-packet preparation. Native75 instrumented Redo timed out and then V8
crashed before commit. Independent104file313476724byte conservation passed; no
normal Quit or trace exists. The shipped-engine read-only component baseline
needs92.83s before authority/commit/publication, including two24-25s full reads.
Removing one defensive copy alone did not improve overall time or peak memory.

O: Same complete canonical plans/packets and exact history state under existing
120s/public and600s/native contracts; lower bounded preparation cost.
T: Existing Kernel/Main project lease -> one Core-owned history preparation ->
unchanged journal/atomic writer -> independent complete readback/publication.
H: Move only history preparation into the existing Core transaction call and
reuse its existing private read invocation; end it before the first write.
B: No renderer, schema, dependency, heap/deadline/quota, authority, fixture,
profile/anchor or oracle relaxation. Legacy treeCohort ownership unchanged.
P: Native75 causal failure, measured actual retained operands, descriptor/private
context bypass negatives, actual Main/Kernel/lease/FS history and recovery,
required baseline, normal delivery and separately admitted native continuation.
I: Exact base above, isolated registered worktree and current raw native75
preimage; all existing source/build/profile evidence remains immutable.

## ARTIFACT

One vertical Main/Core correction and maintained tests. Runtime changed-line
budget260; test changes200lines. Product formats and receipt semantics remain.
Dated T777 materials/reports; finite owned CLI fixtures on declared APFS f5
history-private-preparation runtime. No native launch during this code contour.

## ALLOWLIST

- src/main.js
- src/core/project-transaction-v1.cjs
- test/contracts/rtk-word-novel-import-partition.contract.test.js
- docs/tasks/2026-10-15--word-history-private-preparation-mac.md
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

Every other path, including renderer/preload, pure planner, dependencies,
shared caches/workers/buses, schemas, quotas/deadlines, native profiles/authority,
foreign WIP, reset/stash/clean/rebase/force. No new runtime port or writer.

## CONTRACT / SHAPES

FEATURE_INTEGRATION_MANIFEST_V1: existing Word-history command and Core journal.
Product plane: Core owns small validated wordHistory action/project/scene data,
complete retained values, model plan, packet, observed-byte freshness and atomic
recovery. Command plane: existing cmd.project.review.decidePendingRevision,
Kernel capability and Main real lease/editor/source/lifecycle/generation checks.
Interface plane: existing projection and selected-scene publication unchanged.
State classes PROJECT_STATE/AUTHORING_WORKING_STATE remain protected; derived
proof and shell/transient data never grant write authority.

Existing commitProjectTransaction gains a small internal Main-to-Core history
descriptor. The caller cannot supply prepared state, a reusable proof, output
bytes or a private invocation. Core constructs the exact old model input from
fresh verified storage. A Core-generated frozen plan may avoid a second caller
ownership copy; legacy caller plans retain the old defensive copy before await.
All semantic regeneration and packet-envelope checks stay complete. Every
observed byte and lease/CAS is rechecked before the journal; private context and
stale graph references end there. Post-write readback is a new fresh phase.
No journal recovery substitutes caller metadata for the independently parsed
complete durable packet. No-history/local fallback preserves prior behavior.

## IMPLEMENTATION_STEPS

CHECK_01_PRE_IDENTITY: bootstrap, mount/registry/base, declaration/preflight and
this OPS gate before implementation. CHECK_01 выполняется ДО любых изменений;
CHECK_02+ выполняются ПОСЛЕ.
CHECK_02_POST_CAUSAL: maintained invalid private-descriptor RED on unchanged Core.
CHECK_03_POST_IMPLEMENTATION: one private Core preparation and existing Main
lease/publication adapter; no new bus/cache/framework or product format.
CHECK_04_POST_NEGATIVES: descriptor and async identity, no-write refusal,
complete actual Main/Kernel/lease/FS UndoRedo, stale and marker recovery cases.
CHECK_05_POST_MEASUREMENT: actual retained input digests remain identical and
one private phase measurably reduces processing/memory; CLI is not native proof.
CHECK_06_POST_DELIVERY: deterministic companions once, focused/affected gates,
full required official RTK/certification, commit/push/PR/CI/normal merge and fresh
exact merged checks. Then separately admit preserved native75 crash continuation.

## CHECKS

CHECK_01_PRE_IDENTITY: required clean identity/bootstrap/preflight/OPS before code.
CHECK_02_POST_PROOF: behavior, freshness, recovery, full required baseline and
normal delivery verified at exact head with zero required skips/todo/cancel.
No success from counts, source-copy timing or a durable receipt alone.

### REFERENCES

Owner research RESEARCH_REPORT.txt/SOURCES.json is advice, not authority.
Current native75 actual failure and full conservation; current shipped-engine
baseline/owner-copy trial and exact code are the causal inputs. Source80 missing
external anchor,21note-reference fields and fullroles/five-round matrix remain
open. No optional integration is used or required by this backend task.

### LOCAL_PROOF_03

Actual whole affected9 files238of238 and focused6of6 on Node22 and shipped
Electron Node24 pass with mandatory TAP0 and no exclusions. The maintained
causal descriptor RED precedes the fix. Complete raw states/forged packets,
async descriptor mutation, stale publication and before/after-marker recovery
remain. Same104file paired read-only prewrite164870.085ms to67163.118ms, full
158709521byte journal SHA256
b641d4950d227e998cdf82d9002d8a87333109962acf2687caee76b16b55ca6a matches.
No write or native command executed; peak RSS does not improve. Earlier partial
and missing-verifier failures are retained. Same checked packet serialization
is reused locally, never the two different plan values around planDigest.
All normal delivery/complete baseline/native acceptance remains pending.

## STOP_CONDITION

Stop on identity/authority ambiguity, scope drift, product mutation bypass,
missing source freshness or third identical failure. Preserve exact failures.
No new contour before full closure; no native acceptance until actual public
command, full durable graph and genuine normalQuit/reopen/export are proved.

## REPORT_FORMAT

One text KEY: VALUE block with exact SHA/tests/delivery; basenames only.

## FAIL_PROTOCOL

Retain actual failure/seed/source/logs and next single hypothesis. A failed or
cancelled diagnostic is never PASS. Native75 crash is not an ordinary Quit.

### ROLLBACK

One ordinary PR revert. Preserve all immutable1a51 source/build, native75
snapshots/crash evidence, original profiles and the unrelated local OPS commit.
