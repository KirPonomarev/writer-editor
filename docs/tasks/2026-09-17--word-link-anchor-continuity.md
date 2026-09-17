# Preserve exact link and locator identity through Word

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: WORD_LINK_ANCHOR_CONTINUITY_20260917
BINDING_BASE_SHA: fa441bffb44b30aa00e85d6a5e0a528051633c0b
AUTHORITY: Standing owner instruction to personally complete all1120 import/export cells and optimize full-cycle speed; PR1942 and158-cell closure are complete.
DESIGN_TOOL_ROUTER: NOT_APPLICABLE; backend and executable proof only.

## MICRO_GOAL
Preserve exact safe hyperlink targets and authored ranges, declared per-round bookmarks and hash-bound locators through C2/C3 Word exchange. Missing or duplicated anchors must remain visible in manual preview, produce explicit diagnostics and block actual exact-text apply without canonical mutation. Execute all six frozen identifier subcases in the existing shared journeys.

## ARTIFACT
One bounded extension of the current Word recipe and independent product admission, with corrections to the existing export/return path only if observed necessary. Qualify the companion background Word driver and omit root test and documentation outside required docs/OPS/STATUS from disposable runtime copies while retaining full runtime-source equality and mandatory product tests.

## ALLOWLIST
- test/contracts/revision-bridge-docx-review-preview-session-command-surface.contract.test.js
- src/export/docx/docxReviewPacketBuilder.js
- src/export/docx/docxReviewPacketExportHandler.js
- src/export/docx/fullManuscriptDocxReviewPacketSource.js
- src/io/revisionBridge/index.mjs
- src/io/revisionBridge/reviewTransportPackageParserV2.mjs
- src/io/revisionBridge/reviewTransportMatchProofV1.mjs
- test/contracts/rtk-word-link-anchor-continuity.contract.test.js
- test/contracts/rtk-word-c5v2-full-manuscript-product-export.contract.test.js
- scripts/ops/rtk-interop-word-manuscript-fixtures.mjs
- scripts/ops/rtk-interop-word-manuscript-readback.py
- scripts/ops/rtk-interop-word-manuscript-batch.mjs
- scripts/ops/rtk-interop-data-c1.mjs
- test/contracts/rtk-interop-word-manuscript.contract.test.js
- test/unit/rtk-interop-word-manuscript.test.py
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/tasks/2026-09-17--word-link-anchor-continuity.md

## DENYLIST
- src/renderer
- package.json and package-lock.json
- Frozen1120 axes, historical evidence, unrelated WIP and owner documents
- Runtime network, new dependencies and new framework

## CONTRACT / SHAPES
FEATURE_INTEGRATION_MANIFEST_V1
- featureId: WORD_LINK_ANCHOR_CONTINUITY; featureVersion:1; integrationMode: EXISTING_SEAM.
- productPlane: Product Core owns saved rich text, links and identities; Command Kernel owns explicit export/preview/apply and revalidation.
- interfacePlane: Existing immutable document/review projections; no UI or Design OS changes.
- commandIds: Existing review.exportFullManuscriptDocxReviewPacket, review.activateDocxReviewPreviewSession and review.applyExactTextChangesBatch.
- queryIds: Existing document, tree and review projections; eventTypes: existing apply/export events only.
- effectIds: existing bounded DOCX I/O and atomic scene persistence through named main adapters.
- requiredProductPorts: Existing export/parser, source snapshot, atomic writer/recovery and native test adapters.
- requiredDesignOsPorts: Existing read-only document/review projections; no new port.
- readProjections: Revision-bound rich document, signed local locator map and returned read-only diagnostics.
- identityKeys: project, scene, block, source revision/generation, export/round id, local locator hash, relationship target and exact package/provider identities.
- revisionPolicy: Dispatch and publication recheck current capability and source identity. External names, relationship IDs and quotes never grant authority.
- writePath: Explicit canonical command -> validated main adapter -> atomic persistence/recovery -> fresh readback.
- readPath: Saved rich text -> export -> native Word -> untrusted bounded parser -> immutable review -> explicit apply.
- stateClasses: PROJECT_STATE owns text/links/identities; AUTHORING_WORKING_STATE has no-loss duty; observations and caches are DERIVED_STATE.
- persistenceClass: Existing project and round/capsule stores only; migrations: none.
- surfaceManifests: No new surface; supportedWorkspaces: existing WRITE and REVIEW.
- capabilityFallback: Missing, duplicate, unsafe or stale identities are typed failures before write; no heuristic reconstruction.
- recovery: Existing before-state recovery and byte verification remain mandatory.
- securityBoundary: Existing ZIP/XML/URI and relationship limits. Fixture links use inert example.test targets and are never opened. No runtime network or secrets.
- performanceBudget: Full case target300seconds; shared recipe remains sequential, with all raw readback and source-pin checks. Root tests and documentation are checked in product CI; disposable copies retain docs/OPS/STATUS because renderer build imports its configuration, and exclude the other root docs/test.
- accessibilityRequirements: Existing UI unchanged; native Word may run without stealing focus; screenshots bind only to the owned Word window.
- negativeBypassChecks: Missing/duplicate/swapped/renamed bookmark, dangling/duplicate/unsafe/changed link relation, wrong source locator hash, stale capability and runtime-copy content mismatch.
- lifecycle: Owned synthetic projects and disposable external files only; real Word save/close/reopen plus fresh product process are required.
- evidenceBindings: Exact source/merged SHA, tree, Lab source pins, provider identity, raw source/returned/reexport files, canonical before/after and independent corruption controls.
- currentReality:158cells closed. Links and declared bookmarks exist in product, but the current shared corpus omits links and does not admit complete IDENTIFIERS_ANCHORS cells.
- targetOnly:16additional C2/C3 identifier cells over four valid volumes and two profiles; Google/custom bookmark/hostile and broad parity claims remain outside this increment.
- rollback: Revert this bounded product PR and companion Lab commits together; retain all raw evidence and the closed158 snapshot.

O: Exact hyperlink target/range and declared locator identity survive repeated exchange; invalid identities cannot mutate project data.
T: Canonical rich scene -> local authenticated map -> export -> Word -> validated return -> explicit apply -> saved/reopened source -> reexport.
H: Real linked fixtures plus complete independent anchor/relationship checks expose any missing seam; adding the missing bounded validation or preservation fixes the observed mismatch.
B: Retain all158 predicates, original project data, trust boundaries and complete1120 denominator; no unrelated cleanup.
P: Independent ZIP/XML positives and corruption controls, real native source/package diagnostics, mandatory maintained/OPS/OSS/CI gates, protected merge and fresh merged cohort.
I: Exact base fa441bffb44b30aa00e85d6a5e0a528051633c0b, existing isolated writer/reader, verified encrypted T7, exact source/package/provider and raw hashes.

## IMPLEMENTATION_STEPS
1. Extend the existing corpus with real hyperlinks and independently specified identity expectations.
2. Add raw bijection, locator and relationship proofs and actual zero-mutation negative intake controls; correct any observed product defect.
3. Qualify companion native-driver/copy improvements and reject mismatched pins before execution.
4. Execute shared physical journeys, preserve all previous predicates, complete protected delivery and exact merged admission.

## CHECKS
CHECK_01_PRE_GATE: Bootstrap, ordered canon previously read and verified unchanged, storage identity, clean base and architecture preflight.
CHECK_02_POST_GATE: Focused identity/link/copy positives, boundary and adversarial negatives.
CHECK_03_POST_GATE: Maintained graph, historical compatibility, inventory/catalog, build, OSS/security and guardrails.
CHECK_04_POST_GATE: Real Word C2/C3, all six identifier predicates, full independent raw readback and actual zero-mutation controls.
CHECK_05_POST_GATE: Commit, push, required CI, normal PR merge and exact merged verification.

## STOP_CONDITION
Ambiguous authority, foreign changes, silent loss, weakened proof or third identical failure. Preserve failure artifacts and award zero credit.

## REPORT_FORMAT
AGENT_FINAL_REPORT_V1 with exact identities, numerator/1120, measured complete cycle, mandatory delivery and residual limits.

## FAIL_PROTOCOL
Fix one observed cause inside scope. No self-PASS, cross-head inheritance or fabricated native provider proof.


## OBSERVED CORRECTION
The native missing-bookmark control exposed exact-match promotion through paragraph index in the manual review candidate path. Exact matches now require a complete unique declared bookmark set and agreement with the existing strict block resolver; lost, duplicated or conflicting identities stay manual. Real negative controls invoke the canonical batch-apply command and require its typed exact-match rejection plus unchanged scene, manifest and comment state.

SCOPE_EXTENSION: Correct one existing current-profile positive fixture to carry the actual declared bookmark. It previously certified exact matching from a signed carrier and paragraph position despite omitting the locator. Its exact-lane assertion remains; new independent negative controls prove missing and duplicate anchors cannot apply. This is the same authority defect and delivery chain.
