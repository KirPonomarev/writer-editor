# Verified Yalken storage navigation

TASK_ID: YALKEN_STORAGE_MAP_20261012
TYPE: OPS_WRITE
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
ACTIVE_EXECUTION_CANON: v3.13a-final
BINDING_BASE_SHA: 5d0c5865280684bcd9ce287d138a9200c40eb054

## MICRO_GOAL
Document exact observed Yalken storage paths after the owner-approved iCloud to T777 transfer. Owner explicitly requests README and documentation path reconciliation. This is documentation only; Word/native remains paused.

## ARTIFACT
README navigation, docs/STORAGE_MAP.md and aligned external T777 README. Read-only namespace observations and document backups stay in the existing local migration control directory.

## ALLOWLIST
- README.md
- docs/STORAGE_MAP.md
- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/WORKLOG.md
- docs/tasks/2026-10-12--yalken-storage-map.md

## DENYLIST
- src/**
- test/**
- docs/OPS/**
- .github/**
- package.json
- package-lock.json
- all archived payloads, frozen evidence and source catalogs
- any data deletion, migration, Yandex write, native run or timer

## CONTRACT / SHAPES
O: one discoverable map with exact paths, roles, observed presence and historical limitations.
T: owner decision plus live filesystem observations and immutable migration receipts; prose supplies navigation only.
H: distinguishing current destinations from historical source paths prevents agents using removed iCloud paths or archive snapshots as live Git.
B: preserve every payload and historical receipt, other projects and owner checkout; rollback only this docs commit and external README backup.
P: verify volume identity, path existence, symlink destinations, restore-tool locations, migration records and documentation links; guardrails and E0; required PR checks and merged exact tree.
I: binding base above; T7-Secure UUID D1F2E2C1-3210-4A39-A4E0-0AA0AD5110E2; T777 UUID F2FA9AE0-0081-3FC3-BF56-CC4280D16513.
Architecture declaration is validated before the first edit. Product/Command/Design boundaries, ports, projections and state are unchanged because this writes documentation only. UI research is inapplicable. No new dependencies or product network behavior. Git network is solely the repository-required delivery chain.
COMMIT_REQUIRED=true; PUSH_REQUIRED=true; PR_REQUIRED=true; MERGE_REQUIRED=true.

## IMPLEMENTATION_STEPS
1. Resolve registered canonical checkout, read startup contracts and verify the isolated exact-base writer.
2. Audit documented paths, relevant runtime path selectors, namespace and immutable receipts without hydrating or changing cloud data.
3. Update only navigation documentation, preserving historical source paths as history.
4. Review diff, validate paths/links/scope, commit, push, PR, required CI, merge and exact merged verification.

## CHECKS
CHECK_01_PRE_IDENTITY: clean Git, registered canonical identity, volume UUID/encryption/unlocked/writable, bootstrap and architecture preflight; performed before edits.
CHECK_02_POST_PATHS: every current absolute locator resolves to its documented target; absent legacy paths explicitly classified; Unicode normalization and symlink targets observed; archive restore source inspected without executing recovery.
CHECK_03_POST_PRESERVATION: archived target identities equal previous verification, source iCloud root absent locally; no data mutation from this task; diff is exactly the declared docs scope; local Markdown links resolve.
CHECK_04_POST_GUARDS: npm run agent:guardrails; node scripts/ops-gate.mjs --task docs/tasks/2026-10-12--yalken-storage-map.md; git diff --check; required PR CI and exact merged tree verification.

## STOP_CONDITION
Stop on identity mismatch, unrelated dirty state, missing required current target, unauthorized delta, failed required check or unmergeable base drift. Unknown remote availability is not verified backup completeness.

## REPORT_FORMAT
Task, before/after/merged SHA, changed basenames, path and scope proof, guardrails, commit/push/PR/CI/merge outcome, residual limitations and one next action.

## FAIL_PROTOCOL
Preserve data and evidence, record actual failure, do not rewrite history or bypass gates. After three identical failures stop the loop with one next hypothesis.
