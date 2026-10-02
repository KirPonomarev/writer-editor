# WORD_LIST_CONTINUATION_MAC_20261003

STATUS: TARGET_DECLARED_NOT_ACCEPTED
DOCUMENT_CLASS: TASK_CONTRACT
TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BASE_SHA: 143eb956fd6795657ba09a251c47336413256fd5

## MICRO_GOAL

Preserve list continuation identity across interruption, insertion, history, save/reopen, DOCX exports and authenticated Word text return while independent lists retain their own starts.

## ARTIFACT

Bounded pure format mapping, scene feature discriminator and existing parser,
editor and exporter integration. No new writer, dependency or UI surface.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true.

## ALLOWLIST

- `src/core/word-list-numbering-v1.cjs`
- `src/core/document-content-envelope-v1.cjs`
- `src/core/word-manuscript-notes-v1.cjs`
- `src/io/documentTables.js`
- `src/io/revisionBridge/index.mjs`
- `src/main.js`
- `src/export/docx/docxMinBuilder.js`
- `src/export/docx/docxReviewPacketBuilder.js`
- `src/export/docx/fullManuscriptDocxReviewPacketSource.js`
- `src/renderer/tiptap/index.js`
- `src/renderer/tiptap/manuscriptNotes.mjs`
- `test/contracts/revision-bridge-docx-lists.contract.test.js`
- `test/contracts/rtk-word-list-format.contract.test.js`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`
- `test/contracts/rtk-word-table-cell-lists.contract.test.js`
- `src/renderer/editor.bundle.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `src/core/word-pending-text-revisions-v1.cjs`
- `src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs`
- `test/contracts/rtk-word-note-lists.contract.test.js`
- `test/contracts/rtk-word-user-bookmarks.contract.test.js`
- `src/core/word-list-numbering-v1.cjs`
- `src/renderer/tiptap/documentListNumbering.mjs`
- `src/core/word-note-return-delta-v1.cjs`
- `src/export/docx/docxReviewPacketNotes.js`
- `test/contracts/rtk-word-list-continuation.contract.test.js`
- `docs/tasks/2026-10-03--word-list-continuation-mac.md`

## DENYLIST

No owner documents, dependency/workflow changes, renderer layout or new controls.
Full P3d, arbitrary markers and numbered headings remain open.

## CONTRACT / SHAPES

O: Continued list segments recompute after insertion; independent lists retain their own start.
T: Validated numbering -> admitted candidate -> existing atomic import/Save ->
versioned Core document -> existing guarded export and review Apply.
H: Import drops Word instance identity at the durable boundary; retain scene-local
counter links and resolve starts in Core for authoring and both exporters.
B: Existing project/annotation IDs, starts, nesting, marks, source artifacts and
transaction recovery stay protected. Old readers must refuse the new feature.
P: Focused whole-route counterexamples and early native canary; then stable gates.
I: Exact binding above; runtime and DOCX identities captured in external evidence.

### FEATURE_INTEGRATION_MANIFEST_V1

featureId: word-list-numbering-v1
productPlane: Core enum and scene feature declaration; existing Command Kernel.
interfacePlane: Existing native ordered list rendering, immutable document projection.
commands: Existing importSafeCreate, Save and authenticated review Apply.
queries: Existing document/review projections.
events: Existing committed document and review receipts.
effects: Existing import, Save, export and transaction ports.
productPorts: Existing filesystem adapters and leased atomic writers.
designOsPorts: Existing immutable document projection only.
projections: Validated list metadata and canonical orderedList type.
identityGuards: Existing project/source/session/revision/generation revalidation.
stateClasses: PROJECT_STATE, AUTHORING_WORKING_STATE, DERIVED_STATE.
surfaceManifest: Existing editor; mechanical schema preservation, no new surface.
capabilityFallback: Explicit unsupported format/marker; invalid input refuses writes.
recovery: Existing readable snapshots; feature declaration protects N-1 readers.
performance: Bounded linear document walk; no new typing-path full parsing.
accessibility: Existing ordered list semantics and keyboard controls.
negativeChecks: Forged format, namespace, unknown feature and old-reader refusal.
currentVsTarget: TARGET until actual routes and delivery proven.

### NUMBERING CONTRACT

A scene-local wordListId and wordListStart retain the identity and base start of
linked ordered-list segments. Core resolves each segment start from preceding
items in that identity group; independent lists retain their own starts. The
external numId is input data only. Import assigns bounded local IDs only when
multiple segments share a continuing counter. Ordinary HTML paste strips these
identities. A new required feature makes previous readers fail closed.

## IMPLEMENTATION_STEPS

1. Reproduce continuation versus independent restart.
2. Preserve bounded Core identity through import, authoring, history and exports.
3. Prove actual Main and native Mac paths before stable expensive checks.
4. Deliver and verify exact merged revision.

## CHECKS

CHECK_01_PRE_ADMISSION executes before repository edits: clean exact base, mounted encrypted
T7, bootstrap and architecture preflight. CHECK_02+ execute after edits.
CHECK_02_POST_CORE: continuation versus independent restart, insert/delete/history,
serialization and old-reader rejection; malformed identities, cycles and overflow.
CHECK_03_POST_CHAIN: actual Main import and authenticated return, plain/review export,
table and note preservation, scene isolation and no hidden paste authority.
CHECK_04_POST_NATIVE: early native SOURCE/PACKAGED edit-save-reopen-Word-return canary.
CHECK_05_POST_DELIVERY: stable candidate baseline, required CI, OSS, audit, guardrails; merge
and relevant exact merged SHA verification. No scope percentage from test counts.

## STOP_CONDITION

Unknown authority, unrelated dirty files, malformed external semantics, missing
required proof or source drift. No whole-plan completion from this slice.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1 and CODEX_OUTPUT_POLICY; exact SHA and observed scope.

## FAIL_PROTOCOL

Preserve failure evidence and repair the affected route. Third identical failure
stops repetition and requires a new evidence-backed hypothesis. No weakened tests.

Admission correction: architecture preflight passed before edits. Initial task
text failed the legacy OPS section-layout validator after initial implementation;
corrected to its ten-section schema before candidate commit. This is not a
claim that the first OPS check was pre-edit.
