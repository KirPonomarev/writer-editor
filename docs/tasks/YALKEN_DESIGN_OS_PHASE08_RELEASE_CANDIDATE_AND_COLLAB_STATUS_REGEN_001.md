# YALKEN_DESIGN_OS_PHASE08_RELEASE_CANDIDATE_AND_COLLAB_STATUS_REGEN_001

## Scope
- Regenerate `RELEASE_CANDIDATE_LOCK.json` via canonical release-candidate create flow (release mode only).
- Promote `COLLAB_CAUSAL_QUEUE_READINESS.json` from `PLACEHOLDER` to contract-backed `READY`.
- Update canonical governance approvals only if the changed status artifacts require approval rebinding.

## Constraints
- No Phase 07, runtime, renderer, menu, or broad Phase 08 scope expansion.
- No promotion verify on real repo.
- No evidence-pack paths in commit scope.

## Verification Plan
- `node scripts/ops/release-candidate.mjs --create --mode=release --json`
- `node scripts/ops/release-candidate.mjs --verify --mode=release --json`
- `node scripts/ops/collab-causal-queue-readiness-state.mjs --json`
- Contract set from brief, ending with `runtime-delivery-strict.contract.test.js`.
