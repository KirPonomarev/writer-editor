# WORD_LIST_FORMATS_MAC_20261002

STATUS: TARGET_DECLARED_NOT_ACCEPTED
DOCUMENT_CLASS: TASK_CONTRACT
TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BASE_SHA: 2af5c5f6352ef60696c288b15fcf80468fed8e8e

## MICRO_GOAL

Original P3d: preserve Roman and alphabetic ordered-list formats through existing
Mac import, native authoring/save/reopen, export and authenticated Word return.
Full numbering identity/continuation, styles/breaks and original Mac plan remain open.

## ARTIFACT

Bounded pure format mapping, scene feature discriminator and existing parser,
editor and exporter integration. No new writer, dependency or UI surface.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true.

## ALLOWLIST

- `src/core/word-list-format-v1.cjs`
- `src/core/word-pending-text-revisions-v1.cjs`
- `src/core/document-content-envelope-v1.cjs`
- `src/core/word-manuscript-notes-v1.cjs`
- `src/io/documentTables.js`
- `src/io/revisionBridge/index.mjs`
- `src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs`
- `src/main.js`
- `src/export/docx/docxMinBuilder.js`
- `src/export/docx/docxReviewPacketBuilder.js`
- `src/export/docx/fullManuscriptDocxReviewPacketSource.js`
- `src/renderer/tiptap/documentListFormat.mjs`
- `src/renderer/tiptap/index.js`
- `src/renderer/editor.bundle.js`
- `src/renderer/tiptap/manuscriptNotes.mjs`
- `test/contracts/revision-bridge-docx-lists.contract.test.js`
- `test/contracts/rtk-word-list-format.contract.test.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `test/contracts/rtk-word-table-cell-lists.contract.test.js`
- `test/contracts/rtk-word-note-lists.contract.test.js`
- `test/contracts/rtk-word-user-bookmarks.contract.test.js`
- `docs/tasks/2026-10-02--word-list-formats-mac.md`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`

## DENYLIST

No owner documents, dependency/workflow changes, renderer layout or new controls.
No claim that this closes persistent list identity or arbitrary Word markers.

## CONTRACT / SHAPES

O: Imported I/i/A/a list type survives edits, Save, reopen and re-export.
T: Validated numbering -> admitted candidate -> existing atomic import/Save ->
versioned Core document -> existing guarded export and review Apply.
H: Decimal-only mappings and list projections cause loss; carry an allowlisted
format through all existing paths and independently read back the resulting ZIP.
B: Existing project/annotation IDs, starts, nesting, marks, source artifacts and
transaction recovery stay protected. Old readers must refuse the new feature.
P: Focused whole-route counterexamples and early native canary; then stable gates.
I: Exact binding above; runtime and DOCX identities captured in external evidence.

### FEATURE_INTEGRATION_MANIFEST_V1

featureId: word-list-format-v1
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

## IMPLEMENTATION_STEPS

1. Reproduce decimal versus Roman/alphabetic import/export.
2. Preserve format through Core, scene envelope, schema, tables/notes and exports.
3. Execute import/edit/save/reopen/export/return canary before full gates.
4. Deliver exact candidate and verify merged SHA.

## CHECKS

CHECK_01_PRE_ADMISSION: Registry/worktree identity, T7 UUID/encryption/unlocked/writable,
bootstrap, ordered canon reads and exact-base architecture preflight.
CHECK_02_POST_CORE: Focused list and scene compatibility, invalid format refusal,
old-reader refusal, table/note formats and pending revision traversal.
CHECK_03_POST_CHAIN: Actual import/Save/review Apply and re-export; unchanged list
semantics, changed format/start/level/ownership no-write refusals and worker packet integrity.
CHECK_04_POST_NATIVE: SOURCE/PACKAGED native edit, save/reopen and Word exchange.
CHECK_05_POST_DELIVERY: Required baseline/RTK, OSS/audit, guardrails, source bindings,
CI and exact merged verification. No stale/skipped proof as PASS.

## STOP_CONDITION

Fail closed on authority, identity or preservation mismatch. No second write
contour before this delivery. Unsupported original requirements remain open.

## REPORT_FORMAT

One text block, KEY: VALUE, basenames, SHA, evidence, delivery, limits and next step.

## FAIL_PROTOCOL

After three identical failures preserve inputs and exact expected/actual evidence,
change hypothesis. Heavy local suites run serially on stable candidates only.

Same-contour preflight amendment passed on e4a3bc3b for the table negative fixture.
Type A is now supported; unknown type remains rejected, with positive cell projection
coverage. The inherited historical numbering fixture expected silent discard of a tracked
change. Current pending-review semantics correctly block both absent revision ID
and an unrepresented numbering-only delta. The regression now asserts both exact
refusals and absence of an import plan; no positive tracked-numbering claim is made.

Mechanical renderer bundle rebuild admitted by same-contour preflight on 1f1b8f38.
No renderer source or visual design changed; runtime copy must match rebuilt Core.

Affected-chain amendment on e7ceef9a adds the pending-list validator and real Main
round-trip regression. It reproduced a pre-existing refusal of clean text edits
inside lists; the packet must prove unchanged numbering semantics before admission.

On 30b9b9c3 preflight admitted the reproduced clean-list return repair. A worker
projection resolves literal returned numbering before evidence packet construction and integrity validation; Main does
not re-extract the ZIP. Admission requires the complete unchanged format, start,
level and bijective list ownership vector, bound to every returned paragraph hash.

Full RTK on 46686672 exposed recursive generic-import reentry for lists combined
with notes/comments. Numbering extraction now uses the bounded literal main XML
parser directly. The failed run remains failure evidence; native qualification
and a fresh complete RTK run remain required. Existing note-list negative fixtures
also still classify newly supported formats as invalid and need exact correction.
