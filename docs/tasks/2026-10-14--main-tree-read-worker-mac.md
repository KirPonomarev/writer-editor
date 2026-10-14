# Responsive verified project-tree reads

TASK_ID: MAIN_TREE_READ_WORKER_MAC_20261014
PARENT_TASK_ID: YALKEN_MAC_WORD_FINISH_V4_1_20261013
STATUS: COMPONENT_VERIFIED_DELIVERY_OPEN
DOCUMENT_CLASS: PROCESS
CLAIM_BOUNDARY: Read-only query responsiveness; no native cycle or release acceptance.
TYPE: CORE
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
MODE: HARD_TZ
BINDING_BASE_SHA: 6e41ce966b99a186649bcae51a541229e20a4282
OWNER_AUTHORITY: Existing Mac Word V4.1 owner goal and Root delegated causal Main starvation correction.
DESIGN_TOOL_ROUTER: INACTIVE_BACKEND_CORRECTION; validated declaration uses UNCHANGED_NO_NEW_SURFACE.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_HEAD_VERIFICATION_REQUIRED=true

## MICRO_GOAL

Keep Main responsive while unchanged Core validates a retained tree packet for
read-only projections. Avoid repeating that validation for an already guarded
unchanged periodic backup. Preserve all mutation authority and data semantics.

### MAP

O: A real retained packet can be fully verified without delaying Main heartbeat
or editor snapshot deadline; all returned selected fields equal unchanged Core.
T: Existing Main query/background context -> trusted read-only Worker port ->
unchanged Core public verification -> small immutable projection -> fresh Main
context/fence revalidation. Existing leased writer is unchanged.
H: SOURCE47 real Core read19653ms blocks Main19290ms; the same actual PM snapshot
constituents take118ms. Current backup checks cached content only after repeating
that expensive read. Offload read-only validation and move guarded existing hash
comparison before redundant lookup. No persistent validation cache.
B: Raw project/manuscript/private notes/comments/history, Core validation,
Command Kernel, source/owner/session/generation/CAS/lease and backup guards.
P: Actual retained-packet causal RED, worker heartbeat/parity GREEN, meaningful
wrong-project/stale/corrupt/readonly/missing/late negatives, complete affected
contracts, compiler and required RTK/certificate/OPS/CI/normal delivery.
I: Exact base above; codex/main-tree-read-worker-mac-20261014; pinned Node22.12.0.
Native apps remain stopped during implementation.

## ARTIFACT

Main query/background-only seam, two fixed trusted Worker-port files and appended
regressions in two existing contracts. Runtime changed-line budget320; appended
test budget600. No new dependencies, product schema, UI, network or public API.

## ALLOWLIST

- src/main.js
- src/main/projectTreeReadPort.cjs
- src/main/projectTreeReadWorker.cjs
- test/contracts/rtk-word-project-tree-cohort.contract.test.js
- test/contracts/rtk-word-scene-identity-main.contract.test.js
- docs/tasks/2026-10-14--main-tree-read-worker-mac.md
- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/WORKLOG.md
- README.md
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/post-audit-certification-set.mjs

## DENYLIST

All unlisted paths; Core mutation/read-validation changes; renderer/preload;
public commands/channels; dependencies/network; UI/style; native/profile/build
writes, authority cleanup/reseed, timeout/resource increases, Main synchronous
fallback, persistent truth cache, reset/stash/clean/rebase/force push/merge bypass.

## CONTRACT / SHAPES

FEATURE_INTEGRATION_MANIFEST_V1:
featureId=main.projectTreeReadWorker; featureVersion=1; integrationMode=NEW_PORT.
domainOwner=unchanged Product Core; authoritativeData=existing project files and
verified retained packet; derivedData=call-local immutable selected projection.
commandIds=existing commands unchanged, none added; eventTypes=none added;
queryIds=query.projectTree and existing pending-review query;
productProjectionIds=tree summary, scene history original, structural backup seed;
capabilityIds=existing query/backup capability; authorityMap=Core owns meaning,
Main owns context, fixed Worker adapter owns read-only execution only;
identityKeys=projectId/root/manifest/receipt/scene/session/owner/generation;
revisionPolicy=before/after exact raw manifest and receipt plus Main guard;
writePath=existing Kernel/leased atomic path unchanged, Worker cannot write;
readPath=Main->fixed Worker->unchanged Core->selected projection->Main guard;
requiredProductPorts=MainProjectTreeReadPort; requiredDesignOsPorts=existing
read-only query projection; adapterRequirements=fixed trusted local module,
write-refusing filesystem, bounded lifetime and output, no blocking fallback;
surfaceManifests=UNCHANGED_NO_NEW_SURFACE unchanged UI; slotRequirements=UNCHANGED_NO_NEW_SURFACE;
supportedWorkspaces=existing WRITE/PLAN/REVIEW; platformAvailability=existing
Electron Node worker_threads on supported desktop adapters;
accessibilityRequirements=existing keyboard/locale unchanged;
fallbacks=typed unavailable/error, no synchronous full read;
stateClasses=PROJECT_STATE read-only, AUTHORING_WORKING_STATE protected,
DERIVED_STATE call-local projection, TRANSIENT_STATE worker lifecycle;
persistenceClass=none new; migrations=none; recovery=fail closed without writes;
rollback=ordinary PR revert; performanceBudget=existing2500ms snapshot and120s
public deadline, no typing-hot-path work; securityBoundary=closed internal input,
unchanged Core validation and no Worker storage mutation; lifecycle=one bounded
worker per call, terminate on terminal/error/deadline, stale result discarded;
negativeBypassChecks=wrong project/fence/corruption/readonly/missing/late/bounds;
evidenceBindings=SOURCE47 causal read01 and maintained regression artifacts;
currentReality=implementation target until qualified, no native acceptance.

## IMPLEMENTATION_STEPS

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
Full ordered startup and exact source reads completed; fresh remote and mounted
UUID/encryption/unlocked/writability verified. Product architecture01 preflight
actual0 on clean6e41 precedes first task edit. Task E0/Root review precede code.
References: existing feature-integration doctrine and repository Worker adapters;
brain:refs consulted novelwriter/bibisco patterns as ideas only, no copied code.

## CHECKS

CHECK_01_PRE_IDENTITY: clean bootstrap/preflight/mounts/remote before task write.
CHECK_02_POST_E0: exact OPS-GATE and independent task review before code.
CHECK_03_POST_CAUSAL: retained real synchronous blocking RED; worker heartbeat,
complete selected parity and no-write/stale/unknown negatives.
### CHECK_03_ACTUAL_RESULTS

SOURCE47 real retained-packet read is the causal RED. Root actual full Core/Worker
selected parity and59 immutable files passed: Main lag20.44s versus Worker16.29ms;
50ms callback50.51ms, existing2500ms snapshot bound unchanged. Actual PM118ms is
Node-only component evidence. Source review is conditional on required delivery.
Focused01 retains4/6: mock response completed before concurrent fencing, and
stale injection missed fastpath file reads. Focused02 changes only new fixture
scheduling/injection and passes6/6 selected. No whole coverage is inferred.
Complete affected/risk/mandatory/CI are IN_PROGRESS; terminal receipts bind each
exact process. No native cycle or prior failure is reclassified.

### CHECK_04_POST_CHAIN

Complete affected existing contracts and source-risk chain;
normal compiler checks; independent diff review; exact mechanical companions;
required committed DATA/SUCCESSOR, certificate/fullRTK/CI/merge/merged checks.

## STOP_CONDITION

Stop for wider semantics/authority, foreign WIP or third repeated signature.
Keep SOURCE47 FAILED and all native operands immutable. One PR/revert scope.

## REPORT_FORMAT

One text KEY:VALUE block, basenames only. Final materials/logs on T777; temporary
small regression runtime only separately declared D03. Missing proof stays OPEN.

## FAIL_PROTOCOL

Retain exact failures/raw logs/input hashes. No skipped/stale/count-only evidence
as acceptance. Normal delivery remains required before any new native build.
