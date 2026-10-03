# WORD_NUMBERED_HEADINGS_MAC_20261003

STATUS: IMPLEMENTATION_IN_PROGRESS
DOCUMENT_CLASS: TASK_CONTRACT
TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BASE_SHA: c2c526a38f9031e6eea95a1a78ffb44fc6bd8c18

## MICRO_GOAL

Preserve numbered headings through existing Mac import, authoring, continuation, Save, export and authenticated return.

## ARTIFACT

Existing document adapters, real editor/Main tests and SOURCE/PACKAGED Word proof.
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
- `src/io/revisionBridge/index.mjs`
- `src/export/docx/docxMinBuilder.js`
- `src/io/documentTables.js`
- `src/core/word-pending-text-revisions-v1.cjs`
- `src/core/word-comment-anchor-save-v1.cjs`
- `src/renderer/tiptap/index.js`
- `src/renderer/tiptap/documentListItems.mjs`
- `src/renderer/editor.bundle.js`
- `test/contracts/revision-bridge-docx-lists.contract.test.js`
- `test/contracts/rtk-word-numbered-headings.contract.test.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `test/contracts/rtk-word-table-editor.contract.test.js`
- `docs/tasks/2026-10-03--word-numbered-headings-mac.md`

## DENYLIST

No owner documents, new dependencies, layout or controls, alternate writer, custom multilevel labels or note body heading scope.

## CONTRACT / SHAPES

O: Numbered headings retain both outline and list identity across the existing Mac exchange.
T: Validated OOXML -> canonical listItem/heading -> existing import command, authoring Save and export ports -> authenticated return with precommit revalidation.
H: Independent paragraph-only guards currently flatten or reject a valid existing combination; permitting heading as the first list child preserves both without new storage.
B: Unrelated WIP and documents protected. Unsupported item continuations, invalid levels, numbering bounds, stale/replay and sibling identity guards retained.
P: Focused import/export, real editor history/continuation, comments/pending and actual Main; native altered SOURCE/PACKAGED cycle before required stable full gates.
I: Exact base above, isolated worktree, synthetic inputs and hashed native artifacts.

### FEATURE_INTEGRATION_MANIFEST_V1

Integration: EXISTING_SEAM.
Product plane: existing canonical list topology, counter identity and heading attrs.
Interface plane: existing immutable document projection, semantic list item with heading HTML.
Commands: existing list/heading authoring, import safe-create, Save, review export, activation and Apply.
Queries: existing document/review projections.
Events: existing authoring/save/apply publication.
Effects/ports: existing local DOCX I/O and atomic transaction ports.
State classes: PROJECT_STATE, AUTHORING_WORKING_STATE, DERIVED_STATE.
Guards: project, scene, revision, generation, capability, authenticated round and CAS.
Fallback: unsupported combinations remain typed refusal or explicit import loss.
Recovery: existing atomic Save/Apply and editor Undo/Redo.
Security: no external write authority or runtime network.
Performance: bounded existing traversals.
Accessibility: native list/heading semantics; no new visual design contract.
Current: valid numbered headings lose numbering; first list child restricted to paragraph.
Target: existing supported decimal/Roman/alpha and bullet numbering with headings; not whole P3-08 acceptance.
Design tool router: NOT_APPLICABLE; mechanical semantic adapter.

## IMPLEMENTATION_STEPS

1. Reproduce numbered-heading loss and map every affected guard.
2. Repair existing adapters and prove editor/export/return invariants.
3. Observe native altered SOURCE and PACKAGED cycles.
4. Complete stable required gates and commit/push/PR/merge/exact merged verification.

## CHECKS

CHECK_01_PRE_ADMISSION: bootstrap, unchanged canon, verified encrypted writable mount, clean base and architecture preflight.
CHECK_02_POST_FOCUSED: formats, levels1-9, nested/continued numbering, table ownership, editor history, pending/comment anchors, Main Apply/replay/stale.
CHECK_03_POST_NATIVE: SOURCE/PACKAGED actual Word altered cycle with independently read text/outline/numbering.
CHECK_04_POST_DELIVERY: full RTK, baseline, companions, guardrails, OSS, audit, CI and merged verification.

## STOP_CONDITION

Ambiguous identity, unrelated WIP, third identical failure or missing required evidence. No silent heading or numbering loss.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1 and CODEX_OUTPUT_POLICY, bounded claims only.

## FAIL_PROTOCOL

Retain expected/actual, exact SHA and artifacts; no disabled oracle or whole-feature claim.
