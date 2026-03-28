TASK_ID: CORE-A4-YALKEN-PHASE02-RENDERER-DOCUMENT-CONTEXT-TRUTH-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_RENDERER_RUNTIME_LIFECYCLE_AND_PRODUCT_TRUTH_ONLY
CANON_VERSION: v3.13a-final

## MICRO_GOAL
Подтянуть реальный document context в dormant runtime product truth и делать remount только на существующих document-boundary точках: onEditorSetText success, flow-open success, flow-save success.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-DOCUMENT-CONTEXT-TRUTH-001.md
- src/renderer/editor.js
- test/unit/sector-m-design-os-document-context-truth.test.js

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
- buildDesignOsDormantProductTruth no longer hardcodes scene_1.
- non-flow truth uses currentProjectId and currentDocumentPath when path and kind exist.
- non-flow fallback is one local scene when path or kind are unavailable.
- flow truth uses buildFlowSavePayload when payload is valid.
- flow active_scene_id resolves from first valid flow scene path only.
- invalid flow payload falls back to non-flow single-scene truth without scope widening.
- one narrow remount helper recreates runtime and ports with createRepoGroundedDesignOsBrowserRuntime and createDesignOsPorts.
- remount helper replays current spatial layout state through existing layout sync path.
- remount helper triggers existing preview sync immediately after remount.
- remount runs only on existing boundaries:
  - onEditorSetText success
  - handleFlowModeOpenUiPath success
  - handleFlowModeSaveUiPath success
- no remount on every editor input or every resize.
- profile workspace and shell mode mappings remain unchanged.
- command palette token css layout commit safe reset restore behavior remains compatible.
- no new controls and no new command ids.
- no preload main html css command seam or status record changes.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-RENDERER-DOCUMENT-CONTEXT-TRUTH-001.md src/renderer/editor.js test/unit/sector-m-design-os-document-context-truth.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/capabilityPolicy.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/palette-groups.v1.mjs src/renderer/commands/projectCommands.mjs src/renderer/commands/flowMode.mjs AGENTS.md docs/PROCESS.md test/unit/sector-m-design-os-shell-mode-adoption.test.js test/unit/sector-m-design-os-profile-adoption.test.js test/unit/sector-m-design-os-command-palette-visibility.test.js test/unit/sector-m-design-os-token-css-adoption.test.js test/unit/sector-m-design-os-layout-commit-sync.test.js test/unit/sector-m-design-os-restore-last-stable-adoption.test.js test/unit/sector-m-design-os-safe-reset-adoption.test.js test/unit/sector-m-design-os-warning-hints.test.js test/unit/sector-m-design-os-status-hints.test.js test/unit/sector-m-design-os-dormant-observability.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-design-os-document-context-truth.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_DOCUMENT_CONTEXT_TRUTH_EXECUTION_BRIEF_ONLY
