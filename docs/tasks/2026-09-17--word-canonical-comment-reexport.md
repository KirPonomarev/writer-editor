# Preserve canonical comments in repeated Word exchange

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: WORD_CANONICAL_COMMENT_REEXPORT_20260917
BINDING_BASE_SHA: 7d89d7448ab57719ecf34af5ec425281ac16c09d
AUTHORITY: Direct standing owner instruction to personally implement and prove all 1120 import/export cells, including explicit resume after reboot. Previous contour closed through PR1941.
DESIGN_TOOL_ROUTER: Backend-only; no change to a product design contract.

## MICRO_GOAL
Preserve canonical comments, replies, open/resolved state, literal author/time and exact anchors in full-manuscript DOCX reexport. Retain intentional deletion as a tombstone and report missing returned comments. Repeated exchange must not create duplicate canonical threads.

## ARTIFACT
One bounded extension of the existing comment state, DOCX builder and authenticated return paths, with actual Word journeys and independent raw readback. The fixed 1120 denominator and previous 142 predicates remain intact.

## ALLOWLIST
- src/main.js
- src/export/docx/docxReviewPacketBuilder.js
- src/export/docx/docxReviewPacketExportHandler.js
- src/export/docx/docxReviewPacketComments.js
- src/export/docx/fullManuscriptDocxReviewPacketSource.js
- src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs
- src/io/revisionBridge/reviewTransportPackageParserV2.mjs
- test/contracts/rtk-word-canonical-comment-reexport.contract.test.js
- test/contracts/rtk-word-c5v2-root-comment-return-runtime.contract.test.js
- test/contracts/rtk-word-c5v2-comment-lifecycle-return-runtime.contract.test.js
- test/contracts/rtk-word-latest-semantic-b03-modern-comments.contract.test.js
- test/contracts/rtk-c4-canonical-comment-product-query.contract.test.js
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
- docs/tasks/2026-09-17--word-canonical-comment-reexport.md

## DENYLIST
- src/renderer
- package.json
- package-lock.json
- Owner documents, projects, unrelated WIP and historical evidence
- Frozen matrix axes, archived validators, runtime network and new dependencies

## CONTRACT / SHAPES
FEATURE_INTEGRATION_MANIFEST_V1
- featureId: WORD_CANONICAL_COMMENT_REEXPORT; featureVersion: 1; integrationMode: EXISTING_SEAM.
- domainOwner: Product Core; authoritativeData: saved scene bytes and canonical non-text return state.
- derivedData: immutable comment export map and returned diagnostics; never source of mutation authority.
- commandIds: existing review.exportFullManuscriptDocxReviewPacket, review.activateDocxReviewPreviewSession, rtk.review.applyRootCommentReturn and rtk.review.applyCommentLifecycleReturn.
- eventTypes: existing non-text root/reply/lifecycle events; no new bus.
- queryIds: existing non-text state and review projection queries.
- productProjectionIds: canonical comment state projection and current Review surface.
- capabilityIds: existing local DOCX export and explicit review return apply.
- authorityMap: main loads canonical state; external comments remain untrusted until signed round and exact block mapping; explicit commands own writes.
- identityKeys: project, scene, block, source revision, comment state digest/revision, local export map, round, thread and message identities.
- revisionPolicy: recheck project/lifecycle/source/comment state before async publication; reject stale snapshots.
- writePath: canonical command -> main adapter -> validated snapshot/operation -> atomic writer/recovery -> readback.
- readPath: canonical scenes/comments -> bounded immutable projection -> DOCX or existing review surface.
- requiredProductPorts: existing canonical non-text file port, review parser, export writer, disk queue, recovery and native test adapter.
- requiredDesignOsPorts: existing read-only review/document projections; no new port.
- adapterRequirements: existing Electron filesystem/Word test-only adapters; no product dependency on Word.
- surfaceManifests: no new surface; slotRequirements: no new slot; supportedWorkspaces: existing WRITE and REVIEW.
- platformAvailability: only actual executed local source and packaged profiles; other platforms remain unclaimed.
- accessibilityRequirements: existing accessible surfaces/keyboard/locale unchanged; metadata values remain literal.
- fallbacks: invalid/stale/ambiguous anchors or graph produce typed failure; missing metadata remains unknown; missing returned comments are ledgered.
- stateClasses: PROJECT_STATE owns comments/scenes; AUTHORING_WORKING_STATE retains no-loss duty; export/proof is DERIVED_STATE; shell/transient state confer no authority.
- persistenceClass: existing atomic non-text v1 state, optional metadata only; no second ledger.
- migrations: additive optional provenance; legacy state and metadata-free operation replay remain readable and deterministic.
- recovery: preserve existing before-state recovery, atomic write and reverse verification.
- rollback: revert this bounded PR and companion Lab changes; keep immutable evidence.
- performanceBudget: measure every stage; target full cycle under 300 seconds without weakening any required oracle.
- securityBoundary: existing untrusted ZIP/XML limits, literal bounded scalars, escaped XML; no secret or path supplied by comments.
- lifecycle: serialize owned native Word work; no foreign document mutation; close and fresh reopen required.
- negativeBypassChecks: wrong project, stale state, duplicate IDs, malformed parent graph, spoofed namespace, altered author/time, missing body/reply/state, wrong/ambiguous anchor, invalid UTF16 boundary, repeated return and publication race.
- evidenceBindings: source/merged SHA and tree, exact Word build/profile, raw DOCX, native readback, canonical state before/after, independent reader, protected delivery.
- currentReality: base has 142 closed cells; comments are omitted by the repeat export and provenance is stripped on canonical apply. Those gaps are targets until tested.

O: Saved comments appear on the correct Word range with their messages, authors, dates and thread state, and survive a second exchange without duplication.
T: Canonical state -> main-owned snapshot -> double parse -> queued atomic export -> native Word -> authenticated parser -> explicit command -> recovery/readback -> reexport.
H: Adding comments to the existing builder and binding their canonical identity to the local authenticated export map closes the observed omission; native/independent readers must detect any lost body, reply, status or anchor.
B: Preserve original text/formatting and all prior predicates; no UI changes, heuristic apply, synthetic provider evidence, silent omissions or fabricated authors.
P: Focused positive/negative contracts first, then native Word and independent raw proof; required maintained/OPS/OSS/build/CI gates; protected PR merge and exact merged reproof.
I: Base 7d89d7448ab57719ecf34af5ec425281ac16c09d, isolated clean worktree, verified encrypted T7, actual source/package and Word identities, all raw hashes.

## IMPLEMENTATION_STEPS
1. Carry bounded literal metadata through canonical root/reply state without changing metadata-free replay.
2. Serialize exact anchors and threaded comment parts from the canonical snapshot; include a signed baseline and deletion accounting.
3. Compare returned known identities to that baseline; reject stale/lost/ambiguous cases and prevent repeat duplication.
4. Extend the current concrete native recipe and independent raw reader, execute source/packaged journeys and complete delivery.

## CHECKS
CHECK_01_PRE_GATE: Verified registry/mount, clean exact base, full ordered startup reads and architecture preflight before any edit.
CHECK_02_POST_GATE: Focused compatibility, replay, XML graph, boundary, namespace and stale-publication negatives.
CHECK_03_POST_GATE: Required maintained tests, inventory/governance, build, OSS/security and guardrails.
CHECK_04_POST_GATE: Actual native Word, canonical save/fresh reopen/reexport, all six mandatory comment predicates and independent corruption controls.
CHECK_05_POST_GATE: Commit, push, protected PR, required CI, merge and exact merged verification.

## STOP_CONDITION
Ambiguous identity, foreign state, weakened oracle, data loss or three repeated identical failures. Preserve raw failing evidence and award zero credit.

## REPORT_FORMAT
AGENT_FINAL_REPORT_V1 with exact identities, tests, numerator/1120, complete seconds, delivery and residual limits.

## FAIL_PROTOCOL
Keep actual failures and stop the affected case. Correct one cause within scope or report the concrete blocker. No self-PASS or evidence inheritance.

Reference discovery used brain:refs; no third-party code or dependency copied. Serialization follows Microsoft MS-DOCX CT_CommentEx and CT_CommentExtensible and the commentReference matching rule. Source/spec findings are recorded outside the repository in the previous closed contour's next-comment-seam-notes.json.
