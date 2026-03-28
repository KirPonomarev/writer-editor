TASK_ID: CORE-A4-YALKEN-PHASE02-RENDERER-SAFE-RESET-DESIGN-STATE-REPLAY-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_RENDERER_RUNTIME_COHERENCE_ONLY
CANON_VERSION: v3.13a-final

## MICRO_GOAL
После успешного safe-reset-shell переигрывать текущий theme and typography design_state в dormant runtime, чтобы runtime design_state не оставался пустым после runtime.safeReset.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-SAFE-RESET-DESIGN-STATE-REPLAY-001.md
- src/renderer/editor.js
- test/unit/sector-m-design-os-safe-reset-design-state-replay.test.js

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
- one narrow replay helper exists for post-safe-reset design_state replay.
- helper calls commitDesignOsDormantTypographyDesignPatch with syncPreview false.
- helper calls commitDesignOsDormantThemeDesignPatch with syncPreview false.
- helper triggers one final syncDesignOsDormantContext call.
- performSafeResetShell still calls designOsDormantRuntimeMount.ports.safeResetShell.
- replay helper is called only on safeResetShell success path.
- replay runs after baseline local theme font font-size and line-height state is already applied.
- safe-reset layout translation and baseline fallback path remain unchanged.
- performRestoreLastStableShell remains unchanged.
- typography and theme patch helper semantics remain unchanged.
- save boundary truth hash logic remains unchanged.
- profile workspace and shell mappings remain unchanged.
- command palette token css layout commit and document context truth paths remain compatible.
- no new controls and no new command ids.
- no preload main html css command seam or status record changes.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-SAFE-RESET-DESIGN-STATE-REPLAY-001.md src/renderer/editor.js test/unit/sector-m-design-os-safe-reset-design-state-replay.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/capabilityPolicy.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/palette-groups.v1.mjs src/renderer/commands/projectCommands.mjs src/renderer/commands/flowMode.mjs AGENTS.md docs/PROCESS.md test/unit/sector-m-design-os-theme-design-state.test.js test/unit/sector-m-design-os-typography-design-state.test.js test/unit/sector-m-design-os-save-boundary-truth-sync.test.js test/unit/sector-m-design-os-document-context-truth.test.js test/unit/sector-m-design-os-shell-mode-adoption.test.js test/unit/sector-m-design-os-profile-adoption.test.js test/unit/sector-m-design-os-command-palette-visibility.test.js test/unit/sector-m-design-os-token-css-adoption.test.js test/unit/sector-m-design-os-layout-commit-sync.test.js test/unit/sector-m-design-os-restore-last-stable-adoption.test.js test/unit/sector-m-design-os-safe-reset-adoption.test.js test/unit/sector-m-design-os-warning-hints.test.js test/unit/sector-m-design-os-status-hints.test.js test/unit/sector-m-design-os-dormant-observability.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-design-os-safe-reset-design-state-replay.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_SAFE_RESET_DESIGN_STATE_REPLAY_EXECUTION_BRIEF_ONLY
