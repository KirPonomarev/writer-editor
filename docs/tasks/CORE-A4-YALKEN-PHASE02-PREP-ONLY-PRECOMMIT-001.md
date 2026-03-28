TASK_ID: CORE-A4-YALKEN-PHASE02-PREP-ONLY-PRECOMMIT-001
MILESTONE: A4
TYPE: CORE
STATUS: PRE_COMMIT_CHECKS_GREEN_READY_FOR_NARROW_COMMIT_NO_STAGING_NO_COMMIT_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Открыть один отдельный pre-commit task для next narrow chain segment `CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md`, развести `batch allowlist` и `future commit allowlist subset`, прогнать pre-commit checks и зафиксировать только один честный outcome: `READY_FOR_NARROW_COMMIT` или STOP. Этот task не стартует commit loop, не stage-файлит, не делает commit, не патчит terminal records и не открывает runtime admission.

## ENTRY_CRITERIA
- `CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json` lists `CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md` as the first executable current-lane queue head
- `CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json` allows `CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md` to open as the queue-head task only
- `CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md` exists and stays `PREP_ONLY_RUNTIME_WRITES_NOT_ADMITTED`
- `CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json` exists and stays `CURRENT_LANE_PHASE02_PREP_ONLY_ADMITTED_RUNTIME_WRITES_NOT_ADMITTED`
- `docs/CONTEXT.md` and `docs/HANDOFF.md` already carry the current-lane Phase 02 prep-only language for this branch-local factual set

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-PRECOMMIT-001.md

## BATCH_ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-PRECOMMIT-001.md

## FUTURE_COMMIT_ALLOWLIST_SUBSET
- docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md
- docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json

## DENYLIST
- любые runtime surface writes
- любые изменения вне BATCH_ALLOWLIST
- любые staging actions
- любые commit actions
- любые патчи terminal records
- любые новые status records
- любые новые contours
- любые formal cutover claims
- любые broad shell admission claims
- любой start of commit loop
- любые mainline factual rewrites

## CONTRACT / SHAPES
- TASK_CLASS: CURRENT_LANE_PRE_COMMIT_ONLY
- TARGET_TASK_BASENAME: CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md
- TARGET_RECORD_BASENAME: CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json
- LEDGER_SOURCE_BASENAME: CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json
- OWNER_SOURCE_BASENAME: CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json
- SOURCE_PRIORITY: CANON_STATUS_AND_ACTIVE_EXECUTION_CANON_FIRST CANON_MD_SECOND COREX_AND_BIBLE_BEFORE_FACTUAL_DOCS
- FACTUAL_DOCS_DESCRIBE_CURRENT_OPERATING_REALITY_AND_DO_NOT_OVERRIDE_ACTIVE_CANON
- PACKET_DOCS_ARE_PLANNING_ONLY_NOT_BINDING_CANON
- ONE_ACTIVE_PRODUCT_TRUTH_PER_ACTIVE_FACTUAL_DOC_SET
- DO_NOT_CREATE_SPLIT_BRAIN_DOCS
- batch allowlist is only for this task artifact
- future commit allowlist subset is separate and does not authorize staging or commit in this batch
- delta baseline only; if baseline snapshot is missing, STOP
- ready for narrow commit does not auto-stage and does not auto-commit
- no new terminal records are created in this batch
- this task does not start commit loop
- this task does not grant runtime admission
- this batch may claim READY_FOR_NARROW_COMMIT only after explicit prechecks and postchecks pass

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02, CHECK_03 и CHECK_04 до любых write-действий.
1) Прочитать `CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json`, `CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json`, `CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md`, `CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json`, `docs/CONTEXT.md` и `docs/HANDOFF.md`.
2) Зафиксировать exact future commit allowlist subset only for the Phase 02 prep-only task and its decision record.
3) Не выполнять staging, не выполнять commit actions и не патчить target terminal record внутри этого task.
4) После записи task выполнить CHECK_05, CHECK_06 и CHECK_07.
5) Если все checks green, этот batch заканчивается outcome `READY_FOR_NARROW_COMMIT` only.
6) Outcome `READY_FOR_NARROW_COMMIT` не дает auto-stage и не дает auto-commit.

## CHECKS
CHECK_01_PRE_LEDGER_AND_OWNER_POINT_TO_PHASE02_PREP_ONLY
CMD: node -e 'const fs=require("node:fs");const ledger=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));const owner=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));const q=ledger.currentLaneSafePatchQueue;if(!Array.isArray(q))process.exit(1);const prep=q.find((x)=>x.order===1);if(!prep)process.exit(1);if(ledger.firstExecutableQueueHeadBasename!=="CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md")process.exit(1);if(prep.taskBasename!=="CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md")process.exit(1);if(prep.terminalRecordBasename!=="CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json")process.exit(1);if(owner.queueHeadTaskBasename!=="CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md")process.exit(1);if(owner.queueHeadTaskMayOpen!==true)process.exit(1);if(ledger.exactPathStagingRequired!==true)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_TARGETS_AND_BRANCH_LOCAL_FACTUAL_STATE_PRESENT
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md","utf8");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","utf8"));const context=fs.readFileSync("docs/CONTEXT.md","utf8");const handoff=fs.readFileSync("docs/HANDOFF.md","utf8");if(!t.includes("STATUS: PREP_ONLY_RUNTIME_WRITES_NOT_ADMITTED"))process.exit(1);if(j.status!=="CURRENT_LANE_PHASE02_PREP_ONLY_ADMITTED_RUNTIME_WRITES_NOT_ADMITTED")process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.runtimeAdmissionGranted!==false)process.exit(1);const req=["Current-lane Phase 02 prep-only is already admitted as governance only.","CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md","queue-head patch task only"];for(const r of req){if(!context.includes(r)&&!handoff.includes(r))process.exit(1);}process.exit(0);'
PASS: exit 0

CHECK_03_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-PHASE02-PREP-ONLY-PRECOMMIT-001.prestatus && echo OK
PASS: OUT == OK

CHECK_04_PRE_STAGED_SET_EMPTY
CMD: test -z "$(git diff --cached --name-only)" && echo OK
PASS: OUT == OK

CHECK_05_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){process.exit(2);}const baselinePath="/tmp/CORE-A4-YALKEN-PHASE02-PREP-ONLY-PRECOMMIT-001.prestatus";if(!fs.existsSync(baselinePath)){process.exit(1);}const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p))process.exit(1);}process.exit(0);' docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-PRECOMMIT-001.md
PASS: exit 0

CHECK_06_POST_PRECOMMIT_SCOPE_STAYS_NARROW
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-PRECOMMIT-001.md","utf8");if(!t.includes("STATUS: PRE_COMMIT_CHECKS_GREEN_READY_FOR_NARROW_COMMIT_NO_STAGING_NO_COMMIT_RUNTIME_WRITES_NOT_ADMITTED"))process.exit(1);if(!t.includes("future commit allowlist subset is separate and does not authorize staging or commit in this batch"))process.exit(1);if(!t.includes("this batch may claim READY_FOR_NARROW_COMMIT only after explicit prechecks and postchecks pass"))process.exit(1);if(!t.includes("no new terminal records are created in this batch"))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_07_POST_TARGETS_EXIST_AND_NO_NEW_RECORDS_CREATED
CMD: test -f docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md && test -f docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json
PASS: exit 0

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения BATCH_ALLOWLIST.
- Missing baseline snapshot → STOP.
- Любая попытка начать staging или commit actions внутри этого batch → STOP.
- Любая попытка создать новый terminal record внутри этого batch → STOP.
- Любая попытка перечитать `READY_FOR_NARROW_COMMIT` как auto-stage or auto-commit → STOP.

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
- Никаких staging or commit actions внутри этого pre-commit batch.
