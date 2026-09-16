# Complete Word text and order journeys

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: WORD_TEXT_ORDER_C1_C2_BATCH_20260917
BINDING_BASE_SHA: cd20513262277f292d7ff446dadd6eb97a2ae618
AUTHORITY: Direct owner continuation of import/export implementation and one bounded Luna high checker draft. Root owns integration and native effects.

## MICRO_GOAL
Complete the canonical C2 reexport and final native Word readback; independently verify TEXT and ORDER for C1 and C2 in source and packaged application profiles. Four actual journeys may yield eight distinct cells. Partial routes, repeats and different builds grant no additional credit.

## ARTIFACT
Correct visible structured-scene reexport, complete native C2 driver and independent read-only batch admission with raw semantic evidence.

## ALLOWLIST
- scripts/ops/rtk-interop-word-text-order-batch.mjs
- scripts/ops/rtk-interop-word-text-order-readback.py
- scripts/ops/rtk-interop-c2-final-hops.py
- test/contracts/rtk-interop-word-text-order-batch.contract.test.js
- test/unit/rtk-interop-c2-final-hops.test.py
- docs/tasks/2026-09-17--interop-word-text-order-batch.md
- scripts/ops/rtk-interop-100-denominator-v1.mjs
- test/contracts/rtk-interop-100-denominator.contract.test.js
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- src/main.js
- src/export/docx/fullManuscriptDocxReviewPacketSource.js
- test/contracts/rtk-word-c2-rich-scene-reexport.contract.test.js

## DENYLIST
Renderer UI, new Core writers, new authority routes, dependencies, runtime network, frozen denominator and historical raw readers; other agents' work and private manuscripts.

## CONTRACT / SHAPES
FEATURE_INTEGRATION_MANIFEST_V1
- featureId/version: WORD_TEXT_ORDER_C1_C2_BATCH / 1.
- product plane: existing document envelope, review export source, format-IR
  paragraph projection, command validation and atomic export publication.
- interface plane: existing commands and a read-only OPS proof query; no UI change.
- Commands: existing review export, return intake, explicit apply, save and reopen.
- Queries: existing verifyInterop100 with an explicit bounded batch mode.
- Effects: existing isolated native Word lifecycle and local evidence reads.
- Events: no new product event or background job.
- product ports: existing source reader and export adapter; no direct renderer writer.
- Design OS ports and surfaces: none. Visual design routing does not apply because
  this task changes no product visual contract.
- state classes: PROJECT_STATE stays in the product; proof is DERIVED_STATE.
- immutable identities: saved raw source revision, project/scene/node, run,
  current merged SHA/tree, provider, profile, packaged executable and artifacts.
- capability revalidation: existing command dispatch and publication guards remain.
- input boundary: validate envelope before interpretation; bounded raw artifact reads
  reject path escapes, links, corruption, missing evidence and changed identities.
- fallback: malformed or unsupported input and incomplete routes fail explicitly.
- recovery: preserve all historical/failed evidence; one rollback for this batch.
- performance: separately time native execution, independent proofs and whole cycle.
- accessibility: no change to product UI, typing, navigation or accessible controls.
- negatives: corrupt text/order/Unicode/whitespace; missing final C2 hops; changed
  source, scene, policy, hash or profile; duplicate runs; failed cleanup; invalid envelope.
- CURRENT: source C1 has two fresh admitted fields. The old C2 driver was partial.
- TARGET: eight fields only after complete fresh merged executions and raw checks.


The first complete C2 probe exported the applied doc-v2 envelope as literal JSON.
The final native Word reader rejected this against the required twelve paragraphs.
Decode the saved envelope and reuse the existing format-IR paragraph projector.
Keep the hash of raw saved bytes as revision identity. Plain scenes retain their
existing byte semantics; malformed rich envelopes fail before export authority.


O: visible text and paragraph order survive every canonical hop on both profiles.
T: frozen product denominator -> actual commands -> immutable raw artifacts ->
independent readers -> official read-only batch consumer -> durable result.
H: completing the missing final hop exposes real defects and sharing compatible
field proofs removes repeated provider work without weakening either field.
B: preserve the denominator, legacy readers, private manuscripts and other work.
P: focused semantic/corruption tests, all mandatory gates, candidate native probes,
required CI and fresh execution on merged main. No external-supervisor impersonation.
I: exact base above; product declaration and local Lab companion pin their scopes.

The product batch consumer computes admission from executed independent field
proofs. It does not require a second manual ledger declaration of the same result.
The canonical denominator and existing acceptance modes remain unchanged.

Rollback: revert this product PR and its companion local Lab source commits;
retain native artifacts and all earlier receipts.

## IMPLEMENTATION_STEPS
1. Capture a complete C2 native journey and preserve any raw failure.
2. Repair rich-scene export through existing envelope and paragraph projection.
3. Reuse one physical journey with separate TEXT and ORDER raw proofs.
4. Reject incomplete hops, wrong identities, file corruption and unexecuted profiles.
5. Deliver one product PR and run fresh merged C1/C2 journeys on both profiles.

## CHECKS
CHECK_1_PRE_IDENTITY: Verified encrypted volume, bootstrap, ordered canon and declaration preflight.
CHECK_2_POST_PRODUCT: Visible rich content, raw saved revision, plain-text boundaries and invalid envelope rejection.
CHECK_3_POST_EVIDENCE: Actual native hops, immutable artifacts, current merged identity, independent readers and coherent negative mutations.
CHECK_4_POST_RUNTIME: Word text, persisted text, product reopen and final C2 reexport/readback; packaged profile bound to executed build.
CHECK_5_POST_DELIVERY: Focused contracts, generated build, inventory, OPS gate, guardrails, certification, CI, merge and fresh merged evidence.

## STOP_CONDITION
Foreign state, ambiguous identity, silent loss, incomplete required hop, missing authority or mandatory gate failure. No synthetic or candidate whole-cell credit.

## REPORT_FORMAT
AGENT_FINAL_REPORT_V1: exact identities, real numerator/denominator, native/review/total seconds, delivery and one next step.

## FAIL_PROTOCOL
Preserve failed artifacts and prior evidence. After three identical failures record the signature and one different hypothesis before retrying.
