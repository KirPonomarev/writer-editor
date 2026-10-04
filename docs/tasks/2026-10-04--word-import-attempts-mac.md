# Mac DOCX import attempts

TASK_ID: WORD_IMPORT_ATTEMPTS_MAC_20261004
BASE: 7a8955610860dd9110a2e6bb5813fdcdb5d0e198
STATUS: IMPLEMENTATION_AND_ACCEPTANCE_PENDING

The original Mac plan P1-08 distinguishes an intentional new import from retry
of an uncertain prior attempt. After editing an imported scene, importing the
same DOCX again currently reuses the constant default request ID and correctly
fails the old receipt's integrity check. The renderer must represent the two
different user intentions without weakening that check.

## MAP

- O: explicit new import creates a separate scene and independent discussions;
  retry of the same preview publishes at most one scene and annotation set.
- T: owner Mac plan -> existing Kernel import command -> Main admitted preview
  and project lease -> Core atomic import transaction -> public scene locator.
- H: renderer omits request ID at preview and acceptance, then drops preview
  state on failure. Give each explicit preview one transient ID retained for
  retry; real UI dispatch tests should fail before the fix.
- B: preserve existing scenes, comments, assets, receipts, command capabilities,
  opaque reference context and exact-source integrity. No schema, Main/Core,
  HTML/CSS/layout, dependency or runtime network changes.
- P: actual UI lifecycle tests, command forwarding and real leased Main/Core
  transaction counterexamples; early SOURCE and PACKAGED native route before
  broad gates. Existing transaction crash/fault/media tests remain required.
- I: clean owned linked worktree, exact base above; separate frozen SOURCE and
  PACKAGED build/profile identities, Word input hashes and saved state hashes
  recorded with each observation.

CHECK_01 executes before any changes: bootstrap, current unchanged canon,
T7 UUID/encryption/unlocked/writable identity, clean branch and architecture
preflight. CHECK_02+ execute after edits. The declaration preflight passed
on the exact base with 17 admitted paths.

## Implementation boundary

Use the existing preview modal. New file-preview intent gets a UUID; recoverable
failure retains that identity and preview for Retry. Prevent duplicate dispatch,
reject stale attempt/project completions, handle chooser cancellation without an
empty preview, and do not redispatch an import after a completed transaction whose
scene navigation failed. An expired or project-stale Main preview requires a new
source selection. Cancellation cannot claim to undo an already dispatched Core
transaction. Existing Main validation remains the write boundary.

Code implementation is delegated under the repository's active orchestrator
contract. The parent owns integration, generated bundle, evidence and delivery.
No concurrent code writer touches the same files.

## Design and feature integration

FEATURE_INTEGRATION_MANIFEST_WORD_IMPORT_ATTEMPTS_V1.json records product and
interface ownership, existing ports, projections, identity guards, recovery,
security and accessibility. No new surface or runtime registry is introduced.
Lazyweb file-import/error-retry evidence and ui-craft were consulted; use the
existing labelled dialog and preserve source/loss context after recoverable
error. External screenshots do not authorize semantics or persistence.

## Proof and delivery

Focused checks execute actual renderer functions, existing command routing and
real admitted Main/Core transactions. Native checks import, edit and deliberately
import the same bytes again; cancel chooser/preview; retry a recoverable failure;
change bytes under the same filename using Word; reopen and compare persisted
scenes/discussions. Test fault injection is limited to synthetic owned profiles
with exact restoration; no shell-created native manuscript state.

Required final gates: complete RTK, complete npm-test baseline on the final CI
head, OSS policy, dependency audits, agent guardrails, all required CI checks,
diff/scope review, commit, push, PR and merge. After merge fetch exact origin/main,
verify a clean matching tree and repeat affected checks on the merged SHA.
Pre-existing baseline skips are unexecuted coverage and never acceptance.

## Current evidence and limits

PR2076 is delivered at the base above: 19 successful CI checks; postmerge
446 affected tests plus 18 supervisor tests and guardrails, clean exact tree.
This task has no runtime acceptance yet. A Core same-request replay after process
restart is not proof that an unsaved UI preview survives restart. Remaining
original Mac-plan families stay open.

Rollback: revert this integrated PR; preserve all existing project and receipt
bytes. Next step: red UI-attempt regression, then bounded implementation and
early native route.
