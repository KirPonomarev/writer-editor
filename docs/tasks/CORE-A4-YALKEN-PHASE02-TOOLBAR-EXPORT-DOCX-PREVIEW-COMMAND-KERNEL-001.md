TASK_ID: CORE-A4-YALKEN-PHASE02-TOOLBAR-EXPORT-DOCX-PREVIEW-COMMAND-KERNEL-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_TOOLBAR_EXPORT_DOCX_PREVIEW_COMMAND_KERNEL_ONLY
CANON_VERSION: v3.13a_final

## MICRO_GOAL
Перевести `toolbar export-docx-min` в editor handleUiAction с прямого `openExportPreviewModal()` на `dispatchUiCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN)` и синхронизировать X101 toolbar action map на direct command kernel reference, без изменения preview modal markup и confirm flow semantics.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-TOOLBAR-EXPORT-DOCX-PREVIEW-COMMAND-KERNEL-001.md
- src/renderer/editor.js
- docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json
- test/unit/sector-m-toolbar-export-docx-preview-command-kernel.test.js

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
- editor handleUiAction export-docx-min uses `dispatchUiCommand(COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN)` instead of direct `openExportPreviewModal`.
- preview-first behavior remains unchanged because existing command path already emits preview-first runtime in main.
- `openExportPreviewModal` and `confirmExportPreviewAndRun` remain unchanged in semantics.
- X101 toolbarActionToCommandPath replaces `COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN_THROUGH_PREVIEW_CONFIRM` with `COMMAND_IDS.PROJECT_EXPORT_DOCX_MIN` for export-docx-min.
- main projectCommands capability binding namespace runtimeBridge preload and UI structure remain unchanged.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-TOOLBAR-EXPORT-DOCX-PREVIEW-COMMAND-KERNEL-001.md src/renderer/editor.js docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json test/unit/sector-m-toolbar-export-docx-preview-command-kernel.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/renderer/commands/projectCommands.mjs src/renderer/commands/capabilityPolicy.mjs docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json src/renderer/tiptap/runtimeBridge.js src/preload.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-toolbar-export-docx-preview-command-kernel.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_TOOLBAR_EXPORT_DOCX_PREVIEW_COMMAND_KERNEL_EXECUTION_BRIEF_ONLY
