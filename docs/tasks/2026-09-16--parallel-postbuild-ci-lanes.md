# Parallel post-build CI lanes

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: CHECKS_BASELINE_V1
TASK_ID: CI_POSTBUILD_LANES_20260916
BINDING_BASE_SHA: 9e611228f1db19e18784c2b3d8e2da51f8b06939
AUTHORITY: Owner accepted accelerating development and verification without reducing coverage; the preceding navigator repair is fully delivered.

## MICRO_GOAL

Remove sequential waiting between the existing post-audit and maintained RTK checks. Both must still pass after their own real build before merge.

## ARTIFACT

A two-entry matrix in the existing actual-renderer-build-rtk job, with an executable command-preservation and failure-policy contract.

## ALLOWLIST

- .github/workflows/oss-policy.yml
- test/contracts/r24-postbuild-lanes.contract.test.mjs
- docs/tasks/2026-09-16--parallel-postbuild-ci-lanes.md
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json

## DENYLIST

Product source, dependency files, protected merge oracle, rulesets, frozen raw readback, denominator and historical evidence.

## CONTRACT / SHAPES

O: Both existing post-build suites execute concurrently; their aggregate result remains required. Record real GitHub elapsed time.
T: Exact CI checkout -> pinned toolchain -> actual build -> clean build-output proof -> unchanged test commands -> existing aggregate merge oracle.
H: The current critical path adds the two suite durations. Parallel scheduling moves elapsed time toward the slower suite, subject to queue and runner load.
B: CI-derived results only; no product or authoring mutation. Preserve every original command, historical checkout, timeout and failure gate. Revert this PR as one unit.
P: Byte-preservation contract, adversarial workflow mutations, existing merge-oracle negatives, inventory, full certification, required CI and exact merged verification.
I: Binding base above; candidate/merged SHA and job timestamps are captured in external receipts. Prior runs 35106740185 and 35101513573 took 1182 and 1347 seconds respectively.

### FEATURE_INTEGRATION_MANIFEST_V1

FEATURE_ID: PARALLEL_POSTBUILD_CI_LANES_V1
PRODUCT_PLANE: No runtime change; existing product commands run in CI.
INTERFACE_PLANE: No renderer or Design OS change.
COMMANDS_QUERIES_EVENTS_EFFECTS: Existing repository checks and read-only CI results; no new product operation.
PORTS: Existing GitHub job runner and required merge oracle; no new runtime port.
PROJECTIONS: Exact-revision CI results only, with no product mutation authority.
IDENTITY: Both lanes retain checkout, Node pin, locked dependencies, actual build and clean-output check.
CAPABILITY: NO_RUNTIME_MUTATION; merge-gate still rejects non-success aggregate results.
FALLBACK: Both lanes required; fail-fast false retains diagnostics. No continue-on-error or skipped required test.
RECOVERY: Restore the original sequential job by reverting this PR.
PERFORMANCE: Two concurrent standard runners; same workloads plus one extra small build. Measure both elapsed time and aggregate job time.
ACCESSIBILITY: No interface change.
SURFACE_MANIFEST: EXISTING_SURFACES_UNCHANGED.
DESIGN_TOOL_ROUTER: DISABLED_FOR_INFRASTRUCTURE_ONLY.
CURRENT: Both heavy command blocks run serially in one job.
TARGET: Concurrent unchanged command blocks; no additional product matrix credit or unmeasured speed claim.

The guard removes only the declared matrix and step routing additions, then requires SHA-256 equality to the complete original job. Existing protected merge topology and dependency-result checks remain authoritative. This uses GitHub's documented matrix execution model: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/run-job-variations

## IMPLEMENTATION_STEPS

1. Split execution through a two-entry matrix while preserving original command bytes.
2. Require the guard before build in each lane; reject omitted work and weakened failure paths.
3. Refresh only existing source qualifications and the exhaustive test inventory.
4. Run required checks, compare real CI timestamps, merge and verify the exact merged revision.

## CHECKS

CHECK_1_PRE_IDENTITY: Bootstrap, unchanged mandatory canon reads, volume identity and exact-base preflight.
CHECK_2_POST_NEGATIVE: Workflow preservation, routing mutants and existing dependency failure oracle.
CHECK_3_POST_COMPATIBILITY: Actual build and clean outputs, inventory, ops, guardrails and full certification.
CHECK_4_POST_DELIVERY: Required CI with both matrix jobs, ordinary protected merge and exact merged checks.

## STOP_CONDITION

Missing suite, changed original command, weakened failure gate, foreign changes, ambiguous identity or stale evidence prevents delivery.

## REPORT_FORMAT

One text block with task, identities, changed basenames, checks, delivery outcomes, measured timing and limitations.

## FAIL_PROTOCOL

Retain failed logs and exact identities. No synthetic success, skips or count-only credit; stop after three identical failures.
