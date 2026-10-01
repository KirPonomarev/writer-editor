# WORD_NOTE_PANEL_FIT_MAC_20261001

STATUS: TARGET_NOT_ACCEPTED
BASE: 05487fc7bdbf53addb6875e2f91cace000dc9336

O: Wide note tables, formatting and save controls are reachable within the existing Mac notes surface.
T: Existing immutable notes projection -> existing editor/controls -> unchanged guarded note save. CSS owns computed form only.
H: Container-dependent reuse of the existing stacked narrow layout, plus zero intrinsic minima on editor grid children, contains wide tables in their own scroller.
B: Note text, cell topology/properties, anchors, other notes and main scene unchanged except explicit test edits. No parser, Commands, storage, dependencies, fonts, colors or DOM change.
P: Native SOURCE and PACKAGED pointer/keyboard access to rightmost cells, authoring/undo/save/reopen and independent persisted model readback; required repository gates. No implementation-mirroring CSS test.
I: Binding base above, one CSS outcome and revert boundary. Existing notes surface; no new visual zone.

Design router: APPLICABLE_LAZYWEB_FIRST. Design OS Group 01, existing stacked layout baseline. Lazyweb metadata references: e8e30ec8-4bf7-42d7-bf64-3166c13d29df. External screenshots have not been inspected; no external style adoption or screenshot claim. Local native screenshot on the preceding note-table build proves clipping. UI Craft layout and native-fluency-typographic-sharpness guide used; existing tokens retained.

Limits: this repair does not add nested tables, note media, note-body history, local table insertion, or complete the Mac Word plan. Any native finding must be recorded before final expensive gates.

Early native finding: the stacked layout contains all nine formatting controls and Save. Pointer selection in the rightmost table cell plus End scrolls that cell into view; inserting a marker, Undo and Save preserves the original text. This dirty SOURCE canary is diagnostic only, not final candidate acceptance.
