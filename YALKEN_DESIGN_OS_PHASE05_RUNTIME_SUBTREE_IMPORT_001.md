# TASK ARTIFACT: YALKEN_DESIGN_OS_PHASE05_RUNTIME_SUBTREE_IMPORT_001

## Scope
- Narrow runtime entrypoint adaptation only.
- Runtime subtree files remained unchanged.
- No renderer wiring scope was opened.

## Changes
- main.js: legacy tree/document IPC entrypoints now route through canonical command bus dispatch.
- preload.js: tree/document API routes through command bridge and exposes dispatchTreeCommand with allowlisted command IDs.
- runtimeBridge.js: dormant command surface no longer includes legacy search/replace string commands; canonical commandId path remains.

## Guardrails Preserved
- CSP and window navigation deny controls remain intact.
- contextIsolation and sandbox remain enabled.
- UI command bridge, workspace query bridge, and save lifecycle signal bridge allowlists remain in place.
- No changes to design-os subtree basenames.
- No changes to editor.js, index.html, styles.css.

## Next Step
- OPEN_ONE_EXPLICIT_PHASE_06_RENDERER_WIRING_BRIEF_ONLY
