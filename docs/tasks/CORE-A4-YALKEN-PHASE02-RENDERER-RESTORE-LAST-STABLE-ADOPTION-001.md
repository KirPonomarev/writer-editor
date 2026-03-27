TASK_ID: CORE-A4-YALKEN-PHASE02-RENDERER-RESTORE-LAST-STABLE-ADOPTION-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_RENDERER_RESTORE_LAST_STABLE_ADOPTION_ONLY
CANON_VERSION: v3.13a-final

## MICRO_GOAL
Перевести layout-часть существующего restore-last-stable-shell обработчика на designOsDormantRuntimeMount ports restoreLastStableShell с переводом snapshot через buildSpatialStateFromLayoutSnapshot и с сохранением текущего fallback пути.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-RESTORE-LAST-STABLE-ADOPTION-001.md
- src/renderer/editor.js
- test/unit/sector-m-design-os-restore-last-stable-adoption.test.js

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
- test/unit/sector-m-design-os-safe-reset-adoption.test.js
- test/unit/sector-m-design-os-warning-hints.test.js
- test/unit/sector-m-design-os-status-hints.test.js
- test/unit/sector-m-design-os-dormant-observability.test.js
- test/unit/sector-m-tiptap-runtime-bridge.test.js
- docs/OPS/STATUS

## CONTRACT
- Existing restore-last-stable-shell command id unchanged.
- performRestoreLastStableShell adopts port layout path only when ports are available.
- Layout snapshot translated via buildSpatialStateFromLayoutSnapshot and fed to existing applySpatialLayoutState path.
- Fallback restore path remains if ports unavailable or throw.
- performSafeResetShell unchanged.
- Status, warning and perf semantics remain compatible.
- No new controls and no new command IDs.
- No preload, main, html or css changes.
- No status record patch.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-RESTORE-LAST-STABLE-ADOPTION-001.md src/renderer/editor.js test/unit/sector-m-design-os-restore-last-stable-adoption.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/capabilityPolicy.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs package.json agents.md docs/PROCESS.md test/unit/sector-m-design-os-safe-reset-adoption.test.js test/unit/sector-m-design-os-warning-hints.test.js test/unit/sector-m-design-os-status-hints.test.js test/unit/sector-m-design-os-dormant-observability.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-design-os-restore-last-stable-adoption.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_RESTORE_ADOPTION_EXECUTION_BRIEF_ONLY
