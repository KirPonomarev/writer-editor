TASK_ID: CORE-A4-YALKEN-CONTOUR-01-001
MILESTONE: A4
TYPE: CORE
STATUS: PROOFHOOK_AND_TESTS_ONLY_NOT_ADMITTED_FOR_CODE_WRITES
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Исполнить только первый узкий контур `CONTOUR_01_PRIMARY_EDITOR_LOCAL_SAVE_AND_LAST_STABLE_RECOVERY` как post-closure стабилизацию уже существующего primary editor path через exact live menu-save path, exact live autosave-reopen recovery path и exact live host-state boundary read seam без shell expansion, pack inflation, formal cutover или editor-stack migration.

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-CONTOUR-01-001.md
- docs/OPS/STATUS/MIOS_FIRST_VERTICAL_SLICE_DEFINITION_RECORD_V1.json
- docs/OPS/STATUS/MIOS_FIRST_VERTICAL_SLICE_EXECUTION_PROOF_RECORD_V1.json
- docs/OPS/STATUS/CONTOUR_01_ADMISSION_DECISION_RECORD_V1.json
- docs/OPS/STATUS/CONTOUR_01_PROOF_CLOSURE_RECORD_V1.json
- scripts/ops/contour-01-primary-editor-save-recovery-proofhook.mjs
- src/renderer/commands/command-catalog.v1.mjs
- src/renderer/commands/projectCommands.mjs
- src/menu/menu-config.v1.json
- src/menu/menu-config-normalizer.js
- src/main.js
- src/preload.js
- src/renderer/tiptap/runtimeBridge.js
- test/contracts/contour-01-primary-editor-save-recovery-proofhook.contract.test.js
- test/contracts/command-namespace-canon-and-alias-bridge.contract.test.js
- test/contracts/command-surface-bus-only.contract.test.js
- test/contracts/menu-config-normalization.contract.test.js
- test/contracts/phase00-tiptap-persistence-proofhook.contract.test.js
- test/contracts/x3-recovery-smoke.contract.test.js
- test/electron/atomicWrite.test.js

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-CONTOUR-01-001.md
- docs/OPS/STATUS/MIOS_FIRST_VERTICAL_SLICE_DEFINITION_RECORD_V1.json
- docs/OPS/STATUS/MIOS_FIRST_VERTICAL_SLICE_EXECUTION_PROOF_RECORD_V1.json
- docs/OPS/STATUS/CONTOUR_01_ADMISSION_DECISION_RECORD_V1.json
- docs/OPS/STATUS/CONTOUR_01_PROOF_CLOSURE_RECORD_V1.json
- scripts/ops/contour-01-primary-editor-save-recovery-proofhook.mjs
- src/renderer/commands/command-catalog.v1.mjs
- src/renderer/commands/projectCommands.mjs
- src/menu/menu-config.v1.json
- src/menu/menu-config-normalizer.js
- src/main.js
- src/preload.js
- src/renderer/tiptap/runtimeBridge.js
- test/contracts/contour-01-primary-editor-save-recovery-proofhook.contract.test.js
- test/contracts/command-namespace-canon-and-alias-bridge.contract.test.js
- test/contracts/command-surface-bus-only.contract.test.js
- test/contracts/menu-config-normalization.contract.test.js
- test/contracts/phase00-tiptap-persistence-proofhook.contract.test.js
- test/contracts/x3-recovery-smoke.contract.test.js
- test/electron/atomicWrite.test.js

## DENYLIST
- git stash
- git reset
- git checkout
- git clean
- rebase
- commit --amend
- любые изменения вне ALLOWLIST
- любые новые зависимости
- любой новый recovery channel
- любой новый storage channel
- любой network transport
- любой cutover claim
- любая pack promotion
- любая broad shell rewrite
- любая editor-stack migration внутри этого контура

## CONTRACT / SHAPES
- CONTOUR_ID: CONTOUR_01_PRIMARY_EDITOR_LOCAL_SAVE_AND_LAST_STABLE_RECOVERY
- EXECUTABLE_USER_PATH_ID: PRIMARY_EDITOR_LOCAL_SAVE_AND_RECOVER_USER_PATH_V1
- COMMAND_PROJECTION_PATH_ID: PRIMARY_EDITOR_SAVE_COMMAND_PROJECTION_V1
- MANIFEST_SURFACE_PATH_ID: PRIMARY_EDITOR_SAVE_SURFACE_MANIFEST_PATH_V1
- SHELL_PRESENTATION_PATH_ID: PRIMARY_EDITOR_SINGLE_SAVE_PRESENTATION_PATH_V1
- SNAPSHOT_RECOVERY_PATH_ID: PRIMARY_EDITOR_LAST_STABLE_SNAPSHOT_RECOVERY_PATH_V1
- BOUNDARY_READ_PATH_ID: PRIMARY_EDITOR_HOST_STATE_BOUNDARY_READ_PATH_V1
- EDITOR_ROOT_INVARIANT_ID: EDITOR_ROOT_REMAINS_DOCKED_IN_V1
- exact live manifest surface for this contour is menu only
- exact live shell presentation for this contour is menu-primary and anchored at main menu `file-save`
- existing hotkey-triggered save path remains part of the executable user path and is not treated as a separate presentation surface
- toolbar, palette and other save surfaces are out of scope for this contour
- exact live recovery obligation for this contour is autosave write plus reopen plus `ui:recovery-restored` only
- `restore-last-stable-shell`, `safe-reset-shell` and any shell-level last-stable subsystem are explicitly out of scope
- exact live boundary read seam for this contour is `requestEditorText` plus `editor:text-request` plus `editor:text-response` plus `composeDocumentContent` only
- runtimeBridge awareness remains part of recovery normalization and bundle awareness remains mandatory because runtime loads `editor.bundle.js`
- tiptap ipc seam is out of scope for this contour
- app state remains host-owned in v1
- editor root remains docked in v1
- no second source of truth
- no parallel recovery channel
- no formal cutover
- no pack-layer promotion
- no release-scope inflation
- no contour 02 work inside this task
- no dependency-major changes inside this task
- exact repo surfaces must be resolved before code writes
- if exact contour work would require `editor.js` source mutation, STOP and open one separate bundle-aware follow-up because runtime loads `editor.bundle.js`
- if exact contour work would require mutation of any already-dirty mapped code surface, STOP and reopen in one isolated clean execution lane
- definition record and execution proof record are both required
- definition record alone is never PASS
- execution proof record alone is never PASS
- current phase permits proofhook, contract-test and narrow admission-record work only
- current phase does not admit broad code writes on mapped runtime surfaces
- allowlist remains broader than the currently admitted write scope and must not be read as automatic write admission
- currently admitted write scope is limited to task text, definition record, execution proof record, contour admission decision record, contour proof closure record, proofhook script and proofhook contract test unless separate admission is issued later
- current phase supremacy rule: no runtime surface writes are admitted now, and any later code path in this task remains dormant until a separate admission decision explicitly reopens the task for code writes
- ROLE_INTEGRATOR: owns task integration, final surface map, final allowlist discipline, proof assembly
- ROLE_CODE_AGENT: owns only narrow code changes on resolved save, boundary and recovery surfaces
- ROLE_INDEPENDENT_INSPECTOR: owns false-pass and false-hold audit and does not author the implementation patch

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01 и CHECK_02 до любых write-изменений.
1) Прочитать active canon resolution, `CANON.md`, `docs/CONTEXT.md`, `docs/HANDOFF.md` и `docs/PROCESS.md`; убедиться, что contour 01 читается как post-closure stabilization contour, а не как shell-expansion contour.
2) Разрешить exact repo surfaces для семи contour IDs и зафиксировать их в `MIOS_FIRST_VERTICAL_SLICE_DEFINITION_RECORD_V1.json`.
3) Если exact surface binding не получен хотя бы для одного contour ID, STOP без code writes.
3A) В текущей фазе proofhook and tests only любые runtime surface writes запрещены; шаги 4 и 6 активируются только после отдельного admission решения.
4) Выполнить только минимальные code changes, необходимые для исполнимости menu-only save command projection, menu-only manifest-to-surface route, exact host-state boundary read seam и autosave-reopen recovery path.
5) Не менять editor root topology, не добавлять новый runtime channel, не расширять scope до contour 02 и не доказывать toolbar, palette, shell-reset или shell-last-stable пути.
6) Если exact live path не требует code changes, contour может остаться proof contour without source mutation; если code changes всё же нужны, они допускаются только на exact mapped live surfaces.
7) Запустить целевые проверки и затем собрать `MIOS_FIRST_VERTICAL_SLICE_EXECUTION_PROOF_RECORD_V1.json` с observed evidence по menu save, boundary seam и autosave-reopen recovery path.
8) Перед финальным PASS передать результат независимому инспектору; если инспектор находит false-pass, false-hold или scope drift, STOP без расширения allowlist.
8A) После независимой классификации red gates собрать `CONTOUR_01_ADMISSION_DECISION_RECORD_V1.json` с явным разделением `RELEVANT_GATES` и `EXTERNAL_GATES`.
8B) Если decision = `CLOSE_AS_PROOF_CONTOUR_WITHOUT_RUNTIME_MUTATION`, собрать `CONTOUR_01_PROOF_CLOSURE_RECORD_V1.json` без runtime writes.
9) До отдельного admission решения любые runtime surfaces вне текущего admitted write scope остаются read-only даже если они перечислены в общем allowlist этой задачи.

## CHECKS
CHECK_01_PRE_ACTIVE_CANON_RESOLVES
CMD: node -e 'const fs=require("node:fs");const p="docs/OPS/STATUS/CANON_STATUS.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.status!=="ACTIVE_CANON")process.exit(1);if(j.canonicalDocPath!=="docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md")process.exit(1);if(!fs.existsSync(j.canonicalDocPath))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_REQUIRED_SURFACES_EXIST
CMD: test -f src/renderer/commands/command-catalog.v1.mjs && test -f src/renderer/commands/projectCommands.mjs && test -f src/main.js && test -f src/preload.js && test -f src/renderer/tiptap/runtimeBridge.js && test -f src/menu/menu-config.v1.json && test -f src/menu/menu-config-normalizer.js && test -f test/contracts/command-namespace-canon-and-alias-bridge.contract.test.js && test -f test/contracts/command-surface-bus-only.contract.test.js && test -f test/contracts/menu-config-normalization.contract.test.js && test -f test/contracts/phase00-tiptap-persistence-proofhook.contract.test.js && test -f test/contracts/x3-recovery-smoke.contract.test.js && test -f test/electron/atomicWrite.test.js && echo OK
PASS: OUT == OK

CHECK_03_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-CONTOUR-01-001.prestatus && echo OK
PASS: OUT == OK

CHECK_04_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){console.error("ALLOWLIST is empty");process.exit(2);}const baselinePath="/tmp/CORE-A4-YALKEN-CONTOUR-01-001.prestatus";if(!fs.existsSync(baselinePath)){console.error("Missing baseline status snapshot");process.exit(1);}const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p)){console.error(`Disallowed delta: ${p}`);process.exit(1);}}process.exit(0);' docs/tasks/CORE-A4-YALKEN-CONTOUR-01-001.md docs/OPS/STATUS/MIOS_FIRST_VERTICAL_SLICE_DEFINITION_RECORD_V1.json docs/OPS/STATUS/MIOS_FIRST_VERTICAL_SLICE_EXECUTION_PROOF_RECORD_V1.json docs/OPS/STATUS/CONTOUR_01_ADMISSION_DECISION_RECORD_V1.json docs/OPS/STATUS/CONTOUR_01_PROOF_CLOSURE_RECORD_V1.json scripts/ops/contour-01-primary-editor-save-recovery-proofhook.mjs src/renderer/commands/command-catalog.v1.mjs src/renderer/commands/projectCommands.mjs src/menu/menu-config.v1.json src/menu/menu-config-normalizer.js src/main.js src/preload.js src/renderer/tiptap/runtimeBridge.js test/contracts/contour-01-primary-editor-save-recovery-proofhook.contract.test.js test/contracts/command-namespace-canon-and-alias-bridge.contract.test.js test/contracts/command-surface-bus-only.contract.test.js test/contracts/menu-config-normalization.contract.test.js test/contracts/phase00-tiptap-persistence-proofhook.contract.test.js test/contracts/x3-recovery-smoke.contract.test.js test/electron/atomicWrite.test.js
PASS: exit 0

CHECK_05_POST_DEFINITION_RECORD_EXISTS_AND_STAYS_NARROW
CMD: node -e 'const fs=require("node:fs");const p="docs/OPS/STATUS/MIOS_FIRST_VERTICAL_SLICE_DEFINITION_RECORD_V1.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.appStateOwnership!=="host-owned")process.exit(1);if(j.introducesSecondSourceOfTruth!==false)process.exit(1);if(j.introducesParallelRecoveryChannel!==false)process.exit(1);if(j.promotesPackLayer!==false)process.exit(1);if(j.inflatesReleaseScope!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_06_POST_EXECUTION_PROOF_EXISTS_AND_STAYS_NARROW
CMD: node -e 'const fs=require("node:fs");const p="docs/OPS/STATUS/MIOS_FIRST_VERTICAL_SLICE_EXECUTION_PROOF_RECORD_V1.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.commandProjectionProven!==true)process.exit(1);if(j.manifestSurfaceProven!==true)process.exit(1);if(j.shellPresentationProven!==true)process.exit(1);if(j.snapshotRecoveryProven!==true)process.exit(1);if(j.editorRootDockedInvariantMaintained!==true)process.exit(1);if(j.noParallelRecoveryChannelObserved!==true)process.exit(1);if(j.networkTransportAuthorityIntroduced!==false)process.exit(1);if(j.hotPathContaminationObserved!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_07_POST_COMMAND_SURFACE_BUS_ONLY
CMD: node --test test/contracts/command-surface-bus-only.contract.test.js
PASS: exit 0

CHECK_08_POST_MENU_MANIFEST_AND_ALIAS_BRIDGE
CMD: node --test test/contracts/command-namespace-canon-and-alias-bridge.contract.test.js && node --test test/contracts/menu-config-normalization.contract.test.js
PASS: exit 0

CHECK_09_POST_SUPPLEMENTAL_PERSISTENCE_AND_RECOVERY_BASELINE
CMD: node --test test/contracts/phase00-tiptap-persistence-proofhook.contract.test.js && node --test test/contracts/x3-recovery-smoke.contract.test.js && node --test test/electron/atomicWrite.test.js
PASS: exit 0

CHECK_10_POST_EXACT_LIVE_PATH_PROOF
CMD: node --test test/contracts/contour-01-primary-editor-save-recovery-proofhook.contract.test.js
PASS: exit 0

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая неоднозначность по contour admission, exact surface binding или boundary ownership → STOP.
- Любая попытка доказать toolbar save, palette save, shell reset, restore-last-stable-shell или tiptap ipc path внутри contour 01 → STOP.
- Любая необходимость мутировать `editor.js` без отдельного bundle-aware follow-up → STOP.
- Любая необходимость мутировать уже dirty mapped code surface без isolated clean execution lane → STOP.
- Любая попытка затащить contour 02, pack layer, migration layer или shell rewrite → STOP.

## REPORT_FORMAT
- CHANGED:
- CHECK:
- OUT:
- ASSUMPTIONS:
- FAIL_REASON:
- EVIDENCE:

## FAIL_PROTOCOL
- Любой FAIL → немедленный STOP.
- Никаких git-операций для "починки" состояния.
- Никакого обхода preconditions.
- Никакого расширения scope вместо исправления ошибки.
- Никакого PASS без definition record, execution proof record и независимой инспекции.
