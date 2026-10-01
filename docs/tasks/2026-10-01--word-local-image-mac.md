# WORD_LOCAL_IMAGE_MAC_20261001

Status: TARGET_NOT_ACCEPTED. Base: c1040cea6ba49e48bf6ebc3521a2c98da1029304.

O: Choose a local PNG/JPEG through the existing image toolbar/palette command,
insert at the exact cursor, undo/redo, save/reopen and exchange with Word on Mac.
Observe image bytes, placement, note/bookmark coordinates and unchanged text.

T: Main-bound project/scene and editor snapshot -> canonical
cmd.project.media.insertLocal -> Main native picker -> bounded byte validation
-> Core plan -> existing atomic project transaction -> guarded incremental
editor publication. Renderer supplies intent and snapshot, never a path writer.

H: Existing media persistence/export can serve local authoring. A Core plan
bound to the actual ProseMirror cursor preserves ordering among adjacent images;
incremental editor publication preserves history. Unifying zero-width image
coordinates prevents note and bookmark anchor drift.

B: Preserve unrelated text, formatting, scene metadata, notes/comments, private
state and owner checkout. No dependencies, runtime network, shell redesign,
floating images, nested-table grammar or new writer. Roll back one slice.

P: Core position and file boundary tests; actual Main command/transaction stale,
capability, substitution and recovery tests; real editor Undo/Redo; early native
route before full RTK; frozen SOURCE and PACKAGED exchange with independent
DOCX byte/XML comparisons; mandatory CI and merged-head verification.

I: Binding base above; branch codex/word-local-image-mac-20261001. Native candidate
SHA, build/profile identities and output hashes must be recorded before claims.

UI: Reuse toolbar.insert.image, existing palette and native macOS picker.
Previous Lazyweb search for document-editor insert-image toolbar yielded Proton,
ClickUp and Coda references; no external design or asset is adopted. Existing
Yalken tokens, typography, icons, focus and status presentation remain the design
contract. No new visual zone; a separate surface manifest is not applicable.

Acceptance and delivery remain outstanding. This task does not close the whole
Mac plan or its five edited alternating cycles per runtime.

## Early integration observations

- Core plus Main and existing bookmark/note regression group: 183 passed, no
  failures or skips on the working candidate before final native fixes.
- Early native palette action did not open a picker. Inspection found two
  integration omissions: the palette injects editorMode (strict Main input must
  admit only the known tiptap value) and desktop capability matrix lacked the
  new media capability. Both are fixed; an actual renderer capability/bus test
  now covers the desktop route and rejects web. Native rerun is pending.
- The image catalog row had no live toolbar node or live-order membership. The
  palette exposes the command; toolbar completion remains outstanding. Do not
  claim a usable toolbar from catalog state alone.
- Diagnostic runtime copies are explicitly dirty, hash-bound early-route
  diagnostics, not frozen candidate acceptance or full Mac qualification.
