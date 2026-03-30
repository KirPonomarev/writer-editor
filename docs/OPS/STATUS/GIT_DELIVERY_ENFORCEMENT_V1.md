# GIT DELIVERY ENFORCEMENT V1

STATUS: IMMEDIATE_ADOPTION_CANDIDATE
AUTHORITY_ROLE: ACTIVE_AUTHORITY_COPY
SCOPE: ALL_WRITE_TASKS_UNLESS_EXPLICITLY_MARKED_REPORT_ONLY
PURPOSE: REMOVE_TOLERANCE_FOR_DIRTY_WRITE_FLOW_AND_FORCE_COMMIT_PUSH_PR_MERGE_DISCIPLINE

## 1. Core Reading

This document exists to make Git delivery unavoidable instead of advisory.

The problem is not that the team lacks wording about discipline.
The problem is that write work can still start and finish without a hard stop on dirty worktree, without a required commit, and without a required GitHub delivery chain where that chain should exist.

This document fixes that.

## 2. Delivery Law

For every write task, delivery policy must be explicit in the brief.

Mandatory policy fields:

- `COMMIT_REQUIRED`
- `PUSH_REQUIRED`
- `PR_REQUIRED`
- `MERGE_REQUIRED`
- `DELIVERY_MODE`
- `DONE_ONLY_IF`

Default rule for write tasks:

- `COMMIT_REQUIRED: true`
- `PUSH_REQUIRED: true`
- `PR_REQUIRED: true`
- `MERGE_REQUIRED: true`
- `DELIVERY_MODE: COMMIT_THEN_PUSH_THEN_PR_THEN_MERGE`

Default rule for report-only tasks:

- `COMMIT_REQUIRED: false`
- `PUSH_REQUIRED: false`
- `PR_REQUIRED: false`
- `MERGE_REQUIRED: false`
- `DELIVERY_MODE: REPORT_ONLY`

If a write task does not explicitly downgrade any of these fields through owner-approved task policy, the default chain above applies automatically.

Interpretation:

- no silent local-only write work;
- no “commit later” reading;
- no hidden GitHub omission after a finished implementation step.

## 3. Dirty Worktree Gate

No new write task may start if the worktree is dirty and not explicitly isolated.

Allowed start states:

1. clean worktree;
2. fresh isolated branch or worktree created for the task;
3. explicit hygiene task whose only purpose is to isolate, classify, or commit the tail.

Forbidden start state:

- dirty mixed worktree plus a new unrelated write task.

Law:

- `NO_NEW_WRITE_TASK_IF_WORKTREE_NOT_CLEAN_AND_NOT_EXPLICITLY_ISOLATED`

## 4. Done Means Delivered

A write task is not done when code exists locally.
A write task is done only when the delivery chain required by its task policy is complete.

Interpretation:

- if `COMMIT_REQUIRED: true`, no `COMMIT_SHA` means task is not done;
- if `PUSH_REQUIRED: true`, no remote delivery evidence means task is not done;
- if `PR_REQUIRED: true`, no PR means task is not done;
- if `MERGE_REQUIRED: true`, no merge result means task is not done.

Law:

- `WRITE_TASK_DONE_ONLY_IF_REQUIRED_GIT_DELIVERY_CHAIN_IS_COMPLETE`

## 5. Exception Policy

Exceptions are allowed only when narrow and explicit.

Valid exception classes:

1. report-only task;
2. local isolation or hygiene task;
3. local recon task with exact allowlist;
4. owner-declared no-push/no-PR/no-merge task for current-lane governance.

Every exception must contain:

- reason;
- owner;
- exact scope;
- expiry or next follow-up task;
- explicit statement that this is an exception, not the default model.

Law:

- `NO_IMPLICIT_LOCAL_ONLY_WRITE_TASKS`

## 6. Required Report Keys

For write tasks, the summary must include:

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

For report-only tasks, no write-field should appear unless it refers explicitly to a historical run being verified.

If a field is not required by task policy, it must still be reported explicitly as:

- `NOT_REQUIRED_BY_TASK_POLICY`

It must not be silently omitted.

## 7. Hard Stop Conditions

The task must stop immediately if any of the following becomes true:

- worktree is dirty and task is not a hygiene or isolation task;
- staged scope is wider than exact allowlist;
- write task ends without required commit;
- write task ends without required push when push is required;
- write task ends without required PR when PR is required;
- write task ends without required merge when merge is required;
- report wording tries to mark local-only work as GitHub-delivered;
- unrelated changes are discovered and not isolated.

## 8. GitHub Delivery Law

If task policy requires GitHub delivery, the chain is:

1. narrow commit;
2. push branch;
3. open PR;
4. green checks or explicit accepted exception;
5. merge;
6. stop.

The burden of proof is not prose.
The burden of proof is task evidence.

Law:

- `GITHUB_DELIVERY_IS_DEFAULT_FOR_WRITE_WORK`

## 9. Minimum Enforcement Adoption

The following four rules should be treated as immediate enforcement:

1. no new write task in dirty non-isolated worktree;
2. no write task accepted without `COMMIT_SHA`;
3. no task may omit explicit delivery policy fields;
4. if push/PR/merge are required by task policy, missing them means task is still open.

## 10. Final Interpretation

This document does not replace canon.
It hardens execution hygiene around canon.

The intended outcome is simple:

- fewer mixed worktrees,
- fewer local-only ghosts,
- fewer false green reports,
- and every serious write step actually reaches GitHub when policy says it must.

## 11. Base Freshness Rule

If a task is explicitly pinned to a `BINDING_BASE_SHA`, that pin is part of task authority.

If target branch moves and the PR becomes non-mergeable under the task scope policy, the agent must:

1. stop with `STOP_NOT_DONE`;
2. report base freshness mismatch;
3. request one new owner-approved base SHA;
4. rerun from a fresh isolated base.

What is forbidden:

- silent rebase to a newer base without explicit owner approval;
- merging a dirty or widened PR just to “finish the chain”.
