# WORD_PARAGRAPH_LAYOUT_MAC_20261003

STATUS: TARGET_NOT_ACCEPTED
TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BASE_SHA: 582145158c9a63095892a36a3125723c582a071b
AUTHORITY: Owner-authorized original Mac Word plan P3-08 and section8; no full-feature acceptance claim.
DESIGN_ROUTER_BINDING: architecture declaration and feature manifest; mechanical document representation only.

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

- `src/core/word-stories-v1.cjs`
- `test/contracts/rtk-word-header-footer.contract.test.js`

- `test/contracts/revision-bridge-docx-typography.contract.test.js`
- `test/contracts/revision-bridge-docx-theme-fonts.contract.test.js`
- `test/contracts/rtk-word-review-default-typography.contract.test.js`
- `test/contracts/revision-bridge-docx-inline-styles.contract.test.js`

- `src/renderer/tiptap/manuscriptNotes.mjs`
- `test/contracts/rtk-word-header-footer-authoring.contract.test.js`
- `test/contracts/rtk-word-http-links.contract.test.js`

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

Native semantic calibration before candidate qualification: independent literal OOXML fixtures observed in Microsoft Word on this Mac. Direct firstLine240 overrides inherited hanging360 (special indent0.42cm); direct hanging240 overrides inherited firstLine360 (special hanging0.42cm). When both attributes occur in one layer, Word selects hanging360 (0.63cm) in both XML attribute orders. Exact twips come from original fixture XML; dialog centimetres are rounded. Dialogs were cancelled without modifying inputs. These observations define the independent effective-layout oracle, not product acceptance. Raw tuple preservation and effective render precedence remain separate assertions.

External evidence basenames: native-indent-calibration-v3.json; native-indent-calibration-v2.json; remaining-indent-diagnostics-expected-hypotheses.json; native-reverse-selection.txt; native-reverse-paragraph-dialog.txt; native-same-layer-selection.txt; native-same-layer-paragraph-dialog.txt; native-same-layer-reversed-selection.txt; native-same-layer-reversed-paragraph-dialog.txt. V3 independent oracle accepts eight scoped inputs (six-paragraph original and Word rewrite, three diagnostic originals and their three native-opened copies) and rejects eleven corrupted variants. It preserves raw indent layers separately from effective precedence; no Yalken native return claim yet.


Early product observation (uncommitted candidate, not qualification): independent original imported through the actual generic preview and canonical envelope, then ordinary DOCX export passed external checker-v4 against unchanged six-paragraph expectations. Native Word opened it and exact STYLE_TABS selection showed4/6/8cm stops and1cm default interval. Changing only default interval to1.5cm in Word saved851twips and generic reimport retained851. Word removed explicit zero indents from ZERO_RESET, with no inherited nonzero indent; authenticated return must preserve baseline explicit zeros when effective indentation is unchanged. Strict original-to-export zero-presence check remains; native effective-zero oracle is a separate explicitly selected comparison. Evidence: early-parent-native-observations.json, early-parent-word-changed-default-import.json, native-effective-zero-calibration-v5.json. UI editing, authenticated Apply, packaged runs and stable-candidate qualification remain pending.


Intermediate implementation checks: actual Main scene and full-book return2of2 passed with root567to851, indent720to1080, preserved explicit zero tuple, exact literal tab text and replay without writes. Independent adversarial rerun rejects all ten original malformed inputs, including the repaired foreign-namespace indent and orphan settings part; positive ordinary567 and Word-edited851 imports still produce the expected root values. Renderer targeted checks24of24 passed with no skips; mocked geometry does not qualify physical native layout. Baseline, RTK and final native checks remain required on the stable candidate. Evidence: early-focused-log-index.json, results-postrepair.json, postrepair-snapshot-binding.json.


## STOP_CONDITION
Stop affected implementation on failed mandatory check; retain failure and repair cause without weakening oracle.

## REPORT_FORMAT
One text block, exact SHA and changed basenames, tests and delivery outcomes, limitations, one next step.

## FAIL_PROTOCOL
Record exact input, observed and expected, first failing invariant. After third identical signature stop retries and change hypothesis.

Observed prerequisite before runtime edits: ops-gate reports CORE_PURITY_VIOLATION in existing word-stories-v1.cjs randomUUID fallback. Main already supplies seed. Minimal repair must require supplied allocation seed and add negative tests, retaining all state behavior; no gate exception or weakened assertion.

Native repair scope amendment: clean preflight at67ce3adc admitted four typography regression files (45 total). An earlier agent-appended inline-styles test was outside the41-path scope: its exact bytes and patch were preserved externally, its owned delta withdrawn, and only reapplied after this clean preflight. Native SOURCE01 exposed lost Times New Roman12 defaults and zero-height leader paint. Repair uses actual script slots and an explicit leader paint area; no native acceptance claim until rerun.

Native repair intermediate evidence: typography chain112of112 and header chain42of42 passed with zero skips; these are working-tree checks, not delivery. Header fixture settings ownership was repaired without changing its story content; orphan settings now report WORD_SETTINGS_BINDING_INVALID instead of INTERNAL_ERROR. SOURCE01 profile and documents are retained externally, and its verified owned process was stopped after Save. A final settings-root namespace adversarial check remains before freezing the next candidate.

Final native and RTK repair amendment: clean preflight atde6e761d admits48paths before writes. Actual Word clear-default calibration places all three TARGET labels identically; isolated actual Tiptap reproduces incorrect37.8,75.6,75.6CSSpx. Repair only derived default-grid skipping, retain raw clear markers. RTK2960of2962 passed with zero skips; two failures require auxiliary authoring removal of empty root attrs after null normalization and complete content-type declarations in hyperlink-theme fixture. Nonempty root metadata must remain rejected in auxiliary bodies; runtime settings validation remains strict. de6e SOURCE03 and PACKAGED03 ten scoped native cycles and two ordinary exports are retained as intermediate evidence, not final-candidate acceptance.

Repair evidence before final candidate freeze: isolated real Chromium using actual imported independent-clear-default-calibration.docx now places all three TARGET labels at37.8046875CSSpx, retaining identical model JSON. Native Word screenshot supplied expected equality independently. Targeted renderer chains36of36 and auxiliary/link chains31of31 pass with zero skips; nonempty root attributes remain rejected by auxiliary rich-body validation. Evidence basenames: native-clear-default-observation.json, isolated-browser-clear-red-de6e.json, isolated-browser-clear-green-de6e.json, renderer-clear-both-de6e.log, final-auxiliary-links-repair-31.log. Final runtime/build and mandatory delivery proofs remain required.
