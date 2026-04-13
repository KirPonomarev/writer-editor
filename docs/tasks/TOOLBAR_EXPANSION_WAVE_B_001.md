TASK_ID: TOOLBAR_EXPANSION_WAVE_B_001
MILESTONE: A6
TYPE: CORE
STATUS: EXECUTION_READY_AFTER_SELECTION_BRIEF_AND_REBIND
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0
TARGET_BRANCH: main
BINDING_BASE_SHA: 15880ffe79111360636bf01a366c47a10d4cacd4
DELIVERY_POLICY: COMMIT_REQUIRED_PUSH_REQUIRED_PR_REQUIRED_MERGE_REQUIRED
SELECTION_BRIEF_STATUS: PASS
SELECTION_EVIDENCE_01: toolbar.color.text, toolbar.color.highlight, toolbar.review.comment remain planned while host surfaces already exist.
SELECTION_EVIDENCE_02: Comments rail shell already exists and is switched by applyRightTab and applyMode.
SELECTION_EVIDENCE_03: Main floating toolbar already has a bounded overlay pattern and can accept one shared color picker.
SELECTION_EVIDENCE_04: Storage, profile switch and ordering are already stable and do not need reopen.
SELECTION_EVIDENCE_05: Wave B is the next contiguous nonblocked toolbar gap after A2.
SELECTION_DECISION: Open one bounded Wave B contour with color pair plus comment opener.

## MICRO_GOAL
- Promote `toolbar.color.text`, `toolbar.color.highlight`, and `toolbar.review.comment` from planned to live.
- Add bounded color picker behavior for TipTap mode without changing storage, profile, or reorder semantics.
- Make `review.comment` a real opener into the existing comments rail without comment persistence, annotation anchors, or a new review data model.
- Keep storage on version 3 with no auto backfill of existing saved profiles.
- Add explicit library group label policy for `color` and `review` so configurator UI remains coherent.

## ARTIFACT
- docs/tasks/TOOLBAR_EXPANSION_WAVE_B_001.md
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
- test/unit/sector-m-toolbar-expansion-wave-a1.test.js
- test/unit/toolbar-expansion-wave-a2.helpers.test.js
- test/unit/sector-m-toolbar-expansion-wave-a2.test.js
- test/unit/toolbar-profile-state.foundation.test.js
- test/unit/toolbar-profile-switch.helpers.test.js
- test/unit/sector-m-tiptap-runtime-bridge.test.js
- test/unit/toolbar-expansion-wave-b.helpers.test.js
- test/unit/sector-m-toolbar-expansion-wave-b.test.js

## ALLOWLIST
- docs/tasks/TOOLBAR_EXPANSION_WAVE_B_001.md
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
- test/unit/sector-m-toolbar-expansion-wave-a1.test.js
- test/unit/toolbar-expansion-wave-a2.helpers.test.js
- test/unit/sector-m-toolbar-expansion-wave-a2.test.js
- test/unit/toolbar-profile-state.foundation.test.js
- test/unit/toolbar-profile-switch.helpers.test.js
- test/unit/sector-m-tiptap-runtime-bridge.test.js
- test/unit/toolbar-expansion-wave-b.helpers.test.js
- test/unit/sector-m-toolbar-expansion-wave-b.test.js

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
- no generic overlay framework
- no comment thread model
- no annotation anchors
- no comment persistence
- no scene comment storage
- no legacy text mutation path for color or highlight
- no Tiptap Pro dependency
- no Tiptap Cloud dependency
- no non OSS dependency
- no autolink
- no linkOnPaste side effect
- no openOnClick behavior
- no silent scope expansion into Wave C

## CONTRACT / SHAPES
- `toolbar.color.text` changes to `implementationState: 'live'` and `commandId: 'cmd.project.format.textColorPicker'`.
- `toolbar.color.highlight` changes to `implementationState: 'live'` and `commandId: 'cmd.project.format.highlightColorPicker'`.
- `toolbar.review.comment` changes to `implementationState: 'live'` and `commandId: 'cmd.project.review.openComments'`.
- `toolbar.color.text` and `toolbar.color.highlight` remain `pickerTrigger`.
- `toolbar.review.comment` remains `actionButton`.
- `actionAlias` may remain `null` for all three items and command bridge is canonical.
- Canonical live order after Wave B becomes: `toolbar.font.family`, `toolbar.font.weight`, `toolbar.font.size`, `toolbar.text.lineHeight`, `toolbar.format.bold`, `toolbar.format.italic`, `toolbar.format.underline`, `toolbar.paragraph.alignment`, `toolbar.list.type`, `toolbar.insert.link`, `toolbar.color.text`, `toolbar.color.highlight`, `toolbar.review.comment`, `toolbar.history.undo`, `toolbar.history.redo`.
- Live count after Wave B is 15.
- Storage remains version 3.
- Existing persisted `minimal` and `master` arrays are preserved exactly and are not auto backfilled.
- New project seed and safe reset include the three new live items through catalog truth only.
- `toolbarProfileState.mjs` stays untouched.
- `toolbarRuntimeProjection.mjs` stays untouched.
- Main toolbar group order becomes `type`, `format-inline`, `paragraph`, `insert`, `color`, `review`, `history`.
- Add one bounded color group and one bounded review group only.
- Add one shared color picker overlay reused by text color and highlight only.
- Empty color and review groups hide through existing runtime projection rules.
- Configurator library group labels must gain explicit `color` and `review` labels.
- `review.comment` behavior is `applyMode('review')` plus `applyRightTab('comments')`.
- If review mode and comments tab are already active, `review.comment` returns deterministic success no-op.
- `review.comment` does not depend on TipTap and follows renderer shell opener behavior only.
- Text color allowed palette is `clear`, `#1f1a15`, `#8a3b2e`, `#2f5f8a`, `#2f6a4f`.
- Highlight allowed palette is `clear`, `#ffdf20`, `#ffd6e7`, `#cfe8ff`, `#d8f0c2`.
- Text color picker opens in text-color mode only.
- Highlight picker opens in highlight mode only.
- Text color clear runs `unsetColor`.
- Highlight clear runs `unsetHighlight`.
- Collapsed cursor outside active text color apply sets stored mark for subsequent input.
- Collapsed cursor inside active text color apply updates the active color mark range at cursor.
- Collapsed cursor outside active text color clear is deterministic no-op.
- Collapsed cursor inside active text color clear unsets the active color mark range at cursor.
- Collapsed cursor outside active highlight apply sets stored mark for subsequent input.
- Collapsed cursor inside active highlight apply updates the active highlight mark range at cursor.
- Collapsed cursor outside active highlight clear is deterministic no-op.
- Collapsed cursor inside active highlight clear unsets the active highlight mark range at cursor.
- Expanded selection apply and clear use normal TipTap mark semantics.
- Text color and highlight return deterministic `EDITOR_MODE_UNSUPPORTED` outside TipTap mode.
- `src/renderer/tiptap/index.js` adds TextStyle, Color, and Highlight with `multicolor: true` for Highlight.
- `editor.js` owns picker open state, palette mode, anchor placement, and swatch application.
- `runtimeBridge.js` handles the two color command ids only through runtime handler callback paths.
- `runtimeBridge.js` must propagate negative callback outcomes exactly and never coerce them to success.
- `projectCommands.mjs` adds `FORMAT_TEXT_COLOR_PICKER`, `FORMAT_HIGHLIGHT_COLOR_PICKER`, and `REVIEW_OPEN_COMMENTS`.
- `LEGACY_ACTION_TO_COMMAND` adds `format-text-color`, `format-highlight`, and `review-comment`.
- `CAPABILITY_BINDING` adds `cmd.project.format.textColorPicker`, `cmd.project.format.highlightColorPicker`, and `cmd.project.review.openComments`.
- Capability ids are `cap.project.format.textColorPicker`, `cap.project.format.highlightColorPicker`, and `cap.project.review.openComments`.
- Color commands follow the current rich TipTap pattern and are gated by editor mode.
- `review.openComments` follows the current review shell pattern and is node-only like `review.switchMode`.
- `COMMAND_CAPABILITY_BINDING.json` remains SSOT and `GOVERNANCE_CHANGE_APPROVALS.json` must record the exact new hash.
- Current audit baseline is one direct `electron` high vulnerability and no new vulnerability key may appear.

## IMPLEMENTATION_STEPS
- Promote the three catalog entries to live and update canonical live order.
- Add the three approved TipTap OSS extensions for text-style, color, and highlight.
- Add explicit configurator library labels for `color` and `review`.
- Add one bounded color group and one bounded review group in `index.html`.
- Add one shared color picker overlay and minimal swatch styles.
- Wire TextStyle, Color, and Highlight in `src/renderer/tiptap/index.js`.
- Add UI actions and picker state handling in `editor.js`.
- Implement explicit collapsed-cursor apply and clear semantics for color and highlight.
- Add canonical command ids, legacy action mappings, and capability bindings.
- Update `runtimeBridge.js` for the two color picker callback commands with honest result propagation.
- Update `COMMAND_CAPABILITY_BINDING.json` and `GOVERNANCE_CHANGE_APPROVALS.json`.
- Update A1, A2, foundation, and profile switch tests to the new 15-item truth.
- Add dedicated Wave B helper and sector-m tests.
- Rebuild `editor.bundle.js`.
- Run strict gates, then commit, push, PR, and merge.

## CHECKS
- CHECK_01_PRE_WORKTREE_CLEAN: git status --porcelain
- CHECK_02_PRE_FETCH_ORIGIN: git fetch origin
- CHECK_03_PRE_BINDING_SHA_MATCH: node -e 'const {execSync}=require("node:child_process");const out=execSync("git ls-remote --heads origin main",{encoding:"utf8"}).trimEnd();const sha=(out.split(/\s+/)[0]||"");if(sha!=="15880ffe79111360636bf01a366c47a10d4cacd4"){console.error(`REMOTE_MAIN_SHA_MISMATCH:${sha}`);process.exit(1);}'
- CHECK_04_PRE_EXECUTION_BRANCH_CMD_01: git switch --detach 15880ffe79111360636bf01a366c47a10d4cacd4
- CHECK_04_PRE_EXECUTION_BRANCH_CMD_02: git switch -c codex-wave-b-001
- CHECK_05_PRE_BASELINE_FOCUSED_GREEN_CMD: node --test test/unit/toolbar-expansion-wave-a1.helpers.test.js test/unit/toolbar-profile-state.foundation.test.js test/unit/toolbar-profile-switch.helpers.test.js test/unit/toolbar-expansion-wave-a2.helpers.test.js test/unit/sector-m-toolbar-expansion-wave-a1.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js test/unit/sector-m-toolbar-expansion-wave-a2.test.js
- CHECK_06_PRE_DEPENDENCY_BASELINE_CMD: node -e 'const fs=require("node:fs");const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));const all={...(pkg.dependencies||{}),...(pkg.devDependencies||{})};const need=["@tiptap/extension-text-style","@tiptap/extension-color","@tiptap/extension-highlight"];for(const name of need){if(name in all){console.error(`WAVE_B_DEP_ALREADY_PRESENT:${name}`);process.exit(1);}}'
- CHECK_07_POST_BUILD_RENDERER: npm run -s build:renderer
- CHECK_08_POST_FOCUSED_NODE_CMD: node --test test/unit/toolbar-expansion-wave-a1.helpers.test.js test/unit/toolbar-profile-state.foundation.test.js test/unit/toolbar-profile-switch.helpers.test.js test/unit/toolbar-expansion-wave-a2.helpers.test.js test/unit/toolbar-expansion-wave-b.helpers.test.js test/unit/sector-m-toolbar-expansion-wave-a1.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js test/unit/sector-m-toolbar-expansion-wave-a2.test.js test/unit/sector-m-toolbar-expansion-wave-b.test.js
- CHECK_09_POST_SECTOR_M: npm run -s test:sector-m
- CHECK_10_POST_OPS: npm run -s test:ops
- CHECK_11_POST_OSS_POLICY: npm run -s oss:policy
- CHECK_12_POST_NPM_TEST: npm test
- CHECK_13_POST_AUDIT_JSON_SHAPE_CMD: node -e 'const {spawnSync}=require("node:child_process");const r=spawnSync("npm",["audit","--json"],{encoding:"utf8"});const raw=(r.stdout||"").trim();if(!raw){console.error("AUDIT_OUTPUT_MISSING");process.exit(1);}let data;try{data=JSON.parse(raw);}catch{console.error("AUDIT_JSON_INVALID");process.exit(1);}const keys=Object.keys(data.vulnerabilities||{}).sort();const meta=(data.metadata&&data.metadata.vulnerabilities)||{};const ok=keys.length===1&&keys[0]==="electron"&&meta.high===1&&meta.total===1&&meta.critical===0;if(!ok){console.error(`AUDIT_SHAPE_CHANGED:${JSON.stringify({keys,meta})}`);process.exit(1);}'
- CHECK_14_POST_DIFF_CHECK: git diff --check
- CHECK_15_POST_DEPENDENCY_SET_CMD: node -e 'const fs=require("node:fs");const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));const deps=Object.keys(pkg.dependencies||{}).sort();const dev=Object.keys(pkg.devDependencies||{}).sort();const wantDeps=["@tiptap/core","@tiptap/extension-link","@tiptap/extension-underline","@tiptap/extension-text-style","@tiptap/extension-color","@tiptap/extension-highlight","@tiptap/pm","@tiptap/starter-kit"].sort();const wantDev=["electron","electron-builder","esbuild"].sort();const eq=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);if(!eq(deps,wantDeps)){console.error(`DEPENDENCY_SET_MISMATCH:${JSON.stringify(deps)}`);process.exit(1);}if(!eq(dev,wantDev)){console.error(`DEVDEPENDENCY_SET_MISMATCH:${JSON.stringify(dev)}`);process.exit(1);}'
- CHECK_16_POST_ALLOWLIST_HARD_CMD: node -e 'const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){console.error("ALLOWLIST is empty");process.exit(2);}const out=execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}).trimEnd();if(!out){console.error("Working tree is clean");process.exit(1);}const changed=new Set(out.split("\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));if(changed.size!==allow.size){console.error("Changed paths set != allowlist");process.exit(1);}for(const p of changed){if(!allow.has(p)){console.error(`Disallowed change: ${p}`);process.exit(1);}}for(const p of allow){if(!changed.has(p)){console.error(`Missing expected change: ${p}`);process.exit(1);}}process.exit(0);' docs/tasks/TOOLBAR_EXPANSION_WAVE_B_001.md src/renderer/toolbar/toolbarFunctionCatalog.mjs src/renderer/editor.js src/renderer/index.html src/renderer/styles.css src/renderer/commands/projectCommands.mjs src/renderer/commands/capabilityPolicy.mjs src/renderer/tiptap/runtimeBridge.js src/renderer/tiptap/index.js docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json package.json package-lock.json src/renderer/editor.bundle.js test/unit/toolbar-expansion-wave-a1.helpers.test.js test/unit/sector-m-toolbar-expansion-wave-a1.test.js test/unit/toolbar-expansion-wave-a2.helpers.test.js test/unit/sector-m-toolbar-expansion-wave-a2.test.js test/unit/toolbar-profile-state.foundation.test.js test/unit/toolbar-profile-switch.helpers.test.js test/unit/sector-m-tiptap-runtime-bridge.test.js test/unit/toolbar-expansion-wave-b.helpers.test.js test/unit/sector-m-toolbar-expansion-wave-b.test.js
- CHECK_17_POST_GOVERNANCE_STATE_VALID: node scripts/ops/governance-state-valid-state.mjs --json
- CHECK_18_POST_GOVERNANCE_APPROVAL_STATE: node scripts/ops/governance-approval-state.mjs --json

## STOP_CONDITION
- remote main moved from `BINDING_BASE_SHA`
- worktree dirty before write
- implementation requires editing `toolbarProfileState.mjs`
- implementation requires editing `toolbarRuntimeProjection.mjs`
- implementation requires profile auto backfill or storage bump
- implementation requires reorder semantic change
- implementation requires new modal subsystem or generic overlay framework
- implementation requires comment thread model, comment persistence, or annotation anchors
- implementation requires non approved dependency
- any mandatory post check fails
- commit, push, PR, or merge fails
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
- audit result must be reported honestly against the current baseline rule
- governance result must be reported honestly against the machine check outputs

## FAIL_PROTOCOL
- no silent rebase
- no silent scope expansion beyond Wave B
- no silent dependency changes
- no silent storage semantic changes
- report exact failed check and exact unexpected basenames
- if target branch drifted request new owner approved base sha
- if audit baseline expands stop and report the exact delta
- if governance approval or binding validation fails stop and report the exact machine failure
