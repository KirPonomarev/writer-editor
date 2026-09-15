# Fresh C1 product admission
TYPE: OPS_WRITE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0
TASK_ID: C1_FRESH_PRODUCT_ADMISSION_20260915
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true

## MICRO_GOAL
Admit the independently reviewed fresh C1 physical run through the existing product denominator command. Count this cell once, retain archived Cell001 byte-for-byte, and reject stale or corrupt evidence.

## ARTIFACT
One append-only successor and bounded offline raw evidence checker. Product runtime and the fixed 1120 denominator stay unchanged.

## ALLOWLIST
- docs/tasks/2026-09-15--c1-fresh-product-admission.md
- docs/OPS/RTK/YALKEN_INTEROP_C1_FRESH_EVIDENCE_SUCCESSOR_V1.json
- scripts/ops/rtk-interop-c1-fresh-evidence.mjs
- scripts/ops/rtk-interop-c1-raw-readback.py
- scripts/ops/rtk-interop-100-denominator-v1.mjs
- test/contracts/rtk-interop-100-denominator.contract.test.js
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- scripts/ops/r24/corrective/post-audit-certification-set.mjs
- test/contracts/r24-post-audit-certification-set.contract.test.mjs

## DENYLIST
- src
- package.json
- package-lock.json
- archived denominator, ledger and envelope
- provider launches, cloud, timers, other agents, private documents

## CONTRACT / SHAPES
Direct owner OPS_GOVERNANCE repair, outside the R2.4 StageAdmission V2 program stage transition. No stage lease is claimed or manufactured.
FEATURE_INTEGRATION_MANIFEST_V1: EXISTING_SEAM, existing denominator CLI, read-only external evidence root and fixed successor; derived admission report only. Product plane, interface plane, product commands, ports, surfaces, migrations, persistence and accessibility have NO_RUNTIME_CHANGE. Input schema, containment and size limits precede reads. Git, raw files and review are bound to exact identities. Missing evidence fails closed. No external executable is launched from the evidence package; only repository-owned Python stdlib oracle executes. Rollback is one PR revert. Performance is measured wall time.
MAP: input bytes -> containment/hash -> raw semantic and provider checks -> independent review binding -> exact runtime identity -> one unique cell report. Evidence does not authorize mutation.
MOVE: one successor, raw rehydration and its CI governance companions.
PROVE: physical original plus independent review; repository checker must reject coherent corruptions as well as integrity drift. No broad portability claim.

## IMPLEMENTATION_STEPS
1. Verify clean f4a7d654 base and preflight declaration.
2. Pin the complete immutable raw package and reviewed predecessor relation.
3. Wire explicit fresh mode into the existing CLI; preserve historical mode.
4. Verify raw text, structure, order, loss, provenance, independent readback and cleanup, then count one unique cell.
5. Exercise negative cases, review diff, refresh exact changed test inventory and approval hashes, deliver one PR and recheck merged SHA.

## CHECKS
CHECK_1_PRE_IDENTITY: clean f4a7d6541f5fc230f4a7a7f6dc7504eb85a615e9, mount verified, agent preflight PASS.
CHECK_2_POST_FOCUSED: node --test test/contracts/rtk-interop-100-denominator.contract.test.js test/contracts/r24-post-audit-certification-set.contract.test.mjs
CHECK_3_POST_RAW: actual immutable physical package accepted; independent malformed copies rejected; repeated admission remains one cell.
CHECK_4_POST_GOVERNANCE: npm run r24:test-inventory; governance-change-detection with current approvals; npm run agent:guardrails; ops-gate for this task.
CHECK_5_POST_DELIVERY: required CI, merge, clean exact merged tree and actual package rehydration. No test skip or diagnostic counts as physical PASS.

## STOP_CONDITION
Wrong identity, unrelated WIP, runtime delta, missing raw input, missing independent review, invalid oracle, unapproved scope, or mandatory check failure means no admission. Three identical failures stop that experiment with its signature.

## REPORT_FORMAT
One text block with task, before/after/merged SHA, changed basenames, tests, commit, push, PR, CI, merge, exact-head verification, limits and next step.

## FAIL_PROTOCOL
Retain expected/actual, exact SHA, artifact hashes, elapsed seconds and one next hypothesis. Never replace evidence with a generated success or lower the denominator.
