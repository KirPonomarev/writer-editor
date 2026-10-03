# WORD_HEADING_OUTLINE_MAC_20261003

STATUS: NATIVE_OBSERVED_DELIVERY_PENDING
DOCUMENT_CLASS: TASK_CONTRACT
TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BASE_SHA: b2c7c5aaebf767b0ad52e31cf5130f378ea50cdb

## MICRO_GOAL

Preserve editable heading levels 7-9 and outline/body roles in existing Mac DOCX routes.

## ARTIFACT

Existing import/editor/export/return repair, actual Main and semantic contracts, SOURCE and PACKAGED native proof.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true.

## ALLOWLIST

- `src/io/revisionBridge/index.mjs`
- `src/io/revisionBridge/reviewTransportPackageParserV2.mjs`
- `src/io/revisionBridge/reviewTransportCleanLinkLabel.mjs`
- `src/io/revisionBridge/reviewTransportStructuralReturnRuntime.mjs`
- `src/export/docx/docxMinBuilder.js`
- `src/export/docx/docxReviewPacketBuilder.js`
- `src/export/docx/fullManuscriptDocxReviewPacketSource.js`
- `src/core/word-pending-text-revisions-v1.cjs`
- `src/renderer/tiptap/index.js`
- `src/renderer/tiptap/documentHeadings.mjs`
- `src/renderer/editor.bundle.js`
- `test/contracts/revision-bridge-docx-headings.contract.test.js`
- `test/contracts/rtk-word-heading-outline.contract.test.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `docs/tasks/2026-10-03--word-heading-outline-mac.md`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`

## DENYLIST

No owner documents, dependency changes, UI layout or controls, new writer, numbered-heading extension or arbitrary style preservation claim.

## CONTRACT / SHAPES

O: Levels 1-9 and body reset remain exact through import, edit, Undo/Redo, Save, reopen, export and authenticated Word return.
T: Validated OOXML metadata -> canonical heading attrs -> immutable editor projection -> existing command/Save and export ports; signed return -> semantic analyzer -> explicit guarded Apply.
H: Several independent level-six ceilings reject valid headings7-9; align these existing validators and render valid HTML without remapping semantic level.
B: No inferred outline from style names, guessed body resets, invalid HTML heading tags, stale write, forged identity or sibling mutation.
P: Failing regression, focused positive/negative and actual Main, SOURCE/PACKAGED native altered cycle, stable baseline and CI once.
I: Exact base above, clean isolated worktree, synthetic data and hashed input/output artifacts.
Design router: mechanical document semantics adapter; no visual design contract change. Existing h1-h6 styling is retained, higher levels use h6 presentation with exact accessible level.
References: brain:refs returned general outline UI references; implementation evidence is exact existing parser, editor extension, exporter and heading contracts.

### FEATURE_INTEGRATION_MANIFEST_V1

Integration: EXISTING_SEAM.
Product plane: existing canonical heading attrs and validated outline inheritance.
Interface plane: existing heading editor node with read-only semantic level projection.
Commands: existing authoring heading command, import safe-create, Save, review export, activation and Apply.
Queries: existing document/review projections.
Events: existing authoring transaction and save/apply publication.
Effects/ports: existing local DOCX read/export and atomic scene transaction.
State classes: PROJECT_STATE, AUTHORING_WORKING_STATE, DERIVED_STATE.
Guards: project, scene, source revision, generation, round identity, capability and CAS.
Fallback: invalid levels and unsupported combinations refuse with typed outcome; outline9 clears heading role.
Recovery: existing Save and Apply atomic recovery; Undo/Redo retains metadata.
Security: no external mutation authority or runtime network.
Performance: bounded existing parser and heading render only.
Accessibility: valid HTML headings with exact aria-level7-9, preserving inherited editing behavior.
Current: higher levels are rejected by existing parser/export and return validators.
Target: selected heading preservation only; not all P3-08 or whole Mac-plan acceptance.

Generated tracked editor.bundle.js admitted after clean scope-extension preflight at 0ecf044d; original delivery base remains b2c7c5aa. Regeneration uses the existing build:renderer command. The historical heading fixture's missing revision ID also fails on the immutable base; its valid form and missing-ID negative are now separate tests.

Native SOURCE and PACKAGED observed at 830530c55f15804a52700dc80185693eb6a84335: independent DOCX levels7/8/9 plus body imported; native Cmd-Alt-9 changed body to heading9; Undo/Redo, Save, review export, real Word text change, explicit Apply, process restart and re-export completed. Independent OOXML readback of three artifacts per build preserved outlines6/7/8/8 and exactly one expected text suffix. No native level flattening observed. Word Open dialog retained a disabled button, including a short-path identical copy; Finder successfully opened the same document. Native text insertion uses the documented text format to avoid keyboard-layout loss. Formatting lane still reports manual diagnostics (unsupported Word formatting in SOURCE, baseline not exact in PACKAGED); these remain open and are not accepted by this heading-level repair. Whole P3-08 and whole Mac plan remain unaccepted.

## IMPLEMENTATION_STEPS

1. Reproduce valid higher-level rejection.
2. Align existing semantic bounds and editor representation.
3. Prove complete native altered cycle before stable gate wave.
4. Commit, push, required CI, merge and merged exact verification.

## CHECKS

CHECK_01_PRE_ADMISSION: bootstrap, unchanged already-read active canon, encrypted writable mount, clean exact base, preflight and OPS task gate before runtime edits.
CHECK_02_POST_FOCUSED: levels1-9, empty headings, direct/style/default inheritance and body reset; malformed values/namespaces/cycles; editor history/persistence, ordinary/review export, actual Main Apply and stale/replay negatives.
CHECK_03_POST_NATIVE: SOURCE and PACKAGED import/edit/save/reopen, real Word altered return and independent XML role/level check.
CHECK_04_POST_DELIVERY: baseline, affected companions, audit, OSS, guardrails, CI, merged focused verification.

## STOP_CONDITION

Ambiguous identity, unrelated WIP, third identical failure or missing mandatory proof. No supported role may be silently flattened.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1 and CODEX_OUTPUT_POLICY, exact identities and bounded observations.

## FAIL_PROTOCOL

Preserve reproduction, expected/actual and artifact hashes. Never disable required oracle or label delivery as whole-feature acceptance.
