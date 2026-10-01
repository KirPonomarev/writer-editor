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
