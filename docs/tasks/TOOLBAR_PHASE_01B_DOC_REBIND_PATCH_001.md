TASK_ID: TOOLBAR_PHASE_01B_DOC_REBIND_PATCH_001
MILESTONE: TOOLBAR_PHASE_01B
TYPE: CORE
STATUS: EXECUTION_READY_AFTER_REBIND
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0
TARGET_BRANCH: main
BINDING_BASE_SHA: 97248d679bc88ee422abf970a90b3c78ad665294
DELIVERY_POLICY: COMMIT_REQUIRED_PUSH_REQUIRED_PR_REQUIRED_MERGE_REQUIRED

## MICRO_GOAL

- Закрыть ровно один `RED_DOC_DRIFT_ONLY` из `TOOLBAR_PHASE_01_CURRENT_TRUTH_REBIND_001`.
- Исправить только неправильный doc anchor про `CANONICAL_SEED_MINIMAL`.
- Не менять source truth, runtime behavior, test corpus или любой другой anchor.

## ARTIFACT

- `docs/tasks/TOOLBAR_PHASE_01B_DOC_REBIND_PATCH_001.md`
- `docs/tasks/TOOLBAR_PHASE_01_CURRENT_TRUTH_REBIND_001.md`

## ALLOWLIST

- `docs/tasks/TOOLBAR_PHASE_01B_DOC_REBIND_PATCH_001.md`
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
- любые factual docs besides the two allowlisted task basenames
- no runtime repair
- no source writes
- no anchor edits outside `CURRENT_TRUTH_ANCHOR_07`
- no silent rebase

## CONTRACT_SHAPES

- This contour is a doc-only write contour.
- Exact drift is one line only: `CURRENT_TRUTH_ANCHOR_07`.
- Minimal fix is to replace the false `FULL_LIVE_ORDER` claim with the exact current default minimal subset claim.
- All other anchors, checks, truth table schema, report fields, classification values and next-step rules remain unchanged.
- This contour does not modify source truth or runtime truth.
- This contour does not reopen Phase 01 classification; it corrects the packet text to match the already observed current truth.

## IMPLEMENTATION_STEPS

1. Create clean isolated worktree from `BINDING_BASE_SHA`.
2. Record `HEAD_SHA_BEFORE`, branch and worktree state.
3. Fetch remote and confirm remote main SHA equals `BINDING_BASE_SHA`.
4. Create `TOOLBAR_PHASE_01_CURRENT_TRUTH_REBIND_001.md` with corrected anchor 07.
5. Create `TOOLBAR_PHASE_01B_DOC_REBIND_PATCH_001.md`.
6. Run diff inspection and allowlist inspection.
7. Have two independent agent inspections confirm that only doc drift was patched and scope stayed minimal.
8. Commit, push, open PR and merge.

## CHECKS

- `CHECK_01_PRE_WORKTREE_CLEAN`: clean worktree before write
- `CHECK_02_PRE_FETCH_ORIGIN`: fetch remote
- `CHECK_03_PRE_BINDING_SHA_MATCH`: remote main equals `BINDING_BASE_SHA`
- `CHECK_04_POST_ALLOWLIST_ONLY`: only two allowlisted basenames changed
- `CHECK_05_POST_DIFF_SCOPE`: anchor 07 corrected and no other semantic drift introduced
- `CHECK_06_POST_AGENT_INSPECTION`: two independent agent reviews confirm minimal patch
- `CHECK_07_POST_DIFF_CHECK`: diff is well-formed

## STOP_CONDITION

- stop if remote main moved from `BINDING_BASE_SHA`
- stop if worktree dirty before write
- stop if any source file write becomes necessary
- stop if any file outside allowlist changes
- stop if any anchor beyond `CURRENT_TRUTH_ANCHOR_07` requires semantic change
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
- `CHANGED_BASENAMES` must contain exactly `TOOLBAR_PHASE_01B_DOC_REBIND_PATCH_001.md` and `TOOLBAR_PHASE_01_CURRENT_TRUTH_REBIND_001.md`
- basenames only in final changed file list

## FAIL_PROTOCOL

- no silent rebase
- no silent scope expansion into source or runtime layers
- report exact failed check and exact unexpected basenames
- if target branch drifted request new owner approved base SHA
- if agents detect any semantic drift outside anchor 07 stop and report it
- `NEXT_AFTER_THIS`: REISSUE_PHASE_01_CURRENT_TRUTH_REBIND_001_ON_CORRECTED_PACKET_LANGUAGE
