# Atomic Word hyperlink label and target return

TASK_ID: WORD_COMBINED_LINK_RETURN_20260927
BASE_SHA: d356452ad03b3d18660f973ad5ec0fef204c4e13
STATUS: TARGET_IMPLEMENTATION_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

O: one Word edit changes both the label and HTTP(S) target of a bound link;
explicit Apply publishes both together, preserving all other canonical data.
T: authenticated local export -> independent return parser -> main-private
candidate -> queued session/key/baseline revalidation -> exact item digest ->
existing atomic rich text writer -> readable saved document and restart.
H: reject every other mark/effect, compare the original href in every affected
text node, and replace only label plus href in the existing single transaction.
B: no renderer-supplied permit, arbitrary graph replacement, new writer, target
execution, inferred identity, dependencies, foreign WIP or historical evidence.
P: actual writer full-graph, repeated label context, missing/forged/altered permit,
unsafe scheme, stale/replay/publication failure, main queued gate; real Word
SOURCE/PACKAGED and exact merged-head checks; all mandatory RTK/CI gates.
I: exact base above; synthetic profiles and raw Word gap retained separately.
Rollback: revert this one bounded delivery.

FEATURE_INTEGRATION_MANIFEST_V1:
featureId: word-combined-link-return; integrationMode: EXISTING_SEAM.
productPlane: canonical rich document and guarded transaction own truth.
interfacePlane: unchanged immutable review and existing explicit Apply.
commands: existing review export, preview activation, exact text batch Apply.
ports: existing private round store, parser, main queue and atomic publisher.
stateClasses: DERIVED_STATE analysis; PROJECT_STATE only at guarded publication.
identityGuards: project, scene, baseline, session, intake generation, active key,
exact main-owned item digest and original link target at the affected range.
fallback: absent capability/permit or unsupported effects fail without a write.
recovery: existing durable transaction journal and replay path, one publication.
performance/accessibility: no UI change; bounded existing run/range traversal.
negativeChecks: default analyzer capability remains off; only main enables it;
writer requires an options permit computed after private input revalidation.

This closes one compound operation, not all P1a or all Word qualification.
No official accepted IDs are created by a commit or a synthetic test result.
