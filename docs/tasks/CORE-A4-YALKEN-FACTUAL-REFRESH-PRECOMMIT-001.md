TASK_ID: CORE-A4-YALKEN-FACTUAL-REFRESH-PRECOMMIT-001
MILESTONE: A4
TYPE: CORE
STATUS: PRE_COMMIT_CHECKS_GREEN_READY_FOR_NARROW_COMMIT_NO_STAGING_NO_COMMIT_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Открыть один отдельный pre-commit task для next narrow chain segment `CORE-A4-YALKEN-FACTUAL-REFRESH-001.md`, развести `batch allowlist` и `future commit allowlist subset`, прогнать pre-commit checks и зафиксировать только один честный outcome: `READY_FOR_NARROW_COMMIT` или STOP. Этот task не стартует commit loop, не stage-файлит, не делает commit, не патчит terminal records и не открывает runtime admission.

## ENTRY_CRITERIA
- `CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json` remains valid and lists `CORE-A4-YALKEN-FACTUAL-REFRESH-001.md` as the next current-lane queue segment after reconciliation
- `CORE-A4-YALKEN-FACTUAL-REFRESH-001.md` exists and stays `FACTUAL_REFRESH_COMPLETE_ONLY_RUNTIME_WRITES_NOT_ADMITTED`
- `CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json` exists and stays `FACTUAL_REFRESH_COMPLETE_RUNTIME_WRITES_NOT_ADMITTED`
- `CONTEXT.md` and `HANDOFF.md` already carry the current-lane factual refresh language

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-FACTUAL-REFRESH-PRECOMMIT-001.md

## BATCH_ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-FACTUAL-REFRESH-PRECOMMIT-001.md

## FUTURE_COMMIT_ALLOWLIST_SUBSET
- docs/tasks/CORE-A4-YALKEN-FACTUAL-REFRESH-001.md
- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/OPS/STATUS/CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json

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

## CONTRACT / SHAPES
- TASK_CLASS: CURRENT_LANE_PRE_COMMIT_ONLY
- TARGET_TASK_BASENAME: CORE-A4-YALKEN-FACTUAL-REFRESH-001.md
- TARGET_RECORD_BASENAME: CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json
- TARGET_FACTUAL_DOCS: CONTEXT.md HANDOFF.md
- LEDGER_SOURCE_BASENAME: CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json
- batch allowlist is only for this task artifact
- future commit allowlist subset is separate and does not authorize staging or commit in this batch
- delta baseline only; if baseline snapshot is missing, STOP
- ready for narrow commit does not auto-stage and does not auto-commit
- no new terminal records are created in this batch
- this task does not start commit loop
- this task does not grant runtime admission

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02, CHECK_03 и CHECK_04 до любых write-действий.
1) Прочитать `CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json`, `CORE-A4-YALKEN-FACTUAL-REFRESH-001.md`, `CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json`, `CONTEXT.md` и `HANDOFF.md`.
2) Зафиксировать exact future commit allowlist subset only for factual-refresh task, its result record and the two active factual docs.
3) Не выполнять staging, не выполнять commit actions и не патчить target terminal record внутри этого task.
4) После записи task выполнить CHECK_05, CHECK_06 и CHECK_07.
5) Если все checks green, этот batch заканчивается outcome `READY_FOR_NARROW_COMMIT` only.
6) Outcome `READY_FOR_NARROW_COMMIT` не дает auto-stage и не дает auto-commit.

## CHECKS
CHECK_01_PRE_LEDGER_POINTS_TO_NEXT_CURRENT_LANE_SEGMENT
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));const q=j.currentLaneSafePatchQueue;if(!Array.isArray(q))process.exit(1);const factual=q.find((x)=>x.order===1);if(!factual)process.exit(1);if(j.firstExecutableQueueHeadBasename!=="CORE-A4-YALKEN-FACTUAL-REFRESH-001.md")process.exit(1);if(factual.taskBasename!=="CORE-A4-YALKEN-FACTUAL-REFRESH-001.md")process.exit(1);if(factual.terminalRecordBasename!=="CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json")process.exit(1);if(j.exactPathStagingRequired!==true)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_TARGETS_AND_FACTUAL_STATE_PRESENT
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-FACTUAL-REFRESH-001.md","utf8");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json","utf8"));const context=fs.readFileSync("docs/CONTEXT.md","utf8");const handoff=fs.readFileSync("docs/HANDOFF.md","utf8");if(!t.includes("STATUS: FACTUAL_REFRESH_COMPLETE_ONLY_RUNTIME_WRITES_NOT_ADMITTED"))process.exit(1);if(j.status!=="FACTUAL_REFRESH_COMPLETE_RUNTIME_WRITES_NOT_ADMITTED")process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.runtimeAdmissionGranted!==false)process.exit(1);const req=["Contour 01 is closed as a proof-only contour without runtime mutation.","Contour 02 is closed as a proof-only contour without runtime mutation.","PHASE02_CORE_LOCK_PACKET_V1.json is retained as historical readiness evidence only.","It does not count as current-lane prep admission.","one separate current-lane Phase 02 prep-only step"];for(const r of req){if(!context.includes(r)||!handoff.includes(r))process.exit(1);}process.exit(0);'
PASS: exit 0

CHECK_03_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-FACTUAL-REFRESH-PRECOMMIT-001.prestatus && echo OK
PASS: OUT == OK

CHECK_04_PRE_STAGED_SET_EMPTY
CMD: test -z "$(git diff --cached --name-only)" && echo OK
PASS: OUT == OK

CHECK_05_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){process.exit(2);}const baselinePath="/tmp/CORE-A4-YALKEN-FACTUAL-REFRESH-PRECOMMIT-001.prestatus";if(!fs.existsSync(baselinePath)){process.exit(1);}const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p))process.exit(1);}process.exit(0);' docs/tasks/CORE-A4-YALKEN-FACTUAL-REFRESH-PRECOMMIT-001.md
PASS: exit 0

CHECK_06_POST_PRECOMMIT_SCOPE_STAYS_NARROW
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-FACTUAL-REFRESH-PRECOMMIT-001.md","utf8");if(!t.includes("STATUS: PRE_COMMIT_CHECKS_GREEN_READY_FOR_NARROW_COMMIT_NO_STAGING_NO_COMMIT_RUNTIME_WRITES_NOT_ADMITTED"))process.exit(1);if(!t.includes("future commit allowlist subset is separate and does not authorize staging or commit in this batch"))process.exit(1);if(!t.includes("ready for narrow commit does not auto-stage and does not auto-commit"))process.exit(1);if(!t.includes("no new terminal records are created in this batch"))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_07_POST_TARGETS_EXIST_AND_NO_NEW_RECORDS_CREATED
CMD: test -f docs/tasks/CORE-A4-YALKEN-FACTUAL-REFRESH-001.md && test -f docs/OPS/STATUS/CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json
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
