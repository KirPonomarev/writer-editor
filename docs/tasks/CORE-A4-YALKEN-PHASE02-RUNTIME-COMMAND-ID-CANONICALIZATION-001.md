TASK_ID: CORE-A4-YALKEN-PHASE02-RUNTIME-COMMAND-ID-CANONICALIZATION-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_RUNTIME_COMMAND_ID_CANONICALIZATION_ONLY
CANON_VERSION: v3.13a_final

## MICRO_GOAL
Канонизировать runtime payload для уже адоптированных menu shell ids: main передает commandId envelope, editor non-tiptap и tiptap runtime bridge сначала обрабатывают payload.commandId для десяти target ids, при сохранении legacy payload.command как backward compatibility.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-RUNTIME-COMMAND-ID-CANONICALIZATION-001.md
- src/main.js
- src/renderer/editor.js
- src/renderer/tiptap/runtimeBridge.js
- test/unit/sector-m-runtime-command-id-canonicalization.test.js

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
- docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json

## CONTRACT
- main adds one narrow canonical runtime command envelope path for ten adopted ids via commandId payload.
- menu handlers for the ten adopted ids emit canonical commandId payload and keep legacy command only as compatibility.
- editor non-tiptap runtime consumer handles payload.commandId first for the same ten ids via existing dispatchUiCommand path.
- runtimeBridge handles payload.commandId first for the same ten ids via existing runtimeHandlers including one switchMode handler with fixed modes plan review write.
- open-export-preview stays unchanged and remains outside commandId canonicalization in this slice.
- projectCommands capability binding namespace preload and tiptap index stay unchanged.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-RUNTIME-COMMAND-ID-CANONICALIZATION-001.md src/main.js src/renderer/editor.js src/renderer/tiptap/runtimeBridge.js test/unit/sector-m-runtime-command-id-canonicalization.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/renderer/commands/projectCommands.mjs src/renderer/commands/capabilityPolicy.mjs docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json src/preload.js src/renderer/tiptap/index.js src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/index.html src/renderer/styles.css docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-runtime-command-id-canonicalization.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_RUNTIME_COMMAND_ID_CANONICALIZATION_EXECUTION_BRIEF_ONLY
