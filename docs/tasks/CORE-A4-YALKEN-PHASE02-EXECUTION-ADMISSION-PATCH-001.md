TASK_ID: CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-PATCH-001
MILESTONE: A4
TYPE: CORE
STATUS: PATCH_SCOPE_ONLY_NO_STAGING_NO_COMMIT_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Открыть только один отдельный reconciliation patch scope для `CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-001.md` и привести его working text в соответствие с текущими lane anchors. Этот task не стартует execution, не stage-файлит, не делает commit, не патчит terminal records и не открывает runtime admission.

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-PATCH-001.md
- docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-001.md

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-PATCH-001.md
- docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-001.md

## DENYLIST
- любые runtime surface writes
- любые изменения вне ALLOWLIST
- любые staging actions
- любые commit actions
- любые патчи terminal records
- любые новые status records
- любые новые contours
- любые formal cutover claims
- любые broad shell admission claims
- любые owner or ledger edits inside this batch
- любые изменения `CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json`
- любые изменения `CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json`

## CONTRACT / SHAPES
- TASK_CLASS: QUEUE_HEAD_PATCH_SCOPE_ONLY
- QUEUE_HEAD_TARGET_TASK_BASENAME: CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-001.md
- QUEUE_HEAD_PREP_SOURCE_BASENAME: CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md
- PREP_RECORD_BASENAME: CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json
- EXECUTION_RECORD_BASENAME: CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json
- OWNER_SOURCE_BASENAME: CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json
- LEDGER_SOURCE_BASENAME: CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json
- this task opens patch scope only
- this task does not start commit loop
- this task does not stage files
- this task does not create commit
- this task does not patch terminal records
- this task does not grant runtime admission
- this task keeps contours 03, 04 and 05 parked
- this task only reconciles stale next-step expectation in the execution-admission task text

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01 и CHECK_02 до любых write-действий.
1) Прочитать `CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json`, `CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json`, `CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json`, `CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json` и `CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-001.md`.
2) Зафиксировать только reconciliation scope для `CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-001.md` и привести stale next-step expectation в соответствие с current lane anchors.
3) Не создавать новые decision records или result records внутри этого шага.
4) После записи файлов выполнить CHECK_03, CHECK_04 и CHECK_05 и остановиться.

## CHECKS
CHECK_01_PRE_ANCHORS_AND_FUTURE_AUTHORITY_ALIGNED
CMD: node -e 'const fs=require("node:fs");const ledger=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));const owner=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));const prep=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","utf8"));const execRec=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json","utf8"));const canon="OPEN_ONE_SEPARATE_QUEUE_HEAD_PATCH_TASK_ONLY_FOR_CORE-A4-YALKEN-PHASE02-PREP-ONLY-001_COMMIT_LOOP_STILL_NOT_STARTED_NO_STAGING_OR_COMMIT_ACTIONS_IN_THIS_STEP";if(ledger.firstExecutableQueueHeadBasename!=="CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md")process.exit(1);if(owner.queueHeadTaskBasename!=="CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md")process.exit(1);if(owner.queueHeadTaskMayOpen!==true)process.exit(1);if(prep.phase02PrepOnlyAdmitted!==true)process.exit(1);if(execRec.phase02ExecutionAdmitted!==true)process.exit(1);if(execRec.phase02ExecutionStarted!==false)process.exit(1);if(execRec.runtimeWritesAdmitted!==false||execRec.runtimeAdmissionGranted!==false||execRec.formalCutoverClaimed!==false||execRec.broadShellAdmissionClaimed!==false)process.exit(1);if(execRec.nextStep!==canon)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-PATCH-001.prestatus && echo OK
PASS: OUT == OK

CHECK_03_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){process.exit(2);}const baselinePath="/tmp/CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-PATCH-001.prestatus";if(!fs.existsSync(baselinePath)){process.exit(1);}const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p))process.exit(1);}process.exit(0);' docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-PATCH-001.md docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-001.md
PASS: exit 0

CHECK_04_POST_TARGET_TASK_RECONCILED_TO_LANE_ANCHORS
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-001.md","utf8");const old="OPEN_ONE_SEPARATE_CURRENT_LANE_PHASE02_EXECUTION_TASK_IN_ADMITTED_MODE_WITH_RUNTIME_WRITES_STILL_LOCKED";const canon="OPEN_ONE_SEPARATE_QUEUE_HEAD_PATCH_TASK_ONLY_FOR_CORE-A4-YALKEN-PHASE02-PREP-ONLY-001_COMMIT_LOOP_STILL_NOT_STARTED_NO_STAGING_OR_COMMIT_ACTIONS_IN_THIS_STEP";if(!t.includes("STATUS: EXECUTION_ADMISSION_ONLY_RUNTIME_WRITES_NOT_ADMITTED"))process.exit(1);if(t.includes(old))process.exit(1);if(!t.includes(canon))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_05_POST_TASK_STAYS_SCOPE_ONLY_AND_NO_STAGING
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-PATCH-001.md","utf8");if(!t.includes("STATUS: PATCH_SCOPE_ONLY_NO_STAGING_NO_COMMIT_RUNTIME_WRITES_NOT_ADMITTED"))process.exit(1);if(!t.includes("this task does not stage files"))process.exit(1);if(!t.includes("this task does not create commit"))process.exit(1);if(String(execSync("git diff --cached --name-only",{encoding:"utf8"})).trim()!=="")process.exit(1);process.exit(0);'
PASS: exit 0

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая попытка начать staging или commit actions внутри этого task → STOP.
- Любая попытка патчить terminal records внутри этого task → STOP.
- Любая попытка открыть execution or runtime admission inside this patch scope → STOP.

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
- Никакого execution start inside this scope-only шага.
