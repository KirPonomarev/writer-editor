# Data inputs for one fast Word C1 recipe
TYPE: OPS_WRITE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0
TASK_ID: INTEROP_DATA_RECIPES_C1_20260916
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true
STATUS: IMPLEMENTATION
DOCUMENT_CLASS: PROCESS

## Outcome
A second authored paragraph document runs through the same native C1 driver,
independent byte reader and official TEXT/ORDER admission. New compatible cases
are validated JSON inputs committed locally in Lab, without checker edits or a
new product PR. No input may supply expected output, commands, paths or PASS.
The rule is exact preservation of authored paragraph strings and their order.

Source is d9220b6b7131043068564081e1c6a15f273afeb5. The direct owner instruction
authorizes personal implementation of the audited acceleration plan. No agents,
new dependencies, product runtime features or provider-account changes.

## FEATURE_INTEGRATION_MANIFEST_V1
- featureId/version: INTEROP_DATA_C1_RECIPE / 1; existing OPS seam.
- product plane: existing product contract, command import/export, atomic save
  and fresh reopen; product source is unchanged.
- interface plane: existing CLI, derived report and Lab dashboard only.
- Commands/Queries/Events/Effects: existing export/import confirm Commands;
  verifyInterop100 Query; existing native Word/filesystem Effects; no new Event.
- product ports: existing product adapters and bounded read-only raw readers.
- Design OS ports/surfaces: none; DESIGN_TOOL_ROUTER: NOT_APPLICABLE.
- immutable projections: exact run, case-input hash, source/build/profile,
  raw files and independent per-field decisions.
- state classes: DERIVED_STATE; no authored product truth in Lab summaries.
- identity guards: clean source/main, actual Lab code and committed input bytes,
  policy, provider, observation, artifact and revision checks before publication.
- capability revalidation: preflight before provider plus final actual admission;
  arbitrary input data never selects executable code or changes preservation law.
- supported scope: TEXT/ORDER, SINGLE_SCENE, Product.C1, SOURCE_RUNTIME only;
  12..64 bounded paragraphs, no embedded line/control characters, mandatory
  Unicode/whitespace/empty-paragraph control material. Other grammar rejects.
- persistence/recovery: immutable review index plus existing atomic paired
  ledger writer; exact retry has no additional effect or unique-cell credit.
- performance/accessibility: full monotonic elapsed through fsynced report;
  early actionable errors; no UI or typing hot-path change.
- negatives: malformed/oversized/unsafe case, missing control material, altered
  source/return/native/persisted/reopened text, missing artifact, wrong case,
  stale runtime, invalidated evidence, incomplete/duplicate acceptance pair.
- current/target: existing literal readers remain immutable. This data successor
  is TARGET until delivery and fresh real execution on merged source.

## Boundaries and proof
O: Different case bytes, same unchanged checker, actual product decisions and
complete elapsed timing. Cases do not add extra unique IDs to the 1120 matrix.
T: Frozen product spec -> fixed preservation law -> committed authored input ->
native operation -> raw readback -> official consumer -> durable result.
H: Data parameters and up-front readiness remove per-case implementation work.
B: Preserve all previous recipes/artifacts, unrelated worktrees and product src.
P: Focused case-validation and coherent mutation tests; existing C4 regression;
required CI, fresh native baseline and different input; retry and readback.
I: Exact base above; declared twelve product paths and local Lab companion.

Local Lab companion includes bounded case input, existing C1 driver/CLI/runner,
one data admission adapter, its tests and applicable source requirement mappings
in the existing RTM. Lab publication remains local-only. Existing requirements
outside this slice retain review-needed status; partial applicability is explicit.

CHECK_01 executes before edits: bootstrap, source/mount/clean identity and the
external task architecture declaration/preflight. CHECK_02+ execute after edits:
focused tests, negative controls, diff/inventory, required CI and merged proof.

Rollback: revert this single product PR and the corresponding local Lab commits;
keep prior code, historical evidence and all failed diagnostics intact.
