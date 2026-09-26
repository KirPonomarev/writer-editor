# Exact Word hyperlink label context

TASK_ID: WORD_LINK_LABEL_CONTEXT_20260926
BASE_SHA: 911cb1e7151096396ef0c8a6d1e3408687f18b52
STATUS: TARGET_IMPLEMENTATION_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

O: explicit authenticated label Apply preserves heading level, exact target and
all neighboring rich content, including another occurrence of the same label.
T: native returned bytes -> parser -> authenticated local scene/export baseline
-> main-owned proposal -> existing batch Apply -> guarded Core transaction.
H: equal paragraph kind/level permits a label-only heading change. A globally
unique fully compared paragraph can disambiguate a repeated label, provided an
inner range exactly reconstructs the entire proposed paragraph replacement.
B: no fuzzy matching, ambiguous identical paragraphs, mixed semantic effects,
new IPC, key authority, parser execution, dependencies or visual design changes.
P: positive and adversarial rich-writer tests, real Word SOURCE/PACKAGED, exact
graph readback/reopen/replay, full regression/static/CI/merged-head checks.
I: base above; synthetic owned profiles and exact native artifact hashes.

FEATURE_INTEGRATION_MANIFEST_V1:
featureId: word-link-label-context; integrationMode: EXISTING_SEAM.
productPlane: Core owns the rich graph and atomic scene/manifest persistence.
interfacePlane: existing immutable text proposal and explicit Apply controls.
commands: existing review activation and applyExactTextChangesBatch.
ports: existing parser, round-key secret store, projection and persistence.
stateClasses: DERIVED_STATE proposal; PROJECT_STATE after authorized Apply.
identityGuards: project, scene, exact baseline, round/key and session generation.
capabilityRevalidation: unchanged main-private input and queued key revalidation.
fallback: reject ambiguous context, structure changes, forged ranges or stale data.
recovery: existing transactional journal, replay and rollback; one PR revert.
accessibility/performance: unchanged UI; bounded linear semantic comparison.
negativeChecks: wrong occurrence, unrelated replacement, grapheme split, changed
level/target/style, identical paragraphs, stale scene and failure before publish.

The inner range cannot supply an alternative write location: the outer quote
must still be globally unique, current and exact. Both full replacement text and
the selected original label are checked before preserving surrounding rich runs.
No complete P1a acceptance or new official interop IDs are inferred from this fix.
