TASK_ID: CORE-A4-YALKEN-PHASE02-PRELOAD-FILE-LIFECYCLE-COMMAND-BRIDGE-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_PRELOAD_MAIN_FILE_LIFECYCLE_COMMAND_ONLY
CANON_VERSION: v3.13a_final

## MICRO_GOAL
Перевести cmd.project.new cmd.project.open cmd.project.save и cmd.project.saveAs в projectCommands на существующий invokeUiCommandBridge, расширив allowlist ui:command-bridge в main без входа в export import flow и UI scope.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-PRELOAD-FILE-LIFECYCLE-COMMAND-BRIDGE-001.md
- src/renderer/commands/projectCommands.mjs
- src/main.js
- test/unit/sector-m-preload-file-lifecycle-command-bridge.test.js

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
- projectCommands switches four file lifecycle commands from direct file ipc helpers to invokeUiCommandBridge with route command.bus.
- command ids stay existing: cmd.project.new cmd.project.open cmd.project.save cmd.project.saveAs.
- result shapes stay stable: created opened saved savedAs.
- main ui:command-bridge allowlist expands by these four ids only in addition to already adopted ids.
- main reuses existing handleNew handleOpen handleSave handleSaveAs semantics for bridged execution.
- preload editor tiptap capability binding and namespace docs remain unchanged.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-PRELOAD-FILE-LIFECYCLE-COMMAND-BRIDGE-001.md src/renderer/commands/projectCommands.mjs src/main.js test/unit/sector-m-preload-file-lifecycle-command-bridge.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/renderer/editor.js src/preload.js src/renderer/tiptap/index.js src/renderer/commands/capabilityPolicy.mjs docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/index.html src/renderer/styles.css AGENTS.md docs/PROCESS.md
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-preload-file-lifecycle-command-bridge.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_PRELOAD_FILE_LIFECYCLE_COMMAND_BRIDGE_EXECUTION_BRIEF_ONLY
