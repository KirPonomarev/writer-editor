# Word round keys: same-device restart durability

TASK_ID: WORD_ROUND_KEY_DURABILITY_20260926
BASE_SHA: 1dd99f79e52828a1b3915d5fa75d9a8ce4a03790
STATUS: TARGET_IMPLEMENTATION_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE_BACKEND

Owner authorized personal implementation of the revision-3 Word plan.
One bounded repair, one rollback, no global cell or cross-platform claim.

O: locally published review export remains authentic after restarting the app;
revoked/lost/foreign keys cannot authorize any formatting or structure writer.
T: main-owned export authority -> private ReviewSecretStorePort -> OS-encrypted
app-local file; foreign DOCX, renderer and project files never supply a key.
H: persist the existing per-round secret rather than replacing the signing
protocol; resolve exact local identity at intake and at guarded Apply.
B: preserve project bytes, existing publication/CAS/journal/replay, historical
bindings, source/packaged separation, foreign WIP and all mandatory gates.
P: fresh process signature verification, hostile ciphertext and monotonic
revocation, executed main command no-write checks, SOURCE/PACKAGED native Word
export -> restart -> return -> Apply, CI and exact merged-head verification.
I: exact base above, exact Node 22.12.0/npm 10.9.0, synthetic owned documents.

## FEATURE_INTEGRATION_MANIFEST_V1

featureId: word-round-key-durability; featureVersion: 1;
integrationMode: EXISTING_SEAM.
productPlane: existing Core authority/lifecycle owns the round and documents.
interfacePlane: existing read-only diagnostics; no visual or renderer change.
authoritativeData: existing local round record, publication status, key state.
derivedData: verified return preview; it confers no write authority.
commandIds: existing review export, return intake and formatting/structural Apply.
queryIds: existing review session projection; eventTypes: existing outcomes.
productPorts: ReviewSecretStorePort (main-only), existing round store and writers.
designOsPorts: existing immutable review projection; no key exposure.
writePath: existing main export -> OS encryption -> bounded atomic private file;
existing revocation/loss -> monotonic persisted restriction. Document mutations
remain inside the existing Command Kernel and guarded transaction handlers.
readPath: main-owned real project-root binding + opaque keyRef -> bounded private
ciphertext -> OS decrypt -> in-memory handle. No secret in logs or evidence.
identityKeys: real project root digest, opaque ref, round digest, key digest,
existing session/project/revision/artifact identities.
capabilityRevalidation: formatting/structural Kernel handlers compare the private
session input and resolve the current key after asynchronous module loading;
recheck project/session after resolution, then invoke existing transaction guards.
stateClasses: private durable product authority; derived review preview only.
persistenceClass: application-local encrypted auxiliary data, not project schema.
recovery: absent/corrupt/foreign/unavailable protection fails closed; no secret
reconstruction, plaintext fallback, cloud lookup or historical authority rewrite.
securityBoundary: bounded no-follow private records, atomic fsync/readback,
project isolation, monotonic key state, no raw-secret IPC or renderer port.
platformAvailability: OS encryption required; Linux basic_text is rejected;
Mac SOURCE and PACKAGED qualify separately. No Windows native claim from CI.
performance: bounded 16 KiB ciphertext; no keystroke I/O or new dependency.
accessibility/surfaceManifest: NOT_APPLICABLE_BACKEND, existing surfaces unchanged.
negativeBypassChecks: missing/oversized/corrupt/symlink ciphertext, wrong project,
wrong round/key, durable revocation, stale live handle, forged Apply input,
project/session invalidation during key resolution and persistence failure.
rollback: revert this bounded PR; encrypted files remain local and inert.
currentReality: base stores keys only in memory; round metadata survives restart.
targetOnly: this slice does not add cross-device recovery, universal Word fidelity,
new accepted frozen IDs, a master-key migration or release signing.

## Acceptance boundary

Test encryption is injected in contract tests only. Real OS storage must be
proved in actual SOURCE and PACKAGED app processes; a Node subprocess test does
not certify Electron safeStorage or native Word. No independent acceptance is
claimed before physical proof, delivery and exact-head verification.
