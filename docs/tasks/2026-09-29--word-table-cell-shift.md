# Native tracked cell shifts

TASK_ID: WORD_TABLE_CELL_SHIFT_20260929
BASE_SHA: 40686bf254aa177467a00ca9a7121d3861be1e0a
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

O: Qualify native Mac insert-cell-down and delete-cell-up without losing rich
content, empty cells, Original/Current, authors, decisions or durable history.
T: Native XML -> existing validated Core revision ledger -> existing Kernel
commands, atomic persistence and governed exports. No new writer or authority.
H: Word expresses these gestures as run replacements and, for insertion, a
tracked bottom row. The existing text/row model should preserve both versions.
B: Unknown cellIns/cellDel/cellMerge, ragged grids, mixed annotation and untracked
geometry changes remain outside this declared operation set. Preserve all WIP.
P: Native synthetic fixtures; rich projection and decision/export regressions;
SOURCE/PACKAGED authored edit, Word changed return, restart and reexport proof.
I: Exact base above; fixtures retain native XML and input ZIP hashes.

Native Mac Word explicitly warns that horizontal cell merging is not tracked.
It is therefore not represented as a fictional pending cell-merge operation.
Untracked merge fidelity remains a separate table-topology task.

This test-only integration uses existing product and interface planes, Commands,
Queries, Events, Effects, projections and identity guards. No new visual area,
dependency, platform port, persistence model or runtime network is introduced.
Rollback: revert this qualification; no production document migration needed.
