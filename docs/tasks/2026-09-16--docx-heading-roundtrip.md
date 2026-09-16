# DOCX heading roundtrip

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: DOCX_HEADINGS_C1_20260916
BINDING_BASE_SHA: 9b4c1059a945a9c7ba914829ec85bd320b0bda29
AUTHORITY: Owner requested continued personal product development of import/export.

## MICRO_GOAL

Preserve existing heading levels 1 to 6 across DOCX export, native Word save/reopen, confirmed import and persisted/reopened scene. Detect changed heading levels independently. Whole STYLES and 1120-cell credit remain outside this bounded repair.

## ARTIFACT

Existing serializer, bounded paragraph/style projection and canonical doc-v2 content; focused contracts and native before/after artifacts.

## ALLOWLIST

- src/export/docx/docxMinBuilder.js
- src/io/revisionBridge/index.mjs
- src/utils/docxImportSafeCreate.js
- src/utils/docxImportLocalFilePreview.js
- src/main.js
- test/contracts/revision-bridge-docx-headings.contract.test.js
- docs/tasks/2026-09-16--docx-heading-roundtrip.md
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json

## DENYLIST

Renderer, UI composition, dependencies, workflows, old raw oracle, frozen denominator and historical evidence.

## CONTRACT / SHAPES

O: All six heading levels, body and empty blocks retain their kinds, levels, text and inline marks in native Word and persisted/reopened Yalken.
T: Canonical snapshot -> DOCX document/style parts -> validated ZIP/XML and style inheritance -> bounded headingLevel projection -> admitted immutable plan -> existing atomic scene writer -> independent raw readback.
H: Export drops levels 3 to 6; import creates only paragraphs. Emit explicit outline style definitions and resolve outline levels before rich serialization; retain this field through both existing report filters.
B: Existing commands, gates, plain serialization and inline marks remain. Heading semantics never infer scene hierarchy or mutation authority. One PR rollback.
P: Reproduced codec loss; real Word baseline/candidate/merged; focused direct/inherited/invalid/forged inputs; existing import/atomic checks, build, policy, inventory, CI and exact merged verification.
I: Binding base above; final candidate/build/profile, input hashes and elapsed seconds live in external receipts.

### FEATURE_INTEGRATION_MANIFEST_V1

FEATURE_ID: DOCX_HEADING_ROUNDTRIP_C1_V1
INTEGRATION_MODE: BOUNDED_EXISTING_IMPORT_EXPORT_REPAIR
PRODUCT_PLANE: Canonical heading nodes and immutable admitted import plan.
INTERFACE_PLANE: Existing heading schema and import preview; no new surface.
COMMANDS: Existing DOCX MIN export; cmd.project.docx.previewContent; cmd.project.docx.previewLocalFile; cmd.project.docx.previewImportPlan; cmd.project.docx.importSafeCreate.
QUERIES: Existing validated preview and canonical readback.
EVENTS: Existing durable import receipt.
EFFECTS: Existing bounded file reader, local Word proof and atomic project writer.
PORTS: Existing snapshot, artifact reader and admitted persistence ports.
PROJECTIONS: headingLevel integer 1 to 6 plus existing text/inline runs; artifact and candidate hashes remain required.
STATE_CLASSES: DERIVED_STATE preview; PROJECT_STATE through existing atomic transaction.
IDENTITY: Existing project/lifecycle, artifact digest, plan hash, operation nonce and source revision checks.
CAPABILITY: Existing Command Kernel and queued effect revalidation unchanged.
FALLBACK: Missing outline and explicit level 9 are body text. Word heading levels 7 to 9, invalid outline values and used style cycles fail closed. Unsupported fonts, numbering and paragraph appearance remain declared loss.
RECOVERY: Existing atomic rollback, durable idempotency and doc-v2 persistence.
PERFORMANCE: Existing styles/run/XML limits; inherited outline traversal bounded at 64; no typing-path changes; whole-cycle time recorded.
ACCESSIBILITY: Existing editor semantics and confirmation surface retained.
SURFACE_MANIFEST: EXISTING_SURFACE_UNCHANGED.
DESIGN_TOOL_ROUTER: DISABLED_FOR_NON_VISUAL_IMPORT_EXPORT_REPAIR.
CURRENT: Actual base codec loses all six heading levels on import; export labels only 1 and 2. Reproduction took 0.019744 seconds.
TARGET: Heading semantics only, without font/list/full manuscript or whole-field credit.

## IMPLEMENTATION_STEPS

1. Preserve a failing actual document and exact base.
2. Export all existing heading levels with actual Word style definitions.
3. Resolve direct/default/inherited outline properties and validate rich content through existing filters/admission.
4. Verify native Word and persisted/reopened scene with independent raw comparisons and mutations.
5. Deliver and recheck the exact merged tree.

## CHECKS

CHECK_1_PRE_IDENTITY: Bootstrap, secure storage, clean owner and agent roots, declaration.
CHECK_2_POST_NEGATIVE: Six levels; body reset; default and derived styles; empty headings; namespace spoof; bad integer/range; wrong style type; cyclic inheritance; forged projection.
CHECK_3_POST_CHAIN: Existing inline preservation, plain-byte regression, local preview, safe-create, stale references and rollback.
CHECK_4_POST_NATIVE: Actual Word lifecycle, editor and persisted/reopened heading/text/mark profiles; raw artifact mutation detection.
CHECK_5_POST_DELIVERY: Build, inventory, dependency policy, ops, guardrails, full CI and exact merged proof.

## STOP_CONDITION

Ambiguous identity, foreign edits, text/mark loss, ignored failed checks or authority bypass blocks delivery.

## REPORT_FORMAT

One text block: task, before/after/merged SHA, changed basenames, tests, delivery, evidence, limits and next step.

## FAIL_PROTOCOL

Retain expected/actual, exact source/profile/input hashes and elapsed seconds. After three identical failures stop the loop and change the hypothesis.

### Primary reference

Outline levels range from 0 to 9; 9 is body text, and omitted values inherit from paragraph styles: [Microsoft Open XML OutlineLevel](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.outlinelevel?view=openxml-3.0.1).
