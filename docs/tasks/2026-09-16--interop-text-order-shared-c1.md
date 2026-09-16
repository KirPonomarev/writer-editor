# Shared TEXT and ORDER C1 product admission
TYPE: OPS_WRITE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0
TASK_ID: INTEROP_TEXT_ORDER_SHARED_C1_20260916
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true
STATUS: IMPLEMENTATION
DOCUMENT_CLASS: PROCESS
CLAIM_BOUNDARY: TWO_KNOWN_FIELDS_ONE_WORD_C1_FIXTURE_SOURCE_RUNTIME

## MICRO_GOAL
One fresh known Word C1 execution yields two independently checked product cell
decisions, TEXT and ORDER, through verifyInterop100. Repeated execution changes
RUN identities only; repeated admission adds neither effects nor unique credit.
Measure the entire process through durable report publication and readback.

## ARTIFACT
A bounded successor policy and official consumer compose the immutable delivered
ORDER artifact reader with a separate TEXT raw check and field-specific controls.
The user authorized this next step explicitly on 2026-09-16. Work is personal,
without agents or recurring timers. This is OPS_GOVERNANCE, not an R2.4 stage
transition or a new product runtime capability.

## ALLOWLIST
- docs/tasks/2026-09-16--interop-text-order-shared-c1.md
- docs/OPS/RTK/YALKEN_INTEROP_TEXT_ORDER_C1_RECIPE_POLICY_V1.json
- scripts/ops/rtk-interop-text-order-c1.mjs
- scripts/ops/rtk-interop-text-c1-readback.py
- scripts/ops/rtk-interop-100-denominator-v1.mjs
- test/contracts/rtk-interop-100-denominator.contract.test.js
- scripts/ops/r24/corrective/post-audit-certification-set.mjs
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json

Local Lab companion: cli/lab.mjs, scripts/run_sequential.py,
src/text-order-machine-review.mjs, test/text-order-machine-review.test.mjs,
README.md and LAB_MANIFEST.json runtime identity fields. Owned generated writers
may update the existing artifact index, ledger and dashboard. Local commits only;
the existing prohibition on remote Lab publication remains.

## DENYLIST
- Product src, dependencies and shipped UI.
- Delivered ORDER policy, reader, Python helper and task contract.
- Archived TEXT capsule and independent reader, frozen denominator and ledger.
- New fixtures, other fields/routes/volumes/profiles, network runtime and agents.
- Private documents, arbitrary producer expectations or executable payloads.

## CONTRACT / SHAPES
FEATURE_INTEGRATION_MANIFEST_V1:
- featureId/version: SHARED_TEXT_ORDER_C1_RECIPE / 1; EXISTING_SEAM.
- domainOwner/authoritativeData: frozen product contract and exact runtime.
- derivedData: immutable raw observations, independent field facts and decisions.
- commandIds/queryIds/eventTypes: existing verifyInterop100 query; unchanged
  command-driven export, import preview, explicit confirm, persistence and reopen.
- productProjectionIds/capabilityIds: no new runtime projection or capability.
- authorityMap: owner task permits this implementation; the official consumer
  reexecutes both approved checks; producer status and hashes alone grant none.
- identityKeys: product spec and HEAD/tree, exact RUN and observation, qualified
  Lab code, fixture and checker hashes, two exact target IDs, immutable index.
- revisionPolicy: verify current clean identities and bytes again before publish.
- writePath/readPath: existing Lab ledger and report; one atomic ledger update
  containing exactly two distinct field entries after immutable index publication.
- requiredProductPorts/adapterRequirements: existing Word and import adapters;
  bounded no-follow evidence reads and fixed repository Python subprocesses.
- requiredDesignOsPorts/surfaceManifests/slotRequirements: no new UI surface.
- supportedWorkspaces/platformAvailability: known single-scene source runtime,
  qualified Word for Mac only. C1 retains Yalken -> Word -> Yalken semantics.
- accessibilityRequirements: readable CLI result; no product UI change.
- fallbacks: missing, changed, stale or unsupported evidence fails with zero credit.
- stateClasses/persistenceClass: DERIVED_STATE only; manuscript mutation remains
  in the unchanged Command Kernel and Product Core paths.
- migrations/recovery/rollback: no project migration; an orphan identical index
  is reusable; partial/duplicate field sets are rejected; one successor PR revert.
- performanceBudget: two field decisions per one provider execution; full repeat
  target 300 seconds is measured, never inferred from the prior one-field sample.
- securityBoundary: no producer-selected executable, expectation or target cell.
- lifecycle: preflight -> native route -> seal -> ORDER and TEXT raw checks ->
  paired Lab decisions -> evidence commit -> official product readback -> report.
- negativeBypassChecks: coherent semantic tamper, field substitution, missing
  controls, wrong RUN/provider/source, partial/duplicate pairs and stale indexes.
- evidenceBindings/currentReality: one known ORDER recipe is delivered; TEXT is
  currently an uncredited prerequisite. This successor is TARGET until executed.

O: Two separate PRESERVED decisions observed from the official consumer.
T: Product spec -> reviewed successor -> actual raw bytes -> official readback.
H: The existing native pass contains both fields; sharing it removes a second
   physical cycle while field-specific controls keep each claim independently bounded.
B: Preserve historical bytes, other worktrees, owner projects and all runtime code.
P: Captured replay and coherent mutants first; focused tests and all required CI;
   fresh merged-head native pass, repeat, exact-request replay and durable reports.
I: Base d91813a56d14f08dcd9f6ed1fad61bddacff05a4; tree
   7e1e5e52ac176654a85c3d533ecfbffc4f29bf00; explicit two Product.C1 target IDs.

## IMPLEMENTATION_STEPS
1. Clean isolated base, bootstrap/canon reads, declaration and preflight.
2. Compose frozen raw ORDER evidence with independent TEXT facts and mutants.
3. Add explicit official two-field mode and atomic paired Lab publication.
4. Extend the existing sequential runner with the exact shared recipe mode.
5. Replay preserved real artifacts, targeted negatives and required governance.
6. Deliver product PR; bind merged runtime; execute fresh route, repeat and verify
   identical admission requests without extra effects or inflated unique counts.

## CHECKS
CHECK_01_PRE_IDENTITY: Identity, clean base, declared scope and existing frozen contracts.
CHECK_02_POST_TEXT: Codepoints, blank paragraphs, boundaries, whitespace, declared line
break policy, raw native and persisted/reopened readback; positive split runs.
CHECK_03_POST_SHARED: Two distinct field decisions, one artifact set, separate control
sets, atomic publication, exact request idempotence and zero-credit candidate replay.
CHECK_04_POST_DELIVERY: Inventory, governance, ops gate, guardrails, OSS and required CI.
CHECK_05_POST_RUNTIME: Fresh merged-head physical pass and unchanged-code repeat; full
timer through durable report; official consumer rechecks exact raw artifacts.

## STOP_CONDITION
Stop on authority or scope ambiguity, different runtime, untrusted expected data,
missing per-field raw proof, failed mandatory gate or unrelated dirty state.
Three identical failure signatures end that experiment with one next hypothesis.

## REPORT_FORMAT
One text block: task, base/code/merged SHA, changed basenames, tests, commit,
push, PR, CI, merge, exact-head proof, full timings, unique field count and next step.

## FAIL_PROTOCOL
Keep failed raw evidence. Lab acceptance is separate from product admission.
Neither two repeated RUNs nor two checks of one field create additional unique
cells. Historical different-head TEXT and ORDER records are not added to the new
two-cell count. No claim covers all 1120 targets or all 745 source requirements.
