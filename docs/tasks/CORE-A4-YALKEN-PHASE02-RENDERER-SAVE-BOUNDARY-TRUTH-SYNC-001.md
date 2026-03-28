TASK_ID: CORE-A4-YALKEN-PHASE02-RENDERER-SAVE-BOUNDARY-TRUTH-SYNC-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_RENDERER_RUNTIME_LIFECYCLE_ONLY
CANON_VERSION: v3.13a-final

## MICRO_GOAL
Обновлять dormant runtime product truth на существующей save autosave границе onSetDirty true->false через hash guard, без continuous remounting.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-SAVE-BOUNDARY-TRUTH-SYNC-001.md
- src/renderer/editor.js
- test/unit/sector-m-design-os-save-boundary-truth-sync.test.js

## DENYLIST
- src/main.js
- src/preload.js
- src/renderer/index.html
- src/renderer/styles.css
- src/renderer/commands/capabilityPolicy.mjs
- src/renderer/commands/commandBusGuard.mjs
- src/renderer/commands/runCommand.mjs
- src/renderer/commands/command-catalog.v1.mjs
- src/renderer/commands/palette-groups.v1.mjs
- src/renderer/commands/projectCommands.mjs
- src/renderer/commands/flowMode.mjs
- AGENTS.md
- docs/PROCESS.md
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
- editor.js imports buildProductTruthHash from design-os index.
- one local last synced dormant product truth hash is tracked.
- remountDesignOsDormantRuntimeForCurrentDocumentContext updates last synced hash after successful remount.
- one narrow save-boundary helper compares current truth hash against last synced hash.
- helper runs only on onSetDirty transition true->false.
- helper skips remount when hash matches.
- helper does not use status text parsing.
- no remount on every editor input.
- no remount on every resize.
- direct remount paths remain unchanged:
  - onEditorSetText success
  - handleFlowModeOpenUiPath success
  - handleFlowModeSaveUiPath success
- profile workspace and shell mappings remain unchanged.
- command palette token css layout commit safe reset restore paths remain compatible.
- no new controls and no new command ids.
- no preload main html css command seam or status record changes.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-SAVE-BOUNDARY-TRUTH-SYNC-001.md src/renderer/editor.js test/unit/sector-m-design-os-save-boundary-truth-sync.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/capabilityPolicy.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/palette-groups.v1.mjs src/renderer/commands/projectCommands.mjs src/renderer/commands/flowMode.mjs AGENTS.md docs/PROCESS.md test/unit/sector-m-design-os-document-context-truth.test.js test/unit/sector-m-design-os-shell-mode-adoption.test.js test/unit/sector-m-design-os-profile-adoption.test.js test/unit/sector-m-design-os-command-palette-visibility.test.js test/unit/sector-m-design-os-token-css-adoption.test.js test/unit/sector-m-design-os-layout-commit-sync.test.js test/unit/sector-m-design-os-restore-last-stable-adoption.test.js test/unit/sector-m-design-os-safe-reset-adoption.test.js test/unit/sector-m-design-os-warning-hints.test.js test/unit/sector-m-design-os-status-hints.test.js test/unit/sector-m-design-os-dormant-observability.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-design-os-save-boundary-truth-sync.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_SAVE_BOUNDARY_TRUTH_SYNC_EXECUTION_BRIEF_ONLY
