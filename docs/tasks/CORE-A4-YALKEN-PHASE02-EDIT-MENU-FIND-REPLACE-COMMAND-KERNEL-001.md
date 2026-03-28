TASK_ID: CORE-A4-YALKEN-PHASE02-EDIT-MENU-FIND-REPLACE-COMMAND-KERNEL-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_EDIT_MENU_FIND_REPLACE_COMMAND_KERNEL_ONLY
CANON_VERSION: v3.13a_final

## MICRO_GOAL
Поднять уже существующие команды `cmd.project.edit.find` и `cmd.project.edit.replace` в Edit menu main с canonical runtime emission, добавить их canonical consumption в editor и tiptap runtime bridge, и зафиксировать Find Replace в X101 menu lock без расширения clipboard scope.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-EDIT-MENU-FIND-REPLACE-COMMAND-KERNEL-001.md
- src/main.js
- src/renderer/editor.js
- src/renderer/tiptap/runtimeBridge.js
- docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json
- test/unit/sector-m-edit-menu-find-replace-command-kernel.test.js

## DENYLIST
- src/renderer/commands/projectCommands.mjs
- src/renderer/commands/capabilityPolicy.mjs
- docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json
- docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json
- src/preload.js
- src/renderer/tiptap/index.js
- src/renderer/commands/command-catalog.v1.mjs
- src/renderer/commands/registry.mjs
- src/renderer/commands/commandBusGuard.mjs
- src/renderer/commands/runCommand.mjs
- src/renderer/index.html
- src/renderer/styles.css

## CONTRACT
- main edit menu includes command items for Find and Replace via existing ids `cmd.project.edit.find` and `cmd.project.edit.replace` with existing accelerators `CmdOrCtrl+F` and `CmdOrCtrl+H`.
- X101 menu lock records Find Replace as commandId items and keeps Copy Paste Select All as role items.
- main adds menu command handlers for both ids and emits canonical runtime command envelopes using existing ids.
- editor canonical runtime consumer handles both ids via existing find replace behavior.
- editor tiptap runtime handler exposure includes existing find and replace behaviors.
- runtimeBridge canonical consumer handles both ids via runtimeHandlers find and replace; legacy string search replace remains compatibility fallback.
- projectCommands capability binding namespace preload and tiptap index remain unchanged.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-EDIT-MENU-FIND-REPLACE-COMMAND-KERNEL-001.md src/main.js src/renderer/editor.js src/renderer/tiptap/runtimeBridge.js docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json test/unit/sector-m-edit-menu-find-replace-command-kernel.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/renderer/commands/projectCommands.mjs src/renderer/commands/capabilityPolicy.mjs docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json src/preload.js src/renderer/tiptap/index.js src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/index.html src/renderer/styles.css
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-edit-menu-find-replace-command-kernel.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_EDIT_MENU_FIND_REPLACE_COMMAND_KERNEL_EXECUTION_BRIEF_ONLY
