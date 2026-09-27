# Canonical comment authoring

TASK_ID: WORD_COMMENT_AUTHORING_20260927
BASE_SHA: 710148bdb2573f0b8f4cf07679996afec8d22d55
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: APPLICABLE_LAZYWEB_FIRST

O: create, edit root/reply, reply, resolve/reopen, delete and explicitly reanchor
plain canonical comments from the existing REVIEW panel, then reopen and export.
T: immutable Core projection -> renderer intent -> existing Command Kernel ->
main-owned scene/project/lifecycle -> project lease -> atomic comment file.
H: an exact state/scene binding and closed operation grammar prevent stale UI,
foreign thread IDs and renderer paths from becoming write authority.
B: preserve unrelated threads, original provenance, unsaved text and comment
drafts. No new dependency, writer, bus, network, palette or shell structure.
P: pure operation counterexamples, actual file CAS/recovery, command boundary,
keyboard UI, SOURCE/PACKAGED reopen and independent Word/DOCX readback; all gates.
I: exact base above, existing fixed canonical state, one active committed scene.
Rollback: revert this bounded delivery; existing comment schema remains readable.

FEATURE_INTEGRATION_MANIFEST_V1:
featureId: word-comment-authoring-v1; integrationMode: EXISTING_SEAM.
productPlane: Core computes comment graph delta, Kernel revalidates command;
main adapter owns fixed-path atomic IO under the existing project lease.
interfacePlane: existing REVIEW comment lane, immutable authoring projection.
commands: cmd.project.review.editComment with a closed action enum.
queries: existing reviewSurface projection extended with authoring binding.
effects: existing local atomic writer and readable recovery snapshot.
stateClasses: PROJECT_STATE graph; AUTHORING_WORKING_STATE unsent body draft;
DERIVED_STATE projection; TRANSIENT_STATE focus and selected action.
identity: exact project, lifecycle, scene, scene bytes and canonical state hash.
fallback: conflict/unsaved/unsupported selection retains draft and changes nothing.
performance: 64 KiB state, 16 KiB body; no heavy work while typing.
recovery: one canonical state publication after readable before-state snapshot;
publication uses current lease, scene identity and state CAS immediately before IO.

SURFACE_MANIFEST_V1:
surfaceId: existing REVIEW canonical comment lane; workspace: REVIEW.
slot: existing data-review-surface-host; no new shell slot or container.
projection: literal bodies, authors, status, stable IDs and revision binding.
intents: add, edit, reply, resolve, reopen, delete, reanchor, save and cancel.
capability: unavailable if no committed active scene or stale/unsupported binding.
accessibility: native labelled textarea/buttons, keyboard access, focus restoration,
explicit save/cancel, draft retained on errors and projection refresh.

Design brief: preserve existing vanilla CSS, fonts, palette and spacing. Prioritize
comment content and actions in the existing lane; no decorative redesign.
Lazyweb reference session 3b3b2da6-406e-4f72-b123-73b18149fd39 supplies explicit
comment drafting/save/cancel patterns; it is advisory, not product authority.
Native baseline observed on 710148bd: comments are visible but read-only; the
current panel exposes technical transport diagnostics. Keep unrelated controls.

This slice does not close P1b/P1c. Ordinary text anchor transformations, richer
comment bodies, Word edit-body deltas and alternating cycles remain separate
required work before full feature acceptance. Official accepted-cell delta: zero.
