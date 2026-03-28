TASK_ID: CORE-A4-YALKEN-PHASE02-PRELOAD-WORKSPACE-QUERY-BRIDGE-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_PRELOAD_MAIN_PROJECT_WORKSPACE_QUERY_ONLY
CANON_VERSION: v3.13a_final

## MICRO_GOAL
Перевести loadTree и initializeCollabScopeLocal на typed preload main query bridge с сохранением существующих semantic и без rework autosave signal или command bridge paths.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-PRELOAD-WORKSPACE-QUERY-BRIDGE-001.md
- src/renderer/editor.js
- src/preload.js
- src/main.js
- test/unit/sector-m-preload-workspace-query-bridge.test.js

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
- preload exposes exactly one new typed project workspace query bridge api.
- main exposes exactly one new handler for query bridge with allowlist query.projectTree and query.collabScopeLocal only.
- editor loadTree and initializeCollabScopeLocal use query bridge and stop direct getProjectTree getCollabScopeLocal calls.
- existing projectTree and collabScopeLocal semantic shapes are reused via existing handler logic.
- existing preload getProjectTree getCollabScopeLocal apis may remain for compatibility.
- requestAutoSave notifyDirtyState and ui command bridge remain unchanged.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-PRELOAD-WORKSPACE-QUERY-BRIDGE-001.md src/renderer/editor.js src/preload.js src/main.js test/unit/sector-m-preload-workspace-query-bridge.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/renderer/commands/projectCommands.mjs src/renderer/commands/capabilityPolicy.mjs docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/index.html src/renderer/styles.css AGENTS.md docs/PROCESS.md
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-preload-workspace-query-bridge.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_PRELOAD_WORKSPACE_QUERY_BRIDGE_EXECUTION_BRIEF_ONLY
