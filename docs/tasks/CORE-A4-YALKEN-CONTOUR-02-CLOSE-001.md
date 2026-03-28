TASK_ID: CORE-A4-YALKEN-CONTOUR-02-CLOSE-001
MILESTONE: A4
TYPE: CORE
STATUS: PROOF_CLOSURE_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Зафиксировать contour 02 в одном terminal proof-only closure artifact после clean-lane execution retry. Этот task допускает только task text и один closure record, не меняет runtime surfaces, не меняет existing proof records и не выдает proof-complete за runtime admission, formal cutover или broad shell admission.

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-CONTOUR-02-CLOSE-001.md
- docs/OPS/STATUS/CONTOUR_02_PROOF_CLOSURE_RECORD_V1.json

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-CONTOUR-02-CLOSE-001.md
- docs/OPS/STATUS/CONTOUR_02_PROOF_CLOSURE_RECORD_V1.json

## DENYLIST
- любые runtime surface writes
- любые изменения вне ALLOWLIST
- любые изменения existing prep, reaudit, retry or execution proof records
- любые новые зависимости
- любой новый storage channel
- любой новый recovery channel
- любой formal cutover claim
- любая pack promotion
- любое broad shell expansion
- любое contour 03 work
- любые изменения `src/**`
- любые изменения `scripts/**`
- любые изменения `test/**`

## CONTRACT / SHAPES
- CONTOUR_ID: CONTOUR_02_WRITE_WORKSPACE_STATE_PERSIST_RESTORE_AND_SAFE_RESET
- CLOSURE_TYPE: PROOF_ONLY
- EXECUTION_PROOF_SOURCE_BASENAME: MIOS_SECOND_VERTICAL_SLICE_EXECUTION_PROOF_RECORD_V1.json
- RETRY_PERMISSION_SOURCE_BASENAME: CONTOUR_02_EXECUTION_RETRY_DECISION_RECORD_V1.json
- REAUDIT_SOURCE_BASENAME: CONTOUR_02_REAUDIT_RESULT_RECORD_V1.json
- closure record must say proof-complete on current proof surfaces only
- closure record must keep runtimeWritesPerformed false
- closure record must keep runtimeWritesAdmitted false
- closure record must keep formalCutoverClaimed false
- closure record must keep broadShellAdmissionClaimed false
- closure record must not claim automatic next contour admission
- closure record is a terminal proof summary only and not a runtime admission artifact

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02 и CHECK_03 до любых write-действий.
1) Прочитать `MIOS_SECOND_VERTICAL_SLICE_EXECUTION_PROOF_RECORD_V1.json`, `CONTOUR_02_EXECUTION_RETRY_DECISION_RECORD_V1.json` и `CONTOUR_02_REAUDIT_RESULT_RECORD_V1.json`; подтвердить, что proofComplete true уже достигнут без runtime writes и runtime admission остается false.
2) Выпустить один `CONTOUR_02_PROOF_CLOSURE_RECORD_V1.json` как proof-only closure summary.
3) Не менять existing proof records, retry records или prep records.
4) После записи closure record выполнить CHECK_04 и CHECK_05 и остановиться.

## CHECKS
CHECK_01_PRE_EXECUTION_PROOF_COMPLETE_AND_NOT_ADMITTED
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/MIOS_SECOND_VERTICAL_SLICE_EXECUTION_PROOF_RECORD_V1.json","utf8"));if(j.status!=="PROOF_ATTEMPT_COMPLETE_RUNTIME_ADMISSION_NOT_GRANTED")process.exit(1);if(j.proofComplete!==true)process.exit(1);if(j.admissionStatus!=="NOT_ADMITTED")process.exit(1);if(j.runtimeWritesPerformed!==false)process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);if(j.broadShellAdmissionClaimed!==false)process.exit(1);if(!Array.isArray(j.relevantExecutionGaps)||j.relevantExecutionGaps.length!==0)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_REAUDIT_AND_RETRY_DECISION_STAY_NARROW
CMD: node -e 'const fs=require("node:fs");const r=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CONTOUR_02_REAUDIT_RESULT_RECORD_V1.json","utf8"));const d=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CONTOUR_02_EXECUTION_RETRY_DECISION_RECORD_V1.json","utf8"));if(r.blockerSetCleared!==true)process.exit(1);if(r.executionRetryAdmissible!==true)process.exit(1);if(r.runtimeWritesAdmitted!==false)process.exit(1);if(d.executionRetryAllowed!==true)process.exit(1);if(d.runtimeWritesAdmitted!==false)process.exit(1);if(d.runtimeAdmissionGranted!==false)process.exit(1);if(d.formalCutoverClaimed!==false)process.exit(1);if(d.broadShellAdmissionClaimed!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_03_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-CONTOUR-02-CLOSE-001.prestatus && echo OK
PASS: OUT == OK

CHECK_04_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){console.error("ALLOWLIST is empty");process.exit(2);}const baselinePath="/tmp/CORE-A4-YALKEN-CONTOUR-02-CLOSE-001.prestatus";if(!fs.existsSync(baselinePath)){console.error("Missing baseline status snapshot");process.exit(1);}const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p)){console.error(`Disallowed delta: ${p}`);process.exit(1);}}process.exit(0);' docs/tasks/CORE-A4-YALKEN-CONTOUR-02-CLOSE-001.md docs/OPS/STATUS/CONTOUR_02_PROOF_CLOSURE_RECORD_V1.json
PASS: exit 0

CHECK_05_POST_CLOSURE_RECORD_EXISTS_AND_STAYS_PROOF_ONLY
CMD: node -e 'const fs=require("node:fs");const p="docs/OPS/STATUS/CONTOUR_02_PROOF_CLOSURE_RECORD_V1.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.status!=="CLOSED_AS_PROOF_CONTOUR_WITHOUT_RUNTIME_MUTATION")process.exit(1);if(j.closureType!=="PROOF_ONLY")process.exit(1);if(j.executionProofRecordBasename!=="MIOS_SECOND_VERTICAL_SLICE_EXECUTION_PROOF_RECORD_V1.json")process.exit(1);if(j.executionRetryDecisionRecordBasename!=="CONTOUR_02_EXECUTION_RETRY_DECISION_RECORD_V1.json")process.exit(1);if(j.proofComplete!==true)process.exit(1);if(j.runtimeWritesPerformed!==false)process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.runtimeAdmissionGranted!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);if(j.broadShellAdmissionClaimed!==false)process.exit(1);if(j.relevantExecutionGapsClear!==true)process.exit(1);process.exit(0);'
PASS: exit 0

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая необходимость менять runtime surfaces, scripts, tests или existing proof records внутри этого task → STOP.
- Любая попытка выдать closure record за runtime admission, formal cutover или broad shell admission → STOP.
- Любая попытка заявить automatic contour 03 admission через этот task → STOP.

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
- Никакого PASS без existing proof record, retry decision и reaudit result.
