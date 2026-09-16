# Complete Word text and order journeys
TYPE: OPS_WRITE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0
TASK_ID: WORD_TEXT_ORDER_C1_C2_BATCH_20260917
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true
STATUS: IMPLEMENTATION
DOCUMENT_CLASS: PROCESS

## Outcome
Complete the canonical C2 reexport and final native Word readback, then independently
verify TEXT and ORDER for C1 and C2 in source and packaged application profiles.
Four actual document journeys may yield eight distinct cell decisions. Repetition,
partial routes, declared PASS flags and a different build never yield extra credit.

Base: cd20513262277f292d7ff446dadd6eb97a2ae618. The owner authorizes continued
import/export implementation and a bounded Luna high checker draft. One main agent
owns integration, real Word effects and the single delivery chain.

## FEATURE_INTEGRATION_MANIFEST_V1
- featureId/version: WORD_TEXT_ORDER_C1_C2_BATCH / 1.
- product plane: existing document envelope, review export source, format-IR
  paragraph projection, command validation and atomic export publication.
- interface plane: existing commands and a read-only OPS proof query; no UI change.
- Commands: existing review export, return intake, explicit apply, save and reopen.
- Queries: existing verifyInterop100 with an explicit bounded batch mode.
- Effects: existing isolated native Word lifecycle and local evidence reads.
- Events: no new product event or background job.
- product ports: existing source reader and export adapter; no direct renderer writer.
- Design OS ports and surfaces: none; DESIGN_TOOL_ROUTER: NOT_APPLICABLE.
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

## Executed defect and repair
The first complete C2 probe exported the applied doc-v2 envelope as literal JSON.
The final native Word reader rejected this against the required twelve paragraphs.
Decode the saved envelope and reuse the existing format-IR paragraph projector.
Keep the hash of raw saved bytes as revision identity. Plain scenes retain their
existing byte semantics; malformed rich envelopes fail before export authority.

## Evidence and admission
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
