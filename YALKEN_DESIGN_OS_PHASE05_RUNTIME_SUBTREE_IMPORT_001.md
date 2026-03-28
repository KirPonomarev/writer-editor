# TASK ARTIFACT: YALKEN_DESIGN_OS_PHASE05_RUNTIME_SUBTREE_IMPORT_001

## Scope
- Narrow runtime entrypoint adaptation only.
- Changed files are limited to main.js and preload.js.
- runtimeBridge.js is intentionally unchanged in this revised slice.

## Delivered Adaptation
- main.js: legacy tree and document IPC handlers are explicitly fail-closed and routed through canonical command bus dispatch.
- preload.js: dispatchTreeCommand is present and strict-allowlisted by commandId only.
- preload.js: invokeUiCommandBridge, invokeWorkspaceQueryBridge, and invokeSaveLifecycleSignalBridge are preserved.

## Guardrails Preserved
- CSP, blocked navigation, denied window-open handler, contextIsolation and sandbox remain enforced.
- UI command bridge, workspace query bridge, and save lifecycle signal bridge allowlists remain intact.
- design-os runtime subtree basenames remain unchanged.
- editor.js, index.html, styles.css remain unchanged.

## Next Step
- OPEN_ONE_EXPLICIT_PHASE_06_RENDERER_WIRING_BRIEF_ONLY
