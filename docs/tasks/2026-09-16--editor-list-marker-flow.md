# Paginated editor list marker repair

TYPE: UI
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: EDITOR_LIST_MARKERS_C1_20260916
BINDING_BASE_SHA: 9cf590992130606a5a52bfa229cfa19a5b0ec948
AUTHORITY: Direct owner continuation of personal product import/export implementation.

## MICRO_GOAL
Keep native list markers beside their own item text in the existing paginated editor. Preserve native numbering, list roles, source text, nesting and page gaps. This repairs a reproduced Chromium layout defect, with one CSS rollback.

## ARTIFACT
Scoped editor CSS and exact native rendering, list roundtrip and negative evidence.

## ALLOWLIST
- src/renderer/styles.css
- docs/tasks/2026-09-16--editor-list-marker-flow.md
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json

## DENYLIST
Core, command semantics, persistence, parsers, renderer JavaScript and HTML, fonts, typography tokens, shell, dependencies, workflows, frozen oracle, denominator and historical proof.

## CONTRACT / SHAPES
O: Markers lead the first item line without overlap and text remains outside page gaps.
T: Existing canonical doc-v2 list nodes -> immutable editor projection -> native ol/ul/li and CSS layout. No product mutation is introduced.
H: Outside native markers are mispositioned by the existing shape-outside page flow. Put marker and first paragraph into the same line formatting context, retaining native counters and existing paragraph-scale item spacing.
B: One ProseMirror source; no manual marker strings, custom counters, page truth, removed page-gap float or change to save/import/export.
P: Recorded failing native source/reopen screenshot and isolated Chromium reproduction; actual fixed renderer, list/empty/long/nested/starts/page-gap/input checks, old-CSS negative, unchanged Word roundtrip, required CI and exact merged verification.
I: Base above; candidate/merged SHA, source/build hashes, native profile and measured timings recorded externally.
PRODUCT_PLANE: Existing authoring and durable list content unchanged.
INTERFACE_PLANE: Existing editor only; CSS presentation repair.
COMMANDS_QUERIES_EVENTS_EFFECTS: No changes or new routes.
PRODUCT_PORTS: Existing save/import/export used for regressions only.
DESIGN_OS_PORTS: Existing editor projection and computed layout only.
STATE_CLASSES: DERIVED_STATE layout only.
CAPABILITY_REVALIDATION: No runtime mutation; existing Command Kernel remains unchanged.
RECOVERY: Existing save/reopen/undo and atomic import paths unchanged.
SURFACE_MANIFEST: EXISTING_SURFACE_UNCHANGED; no new surface or runtime feature registry.

### DESIGN
DESIGN_TOOL_ROUTER: APPLIED
DESIGN_SOURCE_OF_TRUTH: Existing semantic editor lists and page-flow contract; native screenshots prove marker overlap on the source and returned document.
DESIGN_RESEARCH_SOURCES: Existing Design OS guide and tool matrix; brain refs; generic Lazyweb query returned weak unrelated references, so none was adopted. W3C CSS Lists Level 3 states outside marker positioning adjacent to floats is undefined. A local Chromium reproduction proves the actual behavior.
DESIGN_SELECTED_DIRECTION: Mechanical correction within owner-authorized product repair. Existing type, color, toolbar and shell are retained.
DESIGN_AUDIT_TOOLS: Native Electron screenshots, browser marker/text geometry, unchanged canonical data and Word raw readback.
DESIGN_TOOL_DEVIATIONS: No new design or selection decision, mockup, external screenshot upload, Growth Report or added library is needed for a reproduced CSS defect.

## IMPLEMENTATION_STEPS
1. Reproduce the defect in the real document and a minimal browser case.
2. Scope the native marker placement correction to existing editor list items.
3. Validate actual native rendering, page flow, input and transfer preservation.
4. Commit, push, required CI, normal PR merge and fresh merged checks.

## CHECKS
CHECK_1_PRE_IDENTITY: Bootstrap, secure mount, clean branch, owner authority and declaration preflight before repository edits.
CHECK_2_POST_LAYOUT: Native marker before text, nested/long/empty items, starts zero and seven, page gaps, 50/100 percent zoom; baseline CSS reproduces the failure.
CHECK_3_POST_REGRESSION: Existing sheet contracts and native input/undo/redo; complete Word list roundtrip and plain admission.
CHECK_4_POST_DELIVERY: Build, policy, ops, guardrails, certification, required CI, fresh exact merged verification.

## STOP_CONDITION
Foreign changes, widened state authority, text loss, marker overlap, required gate failure or ambiguous delivery identity.

## REPORT_FORMAT
One text block with task, exact SHA, basenames, proof, delivery, timings, limits and next step.

## FAIL_PROTOCOL
Keep failed artifacts; after three identical failures stop the loop and change hypothesis.

### References
- https://www.w3.org/TR/css-lists-3/#list-style-position-property
- docs/YALKEN_DESIGN_OS_CHANGE_GUIDE_V2_2.md
- docs/references/YALKEN_DESIGN_TOOL_MATRIX_V1.md
