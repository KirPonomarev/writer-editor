# Ordinary Word comments: canonical import transaction

TASK_ID: WORD_GENERIC_COMMENTS_20260927
BASE_SHA: 174752571cd161fe52a38a59be4de5529ed09672
STATUS: TARGET_IMPLEMENTATION_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

O: ordinary DOCX comments, literal bodies, direct replies, authors, dates,
resolved status and exact anchors survive new-scene import and re-export.
T: untrusted ZIP -> bounded existing parser -> main-private preview -> existing
queued import command and project lease -> Core transaction -> canonical files.
H: fresh import-operation IDs prevent Word IDs from targeting old comments;
a bounded append-only comment companion in the existing transaction journal
makes new scene, manifest, comments and receipt recover together.
B: preserve old threads/events and every unrelated file. No new writer, unsafe
fallback, dependency, runtime network, renderer authority or return authority.
P: full on-disk graph, literal Unicode/whitespace, orphan/unsupported payload,
symlink, stale CAS, interruption at publication/commit/cleanup, restart/recovery;
mandatory RTK, static certification, CI and exact merged verification.
I: exact base above; declaration checkpoint only records owned WIP, not evidence.
Rollback: revert this bounded import contour. Existing v1/v2 journals remain read.

FEATURE_INTEGRATION_MANIFEST_V1:
featureId: word-generic-comment-import; integrationMode: EXISTING_SEAM.
productPlane: Core owns canonical comment state, scenes, manifest and recovery.
interfacePlane: existing immutable import preview and existing review query.
commands: existing ordinary DOCX preview and safe-create import.
queries: existing canonical non-text review projection.
effects: existing local file reader, lease and Core transaction ports.
stateClasses: PROJECT_STATE canonical data; DERIVED_STATE private import plan.
identityGuards: exact project/lease, source bytes/private plan, local import nonce,
new scene, canonical state CAS and paragraph hash/grapheme boundaries.
fallback: unsupported comment bodies, nested replies or ambiguous anchors reject
before publication with a typed diagnostic; no silent flattening.
recovery: v3 journal binds before/after canonical comment bytes and commit witness;
foreign divergence blocks recovery before any other target is changed.
performance: bounded 128 threads, 128 direct replies, 64 KiB canonical state.
accessibility: no UI contract change in this delivery.
negativeChecks: external comment IDs are provenance only; same Word IDs imported
again receive fresh local IDs; no arbitrary replacement target or old-thread edit.

This is the import/recovery slice of P1b-G. Ordinary comment authoring controls,
full rich comment bodies, P1c return edits and complete native qualification are
still open. It does not close P1b or create official accepted cell IDs by itself.

Native-path qualification found and repaired a missing main preview field:
canonicalization must carry genericComments into the private import plan.
A second native check found that the legacy single-scene review exporter does
not include canonical comments. That path now refuses annotated scenes before
round-key creation; the full-manuscript exporter is the qualified comment route.
Single-scene comment export remains an explicit follow-up, not silent success.
