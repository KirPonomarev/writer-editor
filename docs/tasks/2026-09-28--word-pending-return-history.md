# Authenticated pending revision return and round history

TASK_ID: WORD_PENDING_RETURN_HISTORY_20260928
BASE_SHA: 7028a80efd2a30e4365a48bd8cae8a1566675d01
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: APPLICABLE_LAZYWEB_FIRST

O: Return a Word-edited review document to its original scene, restart, undo the
whole return and redo it without losing previous pending revisions or decisions.
T: bounded DOCX parser -> main-owned authenticated round and paragraph map ->
Core review history plan -> explicit confirmation -> Kernel revalidation ->
existing atomic scene transaction -> immutable Review and native DOCX export.
H: bounded nonrecursive round frames supplement existing compact decision vectors;
one scene envelope keeps text, revision source and both kinds of history atomic.
B: preserve old schema, unrelated scenes, comments, notes and unsaved authoring.
Mixed live annotations and unsupported structures fail before any write. Local
baseline changes are explicit conflicts; imported IDs never choose a target.
P: actual handler and Kernel negatives, history/replay/budget tests, native SOURCE
and PACKAGED return/reopen/undo/redo/export, independent whole-graph and XML checks.
I: exact base above; verified encrypted T7; one bounded delivery and rollback.

FEATURE_INTEGRATION_MANIFEST_V1:
productPlane: scene-owned pending source, decision vectors and prior-round frames.
interfacePlane: existing Review host and native Word return confirmation.
commands: existing pending-revision command with main-private authenticated admission.
queries: existing immutable project/scene/revision-bound Review query.
events: committed scene publication; never an independent write authorization.
effects: existing authenticated DOCX intake and ProjectTransaction/export ports.
guards: artifact hash, local round capsule, complete paragraph mapping, project,
lifecycle, scene bytes, editor generation and drafts; repeat before publication.
fallback: no write on unsupported content, stale baseline, cancellation or replay.
recovery: text and full review history share existing atomic journal and rollback.
performance: total ledger remains bounded; frames cannot recursively embed history.

SURFACE_MANIFEST_V1:
surface: existing Review host and native return confirmation.
content: complete bounded before/after semantics and revision author/date; safe Cancel.
accessibility: native keyboard dialog and existing labeled Review buttons.
design: reuse existing tokens and composition. Lazyweb search
2e25d201-85bc-4894-b81e-2c37adcb0ec5 found no exact applicable reference; no
external reference is claimed as an interaction oracle. UI Craft applied.

Non-claims: new recording in the main editor, mixed annotation undo, multi-scene
structural return and full P2a/P5 acceptance remain open. Revert this delivery to
roll back code; preserve all canonical scene and recovery data.
