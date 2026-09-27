# Ordinary paragraph boundary edits with comments

Task: WORD_COMMENT_PARAGRAPH_REBASE_20260927
Base: f2d61eedc5006bfea02b75ce85a9e660674d781e
Authority: owner autonomous Word correction plan, P1 ordinary authoring anchors.

O: Save an unambiguous Enter or paragraph merge outside a comment range; preserve
comment identity, messages, provenance, history and Word export after restart.
T: ordinary Save intent -> existing authority and project lease -> Core exact
anchor transform -> authenticated scene/manifest/comment transaction -> recovery.
H: paragraph separators belong to the contiguous edit envelope; only ranges
outside every minimal possible envelope can move. Exact quote, grapheme bounds
and destination block type must remain unchanged. No matching-text heuristic.
B: current scene, graph, drafts, other scenes, archived threads and unrelated WIP
remain protected. In-range, repeated-boundary ambiguous or cross-block ranges
fail before canonical writes. No new UI, dependency, command or storage writer.
P: focused actual-main Save tests, Unicode/ambiguity negatives, SIGKILL recovery,
full required RTK/CI and native SOURCE/PACKAGED Enter/Delete, reopen and Word
readback. A native observation is scoped to its exact build and synthetic profile.
I: base above; scene/project identity, quote and block hashes, existing CAS and
lease. Transaction independently recomputes and authenticates the companion.

FEATURE_INTEGRATION_MANIFEST_V1: extension of existing Save transform only.
Product Core owns anchor semantics; Command Kernel retains save authority;
Design OS and immutable renderer projections are unchanged. PROJECT_STATE is
published atomically; unsaved AUTHORING_WORKING_STATE survives rejection.
Existing Save command, scene query, save events and filesystem effect port are
retained. No new surface, background job or runtime registry.
DESIGN_TOOL_ROUTER: NOT_APPLICABLE. No visual contract changes.

One scene-level map is built when block count changes; per-block maps are reused
for multiple anchors on ordinary same-shape edits. Full rich structural editing,
quote edits and mixed Word manuscript returns remain separate plan work.
Rollback: revert this transform, tests and exact admissions together.
Acceptance credit: zero new officially accepted IDs until the official aggregate.
