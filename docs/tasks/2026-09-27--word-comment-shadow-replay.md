# Word comment shadow repeat-analysis repair

Task: WORD_COMMENT_SHADOW_REPLAY_20260927
Base: ca5278966fc65170f0210056305810288e06f052
Authority: direct owner instruction to personally finish Word roundtrip fixes and normal delivery.

## Observed problem and bounded outcome

Fresh physical Word-return runs found that opening the same DOCX again could report
RTK_COMMAND_ENVELOPE_TAMPERED in the derived shadow diagnostic. Candidate placement
createdAt held the intake clock; the complete review IR digest changed, but the
storage request key did not. Canonical Apply was independently successful.

The authenticated main adapter now omits only candidate-derived placement createdAt
from the shadow projection. Parser-owned placement metadata and Word thread dates
remain unchanged. The derived storage identity includes the complete review IR
digest in both request and effect keys. Different projections cannot collide with
legacy keys or each other; existing records are neither rewritten nor deleted.
Full-record comparison still rejects actual corruption at a current key.

## MAP / architecture

O: identical authenticated comment analysis replays with zero storage writes.
T: validated return parser -> authenticated main adapter -> existing Command Kernel
-> existing atomic derived shadow storage. No canonical writer is added.
H: separating the preview clock from artifact identity and binding the entire IR
removes false tamper errors while preserving integrity rejection.
B: preserve all canonical text/comments, source dates, authority joins, existing
receipts and historical certification sets. Rollback is a normal revert PR.
P: actual-main adapter + real bridge/store tests, legacy preservation, changed IR,
corrupted stored record, existing authentication negatives; mandatory RTK/CI and
SOURCE/PACKAGED repeat intake. No new native Word edit is required to reproduce
analysis of the preserved real Word artifacts.
I: exact base above; candidate, native artifact hashes and merged SHA recorded in
external execution evidence. Runtime identities revalidated before physical use.

Product plane: derived analysis only. Interface plane: unchanged.
Commands/ports: existing cmd.rtk.reviewSession.importComments and atomic adapter.
State: DERIVED_STATE. Renderer, canonical state and project schema are unchanged.
Design tool router: NOT_APPLICABLE (no UI design or composition change).
No new dependencies, network runtime, feature surface or mutation authority.

## Acceptance and limits

- Actual main payload repeated with different preview clocks has identical IR.
- Source thread dates and parser placements retain their metadata.
- Second import returns RTK_ALREADY_ANALYZED and writes zero bytes.
- Legacy session/receipt bytes and mtimes remain unchanged.
- Different complete IR has different request/effect keys even with equal threads.
- Corrupted current stored records still fail; authentication gates remain active.
- SOURCE and PACKAGED replay preserved real Word artifacts; canonical state stays
  unchanged when cancelling the ordinary Apply confirmation.

This repair does not claim new officially accepted cells, full comment lifecycle,
all mixed tracked-change routes, five-cycle saturation or full plan completion.
