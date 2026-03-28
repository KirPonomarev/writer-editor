TASK_ID: CORE-A4-YALKEN-OWNER-BLOCKER-DECISION-001
MILESTONE: A4
TYPE: CORE
STATUS: OWNER_BLOCKER_DECISION_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Принять одно owner blocker decision только по исторической proof chain и старту current-lane queue head. Этот task не запускает commit loop, не делает commit, не патчит terminal records, не открывает runtime admission и не чинит historical frozen blockers.

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-OWNER-BLOCKER-DECISION-001.md
- docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-OWNER-BLOCKER-DECISION-001.md
- docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json

## DENYLIST
- любые runtime surface writes
- любые изменения вне ALLOWLIST
- любые реальные git commit внутри этого task
- любые git add --all, git add -A или эквиваленты
- любые патчи existing terminal records
- любые новые контуры
- любые новые зависимости
- любые formal cutover claims
- любые broad shell admission claims
- любой старт commit loop

## CONTRACT / SHAPES
- TASK_CLASS: OWNER_BLOCKER_DECISION_ONLY
- DECISION_RECORD_BASENAME: CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json
- input basenames are CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json and CORE-A4-YALKEN-COMMIT-REMEDIATION-001.md
- this task decides governance branching only
- historical frozen blockers may remain frozen
- this task may allow one separate queue-head patch task only
- this task does not start commit loop
- this task does not create executable commit readiness by itself
- this task does not grant runtime admission
- any exact-path commit allowlist remains future per-task work and is not created here

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01 и CHECK_02 до любых write-действий.
1) Прочитать `CORE-A4-YALKEN-COMMIT-REMEDIATION-001.md` и `CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json`.
2) Принять одно owner решение:
   - historical frozen blockers remain frozen,
   - current-lane queue head may open as one separate patch task,
   - commit loop still remains not started.
3) Выпустить один `CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json`.
4) Не менять ledger, не патчить existing terminal records и не открывать queue-head patch task внутри этого шага.
5) После записи decision record выполнить CHECK_03 и CHECK_04 и остановиться.

## CHECKS
CHECK_01_PRE_LEDGER_REQUIRES_OWNER_BLOCKER_DECISION
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));if(j.status!=="COMMIT_REMEDIATION_LEDGER_ONLY_RUNTIME_WRITES_NOT_ADMITTED")process.exit(1);if(j.continuousCommitChainReady!==false)process.exit(1);if(j.earliestUnclosedHistoricalTaskBasename!=="CORE-A4-YALKEN-CONTOUR-01-001.md")process.exit(1);if(j.firstExecutableQueueHeadBasename!=="CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md")process.exit(1);if(j.nextStep!=="OPEN_ONE_OWNER_BLOCKER_DECISION_FOR_HISTORICAL_PROOF_CHAIN_BEFORE_FIRST_COMMIT")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-OWNER-BLOCKER-DECISION-001.prestatus && echo OK
PASS: OUT == OK

CHECK_03_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){console.error("ALLOWLIST is empty");process.exit(2);}const baselinePath="/tmp/CORE-A4-YALKEN-OWNER-BLOCKER-DECISION-001.prestatus";if(!fs.existsSync(baselinePath)){console.error("Missing baseline status snapshot");process.exit(1);}const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p)){console.error(`Disallowed delta: ${p}`);process.exit(1);}}process.exit(0);' docs/tasks/CORE-A4-YALKEN-OWNER-BLOCKER-DECISION-001.md docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json
PASS: exit 0

CHECK_04_POST_DECISION_RECORD_STAYS_NARROW
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));if(j.status!=="OWNER_BLOCKER_DECISION_TAKEN_QUEUE_HEAD_TASK_MAY_OPEN_COMMIT_LOOP_NOT_STARTED_RUNTIME_WRITES_NOT_ADMITTED")process.exit(1);if(j.decision!=="ALLOW_ONE_SEPARATE_QUEUE_HEAD_PATCH_TASK_ONLY")process.exit(1);if(j.historicalFrozenBlockersRemainFrozen!==true)process.exit(1);if(j.historicalTerminalRetrofitRequiredNow!==false)process.exit(1);if(j.queueHeadTaskMayOpen!==true)process.exit(1);if(j.queueHeadTaskBasename!=="CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md")process.exit(1);if(j.commitLoopStarted!==false)process.exit(1);if(j.continuousCommitChainReady!==false)process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.runtimeAdmissionGranted!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);if(j.broadShellAdmissionClaimed!==false)process.exit(1);if(j.phase02ExecutionStarted!==false)process.exit(1);if(j.nextStep!=="OPEN_ONE_SEPARATE_QUEUE_HEAD_PATCH_TASK_ONLY_COMMIT_LOOP_STILL_NOT_STARTED_NO_STAGING_OR_COMMIT_ACTIONS_IN_THIS_STEP")process.exit(1);process.exit(0);'
PASS: exit 0

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая попытка начать commit loop внутри этого task → STOP.
- Любая попытка переписать historical frozen blockers внутри этого task → STOP.
- Любая попытка выдать owner decision за runtime admission, formal cutover или continuous chain completion → STOP.

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
- Никакого queue-head task start внутри owner blocker decision шага.
