TASK_ID: CORE-A4-YALKEN-PHASE02-PRELOAD-UI-COMMAND-BRIDGE-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_PRELOAD_MAIN_UI_COMMAND_BRIDGE_ONLY
CANON_VERSION: v3.13a_final

## MICRO_GOAL
Перевести cmd.ui.theme.set cmd.ui.font.set и cmd.ui.fontSize.set на узкий preload main invoke bridge с route command.bus и выполнением через existing main command dispatch.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-PRELOAD-UI-COMMAND-BRIDGE-001.md
- src/renderer/editor.js
- src/preload.js
- src/main.js
- test/unit/sector-m-preload-ui-command-bridge.test.js

## DENYLIST
- src/renderer/commands/projectCommands.mjs
- src/renderer/commands/capabilityPolicy.mjs
- docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json
- docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json
- src/renderer/commands/commandBusGuard.mjs
- src/renderer/commands/runCommand.mjs
- src/renderer/commands/command-catalog.v1.mjs
- src/renderer/commands/registry.mjs
- src/renderer/index.html
- src/renderer/styles.css
- AGENTS.md
- docs/PROCESS.md

## CONTRACT
- preload exposes one new typed invoke bridge API for route commandId payload.
- main exposes one new bridge handler and accepts only route command.bus and ids cmd.ui.theme.set cmd.ui.font.set cmd.ui.fontSize.set.
- bridge execution goes via dispatchMenuCommand.
- editor handleUiSetThemeCommand handleUiSetFontCommand handleUiSetFontSizeCommand use new bridge and keep payload validation.
- legacy preload paths setTheme setFont setFontSizePx remain present for internal non-command sync.
- safe reset restore and tree document data fetch paths remain unchanged.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-PRELOAD-UI-COMMAND-BRIDGE-001.md src/renderer/editor.js src/preload.js src/main.js test/unit/sector-m-preload-ui-command-bridge.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/renderer/commands/projectCommands.mjs src/renderer/commands/capabilityPolicy.mjs docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/index.html src/renderer/styles.css AGENTS.md docs/PROCESS.md
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-preload-ui-command-bridge.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_PRELOAD_UI_COMMAND_BRIDGE_EXECUTION_BRIEF_ONLY
