TASK_ID: CORE-A4-YALKEN-PHASE02-RENDERER-WARNING-HINTS-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_RENDERER_WARNING_HINT_ONLY
CANON_VERSION: v3.13a-final

## MICRO_GOAL
Добавить один компактный dormant YDOS warning suffix только в существующую warning line, только при lastError или degraded_to_baseline, без изменения status и perf semantics.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-WARNING-HINTS-001.md
- src/renderer/editor.js
- test/unit/sector-m-design-os-warning-hints.test.js

## DENYLIST
- src/main.js
- src/preload.js
- src/renderer/index.html
- src/renderer/styles.css
- src/renderer/commands/capabilityPolicy.mjs
- src/renderer/commands/commandBusGuard.mjs
- src/renderer/commands/runCommand.mjs
- package.json
- agents.md
- docs/PROCESS.md
- test/unit/sector-m-design-os-status-hints.test.js
- test/unit/sector-m-design-os-dormant-observability.test.js
- test/unit/sector-m-tiptap-runtime-bridge.test.js
- docs/OPS/STATUS

## CONTRACT
- Warning hint only at warning call sites.
- updateWarningStateText function body unchanged.
- Status line suffix semantics unchanged.
- Perf hint semantics unchanged.
- No new controls and no new command IDs.
- Runtime bridge command surface unchanged.
- No preload, main, html or css changes.
- No status record patch.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-WARNING-HINTS-001.md src/renderer/editor.js test/unit/sector-m-design-os-warning-hints.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/capabilityPolicy.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs package.json agents.md docs/PROCESS.md test/unit/sector-m-design-os-status-hints.test.js test/unit/sector-m-design-os-dormant-observability.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test test/unit/sector-m-design-os-warning-hints.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_WARNING_HINTS_EXECUTION_BRIEF_ONLY
