# C1 inline style preservation

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: STYLES_C1_PRESERVATION_20260916
BINDING_BASE_SHA: 573155e49fb540fbcd6c7c306f79b318ddcdcc57
AUTHORITY: Owner requested personal implementation and accepted continuing with STYLES on C1.

## MICRO_GOAL

Preserve bold, italic, underline and strike from the existing editor schema through DOCX MIN, native Word save/reopen, confirmed import and persisted/reopened rich scene. This is a bounded first slice of STYLES, with zero whole-cell credit.

## ARTIFACT

Existing DOCX serializer, bounded import projection and canonical doc-v2 content; regression tests and independently checked native artifacts.

## ALLOWLIST

- src/export/docx/docxMinBuilder.js
- src/io/revisionBridge/index.mjs
- src/utils/docxImportSafeCreate.js
- src/utils/docxImportLocalFilePreview.js
- test/contracts/revision-bridge-docx-inline-styles.contract.test.js
- docs/tasks/2026-09-16--docx-inline-styles-c1.md
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/post-audit-certification-set.mjs
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- test/contracts/rtk-interop-100-denominator.contract.test.js
- docs/ARCH_DIFF_LOG.md

## DENYLIST

Renderer, main adapter, IPC limits, dependencies, old raw oracle and historic evidence.

## CONTRACT / SHAPES

O: The same marked synthetic text survives export, Word and canonical import with exact per-character marks and unchanged paragraph/text boundaries.
T: Canonical editor snapshot -> DOCX serialization -> bounded ZIP/XML reader -> validated mark projection -> admitted immutable plan -> existing atomic scene writer -> independent persisted readback.
H: Export loses run boundaries and import emits only plain text. Retaining bounded mark runs and using the existing doc-v2 envelope repairs both losses without a new storage layer.
B: No new commands, UI, runtime dependencies, network, mutation authority or 1120-cell claim. Existing plain-text compatibility, plan hashes, stale guards, atomicity and recovery stay required. Revert this PR as one unit.
P: Frozen marked/plain precheck; targeted malformed/namespace/cascade/mark-boundary tests; existing import/atomic contracts; native Word and reopened scene; independent negative controls; inventory, guardrails, CI and merged-head verification.
I: Exact binding base above; final candidate, merged SHA, input/artifact hashes and elapsed seconds are recorded in the external task receipt.

### FEATURE_INTEGRATION_MANIFEST_V1

FEATURE_ID: DOCX_INLINE_STYLES_C1_V1
INTEGRATION_MODE: BOUNDED_EXISTING_IMPORT_EXPORT_REPAIR
PRODUCT_PLANE: Canonical document marks; validated immutable import plan and existing atomic persistence.
INTERFACE_PLANE: Existing editor schema and preview/confirmation; no new surface.
COMMANDS: Existing DOCX MIN export; cmd.project.docx.previewContent; cmd.project.docx.previewLocalFile; cmd.project.docx.previewImportPlan; cmd.project.docx.importSafeCreate.
QUERIES: Existing preview projection only.
EVENTS: Existing durable import receipt only.
EFFECTS: Existing bounded file reader, local Word diagnostic and atomic project writer.
PORTS: Existing canonical export snapshot and project persistence ports; no new writer.
PROJECTIONS: Paragraph text and allowlisted marks, bound to text and artifact hashes. Formatting carries no path, command or review authority.
STATE_CLASSES: DERIVED_STATE preview; PROJECT_STATE only via admitted create transaction.
IDENTITY: Existing project/lifecycle reference guard, artifact digest, plan hash and operation nonce.
CAPABILITY: Existing Command Kernel and queued effect revalidation remain unchanged.
FALLBACK: Explicit loss for unsupported formatting; malformed or over-budget style data blocks. Unmarked content retains the established plain-text path.
RECOVERY: Existing atomic rollback and durable idempotency; imported rich content uses the established doc-v2 envelope.
PERFORMANCE: Bounded styles, runs and cascade depth; no work on typing path; measure the entire native/checking cycle.
ACCESSIBILITY: Existing editor and confirmation unchanged.
SURFACE_MANIFEST: EXISTING_SURFACE_UNCHANGED.
DESIGN_TOOL_ROUTER: DISABLED_FOR_NON_VISUAL_IMPORT_EXPORT_REPAIR.
CURRENT: Baseline export loses 28 bold/italic positions; plain control passes; precheck took 0.196579 seconds.
TARGET: Four inline marks only. Paragraph/list styles, fonts, colors, full STYLES, other routes and packaged profiles require separate proof.

## IMPLEMENTATION_STEPS

1. Preserve the failing fixture and exact base.
2. Retain run marks during export and resolve bounded Word style inheritance on import.
3. Validate the text/mark projection and serialize through existing canonical rich scene format.
4. Check physical Word and persisted/reopened readback with an independent oracle and negative mutations.
5. Deliver the bounded change and repeat relevant proof on exact merged HEAD.

## CHECKS

CHECK_1_PRE_IDENTITY: Bootstrap, mounted encrypted writable canonical storage and preflight.
CHECK_2_POST_NEGATIVE: Split runs, style leaks, explicit off, style toggles, aliases/spoofing, malformed XML, style cycles/bounds and forged projection.
CHECK_3_POST_CHAIN: Existing parser, local preview, admission, stale reference, atomicity and idempotency contracts.
CHECK_4_POST_NATIVE: Actual Word save/reopen, renderer-confirmed import, persisted/reopened scene and independent per-character comparison.
CHECK_5_POST_DELIVERY: Inventory, guardrails, required CI, commit/push/PR/merge and exact merged verification.

## STOP_CONDITION

Ambiguous identity, foreign changes, lost text, weakened oracle or bypassed authority stops delivery.

## REPORT_FORMAT

One text block: task, before/after/merged SHA, changed basenames, tests, delivery, evidence, limits and next step.

## FAIL_PROTOCOL

Retain expected/actual, input hashes, exact SHA and timing. After three identical failures change the hypothesis; no synthetic success or unsupported whole-cell credit.

### Primary reference

Word run properties apply after styles: [Microsoft Open XML RunProperties](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.runproperties?view=openxml-3.0.1). Bold/italic/strike are toggle properties in style inheritance; direct formatting sets the value: [Microsoft Open XML Bold](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.bold?view=openxml-3.0.1).
