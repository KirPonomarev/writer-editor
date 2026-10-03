# WORD_PARAGRAPH_LAYOUT_MAC_20261003

STATUS: TARGET_NOT_ACCEPTED
TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BASE_SHA: 582145158c9a63095892a36a3125723c582a071b
AUTHORITY: Owner-authorized original Mac Word plan P3-08 and section8; no full-feature acceptance claim.
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

## MICRO_GOAL
O: Paragraph indentation, custom tab stops/leaders and document default interval survive generic import, real edit, save/reopen, Word change, explicit authenticated Apply and ordinary/Review export.
T: Bounded untrusted OOXML -> Core typed projection -> existing Kernel/Main capability and source revalidation -> existing safe-create/formatting transaction -> atomic saved scene -> export from committed snapshot.
H: Current parser treats paragraph stop w:tab as run atom; typed properties plus exact root source binding prevent false rejection and downstream loss.
B: Preserve all existing text, anchors, private notes, pending decisions, unsaved buffer, original DOCX and prior receipts. Root properties cannot create scene/path authority.
P: Independent literal graph + destructive oracle negatives; strict Core/parser/actual Main tests; early Word canary before broad checks; SOURCE and PACKAGED five altered cycles; mandatory baseline, RTK, OSS/audit, CI and merged-head proof.
I: Exact clean base above, codex/word-paragraph-layout-mac-20261003, verified encrypted T7; architecture preflight PASS before edits.


## ARTIFACT
One integrated paragraph-layout capability and independent native evidence.

## ALLOWLIST
- `src/core/word-paragraph-layout-v1.cjs`
- `src/core/document-content-envelope-v1.cjs`
- `src/core/word-rich-body-projection-v1.cjs`
- `src/core/word-pending-text-revisions-v1.cjs`
- `src/io/revisionBridge/index.mjs`
- `src/io/revisionBridge/reviewTransportPackageParserV2.mjs`
- `src/io/revisionBridge/reviewTransportFormattingReturnRuntime.mjs`
- `src/io/revisionBridge/reviewTransportStoriesV1.mjs`
- `src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs`
- `src/io/revisionBridge/reviewTransportMediaReturnV1.mjs`
- `src/io/revisionBridge/reviewTransportCleanLinkLabel.mjs`
- `src/main.js`
- `src/utils/docxImportLocalFilePreview.js`
- `src/renderer/tiptap/documentParagraphAlignment.mjs`
- `src/renderer/tiptap/index.js`
- `src/renderer/editor.bundle.js`
- `src/export/docx/docxMinBuilder.js`
- `src/export/docx/docxReviewPacketBuilder.js`
- `src/export/docx/docxReviewPacketNotes.js`
- `src/export/docx/docxReviewPacketStories.js`
- `src/export/docx/docxPendingRevisions.js`
- `src/export/docx/fullManuscriptDocxReviewPacketSource.js`
- `test/contracts/rtk-word-paragraph-layout.contract.test.js`
- `test/contracts/rtk-word-effective-style-return.contract.test.js`
- `test/contracts/rtk-word-n3-formatting-return.contract.test.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `test/contracts/rtk-word-pending-formatting.contract.test.js`
- `test/contracts/revision-bridge-docx-alignment.contract.test.js`
- `test/contracts/rtk-word-header-footer-runtime.contract.test.js`
- `docs/tasks/2026-10-03--word-paragraph-layout-mac.md`
- `docs/OPS/RTK/FEATURE_INTEGRATION_MANIFEST_WORD_PARAGRAPH_LAYOUT_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`

## DENYLIST
No changes outside allowlist. No new dependencies, runtime network, raw XML parallel truth, silent fallback, weakened checks, fabricated evidence, user-data edits, reset/stash/clean/force-push, shell redesign or historical receipt rewrite.


## CONTRACT / SHAPES
FEATURE_INTEGRATION_MANIFEST_V1: FEATURE_INTEGRATION_MANIFEST_WORD_PARAGRAPH_LAYOUT_V1.json. Existing seams, no new writer/bus/framework.
Core: wordParagraphIndent and wordParagraphTabs on paragraph/heading; wordDefaultTabStop on document root. Explicit zero and absence are distinct. Unknown units/properties reject before semantic loss. Native Word decides firstLine/hanging inheritance before implementation claim.
Root return: distinct document-properties operation tied to original authenticated scene source revision/raw SHA; no fake paragraph anchor. Validate conflicting duplicate root operations before any writer. Existing transaction covers combined root/paragraph changes and recovery.
Export: absent interval means720 under OOXML; exact nondefault567 supported for single scene and homogeneous manuscript. Unchanged effective720 preserves original absent versus explicit state. Mixed scene intervals refuse before publication and remain an open full-plan requirement, not a claimed equivalent normalization.
Renderer: existing Tiptap attributes and mechanical document representation; no shell controls, tokens, fonts or composition changes. Full Word pixel pagination excluded by original plan.


## IMPLEMENTATION_STEPS
First repair observed prerequisite, then typed Core/parser/import/editor/writer/return integration; native proof before broad gates.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true.
ROLLBACK: One PR revert; preserve original fixtures and canonical recovery snapshots.
NEXT: Implement and prove this original-plan slice; other Mac requirements remain active.


## CHECKS
CHECK_01_PRE_ADMISSION BEFORE writes: registry/mount, clean exact base, fresh fetch, bootstrap/canon/source reads, architecture declaration preflight.
CHECK_02_POST_TARGETED AFTER implementation: typed getter/namespace/duplicate/bounds negatives, cascade/custom-clear, exact text offsets, envelope/N-1, editor transaction and pending/auxiliary preservation, actual Main root+paragraph Apply/stale/replay/crash.
CHECK_03_POST_NATIVE: Early native ambiguity probe and first complete route; stable candidate native SOURCE/PACKAGED five cycles, independent raw XML/scene equality, no preview writes, ordinary and Review exports, reopen.
CHECK_04_POST_DELIVERY: mandatory baseline and RTK without false skipped coverage, OSS/audit, guardrails, independent diff review, clean scope, commit/push/PR/CI/merge and exact merged verification.


## STOP_CONDITION
Stop affected implementation on failed mandatory check; retain failure and repair cause without weakening oracle.

## REPORT_FORMAT
One text block, exact SHA and changed basenames, tests and delivery outcomes, limitations, one next step.

## FAIL_PROTOCOL
Record exact input, observed and expected, first failing invariant. After third identical signature stop retries and change hypothesis.

Observed prerequisite before runtime edits: ops-gate reports CORE_PURITY_VIOLATION in existing word-stories-v1.cjs randomUUID fallback. Main already supplies seed. Minimal repair must require supplied allocation seed and add negative tests, retaining all state behavior; no gate exception or weakened assertion.
