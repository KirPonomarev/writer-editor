TASK_ID: REVISION_BRIDGE_PRE_STAGE_00_ADMISSION_GUARD_001
DOCUMENT_TYPE: NEXT_CONTOUR_HARD_TZ
STATUS: ISOLATED_FEATURE_BRANCH_ADMISSION_GUARD_ONLY
CANON_BOUNDARY: REFERENCE_CONTOUR_NOT_ACTIVE_EXECUTION_LAW
FEATURE_BRANCH_BOUNDARY: ALL_WORK_RUNS_ONLY_IN_OWNER_APPROVED_ISOLATED_REVISION_BRIDGE_FEATURE_BRANCH
MAINLINE_BOUNDARY: MAINLINE_DELIVERY_FORBIDDEN_UNLESS_OWNER_EXPLICITLY_APPROVES_TARGET_AND_BASE_SHA

## MICRO_GOAL
Create the smallest admission guard required before `REVISION_BRIDGE_V4_REVIEW_IR_KERNEL_001` in the isolated Revision Bridge feature branch.

This contour does not implement the Review Bridge kernel. It only separates layers and modes so the next kernel contour is neither blocked by release-only Word or Google labs nor greened by status-only runtime claims.

This contour is not a global governance rewrite. It only proves the local admission boundary required for the next kernel contour inside the owner-approved feature branch.

## DELIVERY_POLICY
COMMIT_REQUIRED: true
PUSH_REQUIRED: true
PR_REQUIRED: true only to owner-approved feature target
MERGE_REQUIRED: true only to owner-approved feature target
MAINLINE_DELIVERY: forbidden

## SCOPE_IN
- `REVISION_BRIDGE_LAYER_TABLE_V1.json`
- `REVISION_BRIDGE_MODE_TABLE_V1.json`
- `REVISION_BRIDGE_KERNEL_001_ADMISSION_PROFILE_V1.json`
- `NEXT_CONTOUR_OPENING_RECORD_REVISION_BRIDGE_KERNEL_001_V1.json`
- `revision-bridge-admission-guard.contract.test.js`

## SCOPE_OUT
- Main branch baseline, PR, or merge.
- Global token, claim, failsignal, or trust-root rewrite.
- Runtime feature implementation.
- ReviewPatchSet or ReviewOpIR implementation.
- DOCX parser work.
- UI, menu, CSS, or renderer changes.
- Storage migration.
- Word or Google integration.
- Full trust-root infrastructure.
- New dependencies.

## RULES
- `PR_KERNEL` mode must not require Word labs, Google labs, network checks, or editor capability packets.
- `RELEASE_CLAIM` mode must still block unproven Word and Google support claims.
- Runtime claims cannot be proven by docs-only or status-only source binding.
- External standards are design models, not runtime dependencies.
- Hostile file gate is a blocker for external file parser expansion, not for the contract-only kernel profile.
- Local labels such as `PR_KERNEL` and `RELEASE_CLAIM` are nonbinding admission tags referencing active execution profiles; they do not define active canon modes or active profiles.
- Admission tables are reference artifacts for this contour, not canon sources.
- Owner-bound trust root is a future release-claim requirement, not a blocker for `REVISION_BRIDGE_V4_REVIEW_IR_KERNEL_001`.
- The guard must reject any mainline target unless the owner opens a separate explicitly approved mainline contour.
- Minimal cross-link checks are allowed only for kernel admission; global governance repair is out of scope.
- The next-contour opening record must remain pending until test evidence, clean scope proof, head sha, and local delivery outcome are recorded.

## CHECKS
CHECK_01_PRE: capture clean isolated lane and head sha before write.
CHECK_02_PRE: capture active canon status before write.
CHECK_03_PRE: confirm no runtime feature files are in scope.
CHECK_04_POST: run `node --test test/contracts/revision-bridge-admission-guard.contract.test.js`.
CHECK_05_POST: confirm no runtime feature basenames changed.
CHECK_06_POST: run targeted local OPS checks if touched by this contour.
CHECK_07_POST: confirm changed basenames are an exact subset of the allowlist.

## STOP_CONDITIONS
- Current branch is main or a main-based delivery target.
- Feature branch base SHA cannot be determined.
- Feature target is required but not declared.
- Dirty worktree is not isolated.
- Runtime feature file enters scope.
- UI or menu file enters scope.
- DOCX parser work enters scope.
- Kernel implementation enters scope.
- New dependency is required.
- Word or Google labs become PR kernel blockers.
- Governance repair expands beyond kernel admission.
- Delivery chain would target mainline.

## NEXT
After this admission guard passes, open `REVISION_BRIDGE_V4_REVIEW_IR_KERNEL_001` as a contract-only pure-core contour.
