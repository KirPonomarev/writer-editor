# DOCX import diagnostics and visible loss details

TASK_ID: WORD_IMPORT_LOSS_DIAGNOSTICS_20260925
TYPE: CORE
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
BASE_SHA: 1c965edc894dcd07a6338f301051b030c1d14d3b
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true

## MICRO_GOAL

W2 of the owner-approved Word remediation plan: preserve distinctions between
unsupported features, invalid media/XML, security rejection, resource limits
and internal failures. Expose specific table width, shading and border losses
before confirmation, persist the same report, and replay it without loss.
W3/W5 fidelity remains separate; warnings never mean those properties survive.
This repair earns zero interop IDs until independent official acceptance.

## CONTRACT / SHAPES

FEATURE_INTEGRATION_MANIFEST_V1:
- featureId: WORD_IMPORT_LOSS_DIAGNOSTICS; integrationMode: EXISTING_SEAM.
- productPlane: existing bounded DOCX parser owns diagnostics; main owns preview
  admission; W1 Core transaction owns immutable receipt and project mutation.
- interfacePlane: existing DOCX confirmation modal consumes bounded projections.
- commandIds: cmd.project.import.docx.v1 and cmd.project.docx.importSafeCreate.
- queries: existing import preview; events: existing command completion.
- requiredProductPorts: existing ZIP/XML reader, main admission and fenced Core
  transaction; no new I/O adapter, runtime registry or mutation authority.
- requiredDesignOsPorts: existing projection and command dispatch only.
- stateClasses: DERIVED_STATE for preview, PROJECT_STATE for durable receipt.
- identityKeys: artifact digest, admitted preview hash, project/lifecycle,
  operation identity; final publication retains all existing revalidation.
- security: finite diagnostic codes; bounded allowlisted property descriptions;
  no raw exception, XML or host path in public internal-error messages.
- recovery: W1 transaction unchanged, full loss report survives same-op replay.
- performance: table losses collected in the existing namespace-resolved pass.
- accessibility: existing labelled readonly text area, keyboard scrolling,
  plain text only; no new tokens, stylesheet or product visual language.
- fallbacks: malformed/unsafe/unsupported/over-budget input stays blocked;
  bounded report explicitly announces omitted details instead of silent success.
- negativeBypassChecks: corrupt PNG/ZIP/XML, external relationships, unsupported
  drawings, limits, unknown exception, forged metadata, cancel/no mutation.
- evidenceBindings: exact source/merged SHA, regression tests, native proof,
  ordinary delivery gates; historical Word420 is not current evidence.
- currentReality: seven of eight initial regression cases fail on base; default
  table remains a passing control. No fixture is substituted for physical proof.
- targetOnly: loss visibility is not table-property or resized-image fidelity.

O: a user sees the actual property change before import and the saved receipt
retains it; fatal errors name the correct bounded category.
T: untrusted DOCX -> bounded parsing -> main canonical projection/admission ->
explicit confirmation -> W1 transaction -> immutable receipt/result.
H: the current catch conflates semantic failures with malformed XML, the table
reader drops properties, and the modal reduces warnings to counts. Keeping
bounded facts through these existing seams makes each audit case observable.
B: original DOCX, existing scenes/assets, foreign WIP, frozen denominator and
mandatory independent gates remain protected. Rollback is one W2 revert.
P: independent ZIP mutations and real-authority receipt/replay; affected chain,
required baseline/CI, native proof and exact merged-head verification.
I: base above; isolated task checkout, synthetic fixtures; Node 22.12.0/npm10.9.0.

## ALLOWLIST

Preflight declaration covers existing parser/media/table modules, main canonical
projection, existing modal/controller, tests and mandatory admission bindings.
No new dependency, runtime network, Google path or stylesheet changes.

## Existing-surface brief

Audience: writer importing a DOCX. Decision: accept a specific documented loss
or cancel. Baseline: the approved existing confirmation dialog and its current
modal textarea component. Lazyweb exact search returned unrelated matches;
none was adopted. UI-craft and brain:refs applied; no redesign is required.
A readonly labelled scrolling report must expose all bounded warnings as text.
No HTML interpretation, clipped fixed count or new confirmation flow.

CHECK_01_PRE: bootstrap and architecture preflight passed before changes.
CHECK_02_POST: focused negative and persistence tests required.
CHECK_03_POST: required baseline, RTK and delivery checks required.
CHECK_04_POST: native and exact merged-head proof required before closure.

The standard renderer build also updates tracked editor.bundle.js. The initial
scope omitted this generated artifact; it was added explicitly and the updated
declaration passed preflight against the same clean exact base before further
writes. The implementation checkout's owned WIP was preserved. No unrelated
bundle or stylesheet change is authorized. Source and generated bundle are
sealed together; the finite exception vocabulary lives inside the existing
DOCX preview contract, not a new runtime ReasonRegistry or authority service.
