TASK_ID: CORE-A4-YALKEN-PHASE02-TOOLBAR-SHELL-ACTION-COMMAND-KERNEL-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_TOOLBAR_SHELL_ACTION_COMMAND_KERNEL_ONLY
CANON_VERSION: v3.13a_final

## MICRO_GOAL
Перевести user initiated toolbar shell actions `open-settings`, `open-diagnostics`, `open-recovery` с прямых local modal handlers на существующие command ids через `dispatchUiCommand`, и синхронизировать `X101_MENU_COMMAND_MAP_LOCK_V1.json` на те же command paths без входа в export preview safe reset restore и другие контуры.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-TOOLBAR-SHELL-ACTION-COMMAND-KERNEL-001.md
- src/renderer/editor.js
- docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json
- test/unit/sector-m-toolbar-shell-action-command-kernel.test.js

## DENYLIST
- src/main.js
- src/renderer/commands/projectCommands.mjs
- src/renderer/commands/capabilityPolicy.mjs
- docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json
- docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json
- src/renderer/tiptap/runtimeBridge.js
- src/preload.js
- src/renderer/index.html
- src/renderer/styles.css
- src/renderer/commands/command-catalog.v1.mjs
- src/renderer/commands/registry.mjs
- src/renderer/commands/commandBusGuard.mjs
- src/renderer/commands/runCommand.mjs

## CONTRACT
- editor handleUiAction routes open-settings via `dispatchUiCommand(EXTRA_COMMAND_IDS.VIEW_OPEN_SETTINGS)`.
- editor handleUiAction routes open-diagnostics via `dispatchUiCommand(EXTRA_COMMAND_IDS.TOOLS_OPEN_DIAGNOSTICS)`.
- editor handleUiAction routes open-recovery via `dispatchUiCommand(EXTRA_COMMAND_IDS.REVIEW_OPEN_RECOVERY)`.
- existing modal semantics are reused via already registered uiActions path; no new handlers added.
- export-docx-min path remains unchanged in this slice.
- safe reset and restore remain unchanged in this slice.
- X101 toolbarActionToCommandPath replaces the three `LOCAL_MODAL_HANDLER` entries with existing command path references.
- main projectCommands capability binding namespace runtimeBridge preload and UI structure remain unchanged.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-TOOLBAR-SHELL-ACTION-COMMAND-KERNEL-001.md src/renderer/editor.js docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json test/unit/sector-m-toolbar-shell-action-command-kernel.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/renderer/commands/projectCommands.mjs src/renderer/commands/capabilityPolicy.mjs docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json src/renderer/tiptap/runtimeBridge.js src/preload.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-toolbar-shell-action-command-kernel.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_TOOLBAR_SHELL_ACTION_COMMAND_KERNEL_EXECUTION_BRIEF_ONLY
