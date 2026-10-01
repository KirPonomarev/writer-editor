# WORD_NOTE_LISTS_MAC_20261001

STATUS: TARGET_NOT_ACCEPTED
BASE: 12ab91c3751b612ac00238d9cb3fa77f89fa3f86

## Outcome and authority
Owner authorizes whole Mac Word plan; this bounded slice adds editable bullet and decimal lists inside footnotes/endnotes through existing Core, import, note commands, exports and authenticated explicit return. One delivery and rollback. No new dependency, runtime network or surface.

## MAP
O: Native Word-origin list note imports, can be edited in Yalken, returned from Word explicitly, reopened and reexported in all three export modes.
T: Literal bounded OOXML -> Core validated note body -> existing Kernel and atomic note persistence -> immutable projection/export.
H: Existing parser recognizes numbering but explicitly refuses note lists; extending the shared Core grammar and serialization preserves list meaning without text flattening.
B: Existing notes, point references, private notes, source scenes, stale/CAS/replay and no-loss guards remain protected. Tables/media and composite scene changes remain outside this slice. Revert this delivery for rollback; preserve original snapshots.
P: Native fixture first; focused validator/parser/export/return negatives; short SOURCE and PACKAGED Word route before complete required suites; immutable candidate native qualification, CI and exact merged checks.
I: Exact base above; branch codex/word-note-lists-mac-20261001; isolated task worktree; architecture declaration passed clean preflight.

## Bounds
At most128 paragraph leaves per note; list levels0 through8; one paragraph per item followed only by nested lists. Decimal start0..2147483647 without ordinal overflow. Existing256 note,1MiB aggregate and200000 text limits. Unknown body nodes fail with no write.

## UI evidence and scope
Lazyweb desktop document-editor search returned Butterdocs footnote sidebar with formatting toolbar. Reuse existing notes toolbar and notes-button controls; no palette, spacing, shell or layout changes. Named bullet/numbered and indent/outdent controls use existing Tiptap commands, maintain draft and keyboard behavior. Existing paste policy remains plain text.

## Baseline
A native Word document with two numbered footnote paragraphs yields DOCX_GENERIC_NOTE_BODY_UNSUPPORTED on12ab91c3; packaged import disables Import. Correct direct-byte parser probe and native input preserved externally. An earlier incorrectly-shaped probe is not product evidence.

## Acceptance
TARGET until exact candidate SOURCE/PACKAGED changed exchanges, authoring, reopen, history, three export inventories, focused negatives, required baseline, CI, merge and exact merged verification. No whole-plan percentage claim.

## Early route findings
Native generic import, list indentation, explicit Save, full export, native Word text edit and explicit return now observed in a dirty SOURCE candidate. Typed Tiptap ordered-list type:null is inert decimal; other type values fail closed. Note authoring/return compare inert document schema defaults while preserving all non-null and unknown state; regression covers true stale changes. Source notes written with unchanged ID and point. Scene Review export independently exposed complete omission of notes; its source, private baseline, signed digest, semantic publication check and prewrite note/source revalidation are now wired. SOURCE and PACKAGED both completed native Word changes and explicit scene-review note return with stable note identity, reference and nesting; durable notes and changed DOCX copies are preserved externally. These early route checks are not immutable-candidate qualification. Scene Review without existing active notes does not yet create an editable empty-note baseline.

## History integration finding
Native history restore on the tested candidate restored only scene bytes when no user bookmark registry existed, leaving a manuscript note bound to the newer text. Note text survived but its marker disappeared. The guarded rich-scene history path now includes active notes and uses the existing atomic scene/manifest/note cohort, creates a pre-restore snapshot, and guards editor publication. Restore and undo preserve rich note body and rebase the point; stale generation, denied capability, corrupt notes and stale reference fail without mutation. Final native and full candidate verification remain required.

Right-edge after-affinity points now map to the surviving suffix even when deletion ends at the note point. Exhaustive short binary strings check every accepted mapping against all equally minimal contiguous edits; ambiguous interior points remain no-write. SOURCE and PACKAGED native restore, undo and restore again preserved the marker and rich note body after the repair; 180 affected tests passed without skips. These are pre-freeze repair checks.
