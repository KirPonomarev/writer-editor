# Navigator counts visible scene words

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: NAV_COUNTS_C1_20260916
BINDING_BASE_SHA: d97340e691e12745eb199fc172904429977a4fbe
AUTHORITY: Owner accepted fixing the observed rich-scene count and then accelerating CI. This delivery contains the count repair only.

## MICRO_GOAL

The imported ten-word rich scene displays ten navigator words. Plain text, empty scenes, metadata exclusion and raw revision invalidation stay correct.

## ARTIFACT

Existing derived counter uses the existing canonical scene decoder; regressions and native export/import/reopen readback verify the visible count.

## ALLOWLIST

- src/derived/navigatorCounters.mjs
- test/unit/navigator-derived-counters.test.js
- docs/tasks/2026-09-16--docx-navigator-visible-word-count.md
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json

## DENYLIST

Renderer, main adapters, persistence, dependencies, workflows, frozen raw oracle and historical evidence.

## CONTRACT / SHAPES

O: Navigator leaf and ancestor counters reflect decoded scene text after native import and restart.
T: Main-owned bounded path reader -> existing envelope decoder -> derived counter -> existing pathless tree query projection -> renderer display.
H: Direct whitespace splitting counts serialized doc-v2 JSON. Reusing the existing decoder produces 10 instead of 138, with unchanged scene bytes.
B: DERIVED_STATE only; no project, authoring, shell or transient mutation. Raw scene hashes still drive invalidation. Revert this PR as one unit.
P: Exact original fixture, ordinary/rich/empty/metadata/boundary/malformed regressions, existing project-tree/pathless contracts, measured native readback, mandatory gates and merged verification.
I: Binding base above; final candidate and merged identities, raw artifact hashes and stage timings are external receipts.

### FEATURE_INTEGRATION_MANIFEST_V1

FEATURE_ID: NAVIGATOR_VISIBLE_SCENE_WORD_COUNT_V1
PRODUCT_PLANE: Existing canonical scene decoder and derived word semantics.
INTERFACE_PLANE: Existing pathless navigator projection; visual contract unchanged.
QUERIES: Existing project tree query.
COMMANDS_EVENTS_EFFECTS: No new command/event/effect; unchanged main-owned scene reader.
PORTS: Existing canonical file reader and pathless counter projection.
IDENTITY: Existing project/path/query guards; raw source hash retained.
CAPABILITY: NO_RUNTIME_MUTATION; existing query scope and publication guards retained.
FALLBACK: Plain scene semantics retained; invalid rich payload rejects successful derivation rather than inventing a count.
RECOVERY: Document bytes unchanged; malformed payload remains available to existing document recovery.
PERFORMANCE: Existing 1200-scene bound and full native timing.
ACCESSIBILITY: Existing counter display unchanged.
SURFACE_MANIFEST: EXISTING_SURFACE_UNCHANGED.
DESIGN_TOOL_ROUTER: DISABLED_FOR_NON_VISUAL_DERIVED_COUNTER_REPAIR.
CURRENT: Exact baseline counts 138 raw whitespace tokens for 10 canonical words.
TARGET: Correct derived count; no extra whole-STYLES or 1120-cell credit.

## IMPLEMENTATION_STEPS

1. Reproduce 138 versus 10 on the retained native artifact.
2. Decode before counting; retain raw hashes and pathless projection.
3. Verify malformed, empty, metadata and boundary cases plus native import/reopen.
4. Deliver and repeat on exact merged main.

## CHECKS

CHECK_1_PRE_IDENTITY: Bootstrap, unchanged canon reads, verified volume, exact base and preflight.
CHECK_2_POST_NEGATIVE: Focused counter/project-tree/import contracts, malformed and invalidation checks.
CHECK_3_POST_NATIVE: Correct counters in actual export/import/reopen surfaces with independent style/text readback.
CHECK_4_POST_DELIVERY: Inventory, ops, guardrails, RTK, certification, required CI and merged proof.

## STOP_CONDITION

Foreign changes, ambiguous identity, document mutation, fabricated zero counts or weakened evidence stop delivery.

## REPORT_FORMAT

One text block; task, SHAs, changed basenames, tests, full delivery, timings, limitations and next step.

## FAIL_PROTOCOL

Preserve expected/actual, hashes and exact HEAD. No synthetic success; stop repeating after three identical failures.
