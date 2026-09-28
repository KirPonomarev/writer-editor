# Durable pending text revisions

TASK_ID: WORD_PENDING_TEXT_REVISIONS_20260928
BASE_SHA: d75235e7c8b4e93fe8dfef0c08ee500f2bfb5b45
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: APPLICABLE_LAZYWEB_FIRST

O: Native Word insert/delete/replacement survives generic import, decisions,
restart and pending export, with independently checked Original and Current.
T: bounded namespace-aware Word XML -> Core review ledger -> canonical scene
with checked materialized Current -> Kernel decision -> existing atomic project
transaction including annotation rebases -> immutable Review query and DOCX.
H: putting the ledger in the scene envelope gives one existing recovery boundary
for both revision state and text; no separate revision file can lag its scene.
B: preserve unrelated scenes, comments, notes and all owner work. Read-only review
editor prevents ordinary edits from silently invalidating the ledger. New Yalken
recording remains an explicit next plan delivery, not a claim of this slice.
P: model/package/runtime negative tests, native SOURCE and PACKAGED Word cycles,
independent literal XML oracle, required CI and exact merged verification.
I: exact base above; verified encrypted T7 worktree; native macOS only.

FEATURE_INTEGRATION_MANIFEST_V1:
featureId: WORD_PENDING_TEXT_REVISIONS; integrationMode: EXISTING_SEAMS.
productPlane: source paragraphs, local revision identity, decisions and history.
interfacePlane: existing Review host, Original/Current text and decision intents.
commands: cmd.project.review.decidePendingRevision; accept/reject one replacement
or all pending revisions; undo/redo durable decisions.
queries: existing Review query, immutable scene-bound pending projection.
events: committed scene reload; event visibility never grants mutation authority.
effects: existing safe-create, ProjectTransaction, DOCX ports; no new IPC channel.
guards: project/scene/lifecycle, saved editor equality, generation and file CAS
revalidated under project lease before publication. Native IDs never route writes.
fallback: unsupported grammar and stale state reject explicitly, preserving input.
performance: 1024 revisions, 10000 paragraphs, 128 history snapshots, 4MiB ledger.
recovery: existing scene/manifest/comments/notes transaction and readable snapshots.

SURFACE_MANIFEST_V1:
surfaceId: EXISTING_REVIEW_PENDING_REVISIONS.
source: immutable Core projection, escaped author/text metadata.
intent: explicit single/group/all decisions and undo/redo via Command Kernel.
composition: existing Review panel classes, named keyboard-accessible buttons.
referenceEvidence: Lazyweb document tracked-changes accept/reject search returned
adjacent Butterdocs249875, PandaDoc246548 and Dropbox241405 only; no claim of an
exact tracked-changes reference. Reuse established Yalken Review interaction.
rollback: one delivery revert, preserving canonical scenes and recovery data.
