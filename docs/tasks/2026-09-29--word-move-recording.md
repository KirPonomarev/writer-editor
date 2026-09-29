# Record exact rich-text relocations

TASK_ID: WORD_MOVE_RECORDING_20260929
BASE_SHA: 29509db7bf01037fa3c3c4ee3b70b386ada6a6ed
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

O: Record a unique unchanged rich fragment moved between existing paragraph
leaves as one reversible native Word move, including list and table paragraphs.
T: Existing main-owned recording session -> Core delta derivation -> guarded
atomic writer -> immutable review projection -> existing export adapter.
H: Recording currently emits independent deletion and insertion for exact
relocation. Pair only new, ungrouped, uniquely matching normalized rich slices.
Expected observation: identical Original/Current, one shared group/name, paired
decisions, stable autosave derivation and native Word source/destination ranges.
B: Protect imported/history IDs, author/time, scene identity and container
topology; no clipboard payload or text match grants write authority.
P: Cut then paste across autosaves, decisions/history, five minimum/full cycles,
Kernel and native SOURCE/PACKAGED authoring and changed Word return. Negative
checks cover duplicate candidates, copy-only, differing marks, replacements,
same-paragraph edits, stale publication and pre-existing revisions.
I: Exact base above; clean isolated worktree on verified encrypted T7 volume.

FEATURE_INTEGRATION_MANIFEST_V1:
productPlane: Core owns exact relocation classification and paired state.
interfacePlane: Existing review cards and recording copy explain the pair.
commands: Existing recording, save, decision, import, export and return routes.
queries: Existing immutable review projection and bound authoring snapshot.
events: Existing save, return and export receipts.
effects: Existing atomic scene writer and governed DOCX publication adapter.
guards: Existing project, scene, lifecycle, baseline, generation, capability,
annotation and CAS guards; pair only new unique rich-identical disjoint spans.
recovery: Existing durable recording frame, paired decisions and returned rounds.
performance: Bounded revision map within existing 1024-row and 4 MiB limits.
accessibility: Existing controls, labels and keyboard editing remain available.

The contract describes relocation in the admitted document delta; it does not
assert which clipboard gesture produced it. Repeated candidates, replacements,
changed formatting and same-paragraph edits remain ordinary pending text edits.
These rows are not claimed as native moves. Structural changes, mixed
annotations and final full-plan Mac qualification remain separate open work.
Rollback: revert this bounded classifier while preserving envelopes and history.

Native SOURCE exposed missing macOS Cmd+X when the governed menu omits Cut.
The focused main-window native Cut adapter now forwards that exact gesture once
into the authoring buffer. Wrong key/modifiers, repeat, unfocused/destroyed
windows and other platforms are untouched; save capability and CAS remain the
only persistence route. No clipboard contents or renderer code are evaluated.

Native changed Word return moves an authenticated paragraph bookmark endpoint
between moveTo and moveToRangeEnd. Parsing admits this text-free endpoint only
with a unique balanced same-paragraph transport bookmark pair. Orphan,
duplicate, foreign-namespace, user bookmark and extra range text remain blocked.
