# Pending table row revisions

TASK_ID: WORD_TABLE_ROW_REVISIONS_20260929
BASE_SHA: ed419023bf8888660a9bbc1054414851c2730a5b
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

O: Preserve declared pending table-row insertion/deletion through native Mac
import, authoring, decisions, history, export and authenticated changed return.
T: Validated XML ownership -> Core scene ledger -> existing Kernel revalidation
and atomic writer -> immutable review projection -> governed export port.
H: Native Word emits one row operation plus matching paragraph/run carriers in
every cell. Treat this as one row decision while retaining the complete body.
B: Preserve rich cells, unrelated revisions, author/date, table grid and recovery.
No nested tables, vertical-merge dependencies or mixed annotations in this slice.
P: Native Original/Current row observations, independent XML/raw-ledger readback,
negative ownership/provenance/topology cases, decisions, recording, restart,
minimum/full exports, changed SOURCE/PACKAGED returns and mandatory gates.
I: Exact base above; native table-rows.docx discovery is test evidence only.

FEATURE_INTEGRATION_MANIFEST_V1:
productPlane: Existing Core scene ledger owns checked row identity and decisions.
interfacePlane: Existing accessible revision cards label row operations.
commands: Existing recording, save, import, export, return and decision routes.
queries: Existing immutable scene/review projections.
events: Existing atomic scene-save and authenticated-return receipts.
effects: Existing local file and export adapters; no network or new dependency.
guards: Unique row ownership, matching subordinate carriers, valid grids,
authenticated local occurrence mapping and project/lifecycle/revision checks.
recovery: Existing durable decision and recording/return Undo/Redo frames.
performance: Existing bounded XML and ledger budgets; no speculative registry.
accessibility: Existing keyboard authoring and revision decision controls.

Word's native Review pane displays two operations for the discovery fixture:
one inserted row and one deleted row, although its XML contains ten carriers.
Explicit Original shows Keep/Delete/Last, Current shows Keep/Inserted/Last.
Cell-level topology and mixed nested review operations remain separate work.
Rollback: revert this bounded contour preserving original scene envelopes.

Native discovery isolated an export defect: minimum DOCX omitted compatibility
mode. Word's legacy layout rewrote a fixed two-column grid into many small grid
slots and authored table-property changes during ordinary row gestures. With
mode 15, the same native gestures preserved the exact 3000/3000 grid and produced
exactly one row deletion and one insertion. Minimum export now declares mode 15,
matching the existing full export. Legacy ragged grids and independent table
property revisions remain explicitly blocked rather than flattened.

New returned rows are admitted only when every new paragraph is inside an
explicit native inserted row, all old bookmarks are uniquely paired and ordered,
and removing only those new rows restores the authenticated table topology.
New source occurrences use null identity bindings, preventing reuse of an old
revision ID. Numeric section bindings retain the authenticated old boundaries.
This comparison is evidence only; existing return authentication, CAS, Kernel
revalidation and atomic history remain mandatory.
