## HEADER
TASK_ID: TOOLBAR-TEST-DESIGN-VISUAL-ORACLE-PRESERVATION-001
MILESTONE: TOOLBAR_TEST_DESIGN_ORACLE
TYPE: WRITE
STATUS: DONE

## MICRO_GOAL
Freeze one historical toolbar test-design visual oracle so future toolbar work can return to an explicit owner-approved baseline without re-running forensic reconstruction.

## ARTIFACT
- docs/tasks/2026-04-15--toolbar-test-design-visual-oracle-preservation.md
- TOOLBAR_TEST_DESIGN_VISUAL_ORACLE_HISTORICAL_RECORD_V1.json
- ticket-meta.json
- summary.json

## ALLOWLIST
- docs/tasks/2026-04-15--toolbar-test-design-visual-oracle-preservation.md
- TOOLBAR_TEST_DESIGN_VISUAL_ORACLE_HISTORICAL_RECORD_V1.json
- ticket-meta.json
- summary.json

## DENYLIST
- CANON.md
- CONTEXT.md
- HANDOFF.md
- index.html
- editor.js
- editor.bundle.js

## CONTRACT / SHAPES
- This preservation package is TEST_DESIGN_ONLY and MUST NOT be interpreted as current mainline canon.
- Historical source anchor is commit f15fbf75ef45e1c7356c8a0b76bc3e4ba7a7bcfa.
- Historical visual state keeps title Функции тулбара and placeholder entries New Slot.
- Package MUST bind owner approval, source commit, historical tag, and explicit non-promotion policy.

## IMPLEMENTATION_STEPS
1. Create a clean isolated write base from origin main.
2. Create annotated tag toolbar_test_design_visual_oracle_approved_2026_04_09 on historical commit f15fbf75ef45e1c7356c8a0b76bc3e4ba7a7bcfa.
3. Record a machine-readable historical oracle packet in OPS evidence layer.
4. Record ticket metadata and concise summary in the same evidence contour carrier.
5. Commit, push, PR, and merge the preservation package.

## CHECKS
CHECK_01: verify clean isolated write base before edits
CHECK_02: verify only allowlisted basenames changed
CHECK_03: verify historical anchor SHA equals f15fbf75ef45e1c7356c8a0b76bc3e4ba7a7bcfa
CHECK_04: verify packet explicitly says TEST_DESIGN_ONLY and NOT_RELEASE_CANON
CHECK_05: verify packet explicitly says current mainline truth is not overridden
CHECK_06: verify tag name matches the oracle packet binding

## STOP_CONDITION
- Stop if the package starts to override current canon by implication.
- Stop if preserving the oracle requires code changes outside documentation and evidence carrier files.
- Stop if the historical source anchor changes.

## REPORT_FORMAT
- TASK_ID
- HEAD_SHA_BEFORE
- HEAD_SHA_AFTER
- COMMIT_SHA
- CHANGED_BASENAMES
- STAGED_SCOPE_MATCH
- COMMIT_OUTCOME
- PUSH_RESULT
- PR_RESULT
- MERGE_RESULT
- NEXT_STEP

## FAIL_PROTOCOL
- If any delivery step fails, report STOP_NOT_DONE.
- If tag push fails, report TAG_PUSH_RESULT separately and keep task open.
