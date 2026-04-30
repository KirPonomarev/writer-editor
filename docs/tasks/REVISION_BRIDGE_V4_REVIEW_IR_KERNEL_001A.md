TASK_ID: REVISION_BRIDGE_V4_REVIEW_IR_KERNEL_001A
DOCUMENT_TYPE: HARD_TZ_EXECUTED
STATUS: PURE_CONTRACT_KERNEL_MINIMAL_SCHEMA_AND_BLOCKER
CANON_BOUNDARY: REFERENCE_TASK_NOT_ACTIVE_EXECUTION_LAW
FEATURE_BRANCH_BOUNDARY: OWNER_APPROVED_ISOLATED_REVISION_BRIDGE_FEATURE_BRANCH_ONLY
MAINLINE_BOUNDARY: MAINLINE_DELIVERY_FORBIDDEN_WITHOUT_EXPLICIT_OWNER_APPROVAL

## MICRO_GOAL
Prove the minimal in-memory Review IR kernel slice before any parser, UI, storage migration, or runtime apply work.

This contour proves only schema normalization, canonical hashing, unsupported observation counting, automation blockers, and stale-baseline zero apply operations.

This contour does not claim the full Review IR kernel is complete.

## DELIVERY_POLICY
COMMIT_REQUIRED: true
PUSH_REQUIRED: true
PR_REQUIRED: true only to owner-approved feature target
MERGE_REQUIRED: true only to owner-approved feature target
MAINLINE_DELIVERY: forbidden

## SCOPE_IN
- `reviewIrKernel.mjs`
- `reviewIrKernel.contract.test.js`
- `canonicalHash.contract.test.js`
- `staleBaselineBlocker.contract.test.js`

## SCOPE_OUT
- Real Markdown adapter.
- Matcher engine.
- Apply compiler.
- Runtime apply.
- Renderer wiring.
- Main process wiring.
- Preload wiring.
- DOCX parser.
- Hostile file gate.
- Project storage reads.
- Project storage writes.
- UI work.
- New dependencies.

## RULES
- All inputs are in-memory synthetic fixtures.
- The module must not import filesystem, network, Electron, or child process APIs.
- The module may use deterministic hashing only.
- Stale baseline returns zero apply operations and explicit blocked reasons.
- Unsupported surfaces become unsupported observations and ReviewBOM counts.
- Ambiguous, duplicate, heading-only, ordinal-only, and text-position-only lanes are never auto eligible.
- Structural risks are manual only.
- Human summaries are out of scope.
- Full ReviewBOM matrix is out of scope.

## CHECKS
CHECK_01_PRE: confirm isolated Revision Bridge branch and clean worktree.
CHECK_02_PRE: run admission guard state before write.
CHECK_03_POST: run `node --test test/contracts/reviewIrKernel.contract.test.js test/contracts/canonicalHash.contract.test.js test/contracts/staleBaselineBlocker.contract.test.js`.
CHECK_04_POST: confirm no denylist basenames changed.
CHECK_05_POST: confirm no runtime, UI, dependency, parser, or storage basenames changed.

## STOP_CONDITIONS
- Current branch is not Revision Bridge feature branch.
- Required change touches denylist basename.
- Required change needs runtime wiring.
- Required change needs real Markdown adapter.
- Required change needs matcher engine.
- Required change needs apply compiler.
- Required change needs project storage reads or writes.
- Required change needs UI.
- Required change needs DOCX parser.
- Required change needs new dependency.
- Required change targets mainline.

## NEXT
If this contour passes, open `REVISION_BRIDGE_V4_REVIEW_IR_KERNEL_001B_PARSED_SURFACE_ADAPTER_AND_MATCHPROOF`.
