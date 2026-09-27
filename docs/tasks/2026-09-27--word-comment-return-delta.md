# Authenticated changes to exported Word comments

TASK_ID: WORD_COMMENT_RETURN_DELTA_20260927
BASE_SHA: fb4c3e15675e31321c35ddeb1e324541b292d700
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

O: Word edits to existing exported comment bodies, replies, status and same-scene
anchors become one canonical graph publication after explicit Apply; preview,
conflicts and repeated Apply do not create partial or duplicate changes.
T: authenticated local export baseline and immutable parser result -> existing
Command Kernel -> private main admission -> queue/shared project lease -> pure
Core plan -> fixed canonical comment file/recovery -> exact readback.
H: a complete, unique durable-ID correspondence plus exact baseline CAS permits
explicit deltas without granting authority to Word IDs, authors or paths.
B: preserve scene bytes, other-scene data, private notes, unrelated WIP and drafts.
Missing roots/replies or carriers are not implicit deletion. Mixed manuscript
edits and cross-scene relocation are outside this bounded slice and refuse writes.
P: independent semantic expectations, collision/loss/stale/replay/race negatives,
atomic publication faults, actual main command, real Word edits, SOURCE/PACKAGED
new-process readback and export, mandatory existing gates and full delivery.
I: exact base above, project/lifecycle/intake generation, local signed round,
returned artifact digest, current scene bytes and canonical graph revision/digest.

FEATURE_INTEGRATION_MANIFEST_V1:
featureId: word-comment-return-delta-v1; integrationMode: EXISTING_SEAM.
productPlane: Core owns the validated graph delta and replay invariants.
interfacePlane: existing immutable comment preview and explicit return Apply.
commands: existing authenticated return and comment lifecycle Command Kernel lane.
queries: existing comment projection; events: bounded committed-return receipt.
effects: existing fixed comment file and readable before snapshot atomic writer.
ports: main-owned project lease/publication; no renderer filesystem API.
stateClasses: PROJECT_STATE comment graph; AUTHORING_WORKING_STATE protected;
DERIVED_STATE parser/preview; no semantic truth in shell or transient state.
identity: only a private main admission may invoke batch publication; revalidate
project, bootstrap, lifecycle, intake generation, scene bytes and graph under lease.
fallbacks: typed no-write conflict; absent data never silently becomes deletion.
recovery: one atomic canonical file for the complete batch with verified readable
before snapshot; a publication failure cannot report partial success.
performance: bounded existing graph/scene limits, one publication, no typing work.
accessibility: existing review surface; no new UI, tokens, layout or dependency.
negativeChecks: unsigned return, duplicate/reused IDs, wrong parent/scene, missing
carrier, malformed body/provenance, concurrent local edits, stale publication,
forged admission, changed replay payload and fault before/after canonical rename.
Rollback: revert bounded code; existing v1 graph and readable before snapshot remain.
No full Word feature acceptance or new official cell is claimed by this document.
