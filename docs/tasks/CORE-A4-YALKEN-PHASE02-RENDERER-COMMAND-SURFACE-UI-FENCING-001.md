TASK_ID: CORE-A4-YALKEN-PHASE02-RENDERER-COMMAND-SURFACE-UI-FENCING-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_COMMAND_KERNEL_AND_RENDERER_SURFACE_ONLY
CANON_VERSION: v3.13a-final

## MICRO_GOAL
Убрать оставшиеся user-initiated direct IPC bypass в renderer surfaces: перевести theme, font, font-size и left-toolbar new/open на dispatchUiCommand с существующими command ids, без main.js and preload.js changes.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-COMMAND-SURFACE-UI-FENCING-001.md
- src/renderer/editor.js
- src/renderer/commands/projectCommands.mjs
- docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json
- test/unit/sector-m-command-surface-ui-fencing.test.js

## DENYLIST
- src/main.js
- src/preload.js
- src/renderer/commands/capabilityPolicy.mjs
- src/renderer/commands/commandBusGuard.mjs
- src/renderer/commands/runCommand.mjs
- src/renderer/commands/command-catalog.v1.mjs
- src/renderer/commands/registry.mjs
- src/renderer/index.html
- src/renderer/styles.css
- AGENTS.md
- docs/PROCESS.md
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
- COMMAND_NAMESPACE_CANON admits only explicit aliases for cmd.ui.theme.set cmd.ui.font.set cmd.ui.fontSize.set.
- projectCommands registers these three existing cmd.ui ids through renderer registry.
- handlers route only through uiActions.setTheme setFont setFontSize.
- editor exposes uiActions implementations with narrow payload validation.
- theme-dark theme-light and settingsThemeSelect use dispatchUiCommand.
- fontSelect and sizeSelect routes use dispatchUiCommand.
- custom font-size prompt success path routes through dispatchUiCommand.
- left-toolbar and hotkey new/open remain on existing project command dispatch path.
- safe-reset restore loadSavedTheme loadSavedFont onThemeChanged onFontChanged onEditorSetFontSize remain unchanged.
- no new command ids and no command palette structure change.
- no main preload command-seam html css or status record changes.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-COMMAND-SURFACE-UI-FENCING-001.md src/renderer/editor.js src/renderer/commands/projectCommands.mjs docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json test/unit/sector-m-command-surface-ui-fencing.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/commands/capabilityPolicy.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/index.html src/renderer/styles.css AGENTS.md docs/PROCESS.md test/unit/sector-m-design-os-restore-last-stable-preview-refresh.test.js test/unit/sector-m-design-os-safe-reset-design-state-replay.test.js test/unit/sector-m-design-os-theme-design-state.test.js test/unit/sector-m-design-os-typography-design-state.test.js test/unit/sector-m-design-os-save-boundary-truth-sync.test.js test/unit/sector-m-design-os-document-context-truth.test.js test/unit/sector-m-design-os-shell-mode-adoption.test.js test/unit/sector-m-design-os-profile-adoption.test.js test/unit/sector-m-design-os-command-palette-visibility.test.js test/unit/sector-m-design-os-token-css-adoption.test.js test/unit/sector-m-design-os-layout-commit-sync.test.js test/unit/sector-m-design-os-restore-last-stable-adoption.test.js test/unit/sector-m-design-os-safe-reset-adoption.test.js test/unit/sector-m-design-os-warning-hints.test.js test/unit/sector-m-design-os-status-hints.test.js test/unit/sector-m-design-os-dormant-observability.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-command-surface-ui-fencing.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_COMMAND_SURFACE_UI_FENCING_EXECUTION_BRIEF_ONLY
