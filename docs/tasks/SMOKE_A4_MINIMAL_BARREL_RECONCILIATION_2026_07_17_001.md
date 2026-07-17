# SMOKE_A4_MINIMAL_BARREL_RECONCILIATION_2026_07_17_001

TASK_ID: SMOKE_A4_MINIMAL_BARREL_RECONCILIATION_2026_07_17_001
TYPE: OPS_WRITE
STATUS: EXECUTED
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0
TARGET_BRANCH: main
BINDING_BASE_SHA: 3a3ea891c933b32d85f442c942667ce38b87866d
DELIVERY_POLICY: COMMIT_REQUIRED_PUSH_REQUIRED_PR_REQUIRED_MERGE_REQUIRED
OWNER_AUTHORIZATION: CLOSE_SAFE_REPOSITORY_TAILS_BEFORE_DESIGN

## MICRO_GOAL
- Reconcile the stale A4 export smoke with the later canonical minimal root contract barrel.
- Keep the smoke blocking any new root contract that is neither exported nor explicitly private.
- Make no runtime, product, design, dependency, or public contract surface change.

## ARTIFACT
- `docs/tasks/SMOKE_A4_MINIMAL_BARREL_RECONCILIATION_2026_07_17_001.md`
- `docs/OPS/STATUS/SMOKE_A4_MINIMAL_BARREL_RECONCILIATION_2026_07_17_001_STATUS.json`
- `scripts/smoke-a4.mjs`
- `test/contracts/smoke-a4-minimal-barrel.contract.test.js`
- `docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json`

## ALLOWLIST
- Exclude only `dialog-port.contract.ts`, `filesystem-port.contract.ts`, and `platform-info-port.contract.ts` from the A4 root barrel completeness scan.
- Add isolated temporary-repository coverage for the accepted private set and a rejected unexported public contract.
- Modify only the five repo artifacts listed above.

## DENYLIST
- No change to `src/contracts/index.ts`, any contract shape, runtime, UI, design, storage, dependency, capability, or product claim.
- No wildcard, directory-wide, pattern-based, or dynamically inferred export exception.
- No rebase, amend, force push, destructive stash operation, or remote branch deletion.

## CONTRACT / SHAPES
- A4 accepts the exact three contracts documented by the canonical minimal public barrel test as private to the root barrel.
- Any other `src/contracts` root file ending in `.contract.ts` must still be re-exported by `src/contracts/index.ts`.
- The accepted private set is explicit, finite, basename-bound, and covered by a positive fixture.
- The rejection path is covered by a clean committed fixture containing one unexported contract.

## IMPLEMENTATION_STEPS
1. Record the clean binding base and reproduce `MISSING_REEXPORTS` for the three intentionally private ports.
2. Add the exact private-contract set to A4 before its root contract scan.
3. Add positive and negative fixture coverage in temporary clean git repositories.
4. Run focused tests, E0, A4 after commit, governance checks, strict doctor, and OSS policy.
5. Complete commit, push, pull request, merge, and post-merge verification.

## CHECKS
- CHECK_01_PRE_BINDING: local and remote `main` equal `BINDING_BASE_SHA` before the write.
- CHECK_02_REPRODUCTION: pre-change A4 fails only with the three canonically private port contract basenames.
- CHECK_03_POST_FOCUSED: both temporary-repository contract tests pass.
- CHECK_04_NEGATIVE: a new unexported root contract still fails with `MISSING_REEXPORTS`.
- CHECK_05_POLICY: task gate, governance checks, strict doctor, current ops wave, OSS policy, and diff check pass.
- CHECK_06_A4: A4 passes from a clean committed worktree.
- CHECK_07_DELIVERY: commit, push, pull request, merge, and post-merge remote-head verification pass.

## STOP_CONDITION
- Stop if remote `main` moves from the binding base and breaks mergeability.
- Stop if the canonical minimal-public-surface contract no longer excludes exactly the three named ports.
- Stop if A4 requires a product, runtime, contract shape, dependency, UI, or design change.
- Stop if staged scope contains any file outside the five listed artifacts.

## REPORT_FORMAT
- `TASK_ID`
- `HEAD_SHA_BEFORE`
- `HEAD_SHA_AFTER`
- `COMMIT_SHA`
- `CHANGED_BASENAMES`
- `STAGED_SCOPE_MATCH`
- `COMMIT_OUTCOME`
- `PUSH_RESULT`
- `PR_RESULT`
- `MERGE_RESULT`
- `NEXT_STEP`

## FAIL_PROTOCOL
- Leave the current branch and exact failure evidence available for inspection.
- Do not widen the private-contract set to make an unknown failure green.
- Report `STOP_NOT_DONE` if any mandatory delivery or verification step remains incomplete.
