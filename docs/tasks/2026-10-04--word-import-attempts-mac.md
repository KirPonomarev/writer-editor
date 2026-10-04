# Mac DOCX import attempts

TASK_ID: WORD_IMPORT_ATTEMPTS_MAC_20261004
BASE: 7a8955610860dd9110a2e6bb5813fdcdb5d0e198
STATUS: NATIVE_OBSERVED_FINAL_GATES_AND_DELIVERY_PENDING

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
  opaque reference context and exact-source integrity. No schema, Main/IPC,
  HTML/CSS/layout, dependency or runtime network changes. The observed graph
  serialization correction below keeps all existing byte and count limits.
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
Frozen SOURCE and PACKAGED candidate `4ddae6f1c96fc1df28b730763a0b4a0d63e5bd29`
completed native new import after scene edit, real EACCES followed by same-nonce
Retry, chooser/preview cancellation, Word-resaved same-filename input, and
persisted project reopen. Independent raw DOCX XML and saved-state observations
verify prior scene bytes and discussions and exact new comment anchors. SOURCE
finished with seven imported scenes, 42 threads and 50 messages; PACKAGED with
five scenes, 30 threads and 35 messages. SOURCE additionally saved a reply on
the compact graph and reopened it. These are bounded observations, not a whole
Mac-plan acceptance claim. A Core same-request replay after process restart is
not proof that an unsaved UI preview survives restart. Remaining families stay
open.

## Early native finding and bounded correction

On candidate `2af180d894c76aac540202523432195538e16282`, a native SOURCE
profile completed import, scene edit/save, deliberate reimport, a real filesystem
write failure followed by Retry, and chooser/preview cancellation. Retry retained
the operation nonce, recovered the pending transaction and published one scene
with six threads and seven messages. A failed transaction may retain its journal
and publish a manifest before recovery; this is not a zero-write cancellation.
Prior scene bytes and discussions remained intact.

The next native import, after Word changed the file under the same filename,
failed with `DOCX_SAFE_CREATE_COMMENTS_INVALID`. An exact-input diagnosis showed
valid preview, anchors and candidates: the existing 24-thread project graph was
63813 bytes, and the appended graph exceeded the 64 KiB limit solely because of
pretty JSON whitespace. The same graph fits when serialized compactly. Both the
unchanged and Word-edited input reproduce this project-capacity boundary.

The amended architecture declaration passed on that clean candidate before this
repair. Apply the already-existing lossless compact serialization policy
consistently across import, comment authoring, anchor save, return and recovery.
Keep the 64 KiB limit, identity validation, graph semantics, history and atomic
publication authority intact. Compact graphs still over budget must fail before
writing. No full RTK or CI baseline ran on the known failing candidate.

Evidence is bound to preserved native profiles, source DOCX hashes, raw XML and
saved-state snapshots. The failed fifth-import observation remains a failure;
the repair requires a new frozen candidate and native observation. Larger graph
capacity and a UI action to resume a prior attempt after process restart remain
separate open requirements of the original Mac plan.

The repaired native import fits the existing budget without graph loss:
PACKAGED's 30-thread saved graph is 45245 bytes, compared with 83580 bytes when
pretty-printed. The five focused comment contracts pass 132 tests with zero
failures, skips or todos. Byte and count limits remain enforced.

The first complete CI run exposed three integration omissions: a historical
surface test expected the no-argument preview dispatch; the list-publication
test's sliced VM omitted the real new attempt invalidator; and the wording
registry lacked three new import action/status labels. Repair the test harness
and current pinned qualification without changing runtime bytes or historical
registry/successor bytes. New wording records are DECLARED_ONLY, with no support,
compatibility or saturation promotion. Native evidence remains bound to the
candidate's exact runtime hashes; a later non-runtime commit requires an explicit
byte-equality observation and fresh final gates. Failed CI and the interrupted
duplicate local RTK are not passing evidence.

Rollback: revert this integrated PR; preserve all existing project and receipt
bytes. Next step: finish the focused CI integration correction, complete all
required final gates, merge and verify the exact merged SHA.
