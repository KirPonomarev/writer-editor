TASK_ID: CORE-A4-YALKEN-PHASE02-EXPORT-PREVIEW-COMMAND-ID-CANONICALIZATION-001
MILESTONE: A4
TYPE: CORE
STATUS: WRITE_CLUSTER_EXPORT_PREVIEW_RUNTIME_COMMAND_ID_CANONICALIZATION_ONLY
CANON_VERSION: v3.13a_final

## MICRO_GOAL
Канонизировать preview ветку существующего DOCX export command: main передает runtime payload как commandId envelope для `cmd.project.export.docxMin` c preview флагом, а editor non-tiptap и tiptap runtime bridge обрабатывают этот canonical путь первично с сохранением legacy `open-export-preview` как backward compatibility.

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-EXPORT-PREVIEW-COMMAND-ID-CANONICALIZATION-001.md
- src/main.js
- src/renderer/editor.js
- src/renderer/tiptap/runtimeBridge.js
- test/unit/sector-m-export-preview-command-id-canonicalization.test.js

## DENYLIST
- src/renderer/commands/projectCommands.mjs
- src/renderer/commands/capabilityPolicy.mjs
- docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json
- docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json
- src/preload.js
- src/renderer/tiptap/index.js
- src/renderer/commands/command-catalog.v1.mjs
- src/renderer/commands/registry.mjs
- src/renderer/commands/commandBusGuard.mjs
- src/renderer/commands/runCommand.mjs
- src/renderer/index.html
- src/renderer/styles.css
- docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json

## CONTRACT
- main preview branch for `cmd.project.export.docxMin` switches from raw `sendRuntimeCommand('open-export-preview')` to `sendCanonicalRuntimeCommand('cmd.project.export.docxMin', payload, 'open-export-preview')`.
- canonical preview payload uses only existing command id plus one narrow `preview: true` flag.
- editor non-tiptap runtime consumer handles `payload.commandId === cmd.project.export.docxMin` with preview flag and reuses existing `openExportPreviewModal`.
- tiptap runtime bridge handles the same canonical preview path and reuses existing `runtimeHandlers.openExportPreview`.
- legacy `open-export-preview` string support remains only as compatibility fallback.
- projectCommands capability binding namespace preload and tiptap index remain unchanged.

## CHECKS
CHECK_01_ALLOWLIST_ONLY_CHANGED
CMD: git diff --name-only -- docs/tasks/CORE-A4-YALKEN-PHASE02-EXPORT-PREVIEW-COMMAND-ID-CANONICALIZATION-001.md src/main.js src/renderer/editor.js src/renderer/tiptap/runtimeBridge.js test/unit/sector-m-export-preview-command-id-canonicalization.test.js
PASS: only allowlist basenames changed

CHECK_02_FORBIDDEN_SURFACES_UNCHANGED
CMD: git diff --name-only -- src/renderer/commands/projectCommands.mjs src/renderer/commands/capabilityPolicy.mjs docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json docs/OPS/STATUS/COMMAND_NAMESPACE_CANON.json src/preload.js src/renderer/tiptap/index.js src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/registry.mjs src/renderer/commands/commandBusGuard.mjs src/renderer/commands/runCommand.mjs src/renderer/index.html src/renderer/styles.css docs/OPS/STATUS/X101_MENU_COMMAND_MAP_LOCK_V1.json
PASS: empty output

CHECK_03_NARROW_TEST_PASS
CMD: node --test sector-m-export-preview-command-id-canonicalization.test.js
PASS: exit 0

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## NEXT_STEP_ON_PASS
OPEN_ONE_NEW_EXPLICIT_POST_EXPORT_PREVIEW_COMMAND_ID_CANONICALIZATION_EXECUTION_BRIEF_ONLY
