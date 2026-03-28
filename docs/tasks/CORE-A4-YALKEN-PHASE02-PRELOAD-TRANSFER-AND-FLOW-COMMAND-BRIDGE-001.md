TASK_ID: CORE-A4-YALKEN-PHASE02-PRELOAD-TRANSFER-AND-FLOW-COMMAND-BRIDGE-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_PRELOAD_MAIN_TRANSFER_AND_FLOW_COMMAND_ONLY
CANON_VERSION: v3.13a_final

## MICRO_GOAL
Перевести cmd.project.export.docxMin cmd.project.importMarkdownV1 cmd.project.exportMarkdownV1 cmd.project.flowOpenV1 и cmd.project.flowSaveV1 в projectCommands на существующий invokeUiCommandBridge, расширив allowlist ui:command-bridge в main и переиспользуя существующие backend handlers без входа в UI и соседние bridge-кластеры.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-PRELOAD-TRANSFER-AND-FLOW-COMMAND-BRIDGE-001.md
- src/renderer/commands/projectCommands.mjs
- src/main.js
- test/unit/sector-m-preload-transfer-and-flow-command-bridge.test.js

## DENYLIST
- src/renderer/editor.js
- src/preload.js
- src/renderer/tiptap/index.js
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
- projectCommands switches five transfer and flow commands from direct preload ipc calls to invokeUiCommandBridge with route command.bus.
- command ids stay existing: cmd.project.export.docxMin cmd.project.importMarkdownV1 cmd.project.exportMarkdownV1 cmd.project.flowOpenV1 cmd.project.flowSaveV1.
- payload validation error mapping and result shapes remain compatible for exported imported opened saved markdown lossReport outPath bytesWritten snapshotCreated savedCount.
- main ui:command-bridge allowlist expands by these five ids only in addition to already adopted ids.
- main reuses existing handleExportDocxMin handleImportMarkdownV1 handleExportMarkdownV1 handleFlowOpenV1 and handleFlowSaveV1 semantics via menu command handlers.
- preload editor tiptap capability binding and namespace docs remain unchanged.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-PRELOAD-TRANSFER-AND-FLOW-COMMAND-BRIDGE-001.md src/renderer/commands/projectCommands.mjs src/main.js test/unit/sector-m-preload-transfer-and-flow-command-bridge.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/renderer/editor.js src/preload.js src/renderer/tiptap/index.js src/renderer/commands/capabilityPolicy.mjs docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/index.html src/renderer/styles.css AGENTS.md docs/PROCESS.md
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-preload-transfer-and-flow-command-bridge.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_PRELOAD_TRANSFER_AND_FLOW_COMMAND_BRIDGE_EXECUTION_BRIEF_ONLY
