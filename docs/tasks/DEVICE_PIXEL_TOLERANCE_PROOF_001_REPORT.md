# DEVICE_PIXEL_TOLERANCE_PROOF_001_V2 Report

TASK_ID: DEVICE_PIXEL_TOLERANCE_PROOF_001_V2
SCOPE: test/unit/vertical-sheet-gap-smoke.mjs
STATUS: PASS
HEAD_SHA_BEFORE: c19593ad0a5c9defec2b30d69477854cae4ad9ca
HEAD_SHA_AFTER: REPORTED_IN_FINAL_DELIVERY_SUMMARY
BINDING_BASE_SHA: c19593ad0a5c9defec2b30d69477854cae4ad9ca
COMMIT_SHA: REPORTED_IN_FINAL_DELIVERY_SUMMARY
CHANGED_BASENAMES: vertical-sheet-gap-smoke.mjs, DEVICE_PIXEL_TOLERANCE_PROOF_001_REPORT.md
MACHINE_EVIDENCE: explicit DPR 2 guard, 1 device px tolerance, positive DOM text rects, zero scale transforms, zero tolerated gap, bottom margin, and content-rect outside intersections, zero clip or mask loss candidates, zero bitmap dimension deltas
TARGETED_TEST_RESULT: PASS
FULL_TEST_RESULT_OR_NOT_RUN_REASON: NOT_RUN_TARGETED_CONTOUR_ONLY
AUDIT_RESULT: PENDING_INDEPENDENT_AUDIT
STAGED_SCOPE_MATCH: PASS
COMMIT_OUTCOME: COMMIT_CREATED_PENDING_FINAL_DELIVERY
PUSH_RESULT: PENDING
PR_RESULT: PENDING
MERGE_RESULT: PENDING
NEXT_STEP: INDEPENDENT_AUDIT_THEN_PUSH_PR_MERGE

## Guard Added

- Explicit numeric device-pixel tolerance: `DEVICE_PIXEL_TOLERANCE_PX = 1`.
- Forced device scale factor evidence: `FORCED_DEVICE_SCALE_FACTOR = 2`, command-line switch evidence, and runtime `window.devicePixelRatio`.
- Actual Electron rendered geometry evidence: `capturePage()` bitmap size is compared with viewport CSS pixels multiplied by runtime DPR.
- DOM text evidence: non-empty text-node count and text-range rect count are asserted positive.
- No transform scale on the primary text surface: host, sheet strip, editor, and `.ProseMirror` computed transforms are parsed and asserted to have no scale transform.
- No text loss by clip or mask: visible DOM text rects are asserted to have zero device-tolerance intersections with sheet gaps and bottom margins, zero visible text outside visible sheets, and zero combined clip or mask loss candidates.

## Target Command

`node --test test/unit/vertical-sheet-gap-smoke.mjs`

## Result

PASS.

Observed evidence from the passing run:

- forced device scale factor: `2`
- runtime device pixel ratio: `2`
- device pixel tolerance: `1`
- bitmap deltas: `0` device px width and `0` device px height for top, middle, and after-scroll captures
- text gap intersections by device tolerance: `0`
- visible text gap intersections by device tolerance: `0`
- visible text outside content rect by device tolerance: `0`
- visible bottom margin intersections by device tolerance: `0`
- visible clip or mask loss candidates: `0`
- primary text surface scale transforms: `0`

## Assertions Added

- Numeric tolerance is finite and exactly `1`.
- Command-line forced scale factor equals `2`.
- Runtime DPR equals forced scale factor.
- Each measured state carries the same forced scale factor, DPR, device-pixel tolerance, and derived CSS-pixel tolerance.
- DOM text node and text rect counts are positive.
- Gap and bottom-margin intersections remain zero under explicit device-pixel tolerance.
- Visible text outside the content rect remains zero under explicit device-pixel tolerance.
- Combined visible clip or mask loss candidate count is zero.
- Transform scale evidence exists for primary text surfaces and reports zero scale transforms.
- Captured bitmap dimensions match actual Electron viewport geometry within the explicit device-pixel tolerance.
