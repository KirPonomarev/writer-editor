# Preserve discussion ranges at completed pending revision boundaries

TASK_ID: WORD_COMMENT_REVISION_BOUNDARY_MAC_20261016
PARENT_TASK_ID: YALKEN_MAC_WORD_FINISH_V4_1_20261013
STATUS: LOCAL_SOURCE_PROOF_COMPLETE_DELIVERY_PENDING
DOCUMENT_CLASS: PROCESS
CLAIM_BOUNDARY: Existing DOCX emitter only; native Q1 and finite16 remain open.
TYPE: CORE
MODE: HARD_TZ
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
BINDING_BASE_SHA: 296e7b4092d97c8fbe136c69df8579049832be61
OWNER_AUTHORITY: Direct autonomous Mac Word finish; owner requested Root take over implementation. Root SOLE_EXECUTOR.
DESIGN_TOOL_ROUTER: OUT_OF_SCOPE_CORE_ONLY; existing serializer, no UI change.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_HEAD_VERIFICATION_REQUIRED=true

## MICRO_GOAL

O: A comment beginning on preserved text immediately after a pending insertion
has its complete range in both Current and Original exports.
T: Canonical source, revisions and discussion anchor -> existing immutable export
projection -> pending segment emitter -> existing publication validation, atomic
write/readback and authority activation.
H: The emitter appends a boundary marker to the preceding insertion before
closing it. Close only a completed outgoing revision before emitting its boundary.
B: Preserve text, formats, all canonical IDs/provenance/history, note points,
root/reply order, interior revision behavior, authority, caps and atomic recovery.
P: Actual555-byte independent XML RED, maintained boundary regressions, real
full/minimum exporter coverage, independent Current/Original readback, complete
affected tests on both engines, mandatory local gates/CI and exact merged proof.
I: Exact base above; registered existing worktree and new codex branch. Original
SOURCE80 and its90-file graph are protected during this code-only contour.

## ARTIFACT

One existing emitter correction, appended tests in two maintained contracts,
four factual/task documents and seven mechanical delivery companions. Runtime
budget20 changed lines; maintained behavior budget250 appended lines. No new
parser, dependency, writer, surface, cache or framework.

Materials/evidence: dated2026-10-16--word-comment-revision-boundary-mac folders
under the owner-selected T777 material/report roots. Tiny disposable APFS CLI
fixtures only in the explicitly declared T7-Secure runtime directory of that name.
No native application/profile/anchor or original history mutation in code phase.

## ALLOWLIST

- src/export/docx/docxPendingRevisions.js
- test/contracts/rtk-word-pending-formatting.contract.test.js
- test/contracts/rtk-word-review-default-typography.contract.test.js
- docs/tasks/2026-10-16--word-comment-revision-boundary-mac.md
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

All other paths. Main, renderer/generated assets, Core semantics, parser/admission,
schemas, dependencies, timeout/heap limits, unrelated export activation callbacks
and speculative performance changes remain unchanged. No XML postpatch, oracle
weakening, skipped tests, profile reseed, reset/stash/clean/rebase or force push.

## CONTRACT / SHAPES

FEATURE_INTEGRATION_MANIFEST_V1:
featureId=WORD_COMMENT_REVISION_BOUNDARY; featureVersion=1;
domainOwner=Product Core; authoritativeData=existing canonical revisions and
discussion anchors; derivedData=existing validated pending export segments;
commandIds=existing review DOCX export; eventTypes=existing export result;
queryIds=existing immutable export source read; productProjectionIds=existing
source/round-bound export projection; capabilityIds=existing export capability;
authorityMap=unchanged Core truth and Kernel dispatch; identityKeys=project,
scene, source revision, canonical revision, round, comment and message;
revisionPolicy=existing source/round/lease CAS; writePath=existing artifact
adapter only; readPath=canonical source through the existing pending emitter;
requiredProductPorts=existing DOCX output adapter; requiredDesignOsPorts=none;
adapterRequirements=unchanged bounded ZIP/XML; surfaceManifests=OUT_OF_SCOPE;
slotRequirements=OUT_OF_SCOPE; supportedWorkspaces=existing WRITE/REVIEW;
platformAvailability=existing DOCX export; accessibilityRequirements=unchanged;
fallbacks=all existing invalid/unsupported refusals retained;
stateClasses=DERIVED_STATE; persistenceClass=existing atomic artifact publication;
migrations=none; recovery=unchanged project transaction/reopen;
rollback=one ordinary PR revert, no data migration;
performanceBudget=constant comparison per emitted fragment, existing caps;
securityBoundary=no new input/path/command authority;
lifecycle=existing export; negativeBypassChecks=unchanged source and authority,
interior insertion/nested-format controls and exact input conservation;
evidenceBindings=actual Q1 S5 artifact, tiny independent XML RED and maintained
tests; currentReality=Original loses both starts at insertion end while Current
and complete canonical graph/export projection pass; targetOnly=finite correction,
not overall Mac or universal OOXML readiness.

Integration mode: EXISTING_SEAM. Boundary markers are emitted after closing the
completed outgoing revision. Markers strictly inside the same revision keep the
existing representation. The next revision is opened only after the boundary;
rich fragments of the same revision remain together. Note/reference ordering,
canonical source and all publication guards are unchanged.

## IMPLEMENTATION_STEPS

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
CHECK_01_PRE_IDENTITY: startup, verified mounts/registry, clean exact merged base,
architecture declaration/preflight and task E0 before runtime edits.
CHECK_02_POST_RED: maintain the actual Original missing-start reproducer.
CHECK_03_POST_FIX: surgical emitter change; boundary/interior/rich/notes controls.
CHECK_04_POST_PROOF: complete affected chains on Node22 and shipped Electron,
unchanged mandatory TAP parser, independent physical text/ranges/provenance proof.
CHECK_05_POST_DELIVERY: mechanical exact-byte companions, mandatory gates, scoped
commit/push/PR/current CI/normal merge, clean exact merged verification.
Then fresh native admission resumes interrupted Q1; no native proof is fabricated.

## CHECKS

CHECK_01_PRE_IDENTITY: exact clean base, architecture preflight and task E0.
CHECK_02_POST_PROOF: complete maintained boundary/export tests, independent XML,
mandatory gates, normal CI/delivery and fresh exact merged verification.

Tiny original/current XML must preserve full literal text and all six markers
of root/reply at their exact expected positions. Cover outgoing insertion,
deletion, adjacent revisions and paragraph end; retain interior/nested format
behavior and co-located note controls. Actual minimum and review-book serializers
must carry the same marker ownership. Existing malformed/stale/authority tests
remain mandatory. Keep original test prefixes and every historical failure.

### REFERENCES

Actual Q1_FINAL_REEXPORT01.docx, complete projection and independent Original
failure on296e7b4092d97c8fbe136c69df8579049832be61. CAUSAL_RED01 independently
observes the same loss in555 XML bytes. Current emitter and maintained pending
formatting/default-typography contracts are the implementation references.
brain:refs returned generic UI notes; no design workflow applies to this defect.

### ROLLBACK

One ordinary PR revert. Preserve original native corpus, all90 project files,
history, Word artifacts and failed evidence. No migration or authority rewrite.

## STOP_CONDITION

Stop dependent mutation on identity/base/scope ambiguity, foreign WIP, invalid
gate or third identical failure. Preserve exact inputs and report actual outcomes.

## REPORT_FORMAT

One text KEY: VALUE block; task and exact SHA/scope/denominators/delivery/limits,
one next action; basenames only.

## FAIL_PROTOCOL

Retain RED and failed processes. No native retry before causal fix and ordinary
delivery; no relocation, broader optimization, changed oracle or higher timeout.

### Observed local proof

MAINTAINED_RED01: both maintained regressions failed on the unmodified emitter
with missing Original starts. The first GREEN typography assertion used an empty
boolean tag while the existing exporter spells true as val1; that harness failure
is retained and corrected without changing marker/text expectations. Focused
GREEN02 passed2of2. Complete affected14-file chains passed524of524 independently
on Node22 and shipped Electron, with unchanged mandatory TAP evaluation and
exact source barriers, zero failure/cancel/skip/todo. Independent standard ZIP/XML
proof passed the same555-byte case and both real exporters, retaining rich text,
provenance, all six markers and exact input conservation; eight mutants refused.
Evidence INDEPENDENT_BOUNDARY01.json SHA256:
30ab2891c5ad18aec51e301495a71d44904b695a4c584f909bed76b52618e930.
Runtime change is three appended lines in the existing emitter. No native
process, original profile/anchor/history or canonical source was modified.
CI, ordinary delivery and exact merged proof remain pending at this record.
