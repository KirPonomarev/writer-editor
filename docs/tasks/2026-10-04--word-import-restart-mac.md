# Mac accepted DOCX import recovery

TASK_ID: WORD_IMPORT_RESTART_MAC_20261004
BASE: 0aaa14140e32e6e6981ed14dd0a71da89e1da959
STATUS: IMPLEMENTATION_AND_NATIVE_ACCEPTANCE_PENDING

Original Mac plan P1-08 explicitly requires timeout, crash, restart, changed
same-filename bytes, cancellation and no duplicated scenes, annotations or
assets in SOURCE and PACKAGED. PR2077 delivered current-session retry/new-import
identity and lossless compact graph persistence. This packet supplies the
missing persisted user recovery path; it does not claim the whole Mac plan.

## MAP

- O: after restart, explicitly resume the accepted import through fresh source
  selection; recover coherent before/after and publish one operation identity.
- T: owner P1-08 -> existing Kernel/Main import route -> fresh native source
  and opaque parser admission -> existing leased Core import/receipt writer.
  Core owns the bounded correlation schema; the existing adapter owns I/O.
- H: transient request identity disappears while the durable receipt remains.
  Persist accepted correlation before transaction preparation and clear only
  after independently validated opening and durable continuity. Move pending
  transaction recovery ahead of startup manifest reconciliation/publication.
- B: preserve existing scenes/comments/media, receipts, unsaved authoring,
  source validation, lease, CAS, capability and lifecycle/generation checks.
  No renderer filesystem authority, new IPC, preload, dependency, HTML/CSS,
  runtime network, generic writer, automatic import or destructive migration.
- P: actual adapter/command/startup/UI tests plus independent persisted graph
  observations in native SOURCE/PACKAGED before broad final gates.
- I: exact base above, isolated existing worktree, separate frozen build/profile,
  input hashes, receipt IDs and prior protected-state hashes.

CHECK_01 preceded repository file edits: clean merged base, verified T7 storage,
bootstrap, unchanged previously read canon, architecture declaration/preflight.
CHECK_02+ execute after implementation. Two code agents own disjoint files;
parent owns docs/OPS, generated bundle, review, proof and delivery.

## Finite behavior contract

1. Persist only a newly accepted attempt under the existing project lease.
   Record is bounded closed-schema correlation, never plan/path/write authority.
2. Cancel and New without acceptance retain the prior accepted attempt. A newly
   accepted operation replaces it deliberately; stale acknowledgement cannot.
3. Resume uses the existing native chooser and production parser to obtain fresh
   opaque admission. Same input and nonce replay the same verified result;
   changed bytes reject the old binding and require deliberate new import.
4. Main validates the actual current project, receipt locator, editor identity
   and content, lifecycle/generation and successful continuity persistence
   before leased exact-record compare-and-clear. Renderer success flags do not
   authorize clearing. Failed open/ACK remains visibly resumable.
5. Selected-project transaction recovery precedes tree identity reconciliation,
   Stage10 startup and both autosave and last-scene publication. No startup
   auto-import or silent promotion of a partial tree into the manifest.
6. Before-commit interruption recovers coherent before; committed-before-ACK
   interruption recovers coherent after. Protected foreign scenes, comments,
   assets and history remain intact. Each resume creates at most one result.
7. Reject malformed, oversized, forged, symlinked or stale record/context/receipt
   combinations. Preserve existing byte/count/security boundaries.

The interface reuses native Resume/New/Cancel and the current import preview.
Lazyweb recovery search gave adjacent import-modal examples with weak coverage,
not evidence of a recovery flow. Existing ui-craft focus/keyboard/cancel patterns
apply; no new layout or visual zone. Feature ownership is recorded in
FEATURE_INTEGRATION_MANIFEST_WORD_IMPORT_RESTART_V1.json.

## Proof and delivery

Start with failing actual-path focused cases. Controlled child-process failures
cover durable record before journal, partial transaction before commit, and
committed receipt before response. Independently compare before/after and all
protected scene/comment/media identities and bytes. Test changed bytes, stale
project, duplicate resume, cancelled preview, edited old result and stale ACK.

Early native SOURCE and PACKAGED exercise real permission failure then restart
and resume; a committed import with failed continuity must retain recovery.
Use only disposable owned profiles; restore exact filesystem modes/flags in
finally. Actual Word-saved DOCX bytes and native-created project state are the
oracles' inputs. A filesystem error/restart is not claimed as a native process
kill at a precise commit boundary; controlled crash proof is separately executed.

Only after the native path is stable run complete RTK, exact-head CI full
baseline, OSS/dependency audits, guardrails and scope review. Commit, push, PR,
merge and clean exact merged verification are required. Skips, synthetic success,
prior-head evidence and typed refusal do not prove positive interoperability.
Rollback is one PR revert; retain all canonical project and receipt data.
Persisted correlation is inert for old readers. Whole-plan remaining features,
larger comment capacity and final cross-family acceptance remain open.

## Early candidate checkpoint

Core/adapter focused: 27 passed, zero failures/skips/todo. Controlled process
interruptions used plain DOCX; rich native graph restart proof remains pending.
Main/renderer focused: 62 passed, zero failures/skips/todo, including actual
parser/adapter/renderer-composer acknowledgement, rejected changed live data,
request identity and guarded recovery filesystem publications. The composer
case was first observed red before its narrow acknowledgement fix.

The runtime is frozen for early native testing. Two existing VM harnesses need
closure dependencies for the same Main route; they remain unchanged until a
clean checkpoint and extended preflight. A mistaken post-write PRE rerun was
rejected for our own dirty implementation; it is not counted as valid preflight
or acceptance. Initial CHECK_01 remains recorded on the clean original base.
No full RTK/CI/native acceptance or delivery is claimed at this checkpoint.
