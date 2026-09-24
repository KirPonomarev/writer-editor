# Word table portability

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: WORD_TABLES_20260925
BINDING_BASE_SHA: d4a095c877b9a45e2979f23c6b9f159791bacc38
AUTHORITY: Owner explicitly directs solo implementation of all Yalken ↔ Word cells first. Google work remains preserved in its separate deferred worktree.
DESIGN_TOOL_ROUTER: APPLICABLE_LAZYWEB_FIRST

## MICRO_GOAL
Preserve editable table topology and cell content through existing export, native Word, validated return, atomic persistence and fresh reopen. W-TABLE has 24 candidate IDs across four volumes, three Word routes and two runtime profiles. No cell is accepted until its complete independent physical route passes the official consumer.

Delivery refinement: first complete slice is TABLES on C1 across four volumes and two profiles (8 candidate IDs). C2/C3 remain the next Word-only slices: their table structural apply gate stays blocked until independently qualified. The shared table data/export/import representation is implemented once. The full W-TABLE target remains 24 and Word target remains 420. This split changes delivery granularity, not acceptance requirements.

## ARTIFACT
One bounded product/Lab integration, table schema and parser, exporter, editor rendering, independent raw oracle and official acceptance. No new dependency, generic framework or alternate writer.

## ALLOWLIST
- src/io/documentTables.js
- src/renderer/tiptap/documentTables.mjs
- src/renderer/tiptap/index.js
- src/renderer/tiptap/ipc.js
- src/renderer/tiptap/runtimeBridge.js
- src/renderer/documentContentEnvelope.mjs
- src/renderer/styles.css
- src/export/docx/docxMinBuilder.js
- src/export/docx/docxReviewPacketBuilder.js
- src/export/docx/fullManuscriptDocxReviewPacketSource.js
- src/io/revisionBridge/index.mjs
- src/io/revisionBridge/reviewTransportPackageParserV2.mjs
- src/main.js
- src/utils/docxImportLocalFilePreview.js
- src/utils/docxImportSafeCreate.js
- src/io/revisionBridge/exactTextMinSafeWrite.mjs
- test/contracts/revision-bridge-docx-tables.contract.test.js
- test/contracts/revision-bridge-docx-import-reference.contract.test.js
- test/unit/document-tables.test.js
- test/contracts/tiptap-document-tables.contract.test.js
- scripts/ops/rtk-interop-word-manuscript-fixtures.mjs
- scripts/ops/rtk-interop-word-manuscript-readback.py
- scripts/ops/rtk-interop-word-manuscript-batch.mjs
- scripts/perf/rtk-interop-word-manuscript-batch-plan.mjs
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- test/contracts/rtk-interop-word-manuscript.contract.test.js
- test/unit/rtk-interop-word-manuscript.test.py
- docs/tasks/2026-09-25--word-tables.md
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json

Scope amendment before affected-chain updates: generated renderer bundle and existing content-preview regression follow the table behavior change. Original preflight remains the recorded clean-base preflight; this amendment is not a second PASS receipt.

- src/renderer/editor.bundle.js
- test/contracts/revision-bridge-docx-content-preview.contract.test.js

Independent table-reader scope amendment before creation: `scripts/ops/rtk-interop-word-tables-readback.py` separates the bounded raw table oracle from the existing manuscript reader. No new dependency or runtime architecture.

Regression scope amendment: `test/fixtures/word-tables-native-v1.json` retains synthetic real-Word raw bytes from the diagnostic lifecycle. It is a test fixture with zero official cell credit.

Policy-pin scope amendment before edit: `scripts/ops/rtk-interop-data-c1.mjs` changes only the exact data-policy SHA after the table reader, recipe and Lab admission bindings are finalized.

Test enrollment refinement: new table regressions use maintained `rtk-word-tables.contract.test.js` and `rtk-word-table-editor.contract.test.js` names; extra-maintained live-claim classification is unchanged. `rtk-generic01-create-only-import.contract.test.js` keeps loss-receipt checks with a valid table grid, which is now preserved rather than flattened.

## DENYLIST
Unrelated shell UI, packages and lockfile, frozen denominator, owner data, foreign WIP, Google implementation and rewritten historical evidence.

## CONTRACT / SHAPES
FEATURE_INTEGRATION_MANIFEST_V1
- featureId: WORD_TABLES; featureVersion: 1; integrationMode: EXISTING_SEAM.
- domainOwner: Product Core; authoritativeData: saved scene doc-v2 and project tree.
- derivedData: validated table projection, DOCX transport and raw independent readback.
- commandIds: existing document editing/save/open, export, review intake/apply and docx.importSafeCreate.
- eventTypes: existing lifecycle and document invalidation; queryIds: existing project/document/review projections.
- productProjectionIds: activeDocument, projectTree, reviewSurface; capabilityIds: existing authoring/export/import/review capabilities.
- authorityMap: authoring and safe-create/exact-apply remain behind existing Command Kernel; renderer schema and foreign DOCX cannot authorize persistence.
- identityKeys: project, scene, source revision, generation, exact product/Lab HEAD/tree, runtime build/profile and artifact hashes.
- revisionPolicy: revalidate before dispatch and async publication; stale results never publish.
- writePath: intent -> existing kernel -> main-owned use case -> validated adapter -> atomic writer/recovery -> immutable projection.
- readPath: canonical document -> read-only projection; bounded external ZIP/XML -> untrusted derived table projection.
- requiredProductPorts: existing document, export, parser, persistence and recovery ports.
- requiredDesignOsPorts: existing command dispatch and document projection; adapterRequirements: current Electron and native Word only.
- surfaceManifests: existing editor content zone, bounded table-node extension described below; slotRequirements: no new slot.
- supportedWorkspaces: WRITE and REVIEW; platformAvailability: executed macOS Word profile only.
- accessibilityRequirements: semantic table cells and keyboard movement, current focus/selection tokens; no shell geometry changes.
- fallbacks: malformed topology rejects without flattening; unsupported non-table capabilities retain typed diagnostics.
- stateClasses: PROJECT_STATE, AUTHORING_WORKING_STATE, DERIVED_STATE; persistenceClass: existing doc-v2 and atomic save.
- migrations: no serialized envelope version change; recovery: preserve original bytes and existing snapshots.
- rollback: revert this one product PR and companion Lab code, preserving evidence and project data.
- performanceBudget: bounded table dimensions and linear grid validation; no parsing or proof generation on typing hot path.
- securityBoundary: namespace-aware XML, bounded grid/span ownership; no DTD, external fetch, path authority or unvalidated continuation.
- lifecycle: actual export -> Word save/close -> independent return parse -> kernel apply -> reopen; C3 exactly five cycles.
- negativeBypassChecks: missing cell, swapped row/column, invalid/removed span, orphan merge, flattened table, stale or forged projection, forbidden direct write.
- evidenceBindings: exact raw OOXML, native row/cell observation, saved canonical scene and complete independent reopen proof.
- currentReality: table export/import/editor path absent at base; every table acceptance remains TARGET.

SURFACE_MANIFEST_V1
- surfaceId: existing WRITE editor content; no new visual zone or toolbar.
- product purpose: write and interchange a structured manuscript without losing document content.
- primary user: author editing a local manuscript on desktop and exchanging Word files.
- principles: preserve authored structure; retain existing editor typography and tokens; use semantic cells and keyboard access; expose unsupported input as typed failure.
- success observation: an imported table remains a table with the same row/column/merge layout and editable paragraph content after save and fresh reopen.
- projection: revision-bound canonical scene; intent dispatch: existing authoring/save commands.
- presentation: table/tbody/tr/td/th inside existing editor page; selection uses existing tokens; horizontal overflow is local to document content.
- out of scope: new ribbon, insertion palette, shell layout, colors, fonts and public design sharing.
- reference: private Lazyweb search 5d615623-d220-4db6-b337-818d5d4b38a9; Slite inline table only. Weak coverage is not proof of merged-cell behavior. Installed ProseMirror table schema/plugin is the technical source.

O: Table topology, cell paragraphs, empty/repeated text and both merge axes survive actual Word roundtrip.
T: Canonical document -> export -> native Word -> bounded import -> existing kernel -> atomic save -> reopened canonical document.
H: Preserve table ownership in the paragraph transport IR and reconstruct validated grids, instead of flattening paragraph order.
B: Keep frozen 1120 denominator, 420 Word scope, mandatory hops, source/packaged split, five C3 cycles, no-loss Flow guard and foreign WIP.
P: Failing complete table regression, malformed topology/projection negatives, real pilot, affected chain and all mandatory delivery gates.
I: Exact base d4a095c8; later candidate/merged hashes and immutable physical receipts must be recorded separately.

## IMPLEMENTATION_STEPS
1. Bootstrap, identity checks, architecture preflight and failing table regression.
2. Implement one complete table representation/export/import/editor delta.
3. Prove one physical pilot before batching remaining volume/profile combinations.
4. Independent official admission and full commit/push/PR/CI/merge chain; reverify exact merged HEAD.

## CHECKS
CHECK_01_PRE_GATE: Canon, declaration, scope, source identity and secure volume verified.
CHECK_02_POST_GATE: Positive and adversarial table topology, exporter/importer, persistence and current editor regressions.
CHECK_03_POST_GATE: Build, OSS/security, inventory, RTK certification and guardrails as required.
CHECK_04_POST_GATE: Real native source/packaged proofs; official accepted IDs and clean exact merged verification.

## STOP_CONDITION
Ambiguous identity, foreign WIP, missing oracle or invalid topology cannot become PASS. Three identical failures require another hypothesis.

## REPORT_FORMAT
Repository final fields: task, base/candidate/merged SHA, changed basenames, tests, native acceptance, delivery and measured time.

## FAIL_PROTOCOL
Typed failure and zero credit. Preserve exact artifact, failure and state; repair the bounded cause without weakening proof.
