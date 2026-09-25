# Recoverable DOCX create-only import

TASK_ID: WORD_IMPORT_TRANSACTION_REMEDIATION_20260925
TYPE: CORE
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
BASE_SHA: 46e050b21b472cb76e2892cc7415b58ebaf0f299
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true

## MICRO_GOAL

Close A1/A2 from the owner's Word audit: no successful import without manifest
authority; scene, owned assets and receipt participate in a recoverable commit;
restart/replay does not duplicate an import or strand it behind an existing file.
This is W1 of the approved Word remediation plan. W2-W7 remain separate slices.
Existing Word420 acceptance is historical finite-contract evidence, not proof
of this repair and not new cell credit.

## CONTRACT / SHAPES

FEATURE_INTEGRATION_MANIFEST_V1:

- featureId: WORD_IMPORT_TRANSACTION; integrationMode: EXISTING_SEAM.
- productPlane: Product Core owns canonical scene/assets/manifest and durable
  commit/recovery records. Command Kernel owns import admission and capability.
- interfacePlane: existing immutable projectTree and import result projections;
  no new surface, state manager or renderer write path.
- commandIds: cmd.project.docx.importSafeCreate; queries: existing project tree
  and import preview; events: existing successful command publication only.
- requiredProductPorts: existing main manifest authority, fenced project lease,
  Core project-transaction and durable-save filesystem adapter.
- requiredDesignOsPorts: existing read-only projections and command dispatch.
- stateClasses: PROJECT_STATE and derived result projections; no authoring text
  reset, shell mutation or silent apply.
- identityKeys: project, admitted plan, input/candidate digest, operation nonce,
  exact expected bytes, scene locator, resource digests and lease fencing.
- recovery: extend the existing project transaction's single durable journal
  for bounded create-only resources (assets and receipt). No parallel WAL.
- migrations: preserve v1 scene/manifest transaction behavior and readable old
  records. Legacy algorithmic import receipts cannot confer durable authority.
- security: validate all resource paths, budgets and byte bindings before
  journal-derived mutation; no runtime network, new dependency or private input.
- performance: bounded resources; no hashing or I/O in typing hot path.
- accessibility: existing UI unchanged; typed failures use existing projection.
- fallbacks: no authority means no import; divergent bytes retain recovery
  evidence and never authorize overwrite. No runtime test-mode escape hatch.
- negativeBypassChecks: missing authority, manifest failure, receipt ENOSPC,
  resource failure, kill/restart, stale lease/context, replay/tamper/path escape.
- evidenceBindings: exact candidate/merged SHA, real command and Core adapter
  tests, native applicable proof and official admission when runtime changes.
- currentReality: audit counterexamples reproduced on base; repair unproven.
- targetOnly: reliable commit and replay until the full required proofs pass.

O: real import command returns success only for coherent durable publication;
an interrupted operation converges or exposes readable recovery without loss.
T: admitted preview -> existing kernel/main revalidation -> fenced manifest
authority and Core transaction -> exact durable readback -> immutable result.
H: one journal binds create-only resources to the existing scene/manifest commit
point, so replay can distinguish committed, rolled-back and divergent states.
B: preserve owner checkout, other worktrees, existing scenes/shared assets,
all denominator/hops/oracles; one revert, retained evidence and old-reader support.
P: red audit regressions -> actual temporary filesystem and real authority ->
kill/restart tests -> affected chain and required delivery/exact-head checks.
I: base above; owned synthetic test roots; exact Node 22.12.0/npm 10.9.0.

## ALLOWLIST

The preflight declaration owns main import wiring, docxImportSafeCreate,
project-transaction-v1, affected tests, this task and mandatory admission pins.
Renderer, dependencies, Google routes and unrelated cleanup are outside W1.

## Implementation and proof boundaries

The runtime now requires the real manifest authority and holds one fenced lease
through recovery, creation and replay. Core journal/commit v2 adds at most 129
create-only companions (20 MiB total: existing 16 MiB media budget plus receipt),
while v1 transactions retain their original format and behavior. Complete
companion bytes publish with exclusive links; the journal binds staging names
and retains the staging inode witness until commit or rollback cleanup. Equal
bytes in a foreign file never grant deletion ownership, even after a create race. Unknown bytes, symlinks and foreign existing targets fail
closed. Parent directories are synced and commit/readback precede ACK.

Receipt v3 is a transaction companion. Its own fields never prove the commit:
replay separately verifies commit metadata, scene bytes, all owned companion
hashes and anchored manifest continuation. Existing shared assets are validated
and excluded from create/rollback ownership. A legacy v2 receipt or unresolved
flow-batch marker produces typed recovery without deleting data. Even a benign
manual timestamp/line-ending rewrite requires reconciliation because the exact
durable commit no longer matches; text equality alone is insufficient.

The obsolete independent flow-batch callback no longer controls this path.
Its former failure cases are tested at actual resource/manifest I/O boundaries.
Direct semantic test fixtures use real temporary authority/storage. The required
GENERIC01 graph includes the new real-command regressions and child-process
kill/recovery suite; these are executed tests, not new accepted interop cells.

CHECK_01_PRE: original clean-base bootstrap and architecture preflight completed
before writes. CHECK_02_POST: audit regressions, real authority, shared/new media,
receipt open/write/sync/link and cleanup failures, stale context/lease, concurrent
requests and fresh-process main-command replay. Core subprocess tests cover eight
killpoints plus divergent bytes, path escape, duplicate paths and resource caps.
CHECK_03_POST: inventory, baseline, RTK, security/dependency and delivery gates.
CHECK_04_POST: applicable native import/reopen/export proof and exact merged-head
verification. W1 remains unaccepted until these final gates complete.

Existing lockfile dependencies were installed unchanged using exact Node/npm and
an isolated temporary npm cache after the host cache was unavailable. No new
dependency or runtime network was introduced. The new source-bound evidence must
not inherit historical Word420 credit; fresh final aggregate remains W7.

The broad baseline exposed an existing doctor static check for guardedHandle on
ui:command-bridge, while the base already uses guardedProtocolHandle. This is a
known failed gate, not a product regression or a waived check; it requires a
bounded same-contour verification repair before delivery. Initial diagnostic
baseline: 2055 passed, 1 failed, 59 pre-existing declared skips. Focused final
transaction/crash proof: 43 passed, 0 skipped; reference command chain: 10 passed.

The same-contour gate repair was declared at clean local checkpoint a306e176 and
passed its preflight before editing doctor. The evaluator now recognizes the
existing guarded protocol adapter and requires the envelope rejection check;
mutants remove each guard independently. Both focused doctor tests pass.
No gate is disabled and the product IPC surface itself remains unchanged.
