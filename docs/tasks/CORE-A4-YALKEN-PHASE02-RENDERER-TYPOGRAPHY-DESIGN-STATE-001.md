TASK_ID: CORE-A4-YALKEN-PHASE02-RENDERER-TYPOGRAPHY-DESIGN-STATE-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_RENDERER_DESIGN_STATE_ADOPTION_ONLY
CANON_VERSION: v3.13a-final

## MICRO_GOAL
Коммитить уже примененную типографику editor state в dormant runtime design_state через design_patch на существующих apply boundary и переигрывать после remount.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-TYPOGRAPHY-DESIGN-STATE-001.md
- src/renderer/editor.js
- test/unit/sector-m-design-os-typography-design-state.test.js

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
- one helper builds current typography design_patch only.
- patch includes only:
  - typography.font.body.family
  - typography.font.body.sizePx
  - typography.scale.body.lineHeight
- patch is built from already applied renderer state.
- applyFont commits typography design_patch when runtime is available.
- onEditorSetFontSize success path commits typography design_patch after size update.
- applyLineHeight commits typography design_patch when runtime is available.
- commit uses commitDesign with design_patch only and commit_point_apply.
- after successful typography commit, preview sync refreshes visible_commands and resolved_tokens.
- remount helper replays typography design_patch after runtime recreation.
- applyFontWeight remains unchanged in this slice.
- applyWordWrap remains unchanged in this slice.
- applyTheme remains unchanged in this slice.
- save boundary truth hash logic remains unchanged.
- profile workspace and shell mode mappings remain unchanged.
- command palette token css layout commit safe reset restore behavior remains compatible.
- no new controls and no new command ids.
- no preload main html css command seam or status record changes.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-TYPOGRAPHY-DESIGN-STATE-001.md src/renderer/editor.js test/unit/sector-m-design-os-typography-design-state.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/capabilityPolicy.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/palette-groups.v1.mjs src/renderer/commands/projectCommands.mjs src/renderer/commands/flowMode.mjs AGENTS.md docs/PROCESS.md test/unit/sector-m-design-os-save-boundary-truth-sync.test.js test/unit/sector-m-design-os-document-context-truth.test.js test/unit/sector-m-design-os-shell-mode-adoption.test.js test/unit/sector-m-design-os-profile-adoption.test.js test/unit/sector-m-design-os-command-palette-visibility.test.js test/unit/sector-m-design-os-token-css-adoption.test.js test/unit/sector-m-design-os-layout-commit-sync.test.js test/unit/sector-m-design-os-restore-last-stable-adoption.test.js test/unit/sector-m-design-os-safe-reset-adoption.test.js test/unit/sector-m-design-os-warning-hints.test.js test/unit/sector-m-design-os-status-hints.test.js test/unit/sector-m-design-os-dormant-observability.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-design-os-typography-design-state.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_TYPOGRAPHY_DESIGN_STATE_EXECUTION_BRIEF_ONLY
