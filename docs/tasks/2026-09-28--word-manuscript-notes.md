# Manuscript footnotes and endnotes: generic import and authoring

TASK_ID: WORD_MANUSCRIPT_NOTES_G_20260928
BASE_SHA: 1c5e3c879635aadcb173c67390f6175c1f3608ee
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: APPLICABLE_LAZYWEB_FIRST

O: macOS Word-origin foot/endnotes become editable manuscript notes, survive
save and a new process, and export as native Word notes with their point and
rich paragraph bodies intact. Private notes retain their existing behavior.
T: bounded DOCX -> validated import candidate -> Kernel/main project lease ->
canonical notes and scene transaction -> immutable note projection -> native
DOCX publication. Provider note IDs never select existing local notes.
H: the existing model has private plain-text notes and selected read-only native
export. A versioned manuscript payload in that model, with an explicit point
reference and rich body, closes the missing generic-import/authoring path.
B: no implicit private-note export, no rich-body flattening, no stale anchor
write, no renderer storage/path authority, no new dependency or runtime network.
P: model and parser negatives, actual command/persistence/recovery checks,
independent raw OOXML and whole-model comparison, native Word SOURCE/PACKAGED,
required CI, guardrails and exact merged verification.
I: exact base above; verified encrypted writable T7; synthetic macOS profiles.

FEATURE_INTEGRATION_MANIFEST_V1:
featureId: WORD_MANUSCRIPT_NOTES_G; integrationMode: EXISTING_SEAMS.
productPlane: notesStorage owns stable local identity, private/manuscript class,
foot/endnote kind, point reference and rich body. Scene text owns the coordinate.
interfacePlane: existing notes workspace plus derived reference presentation.
commands: existing notes create/update/delete/restore and scene save/import/export.
queries: existing projectNotes and current document projections.
events: existing notes/scene publication; no new event grants mutation authority.
effects: bounded DOCX parts, atomic notes persistence and project transaction.
ports: NotesStorage, ProjectTransaction, safe-create import and DOCX export.
guards: project/lifecycle/capability, scene text digest, note-state digest,
UTF16 boundaries, local note IDs and revision-bound async publication.
fallback: reject unsupported grammar or ambiguous/stale rebase before mutation.
recovery: scene and affected note points share a journal and commit point.
performance: bounded counts, paragraph/byte limits and linear point mapping.
accessibility: named fields/buttons, keyboard activation, focus restoration,
preserved drafts on failure and visible inline status.

SURFACE_MANIFEST_V1:
surfaceId: EXISTING_NOTES_WORKSPACE_MANUSCRIPT_BODY.
source: immutable projectNotes and active-scene projections.
intent: create/edit/delete/reanchor/convert note through existing Kernel commands.
composition: preserve existing shell, notes workspace, typography and tokens.
referenceEvidence: Lazyweb Butterdocs editor and footnotes adjacent interaction,
result screens:12934f044cea27351000c6ae; search
https://www.lazyweb.com/agentic-search/3e2caa47-5dbe-4666-b848-03c47f9067cc .
UI Craft brief: desktop manuscript author; keep writing context and exact body
content; private notes remain private; success is edit/reopen/native export.
Token policy: reuse the repository's existing notes/editor tokens and controls.

P1d-R editable authenticated return is a subsequent delivery. Nested lists,
tables and media inside note bodies remain P3 scope. No full-plan or complete
notes acceptance claim follows from this bounded implementation alone.
