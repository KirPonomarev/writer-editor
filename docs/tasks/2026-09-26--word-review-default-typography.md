# Bound review DOCX serialization defaults

TASK_ID: WORD_REVIEW_DEFAULT_TYPOGRAPHY_20260926
BASE_SHA: 925c806e6f3240764884a93822456a182076f0cb
STATUS: TARGET_IMPLEMENTATION_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

O: a link authored in an empty Yalken scene can return from Word with a changed
label, without a false size-change conflict or a silent canonical format rewrite.
T: Core baseline -> existing review export -> explicit DOCX default size and
main-owned local export map -> authenticated return -> exact semantic comparison
-> explicit existing Apply -> unchanged guarded atomic writer.
H: Word materializes a 12pt document default for unstyled text. An export must
explicitly serialize and bind its own default rather than infer it from a return.
B: no default guessing for historical exports; no ignored explicit size, target,
style or adjacent-content change. No new writer, IPC, UI, dependency or network.
P: real writer/parser bytes, actual rich writer/readback, changed-default and
unbound negatives, real Word SOURCE/PACKAGED, full required tests/CI/exact HEAD.
I: base above; synthetic profile, returned DOCX and full graph hashes in receipts.

FEATURE_INTEGRATION_MANIFEST_V1:
featureId: review-docx-default-typography; integrationMode: EXISTING_SEAM.
productPlane: Core rich document remains canonical; serializer declares defaults.
interfacePlane: existing immutable preview and explicit Apply; no UI change.
commands: existing review export, activate preview and exact text batch Apply.
ports: existing export builder, private round store, parser and atomic writer.
stateClasses: DERIVED_STATE comparison; PROJECT_STATE only via explicit Apply.
identityGuards: authenticated local export map, project, scene, baseline, round,
source revision and queued Apply revalidation are unchanged.
fallback: old map without descriptor retains strict legacy comparison; invalid
version/extra fields/default, changed inherited or explicit size remains blocked.
recovery: descriptor is optional additive local export metadata; old readers
fail closed on an unmatched return. No canonical schema/data migration.
performance/accessibility: bounded descriptor and existing run comparison; no UI.
negativeChecks: missing/forged descriptor, changed inherited size, explicit size
precedence, changed address/style, unknown package parts and stale authority.

New review exports serialize w:docDefaults at 24 half-points (12pt) and record
schema yalken.review-docx.typography-defaults.v1 with fontSize 12pt in the local
export map. Canonical absent fontSize resolves to this declared serialization
default only for the label comparison. Explicit canonical sizes still override
it. Returned inline/inherited size must match. Apply changes the label only;
it must not add a font mark to the saved rich document. Returned bytes never
choose the baseline descriptor. This is a defined export equivalence, not a
blanket normalization of font changes or an assertion of pixel/pagination parity.

No new official accepted IDs or complete P1a acceptance follows from this repair.
