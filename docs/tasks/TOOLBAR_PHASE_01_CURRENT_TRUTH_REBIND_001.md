TASK_ID: TOOLBAR_PHASE_01_CURRENT_TRUTH_REBIND_001
MILESTONE: TOOLBAR_PHASE_01
TYPE: OPS_REPORT
STATUS: EXECUTION_READY_AFTER_REBIND
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0
TARGET_BRANCH: main
SELECTED_BASE_SHA: CAPTURE_AT_ACTUAL_START
BINDING_BASE_SHA: CAPTURE_AT_ACTUAL_START
VERIFIED_AT_UTC: CAPTURE_AT_ACTUAL_START
DELIVERY_POLICY: COMMIT_NOT_REQUIRED_BY_TASK_POLICY_PUSH_NOT_REQUIRED_BY_TASK_POLICY_PR_NOT_REQUIRED_BY_TASK_POLICY_MERGE_NOT_REQUIRED_BY_TASK_POLICY

## MICRO_GOAL

- Честно заякорить current toolbar truth на live verified base без runtime repair и без forward migration.
- Сверить packet language с живым source truth и focused truth test set.
- Подтвердить, что между carrier-green basis `TOOLBAR_PHASE_00A_BASE_REBIND_AND_VERIFY_001` и live selected base не появилось toolbar source drift.
- Классифицировать результат как `GREEN_CURRENT_TRUTH_ALIGNED`, `RED_DOC_DRIFT_ONLY`, `RED_SOURCE_TRUTH_DRIFT`, `RED_RUNTIME_REPAIR_REQUIRED` или `BLOCKED_ENV`.

## ARTIFACT

- `docs/tasks/TOOLBAR_PHASE_01_CURRENT_TRUTH_REBIND_001.md`

## ALLOWLIST

- `docs/tasks/TOOLBAR_PHASE_01_CURRENT_TRUTH_REBIND_001.md`

## DENYLIST

- любые source writes
- любые runtime repairs
- любые forward migrations
- любые visual return works
- любые storage changes beyond profile state
- любые dependency changes
- любой silent rebase

### DO_NOT_BREAK_SET

- CURRENT_17_ITEM_LIVE_TRUTH
- CURRENT_3_BLOCKED_IDS_AND_BLOCKED_REASONS
- MASTER_VISIBLE_IN_CONFIGURATOR_FLOW
- ORDERING_ALREADY_REALIZED_IN_RUNTIME_PROJECTION
- PROFILE_STATE_VERSION_3_AND_PROJECT_SCOPED_STORAGE
- SAFE_RESET_AND_RESTORE_LAST_STABLE_INTEGRATION
- NO_COMMAND_MEANING_CHANGE
- NO_EDITOR_DATA_TRUTH_CHANGE
- NO_RECOVERY_TRUTH_CHANGE

### ENTRY_CRITERIA

- `TOOLBAR_PHASE_00A_BASE_REBIND_AND_VERIFY_001` green carrier basis exists.
- First contour independent review confirmed `GREEN_NO_CARRIER_DEFECT`.
- Current local dirty root must not be used as execution base.
- Fetch remote and capture live `origin/main` SHA at actual start.
- Clean isolated worktree from captured live `SELECTED_BASE_SHA` is required.
- Diff from `TOOLBAR_PHASE_00A_BASE_REBIND_AND_VERIFY_001` basis to captured live `SELECTED_BASE_SHA` must not contain toolbar source, focused test or dependency drift.

## CONTRACT_SHAPES

- This contour is `REPORT_ONLY_NO_SOURCE_WRITE`.
- This contour does not fix runtime.
- This contour does not open forward change.
- Doc text cannot override source and test truth.
- Any drift found here opens a separate followup packet.
- Current repo truth and forward target must stay separate.
- Status text alone is not proof.
- Current truth table must be captured from `toolbarFunctionCatalog.mjs`, `toolbarProfileState.mjs`, `toolbarRuntimeProjection.mjs`, `index.html` and `editor.js`.

## IMPLEMENTATION_STEPS

1. Create clean isolated worktree from `SELECTED_BASE_SHA`.
2. Record `HEAD_SHA_BEFORE`, local branch and worktree state.
3. Fetch remote and capture live `origin/main` SHA as `SELECTED_BASE_SHA` and `BINDING_BASE_SHA`.
4. Confirm toolbar slice delta from `TOOLBAR_PHASE_00A_BASE_REBIND_AND_VERIFY_001` basis to captured live `SELECTED_BASE_SHA` is docs-only or empty.
5. Run focused truth test set only.
6. Capture current truth table from `toolbarFunctionCatalog.mjs`, `toolbarProfileState.mjs`, `toolbarRuntimeProjection.mjs`, `index.html` and `editor.js`.
7. Compare current truth table against phase plan language.
8. Classify result as `GREEN_CURRENT_TRUTH_ALIGNED`, `RED_DOC_DRIFT_ONLY`, `RED_SOURCE_TRUTH_DRIFT`, `RED_RUNTIME_REPAIR_REQUIRED` or `BLOCKED_ENV`.
9. If green, close Phase 01 as report-only pass.
10. If `RED_DOC_DRIFT_ONLY`, open `TOOLBAR_PHASE_01B_DOC_REBIND_PATCH_001`.
11. If `RED_SOURCE_TRUTH_DRIFT`, open `TOOLBAR_PHASE_01C_SOURCE_TRUTH_PATCH_001`.
12. If `RED_RUNTIME_REPAIR_REQUIRED`, stop and defer to Phase 03.

## CHECKS

### PRE_CHECKS

- `CHECK_01_PRE_FETCH_REMOTE`: fetch remote metadata
- `CHECK_02_PRE_CAPTURE_LIVE_SELECTED_BASE`: live remote main SHA captured as selected base
- `CHECK_03_PRE_CREATE_ISOLATED_WORKTREE`: clean isolation true
- `CHECK_04_PRE_00A_HANDOFF_PRESENT`: first contour green handoff fields present
- `CHECK_05_PRE_00A_TO_LIVE_TOOLBAR_DELTA`: no toolbar source, focused test or dependency drift since 00A basis

### POST_CHECKS

- `CHECK_06_POST_FOCUSED_NODE_TEST_CMD`: `toolbar-profile-state.foundation.test.js`, `toolbar-runtime-projection.helpers.test.js`, `sector-m-toolbar-profile-switch.test.js`, `sector-m-toolbar-profile-ordering.test.js`
- `CHECK_07_POST_CURRENT_TRUTH_TABLE_CAPTURE`: live order, planned ids, blocked ids, profile state, runtime projection and master visibility captured
- `CHECK_08_POST_DRIFT_CLASSIFICATION`: drift classification explicit
- `CHECK_09_POST_NO_SOURCE_WRITES`: source diff empty
- `CHECK_10_POST_NEXT_STEP_RECORDED`: next step explicit

### ACCEPTANCE

- `ACCEPTANCE_01_CURRENT_TRUTH_TABLE_MATCHES_ALL_12_ANCHORS`
- `ACCEPTANCE_02_00A_TO_LIVE_TOOLBAR_DELTA_IS_DOCS_ONLY_OR_EMPTY`
- `ACCEPTANCE_03_FOCUSED_TRUTH_TEST_SET_GREEN`
- `ACCEPTANCE_04_NO_EXECUTION_LANGUAGE_CONTRADICTS_CURRENT_17_LIVE_3_BLOCKED_MASTER_VISIBLE_ORDERING_REALIZED_TRUTH`
- `ACCEPTANCE_05_SOURCE_DIFF_EMPTY`
- `ACCEPTANCE_06_RESULT_CLASSIFIED_HONESTLY`
- `ACCEPTANCE_07_NEXT_STEP_RECORDED_WITHOUT_SCOPE_EXPANSION`

### CLASSIFICATION_VALUES

- `GREEN_CURRENT_TRUTH_ALIGNED`
- `RED_DOC_DRIFT_ONLY`
- `RED_SOURCE_TRUTH_DRIFT`
- `RED_RUNTIME_REPAIR_REQUIRED`
- `BLOCKED_ENV`

### CURRENT_TRUTH_TABLE_SCHEMA

- `LIVE_ORDER_COUNT`
- `LIVE_ORDER_IDS`
- `PLANNED_IDS`
- `BLOCKED_IDS`
- `MASTER_PROFILE_VISIBLE`
- `PROFILE_STATE_VERSION`
- `STORAGE_PREFIX`
- `STORAGE_SCOPE`
- `CANONICAL_SEED_MINIMAL`
- `CANONICAL_SEED_MASTER`
- `ACTIVE_PROFILE_DEFAULT`
- `ORDERING_REALIZED_IN_RUNTIME_PROJECTION`
- `PROJECTION_ROOT`

### CURRENT_TRUTH_ANCHORS

- `CURRENT_TRUTH_ANCHOR_01`: `LIVE_ORDER_COUNT_EQUALS_17`
- `CURRENT_TRUTH_ANCHOR_02`: `PLANNED_IDS_EQUALS_EMPTY`
- `CURRENT_TRUTH_ANCHOR_03`: `BLOCKED_IDS_EQUALS_toolbar.insert.image_toolbar.proofing.spellcheck_toolbar.proofing.grammar`
- `CURRENT_TRUTH_ANCHOR_04`: `PROFILE_STATE_VERSION_EQUALS_3`
- `CURRENT_TRUTH_ANCHOR_05`: `STORAGE_PREFIX_EQUALS_toolbarProfiles_COLON`
- `CURRENT_TRUTH_ANCHOR_06`: `STORAGE_SCOPE_EQUALS_PROJECT_ID`
- `CURRENT_TRUTH_ANCHOR_07`: `CANONICAL_SEED_MINIMAL_EQUALS_toolbar.font.family_toolbar.font.weight_toolbar.font.size_toolbar.text.lineHeight_toolbar.paragraph.alignment_toolbar.history.undo_toolbar.history.redo`
- `CURRENT_TRUTH_ANCHOR_08`: `CANONICAL_SEED_MASTER_EQUALS_FULL_LIVE_ORDER`
- `CURRENT_TRUTH_ANCHOR_09`: `ACTIVE_PROFILE_DEFAULT_EQUALS_minimal`
- `CURRENT_TRUTH_ANCHOR_10`: `MASTER_PROFILE_VISIBLE_EQUALS_TRUE`
- `CURRENT_TRUTH_ANCHOR_11`: `ORDERING_REALIZED_IN_RUNTIME_PROJECTION_EQUALS_TRUE`
- `CURRENT_TRUTH_ANCHOR_12`: `PROJECTION_ROOT_EQUALS_FLOATING_TOOLBAR_CONTROLS_CONTAINER`

## STOP_CONDITION

- stop if live selected base cannot be captured and rebound at actual start
- stop if clean isolation cannot be obtained
- stop if 00A basis to live base delta contains toolbar source, focused test or dependency drift
- stop if any runtime repair becomes necessary to make Phase 01 green
- stop if any storage change beyond profile state becomes necessary
- stop if any forward migration language enters Phase 01
- stop if any source write is attempted inside this contour
- stop if drift cannot be classified honestly

STOP_STATUS: STOP_NOT_DONE

## REPORT_FORMAT

- `TASK_ID`
- `TYPE`
- `SELECTED_BASE_SHA`
- `BINDING_BASE_SHA`
- `VERIFIED_AT_UTC`
- `HEAD_SHA_BEFORE`
- `HEAD_SHA_AFTER`
- `HEAD_SHA_USED_FOR_VERIFICATION`
- `LOCAL_BRANCH_USED`
- `LOCAL_WORKTREE_STATE`
- `CURRENT_TRUTH_TABLE`
- `FOCUSED_TEST_RESULTS`
- `DRIFT_CLASSIFICATION`
- `SOURCE_DIFF_AFTER_VERIFICATION`
- `CHANGED_BASENAMES`
- `STAGED_SCOPE_MATCH`
- `COMMIT_SHA`
- `COMMIT_OUTCOME`
- `PUSH_RESULT`
- `PR_RESULT`
- `MERGE_RESULT`
- `NEXT_STEP`

Rules:

- `CHANGED_BASENAMES` must be `NONE`
- `STAGED_SCOPE_MATCH` must be `NOT_APPLICABLE_REPORT_ONLY`
- `COMMIT_SHA` must be `NOT_REQUIRED_BY_TASK_POLICY`
- `COMMIT_OUTCOME` must be `NOT_REQUIRED_BY_TASK_POLICY`
- `PUSH_RESULT` must be `NOT_REQUIRED_BY_TASK_POLICY`
- `PR_RESULT` must be `NOT_REQUIRED_BY_TASK_POLICY`
- `MERGE_RESULT` must be `NOT_REQUIRED_BY_TASK_POLICY`
- `CURRENT_TRUTH_TABLE` must explicitly list all 17 live ids and 3 blocked ids
- `STATUS_TEXT_ALONE_IS_NOT_PROOF`

## FAIL_PROTOCOL

- no silent rebase
- no silent scope expansion into runtime repair
- no silent scope expansion into forward migration
- report exact failed check and exact drift classification
- if target branch drifted request new owner approved base SHA
- if 00A basis to live base delta is not docs-only or empty open a separate carrier reassessment packet instead of forcing Phase 01
- if doc drift only is found, open `TOOLBAR_PHASE_01B_DOC_REBIND_PATCH_001`
- if source truth drift is found, open `TOOLBAR_PHASE_01C_SOURCE_TRUTH_PATCH_001`
- if runtime repair is required, stop and defer to Phase 03
