# Complete Word manuscript field journeys

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: WORD_MANUSCRIPT_FIELDS_C1_C2_C3_20260917
BINDING_BASE_SHA: 5ce698ae4f1378a8fe4323975a8a523e8b060aaa
AUTHORITY: Direct owner request for roughly 100 fast implemented and independently proven cells; root executes personally.

## MICRO_GOAL
Extend actual native Word journeys to separately proved Unicode, style and multi-scene hierarchy fields plus five complete C3 cycles, targeting 100 total unique cells on four volumes and two runtime profiles; preserve the frozen 1120 denominator and closed 32-cell baseline.

## ARTIFACT
One bounded native manuscript fixture and journey driver, separate raw field oracles and existing official denominator admission. No parallel tracker or runtime framework.

## ALLOWLIST
- scripts/ops/rtk-interop-word-manuscript-fixtures.mjs
- scripts/ops/rtk-interop-word-manuscript-readback.py
- scripts/ops/rtk-interop-word-manuscript-batch.mjs
- scripts/ops/rtk-interop-100-denominator-v1.mjs
- scripts/ops/rtk-interop-data-c1.mjs
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- test/contracts/rtk-interop-word-manuscript.contract.test.js
- test/unit/rtk-interop-word-manuscript.test.py
- docs/tasks/2026-09-17--interop-word-manuscript-fields.md
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json
- src/export/docx/fullManuscriptDocxReviewPacketSource.js
- src/export/docx/docxReviewPacketBuilder.js
- src/io/markdown/index.mjs
- src/io/revisionBridge/reviewTransportPackageParserV2.mjs
- src/io/revisionBridge/exactTextMinSafeWrite.mjs
- src/main.js
- src/io/revisionBridge/index.mjs
- test/contracts/rtk-word-full-manuscript-volume.contract.test.js

## DENYLIST
- package.json
- package-lock.json
- docs/OPS/RTK/YALKEN_INTEROP_100_DENOMINATOR_V1.json
- src/renderer
- src/core
- Historical accepted evidence and raw artifacts
- New product network, secrets, dependencies or broad security limits

## CONTRACT / SHAPES
FEATURE_INTEGRATION_MANIFEST_V1
- featureId: WORD_MANUSCRIPT_FIELDS; featureVersion: 1; integrationMode: EXISTING_SEAM.
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
- currentReality: 32 text and order cells were admitted at the declared base. New fields and five-cycle C3 remain targets pending native and independent execution.


O: Observe complete native manuscript transfer and separately verified required field subcases.
T: Frozen field and route contract -> canonical commands -> raw artifacts -> independent Python reader -> official read-only product admission.
H: Shared physical execution can cover several fields and five successive cycles, with complete raw checks every round and no repeated opening of unchanged scenes between rounds.
B: Preserve owner work, exact scene identity, authored text, original 1120 denominator and all existing authority, input and recovery guards.
P: First small actual rich C2 plus trusted Chromium composition, then fixed-volume C1/C2/C3 source and packaged runs with negative controls and mandatory delivery gates.
I: Declared exact base, clean code and Lab identities, source copies, package hashes, runtime PIDs, source revision, export identity and every artifact hash.

The additional scope targets Unicode and committed composition text, styles, and nonvacuous multi-scene chapter structure. Single-scene journeys do not claim multi-chapter structure. C3 executes exactly five actual Word edit/return/apply cycles, using fresh authenticated export identities. The terminal process is fresh and final Word readback covers the full document. Intermediate cycles retain all scene bytes and Word full-body text while opening only the edited scene.

Composition uses the isolated real Chromium editable input path and records the native event sequence, trusted start/update/input, cancellation, candidate commit confirmed by subsequent trusted non-composing input, and durable save (Chromium reports compositionend as untrusted). It does not certify every operating-system IME engine. Unicode codepoints, normal forms, bidi controls and ZWJ sequences are compared independently; font fallback is observed and declared per provider.

Styles and hierarchy require nonvacuous source fixtures, complete raw readback and mutation controls. A missing mandatory subcase keeps its field unproved. Existing simple text/order journeys and historical evidence remain unchanged. Only a directly reproduced product failure can justify a repair within the declared outcome.

The native rich probe reproduced two persistence integration failures: post-Save invalidation changed the committed manifest, and accepted Word review changed the scene outside its existing WP201 commit. The fix includes invalidation in the scene/manifest transaction and injects the same main-owned publication port into the existing review recovery wrapper. Existing snapshots, journals, receipt/readback, input CAS and corruption checks remain mandatory. A stale or failed writer never acknowledges success.

The native token failure also exposed Word custom-string decoding: a random signed token contained literal `_x3eCC_`, which Word converted to a Unicode character. Custom properties now escape literal Xstring sequences; both authority readers decode once before the unchanged digest and signature checks.

https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oi29500/d34ae755-c53f-4a44-a363-c6dd3ee018a4

Technical references: Chromium Input protocol for composition and text insertion; Microsoft Open XML BasedOn and DocDefaults for style inheritance.
https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Input.pdl
https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.basedon
https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.docdefaults

## IMPLEMENTATION_STEPS
1. Execute small rich C2 and composition through actual product commands.
2. Prove raw Unicode, style and hierarchy semantics and adversarial controls independently.
3. Execute exactly five C3 cycles, then scale the same bounded recipe to source and packaged 100k and 500k documents.
4. Deliver one protected PR, repeat fresh merged native proof and derive unique whole-cell decisions.

## CHECKS
CHECK_1_PRE_IDENTITY: verified secure mount, clean base, bootstrap and architecture preflight.
CHECK_2_POST_NATIVE: actual rich C2 and composition, canonical export, native Word, authenticated intake, explicit apply and durable readback.
CHECK_3_POST_ORACLES: complete independent field checks, exact cycle count, coherent raw mutations, Unicode, style cascade and hierarchy.
CHECK_4_POST_GATES: build, focused negatives, required RTK, inventory, OPS, guardrails, certification and protected CI.
CHECK_5_POST_DELIVERY: fresh merged native and independent proof; no skipped or fabricated evidence; every claimed cell has its complete required subcases.

## STOP_CONDITION
Stop on ambiguous identity or authority, foreign changes, missing mandatory evidence, silent loss, or three identical failure signatures. Rollback: Revert the single manuscript field batch PR and its local companion Lab driver/helper commits, retaining immutable successful and failed evidence and the previous PR1937 closure.

## REPORT_FORMAT
Use the repository final report schema and report exact before, candidate and merged identity, observed numerator and denominator, tests, delivery, timings and remaining limitations.

## FAIL_PROTOCOL
Only executed independently verified fields receive credit; target 100 is not a certificate. The preceding closed baseline is 32 at the declared base.
