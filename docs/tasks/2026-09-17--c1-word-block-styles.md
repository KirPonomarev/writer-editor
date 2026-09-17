# Preserve quote and code styles in generic Word import

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: C1_WORD_BLOCK_STYLES_20260917
BINDING_BASE_SHA: ea390f9508192d9076ab805e33cd8cf59fa9f917
AUTHORITY: Direct standing owner instruction to develop and independently prove import/export personally; current owner continuation requests rapid additional whole-cell progress.
DESIGN_TOOL_ROUTER: Backend-only change; precise router classification is in the architecture declaration.

## MICRO_GOAL
Preserve the existing declared rich manuscript fixture through ordinary Word C1 import, save, fresh reopen and export. Repair the reproduced quote and code losses and qualify eight C1 STYLES cells, targeting 108 total without changing the frozen 1120 denominator.

## ARTIFACT
Bounded importer/exporter repair, focused hostile-input and roundtrip tests, and existing native manuscript admission extended to the actual C1 rich fixture. No new runtime, dependency, tracker or parallel executor.

## ALLOWLIST
- src/export/docx/docxReviewPacketBuilder.js
- src/export/docx/docxMinBuilder.js
- src/io/revisionBridge/index.mjs
- src/utils/docxImportLocalFilePreview.js
- src/utils/docxImportSafeCreate.js
- test/contracts/revision-bridge-docx-block-styles.contract.test.js
- scripts/ops/rtk-interop-word-manuscript-fixtures.mjs
- scripts/ops/rtk-interop-word-manuscript-readback.py
- scripts/ops/rtk-interop-word-manuscript-batch.mjs
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- test/contracts/rtk-interop-word-manuscript.contract.test.js
- test/unit/rtk-interop-word-manuscript.test.py
- docs/tasks/2026-09-17--c1-word-block-styles.md
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json

- src/main.js (preview metadata allowlist only)
- src/export/docx/docxBlockStyles.js
- scripts/ops/rtk-interop-data-c1.mjs

## DENYLIST
- package.json
- package-lock.json
- src/renderer
- src/core
- docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json
- Historical evidence and foreign owner state

## CONTRACT / SHAPES
FEATURE_INTEGRATION_MANIFEST_V1
- featureId: C1_WORD_BLOCK_STYLES; featureVersion: 1; integrationMode: EXISTING_SEAM.
- domainOwner: Product Core owns scenes; Command Kernel owns mutations.
- authoritativeData: canonical saved scene bytes, IDs and ordered project tree.
- derivedData: corpus descriptors, immutable raw readbacks and OPS admission result.
- commandIds: existing tree.createNode, document.open, project.save, review.exportFullManuscriptDocxReviewPacket, review.activateDocxReviewPreviewSession, review.applyFullManuscriptExactTextReturn or exact batch apply, docx.previewContent, docx.previewImportPlan and docx.importSafeCreate.
- eventTypes: existing lifecycle and document invalidation only; no new event bus.
- queryIds: query.projectTree and existing product review/document projections.
- productProjectionIds: actual active document, scene tree and reviewSurface.
- capabilityIds: existing export, import and explicit review-apply capabilities.
- authorityMap: fixtures seed only disposable test projects before precondition; every scenario mutation then passes current canonical command validation and main adapters.
- identityKeys: project, scene/public node, source revision, generation, clean product head/tree, producer head/tree, build/profile and artifact hashes.
- revisionPolicy: revalidate actual saved input before publication and at return/apply; stale async results never publish.
- writePath: command intent -> existing kernel -> main use case -> validated adapter -> atomic write/recovery -> projection.
- readPath: canonical scenes -> immutable projection; independent raw artifact reads -> derived proof.
- requiredProductPorts: existing export, review parser, project persistence and recovery adapters.
- requiredDesignOsPorts: existing read-only document and command projections only.
- adapterRequirements: existing local Electron and native Word adapters; no new product platform API.
- surfaceManifests: no new visual zone; current UI remains intact.
- slotRequirements: no slot addition; supportedWorkspaces: existing WRITE and REVIEW commands.
- platformAvailability: only executed macOS source or packaged runtime with exact Word build.
- accessibilityRequirements: preserve all existing keyboard, locale and accessible UI contracts.
- fallbacks: unavailable capability or incomplete proof gives typed failure and zero credit.
- stateClasses: PROJECT_STATE and AUTHORING_WORKING_STATE remain product-owned; proof is DERIVED_STATE; shell and transient state confer no authority.
- persistenceClass: existing atomic product persistence; immutable test evidence outside owner projects.
- migrations: none; recovery: retain existing safe writer and snapshots.
- rollback: revert this one product PR and companion Lab helper/driver commits, preserving evidence.
- performanceBudget: measure all stages in seconds; target complete proof within 300 seconds per cell; this target cannot convert timeout or incomplete evidence to success.
- securityBoundary: bounded untrusted ZIP/XML, path and file identity checks; no new network, secrets, dependencies or arbitrary limit increases.
- lifecycle: one owned native controller, fresh isolated project, mandatory close and fresh reopen, zero remaining Word documents.
- negativeBypassChecks: missing/deleted/reordered scenes and paragraphs, wrong volume, whitespace and Unicode changes, fake counts, missing hops, mixed profiles, stale hashes, dirty state, unauthorized apply and incomplete cleanup.
- evidenceBindings: actual raw DOCX, native Word text, all saved scenes, rendered scene readback, source/build identity, explicit apply results and fresh merged proof.
- currentReality: 100 cells are admitted at the base. C1 quote/code preservation and eight C1 STYLES cells are targets only.


O: Quote depth, code block text and existing rich styles survive the complete ordinary import path.
T: Canonical scene -> existing exporter -> untrusted DOCX -> bounded validated projection -> canonical safe-create -> atomic persistence -> fresh readback.
H: Explicit declared quote styles preserve semantic distinction from ordinary indentation; imported code uses its existing declared style. Current parser only constructs paragraphs and headings, which loses both.
B: No inference of quote from indentation or arbitrary display names; no manuscript mutation from preview; preserve hashes, bounded parser, identity guards and whole-cell predicates.
P: Failing regression first, focused hostile projection tests, actual source and packaged C1 journeys, full independent raw style checks, mandatory CI and fresh merged admission.
I: Exact base, final candidate and merged SHA, Word provider/build, fixture digest, native run and artifact hashes.

The ordinary importer maps only explicitly defined paragraph styles in the supported Yalken transport profile. Missing definitions, invalid metadata, conflicting headings/list/code properties and unsupported code formatting must not silently produce a successful lossy rich candidate. Indentation alone remains ordinary paragraph formatting. Fixed code presentation is the existing Menlo 10pt code style. Quote depth is preserved; arbitrary Word paragraph styling and exact quote-container grouping are not new claims.

## IMPLEMENTATION_STEPS
1. Pin the reproduced loss and run the new negative regression on base.
2. Repair the current exporter and validated parser/projection seams only.
3. Exercise real native rich C1, then update existing independent reader and admission with all mandatory stages and negative controls.
4. Complete one protected delivery chain and fresh exact merged native proof.

## CHECKS
CHECK_01_PRE_GATE: Before implementation, complete bootstrap, canon/source reads, clean exact base, secure mount and architecture preflight.
CHECK_02_POST_GATE: Focused import/export, malformed metadata, style-definition, text/line-break, quote/code and existing command/receipt regressions.
CHECK_03_POST_GATE: Existing inventory, governance approvals, RTK certification, renderer build, OSS/security and guardrails.
CHECK_04_POST_GATE: Candidate and merged actual native Word runs with independent complete raw readback; preserved required subcases and frozen denominator.
CHECK_05_POST_GATE: Commit, push, PR, required CI, merge, clean exact merged verification and final scoped report.

## STOP_CONDITION
Stop on ambiguous authority, foreign changes, missing mandatory proof, hidden loss, or three identical failures. Do not count technical tests or stale evidence as whole cells.

## REPORT_FORMAT
Repository final report schema: exact SHA, scope, tests and native proof, seconds for development/native/delivery, actual cell numerator and denominator, delivery outcome and one next action.

## FAIL_PROTOCOL
Typed failure retains zero credit. Revert this one product PR and the bounded Lab driver companion while preserving all immutable evidence.
