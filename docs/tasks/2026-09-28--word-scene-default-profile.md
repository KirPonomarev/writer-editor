# Canonical scene DOCX default page profile

TASK_ID: WORD_SCENE_DEFAULT_PROFILE_20260928
BASE_SHA: 670309eed3653f8247f7b9949501eebb6ec1f518
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

O: A saved scene in a project without BookProfile exports through the existing
DOCX command and opens in Word, using the existing Core default page format.
T: saved scene and bound manifest -> canonical export snapshot -> Core default
only when absent -> existing strict DOCX page binding -> atomic export port.
H: the snapshot previously forwarded null to a strict object validator. Resolve
the absent profile before building; invalid explicit profiles must still fail.
Read the original project manifest without normalization: export must neither
repair the manifest nor turn an invalid stored profile into an absent one.
B: no project writes, schema change, dependency, UI change or new authority.
P: execute the actual main snapshot function, validate A4/A5 and invalid inputs,
run affected export tests and native macOS SOURCE/PACKAGED command exports.
I: exact base above; one bounded delivery, rollback by reverting this change.

FEATURE_INTEGRATION_MANIFEST_V1: EXISTING_EXPORT_BUG_FIX.
Product plane owns BookProfile defaults; interface plane remains unchanged.
Commands, Queries, Events and Effects retain existing export semantics and ports.
Canonical-source and target revalidation remain mandatory before publication.
No new surface or mutable derived state. Native evidence retains its exact SHA.
