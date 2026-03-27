TASK_ID: CORE-A4-YALKEN-PHASE02-RENDERER-TOKEN-CSS-ADOPTION-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_RENDERER_VISIBLE_DESIGN_ADOPTION_ONLY
CANON_VERSION: v3.13a-final

## MICRO_GOAL
Сделать первый visible design adoption: проецировать preview resolved_tokens в уже существующие root CSS variables через extractCssVariablesFromTokens и applyCssVariables без изменений UI-структуры и command surface.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-TOKEN-CSS-ADOPTION-001.md
- src/renderer/editor.js
- test/unit/sector-m-design-os-token-css-adoption.test.js

## DENYLIST
- src/main.js
- src/preload.js
- src/renderer/index.html
- src/renderer/styles.css
- src/renderer/commands/capabilityPolicy.mjs
- src/renderer/commands/commandBusGuard.mjs
- src/renderer/commands/runCommand.mjs
- package.json
- AGENTS.md
- docs/PROCESS.md
- test/unit/sector-m-design-os-layout-commit-sync.test.js
- test/unit/sector-m-design-os-restore-last-stable-adoption.test.js
- test/unit/sector-m-design-os-safe-reset-adoption.test.js
- test/unit/sector-m-design-os-warning-hints.test.js
- test/unit/sector-m-design-os-status-hints.test.js
- test/unit/sector-m-design-os-dormant-observability.test.js
- test/unit/sector-m-tiptap-runtime-bridge.test.js
- docs/OPS/STATUS

## CONTRACT
- syncDesignOsDormantContext captures preview result from ports.previewDesign.
- preview.degraded_to_baseline handling remains present.
- preview.resolved_tokens projected into existing root CSS vars only.
- applyCssVariables target is documentElement only.
- isDarkTheme derived from existing dark-theme body class only.
- If previewDesign is unavailable or throws, renderer flow still continues.
- No layout commit sync rework in this slice.
- performSafeResetShell unchanged.
- performRestoreLastStableShell unchanged.
- Status, warning, perf semantics unchanged.
- No new controls and no new command IDs.
- No preload, main, html, css, command seam, or status record changes.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-TOKEN-CSS-ADOPTION-001.md src/renderer/editor.js test/unit/sector-m-design-os-token-css-adoption.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/capabilityPolicy.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs package.json AGENTS.md docs/PROCESS.md test/unit/sector-m-design-os-layout-commit-sync.test.js test/unit/sector-m-design-os-restore-last-stable-adoption.test.js test/unit/sector-m-design-os-safe-reset-adoption.test.js test/unit/sector-m-design-os-warning-hints.test.js test/unit/sector-m-design-os-status-hints.test.js test/unit/sector-m-design-os-dormant-observability.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-design-os-token-css-adoption.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_TOKEN_CSS_ADOPTION_EXECUTION_BRIEF_ONLY
