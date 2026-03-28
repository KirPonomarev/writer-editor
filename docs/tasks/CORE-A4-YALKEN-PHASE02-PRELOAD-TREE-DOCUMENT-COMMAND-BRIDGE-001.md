TASK_ID: CORE-A4-YALKEN-PHASE02-PRELOAD-TREE-DOCUMENT-COMMAND-BRIDGE-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_PRELOAD_MAIN_TREE_DOCUMENT_BRIDGE_ONLY
CANON_VERSION: v3.13a_final

## MICRO_GOAL
Расширить существующий ui command bridge на cmd.project.document.open и cmd.project.tree create rename delete reorder без новых command ids и без изменения preload editor capability binding или command namespace.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-PRELOAD-TREE-DOCUMENT-COMMAND-BRIDGE-001.md
- src/renderer/commands/projectCommands.mjs
- src/main.js
- test/unit/sector-m-preload-tree-document-command-bridge.test.js

## DENYLIST
- src/renderer/editor.js
- src/preload.js
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
- projectCommands tree and document handlers use electronAPI.invokeUiCommandBridge only with route command.bus and existing ids.
- payload validation and command-level result shapes stay compatible.
- main ui command bridge allowlist includes existing cmd.ui ids plus existing cmd.project.document.open and cmd.project.tree ids only.
- main bridge path reuses existing open document and tree semantics through shared helpers.
- existing ui open document and tree channel contracts remain semantically compatible.
- preload editor capability policy binding and namespace canon remain unchanged.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-PRELOAD-TREE-DOCUMENT-COMMAND-BRIDGE-001.md src/renderer/commands/projectCommands.mjs src/main.js test/unit/sector-m-preload-tree-document-command-bridge.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/renderer/editor.js src/preload.js src/renderer/commands/capabilityPolicy.mjs docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/index.html src/renderer/styles.css AGENTS.md docs/PROCESS.md
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-preload-tree-document-command-bridge.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_PRELOAD_TREE_DOCUMENT_COMMAND_BRIDGE_EXECUTION_BRIEF_ONLY
