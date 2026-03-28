# GIT DELIVERY ENFORCEMENT V1

STATUS: ACTIVE
SCOPE: WRITE_TASKS_ONLY

## Purpose

This policy makes delivery chain completion mandatory for write work.
No write task is considered done without the required git and GitHub outcomes.

## Required Delivery Policy Fields

Every write brief must explicitly define:
- `COMMIT_REQUIRED`
- `PUSH_REQUIRED`
- `PR_REQUIRED`
- `MERGE_REQUIRED`

If a brief omits overrides, default is hard mode:
- `COMMIT_REQUIRED: true`
- `PUSH_REQUIRED: true`
- `PR_REQUIRED: true`
- `MERGE_REQUIRED: true`

## Dirty Worktree Gate

A new write task is blocked when current worktree is dirty,
except when the task is explicitly defined as hygiene or isolation.
Execution must move to a clean isolated base.

## Completion Law

For write tasks:
1. Commit must be created.
2. Branch must be pushed.
3. Pull request must be created.
4. Pull request must be merged.

If any required step fails, task result is `STOP_NOT_DONE`.

## Required Write Report Fields

Every write task report must include:
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

## Exception Rule

`report-only` tasks may skip commit/push/PR/merge only when the task policy explicitly allows that mode.
