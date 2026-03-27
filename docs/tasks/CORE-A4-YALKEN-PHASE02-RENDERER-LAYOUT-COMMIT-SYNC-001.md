TASK_ID: CORE-A4-YALKEN-PHASE02-RENDERER-LAYOUT-COMMIT-SYNC-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_RENDERER_LAYOUT_COMMIT_SYNC_ONLY
CANON_VERSION: v3.13a-final

## MICRO_GOAL
Выполнить первый renderer-to-runtime layout commit sync в существующей границе resize_end через commitDesign и layout_patch без расширения UI и без изменения command surface.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-LAYOUT-COMMIT-SYNC-001.md
- src/renderer/editor.js
- test/unit/sector-m-design-os-layout-commit-sync.test.js

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
- test/unit/sector-m-design-os-restore-last-stable-adoption.test.js
- test/unit/sector-m-design-os-safe-reset-adoption.test.js
- test/unit/sector-m-design-os-warning-hints.test.js
- test/unit/sector-m-design-os-status-hints.test.js
- test/unit/sector-m-design-os-dormant-observability.test.js
- test/unit/sector-m-tiptap-runtime-bridge.test.js
- docs/OPS/STATUS

## CONTRACT
- Existing resize_end boundary only.
- commitDesign called only from resize_end flow with commit_point resize_end.
- layout_patch only; design_patch forbidden.
- Fallback local commit flow remains if ports unavailable or throw.
- performSafeResetShell unchanged.
- performRestoreLastStableShell unchanged.
- Status, warning, perf semantics unchanged.
- No new controls and no new command IDs.
- No preload, main, html or css changes.
- No status record patch.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-LAYOUT-COMMIT-SYNC-001.md src/renderer/editor.js test/unit/sector-m-design-os-layout-commit-sync.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/capabilityPolicy.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs package.json agents.md docs/PROCESS.md test/unit/sector-m-design-os-restore-last-stable-adoption.test.js test/unit/sector-m-design-os-safe-reset-adoption.test.js test/unit/sector-m-design-os-warning-hints.test.js test/unit/sector-m-design-os-status-hints.test.js test/unit/sector-m-design-os-dormant-observability.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-design-os-layout-commit-sync.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_LAYOUT_COMMIT_SYNC_EXECUTION_BRIEF_ONLY
