# Ordinary scene save and canonical comment anchors

TASK_ID: WORD_COMMENT_ANCHOR_SAVE_20260927
BASE_SHA: 0e8a232c74694c82c90de3cdca0db509c21fb4fd
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: APPLICABLE_LAZYWEB_FIRST

O: a safe ordinary scene edit saves text, manifest and canonical comment anchors
as one recoverable transaction; uncertain ranges refuse publication and keep the
existing authoring buffer, with a dismiss-only native warning for manual Save.
T: existing save intent and generation fence -> serialized disk queue -> shared
project lease -> Core scene/comment transform -> v4 transaction -> durable readback.
H: only unchanged ranges outside every minimal contiguous edit envelope may move;
repeated-text ambiguity must refuse rather than silently choose a matching quote.
B: preserve all comment bodies, provenance, IDs, events and other-scene threads.
No dependency, cloud, UI composition change, imported path authority or new writer.
P: Unicode/range negatives, real transaction and process-kill recovery, actual main
save and lease fencing, SOURCE/PACKAGED save/reopen/export and independent DOCX
and Word observation; existing baseline, certification and delivery gates.
I: exact base above, fixed project comment file and exact scene/manifest/state bytes.
Rollback: resolve any pending v4 journal before reverting this delivery; never
remove readable recovery artifacts or silently downgrade a pending transaction.

FEATURE_INTEGRATION_MANIFEST_V1:
featureId: word-comment-anchor-save-v1; integrationMode: EXISTING_SEAM.
productPlane: Core owns the pure document envelope and safe anchor transform.
interfacePlane: immutable review projections, existing save status and native failure dialog.
commands: existing Save/Autosave; queries: existing document/review projection.
effects: fixed scene/manifest/comment transaction and existing project lease.
stateClasses: PROJECT_STATE files; AUTHORING_WORKING_STATE unsaved text;
DERIVED_STATE projections. No project truth in transient or shell state.
identity: exact project, scene path, before bytes, revision, lease and CAS.
recovery: v4 journal recomputes the only admissible comment delta from bound scenes;
old v1-v3 formats retain their rules. Main recovery holds the same project lease.
negativeChecks: graph forgery, foreign project, link aliases, stale lease/state,
ambiguous repeats, grapheme splits, structural edits and forced process termination.
performance: bounded 8 MiB scene and 64 KiB graph; no work on each keystroke.
accessibility: manual Save failure uses a labelled native dismiss-only dialog; Return or the labelled button returns to the unchanged editor buffer. Autosave never opens repeated dialogs.

The renderer envelope module remains a compatibility facade with the same API;
its pure implementation now belongs to Core. Authenticated review keeps its
existing outer-journal owner and does not receive a second anchor transformation.

This is a conservative same-paragraph profile, not an edit-operation identity
tracker. Paragraph split/merge/reorder and edits intersecting the anchored range
remain refused. Existing authenticated review anchor law and wider P2 behavior
remain separate required work. This task does not close P1b/P1c or qualify Word
portability globally. Official accepted-cell delta remains zero until acceptance.

SURFACE_MANIFEST_V1:
surfaceId: manual-save-comment-failure; host: existing Electron dialog adapter.
projection: typed save refusal, no file paths, user payload or secret content.
interaction: one Return-to-text action; Return or a button click dismisses without product writes.
No bypass, force-save, discard or automatic reanchor action. Concurrent warnings
coalesce; background autosave only publishes its existing status signal.
Native system typography, colors and focus handling; no HTML/CSS or token changes.

Design brief: a visible, plain warning for an explicit failed Save. Native CUA
observed the existing status dock hidden in the current profile, so status-only
feedback is insufficient. Lazyweb reference screens:07e468bc06b16c5708056a06
supports explicit retained-work warnings; selected existing Agentic Search
3b3b2da6-406e-4f72-b123-73b18149fd39. No reference style or code is imported.
This remains storage-dominant Group 04 with a necessary failure-reporting effect,
not a Design OS or shell redesign. Owner's autonomous Word correction authority
covers this bounded failure path. Negative tests ensure dialog dismissal never
turns a rejected save into success or creates publication authority.
