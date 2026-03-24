TASK_ID: CORE-A4-YALKEN-FACTUAL-REFRESH-001
MILESTONE: A4
TYPE: CORE
STATUS: FACTUAL_REFRESH_COMPLETE_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Завершить текущий factual refresh pass только по active factual docs, названным current binding surfaces: `CONTEXT.md` и `HANDOFF.md`. Этот task фиксирует current-lane factual state после contour 01 и contour 02 proof-only closure, не меняет canon or protocol docs, не создает runtime admission, не стартует Phase 02 execution и не открывает 03-04-05 ladder.

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-FACTUAL-REFRESH-001.md
- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/OPS/STATUS/CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-FACTUAL-REFRESH-001.md
- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/OPS/STATUS/CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json

## DENYLIST
- любые изменения `CANON.md`
- любые изменения `docs/PROCESS.md`
- любые изменения `docs/BIBLE.md`
- любые изменения `docs/corex/**`
- любые изменения `README.md`
- любые runtime surface writes
- любые changes to contour 03-04-05 admission state
- любые changes to existing contour 01 or contour 02 records
- любые Phase 02 execution artifacts
- любые новые status records кроме одного refresh-complete record
- любые runtime admission claims
- любые formal cutover claims
- любые broad shell admission claims
- любые изменения `src/**`
- любые изменения `scripts/**`
- любые изменения `test/**`

## CONTRACT / SHAPES
- TASK_CLASS: CURRENT_LANE_FACTUAL_REFRESH_ONLY
- SAFE_ALLOWLIST_BASENAMES:
  - CONTEXT.md
  - HANDOFF.md
- RESULT_RECORD_BASENAME: CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json
- PHASE02_HISTORICAL_PACKET_BASENAME: PHASE02_CORE_LOCK_PACKET_V1.json
- result record must keep currentBindingOrderPreserved true
- result record must keep factualRefreshCompleted true
- result record must keep phase02PrepStarted false
- result record must keep historicalPhase02PacketCountsAsCurrentPrepAdmission false
- result record must keep runtimeWritesAdmitted false
- result record must keep runtimeAdmissionGranted false
- result record must keep formalCutoverClaimed false
- result record must keep broadShellAdmissionClaimed false
- CONTEXT.md and HANDOFF.md must both say that contour 01 and contour 02 are closed as proof-only contours
- CONTEXT.md and HANDOFF.md must both say that current-lane Phase 02 move is next
- CONTEXT.md and HANDOFF.md must both state that `PHASE02_CORE_LOCK_PACKET_V1.json` is historical readiness evidence only and does not count as current-lane prep admission

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01 и CHECK_02 до любых write-действий.
1) Прочитать `CANON.md`, `docs/CONTEXT.md`, `docs/HANDOFF.md`, `CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json`, `CONTOUR_01_PROOF_CLOSURE_RECORD_V1.json`, `CONTOUR_02_PROOF_CLOSURE_RECORD_V1.json` и `PHASE02_CORE_LOCK_PACKET_V1.json`.
2) Обновить только `CONTEXT.md` и `HANDOFF.md`, чтобы они отражали current-lane factual state:
   - contour 01 closed as proof-only contour without runtime mutation,
   - contour 02 closed as proof-only contour without runtime mutation,
   - current binding order remains preserved,
   - next move is one separate current-lane Phase 02 prep-only step,
   - `PHASE02_CORE_LOCK_PACKET_V1.json` is retained as historical readiness evidence only and does not count as current-lane prep admission.
3) Выпустить один `CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json`.
4) После записи выполнить CHECK_03, CHECK_04 и CHECK_05 и остановиться.

## CHECKS
CHECK_01_PRE_BINDING_ORDER_AND_SCOPE_RESOLVE
CMD: node -e 'const fs=require("node:fs");const r=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json","utf8"));const p=JSON.parse(fs.readFileSync("docs/OPS/STATUS/PHASE02_CORE_LOCK_PACKET_V1.json","utf8"));if(r.decision!=="KEEP_CURRENT_ORDER")process.exit(1);if(r.currentBindingOrderPreserved!==true)process.exit(1);if(r.contour03PrepOnlyAllowed!==false)process.exit(1);if(p.status!=="PASS")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-FACTUAL-REFRESH-001.prestatus && echo OK
PASS: OUT == OK

CHECK_03_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){console.error("ALLOWLIST is empty");process.exit(2);}const baselinePath="/tmp/CORE-A4-YALKEN-FACTUAL-REFRESH-001.prestatus";if(!fs.existsSync(baselinePath)){console.error("Missing baseline status snapshot");process.exit(1);}const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p)){console.error(`Disallowed delta: ${p}`);process.exit(1);}}process.exit(0);' docs/tasks/CORE-A4-YALKEN-FACTUAL-REFRESH-001.md docs/CONTEXT.md docs/HANDOFF.md docs/OPS/STATUS/CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json
PASS: exit 0

CHECK_04_POST_CONTEXT_AND_HANDOFF_CURRENT_LANE_REFRESH_COMPLETE
CMD: node -e 'const fs=require("node:fs");const context=fs.readFileSync("docs/CONTEXT.md","utf8");const handoff=fs.readFileSync("docs/HANDOFF.md","utf8");const req=[ "Contour 01 is closed as a proof-only contour without runtime mutation.", "Contour 02 is closed as a proof-only contour without runtime mutation.", "PHASE02_CORE_LOCK_PACKET_V1.json is retained as historical readiness evidence only.", "It does not count as current-lane prep admission.", "one separate current-lane Phase 02 prep-only step" ]; for(const r of req){ if(!context.includes(r) || !handoff.includes(r)) process.exit(1); } process.exit(0);'
PASS: exit 0

CHECK_05_POST_RESULT_RECORD_STAYS_NARROW
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json","utf8"));if(j.status!=="FACTUAL_REFRESH_COMPLETE_RUNTIME_WRITES_NOT_ADMITTED")process.exit(1);if(j.currentBindingOrderPreserved!==true)process.exit(1);if(j.factualRefreshCompleted!==true)process.exit(1);if(j.phase02PrepStarted!==false)process.exit(1);if(j.historicalPhase02PacketCountsAsCurrentPrepAdmission!==false)process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.runtimeAdmissionGranted!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);if(j.broadShellAdmissionClaimed!==false)process.exit(1);if(j.nextStep!=="OPEN_ONE_SEPARATE_CURRENT_LANE_PHASE02_PREP_ONLY_TASK")process.exit(1);process.exit(0);'
PASS: exit 0

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая необходимость менять `CANON.md`, `PROCESS.md`, `README.md`, `BIBLE.md` или `COREX.v1.md` внутри этого task → STOP.
- Любая попытка читать historical `PHASE02_CORE_LOCK_PACKET_V1.json` как current-lane prep admission → STOP.
- Любая попытка открыть Phase 02 execution, runtime admission или 03-04-05 admission внутри этого task → STOP.

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
- Никакого Phase 02 start claim внутри factual refresh task.
