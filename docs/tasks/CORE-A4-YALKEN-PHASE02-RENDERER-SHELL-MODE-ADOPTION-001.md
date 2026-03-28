TASK_ID: CORE-A4-YALKEN-PHASE02-RENDERER-SHELL-MODE-ADOPTION-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_RENDERER_CONTEXT_DIMENSION_ADOPTION_ONLY
CANON_VERSION: v3.13a-final

## MICRO_GOAL
Привязать уже существующие spatial layout facts к dormant shell_mode в renderer контексте: desktop => CALM_DOCKED, compact mobile => COMPACT_DOCKED, с немедленным preview resync на resize пути.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-SHELL-MODE-ADOPTION-001.md
- src/renderer/editor.js
- test/unit/sector-m-design-os-shell-mode-adoption.test.js

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
- buildDesignOsDormantContext no longer hardcodes CALM_DOCKED.
- mapping from existing spatial layout mode:
  - desktop => CALM_DOCKED
  - compact mobile => COMPACT_DOCKED
  - unknown empty missing => CALM_DOCKED
- resize path triggers syncDesignOsDormantContext after updateSpatialLayoutForViewportChange.
- syncDesignOsDormantContext remains single path for degraded_to_baseline, visible_commands, resolved_tokens.
- layout commit sync helper continues reading context.shell_mode without handler redesign.
- profile mapping remains unchanged.
- workspace mapping remains unchanged.
- SPATIAL_ADVANCED and SAFE_RECOVERY remain out of scope.
- token css and command palette paths remain compatible.
- safe reset and restore handlers remain unchanged.
- no new controls and no new command ids.
- no preload main html css command seam or status record changes.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-SHELL-MODE-ADOPTION-001.md src/renderer/editor.js test/unit/sector-m-design-os-shell-mode-adoption.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/capabilityPolicy.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/palette-groups.v1.mjs src/renderer/commands/projectCommands.mjs AGENTS.md docs/PROCESS.md test/unit/sector-m-design-os-profile-adoption.test.js test/unit/sector-m-design-os-command-palette-visibility.test.js test/unit/sector-m-design-os-token-css-adoption.test.js test/unit/sector-m-design-os-layout-commit-sync.test.js test/unit/sector-m-design-os-restore-last-stable-adoption.test.js test/unit/sector-m-design-os-safe-reset-adoption.test.js test/unit/sector-m-design-os-warning-hints.test.js test/unit/sector-m-design-os-status-hints.test.js test/unit/sector-m-design-os-dormant-observability.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-design-os-shell-mode-adoption.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_SHELL_MODE_ADOPTION_EXECUTION_BRIEF_ONLY
