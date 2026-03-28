# GIT TAIL CLEARANCE PLAN V1

STATUS: ACTIVE_QUEUE
MODE: ONE_CLUSTER_AT_A_TIME

## Queue Law

- Cluster execution order is strict.
- Cluster 01 is mandatory before any new phase or UI contour.
- One write cluster equals one full delivery chain.
- Next cluster is blocked until current cluster is merged.

## Active Order

1. `GIT-TAIL-CLUSTER-01-ENFORCEMENT-001`
2. `GIT-TAIL-CLUSTER-00-LOCAL-RESIDUE-001`

## Cluster 01 Definition

Objective:
- Land repo-visible git delivery law surfaces.

Scope allowlist basenames:
- `GIT-TAIL-CLUSTER-01-ENFORCEMENT-001.md`
- `agents.md`
- `PROCESS.md`
- `GIT_DELIVERY_ENFORCEMENT_V1.md`
- `GIT_TAIL_CLEARANCE_PLAN_V1.md`

Blocked in cluster 01:
- `WORKLOG.md`
- runtime files
- renderer files
- governance status JSON outside cluster allowlist

## Delivery Rule

Cluster 01 is complete only if:
- commit created
- push completed
- PR created
- PR merged
- PR diff contains only cluster 01 allowlist basenames
