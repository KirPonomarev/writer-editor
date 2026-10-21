# One complete post-build RTK — 2026-10-22

TASK_ID: YALKEN_CI_SINGLE_RTK_20261022
TYPE: OPS_WRITE
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
ACTIVE_EXECUTION_CANON: v3.13a-final
BINDING_BASE_SHA: ba463255eedb74325bad01a302d7a20a8caabee7
COMMIT_REQUIRED: true
PUSH_REQUIRED: true
PR_REQUIRED: true
MERGE_REQUIRED: true

## MICRO_GOAL

Execute the complete maintained RTK graph once after an actual renderer/preload
build. Run every original additional R2.4 check independently and require both
outcomes through the existing required context. Preserve macOS release scope.

## ARTIFACT

Two existing workflows and their existing post-build contract, with one rollback.
The baseline has two complete graph calls. The result must have one, without a
smaller graph, removed check, relaxed failure policy or product-readiness claim.
External original bytes and actual evidence stay in the dated T777 ci-single-rtk
report folder. The original master plan, DNA and Black Box plan remain intact.

## ALLOWLIST

- .github/workflows/oss-policy.yml
- .github/workflows/rtk-required.yml
- test/contracts/r24-postbuild-lanes.contract.test.mjs
- test/contracts/r24-post-audit-corrections.contract.test.mjs
- docs/tasks/2026-10-22--ci-single-rtk.md
- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/WORKLOG.md
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/post-audit-certification-set.mjs
- test/contracts/rtk-word-comment-return-apply.contract.test.js
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json

## DENYLIST

No product source, generated bundle, package/dependency/lockfile, RTK runner,
catalog membership, test exclusion, required-ruleset or release-plan change.
No new framework, tracker, product authority, runtime network or native session.
No old evidence, tuple, approval history or original check-body rewriting.
No reset/stash/clean/rebase/force/amend or modification of foreign work.

## CONTRACT / SHAPES

FEATURE_INTEGRATION_MANIFEST_V1: featureId=ops.ciSingleRtk.v1; featureVersion=1; integrationMode=EXISTING_SEAM; domainOwner=existing CI workflow; authoritativeData=direct owner process objective and active repository law; derivedData=exact-head CI results; commandIds=NO_PRODUCT_COMMAND; eventTypes=NO_DOMAIN_EVENT; queryIds=existing CI checks; productProjectionIds=NONE_OPS_ONLY; capabilityIds=existing protected merge; authorityMap=owner permits process implementation, GitHub required gates still control merge; identityKeys=Git SHA/workflow bytes/test catalog; revisionPolicy=fresh exact candidate and merged verification; writePath=ordinary protected PR; readPath=fixed workflow/source bytes to executed checks and aggregate; requiredProductPorts=NONE_NO_PRODUCT_EFFECT; requiredDesignOsPorts=NONE_NO_UI; adapterRequirements=existing GitHub Actions and local Git; surfaceManifests=NONE; slotRequirements=NONE; supportedWorkspaces=OPS_ONLY; platformAvailability=existing CI platforms unchanged, product macOS-first; accessibilityRequirements=NONE_NO_UI_DELTA; fallbacks=fail closed or coherent revert; stateClasses=DERIVED_STATE; persistenceClass=CI evidence only; migrations=job routing only, historical proof retained; recovery=normal rerun of failed exact candidate; rollback=one PR revert; performanceBudget=one complete graph and independent existing extra checks, measured runner duration and critical path kept separate; securityBoundary=fixed trusted workflow commands and dependency-result env values; lifecycle=one exact workflow run; negativeBypassChecks=missing/duplicate/skipped/failed/cancelled graph/build/extra/aggregate; evidenceBindings=pre-edit original bytes plus actual local and official CI; currentReality=two complete graph executions, no release promotion.

The original post-build command body is reconstructed and checked against its
existing digest. The original complete required workflow is reconstructed from
the two executing jobs and compared with its independently retained base digest.
The aggregate keeps the existing rtk-required context and rejects any result
other than success for either prerequisite. Both jobs run without a serial
dependency. The existing outer merge-gate and ruleset remain mandatory.

Budget: at most200 workflow and250 contract changed lines,180 task/factual lines;
mechanical inventory/hash/append-only companion changes separately accounted.

## IMPLEMENTATION_STEPS

1. CHECK_01 executes before repository edits: resolve canonical identity, T7/T777,
   fresh main, MR01 closure, complete applicable reads, declaration and preflight.
   CHECK_02+ execute after edits; never rerun PRE to bless dirty implementation.
2. Create this bounded task, run its native OPS gate, then change only the two
   workflow routes and the existing meaningful topology/negative contract.
3. Scope amendment01 updates the existing platform/security assertion to read
   the required reusable workflow too and require exactly one complete graph.
   Its original platform/build/security assertions remain. Preserve full original
   command bodies, toolchain and limits. Execute focused
   and affected gates, review exact diff and protected source bytes.
4. Refresh only normal exact inventory/C2A/data/certificate/approval companions;
   preserve old entries and predicates, append one complete nonrecursive successor.
5. Commit/push/attach PR, observe complete official CI, merge through protection
   and repeat relevant checks in a clean checkout of the exact merged SHA.

## CHECKS

CHECK_01_PRE_IDENTITY_AUTHORITY: clean registered exactba463255 worktree, fresh
remote, verified encrypted/unlocked/writable T7 and correct writable T777,
preceding delivery proofs, exact declaration/preflight before first edit.

CHECK_02_POST_LAYOUT_AND_FAILURES: complete original workflow-body equality;
one full graph after real build and clean-tree check; every additional command;
negative mutations for omission/duplicate/route/order/skip/allowed-error and all
actual aggregate prerequisite statuses, including cancellation and unknown.

CHECK_03_POST_AFFECTED_AND_COMPANIONS: original RTK catalog/runner and protected
product bytes unchanged; existing graph/catalog, CI-lane, post-audit and Apply
contracts; complete data/certificate negative checks; inventory/C2A/strict
governance/task/E0/OSS/audit/guardrails. Official CI owns the full maintained
RTK and broad baseline; focused green never substitutes for those required jobs.

CHECK_04_POST_DELIVERY: exact staged allowlist and budgets, ordinary commit/push,
attached PR and required exact-head CI, normal merge, fresh exact merged tree and
relevant repeated checks. Report compute and wall time without extrapolation.

## STOP_CONDITION

Stop on ambiguous base/authority, foreign dirty state, missing original check,
weakened protection, product/dependency change, failed mandatory proof or third
identical failure signature. Preserve the failing evidence and useful output.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1 and CODEX_OUTPUT_POLICY: one text block, KEY: VALUE,
basenames only, exact SHA and executed denominators, limitations and one next
step. No product/release completion claim. External full evidence stays on T777.

## FAIL_PROTOCOL

Record exact SHA, actual command/exit, expected/actual layout or failure status,
source/artifact hashes and one next hypothesis. Never disable a check, fabricate
success, relabel old evidence or bypass the protected PR path.
