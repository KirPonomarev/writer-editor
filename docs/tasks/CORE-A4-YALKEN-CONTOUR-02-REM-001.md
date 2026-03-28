TASK_ID: CORE-A4-YALKEN-CONTOUR-02-REM-001
MILESTONE: A4
TYPE: CORE
STATUS: NARROW_BLOCKER_FIX_ONLY_RUNTIME_SURFACE_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Исполнить только узкий remediation lane для второго контура как blocker-fix only task по уже зафиксированному набору phase03 и phase05 proof-surface blockers без contour 02 runtime admission, без formal cutover, без broad shell admission и без contour 03 work. Эта lane допускает только proof scripts, proof contracts, task text и один narrow remediation admission record.

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-CONTOUR-02-REM-001.md
- docs/OPS/STATUS/CONTOUR_02_REMEDIATION_ADMISSION_RECORD_V1.json
- scripts/ops/phase03-prep-state.mjs
- scripts/ops/phase03-user-shell-state-foundation-state.mjs
- scripts/ops/phase03-stable-project-id-storage-contract-state.mjs
- scripts/ops/phase03-project-workspace-state-foundation-state.mjs
- scripts/ops/phase03-project-workspace-state-artifact-state.mjs
- scripts/ops/phase03-safe-reset-last-stable-foundation-state.mjs
- scripts/ops/phase03-safe-reset-last-stable-artifact-state.mjs
- scripts/ops/phase03-terminology-migration-foundation-state.mjs
- scripts/ops/phase03-terminology-migration-artifact-state.mjs
- scripts/ops/phase03-baseline-docked-shell-state.mjs
- scripts/ops/phase05-bounded-spatial-shell-state.mjs
- scripts/ops/phase05-movable-side-containers-baseline-state.mjs
- scripts/ops/phase05-layout-recovery-last-stable-baseline-state.mjs
- scripts/ops/phase05-invalid-layout-and-missing-monitor-recovery-baseline-state.mjs
- test/contracts/phase03-prep-state.contract.test.js
- test/contracts/phase03-user-shell-state-foundation-state.contract.test.js
- test/contracts/phase03-stable-project-id-storage-contract-state.contract.test.js
- test/contracts/phase03-project-workspace-state-foundation-state.contract.test.js
- test/contracts/phase03-project-workspace-state-artifact-state.contract.test.js
- test/contracts/phase03-safe-reset-last-stable-foundation-state.contract.test.js
- test/contracts/phase03-safe-reset-last-stable-artifact-state.contract.test.js
- test/contracts/phase03-terminology-migration-foundation-state.contract.test.js
- test/contracts/phase03-terminology-migration-artifact-state.contract.test.js
- test/contracts/phase03-baseline-docked-shell-state.contract.test.js
- test/contracts/phase05-bounded-spatial-shell-state.contract.test.js

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-CONTOUR-02-REM-001.md
- docs/OPS/STATUS/CONTOUR_02_REMEDIATION_ADMISSION_RECORD_V1.json
- scripts/ops/phase03-prep-state.mjs
- scripts/ops/phase03-user-shell-state-foundation-state.mjs
- scripts/ops/phase03-stable-project-id-storage-contract-state.mjs
- scripts/ops/phase03-project-workspace-state-foundation-state.mjs
- scripts/ops/phase03-project-workspace-state-artifact-state.mjs
- scripts/ops/phase03-safe-reset-last-stable-foundation-state.mjs
- scripts/ops/phase03-safe-reset-last-stable-artifact-state.mjs
- scripts/ops/phase03-terminology-migration-foundation-state.mjs
- scripts/ops/phase03-terminology-migration-artifact-state.mjs
- scripts/ops/phase03-baseline-docked-shell-state.mjs
- scripts/ops/phase05-bounded-spatial-shell-state.mjs
- scripts/ops/phase05-movable-side-containers-baseline-state.mjs
- scripts/ops/phase05-layout-recovery-last-stable-baseline-state.mjs
- scripts/ops/phase05-invalid-layout-and-missing-monitor-recovery-baseline-state.mjs
- test/contracts/phase03-prep-state.contract.test.js
- test/contracts/phase03-user-shell-state-foundation-state.contract.test.js
- test/contracts/phase03-stable-project-id-storage-contract-state.contract.test.js
- test/contracts/phase03-project-workspace-state-foundation-state.contract.test.js
- test/contracts/phase03-project-workspace-state-artifact-state.contract.test.js
- test/contracts/phase03-safe-reset-last-stable-foundation-state.contract.test.js
- test/contracts/phase03-safe-reset-last-stable-artifact-state.contract.test.js
- test/contracts/phase03-terminology-migration-foundation-state.contract.test.js
- test/contracts/phase03-terminology-migration-artifact-state.contract.test.js
- test/contracts/phase03-baseline-docked-shell-state.contract.test.js
- test/contracts/phase05-bounded-spatial-shell-state.contract.test.js

## DENYLIST
- любые runtime surface writes
- любые изменения вне ALLOWLIST
- любые новые зависимости
- любой новый storage truth
- любой новый recovery truth
- любой formal cutover claim
- любая pack promotion
- любое broad shell expansion
- любой plan or review workspace rollout
- любое contour 03 work
- любые изменения `src` по умолчанию

## CONTRACT / SHAPES
- CONTOUR_ID: CONTOUR_02_WRITE_WORKSPACE_STATE_PERSIST_RESTORE_AND_SAFE_RESET
- TASK_TYPE: BLOCKER_FIX_ONLY
- REMEDIATION_BLOCKER_SET_ID: CONTOUR_02_EXECUTION_RECORDED_BLOCKERS_V1
- runtime admission for contour 02 remains closed
- remediation completion is not contour 02 proof-complete
- remediation completion is not runtime admission
- remediation completion is not formal cutover
- remediation completion is not broad shell admission
- safe reset path and restore-last-stable path remain separate path families
- chosen auxiliary surface remains anchor-only and does not become the full persisted layout domain
- phase03 and phase05 refs remain narrow proof surfaces only
- if any blocker fix requires mutation under `src`, STOP and open one separate follow-up instead of widening this task
- if any blocker fix requires packet narrative rewrite instead of proof-surface repair, STOP

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02, CHECK_03 и CHECK_04 до любых write-действий.
1) Прочитать active canon resolution, `CANON.md`, `docs/CONTEXT.md`, `docs/HANDOFF.md` и `docs/PROCESS.md`; подтвердить, что remediation lane читается как blocker-fix only.
2) Прочитать `CONTOUR_02_PREP_DECISION_RECORD_V1.json` и `MIOS_SECOND_VERTICAL_SLICE_EXECUTION_PROOF_RECORD_V1.json`; подтвердить, что contour 02 not admitted and blocker set already recorded.
3) Зафиксировать `CONTOUR_02_REMEDIATION_ADMISSION_RECORD_V1.json` как narrow blocker-fix admission only.
4) Чинить только recorded blocker chain:
   - phase03 prep evaluator;
   - phase03 user shell foundation dependency chain;
   - phase03 stable project id contract dependency chain;
   - phase03 project workspace foundation and artifact dependency chain;
   - phase03 safe reset foundation and artifact dependency chain;
   - phase03 terminology foundation and artifact dependency chain only as needed to clear phase03 baseline docked shell dependency;
   - phase05 bounded spatial shell proof surface import chain.
5) Не менять runtime UI surfaces, не менять editor topology, не добавлять новые persistence or recovery channels.
6) После fixes прогнать exact proof-surface scripts и corresponding contract tests.
7) После checks остановиться и передать remediation result в независимую инспекцию перед любым execution retry.

## CHECKS
CHECK_01_PRE_ACTIVE_CANON_RESOLVES
CMD: node -e 'const fs=require("node:fs");const p="docs/OPS/STATUS/CANON_STATUS.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.status!=="ACTIVE_CANON")process.exit(1);if(j.canonicalDocPath!=="docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md")process.exit(1);if(!fs.existsSync(j.canonicalDocPath))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_EXECUTION_RECORD_PRESENT_AND_NOT_ADMITTED
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/MIOS_SECOND_VERTICAL_SLICE_EXECUTION_PROOF_RECORD_V1.json","utf8"));if(j.status!=="PROOF_ATTEMPT_COMPLETE_RUNTIME_ADMISSION_NOT_GRANTED")process.exit(1);if(j.proofComplete!==false)process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(!Array.isArray(j.relevantExecutionGaps)||j.relevantExecutionGaps.length===0)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_03_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-CONTOUR-02-REM-001.prestatus && echo OK
PASS: OUT == OK

CHECK_04_PRE_REMEDIATION_ADMISSION_RECORD_STAYS_NARROW
CMD: node -e 'const fs=require("node:fs");const p="docs/OPS/STATUS/CONTOUR_02_REMEDIATION_ADMISSION_RECORD_V1.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.status!=="REMEDIATION_ONLY_RUNTIME_SURFACE_WRITES_NOT_ADMITTED")process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);if(j.broadShellAdmissionClaimed!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_05_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){console.error("ALLOWLIST is empty");process.exit(2);}const baselinePath="/tmp/CORE-A4-YALKEN-CONTOUR-02-REM-001.prestatus";if(!fs.existsSync(baselinePath)){console.error("Missing baseline status snapshot");process.exit(1);}const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p)){console.error(`Disallowed delta: ${p}`);process.exit(1);}}process.exit(0);' docs/tasks/CORE-A4-YALKEN-CONTOUR-02-REM-001.md docs/OPS/STATUS/CONTOUR_02_REMEDIATION_ADMISSION_RECORD_V1.json scripts/ops/phase03-prep-state.mjs scripts/ops/phase03-user-shell-state-foundation-state.mjs scripts/ops/phase03-stable-project-id-storage-contract-state.mjs scripts/ops/phase03-project-workspace-state-foundation-state.mjs scripts/ops/phase03-project-workspace-state-artifact-state.mjs scripts/ops/phase03-safe-reset-last-stable-foundation-state.mjs scripts/ops/phase03-safe-reset-last-stable-artifact-state.mjs scripts/ops/phase03-terminology-migration-foundation-state.mjs scripts/ops/phase03-terminology-migration-artifact-state.mjs scripts/ops/phase03-baseline-docked-shell-state.mjs scripts/ops/phase05-bounded-spatial-shell-state.mjs scripts/ops/phase05-movable-side-containers-baseline-state.mjs scripts/ops/phase05-layout-recovery-last-stable-baseline-state.mjs scripts/ops/phase05-invalid-layout-and-missing-monitor-recovery-baseline-state.mjs test/contracts/phase03-prep-state.contract.test.js test/contracts/phase03-user-shell-state-foundation-state.contract.test.js test/contracts/phase03-stable-project-id-storage-contract-state.contract.test.js test/contracts/phase03-project-workspace-state-foundation-state.contract.test.js test/contracts/phase03-project-workspace-state-artifact-state.contract.test.js test/contracts/phase03-safe-reset-last-stable-foundation-state.contract.test.js test/contracts/phase03-safe-reset-last-stable-artifact-state.contract.test.js test/contracts/phase03-terminology-migration-foundation-state.contract.test.js test/contracts/phase03-terminology-migration-artifact-state.contract.test.js test/contracts/phase03-baseline-docked-shell-state.contract.test.js test/contracts/phase05-bounded-spatial-shell-state.contract.test.js
PASS: exit 0

CHECK_06_POST_PHASE03_PREP_GREEN
CMD: node scripts/ops/phase03-prep-state.mjs --json
PASS: exit 0

CHECK_07_POST_PHASE03_CHAIN_GREEN
CMD: node scripts/ops/phase03-user-shell-state-foundation-state.mjs --json && node scripts/ops/phase03-stable-project-id-storage-contract-state.mjs --json && node scripts/ops/phase03-project-workspace-state-foundation-state.mjs --json && node scripts/ops/phase03-project-workspace-state-artifact-state.mjs --json && node scripts/ops/phase03-safe-reset-last-stable-foundation-state.mjs --json && node scripts/ops/phase03-safe-reset-last-stable-artifact-state.mjs --json && node scripts/ops/phase03-terminology-migration-foundation-state.mjs --json && node scripts/ops/phase03-terminology-migration-artifact-state.mjs --json && node scripts/ops/phase03-baseline-docked-shell-state.mjs --json
PASS: exit 0

CHECK_08_POST_PHASE03_CONTRACTS_GREEN
CMD: node --test test/contracts/phase03-prep-state.contract.test.js && node --test test/contracts/phase03-user-shell-state-foundation-state.contract.test.js && node --test test/contracts/phase03-stable-project-id-storage-contract-state.contract.test.js && node --test test/contracts/phase03-project-workspace-state-foundation-state.contract.test.js && node --test test/contracts/phase03-project-workspace-state-artifact-state.contract.test.js && node --test test/contracts/phase03-safe-reset-last-stable-foundation-state.contract.test.js && node --test test/contracts/phase03-safe-reset-last-stable-artifact-state.contract.test.js && node --test test/contracts/phase03-terminology-migration-foundation-state.contract.test.js && node --test test/contracts/phase03-terminology-migration-artifact-state.contract.test.js && node --test test/contracts/phase03-baseline-docked-shell-state.contract.test.js
PASS: exit 0

CHECK_09_POST_PHASE05_GREEN
CMD: node scripts/ops/phase05-bounded-spatial-shell-state.mjs --json && node --test test/contracts/phase05-bounded-spatial-shell-state.contract.test.js
PASS: exit 0

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая необходимость менять `src` → STOP и open one separate follow-up.
- Любая попытка выдать remediation completion за contour 02 runtime admission → STOP.
- Любая попытка тянуть broad shell work, pack layer или contour 03 → STOP.

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
- Никакого PASS без отдельной независимой инспекции remediation result.
