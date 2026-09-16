# Preserve document typography through the editor and DOCX

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: DOCX_TYPOGRAPHY_C1_20260916
BINDING_BASE_SHA: 466819b1308727d14e828689ea2323f2892cb619
AUTHORITY: Direct owner continuation of personal product import/export implementation.

## MICRO_GOAL
Preserve named document fonts and exact half-point sizes through the actual editor, both DOCX writers, actual Word return, confirmed import and restart. Separate requested font identity from measured renderer font fallback.

## ARTIFACT
Bounded font/size encoding, editor attributes and preview reconstruction; independent native before/after proof. No full STYLES or whole-cell promotion.

## ALLOWLIST
- src/io/inlineTypography.mjs
- src/io/inlineTypography.cjs
- src/export/docx/docxInlineTypography.js
- src/export/docx/docxMinBuilder.js
- src/export/docx/docxReviewPacketBuilder.js
- src/export/docx/fullManuscriptDocxReviewPacketSource.js
- src/io/revisionBridge/index.mjs
- src/renderer/tiptap/index.js
- src/renderer/tiptap/documentTextStyle.mjs
- src/renderer/editor.bundle.js
- test/contracts/revision-bridge-docx-typography.contract.test.js
- test/unit/sector-m-tiptap-runtime-bridge.test.js
- docs/tasks/2026-09-16--docx-typography-roundtrip.md
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json

## DENYLIST
Shell controls, layout, tokens, font installations, Core writers, command authority, package dependencies, provider/network behavior, frozen raw oracle, denominator and historical evidence.

## CONTRACT / SHAPES
O: Source and returned per-character font/size agree after actual Word save/reopen, confirmed import and process restart.
T: Canonical doc-v2 TextStyle marks -> existing DOCX export -> validated bounded XML -> preview -> existing admitted safe-create -> persisted doc-v2 -> existing editor projection.
H: The existing editor schema and generic codec lose document font attributes. Reuse one pure synchronous value normalizer, extend existing TextStyle and preserve fully resolved uniform Word font selections in the current strict parser.
B: Keep source text, marks, heading/list structure, command and artifact identity, admission, retry, no-font byte compatibility and atomic persistence. Unsupported effective themes, missing or differing script slots remain explicit losses.
P: Read-only Georgia/18pt baseline loses both attributes; normal/cascade/off/namespace/forgery/retry tests, native Word and raw corruption checks, unchanged affected checks and full delivery.
I: Exact base above; candidate, merged source/build and evidence hashes recorded externally.
FEATURE_INTEGRATION_MANIFEST_V1: Existing import/export feature extension; no new runtime registry.
PRODUCT_PLANE: Existing PROJECT_STATE doc-v2 TextStyle attributes and validated import candidate.
INTERFACE_PLANE: Existing editor projection displays document formatting. No new surface, shell writer, toolbar or interaction contract.
COMMANDS: Existing export and confirmed import commands; capability revalidation unchanged.
QUERIES_EVENTS_EFFECTS: Existing source snapshot/preview query and file adapter effects; none added.
PRODUCT_PORTS: Existing DOCX and atomic safe-create ports only.
DESIGN_OS_PORTS: Existing immutable editor content only.
STATE_CLASSES: PROJECT_STATE and AUTHORING_WORKING_STATE retain source truth; preview is DERIVED_STATE.
IDENTITY_GUARDS: Existing artifact, project, scene, preview admission, revision and generation checks remain enforced.
RECOVERY: Existing atomic create, retry and reopen; no alternative writer.
PERFORMANCE_ACCESSIBILITY: No new typing work; existing semantic marks; measure actual native cycle and platform glyph-font readback.
DESIGN_TOOL_ROUTER: Applicable Lazyweb first. Consulted existing document editor reference; source document formatting and current Yalken UI remain authoritative. Read UI craft and current Design OS guide; no visual redesign.

## IMPLEMENTATION_STEPS
1. Record source font attributes lost in the actual editor schema and DOCX return.
2. Reuse a pure validated normalizer in renderer and existing exporters; retain no-font bytes.
3. Extend current strict parser and per-slot cascade; never guess unresolved fonts or round an inexact size.
4. Compare independent raw OOXML, doc-v2 and actual editor evidence, including available and missing-font controls.
5. Deliver with mandatory gates and verify the exact merged tree.

## CHECKS
CHECK_1_PRE_IDENTITY: Secure mount, clean branch, bootstrap, unchanged already-read canon objects and declaration preflight.
CHECK_2_POST_FONT: Literal family, exact size, defaults, per-slot cascade, namespace, invalid/forged values, plain neighbors and unchanged no-font bytes.
CHECK_2A_POST_MODULE_GRAPH: Fresh-process ESM-first, CJS-first and concurrent loading of the existing PDF/archive graph; one pure CommonJS value helper with an ESM facade, bundled by existing esbuild for the editor.
CHECK_3_POST_NATIVE: Actual Word, independent OOXML/canonical/HTML typography, actual platform font fallback, raw corruptions and existing text/order admission.
CHECK_4_POST_DELIVERY: Required affected tests, real build with byte-identical tracked renderer and preload, policy, inventory, certification, CI, normal merge and fresh exact-head verification.

## STOP_CONDITION
Ambiguous identity, foreign WIP, silent effective font or size loss, authority widening, text loss, invalid-value acceptance or required gate failure.

## REPORT_FORMAT
AGENT_FINAL_REPORT_V1; one text block, basenames, exact SHAs, counts, timings and limits.

## FAIL_PROTOCOL
Preserve failed observations; after three identical failure signatures record one new hypothesis before another attempt.
