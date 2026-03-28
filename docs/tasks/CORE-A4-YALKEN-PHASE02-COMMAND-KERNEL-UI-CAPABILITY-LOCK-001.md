TASK_ID: CORE-A4-YALKEN-PHASE02-COMMAND-KERNEL-UI-CAPABILITY-LOCK-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_COMMAND_KERNEL_STABILIZATION_ONLY
CANON_VERSION: v3.13a-final

## MICRO_GOAL
Закрепить существующие cmd.ui.theme.set, cmd.ui.font.set и cmd.ui.fontSize.set в command kernel через capability policy и command capability binding, без изменений renderer main preload и UI структуры.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-COMMAND-KERNEL-UI-CAPABILITY-LOCK-001.md
- src/renderer/commands/capabilityPolicy.mjs
- docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json
- test/unit/sector-m-command-kernel-ui-capability-lock.test.js

## DENYLIST
- src/main.js
- src/preload.js
- src/renderer/editor.js
- src/renderer/commands/projectCommands.mjs
- docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json
- src/renderer/commands/commandBusGuard.mjs
- src/renderer/commands/runCommand.mjs
- src/renderer/commands/command-catalog.v1.mjs
- src/renderer/commands/registry.mjs
- src/renderer/index.html
- src/renderer/styles.css
- AGENTS.md
- docs/PROCESS.md
- test/unit/sector-m-command-surface-ui-fencing.test.js
- test/unit/sector-m-design-os-restore-last-stable-preview-refresh.test.js
- test/unit/sector-m-design-os-safe-reset-design-state-replay.test.js
- test/unit/sector-m-design-os-theme-design-state.test.js
- test/unit/sector-m-design-os-typography-design-state.test.js
- test/unit/sector-m-design-os-save-boundary-truth-sync.test.js
- test/unit/sector-m-design-os-document-context-truth.test.js
- test/unit/sector-m-design-os-shell-mode-adoption.test.js
- test/unit/sector-m-design-os-profile-adoption.test.js
- test/unit/sector-m-design-os-command-palette-visibility.test.js
- test/unit/sector-m-design-os-token-css-adoption.test.js
- test/unit/sector-m-design-os-layout-commit-sync.test.js
- test/unit/sector-m-design-os-restore-last-stable-adoption.test.js
- test/unit/sector-m-design-os-safe-reset-adoption.test.js
- test/unit/sector-m-design-os-warning-hints.test.js
- test/unit/sector-m-design-os-status-hints.test.js
- test/unit/sector-m-design-os-dormant-observability.test.js
- test/unit/sector-m-tiptap-runtime-bridge.test.js
- docs/OPS/STATUS

## CONTRACT
- capabilityPolicy adds bindings for cmd.ui.theme.set cmd.ui.font.set cmd.ui.fontSize.set.
- capabilityPolicy matrix includes matching cap.ui.* entries for node web and mobile-wrapper.
- node allows all three cap.ui.* entries.
- web and mobile-wrapper keep all three cap.ui.* entries disabled.
- COMMAND_CAPABILITY_BINDING.json includes same three command to capability mappings.
- runtime and docs command-capability mappings match exactly.
- no new command ids.
- projectCommands editor commandNamespace main preload commandBus runCommand remain unchanged.
- no UI structure or visible control changes.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-COMMAND-KERNEL-UI-CAPABILITY-LOCK-001.md src/renderer/commands/capabilityPolicy.mjs docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json test/unit/sector-m-command-kernel-ui-capability-lock.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/editor.js src/renderer/commands/projectCommands.mjs docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/index.html src/renderer/styles.css AGENTS.md docs/PROCESS.md test/unit/sector-m-command-surface-ui-fencing.test.js test/unit/sector-m-design-os-restore-last-stable-preview-refresh.test.js test/unit/sector-m-design-os-safe-reset-design-state-replay.test.js test/unit/sector-m-design-os-theme-design-state.test.js test/unit/sector-m-design-os-typography-design-state.test.js test/unit/sector-m-design-os-save-boundary-truth-sync.test.js test/unit/sector-m-design-os-document-context-truth.test.js test/unit/sector-m-design-os-shell-mode-adoption.test.js test/unit/sector-m-design-os-profile-adoption.test.js test/unit/sector-m-design-os-command-palette-visibility.test.js test/unit/sector-m-design-os-token-css-adoption.test.js test/unit/sector-m-design-os-layout-commit-sync.test.js test/unit/sector-m-design-os-restore-last-stable-adoption.test.js test/unit/sector-m-design-os-safe-reset-adoption.test.js test/unit/sector-m-design-os-warning-hints.test.js test/unit/sector-m-design-os-status-hints.test.js test/unit/sector-m-design-os-dormant-observability.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-command-kernel-ui-capability-lock.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_COMMAND_KERNEL_UI_CAPABILITY_LOCK_EXECUTION_BRIEF_ONLY
