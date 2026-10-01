# WORD_NOTE_TABLES_MAC_20261001

STATUS: TARGET_NOT_ACCEPTED
BASE: dfdf6645daf91c1ef43438de58b04c0d93a08edf

O: Native footnote/endnote flat tables preserve cell content, lists, merge topology and properties through import, local cell editing, explicit Word return, all exports and reopen on Mac SOURCE/PACKAGED.
T: Bounded namespace-resolved OOXML -> existing table model plus strict Core note body -> existing Kernel import/save/return -> atomic notes persistence. No renderer storage writer.
H: Reuse table leaf ownership and XML grouping, retaining logical paragraphs (excluding validated empty vertical merge continuations), avoids text flattening while extending only the note body grammar.
B: Existing note identity, source point, private/other-scene notes, 128 paragraph leaves, 1 MiB bytes, stale/replay/capability/rollback guards. Nested tables and note media remain unsupported in this slice. No new UI toolbar, tokens, dependencies or runtime network.
P: Literal independent OOXML plus semantic table topology fixtures, malformed/budget/stale no-write checks, real changed Word route before final suites, exact frozen build and merged verification.
I: Base above; branch codex/word-note-tables-mac-20261001, preflight passed clean.

Existing note surface and table keyboard behavior only. Lazyweb metadata research b7833d6a-dbb4-416e-baed-cec2d4f86d1c retained outside repository for future toolbar work; no screenshot claim or adopted external visual style. Existing native-fluency-typographic-sharpness reference and design guide apply. No new visual zone or surface manifest.

## Early route findings and repairs

- Native Word TableGrid inherits its borders from styles. Resolve bounded unconditional border/fill style chains, including default styles, into literal properties. Exact neutral indentation/padding/spacing admitted; conditional/text/unsupported geometry and cycles remain no-write. Explicit properties override inherited edges and fill, including explicit clear.
- Early SOURCE import, local cell text/list save, scene export, changed Word cell and explicit return succeeded. Full and minimal exports retained table properties and list body. This is early dirty-build observation, not final acceptance.
- Native Cmd+Z exposed a pre-existing routing defect: the main scene history was used while a note was focused. Both keyboard and menu now resolve the focused authoring editor at dispatch, never fall through on an empty/disabled note history. Entity replacement resets note-local history to prevent undoing a different note.
- Window blur cleared paste eligibility; window focus now revalidates the existing focused-editable predicate. It does not broaden clipboard or persistence authority.
- Focused note/table/bridge chain: 183 tests passed, zero skips/todo. Final frozen SOURCE/PACKAGED exchange, restart, independent artifact inventory, full RTK, CI and merged verification are pending.

Limits: flat tables only; 128 logical paragraph leaves, existing table grid bounds. Nested tables, note media, conditional table styles, arbitrary cell margins and local table-insertion toolbar remain outside this delivery. Existing note surface has limited horizontal space for wide tables; no UI layout acceptance is claimed.
