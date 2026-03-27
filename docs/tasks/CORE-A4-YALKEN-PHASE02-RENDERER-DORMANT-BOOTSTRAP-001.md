TASK_ID: CORE-A4-YALKEN-PHASE02-RENDERER-DORMANT-BOOTSTRAP-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_RENDERER_DORMANT_BOOTSTRAP_ONLY
CANON_VERSION: v3.13a-final

## MICRO_GOAL
Смонтировать imported Design OS runtime в локальном renderer state без visible UI expansion, без command-surface expansion и без touches вне narrow allowlist.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-DORMANT-BOOTSTRAP-001.md
- src/renderer/editor.js
- test/unit/sector-m-tiptap-runtime-bridge.test.js

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
- docs/OPS/STATUS

## CONTRACT
- Mount only local dormant runtime and ports.
- No new command IDs.
- No new visible controls.
- No command seam reroute.
- No status-record patch.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-DORMANT-BOOTSTRAP-001.md src/renderer/editor.js test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: only allowlist basenames are changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/capabilityPolicy.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs package.json agents.md docs/PROCESS.md
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_BOOTSTRAP_EXECUTION_BRIEF_ONLY
