# Delivery closure — Atlas Time range authoring

STATUS: TERMINAL_DELIVERY_PASS_BOUNDED_SCOPE

M22 PR2214 closed at exact merged 12d719ce735cfdd15c2c2d853edb7a70ab727545; candidate 551e635f69dbc4cc7c15c2a9517899e7c4a079c7, tested tree 2202994225543eae98bd9713920756ba8c6d5423. Candidate/main required CI 20/20 each, merged local27 56034ed0721dd1ac1eafb92ac0739c85b29b4a7b32e93f089423d164f7886826, separate rebuilt own58 AUTHOR 9 and COLD with all six physical files literal, two real exits0; independent native 5e1c1cb2359162ec0c7b94e08d84007f7ff4bd1357671d057a99a6b3c37be552. Merged CI cae69030780fa90c760bd09caa067da536183c48a04906e7545019300b6eb3f3, guardrails a3e4d1baefba643c00a2fd9f39506dfec671ee01505ab75a6a4dc8a128c5916a. Final19 report ATLAS_TEMPORAL_RANGE_AUTHORING_FINAL_REPORT_01.json SHA2cc2328332837190014d60637f70afbf9a5338b4a77e2e4351883d4516dd6298. This is bounded Atlas Time authoring; full Mac NOT_READY, all17 UNKNOWN.

Original pre-delivery task is preserved below. Its pending status and native ordinal targets are historical, and actual exact proofs are in the final report.

# Atlas Time — явные авторские границы

TASK_ID: YALKEN_ATLAS_TEMPORAL_RANGE_AUTHORING_MAC_20261108
TYPE: UI
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
BINDING_BASE_SHA: 08c4d7811a6d00e073a085f2d918eb345ba486ce
HEAD_SHA_AT_START: 08c4d7811a6d00e073a085f2d918eb345ba486ce
TARGET_BRANCH: main
PUSH_BRANCH: codex/atlas-temporal-range-authoring-20261108
STATUS: FOCUSED_SOURCE_VERIFIED_REQUIRED_PROOFS_PENDING
DOCUMENT_CLASS: PROCESS
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_HEAD_REQUIRED=true
OWNER_AUTHORITY: Standing direct-owner full V6 and DNA5 Mac development, sole executor, one delivery chain; no historical lease or stage resumed.

## MICRO_GOAL

Let an author explicitly enter an existing exact interval, approximate bounds, an open beginning or end, or an unknown range in Time. Preserve untouched dimensions, calendar identity, author text, source guards and the existing simple date/day path.

## ARTIFACT

One scene-bound extension of the existing Author controls and serializer to the unchanged atlas.sceneTemporalAnchor.set command. On exact base08c4 the read-only production-handler discriminator809a605a6817fe0b916c7c2ca501cbeb1540a2127da9bcd7d0aa000708570d62 proves three gaps: approximate and both open directions are accepted by the unchanged Core but the current form produces a single exact point or refuses an empty start. It exposes no range-kind or end-bound control. This is source diagnosis, not native acceptance.

## ALLOWLIST

- docs/tasks/2026-11-08--atlas-temporal-range-authoring.md
- docs/tasks/2026-11-08--atlas-temporal-coordinate.md
- docs/CONTEXT.md
- docs/HANDOFF.md
- src/renderer/editor.js
- src/renderer/editor.bundle.js
- test/unit/atlas-temporal-author-input.test.js
- test/contracts/yalken-atlas-v5-e06-c06-atlas-temporal-layout-time-slider-surface.contract.test.js
- scripts/ops/sector-m-scope-map.json
- docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/RCV01A_NORMATIVE_CLAIM_TEST_LANE_MANIFEST_V1.json
- docs/OPS/R24/EVIDENCE/ES-R24-RCV01A-NORMATIVE-CLAIM-TEST-LANE-MANIFEST-CLAIM-BINDINGS.json
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/interop-current-certification-deltas.mjs

## DENYLIST

Every other path. Core, Main, preload, command meaning/IDs, query semantics, derived Time coordinates, project format, persistence, history, capabilities, dependencies, HTML/CSS, fonts, tokens, workflows and frozen historical carriers remain read-only. No calendar conversion, guessed bounds, automatic range sorting, hidden zero, network runtime, new service/registry, subagent or second delivery chain. No project/app deletion. Signing/notary/public distribution and real private inputs are not admitted. Word/nativeOffice remains paused; Black Box follows full Mac.

## CONTRACT / SHAPES

FEATURE_INTEGRATION_MANIFEST_V1: EXISTING_SEAM, featureId yalken.atlasAndManualMap.v5, existing manifest and temporal contribution in atlasFeatureIntegrationManifest.mjs. Product Core owns atlas.sceneTemporalAnchor.v1, calendar definitions, rangeKind/pointKind, precision, scene identity and history. Canonical Commands atlas.sceneTemporalAnchor.set and atlas.calendar.define, existing Events and unchanged query.atlasTemporalLayout/sceneTemporalAnchors projections remain authoritative. Explicit fields serialize validated intent through makeAtlasSurfaceCommandButton, runAtlasSurfaceProductCommand, dispatchUiCommand and unchanged Kernel/Main product persistence port and atomic adapter. Kernel/Main revalidate capability, project/session/lifecycle/source revision/generation and current anchor before publication. The UI cannot invent domain truth, bypass a command or persist directly.

SURFACE_MANIFEST_V1: existing surface.atlas.temporalLayout, slot rightRail.context.atlas.temporalLayout, rightRail host and existing WRITE context/platform policy. Reuse native labeled select/input/details, current classes and tokens. Optional end/precision/type controls live in a collapsed range-details disclosure within Author controls; existing simple date/day fields and command buttons remain. PROJECT_STATE belongs to Core; the scene-owned draft is authoring working state with no-loss duty; view, focus and disclosure are transient/shell state; immutable queried layout is derived. No new surface, runtime registry, listener service or storage writer. Tab/focus/paste/AX semantics and native slider/list/marker behavior remain required.

An exact range has both typed bounds, repeating its start only when the author uses the existing single-point path. Approximate and open ranges require the author's precision/reason; open has exactly one side. Explicit unknown requires an author reason and no supplied bound. A blank untouched dimension retains the existing Main preservation marker. Empty or malformed submitted input refuses without clearing the draft or mutating canonical data. Narrative whole days preserve zero and signs and reject unsafe, fractional or malformed values. Story dates retain the explicitly selected calendar. Core remains the final validation authority; no calendar arithmetic or range reordering is introduced. Migrations: existing schema unchanged; no migration is introduced. Recovery and rollback use the existing atomic product route and a normal bounded revert with all prior histories retained.

DESIGN_TOOL_ROUTER: APPLICABLE_EVIDENCE_REQUIRED
DESIGN_VISUAL_QUESTION: Can the existing compact Time form expose explicit range kinds and optional bounds while keeping its simple date/day path and reading controls quiet?
DESIGN_SOURCE_OF_TRUTH: Current native own54 Time surface and actual production helpers, approved Yalken tokens and existing temporal manifest.
DESIGN_RESEARCH_SOURCES: M21 FIRST/COLD native4bc9cd209723d3e40d60226e2016543892639c557c07a4ca0715b34196204152; production handler discriminator809a605a; YALKEN_DESIGN_OS_CHANGE_GUIDE_V2_2.md; YALKEN_DESIGN_TOOL_MATRIX_V1.md; ui-craft forms/accessibility guidance; existing native-fluency reference.
DESIGN_SELECTED_DIRECTION: Existing simple inputs plus optional native range details. No visual system change or external dependency.
DESIGN_AUDIT_TOOLS: Source and maintained negative tests first; actual candidate/merged native AX, keyboard and screenshots required before acceptance.
DESIGN_TOOL_DEVIATIONS: Local approved evidence is sufficient. No optional service, independent design lab, new brief/token registry, palette/CSS tool or second agent is required.

## IMPLEMENTATION_STEPS

1. After the admitted clean preflight, create this task and run E0 before tests/runtime edits. Preserve and freeze prospective expanded tests; run them against the unchanged handler and retain genuine RED. Original seven author cases and all39 C06 cases stay intact; only fixture dependencies required by the actual controls may be added.
2. Extend the existing scene-owned form and serializer for explicit supported ranges. Keep capability/currentness, untouched-field preservation and Core semantics unchanged. Rebuild the maintained renderer. Enroll exactly this task in the existing Sector M DONE allowlist before the broad baseline; unknown/neighbor paths stay denied.
3. Prove all new normal/boundary/stale/no-loss cases and original affected chains. Refresh only necessary current digests/memberships and append-only witnesses through the unchanged existing factory. Update existing factual summaries and M21 task with actual merged closure, retaining all previous historical bytes and failures. No separate reporting or infrastructure contour.
4. Freeze one candidate, run all mandatory original gates and actual rebuilt native AUTHOR/cold in a fresh own profile before push. Independently read persisted ranges, full manuscripts, history, ASAR/bundle and protected profiles. Complete normal PR, required CI, merge and exact merged software/build/native/CI/guardrails verification. Never equate this bounded delivery with full Mac release.

## CHECKS

CHECK_01_PRE_WRITE: all10106 source bytes/modes verified, registered clean worktree/base08c4/tree de78487dd4755b9c056d3b965e5d9f74520f7f00, fresh remote27c81df0, sole writer, verified storage, full normative startup and scoped temporal factual reads. Architecture declaration04 ea1b34dca3b407ce5d19f5d1ec6d161604bf69add85232ae49c4132f69333353, preflight02 932ceff0ac6677d24b03f742268165350a4692deb3d1b8cc9ea85cad8768dee2 and source admissionab791b03bb9383e2d6594a06e65ee429771f222f762f3d3edf9ba40756df5c68 precede edits. CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.

CHECK_02_POST_TASK: E0 before test or product implementation.

CHECK_03_POST_SOURCE: genuine original-handler RED, same frozen expanded GREEN and all original cases/assertions, no-loss/source/zero/open/approximate/unknown/incomplete/stale counterexamples, bundle build, exact task-scope allowlist and unknown-path negatives, original current-binding validation.

CHECK_04_POST_NATIVE: independently admitted actual rebuilt candidate and merged apps; fresh own55 then own56, protect all54 prior profiles26bundles before new native work. AUTHOR and same-profile cold, current source/build/profile identities, explicit ranges and refusals, physical manuscript/range/history oracle and real ordinary exits.

CHECK_05_POST_DELIVERY: original affected/baseline/RTK/E0 safety/Electron/audit/OSS gates; full hosted candidate and main required checks; clean scope, normal commit/push/PR/merge; exact merged proof and schema-valid final report. Reports/materials only verified T777. Explicit finite APFS checks runtime yalken-atlas-temporal-range-authoring-checks-20261108; native runtime separately admitted. No cleanup of prior data.

## STOP_CONDITION

Refuse dependent mutations on ambiguous identity/scope, failed preflight, stale native admission, foreign dirty work, missing required proof, direct product-write bypass or unavailable required storage. Preserve raw errors and continue independent authorized work. Stop the same failure loop on its third signature with exact identities and one next hypothesis.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1 and CODEX_OUTPUT_POLICY: task, before/after/merged SHA, changed basenames, actual numerator/denominator and preserved skips/todo, commit/push/PR/CI/merge, exact native and source readback, limitations, rollback and one next action. All17 full-Mac qualification rows remain UNKNOWN until independently qualified on the final admitted artifact.

## FAIL_PROTOCOL

Preserve original expected/actual, seed, source/build/profile identity, commands, raw output, hashes and failure history. No checker weakening, fabricated success, changed assertions to match implementation, stale retagging or repeated expensive wave without changed conditions. Initial declaration-shape refusal remains preserved before accepted04; no source edit preceded admission.
