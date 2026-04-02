# Decision Log — AUDIT_NOW_REMEDIATION_AND_RECONFIRM_v1.1

## CLOSED_ON_CURRENT_MAINLINE
1. **Dependency security remediation (SCA-0001)**: packaging-chain dependency truth was re-opened on current mainline and then re-closed by a narrow dependency remediation contour.
Effect: current `npm audit --audit-level=high` is clean on mainline.
2. **CI/OPS command injection hardening (SAST-0001)**: risky workflow interpolation and `shell: true` ops execution path were hardened and merged on mainline.
Effect: current CI and ops command injection surface is materially reduced without broad refactor.
3. **Path boundary centralization for IPC/file paths (SAST-0002)**: shared validated path-join contract is merged on mainline for the current runtime file-operation surface.
Effect: traversal regression risk is reduced on active prod file-operation paths.
4. **License posture closure (LICENSE-0001)**: fresh production license scan on current mainline reports `UNKNOWN=0` and `DENY=0`, while notices readiness and AGPL source-offer policy remain valid.
Effect: license posture is explicitly closed for current scope A without opening runtime or dependency contours.
5. **Architecture evidence rebind closure (ARCH-0001)**: old knip and depcruise claims were rebound against current mainline static evidence and reproved as nonblocking or stale for current runtime truth.
Effect: no current circular or unresolved architecture break is reproved; old tiptap-unused and flags-orphan narratives are stale on current mainline runtime wiring.

## LATER
1. None in audit-now set after current scope A closeout.

## DROP
1. Any mass dedup/refactor not tied to measurable bug/security/perf effect.
2. Cosmetic churn and style-only “cleanup” outside explicit risk mitigation.
