# Preserve authored Word block topology

TASK_ID: WORD_PRESERVE_AUTHORED_TOPOLOGY_20260926
BASE_SHA: d73927fa3331a90e6c33864e09ab9a6c3062e377
STATUS: TARGET_IMPLEMENTATION_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE_MECHANICAL

O: loading, focusing and saving an existing document must not append paragraphs;
explicit authoring, authored empty paragraphs and undo/redo remain intact.
T: Core rich graph -> immutable load -> authoring working state -> existing
save Command Kernel -> guarded Core transaction. No new write or IPC path.
H: the configured StarterKit trailingNode extension appends content on a focus
transaction after headings, code, quotes and lists. Disable that automatic
extension; retain explicit Enter, splitListItem and exitCode commands.
B: preserve every pre-existing authored node, metadata, private project and WIP.
No content cleanup, new dependency, style/token/composition change or new command.
P: actual production configuration with real ProseMirror transactions;
full graph comparisons, authoring/undo/redo, native SOURCE/PACKAGED Word import,
save/restart/export, mandatory regression/static/CI/merge and exact-head checks.
I: exact base above, exact candidate bundle and owned synthetic profiles only.

FEATURE_INTEGRATION_MANIFEST_V1:
featureId: word-preserve-authored-topology; integrationMode: EXISTING_SEAM.
productPlane: Core owns persisted rich graph; authoring state retains user input.
interfacePlane: existing editor projection and keyboard intent; no new surface.
commands: existing Enter/list/code authoring and cmd.project.save.
queries/events/effects: existing editor load/save; no new registry or platform I/O.
ports: existing document projection and persistence; unchanged identity guards.
fallbacks: no synthetic paragraph and no deletion of a user-authored empty node.
recovery: unchanged transaction recovery; rollback is one bounded PR revert.
accessibility/performance: keyboard commands remain; remove implicit transaction.
negativeChecks: restored automatic trailing-node behavior must fail topology tests.

Native PR2005 evidence exposed the heading case; read-only production-config
reproduction confirmed all five non-table block types. Existing table-only
preservation remains covered. This repair gives zero new official interop IDs
and does not itself close the full Word feature matrix.
