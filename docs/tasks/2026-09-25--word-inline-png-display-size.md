# Inline PNG placement size

TASK_ID: WORD_INLINE_PNG_DISPLAY_SIZE_20260925
TYPE: CORE
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
BASE_SHA: e1f04e3502af17e0feead89a61f2e6d545132a64
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true

## MICRO_GOAL

W3: preserve positive bounded inline PNG display dimensions independently of
intrinsic pixels and content-addressed bytes. Exact integer EMU is canonical;
9525 EMU equals one CSS pixel, 12700 equals one Word point. No float size is
persisted. Legacy nodes without placement dimensions retain intrinsic size.

FEATURE_INTEGRATION_MANIFEST_V1:
- featureId: WORD_INLINE_PNG_DISPLAY_SIZE; integrationMode: EXISTING_SEAM.
- productPlane: bounded media data owns binary identity and placement values.
- interfacePlane: existing inline image consumes immutable canonical attrs.
- commandIds: existing DOCX preview, safe-create, save and DOCX export; no new write capability.
- queries: existing document projections; events: existing command completion.
- requiredProductPorts: bounded ZIP/XML/PNG, fenced W1 transaction, existing export.
- requiredDesignOsPorts: read-only image projection; no filesystem or URI access.
- stateClasses: PROJECT_STATE and AUTHORING_WORKING_STATE; derived preview is DERIVED_STATE.
- identityKeys: project/lifecycle/revision, artifact hash, asset SHA and occurrence.
- security: positive safe integers bounded by existing 8192-pixel extent limit;
  no new crop, floating, rotation, reflection, external or tracked image support.
- recovery: existing W1 atomic import and scene recovery remain unchanged.
- performance: same binary asset deduplicates across sizes; decoded and display
  area aggregate budgets remain bounded. No extra full-document scanner.
- accessibility: existing alt/title preserved; mechanical aspect-ratio correction.
- fallbacks: malformed size blocks; changed authenticated review size remains
  explicit manual residual, never silently accepted or given apply authority.
- negativeBypassChecks: partial/zero/negative/noninteger/overflow extent, transform
  mismatch, corrupt binary, forged path, review size change and stale mapping.
- evidenceBindings: exact source/profile, Python byte oracle, real Word resize,
  save/reopen and SOURCE/PACKAGED proof, ordinary CI/delivery and merged checks.
- currentReality: source audit resize is rejected; export always uses intrinsic.
- targetOnly: W4 offset correspondence and W5 table properties remain separate.

O: Word-resized inline PNG retains exact supported placement on import/re-export.
T: DOCX bytes -> bounded parser -> typed attrs -> existing command/transaction ->
canonical scene -> immutable editor -> existing exporter -> independent Word.
H: replacing intrinsic-equality restriction with bounded placement dimensions,
and comparing those dimensions against authenticated source, preserves size
without weakening asset identity or authorizing semantic review edits.
B: original documents, shared assets, old nodes, foreign WIP and frozen counts.
P: independent raw dimensions/binaries; 5 cycles, legacy, bounds, editor history,
persistence/replay; real Word edits and required baseline/CI/exact-head gates.
I: base above; exact Node22.12.0/npm10.9.0; owned synthetic documents only.

## Shape and compatibility

Optional paired displayWidthEmu/displayHeightEmu integers range 1..78028800.
Absent pair means width*9525 and height*9525. A pair equal to intrinsic size
normalizes to absence; validation never changes intrinsic pixels or PNG hash.
Tiptap undefined defaults serialize as absent. Half-defined pairs are rejected.
Responsive display may scale the rendered box to fit; canonical EMU and export
remain exact. CSS pixel observations allow only the browser's layout rounding;
OOXML wp:extent and a:ext must match exactly. Unsupported transform stays blocked.

CHECK_01_PRE: bootstrap and architecture preflight passed before edits.
CHECK_02_POST: focused negative and affected chains required.
CHECK_03_POST: native resize and independent readback required.
CHECK_04_POST: full delivery and exact merged-head verification required.
