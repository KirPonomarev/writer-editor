# New tracked text recording in Yalken

TASK_ID: WORD_PENDING_RECORDING_20260928
BASE_SHA: c0e311e580d77be275c6ce96f578566e251a801e
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: APPLICABLE_LAZYWEB_FIRST

O: Start recording, type insertions/deletions/replacements in existing paragraphs,
save or autosave, stop, reopen, undo the session and export native Word revisions.
T: Kernel recording command -> main-owned working session -> validated snapshot ->
Core derivation -> private save admission -> existing atomic scene transaction.
H: Derive each saved graph from one immutable starting scene, so typing Undo and
repeated autosaves never turn into artificial review operations or history growth.
B: Preserve unsaved text, prior pending IDs/authors/history and unrelated scenes.
Unsupported structure, formatting-only changes and existing revision overlap are
typed refusals that leave the buffer available. Live annotations block start.
P: Core counterexamples, real main/Kernel/save paths, atomic failure and stale
publication negatives, macOS SOURCE/PACKAGED and actual Word plus literal XML.
I: Exact base above; encrypted writable T7 checked; one delivery and rollback.

FEATURE_INTEGRATION_MANIFEST_V1:
productPlane: Core review graph; main owns recording baseline and authoring session.
interfacePlane: existing Review panel, author input and explicit start/stop state.
commands: cmd.project.review.recordTextRevisions plus existing save/decision commands.
queries: immutable project/scene/session-bound recording and pending projections.
events: existing atomic saved receipt; recording projection is never write authority.
effects: existing snapshot, ProjectTransaction, editor publication and DOCX ports.
guards: session/project/file/lifecycle identity, editor generation, current capability,
scene CAS, bounded grammar, annotation absence, no canonical ledger from renderer.
recovery: durable scene contains whole pending source and prior session frame; restart
opens review mode. Failed saves retain working buffer and do not clear dirty state.
performance: bounded ledger and paragraphs; one contiguous change per paragraph;
no diff dependency, persistent worker, alternate writer or runtime network.

SURFACE_MANIFEST_V1:
surface: existing Review host, existing controls and tokens.
content: recording state, author and start/stop; existing Original/Current decisions.
accessibility: labeled author input, native buttons and status announcement.
design: UI Craft, existing style system and Lazyweb search
366c3582-18de-4c28-88c9-6906833b077e; no exact recording reference returned, so
alternate draft/code-review marketing is not claimed as an interaction oracle.

Non-claims: format/move/structural tracked authoring, mixed annotation undo,
multi-scene recording, full P2/P5 and five-cycle saturation remain open.
Rollback: revert this bounded code delivery, preserving canonical scene and recovery.

Native resume found that a ProseMirror paste changed text without DOM input, leaving
autosave unaware. Authoring now follows Tiptap document updates; external document
loads remain silent, and formatting commands do not increment generation twice.
Acceptance includes paste and typing Undo without explicit Save, on-disk readback,
and rejected read-only edits and selection-only transactions without dirty writes.
