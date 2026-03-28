TASK_ID: CORE-A4-YALKEN-PHASE02-PRELOAD-SAVE-LIFECYCLE-SIGNAL-BRIDGE-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_PRELOAD_MAIN_SAVE_LIFECYCLE_SIGNAL_ONLY
CANON_VERSION: v3.13a_final

## MICRO_GOAL
Перевести notifyDirtyState и requestAutoSave на typed preload main save lifecycle signal bridge с сохранением существующих dirty changed и autosave semantic и без rework command bridge или workspace query bridge.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-PRELOAD-SAVE-LIFECYCLE-SIGNAL-BRIDGE-001.md
- src/renderer/editor.js
- src/preload.js
- src/main.js
- test/unit/sector-m-preload-save-lifecycle-signal-bridge.test.js

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
- preload exposes exactly one new typed save lifecycle signal bridge api.
- main exposes exactly one new signal bridge handler and allows signal.localDirty.set and signal.autoSave.request only.
- editor flow mode open save markAsModified and scheduleAutoSave switch to signal bridge and stop direct notifyDirtyState requestAutoSave calls.
- localDirty signal reuses dirty changed semantics with boolean payload only.
- autosave signal reuses existing ui:request-autosave semantics and result shape.
- existing notifyDirtyState and requestAutoSave preload apis may remain for compatibility.
- ui command bridge and workspace query bridge remain unchanged.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-PRELOAD-SAVE-LIFECYCLE-SIGNAL-BRIDGE-001.md src/renderer/editor.js src/preload.js src/main.js test/unit/sector-m-preload-save-lifecycle-signal-bridge.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/renderer/commands/projectCommands.mjs src/renderer/commands/capabilityPolicy.mjs docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/index.html src/renderer/styles.css AGENTS.md docs/PROCESS.md
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-preload-save-lifecycle-signal-bridge.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_PRELOAD_SAVE_LIFECYCLE_SIGNAL_BRIDGE_EXECUTION_BRIEF_ONLY
