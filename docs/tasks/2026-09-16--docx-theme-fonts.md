# Restore supported Word theme fonts during import

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: DOCX_THEME_FONTS_C1_20260916
BINDING_BASE_SHA: 9c14113d4230e028161554dbd2db30fd73b96301
AUTHORITY: Direct owner continuation of personal product import/export implementation; previous alignment delivery closed.

## MICRO_GOAL
Resolve supported Word theme font selections into existing document font marks. Keep explicit overrides, actual text and unsupported-selection diagnostics intact.

## ARTIFACT
Bounded existing parser extension, focused hostile contracts and independently bound Word, persisted-scene and editor readback.

## ALLOWLIST
- src/io/revisionBridge/index.mjs
- src/renderer/editor.bundle.js
- test/contracts/revision-bridge-docx-theme-fonts.contract.test.js
- test/contracts/revision-bridge-docx-typography.contract.test.js
- docs/tasks/2026-09-16--docx-theme-fonts.md
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json

## DENYLIST
Core writers, command authority, exporter defaults, UI composition and stylesheets, dependencies, network runtime, historical evidence and frozen admission oracle.

## CONTRACT / SHAPES
O: Supported effective theme selections match actual Word readback after confirmed import and restart.
T: Validated package -> bounded relationships and theme/settings -> existing style cascade -> artifact-bound preview -> existing confirmation and atomic safe-create -> immutable editor projection.
H: Resolving fonts for the actual text avoids rejecting Latin and Cyrillic solely because unused script faces are absent. Same-element theme selection wins; a later literal override wins in the cascade.
B: Preserve every character, mark, color, heading, list, alignment and admission guard. Missing or ambiguous faces never become guessed Latin fonts. No glyph-fallback claim from a requested font name.
P: Real Word failure retained; focused positive and hostile contracts, independent raw reader, native Word font properties, import/restart, generated build and mandatory gates.
I: Exact base above; candidate, merged build and artifact identities recorded externally.
FEATURE_INTEGRATION_MANIFEST_V1: Bounded extension of existing import; no new registry, command, surface or writer.
PRODUCT_PLANE: Existing fontFamily and fontSize marks in canonical doc-v2.
INTERFACE_PLANE: Existing immutable editor content projection only.
COMMANDS_QUERIES_EVENTS_EFFECTS: Existing preview query, import confirmation, authoring events and local file adapters; none added.
PRODUCT_PORTS: Existing bounded reader, artifact admission, atomic safe-create and export ports.
DESIGN_OS_PORTS: Existing read-only document projection.
STATE_CLASSES: Preview remains DERIVED_STATE; admitted document uses existing PROJECT_STATE and AUTHORING_WORKING_STATE.
IDENTITY_GUARDS: Existing project, scene, revision, generation and artifact admission revalidation preserved.
RECOVERY: Existing retry, atomic persistence, undo and restart remain unchanged.
PERFORMANCE_ACCESSIBILITY: Existing font marks and editor controls; measure actual parse and native lifecycle times.
DESIGN_TOOL_ROUTER: Backend semantic parser repair; existing visual contract unchanged.

## IMPLEMENTATION_STEPS
1. Bind the actual Word Save As failure and native font observations.
2. Read bounded internal theme/settings parts with strict namespace and relationship validation.
3. Resolve tokens, inheritance and supported actual-character font selections; retain explicit losses elsewhere.
4. Exercise hostile inputs, independent raw readback and native import/restart.
5. Deliver and repeat checks on the merged source.

## CHECKS
CHECK_1_PRE_IDENTITY: Secure volume, clean branch, bootstrap, unchanged ordered canon and declaration preflight.
CHECK_2_POST_PARSER: Theme tokens, style cascade, explicit overrides, aliases, language, mixed text and unresolved faces.
CHECK_3_POST_NEGATIVE: Malformed XML, duplicate properties, external or ambiguous relationships, unsafe font values and forged admission.
CHECK_4_POST_NATIVE: Word font selections, durable scenes, actual editor and restart; original text/structure/color/alignment oracles retained.
CHECK_5_POST_DELIVERY: Focused tests, reproducible generated build, inventory, policy, certification, CI, normal merge and fresh exact-head verification.

## STOP_CONDITION
Foreign state, ambiguous identity, silent text loss, guessed font face, authority widening or mandatory gate failure.

## REPORT_FORMAT
AGENT_FINAL_REPORT_V1; exact identities, counts, timings, open limitations and no unearned whole-cell credit.

## FAIL_PROTOCOL
Preserve failed raw artifacts. After three identical failures record the signature and a different hypothesis before retrying.
