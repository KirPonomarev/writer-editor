# Authenticated manuscript-note return

TASK_ID: WORD_MANUSCRIPT_NOTES_R_20260928
BASE_SHA: 1b6ff38171e8c85b72bbbe3f48c5842296396f55
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: APPLICABLE_LAZYWEB_FIRST

O: Word changes to manuscript note bodies, kind, position and graph receive an
explicit preview and one atomic apply; cancellation, conflict and replay preserve
canonical data. Native qualification is macOS SOURCE and PACKAGED only.
T: bounded package -> authenticated local export capsule -> Core delta plan ->
main-owned confirmation -> Kernel notes UPDATE -> project lease -> atomic notes
port with recovery -> fresh immutable notes query.
H: stable body bookmarks survive Word renumbering and conversion; package-local
native IDs cannot safely identify a canonical note. Verify this with actual Word.
B: private notes remain private; legacy selected private notes stay read-only;
no provider path/ID authority, dependencies or runtime network. Main text must
remain unchanged for this bounded return lane; mixed edits are not accepted.
P: real parser/Core/runtime counterexamples, actual Word round trip, independent
OOXML and durable graph readback, required CI and exact merged verification.
I: exact base above, existing task worktree, verified encrypted writable T7.

FEATURE_INTEGRATION_MANIFEST_V1:
featureId: WORD_MANUSCRIPT_NOTES_R; integrationMode: EXISTING_SEAMS.
productPlane: Core note graph, local identity, rich bodies, anchors, replay receipts.
interfacePlane: existing native Word-return confirmation and notes projection.
commands: existing notes UPDATE through identity-scoped main admission only.
queries: projectNotes, source scenes, authenticated export capsule.
events: confirmed notes publication; derived notifications grant no authority.
effects: bounded XML read, fixed notes atomic write and readable recovery.
ports: existing NotesStorage main persistence port; no renderer writer.
guards: project/lifecycle/editor generation, saved scene equality, notes CAS,
package graph completeness, local capsule digest, one-shot prepared operation.
fallback: typed rejection before write; preserve drafts and recovery evidence.
performance: 256 notes, 128 paragraphs per body, bounded aggregate bytes and receipts.
accessibility: native named confirmation buttons, default Cancel, readable changes.

SURFACE_MANIFEST_V1:
surfaceId: EXISTING_NATIVE_WORD_RETURN_CONFIRMATION.
source: immutable prepared Core delta, never provider-authored instructions.
intent: explicit Apply or Cancel through the same Kernel publication path.
composition: existing macOS native confirmation; no shell or design-token change.
referenceEvidence: Lazyweb document review accept changes search, Butterdocs
unsent-comment Send/Discard/Cancel pattern (site249875); reuse the established
Yalken comment-return dialog with note-specific bodies and operation counts.
UI Craft brief: inspect changes before applying; preserve local unsaved work;
keep an explicit cancel action and report conflicts without claiming success.
rollback: revert this delivery; preserve preexisting notes and recovery snapshots.
