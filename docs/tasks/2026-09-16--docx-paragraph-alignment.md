# Preserve paragraph alignment without destroying rich text

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: DOCX_PARAGRAPH_ALIGNMENT_C1_20260916
BINDING_BASE_SHA: 370918970bd3a9b6af4f06c4830318154499b499
AUTHORITY: Direct owner continuation of personal product import/export implementation.

## MICRO_GOAL
Existing alignment controls change only paragraph alignment. Preserve left, center, right and justified paragraphs through DOCX, actual Word, confirmed import and restart.

## ARTIFACT
Structured editor transaction, bounded paragraph attributes and DOCX mapping; independent raw and native proof. No whole-cell promotion.

## ALLOWLIST
- src/io/paragraphAlignment.cjs
- src/io/paragraphAlignment.mjs
- src/renderer/tiptap/documentParagraphAlignment.mjs
- src/renderer/tiptap/index.js
- src/renderer/editor.js
- src/renderer/editor.bundle.js
- src/export/docx/docxMinBuilder.js
- src/export/docx/docxReviewPacketBuilder.js
- src/io/revisionBridge/index.mjs
- src/io/revisionBridge/reviewTransportPackageParserV2.mjs
- test/contracts/revision-bridge-docx-alignment.contract.test.js
- docs/tasks/2026-09-16--docx-paragraph-alignment.md
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json

## DENYLIST
Layout, shell styles, new surfaces, dependencies, Core writers, command authority, frozen raw oracle, denominator and historical evidence.

## CONTRACT / SHAPES
O: Alignment survives actual Word return and persisted reopen; existing buttons retain exact manuscript text, marks and block structure.
T: Existing command dispatch and capability checks -> editor adapter -> structured authoring transaction -> existing persistence. Export snapshot -> bounded XML -> admitted preview -> existing atomic safe-create -> immutable editor projection.
H: The legacy plaintext handler destroys rich formatting; bounded node attributes and one existing transaction preserve it. Both writers must map CSS justify to Word both.
B: Preserve text, inline marks, fonts, colors, headings, lists, admission, atomic persistence and artifact identities. Keep implicit alignment distinct from explicit left. Unsupported direction-dependent and distribution values are diagnosed.
P: Existing native loss baseline; focused cascade, namespace, malformed, duplicate, mixed selection, undo and stale/forged admission checks; independent raw DOCX, scene, editor and native actions; required gates and delivery.
I: Exact base above; candidate, merged source/build and artifact hashes recorded externally.
FEATURE_INTEGRATION_MANIFEST_V1: Bounded extension of existing editor and import/export; no registry or new surface.
PRODUCT_PLANE: Paragraph and heading textAlign attributes in existing doc-v2 and admitted preview.
INTERFACE_PLANE: Existing alignment controls and immutable document projection; selection determines active state.
COMMANDS: Existing cmd.project.format.alignLeft, alignCenter, alignRight and alignJustify; existing export/import commands.
QUERIES_EVENTS_EFFECTS: Existing snapshot/preview queries, authoring events and platform adapters; none added.
PRODUCT_PORTS: Existing export, bounded DOCX reader and atomic safe-create ports.
DESIGN_OS_PORTS: Existing editor content and selection projections only.
STATE_CLASSES: PROJECT_STATE and AUTHORING_WORKING_STATE hold manuscript truth; preview remains DERIVED_STATE.
IDENTITY_GUARDS: Existing project, scene, source artifact, preview admission, revision and generation guards remain enforced.
RECOVERY: Existing undo/redo, atomic create, retry and restart; no alternative writer.
PERFORMANCE_ACCESSIBILITY: Existing keyboard route and aria selection state; measure native full cycle.
DESIGN_TOOL_ROUTER: Applicable Lazyweb first. Consulted document formatting control reference; current Yalken design remains authoritative. UI craft and Design OS guide applied; no visual redesign.

## IMPLEMENTATION_STEPS
1. Bind native plaintext-loss baseline and current source identity.
2. Add bounded paragraph attributes and structured existing-command execution.
3. Preserve effective DOCX defaults, paragraph style inheritance and direct alignment; normalize both writers and readers.
4. Reuse previous font/color/list fixture and independent readers; add raw alignment corruption and real button/undo proofs.
5. Deliver with mandatory gates and verify exact merged source.

## CHECKS
CHECK_1_PRE_IDENTITY: Secure volume, clean branch, bootstrap, canon continuity and declaration preflight.
CHECK_2_POST_ALIGNMENT: Enums, defaults, inheritance, direct override, namespace, duplicates, malicious values, selected and adjacent paragraphs, no-alignment bytes.
CHECK_3_POST_NATIVE: Word export/import/reopen, computed editor alignment, actual controls, undo/redo, raw corruptions and existing typography/color/list/text proof.
CHECK_4_POST_DELIVERY: Affected tests, tracked generated build, inventory, policy, certification, CI, normal merge and fresh exact-head verification.

## STOP_CONDITION
Foreign state, ambiguous identity, silent loss, authority widening, malformed input acceptance or required gate failure.

## REPORT_FORMAT
AGENT_FINAL_REPORT_V1; one text block, basenames, exact SHAs, counts, timings and limits.

## FAIL_PROTOCOL
Keep failed observations; after three identical failures record a new hypothesis before another attempt.
