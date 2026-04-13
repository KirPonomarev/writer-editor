TASK_ID: TOOLBAR_PROFILE_ORDERING_001
MILESTONE: A4
TYPE: CORE
STATUS: EXECUTION_READY_AFTER_REBIND
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0
TARGET_BRANCH: main
BINDING_BASE_SHA: d9522133b6019cce3c039bac38cd0ae368ab09c1
DELIVERY_POLICY: COMMIT_REQUIRED_PUSH_REQUIRED_PR_REQUIRED_MERGE_REQUIRED

## MICRO_GOAL
- Ввести честный reorder для already live toolbar items внутри minimal и master profiles.
- Научить runtime projection применять не только membership, но и persisted order.
- Сохранить границы подсистемы: без новых live функций, без новых зависимостей, без изменения command semantics и без storage version 4.

## ARTIFACT
- docs/tasks/TOOLBAR_PROFILE_ORDERING_001.md
- src/renderer/editor.js
- src/renderer/toolbar/toolbarRuntimeProjection.mjs
- src/renderer/styles.css
- src/renderer/editor.bundle.js
- test/unit/toolbar-configurator-foundation.integration.test.js
- test/unit/toolbar-runtime-projection.helpers.test.js
- test/unit/sector-m-toolbar-profile-switch.test.js
- test/unit/toolbar-profile-ordering.helpers.test.js
- test/unit/sector-m-toolbar-profile-ordering.test.js

## ALLOWLIST
- docs/tasks/TOOLBAR_PROFILE_ORDERING_001.md
- src/renderer/editor.js
- src/renderer/toolbar/toolbarRuntimeProjection.mjs
- src/renderer/styles.css
- src/renderer/editor.bundle.js
- test/unit/toolbar-configurator-foundation.integration.test.js
- test/unit/toolbar-runtime-projection.helpers.test.js
- test/unit/sector-m-toolbar-profile-switch.test.js
- test/unit/toolbar-profile-ordering.helpers.test.js
- test/unit/sector-m-toolbar-profile-ordering.test.js

## DENYLIST
- src/renderer/toolbar/toolbarFunctionCatalog.mjs
- src/renderer/toolbar/toolbarProfileState.mjs
- src/renderer/projectCommands.mjs
- src/renderer/capabilityPolicy.mjs
- src/renderer/runtimeBridge.js
- src/main.js
- src/preload.js
- package.json
- package-lock.json
- no new live functions
- no underline
- no link
- no command kernel change
- no capability policy expansion
- no storage version 4
- no second toolbar
- no DOM clone
- no remove and recreate projection
- no cross profile drag move semantics

## CONTRACT / SHAPES
- Source of truth for order is array sequence inside toolbarProfiles minimal and toolbarProfiles master.
- Persisted non empty profile arrays keep user order and are never canonical resorted.
- Canonical live order remains baseline only for first create, migration fallback and safe reset.
- Reorder is independent per profile.
- activeToolbarProfile selects which ordered profile projects to runtime.
- Reorder applies only to already live items.
- Item identity remains itemId only.
- Runtime group ownership remains bound to real DOM groups and never to catalog uiGroup.
- An item may move in order but may not change its owning runtime group.
- Library click still appends to active profile.
- Library drag drop into a bucket inserts at computed drop index and is no longer append only.
- Bucket item drag reorder works only inside the same bucket.
- Dragging a bucket item into the other profile bucket is no op.
- Remove button still removes from own bucket only.
- Inactive bucket reorder persists its own array but does not affect live toolbar until profile switch.
- Drag payload may include sourceType, itemId, bucketKey and sourceIndex, but must not introduce second identity system.
- Exactly one active drop target marker may exist at a time.
- Hovered bucket item exposes before or after marker only.
- Empty bucket or trailing bucket area exposes inside marker only.
- Dragleave, drop and dragend clear all drop target markers.
- Visible item order inside a runtime group follows the order of activeToolbarProfile ids filtered to that group.
- Top level runtime group order follows the first visible member position of each group in activeToolbarProfile.
- Hidden items remain hidden and do not influence group order.
- Empty groups stay hidden.
- Projection may reorder existing item wrappers and group containers but must not clone or recreate them.
- Item reorder may use insertBefore or equivalent only within the owning runtime group element.
- Group reorder may use insertBefore or equivalent only within the existing floating toolbar controls container.
- No DOM move is allowed outside the controls container or across owning runtime group boundaries.
- Post projection anchor resync and overlay cleanup remain mandatory for paragraph, spacing and list surfaces.
- Focus safety remains mandatory when reordered or hidden anchors affect active focus.
- applyToolbarActiveProfile remains the primary projection entrypoint.
- applyToolbarProfileMinimal remains a compatibility wrapper.
- Projection snapshot helpers must expose enough order facts for tests.
- No second runtime adapter and no label based lookup.
- Existing no reorder foundation and runtime helper tests must be rewritten honestly, not bypassed.
- Current audit baseline contains one existing direct electron high advisory.
- If dependency graph is unchanged and audit reproduces only that same advisory, result is advisory record only and not blocking.
- Any new advisory or any changed dependency graph is STOP_NOT_DONE.

## IMPLEMENTATION_STEPS
- Add reorder helpers in src/renderer/editor.js for bucket item drag start, drag over target resolution, reorder commit and same bucket guards.
- Update bucket item render in src/renderer/editor.js to expose stable drag metadata, sourceIndex and bounded drop target markers.
- Update test/unit/toolbar-configurator-foundation.integration.test.js from no reorder assertions to bounded same bucket reorder assertions.
- Extend src/renderer/toolbar/toolbarRuntimeProjection.mjs to reorder item wrappers within groups by active profile order.
- Extend src/renderer/toolbar/toolbarRuntimeProjection.mjs to reorder visible group containers by first visible member position inside the controls container.
- Rewrite test/unit/toolbar-runtime-projection.helpers.test.js from zero DOM move contract to bounded reorder contract within existing containers only.
- Preserve overlay cleanup and anchor resync after order projection.
- Add focused ordering tests and keep existing profile switch regression green.
- Update tracked build output src/renderer/editor.bundle.js.
- Run strict gates before commit.

## CHECKS
- CHECK_01_PRE_WORKTREE_CLEAN: git status --porcelain
- CHECK_02_PRE_FETCH_ORIGIN: git fetch origin
- CHECK_03_PRE_BINDING_SHA_MATCH: node -e 'const {execSync}=require("node:child_process");const out=execSync("git ls-remote --heads origin main",{encoding:"utf8"}).trimEnd();const sha=(out.split(/\s+/)[0]||"");if(sha!=="d9522133b6019cce3c039bac38cd0ae368ab09c1"){console.error(`REMOTE_MAIN_SHA_MISMATCH:${sha}`);process.exit(1);}'
- CHECK_04_PRE_EXECUTION_BRANCH_CMD_01: git switch --detach d9522133b6019cce3c039bac38cd0ae368ab09c1
- CHECK_04_PRE_EXECUTION_BRANCH_CMD_02: git switch -c codex/toolbar-profile-ordering-001
- CHECK_05_PRE_BASELINE_FOCUSED_GREEN_CMD: node --test test/unit/toolbar-configurator-foundation.integration.test.js test/unit/toolbar-runtime-projection.helpers.test.js test/unit/toolbar-profile-switch.helpers.test.js test/unit/sector-m-toolbar-minimal-runtime.test.js test/unit/sector-m-toolbar-profile-switch.test.js
- CHECK_06_PRE_DENYLIST_CLEAN: node -e 'const {execSync}=require("node:child_process");const deny=new Set(["src/renderer/toolbar/toolbarFunctionCatalog.mjs","src/renderer/toolbar/toolbarProfileState.mjs","src/renderer/projectCommands.mjs","src/renderer/capabilityPolicy.mjs","src/renderer/runtimeBridge.js","src/main.js","src/preload.js","package.json","package-lock.json"]);const out=execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}).trimEnd();if(!out){process.exit(0);}for(const line of out.split("\\n")){const p=line.slice(3).split(" -> ").pop();if(deny.has(p)){console.error(`DENYLIST_DIRTY:${p}`);process.exit(1);}}'
- CHECK_07_POST_BUILD_RENDERER: npm run -s build:renderer
- CHECK_08_POST_FOCUSED_NODE_CMD: node --test test/unit/toolbar-configurator-foundation.integration.test.js test/unit/toolbar-runtime-projection.helpers.test.js test/unit/toolbar-profile-switch.helpers.test.js test/unit/toolbar-profile-ordering.helpers.test.js test/unit/sector-m-toolbar-minimal-runtime.test.js test/unit/sector-m-toolbar-profile-switch.test.js test/unit/sector-m-toolbar-profile-ordering.test.js
- CHECK_09_POST_SECTOR_M: npm run -s test:sector-m
- CHECK_10_POST_OPS: npm run -s test:ops
- CHECK_11_POST_OSS_POLICY: npm run -s oss:policy
- CHECK_12_POST_NPM_TEST: npm test
- CHECK_13_POST_AUDIT: npm audit
- CHECK_14_POST_DIFF_CHECK: git diff --check
- CHECK_15_POST_ALLOWLIST_HARD_CMD: node -e 'const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){console.error("ALLOWLIST is empty");process.exit(2);}const out=execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}).trimEnd();if(!out){console.error("Working tree is clean");process.exit(1);}const changed=new Set(out.split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));if(changed.size!==allow.size){console.error("Changed paths set != allowlist");process.exit(1);}for(const p of changed){if(!allow.has(p)){console.error(`Disallowed change: ${p}`);process.exit(1);}}for(const p of allow){if(!changed.has(p)){console.error(`Missing expected change: ${p}`);process.exit(1);}}process.exit(0);' docs/tasks/TOOLBAR_PROFILE_ORDERING_001.md src/renderer/editor.js src/renderer/toolbar/toolbarRuntimeProjection.mjs src/renderer/styles.css src/renderer/editor.bundle.js test/unit/toolbar-configurator-foundation.integration.test.js test/unit/toolbar-runtime-projection.helpers.test.js test/unit/sector-m-toolbar-profile-switch.test.js test/unit/toolbar-profile-ordering.helpers.test.js test/unit/sector-m-toolbar-profile-ordering.test.js
- CHECK_16_POST_AUDIT_RULE: if dependency graph is unchanged and audit reproduces only the already known unchanged electron advisory record it honestly and continue
- CHECK_17_POST_AUDIT_FAIL_RULE: if audit output changes or dependency graph changes contour status is STOP_NOT_DONE

## STOP_CONDITION
- fetched remote main moved from BINDING_BASE_SHA
- worktree dirty before write
- implementation needs src/renderer/toolbar/toolbarFunctionCatalog.mjs or command layer changes
- implementation requires cross profile move semantics to work
- implementation requires second toolbar or DOM clone strategy
- any mandatory check fails under the explicit audit rule
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
- audit result must be reported honestly as advisory or fail under the explicit rule

## FAIL_PROTOCOL
- no silent rebase
- no silent scope expansion into expansion wave items
- no silent dependency changes
- report exact failed check and exact unexpected basenames
- if target branch drifted request new owner approved base sha
- if audit result differs from the known unchanged electron advisory stop and report exact delta
- NEXT_AFTER_THIS: TOOLBAR_EXPANSION_WAVE_A2_001_OR_TOOLBAR_EXPANSION_WAVE_B_001
- RECOMMENDED_NEXT_AFTER_THIS: TOOLBAR_EXPANSION_WAVE_A2_001
