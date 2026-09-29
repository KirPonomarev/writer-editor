# Pending run and paragraph formatting

TASK_ID: WORD_PENDING_FORMATTING_20260929
BASE_SHA: 253653f075833df8c7197779cbbf383622589cef
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

O: Preserve and record supported Word formatting as pending decisions through
import, authoring, history, export, changed return and Mac restart.
T: Bounded namespace-validated property revisions -> existing Core ledger ->
immutable review projection -> existing Kernel commands -> atomic scene writer.
H: The current extractor returns early without text revisions, silently losing
formatting-only pending semantics. Admit checked before/after canonical run
marks and paragraph properties; compare independently parsed Original/Current.
B: Protect text, scene identity, table/list topology, existing pending moves,
author/time provenance, no-loss working state and history. No raw XML writer.
P: Native Word counterexample, decisions, five serialization/return cycles,
actual Mac recording and persistence, independent property readback and hostile,
stale, range, boundary and topology counterexamples.
I: Exact base above, clean isolated worktree, verified encrypted T7 volume.

FEATURE_INTEGRATION_MANIFEST_V1:
productPlane: Existing Core review ledger owns before/after properties and history.
interfacePlane: Existing cards and confirmation describe formatting differences.
commands: Existing safe-create, recording, decisions, return and export commands.
queries: Existing immutable document and review projections.
events: Existing saved, applied and exported receipts.
effects: Existing atomic scene writer and governed DOCX publication adapter.
guards: Namespace, direct property owner, one previous-property set, validated
canonical marks/properties and exact paragraph/spans; existing artifact, project,
scene, lifecycle, baseline and generation checks remain required.
recovery: Existing persisted decisions, returned history and atomic backups.
bounds: Existing XML budgets, 1024 revisions, 4 MiB ledger and 128 history rounds.
performance: Reuse canonical leaf addressing and bounded segment traversal.
accessibility: Existing controls and keyboard actions, accurate property labels.

Native discovery: Word produced rPrChange for bold text and pPrChange for center
alignment. Import currently retains Current formatting but loses pending state.
Previous properties are canonicalized using the same checked style context,
then compared independently against Original. Unsupported property semantics or
ambiguous combinations must fail before publication, never become accepted.
Reference: https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.runpropertieschange

Non-claims: arbitrary Word styles, table/numbering structural revisions, mixed
annotations, unverified overlapping revision semantics or full-plan acceptance.
Rollback: revert this delivery while retaining scene envelopes and recovery.
