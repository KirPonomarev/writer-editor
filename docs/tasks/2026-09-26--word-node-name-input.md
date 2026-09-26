# Native node name input for Word authoring

TASK_ID: WORD_NODE_NAME_INPUT_20260926
BASE_SHA: a39bbf864a781846ab665b419d40a64aeeb6cdfa
STATUS: TARGET_IMPLEMENTATION_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: APPLICABLE_LAZYWEB_FIRST

O: create and rename a scene through native Yalken UI, persist and reopen it.
T: transient input -> captured tree/project/entity check -> existing command
kernel -> main-owned identity/path validation -> existing Core persistence.
H: Electron cannot supply window.prompt; using the existing modal restores name
input without creating another mutation route. Delayed input loses authority
when project or tree snapshot, node kind or label changes.
B: preserve foreign profiles, other prompt/confirmation callsites and all Word
oracles. No global styles, renderer layout, dependencies or runtime network.
P: actual-handler races and dialog lifecycle tests; existing hyperlink regression;
SOURCE/PACKAGED create/rename/disk/restart; mandatory RTK/static/CI/merged proof.
I: base above, exact build and synthetic owned profiles in physical receipts.

FEATURE_INTEGRATION_MANIFEST_V1:
featureId: existing-tree-name-input; integrationMode: EXISTING_SEAM.
productPlane: existing Core tree identity and filesystem persistence.
interfacePlane: transient labelled name field in existing modal presentation.
commands: existing TREE_CREATE_NODE and TREE_RENAME_NODE only.
queries: existing tree projection; effects: existing main filesystem adapter.
ports: existing command dispatch and Core tree port; no new IPC.
stateClasses: TRANSIENT_STATE name input; PROJECT_STATE only after command.
identityGuards: captured project/tree snapshot/node identity/kind/label.
capabilityRevalidation: unchanged command kernel and main command handlers.
fallback: cancel, invalid input or changed identity produces no dispatch.
recovery: unchanged persistence and one bounded PR revert.
accessibility: native modal focus/inertness, labelled field, Enter excluding IME,
Escape, explicit cancel, live error, previous-focus restoration.
performance: one dialog and bounded name input, no background job.
negativeChecks: stale/ABA project snapshot, removed node, kind/label changes,
invalid/empty names, duplicate input, revoked command and link input regression.

No new visual surface or visual language: reuse existing modal classes/tokens.
Lazyweb single-field rename evidence: Signeasy, search
5cbf6836-d8af-499c-9a1b-d5e9f61d6a5b. No external assets or code imported.
Name validation is advisory; main identity/path authority remains mandatory.
This prerequisite creates no official cell acceptance and does not close P1a.
