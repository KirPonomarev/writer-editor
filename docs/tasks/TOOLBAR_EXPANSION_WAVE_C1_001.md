# TOOLBAR_EXPANSION_WAVE_C1_001

DOC_TYPE: SELECTION_BRIEF_PLUS_FINAL_EXECUTION_PLAN
TASK_ID: TOOLBAR_EXPANSION_WAVE_C1_001
MILESTONE: A7
TYPE: CORE
STATUS: EXECUTION_READY_AFTER_SELECTION_BRIEF_REBIND_AND_LITERAL_CHECK_FIXES
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0
TARGET_BRANCH: main
BINDING_BASE_SHA: 42299de0bdbec68b6d256ab40e93818c230384df
DELIVERY_POLICY: COMMIT_REQUIRED_PUSH_REQUIRED_PR_REQUIRED_MERGE_REQUIRED

SELECTION_BRIEF_STATUS: PASS
SELECTION_EVIDENCE_01: toolbar.style.paragraph and toolbar.style.character remain planned after Wave B and form the next contiguous nonblocked pair.
SELECTION_EVIDENCE_02: editor.js already contains dormant style plumbing and legacy style helpers.
SELECTION_EVIDENCE_03: documentContentEnvelope.mjs plain-text rebuild cannot be the primary TipTap style path because it only rebuilds paragraph and text nodes.
SELECTION_EVIDENCE_04: StarterKit already provides a safe structured subset for paragraph, heading, blockquote, italic, and code.
SELECTION_EVIDENCE_05: insert.image, spellcheck, and unsupported custom paragraph variants do not have safe runtime support in this contour.
SELECTION_DECISION: Promote style paragraph and style character using structured TipTap behavior only for the supported subset.

## MICRO_GOAL

- Promote `toolbar.style.paragraph` and `toolbar.style.character` from planned to live.
- Add one bounded styles group to the existing floating toolbar without storage, profile, or reorder changes.
- Use structured TipTap-native transforms only in active TipTap mode.
- Keep legacy style helpers unchanged and nonprimary.
- Keep `toolbar.insert.image` and `toolbar.proofing.spellcheck` out of scope.

## ARTIFACT

- `docs/tasks/TOOLBAR_EXPANSION_WAVE_C1_001.md`
- `src/renderer/toolbar/toolbarFunctionCatalog.mjs`
- `src/renderer/editor.js`
- `src/renderer/index.html`
- `src/renderer/styles.css`
- `src/renderer/tiptap/index.js`
- `src/renderer/editor.bundle.js`
- `test/unit/toolbar-expansion-wave-a1.helpers.test.js`
- `test/unit/sector-m-toolbar-expansion-wave-a1.test.js`
- `test/unit/toolbar-expansion-wave-a2.helpers.test.js`
- `test/unit/sector-m-toolbar-expansion-wave-a2.test.js`
- `test/unit/toolbar-expansion-wave-b.helpers.test.js`
- `test/unit/sector-m-toolbar-expansion-wave-b.test.js`
- `test/unit/toolbar-profile-state.foundation.test.js`
- `test/unit/toolbar-profile-switch.helpers.test.js`
- `test/unit/toolbar-expansion-wave-c1.helpers.test.js`
- `test/unit/sector-m-toolbar-expansion-wave-c1.test.js`

## ALLOWLIST

- `docs/tasks/TOOLBAR_EXPANSION_WAVE_C1_001.md`
- `src/renderer/toolbar/toolbarFunctionCatalog.mjs`
- `src/renderer/editor.js`
- `src/renderer/index.html`
- `src/renderer/styles.css`
- `src/renderer/tiptap/index.js`
- `src/renderer/editor.bundle.js`
- `test/unit/toolbar-expansion-wave-a1.helpers.test.js`
- `test/unit/sector-m-toolbar-expansion-wave-a1.test.js`
- `test/unit/toolbar-expansion-wave-a2.helpers.test.js`
- `test/unit/sector-m-toolbar-expansion-wave-a2.test.js`
- `test/unit/toolbar-expansion-wave-b.helpers.test.js`
- `test/unit/sector-m-toolbar-expansion-wave-b.test.js`
- `test/unit/toolbar-profile-state.foundation.test.js`
- `test/unit/toolbar-profile-switch.helpers.test.js`
- `test/unit/toolbar-expansion-wave-c1.helpers.test.js`
- `test/unit/sector-m-toolbar-expansion-wave-c1.test.js`

## DENYLIST

- `src/renderer/toolbar/toolbarProfileState.mjs`
- `src/renderer/toolbar/toolbarRuntimeProjection.mjs`
- `src/renderer/commands/projectCommands.mjs`
- `src/renderer/commands/capabilityPolicy.mjs`
- `src/renderer/tiptap/runtimeBridge.js`
- `docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json`
- `docs/OPS/STATUS/GOVERNANCE_CHANGE_APPROVALS.json`
- `package.json`
- `package-lock.json`
- `src/renderer/documentContentEnvelope.mjs`
- `test/unit/sector-m-tiptap-runtime-bridge.test.js`
- `test/unit/toolbar-profile-ordering.helpers.test.js`
- `test/unit/sector-m-toolbar-profile-ordering.test.js`
- `test/unit/sector-m-toolbar-minimal-runtime.test.js`
- `src/main.js`
- `src/preload.js`

Rules:
- No storage version 4.
- No profile semantic change.
- No reorder semantic change.
- No new toolbar.
- No new dependency.
- No command layer expansion.
- No capability policy expansion.
- No governance artifact change.
- No document envelope change.
- No image insertion scope.
- No spellcheck scope.

## CONTRACT / SHAPES

- `toolbar.style.paragraph` becomes live with `actionAlias: 'toggle-style-paragraph-menu'` and `commandId: null`.
- `toolbar.style.character` becomes live with `actionAlias: 'toggle-style-character-menu'` and `commandId: null`.
- Canonical live order after C1 becomes:
  `toolbar.font.family`, `toolbar.font.weight`, `toolbar.font.size`, `toolbar.text.lineHeight`, `toolbar.format.bold`, `toolbar.format.italic`, `toolbar.format.underline`, `toolbar.paragraph.alignment`, `toolbar.list.type`, `toolbar.insert.link`, `toolbar.color.text`, `toolbar.color.highlight`, `toolbar.review.comment`, `toolbar.style.paragraph`, `toolbar.style.character`, `toolbar.history.undo`, `toolbar.history.redo`.
- Live count after C1 is 17.
- Storage remains version 3; existing persisted profiles are preserved exactly and are not auto backfilled.
- New project seed and safe reset inherit the two new live items only through catalog truth.
- Main toolbar group order becomes `type`, `format-inline`, `paragraph`, `insert`, `color`, `review`, `styles`, `history`.
- Styles group contains exactly two triggers: `style-paragraph` and `style-character`.
- One shared styles menu overlay is added and reused by paragraph and character style only.
- Supported paragraph options are `paragraph-none`, `paragraph-title`, `paragraph-heading1`, `paragraph-heading2`, `paragraph-blockquote`.
- Supported character options are `character-emphasis` and `character-code-span`.
- Unsupported custom paragraph options remain out of live UI scope.
- Active TipTap mode must not call `setPlainText` or any plain-text rebuild path for style actions.
- Active TipTap mode mappings are:
  - `paragraph-none` to `setParagraph`
  - `paragraph-title` to heading level 1
  - `paragraph-heading1` to heading level 2
  - `paragraph-heading2` to heading level 3
  - `paragraph-blockquote` to `setBlockquote`
  - `character-emphasis` to italic
  - `character-code-span` to code mark
- Style action result shape is `{ performed, action, reason, optionId }`.
- Character style with empty selection returns `NO_SELECTION`.
- No-effect paragraph or character style returns `NO_OP`.
- Unsupported style option returns `UNSUPPORTED_STYLE_OPTION`.
- Legacy style behavior remains unchanged and legacy helpers remain legacy only.
- No command layer, capability layer, runtime bridge, dependency, governance, or document envelope change is allowed in this contour.

## IMPLEMENTATION_STEPS

1. Promote the two catalog entries to live and set action aliases.
2. Add `styles` group label in configurator library labels.
3. Add one bounded styles group and one shared styles menu in `index.html`.
4. Add minimal styles menu CSS in `styles.css`.
5. Add structured style helpers in `src/renderer/tiptap/index.js` for supported options only.
6. Wire `toggle-style-paragraph-menu` and `toggle-style-character-menu` in `editor.js`.
7. Wire style menu actions in `editor.js` to the new structured TipTap helpers only.
8. Keep legacy helpers unchanged and nonprimary.
9. Update A1, A2, B, foundation, and profile-switch tests to the 17-item truth.
10. Add dedicated C1 helper and sector-m tests.
11. Rebuild `editor.bundle.js`.
12. Run strict gates, then commit, push, PR, and merge.

## CHECKS

- `git status --porcelain`
- `git fetch origin`
- `node -e 'const{execSync}=require("node:child_process");const out=execSync("git ls-remote --heads origin main",{encoding:"utf8"}).trimEnd();const sha=(out.split(String.fromCharCode(9))[0]||"");if(sha!=="42299de0bdbec68b6d256ab40e93818c230384df"){console.error(`REMOTE_MAIN_SHA_MISMATCH:${sha}`);process.exit(1);}'`
- `git cat-file -t 42299de0bdbec68b6d256ab40e93818c230384df`
- `git switch --detach 42299de0bdbec68b6d256ab40e93818c230384df`
- `git switch -c codex-wave-c1-001`
- `node --test test/unit/toolbar-expansion-wave-a1.helpers.test.js test/unit/toolbar-profile-state.foundation.test.js test/unit/toolbar-profile-switch.helpers.test.js test/unit/toolbar-expansion-wave-a2.helpers.test.js test/unit/toolbar-expansion-wave-b.helpers.test.js test/unit/sector-m-toolbar-expansion-wave-a1.test.js test/unit/sector-m-toolbar-expansion-wave-a2.test.js test/unit/sector-m-toolbar-expansion-wave-b.test.js`
- `npm run -s oss:policy`
- `npm run -s build:renderer`
- `node --test test/unit/toolbar-expansion-wave-a1.helpers.test.js test/unit/toolbar-profile-state.foundation.test.js test/unit/toolbar-profile-switch.helpers.test.js test/unit/toolbar-expansion-wave-a2.helpers.test.js test/unit/toolbar-expansion-wave-b.helpers.test.js test/unit/toolbar-expansion-wave-c1.helpers.test.js test/unit/sector-m-toolbar-expansion-wave-a1.test.js test/unit/sector-m-toolbar-expansion-wave-a2.test.js test/unit/sector-m-toolbar-expansion-wave-b.test.js test/unit/sector-m-toolbar-expansion-wave-c1.test.js`
- `npm run -s test:sector-m`
- `npm run -s test:ops`
- `npm run -s oss:policy`
- `npm test`
- `node -e 'const{spawnSync}=require("node:child_process");const r=spawnSync("npm",["audit","--json"],{encoding:"utf8"});const raw=(r.stdout||"").trim();if(!raw){console.error("AUDIT_OUTPUT_MISSING");process.exit(1);}let data;try{data=JSON.parse(raw);}catch{console.error("AUDIT_JSON_INVALID");process.exit(1);}const keys=Object.keys(data.vulnerabilities||{}).sort();const meta=(data.metadata&&data.metadata.vulnerabilities)||{};const ok=keys.length===1&&keys[0]==="electron"&&meta.high===1&&meta.total===1&&meta.critical===0;if(!ok){console.error(`AUDIT_SHAPE_CHANGED:${JSON.stringify({keys,meta})}`);process.exit(1);}'`
- `git diff --check`

## STOP_CONDITION

- Remote main moved from `BINDING_BASE_SHA`.
- Worktree dirty before write.
- Implementation requires changing `toolbarProfileState.mjs` or `toolbarRuntimeProjection.mjs`.
- Implementation requires changing command layer, capability layer, runtime bridge, dependency graph, or document envelope.
- Implementation requires image insertion or spellcheck scope.
- Implementation requires storage bump, profile change, or reorder change.
- Any mandatory postcheck fails.
- Commit, push, PR, or merge fails.

STOP_STATUS: STOP_NOT_DONE

## REPORT_FORMAT

- `TASK_ID`
- `HEAD_SHA_BEFORE`
- `HEAD_SHA_AFTER`
- `COMMIT_SHA`
- `CHANGED_BASENAMES`
- `STAGED_SCOPE_MATCH`
- `COMMIT_OUTCOME`
- `PUSH_RESULT`
- `PR_RESULT`
- `MERGE_RESULT`
- `NEXT_STEP`

Rules:
- Final result without `COMMIT_SHA` is not done.
- Final result with incomplete delivery chain is not done.
- Basenames only in changed file lists.
- Audit result must be reported honestly.

## FAIL_PROTOCOL

- No silent rebase.
- No silent scope expansion beyond C1.
- No silent dependency changes.
- No silent command layer changes.
- No silent storage semantic changes.
- No silent document envelope changes.
- Report exact failed check and exact unexpected basenames.
- If target branch drifted, request new owner-approved base SHA.
- If audit baseline expands, stop and report the exact delta.
