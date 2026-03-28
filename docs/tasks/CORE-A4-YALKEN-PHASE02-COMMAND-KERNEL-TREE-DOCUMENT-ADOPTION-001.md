TASK_ID: CORE-A4-YALKEN-PHASE02-COMMAND-KERNEL-TREE-DOCUMENT-ADOPTION-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_COMMAND_KERNEL_AND_RENDERER_TREE_ACTIONS_ONLY
CANON_VERSION: v3.13a-final

## MICRO_GOAL
Перевести user-initiated tree and document actions в editor на command kernel path через dispatchUiCommand и закрепить их capability binding в runtime and docs.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-COMMAND-KERNEL-TREE-DOCUMENT-ADOPTION-001.md
- src/renderer/editor.js
- src/renderer/commands/projectCommands.mjs
- src/renderer/commands/capabilityPolicy.mjs
- docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json
- test/unit/sector-m-command-kernel-tree-document-adoption.test.js

## DENYLIST
- src/main.js
- src/preload.js
- docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json
- src/renderer/commands/commandBusGuard.mjs
- src/renderer/commands/runCommand.mjs
- src/renderer/commands/command-catalog.v1.mjs
- src/renderer/commands/registry.mjs
- src/renderer/index.html
- src/renderer/styles.css
- AGENTS.md
- docs/PROCESS.md
- test/unit/sector-m-command-kernel-ui-capability-lock.test.js
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

## CONTRACT
- projectCommands defines stable ids for cmd.project.document.open and cmd.project.tree.* actions.
- projectCommands registers all five commands without command catalog expansion.
- handlers use electronAPI openDocument createNode renameNode deleteNode reorderNode only.
- capabilityPolicy and COMMAND_CAPABILITY_BINDING include exact matching entries for these five commands.
- node platform allows these five capabilities; web and mobile-wrapper keep them disabled.
- editor openDocumentNode handleCreateNode handleRenameNode handleDeleteNode handleReorderNode route through dispatchUiCommand with validated payload.
- tree row click and context menu actions continue through openDocumentNode and tree handlers.
- loadTree and getProjectTree remain unchanged.
- notifyDirtyState requestAutoSave getCollabScopeLocal and other signal paths remain unchanged.
- no main preload command namespace command bus command catalog registry html css changes.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-COMMAND-KERNEL-TREE-DOCUMENT-ADOPTION-001.md src/renderer/editor.js src/renderer/commands/projectCommands.mjs src/renderer/commands/capabilityPolicy.mjs docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json test/unit/sector-m-command-kernel-tree-document-adoption.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/index.html src/renderer/styles.css AGENTS.md docs/PROCESS.md test/unit/sector-m-command-kernel-ui-capability-lock.test.js test/unit/sector-m-command-surface-ui-fencing.test.js test/unit/sector-m-design-os-restore-last-stable-preview-refresh.test.js test/unit/sector-m-design-os-safe-reset-design-state-replay.test.js test/unit/sector-m-design-os-theme-design-state.test.js test/unit/sector-m-design-os-typography-design-state.test.js test/unit/sector-m-design-os-save-boundary-truth-sync.test.js test/unit/sector-m-design-os-document-context-truth.test.js test/unit/sector-m-design-os-shell-mode-adoption.test.js test/unit/sector-m-design-os-profile-adoption.test.js test/unit/sector-m-design-os-command-palette-visibility.test.js test/unit/sector-m-design-os-token-css-adoption.test.js test/unit/sector-m-design-os-layout-commit-sync.test.js test/unit/sector-m-design-os-restore-last-stable-adoption.test.js test/unit/sector-m-design-os-safe-reset-adoption.test.js test/unit/sector-m-design-os-warning-hints.test.js test/unit/sector-m-design-os-status-hints.test.js test/unit/sector-m-design-os-dormant-observability.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-command-kernel-tree-document-adoption.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_COMMAND_KERNEL_TREE_DOCUMENT_ADOPTION_EXECUTION_BRIEF_ONLY
