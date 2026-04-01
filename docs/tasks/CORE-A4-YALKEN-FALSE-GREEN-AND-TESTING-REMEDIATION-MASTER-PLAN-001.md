# CORE-A4-YALKEN-FALSE-GREEN-AND-TESTING-REMEDIATION-MASTER-PLAN-001

## Task Identity
- TASK_ID: CORE-A4-YALKEN-FALSE-GREEN-AND-TESTING-REMEDIATION-MASTER-PLAN-001
- TASK_CLASS: DOCS_ONLY_MASTER_REMEDIATION_PLAN
- ACTIVE_CANON: v3_13a_final
- BLOCKING_SOURCE: ACTIVE_CANON_ONLY
- PRIMARY_TRUTH_BASE: LIVE_REMOTE_MAIN_ONLY_PLUS_AUDIT_AND_PHASE_00_ARTIFACTS
- CURRENT_BINDING_ORDER: REPO_WIDE_DONE_ACTIVE_Y9_NOT_OPENED
- DOCUMENT_ROLE: ONE_PROGRAM_MAP_FOR_REMAINING_FALSE_GREEN_AND_TESTING_REMEDIATION

## Purpose
Собрать один целиковый документ, который фиксирует весь оставшийся remediation process по:
- false-green,
- stale-green,
- sourcebinding drift,
- security and dependency findings,
- perf proof gaps,
- testing-proven gaps и deferred tests.

Этот документ:
- не переоткрывает `Writer v1` runtime axis,
- не открывает `Y9`,
- не заменяет active canon,
- не делает runtime admission силой текста.

Он нужен как одна program map, чтобы дальше не собирать remediation process по кускам из audit, phase packets и phase_00 meta artifacts.

## Authority Boundary
- Active canon остаётся единственным binding execution law.
- `CANON.md` остаётся repo entrypoint.
- `CONTEXT.md` и `HANDOFF.md` остаются factual operating reality.
- Audit artifacts и phase_00 meta artifacts остаются evidence inputs.
- Этот документ задаёт remediation queue и interpretation boundary, но не создаёт новый binding law.

## What Is Already Closed And Must Not Be Reopened By Text
- repo-wide done confirmed on main after merge gate and post-merge reconfirm;
- Phase 00 through Phase 07 remain PASS in current factual reality;
- Y7 foundation/proof regen remains closed on main;
- Y8 formal cutover packet and rollback packet remain bound on main;
- `PHASE_00_META_FOUNDATION` is complete;
- owner outcome 01 is already accepted and confirms no new binding move;
- Y9 remains not opened by implication;
- post-version-one exploration is not automatic current scope.

## Confirmed Open Remediation Set

### A. False-Green And Proof Gaps From Phase 00 Meta Foundation
Current open gaps from `OWNER_GAP_DASHBOARD.json`:
- `GAP_COMMAND_SURFACE_BYPASS` = `FAIL`
- `GAP_MENU_TRUTH_CHAIN` = `HOLD`
- `GAP_SKIP_HEAVY_CURRENT_SCOPE` = `HOLD`
- `GAP_SHELL_PROOF_DRIFT` = `HOLD`
- `GAP_PERF_FALSE_GREEN` = `HOLD`
- `GAP_DEPENDENCY_FALSE_GREEN` = `HOLD`
- `GAP_DOC_TRUTH_DRIFT` = `HOLD`
- `GAP_SOURCEBINDING_DRIFT` = `HOLD`

### B. Confirmed P1 Audit Findings
From `audit-findings.json` and `decision-log.md`:
- `SCA-0001` dependency security remediation for builder and tar chain
- `SAST-0001` CI and OPS command injection hardening
- `SAST-0002` path boundary centralization for IPC and file operations

### C. Confirmed P2 Audit Findings
- `LICENSE-0001` explicit license posture note
- `ARCH-0001` architecture hygiene pass for knip and depcruise noise

### D. Deferred Tests Explicitly Registered
The following tests are deferred and cannot be counted as PASS:
- `palette-grouping.test.js`
- `sector-m-command-surface-ui-fencing.test.js`
- `sector-m-preload-ui-command-bridge.test.js`
- `sector-m-runtime-command-id-canonicalization.test.js`
- `sector-m-design-os-save-boundary-truth-sync.test.js`
- `sector-m-design-os-restore-last-stable-adoption.test.js`
- `sector-m-design-os-layout-commit-sync.test.js`
- `sector-m-design-os-theme-design-state.test.js`
- `sector-m-design-os-typography-design-state.test.js`
- `sector-m-design-os-command-palette-visibility.test.js`

### E. Environment-Blocked Lanes
Blocked lanes from `ENVIRONMENT_READINESS_MATRIX.json`:
- `TEST_ELECTRON`
- `BUILD_MAC`
- `SECURITY_AUDIT`
- `PERF_LIVE`

Blocked means:
- lane cannot be reported PASS,
- lane may remain explicit `BLOCKED`,
- lane cannot be converted into narrative green.

## Required Surface Interpretation
The remaining remediation program is anchored on current required surfaces from `CURRENT_SCOPE_PROOF_MATRIX.json`:
- `SURFACE_EDITOR_TRUTH_AND_SAVE`
- `SURFACE_COMMAND_SURFACE`
- `SURFACE_MENU_SOURCEBINDING`
- `SURFACE_SHELL_SAFE_RESET_RESTORE`
- `SURFACE_FACTUAL_DOC_TRUTH`
- `SURFACE_PERF_TRUTH`
- `SURFACE_DEPENDENCY_TRUTH`

For each required surface, honest green requires all three proof classes:
- `LIVE_RUNTIME`
- `NEGATIVE_PROOF`
- `STATIC_SOURCEBINDING`

Anything else is not closure. In particular:
- narrative-only status is not closure;
- synthetic-only perf is not closure;
- blocked environment is not closure;
- skipped tests are not closure;
- stale lock artifacts are not closure.

## Remediation Lanes

### Lane A. Required-Surface False-Green Closure
This lane closes proof gaps on current required product surfaces.

Queue:
1. command surface bypass closure
2. menu truth chain and menu sourcebinding closure
3. shell safe reset and restore proof closure
4. factual doc truth reconfirm after proof-changing contours

Primary evidence links:
- `OWNER_GAP_DASHBOARD.json`
- `CURRENT_SCOPE_PROOF_MATRIX.json`
- `SOURCEBINDING_MATRIX_CURRENT_SCOPE.json`
- `SKIP_POLICY_AND_DEFERRED_REGISTRY.json`

### Lane B. Security And Release-Chain Hardening
This lane closes confirmed P1 security and dependency findings from audit.

Queue:
1. `SAST-0001` CI and OPS command injection hardening
2. `SAST-0002` path boundary centralization
3. `SCA-0001` dependency remediation for builder and tar chain

Primary evidence links:
- `audit-findings.json`
- `decision-log.md`
- `audit-summary.md`

### Lane C. Perf And Dependency Truth Closure
This lane closes false-green around perf and dependency readiness.

Queue:
1. establish one live perf proof gate for current required perf surface
2. keep synthetic perf evidence explicitly synthetic until live gate exists
3. reconfirm dependency truth only after real remediation or explicit accepted defer policy

Primary evidence links:
- `FALSE_GREEN_GUARD_POLICY.json`
- `OWNER_GAP_DASHBOARD.json`
- `ENVIRONMENT_READINESS_MATRIX.json`

### Lane D. Environment-Gated And Deferred Proof
This lane exists only after explicit admission and real environment readiness.

Queue:
1. electron test lane activation
2. mac build lane activation
3. security audit lane execution under a real scanner window
4. deferred design and runtime tests only when their scope is explicitly admitted

Rule:
- deferred tests remain explicit debt until their runtime contour is opened;
- deferred tests are not auto-promoted because files already exist in repo.

### Lane E. Later Hygiene
This lane remains later and non-blocking unless separately promoted.

Queue:
1. `LICENSE-0001`
2. `ARCH-0001`

Rule:
- no mass cleanup without measurable reliability, security or perf effect.

## Concrete Gap Map

### Command Surface Cluster
Open gap:
- direct UI bypass still conflicts with zero-bypass command surface claim.

Expected closure shape:
- one bus-only execution path,
- explicit negative proof for direct UI bypass,
- preload bridge proof,
- runtime command id canonicalization proof.

Directly linked deferred tests:
- `sector-m-command-surface-ui-fencing.test.js`
- `sector-m-preload-ui-command-bridge.test.js`
- `sector-m-runtime-command-id-canonicalization.test.js`

### Menu Truth Chain Cluster
Open gap:
- menu truth chain still depends on sourcebinding proof and stale lock discipline.

Expected closure shape:
- real shipping entrypoints mapped,
- menu artifacts and locks aligned,
- no narrative menu truth claim without sourcebinding.

### Shell Safe Reset And Restore Cluster
Open gap:
- shell proof drift remains visible until safe reset and restore behavior is reproved.

Expected closure shape:
- save boundary truth sync,
- restore last stable behavior proof,
- layout commit sync only if runtime contour explicitly includes it.

Directly linked deferred tests:
- `sector-m-design-os-save-boundary-truth-sync.test.js`
- `sector-m-design-os-restore-last-stable-adoption.test.js`
- `sector-m-design-os-layout-commit-sync.test.js`

### Perf Truth Cluster
Open gap:
- synthetic perf green is explicitly forbidden as closure.

Expected closure shape:
- one live perf gate,
- no PASS claim from synthetic-only perf,
- explicit blocked semantics until live lane is available.

### Dependency Truth Cluster
Open gap:
- dependency readiness cannot be assumed narratively while audit findings remain open.

Expected closure shape:
- remediation or explicit accepted defer decision,
- fresh evidence after remediation,
- no stale dependency ready wording.

### Doc Truth Cluster
Open gap:
- factual docs must continue to describe one operating reality after every proof-changing contour.

Expected closure shape:
- one factual pass after any contour that changes operating truth,
- no split-brain between runtime reality and docs.

## Program Order
The default queue is:
1. `CONTOUR_FG_01_COMMAND_SURFACE_BYPASS_CLOSURE`
2. `CONTOUR_FG_02_MENU_TRUTH_CHAIN_AND_SOURCEBINDING_CLOSURE`
3. `CONTOUR_FG_03_SHELL_SAFE_RESET_AND_RESTORE_PROOF_CLOSURE`
4. `CONTOUR_SEC_01_CI_OPS_COMMAND_INJECTION_HARDENING`
5. `CONTOUR_SEC_02_PATH_BOUNDARY_CENTRALIZATION`
6. `CONTOUR_SEC_03_DEPENDENCY_REMEDIATION`
7. `CONTOUR_FG_04_LIVE_PERF_GATE`
8. `CONTOUR_FG_05_DEPENDENCY_TRUTH_RECONFIRM`
9. `CONTOUR_FG_06_FACTUAL_DOC_TRUTH_RECONFIRM_IF_CHANGED`
10. `CONTOUR_ENV_01_BLOCKED_LANE_EXECUTION_WHEN_READY`
11. `CONTOUR_HYGIENE_01_LATER_NONBLOCKING_CLEANUP`

Queue rules:
- only one explicit next contour may be active at a time;
- no contour may be inferred from advisory language;
- no contour may claim green for a required surface without proof-class completeness;
- no later hygiene contour may displace an open P1 or open required-surface false-green contour.

## Non-Goals Of This Master Plan
This document does not:
- reopen `Writer v1` release scope;
- open `Y9`;
- authorize design-os runtime by implication;
- make deferred design tests current required closure by text alone;
- rewrite active canon;
- claim that all current audit findings are blocking release today.

## Global Stop Rules
Stop if:
- any contour tries to self-green from skipped tests;
- any contour tries to self-green from blocked environment;
- any contour treats stale locks as live sourcebinding proof;
- any contour treats docs-only claims as runtime closure;
- any contour implies `Y9` or post-version-one expansion from false-green work;
- more than one next contour is emitted at the same time.

## Done Definition For The Whole Remediation Program
The whole program is honestly done only when:
1. all current required surfaces are either truly closed by `LIVE_RUNTIME + NEGATIVE_PROOF + STATIC_SOURCEBINDING` or explicitly re-scoped by canon;
2. `GAP_COMMAND_SURFACE_BYPASS`, `GAP_MENU_TRUTH_CHAIN`, `GAP_SHELL_PROOF_DRIFT`, `GAP_PERF_FALSE_GREEN`, `GAP_DEPENDENCY_FALSE_GREEN`, `GAP_DOC_TRUTH_DRIFT` and `GAP_SOURCEBINDING_DRIFT` are no longer open as current-scope gaps;
3. P1 audit findings `SCA-0001`, `SAST-0001` and `SAST-0002` are closed or explicitly time-boxed by a separate accepted owner policy;
4. blocked lanes are either honestly executed with real readiness or remain explicit `BLOCKED` without false-green wording;
5. deferred tests are either closed in admitted runtime contours or remain explicitly deferred without PASS claims;
6. factual docs continue to speak one operating reality.

## First Default Next Contour
Unless a stronger owner decision overrides it, the first default next contour after this document is:
- `CONTOUR_FG_01_COMMAND_SURFACE_BYPASS_CLOSURE`

Reason:
- it is the only current gap already marked `FAIL`,
- it sits directly on a required product surface,
- it aligns with the `Writer v1` center rule `zero-bypass command surface`,
- it removes the sharpest false-green contradiction before later hardening contours.

## Final Position
`PHASE_00_META_FOUNDATION` solved the missing machine-readable foundation.
This document solves the next problem: one complete remediation map for everything that phase_00 intentionally did not fix.

That means:
- phase_00 is done,
- the wider false-green and testing remediation program is not done,
- but after this document it is at least one program instead of many disconnected fragments.
