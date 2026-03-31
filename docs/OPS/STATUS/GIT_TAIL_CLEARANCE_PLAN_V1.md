# GIT TAIL CLEARANCE PLAN V1

STATUS: IMMEDIATE_EXECUTION_PLAN
PURPOSE: CLEAR_THE_CURRENT_TAIL_BEFORE_OPENING_NEW_CONTOURS
MODE: COMMIT_THEN_PUSH_THEN_PR_THEN_MERGE
PRIMARY_LAW: NO_LOCAL_ONLY_WRITE_COMMITS
DEPENDENCY: GIT_DELIVERY_ENFORCEMENT_V1.md

## 1. Why This Document Exists

The repo already proved that advisory Git discipline is not enough.

The actual failure mode was:

- mixed worktree,
- multiple unrelated domains in one tail,
- narrow commits still happening in parallel with a large dirty base,
- and no hard guarantee that every write step immediately reached GitHub.

This document exists to remove that tolerance.

## 2. Hard Reading

From now on, the default for any write cluster is:

1. isolate cluster;
2. make one narrow commit;
3. push the branch;
4. open PR;
5. merge;
6. stop;
7. only then open the next cluster.

No local-only write commits.
No “we will push later”.
No “we will merge the whole tail when ready”.

Law:

- `ONE_WRITE_CLUSTER_ONE_DELIVERY_CHAIN`

## 3. Current Tail Baseline

Current mixed tail classes:

- `docs/OPS/STATUS`: 31 positions
- `docs/tasks`: 18 positions
- `scripts/ops`: 11 positions
- `src/renderer`: 4 positions
- `test`: 5 positions
- `docs_other`: 2 positions
- generated or local artifacts: 2 positions
- other: 3 positions

This is already too mixed to continue narrow execution safely.

## 4. Global Tail Rules

### 4.1 Delivery rule

Every real write cluster must follow:

- commit required,
- push required,
- PR required,
- merge required.

If a cluster is not meant to reach GitHub, it should not be treated as a normal write cluster.

### 4.2 Isolation rule

No cluster may mix:

- current-lane governance,
- renderer or UI redesign,
- ops scripts,
- tests from unrelated domains,
- local generated residue.

### 4.3 Sequencing rule

Do not open a new cluster while the previous one has not completed its required GitHub chain.

### 4.4 Report rule

Every delivery report for a tail cluster must contain:

- `TASK_ID`
- `HEAD_SHA_BEFORE`
- `HEAD_SHA_AFTER`
- `COMMIT_SHA`
- `CHANGED_BASENAMES`
- `STAGED_SCOPE_MATCH`
- `COMMIT_OUTCOME`
- `PUSH_RESULT`
- `PR_RESULT`
- `PR_NUMBER`
- `MERGE_RESULT`
- `MERGE_COMMIT_SHA`
- `NEXT_STEP`

Nothing should be silently omitted.
If some field is not required by policy, it must say `NOT_REQUIRED_BY_TASK_POLICY`.

## 5. What Counts As Tail Done

The tail is not “done” when it is described.
The tail is done only when each real cluster is either:

1. committed, pushed, PR-ed, and merged;
2. or explicitly discarded through a hygiene task because it was local residue and not intended as repo work.

## 6. Tail Clusters To Deliver

### Cluster 0. Local residue and generated artifacts

Scope:

- `.electron_probe_app/`
- `.x102_clean_surface_local_2/`
- exported local doc bundles

Task class:

- hygiene or isolation only

Goal:

- remove or move out of repo;
- ensure they do not stay mixed with real repo work.

Git rule:

- if removal changes tracked files, full delivery chain applies;
- if it only deletes untracked residue, no fake write commit should be invented.

### Cluster 1. Git delivery enforcement docs

Scope:

- `agents.md`
- `docs/PROCESS.md`
- `docs/OPS/STATUS/GIT_DELIVERY_ENFORCEMENT_V1.md`
- `docs/OPS/STATUS/GIT_TAIL_CLEARANCE_PLAN_V1.md`
- optional `docs/WORKLOG.md` line if needed

Goal:

- land the new Git discipline as repo-visible policy;
- make the rule unavoidable before further tail delivery.

Git rule:

- full chain required

Why first:

- this cluster defines the discipline that all later clusters must obey.

### Cluster 2. Current-lane governance and historical task surfaces

Scope families:

- `docs/tasks/CORE-A4-*`
- current-lane governance task leftovers
- contour and MIOS historical task surfaces that still sit loose in the tail
- current-lane and contour-related status JSONs in `docs/OPS/STATUS`

Goal:

- separate still-active current-lane governance from merely historical surfaces;
- deliver the active governance surfaces cleanly;
- push historical surfaces through a controlled documentation cluster instead of leaving them loose.

Constraint:

- do not mix this cluster with renderer or runtime code.

Git rule:

- full chain required

### Cluster 3. X101 and X102 status-and-doc package

Scope families:

- `X101_*`
- `X102_*`
- related `docs/OPS/STATUS/assets/`

Goal:

- deliver the UI redesign and capture-route planning surfaces as their own stream;
- keep them out of current-lane Phase 02 execution history.

Constraint:

- do not mix with current-lane governance cluster;
- do not mix with renderer implementation cluster unless there is a one-to-one delivery reason.

Git rule:

- full chain required

### Cluster 4. Renderer implementation cluster

Scope:

- `src/renderer/editor.bundle.js`
- `src/renderer/editor.js`
- `src/renderer/index.html`
- `src/renderer/styles.css`

Goal:

- land renderer work as one dedicated stream;
- do not continue new renderer work until this existing renderer tail is delivered.

Constraint:

- if renderer tail is too wide, split into smaller thematic commits;
- but each thematic commit still must go to GitHub before the next one.

Git rule:

- full chain required

### Cluster 5. Ops scripts and contract tests

Scope:

- `scripts/ops/perf-run.mjs`
- `scripts/ops/phase03-prep-state.mjs`
- `scripts/ops/contour-01-primary-editor-save-recovery-proofhook.mjs`
- `scripts/ops/phase05-*`
- `scripts/ops/phase07-*`
- `scripts/ops/x102-*`
- `test/contracts/*`

Goal:

- deliver scripts and their proof/tests in coherent families;
- avoid one giant “ops tail” commit.

Constraint:

- split by feature family:
  - perf cluster,
  - phase03 cluster,
  - phase05 cluster,
  - phase07 cluster,
  - x102 cluster.

Git rule:

- full chain required for each family cluster

## 7. Execution Queue

### Queue A. Enforce the law

Task:

- land Cluster 1 first

Reason:

- the repo must adopt the new Git law before using it to judge the tail.

### Queue B. Remove local residue

Task:

- isolate or delete Cluster 0

Reason:

- local junk must not pollute later reports.

### Queue C. Deliver governance tail

Task:

- split and land Cluster 2

Reason:

- current-lane and historical governance should stop living as loose dirt.

### Queue D. Deliver UI planning surfaces

Task:

- land Cluster 3

Reason:

- separate the planning/status side of UI redesign from renderer implementation.

### Queue E. Deliver renderer implementation

Task:

- land Cluster 4

Reason:

- renderer changes are too large to coexist indefinitely with current-lane execution work.

### Queue F. Deliver ops and tests

Task:

- land Cluster 5 in feature families

Reason:

- scripts and tests must stop riding in the tail behind unrelated work.

## 8. Required Delivery Shape Per Cluster

For every real cluster:

1. open one explicit task;
2. define exact allowlist;
3. stage exact allowlist only;
4. create one narrow commit;
5. push immediately;
6. open PR immediately;
7. merge when accepted;
8. report with full Git fields;
9. stop.

Forbidden:

- stack multiple local commits and push them later;
- keep committed but unpushed work as normal state;
- accumulate multiple merged-ready clusters before opening PRs;
- treat “committed locally” as done.

## 9. Stop Conditions

Immediate stop if:

- new write cluster starts on top of undelivered previous cluster;
- staged scope exceeds exact allowlist;
- cluster report omits required Git fields;
- push is missing where required;
- PR is missing where required;
- merge is missing where required;
- unrelated tail is dragged into the active cluster;
- someone argues for “local commit now, GitHub later”.

## 10. Tail Clearance Output

This plan is successful only when:

- no mixed tail remains as the default worktree mode;
- every real tail cluster has a commit, push, PR, and merge trail;
- local residue is removed or isolated;
- new contours start only from a clean or isolated base.

## 11. Immediate Adoption

The next practical sequence is:

1. adopt `GIT_DELIVERY_ENFORCEMENT_V1.md`;
2. land the enforcement cluster itself;
3. isolate or remove local residue;
4. deliver governance cluster;
5. deliver UI status cluster;
6. deliver renderer cluster;
7. deliver ops/test family clusters;
8. only then continue with new contour work from a clean or isolated base.

## 12. Final Interpretation

This is not a background cleanup note.
This is an execution plan.

The repo should now read the tail like this:

- no new contour first,
- no more “we will commit it later”,
- no more local-only write progress,
- and no more mixed dirty worktree as the normal operating mode.
