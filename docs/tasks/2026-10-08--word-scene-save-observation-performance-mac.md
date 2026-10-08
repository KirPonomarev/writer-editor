TASK_ID: WORD_SCENE_SAVE_OBSERVATION_PERFORMANCE_MAC_20261008
MILESTONE: macOS novel Word exchange; synchronous Save observation reuse
TYPE: CORE
STATUS: IMPLEMENTED_WORKTREE_PROOF_DELIVERY_PENDING
ROLE: BOUNDED_EXECUTION_TASK
CLAIM_BOUNDARY: finite Save behavior and mechanism proof; full novel release OPEN
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BINDING_BASE_SHA: f17009c3e8511b945092d8fbec92c4ba19cc7794
BRANCH: codex/word-scene-save-observation-perf-mac-20261008
COMMIT_REQUIRED: true
PUSH_REQUIRED: true
PR_REQUIRED: true
MERGE_REQUIRED: true
DESIGN_TOOL_ROUTER: bound to validated pre-edit declaration; existing UI unchanged

## MICRO_GOAL

Remove duplicate synchronous parsing and pending-note ledger validation inside
existing scene Save planners. Preserve complete returned plans and errors in their
original order, rich notes/comments/history and independent persistence replay.
This is one behavior-preserving outcome and one rollback. Whole native novel
performance and all release scenarios remain OPEN until separately executed.

## ARTIFACT

Three surgical Core changes, append-only regressions in three existing contracts,
one mechanically rebuilt editor bundle and the full normal delivery chain.
Root owns task/docs/OPS/review/proof/Git; the separate existing code agent owns
runtime and behavior tests.
Current frozen worktree observation:139 complete old/new inputs/plans/typed
errors equal; direct caller seams6/4/4->2/2/2, not total validation or timing.
Nine append-only cases; whole8 actual232of232 with zero fail/cancel/skip/todo;
unchanged mandatory parser executed by writer and independently by root.
Two actual audited builds are idempotent,136 inputs,135 handwritten inputs and
preload exact. Runtime41of120 and behavior199of400 lines; old prefixes and six
public functions byte-exact. First whole8 failed231of232 from an appended list
oracle; only that new expectation was aligned with pinned old revision+1,
and both raw logs remain. Root review SHAfe08e04e26fcab747ccdb74643121939ae9d0d877e158d38d5e2f76fd9eebcc4.
Official CI/normal merge/exact-merged verification remain pending. Full native
novel performance remains OPEN and has not been executed for this change. PR2094 is fully closed at this base: official19/19,
both RTK4008/4008 and exact-merged whole11 592/592, no skips/todo. Closure receipt
SHA82995f262dd8804420fb3ed97ecb31995070a85d802f65f518d9a8e9f303cb68.
This predecessor evidence does not certify the new Save change.

## ALLOWLIST

- src/core/word-comment-anchor-save-v1.cjs
- src/core/word-manuscript-notes-v1.cjs
- src/core/word-pending-text-revisions-v1.cjs
- test/contracts/rtk-word-structural-comment-history.contract.test.js
- test/contracts/rtk-word-manuscript-notes.contract.test.js
- test/contracts/rtk-word-pending-notes.contract.test.js
- src/renderer/editor.bundle.js
- docs/tasks/2026-10-08--word-scene-save-observation-performance-mac.md
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

Hard runtime added+deleted budgets: comments50, manuscript-notes35, pending35,
total120. Appended behavior budgets140/100/160, total400, nine top-level tests
(three per contract), ordinary assertion loops and no nested TAP registrations.
All original test-prefix bytes and assertion statements remain exact.
Only pending Core is one of136 audited compiler inputs; all other135 handwritten
inputs and preload bundle stay exact. Editor bundle is generated, never hand-edited.
Seven mechanical companions retain all623 admitted paths,481 source identities,
1597 inventory paths and233 historical certification tuples. Only this new task
extends admission624/source482; three existing test hashes refresh. Append one
nonrecursive successor certificate with85 bindings: existing83 plus task and
structural-history test. No recursive OPS bindings or changed acceptance predicates.

## DENYLIST

Main, handwritten renderer/preload, preload bundle, UI, export/I/O, transaction
or replay implementation, public validators, schemas, caps, modes, dependencies,
lockfile, compiler, mandatory TAP parser/runner, workflows and other contracts.
No caller checked flag/capsule, global or cross-call cache, lazy closure, new
writer/registry/framework, native Word launch or large workload during code phase.
No private manuscript, install, runtime network, AX/TCC/macros/settings, foreign
process close, owner canonical checkout edit, reset/stash/clean/rebase/force,
protected direct push or merge bypass. Never replay old crash/failed heavy routes.

## CONTRACT / SHAPES

FEATURE_INTEGRATION_MANIFEST_V1
featureId: word.scene-save.observation-reuse.v1
featureVersion: 1
integrationMode: EXISTING_SEAM
domainOwner: Product Core
authoritativeData: raw scenes, pending ledger, notes, discussions, anchors/history
derivedData: private synchronous same-call parsed observations/current note points
commandIds: existing Save, recording-stop, decision and saved Undo/Redo commands
eventTypes: no new event; original domain/persistence events unchanged
queryIds: existing paragraphs/sceneText/noteProjection; readNoteProjectionPair
productProjectionIds: existing complete Save plan; private paired observations
capabilityIds: existing Kernel and Main Save/project capability; no new capability
authorityMap: Core truth; Kernel mutation; Design OS existing form only
identityKeys: project, scene, revision, generation, lifecycle, lease and source cohort
revisionPolicy: all existing checks/replay exact; every fresh call revalidates
writePath: Kernel -> Main fresh guards -> independent Core replay -> atomic writer
readPath: original parser stages -> private same-call observation -> original plan
requiredProductPorts: existing ProjectPersistencePort and RecoveryPort, no new I/O
requiredDesignOsPorts: none added; no interface contract change
adapterRequirements: existing adapters unchanged
surfaceManifests: no new or changed visual zone; existing surfaces unchanged
slotRequirements: none added
supportedWorkspaces: existing WRITE and REVIEW callers unchanged
platformAvailability: pure Core; macOS product objective; no new platform claim
accessibilityRequirements: no UI/focus/keyboard/locale change
fallbacks: exact existing null/fast paths/errors; no fallback that suppresses failure
stateClasses: PROJECT_STATE, AUTHORING_WORKING_STATE; call-local DERIVED_STATE
persistenceClass: no schema or persistence change; unsaved text retains no-loss duty
migrations: none; existing formats remain exact
recovery: original independent replay, atomic persistence and recovery unchanged
rollback: one ordinary PR revert with base reachability preserved
performanceBudget: one owned900s/40000000000-byte dev proof lane; small10/20/40 paragraphs
securityBoundary: raw validation and original budgets unchanged; no new authority
lifecycle: synchronous call-local only; no async publication or retained cache
negativeBypassChecks: malformed/stale/schema/alias/error order and fresh-call controls
evidenceBindings: actual pinned old/new complete outputs/errors plus whole8/TAP/builds
currentReality: old direct parser counts comments6/notes4; pair readLedger seam4
targetOnly: proposed counts2/2/2 are mechanism targets, not measured novel speedup

Comments keep original initial bare before/after parses and both readLedger calls,
fixedPendingSource and session validation order. Private parsed paragraph/owner
helpers reuse these observations only at the original later stage. Public
paragraphs retains budget-before-parse and its original catch/error mapping.
Notes privately observe doc/text using exact sceneText validation; public sceneText
remains an adapter. Recording-proof validation, beforeText budget/validation and
no-active-note fast return retain order. First-admission fallback stays unchanged.
readNoteProjectionPair(beforeDoc,afterDoc) accepts raw docs and current mode only;
it calls original readLedger(before) then readLedger(after), both before either
derived projection. Return {beforeLedger,afterLedger,beforePoints,afterPoints}.
Original ledger aliases and fresh arrays (including same-doc input) remain exact.
Private noteProjectionFromCheckedLedger may share derived logic internally.
Public readLedger/validateLedger/validateState/projectSourcePoint and notes
validateNoteCohort/validatePendingNoteTransition stay byte-identical. Public
noteProjection keeps readLedger entry and absent/null/no-points mode behavior.
No caller-supplied validated input, trust token or internal validation removal.
The historical disjoint18.809818percent sample opportunity is not actual speedup;
30s/512MiB is the isolated package gate, not the full Electron Save/Redo budget.

O: exact complete Save outputs and refusals with fewer redundant direct calls.
T: Core raw truth -> Kernel authority -> unchanged independent atomic persistence.
H: same-call observations remove repeat work; full old/new outputs/errors match.
B: preserve old assertions, validators, input bytes, rich graphs and all guards.
P: complete tiny parity before causal RED, whole8/TAP, two builds, gates/CI/merge.
I: exact base/branch, verified T7, source hashes and explicit build/profile scope.

## IMPLEMENTATION_STEPS

1. Root fresh clean bootstrap, canon/startup/applicable source reads, declaration
   preflight0; create this task/factual admission and exact task E0 before code.
2. Writer independently verifies task/declaration/E0/base and pinned old3 bytes.
   Save complete tiny10/20/40-paragraph inputs/plans/errors via actual isolated
   test-local CJS contexts with real dependencies; no validation stubs/cache edits.
3. Full old parity precedes desired-count causal RED. Trace actual delegated
   parser and actual readLedger seam separately from envelope/internal validation.
   Retain failed log/artifacts; no count-only correctness claim.
4. Apply only the three named Core changes; append three tests to each named
   contract. Deep-freeze observations/raw pair inputs, verify nonmutation and
   fresh second calls, then full old/new equality and required counts.
5. Execute one complete eight-file TAP union and unchanged mandatory TAP parser.
   Execute audited compiler twice with136 inputs, only editor bundle delta and
   second-build idempotence. Freeze all code/tests/proof at HOLD.
6. Root independently reviews complete diff/artifacts/error precedence/budgets,
   finalizes factual docs then seven mechanical bindings and all required gates.
   Commit/push/attached PR/official CI/normal merge/exact-merged whole8 repeat.
   Only afterward fresh-admit bounded large/native measurement; never old failures.

## CHECKS

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
CHECK_01_PRE_IDENTITY: clean f170 branch/remote, registered worktree, T7 verified;
root bootstrap/preflight actual0. Exact task E0 follows creation before writer.
CHECK_02_POST_SCOPE: ONLY_ALLOWED_CHANGE_NODE_HARD baselinev1.3, exact18-path
allowlist, original prefixes/validators,120runtime/400behavior budgets, diff check.
CHECK_03_POST_CAUSAL: full complete old/new tiny plans/graphs/Current/Original,
notes3/discussions/private/foreign/deleted/provenance/anchors/tombstones/history,
forward insert/delete/split/decision/saved Undo/Redo, then counts6/4/4->2/2/2.
CHECK_04_POST_NEGATIVE: repeated/empty/emoji/hardBreak/numbered leaves; frozen
real parsed docs/raw pair and aliases; changed/malformed fresh second call;
schema1/2/3/5, null/absent/no-points/mode, consumed/surrogate/projection/history/
descriptors; before-only/after-only/both error precedence and no mutation.
Both ledger validations precede derived projection; internal original point
validation remains. Existing list same-leaf acceptance/cross-leaf refusal retained.
CHECK_05_POST_AFFECTED: complete explicit eight-file TAP union, concurrency1,
actual numerator/denominator, no filter/skip/todo and unchanged parser fileCount8:
test/contracts/rtk-word-comment-anchor-save.contract.test.js;
test/contracts/rtk-word-structural-comment-history.contract.test.js;
test/contracts/rtk-word-pending-comment-decisions.contract.test.js;
test/contracts/rtk-word-pending-recording-comments.contract.test.js;
test/contracts/rtk-word-manuscript-notes.contract.test.js;
test/contracts/rtk-word-manuscript-notes-transaction.contract.test.js;
test/contracts/rtk-word-pending-notes.contract.test.js;
test/contracts/rtk-word-pending-text-revisions.contract.test.js;
Existing32MiB boundaries remain required; no historical failed500k replay.
CHECK_06_POST_COMPILER: two actual audited renderer builds,136 inputs, all other
135 handwritten inputs/preload unchanged, tracked/dist copies and idempotence.
CHECK_07_POST_GATES: exact task E0, strict DATA, frozen R24E0 behavior/mutants,
OSS policy, npm audit, guardrails and all mandatory official inventories/CI.
CHECK_08_POST_DELIVERY: exact staged scope, commit, push, attached PR, required
CI, normal merge, fresh origin/main/tree/clean verification and whole8 repeat.

## STOP_CONDITION

Stop on authority/base/remote/foreign WIP ambiguity, over-budget or unexpected
path/build/preload delta, missing operand, changed semantic/error precedence,
weakening/excluding tests/validators/guards, incomplete TAP/CI or unsafe workload.
After third identical failure signature stop its loop; retain expected/actual,
seed, HEAD/hashes and one next hypothesis. No synthetic green or silent bypass.

## REPORT_FORMAT

CODEX_OUTPUT_POLICY: exactly one text code block; KEY: VALUE; basenames only,
no URL/slash paths. Include task/before/after/merged identities, scope/budgets,
tests numerator/denominator/skips, commit/push/PR/CI/merge/exact-head truth,
limits, rollback and exactly one next action. Original full novel remains OPEN.

## FAIL_PROTOCOL

Retain actual nonzero logs, full inputs/outputs/errors and hashes. Diagnose one
signature before any bounded repair; never suppress failure, overwrite old proof
or replay historical crash/heavy failures. Missing evidence is UNKNOWN/FAIL.
