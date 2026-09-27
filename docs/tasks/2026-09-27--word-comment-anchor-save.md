# Ordinary scene save and canonical comment anchors

TASK_ID: WORD_COMMENT_ANCHOR_SAVE_20260927
BASE_SHA: 0e8a232c74694c82c90de3cdca0db509c21fb4fd
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

O: a safe ordinary scene edit saves text, manifest and canonical comment anchors
as one recoverable transaction; uncertain ranges refuse publication and keep the
existing authoring buffer, with an actionable existing save-status message.
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
interfacePlane: unchanged immutable review projections and existing save status.
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
accessibility: existing status surface explains failure; buffer remains available.

The renderer envelope module remains a compatibility facade with the same API;
its pure implementation now belongs to Core. Authenticated review keeps its
existing outer-journal owner and does not receive a second anchor transformation.

This is a conservative same-paragraph profile, not an edit-operation identity
tracker. Paragraph split/merge/reorder and edits intersecting the anchored range
remain refused. Existing authenticated review anchor law and wider P2 behavior
remain separate required work. This task does not close P1b/P1c or qualify Word
portability globally. Official accepted-cell delta remains zero until acceptance.
