# Complete native Word tracked-review semantics

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: WORD_REVIEW_SEMANTICS_20260917
BINDING_BASE_SHA: de1a662d0804c5afa50cc4af9efd91bf32deaa6f
AUTHORITY: Standing direct owner instruction to personally continue until all 1120 import/export cells are fully implemented and independently proved.
DESIGN_TOOL_ROUTER: Backend-only product and proof work; classification is in the architecture declaration.

## MICRO_GOAL
Prove all six tracked-review mandatory subcases in C2/C3 across the four supported Word volumes and both actual profiles. Native insert/delete, actual native property revision, authorship/provenance and typed manual-only visibility must survive intake without silent apply. Existing explicit text apply, save, fresh reopen and terminal reexport remain mandatory. Preserve all 126 previous field predicates.

## ARTIFACT
The existing manuscript driver and independent raw reader extended with a native property-review subcase and complete tracked revision proof. No new framework, dependency, runtime network or product UI.

## ALLOWLIST
- src/main.js
- src/io/revisionBridge/reviewTransportPackageParserV2.mjs
- test/contracts/rtk-word-latest-semantic-b02-package-parser.contract.test.js
- docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json
- scripts/ops/rtk-interop-word-manuscript-fixtures.mjs
- scripts/ops/rtk-interop-word-manuscript-readback.py
- scripts/ops/rtk-interop-word-manuscript-batch.mjs
- scripts/ops/rtk-interop-data-c1.mjs
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- test/contracts/rtk-interop-word-manuscript.contract.test.js
- test/unit/rtk-interop-word-manuscript.test.py
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/tasks/2026-09-17--word-review-semantics.md

## DENYLIST
- src/renderer
- package.json
- package-lock.json
- Frozen denominator, ledger, envelope and archived validators
- Product UI and runtime network
- Owner documents and historical evidence

## CONTRACT / SHAPES
FEATURE_INTEGRATION_MANIFEST_V1
- featureId: WORD_REVIEW_SEMANTICS; featureVersion: 1; integrationMode: EXISTING_SEAM.
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
- adapterRequirements: existing local Electron and native Word adapters plus the separately authorized external Google evidence connector; no new product platform API.
- surfaceManifests: no new visual zone; current UI remains intact.
- slotRequirements: no slot addition; supportedWorkspaces: existing WRITE and REVIEW commands.
- platformAvailability: only actually executed source and packaged runtimes, exact native Word revision footprint and local document identity, plus terminal Word readback.
- accessibilityRequirements: preserve all existing keyboard, locale and accessible UI contracts.
- fallbacks: unavailable capability or incomplete proof gives typed failure and zero credit.
- stateClasses: PROJECT_STATE and AUTHORING_WORKING_STATE remain product-owned; proof is DERIVED_STATE; shell and transient state confer no authority.
- persistenceClass: existing atomic product persistence; immutable test evidence outside owner projects.
- migrations: none; recovery: retain existing safe writer and snapshots.
- rollback: revert this one product PR and companion Lab helper/driver commits, preserving evidence.
- performanceBudget: measure all stages in seconds; target complete proof within 300 seconds per cell; this target cannot convert timeout or incomplete evidence to success.
- securityBoundary: bounded untrusted ZIP/XML, path and file identity checks; no product runtime network, secrets, dependencies or arbitrary limit increases.
- lifecycle: one owned native controller, fresh isolated project, mandatory close and fresh reopen, zero remaining Word documents.
- negativeBypassChecks: missing/deleted/reordered scenes and paragraphs, wrong volume, whitespace and Unicode changes, fake counts, missing hops, mixed profiles, stale hashes, dirty state, unauthorized apply and incomplete cleanup.
- evidenceBindings: actual raw DOCX, native Word text, all saved scenes, rendered scene readback, source/build identity, explicit apply results and fresh merged proof.
- currentReality: 126 cells were admitted at the base. Review-semantic cells remain targets until real tracked revisions, property-change preview without writes, explicit durable text apply, fresh reopen and independent native and raw readback.


O: Every claimed tracked-review field independently proves insert, delete, property typing, author/time provenance, no silent apply and explicit manual-only reasons.
T: Product export -> native Word edit/save/reopen -> bounded untrusted return -> authenticated preview -> explicit current command -> atomic save -> fresh process -> terminal Word -> independent raw oracle.
H: The existing parser and preview retain tracked property semantics; adding a real property revision and comparing raw XML to preview diagnostics will reveal any missing metadata or hidden apply. A missing link must fail, not become an unsupported-preservation success.
B: Preserve owner files, unchanged fixed axes and all existing native predicates; no mocked provider, parser-only cell, historical relabelling or mixed-head admission. Comment export omission remains unproved and outside this bounded contour.
P: Native diagnostic on candidate, corruption controls on the independent reader and admission checks, affected and maintained tests, governance/build/OSS/CI, protected merge and fresh native journeys plus official consumer at merged SHA.
I: Exact base, runtime head/tree/profile, clean pinned Lab code, raw source/return bytes, export/round IDs, all canonical scene hashes, manifest hashes, command results, native revision metadata and exact owned cleanup.

## IMPLEMENTATION_STEPS
1. Extend the existing owned Word harness with actual tracked formatting and a separately retained no-write intake.
2. Independently compare all revision footprints, authorship/timestamps and property diagnostic reasons; retain the complete raw returned artifact.
3. Reject altered or missing footprints, hidden apply and substituted metadata with focused negatives.
4. Deliver through protected PR and repeat native and independent proofs on the actual merged SHA.

## CHECKS
CHECK_01_PRE_GATE: Secure volume, clean exact base, bootstrap, current canon and architecture preflight.
CHECK_02_POST_GATE: Focused reader, producer-boundary and admission corruption controls; affected review parser and product command tests.
CHECK_03_POST_GATE: Maintained RTK, inventory, OPS, guardrails, certification, generated build, OSS and security.
CHECK_04_POST_GATE: Complete source and packaged physical journeys, independent raw proof and owned cleanup.
CHECK_05_POST_GATE: Commit, push, PR, required CI, protected merge and merged exact verification.

## STOP_CONDITION
Ambiguous identity or authority, foreign state, missing mandatory proof, semantic loss, or three repeated identical failures. Zero automatic credit from process success or count-only evidence.

## REPORT_FORMAT
Repository final report schema with exact identities, executed test counts, complete cell numerator and denominator, full-cycle seconds, delivery and limits.

## FAIL_PROTOCOL
Retain failures and raw bytes with zero credit. Revert the bounded proof change and pinned Lab companions together. Full 1120 objective remains active.

Native diagnostic observation: a complete baseline cycle took 19.775 seconds. Intake omitted revision authors and dates and the parser omitted the separate Word UTC carrier. This contour preserves those values in the existing read-only result; no authority is derived from them. The UTC namespace follows Microsoft MS-DOCX word16du schema: https://learn.microsoft.com/en-us/openspecs/office_standards/ms-docx/e5d0aa0c-4ecc-40d9-a0e0-aac8655a8316 .
