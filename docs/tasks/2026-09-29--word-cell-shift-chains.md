# Authenticated Word cell shift chains

TASK_ID: WORD_CELL_SHIFT_CHAINS_20260929
TYPE: CORE
STATUS: TARGET_NOT_ACCEPTED
ROLE: BOUNDED_PRODUCT_REPAIR_CONTRACT
CLAIM_BOUNDARY: Simple same-column tracked cell shifts on Mac only
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BASE_SHA: 3eb4f453250c82020eff7f08889212f874f32675
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

## MICRO_GOAL

O: A tracked insert-cell-down or delete-cell-up chain returns through the
existing authenticated DOCX command without losing source occurrences,
Original/Current, rich content or revision provenance. A newly tracked bottom
row retains its established row-revision semantics.
T: Trusted local export map and Core ledger -> existing Command Kernel
revalidation -> authenticated return -> existing atomic writer and recovery.
H: Word transports a donor bookmark with the inserted copy while retaining the
donor's deletion in its original cell. Longer chains have intermediate cells
with both a deletion and the next insertion. Insert-down adds a tracked row.
B: Restore markers only in a validated in-memory view; retain all external bytes
and old revisions. Protect unrelated scenes, owner checkout, private data and WIP.
P: Red reproducer; exact native-shape positive and hostile tests; affected-chain
regressions; SOURCE and PACKAGED native changed-return, restart, history and
independent minimum/full export readback; protected CI and post-merge checks.
I: Exact base above; one writer branch; immutable input/output hashes and explicit
native versus constructed fixture provenance.

## ARTIFACT

Validated parser repair, existing contract/fixture extension and exact-byte companions.

## ALLOWLIST

- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/post-audit-certification-set.mjs
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json
- test/contracts/rtk-word-table-cell-shift.contract.test.js
- test/fixtures/word-table-cell-shift-native-v1.json
- docs/tasks/2026-09-29--word-cell-shift-chains.md
- src/main.js
- src/io/revisionBridge/index.mjs
- src/io/revisionBridge/reviewTransportPackageParserV2.mjs

## DENYLIST

No dependency, runtime network, UI, alternate writer or weakened admission.
No unsupported table geometry or whole-plan claim.

## CONTRACT / SHAPES

Parser and authenticated return projection only. Extend the existing cell-shift
contract and fixture; refresh only required exact-byte governance companions.
No additional surface, command, dependency, schema migration or writer.

The full trusted table topology must still match after the existing validated
pending-row removal. Newly inserted rows may never provide source identity.
The existing authenticated main-process call supplies styles from the validated
returned package for effective donor formatting; styles never provide occurrence
authority. Coordinated formatting substitutions fail against trusted local runs.
Restored ownership requires full normalized Core Original equality against the
local source before replacement. An authenticated canonical receipt replay keeps
the existing no-write path and exact document bytes.
Every relocated range needs a unique matching native insertion/deletion,
author/date provenance, trusted source text and same scene/table/column binding.
Trusted and observed row positions corroborate ownership; repeated text alone
does not. Ambiguous, duplicate, stale or conflicting bindings fail before write.

### FEATURE_INTEGRATION_MANIFEST_V1

featureId: WORD_CELL_SHIFT_CHAINS_20260929
featureVersion: 1
integrationMode: EXISTING_SEAM
domainOwner: Product Core scene document and pending revision ledger
authoritativeData: Local export map, canonical scene revision, Core ledger
derivedData: Validated immutable returned document projection
commandIds: cmd.project.review.openDocxReviewPreviewSession,
cmd.project.review.decidePendingRevision, cmd.project.save,
cmd.project.review.exportFullManuscriptDocxReviewPacket, cmd.project.export.docxMin
eventTypes: Existing scene and review-result events; no new event authority
queryIds: query.reviewSurface
productProjectionIds: Existing scene document and pending revision projections
capabilityIds: Existing review intake, decision and DOCX export capabilities
authorityMap: Core truth; Kernel writes; Design OS presentation only
identityKeys: Project, lifecycle, scene, source revision, export round, occurrence
revisionPolicy: Existing authenticated source CAS and pending ledger validation
writePath: Kernel -> validated return -> existing atomic scene persistence
readPath: Bounded DOCX adapter -> parser -> authenticated immutable projection
requiredProductPorts: Existing file intake, export and project persistence ports
requiredDesignOsPorts: Existing read-only document and review projections
adapterRequirements: Existing macOS local file adapters
surfaceManifests: UNUSED; existing surfaces unchanged
slotRequirements: UNUSED; no new visual area
supportedWorkspaces: WRITE, REVIEW
platformAvailability: Mac qualification only
accessibilityRequirements: Existing accessible revision controls unchanged
fallbacks: Typed no-write rejection on unknown or ambiguous ownership
stateClasses: PROJECT_STATE, AUTHORING_WORKING_STATE, DERIVED_STATE, TRANSIENT_STATE
persistenceClass: Existing canonical scene envelope and readable recovery
migrations: UNUSED; document schema unchanged
recovery: Existing atomic return and durable decision history
rollback: Revert this bounded parser repair; retain original files and envelopes
performanceBudget: Existing bounded XML, 4 MiB and 1024 revision limits
securityBoundary: Validate external bytes before identity; no new path authority
lifecycle: Existing project/entity/revision guards and cancellation
negativeBypassChecks: Duplicate owners, stale source, cross-scene/table/column,
provenance/format mismatch, unsupported merged cells and added-row geometry
evidenceBindings: Exact test and artifact hashes; native evidence separately named
currentReality: Adjacent delete-up was qualified by PR2043; insert-down and
longer authenticated shift chains were explicitly left open

## IMPLEMENTATION_STEPS

1. Reproduce declared ownership failures.
2. Bind moved ranges to unique validated source deletion and geometry.
3. Verify, review and deliver through protected PR.

## CHECKS

CHECK_01_PRE_BOOTSTRAP executes before edits: bootstrap, exact clean base and architecture
preflight. CHECK_02_POST_REGRESSION and later checks execute after edits.
CHECK_02_POST_REGRESSION: Existing regressions and declared chain reproductions, zero skips/todo.
CHECK_03_POST_HOSTILE: Hostile ownership, provenance, formatting and topology counterexamples.
CHECK_04_POST_NATIVE: Native SOURCE/PACKAGED changed return and durable history with independent
Original/Current minimum/full readback. Constructed fixtures cannot substitute.
CHECK_05_POST_DELIVERY: Diff/scope review, guardrails, required CI, protected merge, exact merged
SHA affected-chain verification. Missing native proof remains an open blocker.

## STOP_CONDITION

Stop on failing required proof, identity ambiguity, unrelated dirty work, base drift or access denial. Native proof cannot be substituted.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1: exact SHA, scope, tests, commit, push, PR, CI, merge, limits and one next step.

COMMIT_REQUIRED: true
PUSH_REQUIRED: true
PR_REQUIRED: true
MERGE_REQUIRED: true
POST_MERGE_EXACT_HEAD_VERIFICATION_REQUIRED: true

DENYLIST: Dependency or runtime network changes; UI changes; alternative writer;
security-boundary expansion; fuzzy text routing; arbitrary cellIns/cellDel/
cellMerge admission; merged or multi-paragraph cell support by implication;
unknown row geometry; synthetic native-success claims; whole-plan acceptance.

## FAIL_PROTOCOL

Retain exact failure, base, candidate, artifact hashes and expected versus observed
outcome. After three identical failures, stop that loop and record one next
hypothesis. No synthetic success, suppressed gate or skipped native oracle.

OPEN_BLOCKER_E0: The unchanged base fails CORE_PURITY_VIOLATION at
review-secret-store-v1.cjs line 3; platform filesystem code is currently under
Core. This task does not weaken purity policy or broaden into adapter relocation.
OPEN_BLOCKER_NATIVE: Electron native control was rejected despite explicit owner
authorization. Word table-menu input repeated timeoutReached three times; no new
tracked cell operation was completed. SOURCE and PACKAGED acceptance are unknown.
DELIVERY_STATE: Draft candidate only until both mandatory blockers are resolved.
