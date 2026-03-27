TASK_ID: CORE-A4-YALKEN-PHASE02-RENDERER-RUNTIME-OBSERVABILITY-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_RENDERER_TEXT_SURFACE_OBSERVABILITY_ONLY
CANON_VERSION: v3.13a-final

## MICRO_GOAL
Показать dormant Design OS runtime summary только через существующие текстовые surfaces инспектора и diagnostics modal без UI expansion и без command-surface changes.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-RUNTIME-OBSERVABILITY-001.md
- src/renderer/editor.js
- test/unit/sector-m-design-os-dormant-observability.test.js

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
- test/unit/sector-m-tiptap-runtime-bridge.test.js
- docs/OPS/STATUS

## CONTRACT
- Existing text surfaces only.
- No new controls and no new command IDs.
- No full product truth, full scene text or full design state exposure.
- No preload or main changes.
- No status record patch.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-RUNTIME-OBSERVABILITY-001.md src/renderer/editor.js test/unit/sector-m-design-os-dormant-observability.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/capabilityPolicy.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs package.json agents.md docs/PROCESS.md test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test test/unit/sector-m-design-os-dormant-observability.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_OBSERVABILITY_EXECUTION_BRIEF_ONLY
