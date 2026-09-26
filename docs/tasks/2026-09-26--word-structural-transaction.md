# Word structural return transaction continuity

TASK_ID: WORD_STRUCTURAL_TRANSACTION_CONTINUITY_20260926
BASE_SHA: 9437d42566c9122ea8cdc7664491c5e561c0c6c3
STATUS: IMPLEMENTATION_IN_PROGRESS_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

O: authenticated structural return, rollback and startup reconciliation leave
valid scene/manifest commit records; the next ordinary save succeeds.
T: Core scene/manifest truth -> existing structural Command Kernel and private
session/key -> path and source revision guard -> main transaction port -> disk.
H: direct atomic scene writes bypass WP201 commit publication; routing those
writes through the existing publisher repairs the observed stale-digest failure.
B: no canonical/foreign WIP, UI, dependency, secret or network changes. Preserve
old corrupt records, journals, historical acceptance and oracle independence.
P: real commit-record regression including rollback/restart/concurrent edits;
native SOURCE/PACKAGED Word structural Apply -> reopen -> next save; required
RTK/static/CI/merge and exact merged verification. No new accepted IDs claimed.
I: exact base above; Node 22.12.0/npm 10.9.0; owned synthetic profiles only.

FEATURE_INTEGRATION_MANIFEST_V1:
featureId: word-structural-transaction-continuity; integrationMode: EXISTING_SEAM.
productPlane/domainOwner: Core canonical scene, manifest and recovery.
interfacePlane: existing immutable structural preview; no new visual surface.
commandIds: cmd.project.review.applyStructuralReturn and existing internal
cmd.rtk.review.applyMultiSceneStructuralReturn.
queryIds/events: existing preview and transaction result projections.
productPorts: existing main scene/manifest publisher and startup recovery.
designOsPorts: unchanged read-only review projection.
stateClasses: PROJECT_STATE scene/manifest; DERIVED_STATE preview.
identityKeys: project, scene, source revision, private session, active key,
parent path identity and expected scene/manifest bytes.
capabilityRevalidation: existing Kernel/key checks and path/CAS guard retained;
external payload and preview never grant publication authority.
recovery: rollback and startup use the same expected-content transaction port;
concurrent divergent content is preserved and reported.
negativeChecks: stale scene, parent replacement, refused publisher, partial
failure, abrupt exit and restart, subsequent ordinary transaction.
performance/accessibility: no new typing work or UI contract.
rollback: revert bounded PR; no automatic rewriting of old corrupt records.

## Packaged profile route

Native PACKAGED execution exposed WRITER_LOCAL_PROFILE_OPTIONAL_SYSTEM_DISABLED
for the existing cmd.project.review.applyStructuralReturn after successful
authenticated intake. Direct owner Word-plan authority admits this exact guarded
command alongside the existing text and formatting commands. This does not enable
optional systems, broad Review, network, signing or public distribution.
Near-match command IDs stay denied; main key/session/CAS revalidation is unchanged.
A fresh packaged build and native full-manuscript return must prove the repair.

Ordinary editor save currently adds default null attributes and a trailing empty
paragraph after a heading. The native continuity oracle records these exact
existing editor transformations separately; it does not claim byte-identical
full-feature roundtrip acceptance or conceal them through broad normalization.
