TASK_ID: CORE-A4-YALKEN-PHASE02-EDIT-MENU-UNDO-REDO-COMMAND-KERNEL-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_EDIT_MENU_UNDO_REDO_COMMAND_KERNEL_ONLY
CANON_VERSION: v3.13a_final

## MICRO_GOAL
Перевести существующие Edit menu Undo и Redo с native role пути на уже существующие command ids `cmd.project.edit.undo` и `cmd.project.edit.redo`, чтобы они проходили через command kernel и canonical runtime command path в main editor и tiptap bridge с сохранением legacy undo redo string как backward compatibility.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-EDIT-MENU-UNDO-REDO-COMMAND-KERNEL-001.md
- src/main.js
- src/renderer/editor.js
- src/renderer/tiptap/runtimeBridge.js
- docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json
- test/unit/sector-m-edit-menu-undo-redo-command-kernel.test.js

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
- main edit menu replaces role Undo and role Redo with commandItem entries for existing `cmd.project.edit.undo` and `cmd.project.edit.redo` with equivalent accelerators.
- X101 menu map lock replaces Undo and Redo role items with commandId items and keeps Copy Paste Select All as role items.
- main adds menu command handlers for both ids and emits runtime via canonical commandId path.
- editor non-tiptap canonical runtime consumer accepts both ids and reuses existing undo redo behavior.
- tiptap runtime bridge canonical consumer accepts both ids and reuses bridge undo redo behavior.
- legacy `undo` `edit-undo` `redo` `edit-redo` support remains only as compatibility fallback.
- projectCommands capability binding command namespace preload and tiptap index remain unchanged.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-EDIT-MENU-UNDO-REDO-COMMAND-KERNEL-001.md src/main.js src/renderer/editor.js src/renderer/tiptap/runtimeBridge.js docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json test/unit/sector-m-edit-menu-undo-redo-command-kernel.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/renderer/commands/projectCommands.mjs src/renderer/commands/capabilityPolicy.mjs docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json src/preload.js src/renderer/tiptap/index.js src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/index.html src/renderer/styles.css
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-edit-menu-undo-redo-command-kernel.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_EDIT_MENU_UNDO_REDO_COMMAND_KERNEL_EXECUTION_BRIEF_ONLY
