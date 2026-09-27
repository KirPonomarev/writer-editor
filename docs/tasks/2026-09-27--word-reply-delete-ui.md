# Exact reply deletion in ordinary comments UI

Task: WORD_REPLY_DELETE_UI_20260927
Base: ab60389a294716e64c0fc1037aeeda4d9bda4592
Authority: owner autonomous Word correction plan P1b ordinary authoring.

O: delete one reply through the existing Yalken UI; preserve root, peers, history
and manuscript across new-process reopen and native Word export readback.
T: immutable commentAuthoring projection -> renderer intent -> existing
cmd.project.review.editComment -> Kernel and main revalidation -> existing Core
archive -> project lease and atomic persistence/recovery. No renderer writer.
H: explicit deleteReply UI action binds a required reply ID before mapping to
existing delete command; missing/foreign/root targets cannot delete the thread.
B: unsent draft, pending publication, root, peers, provenance and recovery remain
protected. No UI layout/token change, dependency, new API, or runtime network.
P: actual renderer handler and real Core negatives, full RTK and required CI;
SOURCE/PACKAGED native button, disk readback, reopen, export and raw Word XML.
I: exact base above, project/scene/subject and state/scene digests; main rechecks
lease, revision, saved text and generation before canonical publication.

FEATURE_INTEGRATION_MANIFEST_V1: existing authoring command binding.
Product plane retains canonical comment semantics and persistence unchanged.
Interface plane adds an existing secondary button to reply rows and distinguishes
whole-discussion deletion in its label. Query: existing reviewSurface. Event:
existing WORD_COMMENT_AUTHORED. Effects: existing main ports only.
AUTHORING_WORKING_STATE drafts survive blocked actions; PROJECT_STATE stays in
Core; renderer projection is DERIVED_STATE. No new surface requiring a new
SURFACE_MANIFEST_V1. Existing HTML button keyboard and disabled behavior retained.
DESIGN_TOOL_ROUTER: APPLICABLE_LAZYWEB_FIRST. Bounded desktop comment-deletion
research supports explicit reply versus discussion scope; existing components
and typography remain authoritative. UI Craft applied without visual redesign.

Acceptance is this operation only, not full P1b/P1c or new official cell IDs.
Rollback: revert binding, tests and exact admissions; preserve archived records.
