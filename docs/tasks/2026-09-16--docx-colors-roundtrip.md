# Preserve existing editor colors through DOCX

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: DOCX_COLORS_C1_20260916
BINDING_BASE_SHA: 65107e5d13c52504139c04bb291e88514a67f17a
AUTHORITY: Direct owner continuation of personal product import/export implementation.

## MICRO_GOAL
Preserve existing foreground and highlight RGB colors through DOCX and actual Word return. Correct native Word palette values when reusing the existing review encoding.

## ARTIFACT
Bounded color encoding and preview reconstruction; independent native before/after proof. No full STYLES or whole-cell promotion.

## ALLOWLIST
- src/export/docx/docxMinBuilder.js
- src/export/docx/docxInlineColors.js
- src/export/docx/docxReviewPacketBuilder.js
- src/io/revisionBridge/index.mjs
- src/io/revisionBridge/reviewTransportPackageParserV2.mjs
- test/contracts/revision-bridge-docx-colors.contract.test.js
- docs/tasks/2026-09-16--docx-colors-roundtrip.md
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json

## DENYLIST
Editor/UI/schema, Core writers, command authority, package dependencies, provider/network behavior, frozen raw oracle, denominator and historical evidence.

## CONTRACT / SHAPES
O: Source and returned per-character color/background agree after actual Word save/reopen, confirmed import and process restart.
T: Canonical doc-v2 marks -> existing DOCX export -> validated bounded XML -> preview -> existing admitted safe-create -> persisted doc-v2 -> existing editor projection.
H: Minimal export and generic import only carry four boolean marks. Extend the existing run projection with validated color/highlight RGB values, using one pure helper shared by actual existing consumers.
B: Keep source text, marks, heading/list structure, command and artifact identity, admission, retry, no-color byte compatibility and atomic persistence. Unsupported effective themes/patterns remain explicit losses.
P: Four-color baseline loses all colors; normal/cascade/off/namespace/forgery/retry tests, native Word and raw corruption checks, unchanged affected checks and full delivery.
I: Exact base above; candidate, merged source/build and evidence hashes recorded externally.
FEATURE_INTEGRATION_MANIFEST_V1: Existing import/export feature extension; no new runtime registry.
PRODUCT_PLANE: Existing PROJECT_STATE doc-v2 textStyle/highlight marks and validated import candidate.
INTERFACE_PLANE: Existing read-only editor projection; no presentation or interaction change.
COMMANDS: Existing export and confirmed import commands; capability revalidation unchanged.
QUERIES_EVENTS_EFFECTS: Existing source snapshot/preview query and file adapter effects; none added.
PRODUCT_PORTS: Existing DOCX and atomic safe-create ports only.
DESIGN_OS_PORTS: Existing immutable editor content only.
STATE_CLASSES: PROJECT_STATE and AUTHORING_WORKING_STATE retain source truth; preview is DERIVED_STATE.
IDENTITY_GUARDS: Existing artifact, project, scene, preview admission, revision and generation checks remain enforced.
RECOVERY: Existing atomic create, retry and reopen; no alternative writer.
PERFORMANCE_ACCESSIBILITY: No new typing work; existing semantic marks; measure actual native cycle.
DESIGN_TOOL_ROUTER: Backend serialization/parser repair; existing product UI is unchanged.

## IMPLEMENTATION_STEPS
1. Record exact failing source and returned color profiles.
2. Reuse existing encoding through a bounded shared helper and correct Word palette mapping.
3. Extend existing strict import projection, cascade and canonical reconstruction.
4. Run negative and real native proofs; deliver and verify exact merged tree.

## CHECKS
CHECK_1_PRE_IDENTITY: Secure mount, clean branch, bootstrap, unchanged already-read canon objects and declaration preflight.
CHECK_2_POST_COLOR: Opaque RGB, palette, shading, direct/inherited/off, default yellow from the editor shortcut, boundaries, malformed/forged values and unchanged no-color bytes.
CHECK_3_POST_NATIVE: Actual Word, independent OOXML/canonical/HTML profile and raw corruptions; existing text/order admission.
CHECK_4_POST_DELIVERY: Required tests, build, policy, inventory, certification, CI, normal merge and fresh exact-head verification.

## STOP_CONDITION
Ambiguous identity, foreign WIP, silent effective color loss, authority widening, text loss, invalid-value acceptance or required gate failure.

## REPORT_FORMAT
AGENT_FINAL_REPORT_V1; one text block, basenames, exact SHAs, counts, timings and limits.

## FAIL_PROTOCOL
Preserve failed observations; after three identical failure signatures record one new hypothesis before another attempt.
