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
  new media capability. Both are fixed; actual renderer capability/bus and snapshot-transport tests
  cover the desktop route and reject web. Native picker and insertion now work.
- The image catalog row had no live toolbar node or live-order membership. The
  physical button and live order are now wired; native SOURCE selected and
  inserted JPEG through the full toolbar profile. Existing saved custom profiles
  remain unchanged. A compact accessible icon replaces an overflowing label.
- Diagnostic runtime copies are explicitly dirty, hash-bound early-route
  diagnostics, not frozen candidate acceptance or full Mac qualification.

- Native SOURCE diagnostic 05 confirmed PNG at visible UTF16 offset 5, not just
  the end of the scene; keyboard focus was required for deterministic positioning.
- Diagnostic 06 confirmed persisted PNG after process restart and JPEG insertion
  at document start using Command-Up. The existing endnote remained available.
- Native Undo/Redo writes and byte-identical note storage were observed; these
  are early route observations, not frozen candidate acceptance.
- Focused image and toolbar regression group: 49 passed, zero failed/skipped.
- Existing media-return lane still rejects a changed main-text image combined
  with document notes. This residual belongs to full composite acceptance; local
  insertion and note preservation do not prove that return composition.

- Candidate 0c267df2: 215 focused tests passed. Full RTK: 2333 pass, 4 fail,
  zero skips. Three ORCH failures concern process inspection/identity timing.
  The fourth was an extracted snapshot fixture missing isTiptapMode and cursor
  dependencies; the fixture now supplies them without weakening assertions.
  Comment-authoring plus image group: 36 passed, zero failures/skips.
- Frozen SOURCE 0c267df2: native local PNG at offset 5 -> Undo -> Redo ->
  linked DOCX -> native Word resize to 720000 x 480000 EMU -> preview Apply
  persisted the new dimensions, exact original image bytes and unchanged text.
  PACKAGED and reopened re-export proof remain pending.
