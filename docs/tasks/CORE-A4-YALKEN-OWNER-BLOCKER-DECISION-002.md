TASK_ID: CORE-A4-YALKEN-OWNER-BLOCKER-DECISION-002
MILESTONE: A4
TYPE: CORE
STATUS: OWNER_BLOCKER_DECISION_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Принять одно узкое owner blocker decision только для rollover current-lane queue head с уже закрытой reconciliation chain на factual refresh chain. Этот task не запускает commit loop, не делает commit, не патчит ledger, не открывает runtime admission и не выдает factual refresh за Phase 02 execution.

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-OWNER-BLOCKER-DECISION-002.md
- docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-OWNER-BLOCKER-DECISION-002.md
- docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json

## DENYLIST
- любые runtime surface writes
- любые изменения вне ALLOWLIST
- любые реальные git commit внутри этого task
- любые staging actions
- любые патчи ledger
- любые патчи terminal records кроме CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json
- любые новые contours
- любые новые зависимости
- любые formal cutover claims
- любые broad shell admission claims
- любой старт commit loop
- любой factual refresh commit readiness inside this task

## CONTRACT / SHAPES
- TASK_CLASS: OWNER_BLOCKER_DECISION_ONLY
- DECISION_RECORD_BASENAME: CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json
- PREVIOUS_QUEUE_HEAD_TASK_BASENAME: CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md
- NEW_QUEUE_HEAD_TASK_BASENAME: CORE-A4-YALKEN-FACTUAL-REFRESH-001.md
- decision remains governance only
- historical frozen blockers remain frozen
- decision remains `ALLOW_ONE_SEPARATE_QUEUE_HEAD_PATCH_TASK_ONLY`
- queueHeadTaskMayOpen remains true
- queueHeadTaskBasename rolls forward to factual refresh only
- commitLoopStarted remains false
- runtimeWritesAdmitted remains false
- runtimeAdmissionGranted remains false
- phase02ExecutionStarted remains false
- this task does not admit contours 03 04 05

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01 и CHECK_02 до любых write-действий.
1) Прочитать `CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json`, `CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json`, `CORE-A4-YALKEN-FACTUAL-REFRESH-001.md` и `CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json`.
2) Подтвердить, что reconciliation chain уже закрыта, а factual refresh является следующим current-lane safe patch queue item.
3) Перевести `CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json` на новый queue head `CORE-A4-YALKEN-FACTUAL-REFRESH-001.md`.
4) Выполнить CHECK_03 и CHECK_04 и остановиться.

## CHECKS
CHECK_01_PRE_NEXT_QUEUE_HEAD_RESOLVES
CMD: node -e 'const fs=require("node:fs");const ledger=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));const owner=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));const factual=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json","utf8"));if(ledger.currentLaneSafePatchQueue[1].taskBasename!=="CORE-A4-YALKEN-FACTUAL-REFRESH-001.md")process.exit(1);if(owner.queueHeadTaskBasename!=="CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md")process.exit(1);if(factual.status!=="FACTUAL_REFRESH_COMPLETE_RUNTIME_WRITES_NOT_ADMITTED")process.exit(1);if(factual.factualRefreshCompleted!==true)process.exit(1);if(factual.runtimeWritesAdmitted!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-OWNER-BLOCKER-DECISION-002.prestatus && echo OK
PASS: OUT == OK

CHECK_03_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));const baselinePath="/tmp/CORE-A4-YALKEN-OWNER-BLOCKER-DECISION-002.prestatus";if(!fs.existsSync(baselinePath))process.exit(1);const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p))process.exit(1);}process.exit(0);' docs/tasks/CORE-A4-YALKEN-OWNER-BLOCKER-DECISION-002.md docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json
PASS: exit 0

CHECK_04_POST_OWNER_RECORD_ROLLED_FORWARD_ONLY
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));if(j.status!=="OWNER_BLOCKER_DECISION_TAKEN_QUEUE_HEAD_TASK_MAY_OPEN_COMMIT_LOOP_NOT_STARTED_RUNTIME_WRITES_NOT_ADMITTED")process.exit(1);if(j.decision!=="ALLOW_ONE_SEPARATE_QUEUE_HEAD_PATCH_TASK_ONLY")process.exit(1);if(j.historicalFrozenBlockersRemainFrozen!==true)process.exit(1);if(j.historicalTerminalRetrofitRequiredNow!==false)process.exit(1);if(j.queueHeadTaskMayOpen!==true)process.exit(1);if(j.queueHeadTaskBasename!=="CORE-A4-YALKEN-FACTUAL-REFRESH-001.md")process.exit(1);if(j.commitLoopStarted!==false)process.exit(1);if(j.continuousCommitChainReady!==false)process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.runtimeAdmissionGranted!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);if(j.broadShellAdmissionClaimed!==false)process.exit(1);if(j.phase02ExecutionStarted!==false)process.exit(1);if(j.nextStep!=="OPEN_ONE_SEPARATE_QUEUE_HEAD_PATCH_TASK_ONLY_FOR_CORE-A4-YALKEN-FACTUAL-REFRESH-001_COMMIT_LOOP_STILL_NOT_STARTED_NO_STAGING_OR_COMMIT_ACTIONS_IN_THIS_STEP")process.exit(1);process.exit(0);'
PASS: exit 0

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая попытка стартовать factual refresh commit loop внутри этого task → STOP.
- Любая попытка менять ledger внутри этого task → STOP.
- Любая попытка выдать это решение за runtime admission, Phase 02 execution admission или continuous chain completion → STOP.

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
- Никакого factual refresh precommit inside this task.
