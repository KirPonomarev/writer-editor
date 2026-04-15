TASK_ID: TOOLBAR_PHASE_01D_BASE_REBIND_PATCH_001
MILESTONE: TOOLBAR_PHASE_01D
TYPE: CORE
STATUS: EXECUTION_READY_AFTER_REBIND
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0
TARGET_BRANCH: main
BINDING_BASE_SHA: 89ddbf8b418b9e6280d63e3e841cd8d452203c8a
DELIVERY_POLICY: COMMIT_REQUIRED_PUSH_REQUIRED_PR_REQUIRED_MERGE_REQUIRED

## MICRO_GOAL

- Remove stale static base logic from `TOOLBAR_PHASE_01_CURRENT_TRUTH_REBIND_001`.
- Rebind Phase 01 so it can honestly execute on live `origin/main` after merged doc-only corrections.
- Add one explicit guard that 00A carrier basis to live selected base delta is docs-only or empty.
- Keep source truth, runtime behavior, focused tests and current truth anchors unchanged.

## ARTIFACT

- `docs/tasks/TOOLBAR_PHASE_01D_BASE_REBIND_PATCH_001.md`
- `docs/tasks/TOOLBAR_PHASE_01_CURRENT_TRUTH_REBIND_001.md`

## ALLOWLIST

- `docs/tasks/TOOLBAR_PHASE_01D_BASE_REBIND_PATCH_001.md`
- `docs/tasks/TOOLBAR_PHASE_01_CURRENT_TRUTH_REBIND_001.md`

## DENYLIST

- `src/renderer/toolbar/toolbarFunctionCatalog.mjs`
- `src/renderer/toolbar/toolbarProfileState.mjs`
- `src/renderer/toolbar/toolbarRuntimeProjection.mjs`
- `src/renderer/index.html`
- `src/renderer/editor.js`
- любые test basenames
- любые dependency files
- любые status artifacts
- любые factual docs beyond the two allowlisted task basenames
- no runtime repair
- no source writes
- no anchor edits
- no silent rebase

## CONTRACT_SHAPES

- This contour is a doc-only write contour.
- Exact fix scope is stale base-binding logic only.
- `SELECTED_BASE_SHA` and `BINDING_BASE_SHA` become `CAPTURE_AT_ACTUAL_START`.
- Phase 01 entry logic changes from static same-base equality to live-base capture plus docs-only-or-empty toolbar delta since 00A basis.
- Current truth anchors remain semantically unchanged.
- This contour does not modify source truth or runtime truth.

## IMPLEMENTATION_STEPS

1. Create clean isolated worktree from `BINDING_BASE_SHA`.
2. Record `HEAD_SHA_BEFORE`, branch and worktree state.
3. Fetch remote and confirm remote main equals `BINDING_BASE_SHA`.
4. Patch `TOOLBAR_PHASE_01_CURRENT_TRUTH_REBIND_001.md` only for stale base-binding logic.
5. Create `TOOLBAR_PHASE_01D_BASE_REBIND_PATCH_001.md`.
6. Run diff inspection and allowlist inspection.
7. Have two independent agent inspections confirm exact patch scope and no semantic drift in anchors.
8. Commit, push, open PR and merge.

## CHECKS

- `CHECK_01_PRE_WORKTREE_CLEAN`: clean worktree before write
- `CHECK_02_PRE_FETCH_ORIGIN`: fetch remote
- `CHECK_03_PRE_BINDING_SHA_MATCH`: remote main equals `BINDING_BASE_SHA`
- `CHECK_04_POST_ALLOWLIST_ONLY`: only two allowlisted basenames changed
- `CHECK_05_POST_DIFF_SCOPE`: base-binding logic patched and anchor semantics preserved
- `CHECK_06_POST_AGENT_INSPECTION`: two independent agent reviews confirm minimal patch
- `CHECK_07_POST_DIFF_CHECK`: diff is well-formed

## STOP_CONDITION

- stop if remote main moved from `BINDING_BASE_SHA`
- stop if worktree dirty before write
- stop if any source file write becomes necessary
- stop if any file outside allowlist changes
- stop if any anchor requires semantic change
- stop if commit, push, PR or merge fails

STOP_STATUS: STOP_NOT_DONE

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

Rules:

- final result without `COMMIT_SHA` is not done
- final result with incomplete delivery chain is not done
- `CHANGED_BASENAMES` must contain exactly `TOOLBAR_PHASE_01D_BASE_REBIND_PATCH_001.md` and `TOOLBAR_PHASE_01_CURRENT_TRUTH_REBIND_001.md`
- basenames only in final changed file list

## FAIL_PROTOCOL

- no silent rebase
- no silent scope expansion into source or runtime layers
- report exact failed check and exact unexpected basenames
- if target branch drifted request new owner approved base SHA
- if agents detect semantic drift beyond base-binding logic stop and report it
- `NEXT_AFTER_THIS`: REISSUE_TOOLBAR_PHASE_01_CURRENT_TRUTH_REBIND_001_ON_LIVE_BASE
