TASK_ID: TOOLBAR_EXPANSION_WAVE_A2_001
MILESTONE: A5
TYPE: CORE
STATUS: EXECUTION_READY_AFTER_REBIND
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0
TARGET_BRANCH: main
BINDING_BASE_SHA: f263feca6c2bc37adf64948357387656e42e0189
DELIVERY_POLICY: COMMIT_REQUIRED_PUSH_REQUIRED_PR_REQUIRED_MERGE_REQUIRED

## MICRO_GOAL
- Promote `toolbar.format.underline` and `toolbar.insert.link` from planned to live.
- Add real underline and link controls to the existing toolbar without changing profile semantics, storage semantics or reorder semantics.
- Keep storage on version 3 with no auto backfill of existing saved profiles.
- Keep command meaning and disabled truth in the command kernel, capability policy and TipTap mode gate.
- Allow exactly two new OSS dependencies: `@tiptap/extension-underline` and `@tiptap/extension-link`.

## ARTIFACT
- docs/tasks/TOOLBAR_EXPANSION_WAVE_A2_001.md
- src/renderer/toolbar/toolbarFunctionCatalog.mjs
- src/renderer/editor.js
- src/renderer/index.html
- src/renderer/styles.css
- src/renderer/commands/projectCommands.mjs
- src/renderer/commands/capabilityPolicy.mjs
- src/renderer/tiptap/runtimeBridge.js
- src/renderer/tiptap/index.js
- docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json
- docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json
- package.json
- package-lock.json
- src/renderer/editor.bundle.js
- test/unit/toolbar-expansion-wave-a1.helpers.test.js
- test/unit/toolbar-profile-state.foundation.test.js
- test/unit/toolbar-profile-switch.helpers.test.js
- test/unit/sector-m-toolbar-expansion-wave-a1.test.js
- test/unit/sector-m-tiptap-runtime-bridge.test.js
- test/unit/toolbar-expansion-wave-a2.helpers.test.js
- test/unit/sector-m-toolbar-expansion-wave-a2.test.js

## ALLOWLIST
- docs/tasks/TOOLBAR_EXPANSION_WAVE_A2_001.md
- src/renderer/toolbar/toolbarFunctionCatalog.mjs
- src/renderer/editor.js
- src/renderer/index.html
- src/renderer/styles.css
- src/renderer/commands/projectCommands.mjs
- src/renderer/commands/capabilityPolicy.mjs
- src/renderer/tiptap/runtimeBridge.js
- src/renderer/tiptap/index.js
- docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json
- docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json
- package.json
- package-lock.json
- src/renderer/editor.bundle.js
- test/unit/toolbar-expansion-wave-a1.helpers.test.js
- test/unit/toolbar-profile-state.foundation.test.js
- test/unit/toolbar-profile-switch.helpers.test.js
- test/unit/sector-m-toolbar-expansion-wave-a1.test.js
- test/unit/sector-m-tiptap-runtime-bridge.test.js
- test/unit/toolbar-expansion-wave-a2.helpers.test.js
- test/unit/sector-m-toolbar-expansion-wave-a2.test.js

## DENYLIST
- src/renderer/toolbar/toolbarProfileState.mjs
- src/renderer/toolbar/toolbarRuntimeProjection.mjs
- test/unit/toolbar-profile-ordering.helpers.test.js
- test/unit/sector-m-toolbar-profile-ordering.test.js
- test/unit/sector-m-toolbar-minimal-runtime.test.js
- src/main.js
- src/preload.js
- no storage version 4
- no profile semantic change
- no reorder semantic change
- no new toolbar
- no new modal subsystem
- no Tiptap Pro dependency
- no Tiptap Cloud dependency
- no non OSS dependency
- no autolink
- no linkOnPaste side effect
- no openOnClick behavior
- no legacy text mutation path for underline or link
- no navigation or window opening from editor links

## CONTRACT / SHAPES
- `toolbar.format.underline` changes to `implementationState: 'live'` and `commandId: 'cmd.project.format.toggleUnderline'`.
- `toolbar.insert.link` changes to `implementationState: 'live'` and `commandId: 'cmd.project.insert.linkPrompt'`.
- `toolbar.insert.link` remains `controlKind: 'dialogTrigger'`.
- `toolbar.format.underline` and `toolbar.insert.link` may keep `actionAlias: null`; command bridge is the canonical behavior bridge.
- Canonical live order after A2 becomes: `toolbar.font.family`, `toolbar.font.weight`, `toolbar.font.size`, `toolbar.text.lineHeight`, `toolbar.format.bold`, `toolbar.format.italic`, `toolbar.format.underline`, `toolbar.paragraph.alignment`, `toolbar.list.type`, `toolbar.insert.link`, `toolbar.history.undo`, `toolbar.history.redo`.
- Storage stays version 3.
- Existing persisted `minimal` and `master` arrays are preserved exactly after normalization and are not auto backfilled with underline or link.
- New project seed and safe reset inherit underline and link automatically through the updated live catalog truth; `toolbarProfileState.mjs` stays untouched.
- Valid empty profiles remain empty.
- Profile switch semantics remain unchanged.
- Reorder semantics remain unchanged.
- Runtime projection semantics remain unchanged and stay in `toolbarRuntimeProjection.mjs`; this file stays untouched.
- One real underline button is inserted into the existing format-inline group immediately after italic.
- One real link button is inserted into one bounded insert group placed after list type and before history.
- Empty insert group hides through existing runtime projection rules.
- Underline is TipTap-only and returns deterministic `EDITOR_MODE_UNSUPPORTED` outside TipTap mode.
- Link prompt flow is TipTap-only and returns deterministic `EDITOR_MODE_UNSUPPORTED` outside TipTap mode.
- `editor.js` owns the link prompt UX, cancellation handling, trimming, URL normalization and unsafe-scheme rejection.
- `runtimeBridge.js` never opens prompts and never normalizes URLs; it only routes canonical command ids and delegates the link prompt command to a runtime handler callback.
- When the runtime handler callback returns a `{ performed, action, reason }` object for `cmd.project.insert.linkPrompt`, `runtimeBridge.js` must propagate that exact result without coercing it to success.
- `src/renderer/tiptap/index.js` widens the bounded TipTap format bridge to accept an optional payload for link operations only.
- Allowed TipTap-side actions are `toggleUnderline`, `setLink` and `unsetLink`; no generic arbitrary command router is introduced.
- Expanded selection creates or updates a link on that selection.
- Collapsed selection inside an active link edits that active link.
- Collapsed selection outside an active link returns deterministic `NO_SELECTION` and performs no mutation.
- Prompt cancel returns deterministic `USER_CANCELLED` and performs no mutation.
- Empty trimmed prompt while editing an active link removes the link.
- Empty trimmed prompt while not inside an active link is deterministic no op.
- Accepted schemes are `http`, `https` and `mailto`.
- Bare domain and bare `www.` input normalize deterministically to `https`.
- Unsafe schemes are rejected deterministically.
- Link extension must be configured inertly with `autolink: false`, `linkOnPaste: false` and `openOnClick: false`.
- Underline pressed state and link active state are derived from TipTap selection truth.
- `EXTRA_COMMAND_IDS` must add `FORMAT_TOGGLE_UNDERLINE` and `INSERT_LINK_PROMPT`.
- `LEGACY_ACTION_TO_COMMAND` must add `format-underline` and `insert-link`.
- `CAPABILITY_BINDING` must add `cmd.project.format.toggleUnderline` and `cmd.project.insert.linkPrompt`.
- Capability ids must be `cap.project.format.toggleUnderline` and `cap.project.insert.linkPrompt`.
- `docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json` remains the SSOT artifact for command-to-capability truth and must be updated in this contour.
- Because `docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json` is a governance-path artifact, `docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json` must record the exact hash-bound approval for this A2 change.
- Existing dormant string-command surface in `sector-m-tiptap-runtime-bridge.test.js` must remain green; A2 adds canonical `commandId` handling and editor runtime callback wiring, not new dormant string commands.
- Current audit baseline is one direct `electron` high vulnerability; no other vulnerability key is currently present.

## IMPLEMENTATION_STEPS
- Promote underline and link entries to live in `toolbarFunctionCatalog.mjs` and assign canonical command ids.
- Update the canonical live order in `toolbarFunctionCatalog.mjs`.
- Add `@tiptap/extension-underline` and `@tiptap/extension-link` to `package.json` and refresh `package-lock.json`.
- Wire Underline and Link extensions in `src/renderer/tiptap/index.js` with inert safe options.
- Widen `runTiptapFormatCommand` and the local editor wrapper to accept optional payload only for the link path and underline path without broadening unrelated commands.
- Add `formatToggleUnderline` and `insertLinkPrompt` UI actions to the registered command kernel UI action map in `editor.js`.
- Implement bounded prompt-driven link flow in `editor.js`, including normalization, deterministic error outcomes and no-op cases.
- Add canonical command ids, legacy action mappings and capability bindings in `projectCommands.mjs`, `capabilityPolicy.mjs` and `COMMAND_CAPABILITY_BINDING.json`.
- Add the exact governance approval registry entry for the updated `COMMAND_CAPABILITY_BINDING.json` hash.
- Extend `runtimeBridge.js` to handle `cmd.project.format.toggleUnderline` directly and `cmd.project.insert.linkPrompt` through a runtime handler callback path only.
- Add one underline button and one bounded insert group with one link button in `index.html` in canonical order.
- Add minimal styles for underline and link controls in `styles.css`.
- Extend formatting-state sync so toolbar UI reflects underline pressed state and link active state.
- Update the A1 helper and sector-m tests to the new A2 truth.
- Add new focused helper and sector-m A2 tests.
- Update `editor.bundle.js`.
- Run strict gates, then commit, push, PR and merge.

## CHECKS
- CHECK_01_PRE_WORKTREE_CLEAN: git status --porcelain
- CHECK_02_PRE_FETCH_ORIGIN: git fetch origin
- CHECK_03_PRE_BINDING_SHA_MATCH: node -e 'const {execSync}=require("node:child_process");const out=execSync("git ls-remote --heads origin main",{encoding:"utf8"}).trimEnd();const sha=(out.split(/\s+/)[0]||"");if(sha!=="f263feca6c2bc37adf64948357387656e42e0189"){console.error(`REMOTE_MAIN_SHA_MISMATCH:${sha}`);process.exit(1);}'
- CHECK_04_PRE_EXECUTION_BRANCH_CMD_01: git switch --detach f263feca6c2bc37adf64948357387656e42e0189
- CHECK_04_PRE_EXECUTION_BRANCH_CMD_02: git switch -c codex/toolbar-expansion-wave-a2-001
- CHECK_05_PRE_BASELINE_FOCUSED_GREEN_CMD: node --test test/unit/toolbar-expansion-wave-a1.helpers.test.js test/unit/toolbar-profile-state.foundation.test.js test/unit/toolbar-profile-switch.helpers.test.js test/unit/sector-m-toolbar-expansion-wave-a1.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js
- CHECK_06_PRE_DEPENDENCY_BASELINE_CMD: node -e 'const fs=require("node:fs");const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));const all={...(pkg.dependencies||{}),...(pkg.devDependencies||{})};if("@tiptap/extension-underline" in all||"@tiptap/extension-link" in all){console.error("A2_DEPENDENCIES_ALREADY_PRESENT");process.exit(1);}'
- CHECK_07_POST_BUILD_RENDERER: npm run -s build:renderer
- CHECK_08_POST_FOCUSED_NODE_CMD: node --test test/unit/toolbar-expansion-wave-a1.helpers.test.js test/unit/toolbar-profile-state.foundation.test.js test/unit/toolbar-profile-switch.helpers.test.js test/unit/toolbar-expansion-wave-a2.helpers.test.js test/unit/sector-m-toolbar-expansion-wave-a1.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js test/unit/sector-m-toolbar-expansion-wave-a2.test.js
- CHECK_09_POST_SECTOR_M: npm run -s test:sector-m
- CHECK_10_POST_OPS: npm run -s test:ops
- CHECK_11_POST_OSS_POLICY: npm run -s oss:policy
- CHECK_12_POST_NPM_TEST: npm test
- CHECK_13_POST_AUDIT_JSON_SHAPE_CMD: node -e 'const {spawnSync}=require("node:child_process");const r=spawnSync("npm",["audit","--json"],{encoding:"utf8"});const raw=(r.stdout||"").trim();if(!raw){console.error("AUDIT_OUTPUT_MISSING");process.exit(1);}let data;try{data=JSON.parse(raw);}catch{console.error("AUDIT_JSON_INVALID");process.exit(1);}const keys=Object.keys(data.vulnerabilities||{}).sort();const meta=(data.metadata&&data.metadata.vulnerabilities)||{};const ok=keys.length===1&&keys[0]==="electron"&&meta.high===1&&meta.total===1&&meta.critical===0;if(!ok){console.error(`AUDIT_SHAPE_CHANGED:${JSON.stringify({keys,meta})}`);process.exit(1);}'
- CHECK_14_POST_DIFF_CHECK: git diff --check
- CHECK_15_POST_DEPENDENCY_SET_CMD: node -e 'const fs=require("node:fs");const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));const deps=Object.keys(pkg.dependencies||{}).sort();const dev=Object.keys(pkg.devDependencies||{}).sort();const wantDeps=["@tiptap/core","@tiptap/extension-link","@tiptap/extension-underline","@tiptap/pm","@tiptap/starter-kit"].sort();const wantDev=["electron","electron-builder","esbuild"].sort();const eq=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);if(!eq(deps,wantDeps)){console.error(`DEPENDENCY_SET_MISMATCH:${JSON.stringify(deps)}`);process.exit(1);}if(!eq(dev,wantDev)){console.error(`DEVDEPENDENCY_SET_MISMATCH:${JSON.stringify(dev)}`);process.exit(1);}'
- CHECK_16_POST_ALLOWLIST_HARD_CMD: node -e 'const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){console.error("ALLOWLIST is empty");process.exit(2);}const out=execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}).trimEnd();if(!out){console.error("Working tree is clean");process.exit(1);}const changed=new Set(out.split("\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));if(changed.size!==allow.size){console.error("Changed paths set != allowlist");process.exit(1);}for(const p of changed){if(!allow.has(p)){console.error(`Disallowed change: ${p}`);process.exit(1);}}for(const p of allow){if(!changed.has(p)){console.error(`Missing expected change: ${p}`);process.exit(1);}}process.exit(0);' docs/tasks/TOOLBAR_EXPANSION_WAVE_A2_001.md src/renderer/toolbar/toolbarFunctionCatalog.mjs src/renderer/editor.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/projectCommands.mjs src/renderer/commands/capabilityPolicy.mjs src/renderer/tiptap/runtimeBridge.js src/renderer/tiptap/index.js docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json package.json package-lock.json src/renderer/editor.bundle.js test/unit/toolbar-expansion-wave-a1.helpers.test.js test/unit/toolbar-profile-state.foundation.test.js test/unit/toolbar-profile-switch.helpers.test.js test/unit/sector-m-toolbar-expansion-wave-a1.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js test/unit/toolbar-expansion-wave-a2.helpers.test.js test/unit/sector-m-toolbar-expansion-wave-a2.test.js

## STOP_CONDITION
- fetched remote main moved from BINDING_BASE_SHA
- worktree dirty before write
- implementation requires editing `toolbarProfileState.mjs`
- implementation requires editing `toolbarRuntimeProjection.mjs`
- implementation requires profile auto backfill
- implementation requires storage version bump
- implementation requires reorder semantic change
- implementation requires non approved dependency addition
- implementation requires new modal subsystem
- implementation requires new dormant string command surface in `sector-m-tiptap-runtime-bridge.test.js`
- any mandatory post check fails
- commit, push, PR or merge fails
- STOP_STATUS: STOP_NOT_DONE

## REPORT_FORMAT
- TASK_ID
- HEAD_SHA_BEFORE
- HEAD_SHA_AFTER
- COMMIT_SHA
- CHANGED_BASENAMES
- STAGED_SCOPE_MATCH
- COMMIT_OUTCOME
- PUSH_RESULT
- PR_RESULT
- MERGE_RESULT
- NEXT_STEP
- final result without COMMIT_SHA is not done
- final result with incomplete delivery chain is not done
- basenames only in changed file lists
- audit result must be reported honestly
- report must explicitly state whether audit remained exactly one direct `electron` vulnerability or changed

## FAIL_PROTOCOL
- no silent rebase
- no silent scope expansion into Wave B or Wave C
- no silent dependency changes
- no silent storage semantics changes
- report exact failed check and exact unexpected basenames
- if target branch drifted request new owner approved base sha
- if audit shape differs from the current one-direct-electron-high baseline stop and report exact delta
