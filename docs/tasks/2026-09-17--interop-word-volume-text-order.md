# Complete Word text and order at manuscript volumes

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: WORD_VOLUME_TEXT_ORDER_C1_C2_20260917
BINDING_BASE_SHA: e9af97b86ef83a19a32afc36d5ef416e3715c4b6
AUTHORITY: Direct owner request for fast implemented and independently proven cells. Root executes this volume batch personally.

## MICRO_GOAL
Extend the complete native C1/C2 TEXT and ORDER journeys to multi-scene, 100000-word synthetic novel and 500000-word large document in source and packaged runtimes. Twelve new native journeys can provide twenty-four additional cells after separate field checks; repeats provide zero additional IDs.

## ARTIFACT
Fixed synthetic volume fixtures, native full-manuscript journeys, independent complete-body readback, bounded batch admission and any directly reproduced export repair required for that same outcome.

## ALLOWLIST
- scripts/ops/rtk-interop-word-volume-fixtures.mjs
- scripts/ops/rtk-interop-word-volume-readback.py
- scripts/ops/rtk-interop-word-text-order-batch.mjs
- scripts/ops/rtk-interop-word-text-order-readback.py
- scripts/ops/rtk-interop-100-denominator-v1.mjs
- scripts/ops/rtk-interop-data-c1.mjs
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- test/contracts/rtk-interop-word-volume.contract.test.js
- test/contracts/rtk-interop-word-text-order-batch.contract.test.js
- test/contracts/rtk-interop-100-denominator.contract.test.js
- test/unit/rtk-interop-word-volume.test.py
- docs/tasks/2026-09-17--interop-word-volume-text-order.md
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json
- src/export/docx/fullManuscriptDocxReviewPacketSource.js
- src/export/docx/docxReviewPacketBuilder.js
- test/contracts/rtk-word-full-manuscript-volume.contract.test.js

- src/main.js
- src/io/revisionBridge/index.mjs
- src/core/writer-local-profile-v1.cjs
- test/unit/r24-wp307-writer-local-profile.test.js
- test/unit/r24-wp307-writer-local-profile-mutants.test.js
- test/unit/r24-wp307-writer-local-profile-integration.test.js

## DENYLIST
Frozen denominator and historical accepted evidence, private manuscripts, other agents' work, renderer UI, new Core writers or authority channels, dependency changes, runtime network, weakening input limits, bypassing required gates, fixture-only cell claims.

## CONTRACT / SHAPES
FEATURE_INTEGRATION_MANIFEST_V1
- featureId: WORD_VOLUME_TEXT_ORDER; featureVersion: 1; integrationMode: EXISTING_SEAM.
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
- currentReality: eight single-scene cells were admitted on the base above. Three additional volume classes are targets pending actual execution.

O: complete text and order survive each required canonical hop on the declared volume.
T: frozen denominator -> actual product commands -> immutable raw evidence -> independent readers -> official derived admission.
H: full-manuscript commands reuse existing scene mappings; one physical route can prove two fields while complete-body readers detect loss without per-paragraph UI work.
B: preserve owner projects, old evidence, scene identity, security limits and existing unsupported-feature boundaries.
P: start with an actual multi-scene native probe; execute focused corruption/negative controls and all mandatory delivery gates, then fresh merged native journeys.
I: exact clean base above, runtime copy and package pins, producer identity and per-artifact digests.

Visual design routing is outside this nonvisual implementation scope. No research service or design tool is invoked.

The first three-scene rich-document native export on the base rejects
RTK_V4_PUBLICATION_GATE_PROVISIONAL_TEXT_MISMATCH. The source hashes the
envelope display paragraph separators while the DOCX carries authored blocks.
Derive the expected baseline from original authored blocks and preserve empty
paragraphs exactly in the provisional reader; the reader must still reject
coherently rehashed changed, missing or reordered paragraphs. The executed
negative control also caught that grouping parsed paragraphs by scene masked
whole-scene reordering; enforce declared block order before grouping.

A 500k-word real-builder probe produced a 30.5 MB DOCX with 25.3 MB of
advisory XML and was rejected by the existing 10 MiB part limit. Full baseline
maps remain in the main-owned authenticated capsule; the public DOCX advisory
now carries their correlation digests instead of duplicate baseline content.
Document XML, signed carriers and local recovery authority stay byte-identical
for the same source. Publication uses the existing full-manuscript parse
profile already used by return intake; all input and parser ceilings stay unchanged.

The native 500k-word generic import then parses successfully but cannot publish
its 4.6 MB content preview into a 4 MiB internal reference entry. Main allows an
8 MiB entry within the unchanged 16 MiB total cache budget; original file/IPC
limits, expiry, context checks, immutable snapshots and typed failure remain.
This is internal derived-cache allocation, not a larger untrusted input budget.

Preview command message-size validation measures the received wire payload before
resolving a main-owned reference. The resolved snapshot still passes the same
schema, depth, provenance and admission checks; direct oversized input still
fails. Novel and large-document C1 journeys select the actual owned file through
the existing native dialog so their full bytes never cross the bounded IPC message.

The actual packaged native probe rejects the existing full-manuscript export as
an optional Review system. This owner-authorized volume implementation extends
the local packaged DOCX survivor list by exactly that existing export command.
The canonical kernel, entitlement, export validation and atomic adapter remain
the execution path. Optional Review, Plan, Atlas and full-manuscript apply stay
disabled; local certification does not add signing or public distribution.

The independent reader accepts only an empty w:lastRenderedPageBreak as a
cached pagination marker, as specified by ISO/IEC 29500 and Microsoft Learn:
https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.lastrenderedpagebreak
Actual authored line/page breaks and markers containing content remain rejected.

## IMPLEMENTATION_STEPS
1. Execute a three-scene full-manuscript source probe through real product commands and Word.
2. Extend only that proven route to fixed 100k and 500k corpora; repair directly reproduced export faults with unchanged protocol and security boundaries.
3. Implement independent complete-body/scene-order readbacks and mutation controls.
4. Deliver one PR for all volume cases and run fresh merged C1/C2 source/packaged proof.

## CHECKS
CHECK_1_PRE_IDENTITY: mounted encrypted writable verified UUID, clean exact base, bootstrap, ordered source reads and declaration preflight before changes.
CHECK_2_POST_NATIVE: canonical export, Word lifecycle, intake, explicit C2 apply/save/reopen/reexport/final Word, source and package identity.
CHECK_3_POST_ORACLES: independently reconstruct fixed expected corpus; complete paragraph/order equality, volume minimum, seven locales, spaces and empty paragraphs; coherent adversarial mutants reject.
CHECK_4_POST_GATES: focused tests, actual non-skipped RTK, build, inventory, OPS, agent guardrails and required CI.
CHECK_5_POST_DELIVERY: clean commit/push/PR/merge with exact merged identity and fresh native proof; count only unique full cells.

## STOP_CONDITION
Ambiguous ownership, foreign dirty changes, unauthorized effects, silent data loss, invalid evidence or repeated failure without a new falsifiable hypothesis. Preserve failed runs.

## REPORT_FORMAT
AGENT_FINAL_REPORT_V1 with actual cell IDs, numerator and denominator, before/after/merged identities, physical/proof/total seconds, delivery and next step.

## FAIL_PROTOCOL
Never change expected bytes to match a defect. After three identical failure signatures preserve exact source/head/seed/artifacts and select one new hypothesis. Partial/candidate results remain diagnostic with zero admission credit.
