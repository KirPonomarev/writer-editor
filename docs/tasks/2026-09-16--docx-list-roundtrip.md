# DOCX list roundtrip

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: DOCX_LISTS_C1_20260916
BINDING_BASE_SHA: caa895ad1aef8ab85421c933a5c7c5a62442c9d3
AUTHORITY: Direct owner continuation of personal autonomous import/export implementation.

## MICRO_GOAL

Preserve existing bullet and decimal ordered lists, item text/marks, start numbers, adjacent boundaries and nesting through DOCX, native Word save/reopen and confirmed Yalken import. One bounded product repair; no full STYLES or 1120-cell credit.

## ARTIFACT

Existing serializer and bounded content preview, rich doc-v2 plan, focused contracts and external native/raw evidence.

## ALLOWLIST

- src/export/docx/docxMinBuilder.js
- src/io/revisionBridge/index.mjs
- src/utils/docxImportSafeCreate.js
- src/utils/docxImportLocalFilePreview.js
- src/main.js
- test/contracts/revision-bridge-docx-lists.contract.test.js
- docs/tasks/2026-09-16--docx-list-roundtrip.md
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json

- test/contracts/revision-bridge-docx-content-preview.contract.test.js

## DENYLIST

Renderer, UI composition, dependencies, workflows, frozen raw oracle and denominator, historical evidence, unrelated owner state.

## CONTRACT / SHAPES

O: Lists retain kind, start, item boundaries, nesting, text and marks after Word and reopened canonical import.
T: Canonical doc-v2 -> DOCX numbering definition and paragraph reference -> validated numbering catalog -> bounded list projection -> immutable admitted plan -> existing atomic scene writer -> independent OOXML, scene and HTML readback.
H: Current export collapses list children and import only emits numbering loss. Bind each existing list to Word numbering and reconstruct the hierarchy before rich serialization.
B: No new editor schema or commands; protected plain/heading/inline serialization and original source remain; one PR rollback.
P: Failing codec and native baseline; positive/negative definitions, direct/inherited references, item shape/depth, main/local equivalence, raw mutations, current import/admission/rollback chain, baseline gates, CI and exact merged proof.
I: Base above; candidate/merged SHA, source/profile/artifact hashes and whole-cycle seconds in external receipts.

### FEATURE_INTEGRATION_MANIFEST_V1

FEATURE_ID: DOCX_LIST_ROUNDTRIP_C1_V1
INTEGRATION_MODE: EXISTING_SEAM
PRODUCT_PLANE: Canonical existing list nodes and immutable confirmed import plan.
INTERFACE_PLANE: Existing editor list schema and import preview; no new surface.
COMMANDS: Existing DOCX MIN export; cmd.project.docx.previewContent; cmd.project.docx.previewLocalFile; cmd.project.docx.previewImportPlan; cmd.project.docx.importSafeCreate.
QUERIES: Existing validated artifact preview and canonical readback.
EVENTS: Existing durable import receipt.
EFFECTS: Bounded local reader, synthetic native Word proof, admitted atomic scene writer.
PORTS: Existing canonical snapshot, artifact reader and persistence ports.
PROJECTIONS: Validated per-paragraph list numId, level, kind and ordinal; existing artifact/plan hashes.
STATE_CLASSES: DERIVED_STATE preview; PROJECT_STATE only through existing atomic transaction.
IDENTITY: Existing project/lifecycle/source revision/artifact digest/plan hash/nonce checks.
CAPABILITY: Existing Command Kernel and queued effect revalidation retained.
FALLBACK: Unsupported numbering remains declared list loss before user confirmation. Malformed definitions and ambiguous/invalid rich topology block. Multiple source paragraphs per item are blocked if not losslessly representable.
RECOVERY: Existing atomic rollback, durable idempotency and doc-v2 persistence.
PERFORMANCE: Numbering <=1 MiB, <=2048 definitions/instances, <=9 levels; no typing-path work. Measure development and native cycles separately.
ACCESSIBILITY: Existing semantic ol/ul/li editor output and confirmation surface.
SURFACE_MANIFEST: EXISTING_SURFACE_UNCHANGED.
DESIGN_TOOL_ROUTER: DISABLED_FOR_NON_VISUAL_IMPORT_EXPORT_REPAIR.
CURRENT: Codec reproducer: 6 source lists, 0 returned, plan accepted, 0.026192209 seconds.
TARGET: Bounded list semantics without whole-field, other-provider or packaged-runtime credit.

## IMPLEMENTATION_STEPS

1. Retain failing input and exact base evidence.
2. Serialize supported list nodes into explicit bounded OOXML numbering.
3. Resolve numbering and construct validated existing rich list nodes through both filters and current admission.
4. Verify actual Word, persisted/reopened scene and editor HTML; detect changed raw artifacts.
5. Commit, push, required CI, normal PR merge, exact merged validation.

## CHECKS

CHECK_1_PRE_IDENTITY: Bootstrap, secure mount/registry, clean writer, declaration before edits.
CHECK_2_POST_NEGATIVE: Bad/duplicate/missing IDs, format, levels, style chain, foreign namespace, historical properties, forged projection, orphan nesting, unsupported source item shape.
CHECK_3_POST_CHAIN: Supported nested and adjacent lists, 0/7 starts, empty items, Unicode/marks/headings, plain-byte stability, safe-create/stale/rollback, main/local filters.
CHECK_4_POST_NATIVE: Real Word and editor/disk reopening; independent raw list/text/heading/mark comparisons and mutations.
CHECK_5_POST_DELIVERY: Build, inventory, policy, ops, guardrails, certification and required CI; exact merged checks.

## STOP_CONDITION

Foreign edits, ambiguous authority, text/list loss, ignored required tests or bypass block delivery.

## REPORT_FORMAT

One text block: task, before/after/merged SHA, basenames, tests, delivery, measured evidence, limits and next step.

## FAIL_PROTOCOL

Retain expected/actual and exact identities; after three identical failures stop the loop and change hypothesis.

### References

Existing repository reference lookup was performed; no external project code or dependency is copied. Numbering semantics follow Microsoft Open XML [NumberingProperties](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.numberingproperties?view=openxml-3.0.1), [StartOverrideNumberingValue](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.startoverridenumberingvalue?view=openxml-3.0.1) and [LevelRestart](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.levelrestart?view=openxml-3.0.1).
