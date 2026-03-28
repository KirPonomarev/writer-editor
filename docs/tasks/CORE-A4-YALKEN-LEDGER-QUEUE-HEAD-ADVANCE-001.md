TASK_ID: CORE-A4-YALKEN-LEDGER-QUEUE-HEAD-ADVANCE-001
MILESTONE: A4
TYPE: CORE
STATUS: GOVERNANCE_LEDGER_REFRESH_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Сдвинуть current-lane queue head c `CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md` на `CORE-A4-YALKEN-FACTUAL-REFRESH-001.md` только через `CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json`. Этот task не rebinding owner decision, не делает staging, не делает commit, не делает runtime writes и не создает новые terminal records.

## ENTRY_CRITERIA
- HEAD equals `e67f4b116506c70243c1f76e708a6426a9fb5c94`
- recon commit chain is already closed for current lane
- runtime false fields stay false in both ledger and owner record

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-LEDGER-QUEUE-HEAD-ADVANCE-001.md
- docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-LEDGER-QUEUE-HEAD-ADVANCE-001.md
- docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json

## DENYLIST
- docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json
- docs/OPS/STATUS/CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json
- любые runtime surface writes
- любые staging actions
- любые commit actions
- любые add-all patterns
- любые новые terminal records
- любые formal cutover claims
- любые broad shell admission claims
- любое расширение scope beyond ALLOWLIST

## CONTRACT / SHAPES
- TASK_CLASS: GOVERNANCE_LEDGER_REFRESH_ONLY
- LEDGER_BASENAME: CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json
- OWNER_RECORD_BASENAME: CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json
- RECON_TASK_BASENAME: CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md
- FACTUAL_REFRESH_TASK_BASENAME: CORE-A4-YALKEN-FACTUAL-REFRESH-001.md
- firstExecutableQueueHeadBasename must change from recon to factual refresh
- currentLaneSafePatchQueue order 1 must become factual refresh
- owner record remains historical one-shot for recon head
- no owner record rebinding in this task
- add audit fields only in ledger: queueHeadAdvancedFrom, queueHeadAdvancedTo, advancedByCommitSha
- keep all runtime false fields unchanged

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02, CHECK_03 и CHECK_04 до любых write-действий.
1) Прочитать ledger, owner record, recon task and factual refresh task.
2) Захватить task-status baseline и owner-record hash baseline.
3) Обновить только ledger:
   - firstExecutableQueueHeadBasename → `CORE-A4-YALKEN-FACTUAL-REFRESH-001.md`
   - currentLaneSafePatchQueue reindex so order 1 is factual refresh
   - nextStep → `OPEN_ONE_PRE_COMMIT_BATCH_FOR_CORE-A4-YALKEN-FACTUAL-REFRESH-001`
   - add queueHeadAdvancedFrom, queueHeadAdvancedTo, advancedByCommitSha
4) Выполнить CHECK_05, CHECK_06, CHECK_07 и CHECK_08.
5) Остановиться; no staging, no commit, no owner-record patch in this task.

## CHECKS
CHECK_01_PRE_LEDGER_QUEUE_HEAD_IS_RECON
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));if(j.firstExecutableQueueHeadBasename!=="CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md")process.exit(1);if(!Array.isArray(j.currentLaneSafePatchQueue)||j.currentLaneSafePatchQueue[0]?.taskBasename!=="CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md")process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.runtimeAdmissionGranted!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);if(j.broadShellAdmissionClaimed!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_OWNER_RECORD_STILL_POINTS_TO_RECON
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));if(j.queueHeadTaskBasename!=="CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md")process.exit(1);if(j.queueHeadTaskMayOpen!==true)process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.runtimeAdmissionGranted!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);if(j.broadShellAdmissionClaimed!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_03_PRE_HEAD_IS_EXPECTED
CMD: test "$(git rev-parse HEAD)" = "e67f4b116506c70243c1f76e708a6426a9fb5c94" && echo OK
PASS: OUT == OK

CHECK_04_PRE_CAPTURE_BASELINES
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-LEDGER-QUEUE-HEAD-ADVANCE-001.prestatus && shasum -a 256 docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json | awk '{print $1}' > /tmp/CORE-A4-YALKEN-LEDGER-QUEUE-HEAD-ADVANCE-001.owner.sha && echo OK
PASS: OUT == OK

CHECK_05_POST_LEDGER_QUEUE_HEAD_IS_FACTUAL_REFRESH
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));if(j.firstExecutableQueueHeadBasename!=="CORE-A4-YALKEN-FACTUAL-REFRESH-001.md")process.exit(1);if(!Array.isArray(j.currentLaneSafePatchQueue)||j.currentLaneSafePatchQueue.length<1)process.exit(1);if(j.currentLaneSafePatchQueue[0]?.order!==1)process.exit(1);if(j.currentLaneSafePatchQueue[0]?.taskBasename!=="CORE-A4-YALKEN-FACTUAL-REFRESH-001.md")process.exit(1);if(j.queueHeadAdvancedFrom!=="CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md")process.exit(1);if(j.queueHeadAdvancedTo!=="CORE-A4-YALKEN-FACTUAL-REFRESH-001.md")process.exit(1);if(j.advancedByCommitSha!=="e67f4b116506c70243c1f76e708a6426a9fb5c94")process.exit(1);if(j.nextStep!=="OPEN_ONE_PRE_COMMIT_BATCH_FOR_CORE-A4-YALKEN-FACTUAL-REFRESH-001")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_06_POST_OWNER_RECORD_UNCHANGED
CMD: test "$(shasum -a 256 docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json | awk '{print $1}')" = "$(cat /tmp/CORE-A4-YALKEN-LEDGER-QUEUE-HEAD-ADVANCE-001.owner.sha)" && echo OK
PASS: OUT == OK

CHECK_07_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));const baselinePath="/tmp/CORE-A4-YALKEN-LEDGER-QUEUE-HEAD-ADVANCE-001.prestatus";if(!fs.existsSync(baselinePath))process.exit(1);const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p))process.exit(1);}process.exit(0);' docs/tasks/CORE-A4-YALKEN-LEDGER-QUEUE-HEAD-ADVANCE-001.md docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json
PASS: exit 0

CHECK_08_POST_RUNTIME_FALSE_FIELDS_PRESERVED
CMD: node -e 'const fs=require("node:fs");const ledger=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));const owner=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));for(const j of [ledger,owner]){if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.runtimeAdmissionGranted!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);if(j.broadShellAdmissionClaimed!==false)process.exit(1);}process.exit(0);'
PASS: exit 0

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая попытка rebinding owner record внутри этого task → STOP.
- Любая попытка staging or commit action → STOP.
- Любая попытка runtime admission drift → STOP.

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
- Никаких staging, commit or owner-record patch actions inside this task.
