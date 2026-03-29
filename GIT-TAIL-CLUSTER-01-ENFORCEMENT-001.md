# GIT TAIL CLUSTER 01 ENFORCEMENT 001

STATUS: ACTIVE_WRITE_CLUSTER_EXACT_TARGET_MODE
TASK_ID: GIT-TAIL-CLUSTER-01-ENFORCEMENT-001
PATH_RESOLUTION_MODE: EXACT_TRACKED_TARGETS_ONLY

## Cluster Intent

Land repository-visible git delivery law before any new phase contour.

## Exact Allowlist Targets

- `GIT-TAIL-CLUSTER-01-ENFORCEMENT-001.md` (root tracked target)
- `agents.md` (root tracked target)
- `docs/PROCESS.md` (tracked target)
- `docs/OPS/STATUS/GIT_DELIVERY_ENFORCEMENT_V1.md` (single active authority target)
- `docs/OPS/STATUS/GIT_TAIL_CLEARANCE_PLAN_V1.md` (single active authority target)

## Mandatory Rules

- Start only from clean isolated base.
- Do not use current dirty worktree as execution base.
- Do not include `docs/WORKLOG.md`.
- Do not include runtime, renderer or non-cluster governance files.
- Keep staged scope equal to exact allowlist targets.
- Complete full chain: commit, push, PR, merge.

## Done Condition

Cluster is done only when:
- changed basenames are allowlist-only
- delivery chain is fully completed
- next step is exactly `OPEN_GIT-TAIL-CLUSTER-00-LOCAL-RESIDUE-001_ONLY`
