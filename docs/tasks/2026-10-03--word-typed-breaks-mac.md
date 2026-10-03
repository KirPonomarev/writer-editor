# WORD_TYPED_BREAKS_MAC_20261003

STATUS: IMPLEMENTATION_IN_PROGRESS
DOCUMENT_CLASS: TASK_CONTRACT
TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BASE_SHA: faeaef59b211872de58183312409e4ee5df96454

## MICRO_GOAL

Retain inline page and column break meaning through existing Mac DOCX routes, including adjacent ordinary text return.

## ARTIFACT

Existing import, canonical hardBreak attribute, editor, export and authenticated return repair.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true.

## ALLOWLIST

- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`
- `src/core/word-typed-breaks-v1.cjs`
- `src/core/document-content-envelope-v1.cjs`
- `src/core/word-pending-text-revisions-v1.cjs`
- `src/io/revisionBridge/index.mjs`
- `src/io/revisionBridge/reviewTransportPackageParserV2.mjs`
- `src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs`
- `src/main.js`
- `src/export/docx/docxMinBuilder.js`
- `src/export/docx/docxReviewPacketBuilder.js`
- `src/export/docx/fullManuscriptDocxReviewPacketSource.js`
- `src/renderer/tiptap/documentBreaks.mjs`
- `src/renderer/tiptap/index.js`
- `src/renderer/editor.bundle.js`
- `test/contracts/revision-bridge-docx-content-preview.contract.test.js`
- `test/contracts/rtk-word-typed-breaks.contract.test.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `test/contracts/rtk-word-table-editor.contract.test.js`
- `docs/tasks/2026-10-03--word-typed-breaks-mac.md`

## DENYLIST

No owner data, new dependencies, layout system, section geometry, note-body typed breaks, tracked break insertion/deletion or alternate writer.

## CONTRACT / SHAPES

O: Page and column break kind/occurrence survive import, authoring, Undo/Redo, Save/reopen, both exports and adjacent Word text Apply.
T: Validated OOXML occurrence -> canonical hardBreak attribute -> existing import/authoring/Save/export ports; authenticated parser occurrence proof -> bounded adjacent-text analysis -> existing guarded writer.
H: Import currently emits untyped hardBreak for every br; exporters consequently emit line break and ordinary return rejects all newline paragraphs. Preserve the existing node with a bounded optional type and prove unchanged break identity around the text edit.
B: No inferred kind, silent drop, cross-break text write, external authority, stale publication or sibling mutation. Existing line-break defaults remain compatible.
P: Independent failing base DOCX; focused parser/editor/export/actual Main tests; native SOURCE/PACKAGED changed cycles before stable full gates.
I: Exact base above; isolated worktree and synthetic artifacts. No whole P3-08 acceptance claim.

### FEATURE_INTEGRATION_MANIFEST_V1

Integration: EXISTING_SEAM.
Product plane: canonical inline hardBreak with optional wordBreakType page or column.
Interface plane: existing editor inline break projection with semantic labels; no page-layout equivalence claim.
Commands: existing import safe-create, authoring transaction, Save, export and review Apply; bounded typed-break insertion via existing editor command dispatch.
Queries: immutable document/review projections.
Events: existing authoring/save/apply publications.
Effects/ports: existing local DOCX and atomic scene I/O.
State classes: PROJECT_STATE, AUTHORING_WORKING_STATE, DERIVED_STATE.
Guards: project, scene, revision, generation, capability, exact authenticated block and precommit CAS.
Fallback: unknown/malformed types reject; changed or crossed breaks reject ordinary-text Apply; unsupported section/note/tracked-break semantics remain explicit.
Recovery: existing atomic Save/Apply and editor Undo/Redo.
Security: no raw XML passthrough, new writer or runtime network.
Performance: existing bounded traversals and finite type grammar.
Accessibility: semantic inline break label without new layout controls or tokens.
Current: independent source page/column breaks import as ordinary hardBreak with loss messages.
Target: typed inline boundary preservation and adjacent text editing, not whole Mac qualification.
Design tool router: NOT_APPLICABLE; mechanical semantic representation.

## IMPLEMENTATION_STEPS

1. Preserve validated break occurrence through import and canonical data.
2. Extend existing editor and ordinary/review serialization.
3. Prove adjacent return without changing break identity.
4. Native changed cycles, stable gates and complete delivery chain.

## CHECKS

CHECK_01_PRE_ADMISSION: bootstrap, unchanged canon, encrypted writable mount, clean exact base and preflight.
CHECK_02_POST_FOCUSED: kind/offset bounds, namespace spoof/duplicates, authoring history, tables/lists/headings, pending text, both exports, Main Apply/replay/stale/cross-break negatives.
CHECK_03_POST_NATIVE: SOURCE/PACKAGED import/edit/Save/export, actual Word change, Apply/restart/re-export and independent XML readback.
CHECK_04_POST_DELIVERY: full RTK, baseline, companions, guardrails, OSS, audit, CI and exact merged verification.

## STOP_CONDITION

Ambiguous identity, unrelated WIP, third identical failure or missing mandatory evidence; no semantic flattening claimed as preservation.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1 and CODEX_OUTPUT_POLICY.

## FAIL_PROTOCOL

Retain expected/actual, source hashes and exact head; no disabled mandatory oracle or whole-plan claim.
