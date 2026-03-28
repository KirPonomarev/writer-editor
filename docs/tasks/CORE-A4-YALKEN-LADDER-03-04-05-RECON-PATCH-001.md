TASK_ID: CORE-A4-YALKEN-LADDER-03-04-05-RECON-PATCH-001
MILESTONE: A4
TYPE: CORE
STATUS: PATCH_SCOPE_ONLY_NO_STAGING_NO_COMMIT_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Открыть только один отдельный task-opening scope для `CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md` и `CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json`. Этот task пока не начинает commit loop, не stage-файлит, не делает commit, не патчит terminal record и не открывает runtime admission.

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-PATCH-001.md

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-PATCH-001.md

## DENYLIST
- любые runtime surface writes
- любые изменения вне ALLOWLIST
- любые staging actions
- любые commit actions
- любые патчи terminal records
- любые новые status records
- любые новые контуры
- любые formal cutover claims
- любые broad shell admission claims
- любой start of commit loop

## CONTRACT / SHAPES
- TASK_CLASS: QUEUE_HEAD_PATCH_SCOPE_ONLY
- QUEUE_HEAD_TARGET_TASK_BASENAME: CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md
- QUEUE_HEAD_TARGET_RECORD_BASENAME: CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json
- OWNER_DECISION_SOURCE_BASENAME: CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json
- LEDGER_SOURCE_BASENAME: CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json
- this task opens patch scope only
- this task does not start commit loop
- this task does not stage files
- this task does not create commit
- this task does not patch terminal records
- this task does not grant runtime admission
- this task does not grant formal cutover
- this task does not reopen contours 03, 04 or 05

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01 и CHECK_02 до любых write-действий.
1) Прочитать `CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json`, `CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json`, `CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md` и `CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json`.
2) Зафиксировать только task-opening scope для queue-head target без staging, commit actions и terminal-record patching.
3) Не создавать новые decision records или result records внутри этого шага.
4) После записи task выполнить CHECK_03 и CHECK_04 и остановиться.

## CHECKS
CHECK_01_PRE_OWNER_DECISION_AND_LEDGER_ALLOW_QUEUE_HEAD_TASK_ONLY
CMD: node -e 'const fs=require("node:fs");const owner=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));const ledger=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));if(owner.decision!=="ALLOW_ONE_SEPARATE_QUEUE_HEAD_PATCH_TASK_ONLY")process.exit(1);if(owner.queueHeadTaskMayOpen!==true)process.exit(1);if(owner.queueHeadTaskBasename!=="CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md")process.exit(1);if(owner.commitLoopStarted!==false)process.exit(1);if(ledger.firstExecutableQueueHeadBasename!=="CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md")process.exit(1);if(ledger.continuousCommitChainReady!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-LADDER-03-04-05-RECON-PATCH-001.prestatus && echo OK
PASS: OUT == OK

CHECK_03_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){console.error("ALLOWLIST is empty");process.exit(2);}const baselinePath="/tmp/CORE-A4-YALKEN-LADDER-03-04-05-RECON-PATCH-001.prestatus";if(!fs.existsSync(baselinePath)){console.error("Missing baseline status snapshot");process.exit(1);}const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p)){console.error(`Disallowed delta: ${p}`);process.exit(1);}}process.exit(0);' docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-PATCH-001.md
PASS: exit 0

CHECK_04_POST_TASK_STAYS_SCOPE_ONLY
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-PATCH-001.md","utf8");if(!t.includes("STATUS: PATCH_SCOPE_ONLY_NO_STAGING_NO_COMMIT_RUNTIME_WRITES_NOT_ADMITTED"))process.exit(1);if(!t.includes("this task does not start commit loop"))process.exit(1);if(!t.includes("this task does not stage files"))process.exit(1);if(!t.includes("this task does not create commit"))process.exit(1);if(!t.includes("this task does not patch terminal records"))process.exit(1);process.exit(0);'
PASS: exit 0

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая попытка начать staging или commit actions внутри этого task → STOP.
- Любая попытка патчить terminal records внутри этого task → STOP.
- Любая попытка создать новый decision record внутри этого task → STOP.

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
- Никакого queue-head patch or commit work внутри этого scope-only шага.
