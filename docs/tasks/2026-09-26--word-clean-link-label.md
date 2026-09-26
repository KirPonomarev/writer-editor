# P1a: authenticated untracked hyperlink label return

TASK_ID: WORD_CLEAN_LINK_LABEL_RETURN_20260926
BASE_SHA: 4a42bad70288e8d91ff6742b1ffa97f0072daecf
STATUS: IMPLEMENTATION_IN_PROGRESS_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

Owner authorized revision-3 Word implementation. PR2003 is merged and exact-head
verified. Reproducer: native Word changes only an existing HTTP(S) link label,
without Track Changes; authenticated return currently rejects paragraph text.

O: explicit text preview and Apply preserve the changed label, exact target,
all neighboring text and marks; no fake tracked revisions or author identity.
T: immutable parser evidence -> locally authenticated scene/export map ->
bounded semantic link correspondence -> main-owned preview -> existing Command
Kernel text Apply -> serialized transactional persistence and journal.
H: an unchanged sequence of semantic runs identifies one label-only effect;
ambiguous, unsupported, mixed, stale or unauthenticated input cannot write.
B: canonical/foreign WIP, current tracked/formatting paths, immutable worker
packet, independent oracle, keys, old acceptance sets, and no-loss recovery.
P: positive and adversarial module + actual main path tests; exact source/key/
session checks; real Word SOURCE/PACKAGED -> explicit Apply -> new-process
readback; required static, RTK, CI, merge and exact merged verification.
I: base above; same exact Node/npm toolchain; owned synthetic profiles only.

FEATURE_INTEGRATION_MANIFEST_V1:
featureId: word-clean-link-label-return; integrationMode: EXISTING_SEAM.
productPlane/domainOwner: Core canonical rich content and existing journal.
interfacePlane: existing immutable text review projection and explicit Apply.
commandIds: cmd.project.review.activateDocxReviewPreviewSession,
cmd.project.review.applyExactTextChangesBatch.
queryIds/events: existing review projection and transaction outcomes.
productPorts: existing parser, secret store, persistence and recovery ports.
designOsPorts: existing immutable review projection, no new UI surface.
stateClasses: DERIVED_STATE preview; PROJECT_STATE only after explicit Apply.
identityKeys: project, round, keyRef, source SHA, scene/block, session generation,
returned artifact digest and exact candidate identity.
capabilityRevalidation: Kernel + main private store + live key + source hash
inside serialized writer. Preview and external payload confer no authority.
recovery: existing exact text journal, replay and rollback semantics.
security: bounded pure semantic comparison; no URL activation, dependency,
network, external paths or secrets. Reject rather than weaken global guard.
negativeChecks: duplicate label, mixed marks, unknown siblings, changed target,
stale input, revoked key, forged candidate, cancellation, queued identity drift.
performance: linear run comparison with explicit paragraph/run/text budgets;
no typing-path work. Existing accessibility and review UI retained.
rollback: revert this delivery. No new official accepted cell claim until proof.

Physical chained-return finding: an earlier native formatting Apply changed a
scene while its WP201 scene digest remained unchanged. A following text Apply
correctly failed E_PROJECT_COMMIT_CORRUPT; recovery preserved all original bytes.
This slice therefore routes formatting publication, rollback and startup
reconciliation through the existing main scene+manifest transaction port. The
formatting runtime retains its path/revision guard and exact expected content;
production supplies the port, while isolated runtime tests retain their existing
atomic adapter. No old corrupt marker is deleted or silently trusted. Tests
cover formatting -> text, rollback, restart, concurrent edit and failed publisher.
