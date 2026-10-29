# Compare saved continuity facts with their verified previous authoring revision

TASK_ID: YALKEN_WSE_SEMANTIC_DIFF_20261029
TYPE: OPS_WRITE
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
EXECUTION_CANON: v3.13a-final
BINDING_BASE_SHA: aef9c207b19169c426536a20164c82538f73bba9
STATUS: OPEN_UNACCEPTED
COMMIT_REQUIRED: true
PUSH_REQUIRED: true
PR_REQUIRED: true
MERGE_REQUIRED: true
DESIGN_TOOL_ROUTER: Backend-only behavior; exact canonical enum is in the validated declaration.

## MICRO_GOAL

The existing Ledger Semantic diff compares current saved continuity facts with
the actual preceding authoring revision verified by Stage10 replay, receipt
authority and integrity. A new or changed author fact becomes visible with its
real prior revision and evidence. Missing history remains explicitly unknown.
One bounded delivery contributes to the owner's complete V6 Mac objective.

## ARTIFACT

One read-only product projection connected through the existing Ledger query,
maintained causal and negative tests, real candidate and merged native proof,
and a complete normal delivery chain. No new screen or historical truth store.

## ALLOWLIST

- src/main.js
- src/product/stage10ProductWiring.mjs
- src/derived/atlas/deriveAtlasContinuityLedgerSurface.mjs
- test/unit/r24-wp605-wse-revision-time-object-integration.test.js
- test/unit/r24-wp307-writer-local-profile-integration.test.js
- test/contracts/yalken-atlas-v5-final-audit-p0-08-stage10-product-wiring.contract.test.js
- docs/tasks/2026-10-29--wse-semantic-diff.md
- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/WORKLOG.md
- docs/ARCH_DIFF_LOG.md
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/post-audit-certification-set.mjs
- docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/FIRST_MAC_RELEASE_CUT_V2.json
- scripts/ops/release-candidate.mjs

Budget: Main at most110added/20removed lines; Stage10 at most100added/12removed;
Ledger derivation at most35added/12removed; maintained tests append at most350
lines without changing original assertions or fixtures; task/factual additions
at most230lines. Current mechanical hashes are separate, with actual applicable
membership, every historical carrier and all verifier predicates preserved.

## DENYLIST

No renderer, preload, HTML/CSS, Core reducer/schema, profile/entitlement, command,
IPC-channel, dependency/lockfile, workflow, canon or design-policy change.
No new snapshot writer, history store, private bus, cache framework, silent
baseline default, history repair, replay bypass or fabricated empty baseline.
No prior source/test/history/raw/profile/failure deletion or rewriting. No
private/default/installed-app inspection or repair. No agents, other models,
chats, timers, reset, stash, clean, rebase, amend, force-push or base transfer.
No signing, notarization, publication, release or full WSE/Mac acceptance.

## CONTRACT / SHAPES

O: After a real saved author fact, the current existing Semantic diff shows the
actual ADDED or CHANGED row. Reopening the same project preserves the comparison.
The verified missing baseline case stays UNKNOWN_NO_BASELINE and never invents
REMOVED or ADDED evidence. All source and historical bytes remain recoverable.
T: Existing append-only Stage10 event chain plus independent Kernel receipts
and integrity anchor -> executable verified replay -> immutable previous Core
revision -> existing continuity-fact projection -> existing Ledger query ->
existing WP605 read-only Semantic diff and presentation.
H: The actual pure comparison works, but both ordinary Ledger callers pass
previousSnapshot:null. Connecting a verified parent and including historical
identity in currentness/cache invalidation will produce a real row without a
new writer. Registered Main causal proof must fail at the missing row first.
B: Current author truth, scene bytes, old events/receipt/UI-event prefixes,
unknown fields, existing empty fallback, all previous module views, shared
query policy, private state and original failures are protected. One revert.
P: Cheap actual Core/registered Main controls and complete frozen causal tests;
same tests after correction; affected/source/baseline/RTK/Electron/OSS/audit/
performance/guardrails and every existing required gate; early exact-source
native before push, normal delivery and literal merged build/native/readback.
I: Clean exact aef9c207 and connected GitHub main match. Existing registered
worktree is agent-managed on verified encrypted T7-Secure; reports/materials
use the dated T777 task folders. Preflight01 and all10033source rereads precede
first edit. No historical R24 stage/lease is dispatched or inherited.

FEATURE_INTEGRATION_MANIFEST_V1:
featureId=wse.semanticDiff.previousAuthorRevision.v1; featureVersion=1;
integrationMode=EXISTING_SEAM; domainOwner=ProductCore;
authoritativeData=existing Stage10 session/event log/Kernel receipts/integrity;
derivedData=verified previous Core revision and continuity facts;
commandIds=NONE_READ_ONLY; eventTypes=NONE_NEW; queryIds=query.atlasContinuityLedgerSurface;
productProjectionIds=existing WP605 and Ledger projections;
capabilityIds=existing Ledger query/profile policy;
authorityMap=Core truth and replay, Kernel receipt authority, existing Design OS form;
identityKeys=project/owner/authority-head/source-revision/generation/baseline-revision;
revisionPolicy=reject wrong parent or stale context before publication and cache reuse;
writePath=NONE_NEW; readPath=verified existing history to immutable projection;
requiredProductPorts=existing Stage10 runtime read model;
requiredDesignOsPorts=existing Ledger read-only query;
adapterRequirements=current local adapters unchanged;
surfaceManifests=existing WP605 Semantic diff; slotRequirements=existing right rail;
supportedWorkspaces=current Ledger host; platformAvailability=existing desktop,
actual Mac proof and unchanged mandatory other-platform baseline;
accessibilityRequirements=existing keyboard/list/read-only presentation;
fallbacks=explicit unknown or typed unavailable, no synthetic baseline;
stateClasses=read PROJECT_STATE and compute DERIVED_STATE;
persistenceClass=NONE_NEW; migrations=NONE_NO_FORMAT_CHANGE;
recovery=rebuild only from verified immutable history; rollback=ordinary revert;
performanceBudget=explicit-open only, bounded history and rows, no typing work;
securityBoundary=no new authority or external payload trust;
lifecycle=current owner/project/head/source guards across all awaits;
negativeBypassChecks=foreign/malformed/failed transaction/oversized history,
forged renderer baseline, stale owner/source/head/cache and no product writes;
evidenceBindings=actual current source tests, real package/native and raw rereads;
currentReality=normal Ledger has no baseline; targetOnly=full WSE/Mac remains open.

SURFACE_MANIFEST_V1: reuse existing surface.atlas.continuityLedger.revisionTimeObject
and rightRail.context.atlas.continuityLedger; no new visual zone or interaction.

## IMPLEMENTATION_STEPS

1. CHECK_01_PRE: resolve registry, mounts, current code/history/authority and
fresh remote; pass declaration/preflight on clean base. Preserve previous
delivery and diagnostic closure. Prepend accurate short factual entry.
2. Run this task through existing E0 before test/product edits. Append maintained
causal tests with real existing initializers and registered Main/Core/persistence.
Run and retain whole unchanged-source RED, distinguishing method failures.
3. Freeze the tests. Connect only the verified previous revision and its existing
fact projection. Preserve Core, commands, storage, schema and other module inputs.
4. Execute the same entire tests and independent readback/negative controls;
measure bounded explicit-query behavior. Build from a clean literal source
commit and perform real owned native author/query/Save/Quit/cold, preserving
every full profile member and original failure before any push.
5. Update only current mechanical witnesses, preserving historical bytes,
predicates, classifications and17UNKNOWN. Run every required current gate and
finish normal commit/push/PR/allCI/merge/exact-main verification and native proof.

## CHECKS

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
CHECK_01_PRE_BASE: clean exact registered base, mounts, reads, fresh remote and
valid declaration/preflight; source10033 and protected10014exact.
CHECK_02_POST_TASK: exact HARD task E0 passes before tests/product changes.
CHECK_03_POST_CAUSE: real registered author fact persists and query reaches the
missing comparison; missing API/setup failures never count as causal coverage.
CHECK_04_POST_COMPARE: actual parent facts and revision produce correct rows;
unknown/malformed/foreign/stale/budget/failed-transaction inputs refuse; every
read preserves current manuscript, history, receipts, recovery and other views.
CHECK_05_POST_NATIVE: exact app/build/PID/profile/readers/CUA binding, actual
Unicode fact comparison and cold retention, complete raw/profile preservation
and physical restoration with independent rereading; no private-state claim.
CHECK_06_POST_DELIVERY: complete required current gates, clean declared diff,
ordinary commit/push/PR/allCI/merge and exact merged build/native verification.

## STOP_CONDITION

Ambiguous authority, base drift, foreign WIP, invalid replay, evidence loss,
missing mandatory gate, silent fallback or third identical failure stops the
dependent loop. Preserve actual artifacts; never label partial/stale proof green.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1 and CODEX_OUTPUT_POLICY: one text block, KEY: VALUE,
basenames, exact identities, denominators, full delivery, limits and one next step.

## FAIL_PROTOCOL

Retain exact HEAD/source hashes, argv/environment/exit/raw/expected/actual and
all failed methods, scenarios, owned profiles and independent reread evidence.

### Causal fixture preparation correction before runtime edits

The whole780case RED retains ten failures. Eight are actual comparison/input or
publication assertions; one exposes the absent read-only method, and one new
in-memory port fails before its intended assertion because it omitted the
previous integrity anchor. Correct only that new port expression to return the
real adapter contract. Preserve every case/assertion and original test prefix,
retain freeze01 and the full RED, then freeze02 before runtime changes. This
is test preparation, not product evidence or an integrity waiver.

### Explicit history identity and replay budget controls

Before runtime edits, append two actual Main scheduling controls for retained
cache and in-flight head changes, and two narrowly labelled actual product-body
guard controls for replay budget and integrity refusal. They use the real
scheduler/source bodies and do not claim full pipeline or native acceptance.
Existing full Main causal proof remains byte-exact. Freeze03 preserves all
freeze02 bytes and assertions; no runtime permission or scope is expanded.
