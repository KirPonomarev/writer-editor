TASK_ID: CORE-A4-YALKEN-PHASE02-RENDERER-PROFILE-ADOPTION-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_RENDERER_EXISTING_CONTROL_TO_PROFILE_BINDING_ONLY
CANON_VERSION: v3.13a-final

## MICRO_GOAL
Привязать существующий style selector к dormant Design OS profile без изменения UI структуры, чтобы default давал BASELINE, focus давал FOCUS и существующий preview sync сразу обновлял visible commands и token CSS.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-PROFILE-ADOPTION-001.md
- src/renderer/editor.js
- test/unit/sector-m-design-os-profile-adoption.test.js

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
- AGENTS.md
- docs/PROCESS.md
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
- buildDesignOsDormantContext no longer hardcodes BASELINE profile.
- mapping uses existing style selector only:
  - default => BASELINE
  - focus => FOCUS
  - unknown empty missing => BASELINE
- applyViewMode triggers syncDesignOsDormantContext after local focus class and persistence update.
- syncDesignOsDormantContext remains single preview path for degraded_to_baseline, visible_commands and resolved_tokens.
- command palette wrapper keeps compatible semantics and non-catalog extra commands remain visible.
- token CSS projection path remains extractCssVariablesFromTokens and applyCssVariables only.
- existing focus-mode class toggle and editorViewMode localStorage persistence remain unchanged.
- COMPACT and SAFE profile adoption stays out of scope.
- no new controls and no new command ids.
- runtime bridge command surface unchanged.
- layout commit sync, safe reset, restore handlers unchanged.
- no preload main html css command seam or status record changes.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-PROFILE-ADOPTION-001.md src/renderer/editor.js test/unit/sector-m-design-os-profile-adoption.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/capabilityPolicy.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/palette-groups.v1.mjs src/renderer/commands/projectCommands.mjs AGENTS.md docs/PROCESS.md test/unit/sector-m-design-os-command-palette-visibility.test.js test/unit/sector-m-design-os-token-css-adoption.test.js test/unit/sector-m-design-os-layout-commit-sync.test.js test/unit/sector-m-design-os-restore-last-stable-adoption.test.js test/unit/sector-m-design-os-safe-reset-adoption.test.js test/unit/sector-m-design-os-warning-hints.test.js test/unit/sector-m-design-os-status-hints.test.js test/unit/sector-m-design-os-dormant-observability.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-design-os-profile-adoption.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_PROFILE_ADOPTION_EXECUTION_BRIEF_ONLY
