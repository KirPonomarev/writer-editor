TASK_ID: CORE-A4-YALKEN-PHASE02-RENDERER-COMMAND-PALETTE-VISIBILITY-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_RENDERER_COMMAND_SURFACE_ADOPTION_ONLY
CANON_VERSION: v3.13a-final

## MICRO_GOAL
Сделать первое использование visible_commands из dormant Design OS runtime на существующей command palette поверхности без изменения UI структуры, preload, main и command seam.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-COMMAND-PALETTE-VISIBILITY-001.md
- src/renderer/editor.js
- test/unit/sector-m-design-os-command-palette-visibility.test.js

## DENYLIST
- src/main.js
- src/preload.js
- src/renderer/index.html
- src/renderer/styles.css
- src/renderer/commands/capabilityPolicy.mjs
- src/renderer/commands/commandBusGuard.mjs
- src/renderer/commands/runCommand.mjs
- src/renderer/commands/registry.mjs
- src/renderer/commands/palette-groups.v1.mjs
- src/renderer/commands/command-catalog.v1.mjs
- src/renderer/commands/projectCommands.mjs
- AGENTS.md
- docs/PROCESS.md
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
- editor imports listCommandCatalog only for local catalog-managed command scope.
- one local dormant visible command set tracked in editor only.
- syncDesignOsDormantContext reads preview.visible_commands and refreshes local set.
- existing provider in window.__COMMAND_PALETTE_DATA_PROVIDER_V1__ is wrapped in editor only.
- filtering applies only to catalog-managed command ids from listCommandCatalog.
- non-catalog extra commands remain visible.
- fallback keeps base provider output when preview is unavailable or throws.
- filtering applies to listAll listBySurface and listByGroup.
- group order and entry order remain stable after filtering.
- baseline profile hides flowOpen and flowSave catalog entries while required core commands stay visible.
- no new controls and no new command ids.
- runtime bridge command surface unchanged.
- no layout sync token css safe-reset or restore rework.
- no preload main html css command seam or status record changes.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-COMMAND-PALETTE-VISIBILITY-001.md src/renderer/editor.js test/unit/sector-m-design-os-command-palette-visibility.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/capabilityPolicy.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/registry.mjs src/renderer/commands/palette-groups.v1.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/projectCommands.mjs AGENTS.md docs/PROCESS.md test/unit/sector-m-design-os-token-css-adoption.test.js test/unit/sector-m-design-os-layout-commit-sync.test.js test/unit/sector-m-design-os-restore-last-stable-adoption.test.js test/unit/sector-m-design-os-safe-reset-adoption.test.js test/unit/sector-m-design-os-warning-hints.test.js test/unit/sector-m-design-os-status-hints.test.js test/unit/sector-m-design-os-dormant-observability.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-design-os-command-palette-visibility.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_COMMAND_PALETTE_VISIBILITY_EXECUTION_BRIEF_ONLY
