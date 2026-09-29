# Pending text revisions within lists and table cells

TASK_ID: WORD_PENDING_RICH_BLOCKS_20260929
BASE_SHA: e9d579543a69902da00137c751bd4aa957fb56e4
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

O: Import Word insert/delete/replace revisions in lists and table cells without
accepting them; preserve Original/Current, provenance, decisions and history
through authoring, persistence, restart and export.
T: Namespace-checked OOXML -> bounded Core ledger -> immutable projection ->
existing Kernel import, recording or decision command -> atomic scene writer.
H: A single canonical paragraph occurrence order spans list and cell leaves.
Bind raw Word paragraph occurrences to retained leaves so vertical-merge
continuation paragraphs cannot shift revision ownership. Independently parse
Current and compare its complete document projection before ledger admission.
B: Existing table geometry, list starts, empty paragraphs, text, rich marks,
source revision and no-loss working state remain protected. No new dependency.
P: Native Word counterexample, five serialization cycles, actual product
commands and disk readback, decisions/history, topology and hostile negatives.
I: Base above; verified encrypted T7; same isolated worktree and one delivery.

FEATURE_INTEGRATION_MANIFEST_V1:
productPlane: Core pending ledger owns source tree and revision decisions.
interfacePlane: existing immutable pending review and recording projections.
commands: existing safe-create, recording, decision, review and export commands.
queries: existing document and review projections.
events: existing saved and exported receipts.
effects: existing atomic project transaction and DOCX publication ports.
guards: exact project, scene, baseline, capability, paragraph occurrence and
unchanged list/table topology; parsed XML does not supply write authority.
recovery: existing scene envelopes, transaction backups and durable history.
bounds: existing 4 MiB ledger and 1024 revision limits; 10000 paragraph leaves,
2048 lists and levels 0 through 8; existing table geometry limits.
performance: collect leaf projections once per materialization/export.
accessibility: unchanged product controls and native list/table semantics.

Non-claims: nested tables, tracked structural edits, hyperlinks/media and mixed
comments/notes with pending revisions. Full macOS qualification remains separate.
Rollback: revert this delivery while retaining rich envelopes and backups.
