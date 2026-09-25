# Authenticated text correspondence around inline PNG

TASK_ID: WORD_MEDIA_TEXT_OFFSET_20260925
TYPE: CORE
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
BASE_SHA: 87dee08ecc5c4f19955089a6501f30a3af04156a
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true

## MICRO_GOAL

W4: bind unchanged image occurrences against Original text coordinates, while
retaining Current coordinates for the returned document. Neither projection
creates mutation authority. Existing authenticated map, paragraph identity,
review decisions, exact text writer, recovery and replay checks still apply.

FEATURE_INTEGRATION_MANIFEST_V1:
- featureId: WORD_MEDIA_TEXT_OFFSET; integrationMode: EXISTING_SEAM.
- productPlane: bounded package scanner derives correspondence; Core owns text and media.
- interfacePlane: existing immutable Review projection; no UI changes.
- commands: existing authenticated intake and exact-text Apply; no new writer.
- queries: local export map and current revision session; events: existing command completion.
- productPorts: bounded ZIP/XML/PNG, authenticated map, existing atomic persistence and recovery.
- designOsPorts: existing read-only review projection.
- stateClasses: PROJECT_STATE, AUTHORING_WORKING_STATE, DERIVED_STATE.
- identityGuards: project, round, source revision, full Original paragraph, block locator,
  occurrence order, original offset, image bytes/alt/display size, exact returned provenance.
- fallbacks: unsupported or ambiguous correspondence stays manual/blocked.
- recovery: preserve source snapshot and existing idempotency chain.
- performance: compute correspondence once per image-bearing paragraph within parser budgets.
- accessibility: unchanged; no visual surface or interaction added.
- security: no unknown untracked diff, offset heuristic, hash-first lookup or new authority.
- negativeChecks: duplicate/moved/changed image, stale/tampered map, nested revisions,
  cross-image edits, unsupported atoms, Unicode boundaries and ambiguous quotes.
- currentReality: authenticated tracked replacement moves Current offset from 7 to 14
  and fails the baseline-offset comparison despite unchanged image identity.
- targetOnly: proof must include actual Apply, recovery, replay, re-export and Word.

O: legitimate tracked text edits adjacent to a protected PNG survive review round trip.
T: bounded package -> parsed Original/Current correspondence -> authenticated local map
-> existing review decision and command revalidation -> safe writer -> durable readback.
H: reconstructing Original text and offsets, verified against the entire source
paragraph and ordered media vector, distinguishes text edits from image movement.
B: source documents, other changes/decisions, image bytes, foreign WIP and frozen counts.
P: genuine signed fixtures, adversarial controls, actual writer recovery/replay,
native Word, required baseline/CI and exact merged-head verification.
I: exact base above, Node22.12.0/npm10.9.0, owned synthetic data only.

CHECK_01_PRE: bootstrap and preflight passed on clean base before edit.
CHECK_02_POST: source correspondence and mutation authority independently tested.
CHECK_03_POST: physical profile proofs and independent raw reader required.
CHECK_04_POST: delivery and exact merged-head verification required.
