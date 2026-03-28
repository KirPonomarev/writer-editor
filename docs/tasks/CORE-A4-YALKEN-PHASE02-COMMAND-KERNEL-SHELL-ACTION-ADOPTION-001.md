TASK_ID: CORE-A4-YALKEN-PHASE02-COMMAND-KERNEL-SHELL-ACTION-ADOPTION-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_COMMAND_KERNEL_SHELL_ACTION_ONLY
CANON_VERSION: v3.13a_final

## MICRO_GOAL
Ввести существующие menu shell action ids в renderer command kernel и capability policy: cmd.project.view.openSettings cmd.project.view.safeReset cmd.project.view.restoreLastStable cmd.project.tools.openDiagnostics cmd.project.review.openRecovery cmd.project.plan.switchMode cmd.project.review.switchMode cmd.project.window.switchModeWrite.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-COMMAND-KERNEL-SHELL-ACTION-ADOPTION-001.md
- src/renderer/commands/projectCommands.mjs
- src/renderer/editor.js
- src/renderer/commands/capabilityPolicy.mjs
- docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json
- test/unit/sector-m-command-kernel-shell-action-adoption.test.js

## DENYLIST
- src/main.js
- src/preload.js
- src/renderer/tiptap/index.js
- docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json
- src/renderer/commands/command-catalog.v1.mjs
- src/renderer/commands/registry.mjs
- src/renderer/commands/commandBusGuard.mjs
- src/renderer/commands/runCommand.mjs
- src/renderer/index.html
- src/renderer/styles.css
- docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json

## CONTRACT
- projectCommands defines and registers the eight existing shell action ids using runUiAction only.
- editor exposes uiActions openSettings safeResetShell restoreLastStableShell openDiagnostics openRecovery and switchMode for command registry.
- mode switch commands reuse one existing switchMode action with fixed mode values write plan review.
- capabilityPolicy and COMMAND_CAPABILITY_BINDING contain matching entries for all eight shell action ids.
- capability matrix has explicit node web mobile-wrapper values for new capabilities.
- main preload index namespace and bridge contours remain unchanged.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-COMMAND-KERNEL-SHELL-ACTION-ADOPTION-001.md src/renderer/commands/projectCommands.mjs src/renderer/editor.js src/renderer/commands/capabilityPolicy.mjs docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json test/unit/sector-m-command-kernel-shell-action-adoption.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/tiptap/index.js docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/index.html src/renderer/styles.css docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-command-kernel-shell-action-adoption.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_COMMAND_KERNEL_SHELL_ACTION_ADOPTION_EXECUTION_BRIEF_ONLY
