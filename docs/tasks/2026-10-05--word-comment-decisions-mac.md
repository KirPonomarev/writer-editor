# Mac inline revision decisions with comments

TASK_ID: WORD_COMMENT_DECISIONS_MAC_20261005
TYPE: CORE
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
MODE: A
STATUS: NATIVE_OBSERVED_DELIVERY_PENDING
BASE: 8e038139ad3b0f0236140b5641a266924d48d255
COMMIT_REQUIRED: true
PUSH_REQUIRED: true
PR_REQUIRED: true
MERGE_REQUIRED: true

## MICRO_GOAL

O: Accept/reject one or all inline insert/delete changes with active comments;
Undo/Redo after save/restart restores exact anchors and statuses. Both DOCX
exports and Word reply return retain this local history.
T: canonical ledger + comments -> existing Kernel command -> Main revalidation
-> independently replayed Core anchor plan -> existing atomic project writer.
H: exact union revision intervals produce unambiguous splices even for repeated
text; stable transition identity makes inverse comment history restart-safe.
B: preserve every message, source metadata, sibling scene, journal and manual
comment lifecycle action. Recording/source-changing history/structural mixtures
remain outside this packet. Revert one packet; no cleanup of owner data.
P: exact Core counterexamples, actual entire Main + real transaction, early
SOURCE/PACKAGED native, affected stable tests, mandatory CI, merged exact checks.
I: binding base above; isolated existing worktree; build/profile/artifact hashes
must be recorded before every native observation. No percentage/full-plan claim.

## ARTIFACT

Core decision-to-anchor plan, Main integration, existing history correction,
regressions, feature manifest and exact native/delivery evidence.

## ALLOWLIST

- `src/core/word-pending-comment-decisions-v1.cjs`
- `src/core/word-comment-anchor-save-v1.cjs`
- `src/main.js`
- `src/io/revisionBridge/index.mjs`
- `test/contracts/rtk-word-pending-comment-decisions.contract.test.js`
- `test/contracts/rtk-word-comment-anchor-save.contract.test.js`
- `test/contracts/rtk-word-pending-revisions-runtime.contract.test.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `docs/tasks/2026-10-05--word-comment-decisions-mac.md`
- `docs/OPS/RTK/FEATURE_INTEGRATION_MANIFEST_WORD_COMMENT_DECISIONS_V1.json`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/CONTEXT.md`
- `docs/HANDOFF.md`
- `docs/WORKLOG.md`

## DENYLIST

No dependencies, UI design, renderer/IPC authority, arbitrary persistence port,
owner checkout mutation, reset/stash/clean/rebase/force-push, silent metadata
loss or unqualified source-changing round history with comments.

## CONTRACT / SHAPES

Closed existing decision input. Core must recompute full expected output from
beforeContent, validate unchanged union source/revision definitions and derive
version2 edit intents from visibility transitions. Existing32-history and256-
intent limits remain explicit. Unknown/history-expired inputs refuse no-write.
Manual tombstones never revive. First observed inverse history stores inverse
orientation accurately. Existing transaction recomputes anchor state from exact
scene pair; a proposed after graph alone grants no authority.

## IMPLEMENTATION_STEPS

1. Implement/test exact decision mapping and inverse-history counterexample.
2. Bind internal Main option, comments CAS, real transaction and guarded publish.
3. Exercise early small native SOURCE/PACKAGED route, repair focused failures.
4. Stable affected tests, CI, full delivery and exact merged verification.

## CHECKS

Selected/all accept/reject, Undo/Redo/restart, repeated text, consumed ranges,
point/multi and resolved comments, new root after decision, manual tombstones,
forged target, stale state/scene/generation, capability denial and rollback.
Both exports and Word reply after all decisions must retain local Undo history.
Actual Main plus real transaction; existing crash/recovery negative suite.
Mandatory guardrails, OSS/dependency checks, baseline/RTK CI and exact merged
checks. No skipped/stale/self-authored proof credited as runtime acceptance.

## STOP_CONDITION

No required proof failure, ambiguous identity or undeclared scope. Third same
failure stops that loop with expected/actual/identity and a new hypothesis.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1: task, before/after/merged SHA, basenames, tests,
commit/push/PR/CI/merge, exact-head proof, residuals, next step.

## FAIL_PROTOCOL

Preserve evidence and user data. Repair in admitted scope; new paths require
clean checkpoint and amended preflight. Do not certify a partial route.

Early route: Core8/8 covers grouped and independent decisions, exact repeated
occurrences, new roots, resolved point/multi anchors, durable inverse history,
manual tombstones and forged inputs. Main9/9 covers real atomic decisions,
stale scene/comment/generation/session refusal, both exports, all-decided reply
return/replay and subsequent Undo preserving the new reply. Unsupported run
properties refuse. Native SOURCE/PACKAGED acceptance and delivery remain open.

Checkpoint e18d907 admitted a known all-decided Review export failure. Amended
preflight binds that clean checkpoint and includes index.mjs. The parser now
admits an ephemeral schema2 empty ledger only for signed zero-span bindings;
local durable history is never replaced by it. Full rich projections, scene
ownership and section proofs remain mandatory. Missing expected pending
revisions continue to refuse. This is an implementation, not native acceptance.

## Native and stable candidate observations

Native SHA057cde135d90b028583d36733778d305c2609855. Fresh SOURCE and PACKAGED
profiles imported the actual Word-derived rich C2 input (six pending fragments,
three roots/five messages). SOURCE rejectAll->Undo->Redo->Review export->actual
Word reply->explicit Apply->restart Undo->acceptAll->both reexports. PACKAGED
selected rejection->Undo->acceptAll->Review export->actual Word reply->Apply
->restart Undo->Redo->both reexports. No new app instrumentation or bypass.
Each reply preserves scene and ledger bytes and adds exactly one message.
Restart Undo restores exact anchors/statuses, retains all prior messages and
the new reply. Six actual DOCX artifacts retain rich three-projection/section
meaning under production verifier; independent raw byte/anchor comparisons
are separate. Do not call the production verifier an independent oracle.

Whole affected Core/anchor-save/pending-runtime/actual-Main files320/320,
zero skips/todo, at native SHA. Expanded full-manuscript and combined-scene
all-decided reply tests pass; unsupported hidden run property refuses without
writes. Both native profiles stopped and copied with equal hashes. No full CI,
merge or merged acceptance claim until the delivery chain actually completes.
