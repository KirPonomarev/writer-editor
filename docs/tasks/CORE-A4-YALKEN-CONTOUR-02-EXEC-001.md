TASK_ID: CORE-A4-YALKEN-CONTOUR-02-EXEC-001
MILESTONE: A4
TYPE: CORE
STATUS: PROOF_ATTEMPT_ONLY_NOT_ADMITTED_FOR_RUNTIME_WRITES
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Исполнить только proof-first execution lane для второго узкого контура `CONTOUR_02_WRITE_WORKSPACE_STATE_PERSIST_RESTORE_AND_SAFE_RESET` как read-only proof attempt без runtime writes, без shell inflation, без document-truth crossover, без pack promotion и без contour 03 work. Этот task допускает только task text и один execution proof record; prep artifacts сами по себе не считаются PASS, а proof attempt without mutation не считается runtime admission.

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-CONTOUR-02-EXEC-001.md
- docs/OPS/STATUS/MIOS_SECOND_VERTICAL_SLICE_EXECUTION_PROOF_RECORD_V1.json

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-CONTOUR-02-EXEC-001.md
- docs/OPS/STATUS/MIOS_SECOND_VERTICAL_SLICE_EXECUTION_PROOF_RECORD_V1.json

## DENYLIST
- любые runtime surface writes
- любые изменения вне ALLOWLIST
- любые новые зависимости
- любой новый storage channel
- любой новый recovery channel
- любой formal cutover claim
- любая pack promotion
- любое broad shell expansion
- любой plan or review workspace rollout
- любое contour 03 work
- любые изменения `src/**`
- любые изменения `scripts/**`
- любые изменения `test/**`

## CONTRACT / SHAPES
- CONTOUR_ID: CONTOUR_02_WRITE_WORKSPACE_STATE_PERSIST_RESTORE_AND_SAFE_RESET
- CONTOUR_TYPE: POST_PREP_EXECUTION_PROOF_ATTEMPT_CONTOUR
- EXECUTION_TASK_REQUIRES_PREP_DECISION_RECORD: true
- STATE_BOUNDARY_READ_WRITE_PATH_ID: WRITE_WORKSPACE_STATE_BOUNDARY_READ_WRITE_PATH_V1
- LAYOUT_SNAPSHOT_COMMIT_PATH_ID: WRITE_WORKSPACE_LAYOUT_SNAPSHOT_COMMIT_PATH_V1
- LAYOUT_RESTORE_PATH_ID: WRITE_WORKSPACE_LAYOUT_RESTORE_PATH_V1
- SAFE_RESET_PATH_ID: WRITE_WORKSPACE_SAFE_RESET_PATH_V1
- EDITOR_ROOT_INVARIANT_ID: EDITOR_ROOT_REMAINS_DOCKED_IN_V1
- chosen auxiliary surface remains anchor-only and does not claim the full persisted layout domain
- phase03 and phase05 refs remain support-only until separate runtime admission exists
- safe reset path and restore-last-stable path remain separate path families and must not be collapsed into one proof count
- current phase permits execution proof attempt only
- current phase does not admit any runtime surface write
- prep task and prep decision record are required preconditions
- execution proof record is mandatory
- prep artifacts alone are never PASS
- proof-first without mutation is allowed only as proof layer and never as runtime admission
- if exact contour proof is not achieved with existing repo surfaces, STOP with honest not-proven execution proof record
- if runtime mutation becomes necessary, STOP and open one separate admission remediation task

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02, CHECK_03 и CHECK_04 до любых write-действий.
1) Прочитать active canon resolution, `CANON.md`, `docs/CONTEXT.md`, `docs/HANDOFF.md` и `docs/PROCESS.md`; подтвердить, что contour 02 execution lane читается как narrow shell-state proof attempt only.
2) Прочитать `CONTOUR_02_PREP_DECISION_RECORD_V1.json`, `MIOS_SECOND_VERTICAL_SLICE_DEFINITION_RECORD_V1.json`, `CONTOUR_01_PROOF_CLOSURE_RECORD_V1.json` и `CONTOUR_01_ADMISSION_DECISION_RECORD_V1.json`; подтвердить, что prep layer accepted, contour 01 closed as proof-only and runtime writes remain not admitted.
3) Выполнить proof-first attempt только на уже существующих repo proof surfaces для:
   - project-scoped workspace read/write path;
   - safe reset path;
   - restore-last-stable path;
   - bounded spatial shell and editor-root-docked invariant.
4) Не писать proofhook, не менять runtime surfaces, не менять scripts или tests.
5) Зафиксировать observed result в `MIOS_SECOND_VERTICAL_SLICE_EXECUTION_PROOF_RECORD_V1.json`.
6) Если proof surfaces green and exact proof achieved without mutation, это может считаться proof-complete only и всё равно не является runtime admission.
7) Если хотя бы один contour-relevant proof surface red or broken, зафиксировать not-proven result и остановиться без runtime mutation.
8) Перед любым следующим admission вопросом передать execution proof record в независимую инспекцию.

## CHECKS
CHECK_01_PRE_ACTIVE_CANON_RESOLVES
CMD: node -e 'const fs=require("node:fs");const p="docs/OPS/STATUS/CANON_STATUS.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.status!=="ACTIVE_CANON")process.exit(1);if(j.canonicalDocPath!=="docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md")process.exit(1);if(!fs.existsSync(j.canonicalDocPath))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_PREP_LAYER_ACCEPTED
CMD: node -e 'const fs=require("node:fs");const p=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CONTOUR_02_PREP_DECISION_RECORD_V1.json","utf8"));if(p.status!=="PREP_LAYER_ACCEPTED_RUNTIME_WRITES_NOT_ADMITTED")process.exit(1);if(p.scope!=="PREPARATION_ONLY")process.exit(1);if(p.runtimeWritesAdmitted!==false)process.exit(1);if(p.runtimeProofStarted!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_03_PRE_CONTOUR_01_CLOSURE_PRESENT
CMD: node -e 'const fs=require("node:fs");const c=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CONTOUR_01_PROOF_CLOSURE_RECORD_V1.json","utf8"));const d=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CONTOUR_01_ADMISSION_DECISION_RECORD_V1.json","utf8"));if(c.status!=="CLOSED_AS_PROOF_CONTOUR_WITHOUT_RUNTIME_MUTATION")process.exit(1);if(c.runtimeWritesAdmitted!==false)process.exit(1);if(d.runtimeWritesAdmitted!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_04_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-CONTOUR-02-EXEC-001.prestatus && echo OK
PASS: OUT == OK

CHECK_05_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){console.error("ALLOWLIST is empty");process.exit(2);}const baselinePath="/tmp/CORE-A4-YALKEN-CONTOUR-02-EXEC-001.prestatus";if(!fs.existsSync(baselinePath)){console.error("Missing baseline status snapshot");process.exit(1);}const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p)){console.error(`Disallowed delta: ${p}`);process.exit(1);}}process.exit(0);' docs/tasks/CORE-A4-YALKEN-CONTOUR-02-EXEC-001.md docs/OPS/STATUS/MIOS_SECOND_VERTICAL_SLICE_EXECUTION_PROOF_RECORD_V1.json
PASS: exit 0

CHECK_06_POST_EXECUTION_PROOF_RECORD_EXISTS_AND_STAYS_NARROW
CMD: node -e 'const fs=require("node:fs");const p="docs/OPS/STATUS/MIOS_SECOND_VERTICAL_SLICE_EXECUTION_PROOF_RECORD_V1.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.status!=="PROOF_ATTEMPT_COMPLETE_RUNTIME_ADMISSION_NOT_GRANTED")process.exit(1);if(j.definitionRecordBasename!=="MIOS_SECOND_VERTICAL_SLICE_DEFINITION_RECORD_V1.json")process.exit(1);if(j.prepDecisionRecordBasename!=="CONTOUR_02_PREP_DECISION_RECORD_V1.json")process.exit(1);if(j.runtimeWritesPerformed!==false)process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);if(j.broadShellAdmissionClaimed!==false)process.exit(1);process.exit(0);'
PASS: exit 0

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая необходимость менять runtime surfaces, scripts или tests внутри этого task → STOP.
- Любая попытка выдать proof attempt за runtime admission, formal cutover или broad shell admission → STOP.
- Любая попытка доказать plan workspace, review workspace или contour 03 внутри этого task → STOP.

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
- Никакого PASS без отдельной независимой инспекции execution proof record.
