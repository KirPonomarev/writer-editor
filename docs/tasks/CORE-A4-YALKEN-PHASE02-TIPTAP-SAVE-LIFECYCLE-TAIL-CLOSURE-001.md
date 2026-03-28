TASK_ID: CORE-A4-YALKEN-PHASE02-TIPTAP-SAVE-LIFECYCLE-TAIL-CLOSURE-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_TIPTAP_RESIDUAL_SAVE_LIFECYCLE_SIGNAL_ONLY
CANON_VERSION: v3.13a_final

## MICRO_GOAL
Закрыть остаточный tiptap dirty signal tail через существующий save lifecycle signal bridge, не открывая autosave adoption и не трогая editor preload main.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-TIPTAP-SAVE-LIFECYCLE-TAIL-CLOSURE-001.md
- src/renderer/tiptap/index.js
- test/unit/sector-m-tiptap-save-lifecycle-tail-closure.test.js

## DENYLIST
- src/renderer/editor.js
- src/preload.js
- src/main.js
- src/renderer/tiptap/ipc.js
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
- tiptap index local notifyDirtyState helper uses existing invokeSaveLifecycleSignalBridge with signal.localDirty.set only.
- payload passes boolean dirty state only.
- existing false on external apply and true on editor update semantics stay unchanged.
- requestAutoSave path remains out of scope.
- editor preload main and tiptap ipc remain unchanged.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-TIPTAP-SAVE-LIFECYCLE-TAIL-CLOSURE-001.md src/renderer/tiptap/index.js test/unit/sector-m-tiptap-save-lifecycle-tail-closure.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/renderer/editor.js src/preload.js src/main.js src/renderer/tiptap/ipc.js src/renderer/commands/projectCommands.mjs src/renderer/commands/capabilityPolicy.mjs docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/index.html src/renderer/styles.css AGENTS.md docs/PROCESS.md
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-tiptap-save-lifecycle-tail-closure.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_TIPTAP_SAVE_LIFECYCLE_TAIL_CLOSURE_EXECUTION_BRIEF_ONLY
