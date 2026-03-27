TASK_ID: CORE-A4-YALKEN-PHASE02-DESIGN-OS-SUBTREE-IMPORT-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_VALID_MISSING_IMPORT_ONLY
CANON_VERSION: v3.13a-final

## GOAL
Импортировать только valid-missing Design OS subtree как dormant code без runtime wiring и без изменений command seam.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-DESIGN-OS-SUBTREE-IMPORT-001.md
- src/renderer/design-os/designOsPortContract.mjs
- src/renderer/design-os/designOsRuntime.mjs
- src/renderer/design-os/designOsShellController.mjs
- src/renderer/design-os/index.mjs
- src/renderer/design-os/repoDesignOsAdapter.mjs
- src/renderer/design-os/repoDesignOsBootstrap.mjs
- src/renderer/design-os/repoDesignOsCompat.mjs

## DENYLIST
- src/main.js
- src/preload.js
- src/renderer/editor.js
- src/renderer/index.html
- src/renderer/styles.css
- src/renderer/commands/capabilityPolicy.mjs
- src/renderer/commands/commandBusGuard.mjs
- src/renderer/commands/runCommand.mjs
- package.json
- agents.md
- docs/PROCESS.md

## CONTRACT
- Import only: no wiring.
- No command surface changes.
- No dependency changes.
- No status-record patches.
- Next step remains single and explicit.

## CHECKS
CHECK_01_ALLOWED_SCOPE_ONLY
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-DESIGN-OS-SUBTREE-IMPORT-001.md src/renderer/design-os/designOsPortContract.mjs src/renderer/design-os/designOsRuntime.mjs src/renderer/design-os/designOsShellController.mjs src/renderer/design-os/index.mjs src/renderer/design-os/repoDesignOsAdapter.mjs src/renderer/design-os/repoDesignOsBootstrap.mjs src/renderer/design-os/repoDesignOsCompat.mjs
PASS: only allowlist basenames changed

CHECK_02_NO_FORBIDDEN_SURFACE_TOUCH
CMD: git diff --name-only -- src/main.js src/preload.js src/renderer/editor.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/capabilityPolicy.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs package.json agents.md docs/PROCESS.md
PASS: empty output

CHECK_03_SUBTREE_PRESENT
CMD: test -f src/renderer/design-os/designOsPortContract.mjs && test -f src/renderer/design-os/designOsRuntime.mjs && test -f src/renderer/design-os/designOsShellController.mjs && test -f src/renderer/design-os/index.mjs && test -f src/renderer/design-os/repoDesignOsAdapter.mjs && test -f src/renderer/design-os/repoDesignOsBootstrap.mjs && test -f src/renderer/design-os/repoDesignOsCompat.mjs && echo OK
PASS: OUT == OK

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_IMPORT_EXECUTION_BRIEF_ONLY
