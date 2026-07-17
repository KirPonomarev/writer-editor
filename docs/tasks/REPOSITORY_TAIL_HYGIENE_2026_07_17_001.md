# REPOSITORY_TAIL_HYGIENE_2026_07_17_001

TASK_ID: REPOSITORY_TAIL_HYGIENE_2026_07_17_001
TYPE: OPS_WRITE
STATUS: EXECUTED
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0
TARGET_BRANCH: main
BINDING_BASE_SHA: e314a591f4d1a033113a3c4e6046c5b3def1ed0c
DELIVERY_POLICY: COMMIT_REQUIRED_PUSH_REQUIRED_PR_REQUIRED_MERGE_REQUIRED
OWNER_AUTHORIZATION: ORGANIZE_REPOSITORY_TAILS_BEFORE_NEXT_DESIGN_CONTOUR

## MICRO_GOAL
- Preserve every dirty local tail through a named, recoverable stash before retiring obsolete worktrees.
- Restore one trustworthy local `main` aligned to the binding base without discarding the divergent historical lineage.
- Triage stale open pull requests conservatively and close only those proven obsolete or superseded.
- Deliver one machine-readable hygiene ledger without changing runtime, product truth, or design behavior.

## ARTIFACT
- `docs/tasks/REPOSITORY_TAIL_HYGIENE_2026_07_17_001.md`
- `docs/OPS/STATUS/REPOSITORY_TAIL_HYGIENE_2026_07_17_001_STATUS.json`
- `scripts/ops-gate.mjs`
- `test/contracts/ops-gate-core-purity-exception.contract.test.js`
- `docs/ARCH_DIFF_LOG.md`
- `docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json`

## ALLOWLIST
- Create named recovery stashes with tracked and untracked changes for each dirty worktree.
- Verify every created stash by identity, parent commit, changed-file count, and retained diff statistics.
- Remove an obsolete worktree only after its dirty state is captured and the worktree is clean.
- Rename the divergent local `main` to a dated archive branch and recreate local `main` from the binding remote head.
- Close a stale pull request only when its disposition and reason are recorded in the status artifact.
- Delete local branches only when they are merged into current remote `main`, are not checked out, and are not named archive branches.
- Reconcile the stale E0 core-purity red only for the existing evidence-bound `path-boundary.js` module and the three exact deterministic scene admission hash imports.
- Modify only the six repo artifacts listed above.

## DENYLIST
- No `git reset`, `git checkout`, `git clean`, rebase, amend, force push, or destructive stash operation.
- No stash drop, stash clear, archive branch deletion, remote branch deletion, or untracked-file deletion outside a verified stash.
- No closing an ambiguous pull request whose unique work may still be relevant.
- No runtime, UI, CSS, HTML, JavaScript, test, dependency, canon, context, handoff, or product-claim change.
- No import of historical toolbar CSS experiments into current `main` during this contour.
- No modification of the clean running application worktree.
- No broad core-purity bypass, directory allowlist, wildcard exception, or acceptance of `console`, clock, random, Electron, arbitrary process, or arbitrary Node module effects in core.

## CONTRACT / SHAPES
- Every dirty worktree receives one stash message prefixed with `HYGIENE_2026_07_17` and a stable short label.
- A worktree may be retired only when `git status --porcelain` is empty after the stash and the stash object resolves.
- The divergent root branch is retained as `archive-local-main-20260717` before a new local `main` is created.
- Toolbar grid experiments remain recovery-only inputs for the next owner-selected design contour.
- E0 may accept effect-token lines in `path-boundary.js` only when the closed `X71` evidence resolves and every detected token matches the narrow path, filesystem, or current-working-directory contract.
- E0 may accept `node:crypto` only as the exact `createHash` import in the three named scene admission modules.
- The status artifact records binding SHA, before and after counts, stash identities, retired worktrees, retained worktrees, pull-request dispositions, branch cleanup, and rollback instructions.
- This contour creates no new runtime truth and opens no design contour by implication.

## IMPLEMENTATION_STEPS
1. Capture the initial E0 stale-red, reconcile it through one evidence-bound exception, and prove both accepted and rejected core-effect cases.
2. Run all remaining pre-checks against the clean hygiene worktree and capture the complete worktree, branch, stash, and pull-request inventory.
3. Create and verify named recovery stashes for every dirty worktree, including the two toolbar CSS experiments.
4. Retire only verified clean obsolete worktrees while retaining the current application worktree and the hygiene worktree.
5. Preserve the divergent root lineage under the archive branch name and recreate local `main` at the current remote head.
6. Classify open pull requests using merge state, patch equivalence, current canon, and later merged replacements; close only proven stale entries.
7. Prune only safe merged local branches, write the status artifact, run post-checks, and complete commit, push, pull request, and merge.

## CHECKS
- CHECK_01_PRE_BINDING: `git rev-parse HEAD` equals `BINDING_BASE_SHA`, only the task artifact is untracked, and remote `main` still equals the binding SHA.
- CHECK_02_PRE_E0_STALE_RED: initial E0 fails only on the already evidence-bound `path-boundary.js` effect token and the failure is recorded before the gate reconciliation.
- CHECK_03_PRE_INVENTORY: all worktrees, dirty files, local branches, stashes, and open pull requests are captured before retirement.
- CHECK_04_POST_E0: E0 passes, the focused gate contract passes, and an unapproved core effect still fails with `CORE_PURITY_VIOLATION`.
- CHECK_05_POST_RECOVERY: every initial dirty worktree has a resolvable named stash and no dirty state was removed without recovery evidence.
- CHECK_06_POST_WORKTREES: retained worktrees are intentional and every retired worktree is listed in the status artifact.
- CHECK_07_POST_MAIN: local `main` equals remote `main` and the divergent predecessor resolves through the archive branch.
- CHECK_08_POST_PR_TRIAGE: every initially open pull request is either retained with a reason or closed with a reason.
- CHECK_09_POST_REPO: `git diff --check`, status-schema parse, targeted policy checks, and clean staged scope pass.
- CHECK_10_POST_DELIVERY: commit, push, pull request, merge, and post-merge remote-head verification pass.

## STOP_CONDITION
- Stop if the binding remote head changes before delivery in a way that breaks mergeability.
- Stop if any dirty worktree cannot be captured in a resolvable recovery stash.
- Stop if a worktree contains an active process or owner-signalled work that cannot be retired safely.
- Stop rather than closing any pull request with unresolved unique product work.
- Stop if staged scope includes any basename other than the task and status artifacts.

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
- `WORKTREE_RESULT`
- `STASH_RESULT`
- `OPEN_PR_RESULT`
- `NEXT_STEP`

## FAIL_PROTOCOL
- Preserve all created stashes and archive refs.
- Do not remove additional worktrees or close additional pull requests after the first failed safety check.
- Record the exact failing check and leave the hygiene branch available for inspection.
- Report `STOP_NOT_DONE` when any mandatory delivery or recovery condition remains incomplete.
