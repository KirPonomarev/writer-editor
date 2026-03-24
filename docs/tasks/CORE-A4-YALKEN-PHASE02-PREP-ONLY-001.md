TASK_ID: CORE-A4-YALKEN-PHASE02-PREP-ONLY-001
MILESTONE: A4
TYPE: CORE
STATUS: PREP_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Принять одно current-lane решение только по prep-only admission для Phase 02. Этот task не стартует Phase 02 execution, не создает runtime admission, не создает formal cutover, не трогает runtime surfaces и не переиспользует `PHASE02_CORE_LOCK_PACKET_V1.json` как самостоятельную current-lane prep admission authority.

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md
- docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md
- docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json

## DENYLIST
- любые изменения `CANON.md`
- любые изменения `docs/CONTEXT.md`
- любые изменения `docs/HANDOFF.md`
- любые изменения `docs/PROCESS.md`
- любые изменения `docs/BIBLE.md`
- любые изменения `docs/corex/**`
- любые runtime surface writes
- любые Phase 02 execution artifacts
- любые новые status records кроме одного prep-only decision record
- любые contour 03, contour 04 или contour 05 admission changes
- любые изменения existing contour records
- любые новые зависимости
- любые изменения `src/**`
- любые изменения `scripts/**`
- любые изменения `test/**`

## SOURCE_PRIORITY
- SOURCE_PRIORITY: CANON_STATUS_AND_ACTIVE_EXECUTION_CANON_FIRST
- CANON_MD_SECOND
- COREX_AND_BIBLE_BEFORE_FACTUAL_DOCS
- FACTUAL_DOCS_DESCRIBE_CURRENT_OPERATING_REALITY_AND_DO_NOT_OVERRIDE_ACTIVE_CANON
- PACKET_DOCS_ARE_PLANNING_ONLY_NOT_BINDING_CANON

## TRUTH_GUARDRAILS
- ONE_ACTIVE_PRODUCT_TRUTH_PER_ACTIVE_FACTUAL_DOC_SET
- DO_NOT_CREATE_SPLIT_BRAIN_DOCS
- this task must not be used to rewrite mainline factual docs by narrative force

## CONTRACT / SHAPES
- TASK_CLASS: CURRENT_LANE_PHASE02_PREP_ONLY_ADMISSION
- DECISION_RECORD_BASENAME: CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json
- decision record must keep phase02PrepOnlyAdmitted true
- decision record must keep phase02ExecutionStarted false
- decision record must keep phase02ExecutionAdmitted false
- decision record must keep runtimeWritesAdmitted false
- decision record must keep runtimeAdmissionGranted false
- decision record must keep formalCutoverClaimed false
- decision record must keep broadShellAdmissionClaimed false
- decision record must keep historicalPhase02PacketCountsAsCurrentPrepAdmission false
- decision record must keep contour03Admitted false
- decision record must keep contour04Admitted false
- decision record must keep contour05Admitted false
- `PHASE02_CORE_LOCK_PACKET_V1.json` is retained as historical readiness context plus gate evidence only
- it does not by itself count as current-lane prep admission
- this step decides only whether one separate Phase 02 prep-only lane is admitted
- this step does not start Phase 02 execution and does not grant runtime admission

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02 и CHECK_03 до любых write-действий.
1) Прочитать `CANON.md`, `docs/CONTEXT.md`, `docs/HANDOFF.md`, `CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json`, `CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json`, `PHASE02_CORE_LOCK_PACKET_V1.json` и `phase02-core-lock-state.mjs` output.
2) Подтвердить, что current binding order preserved, factual refresh completed, and the next allowed governance move is one separate current-lane Phase 02 prep-only step.
3) Подтвердить, что `PHASE02_CORE_LOCK_PACKET_V1.json` и `phase02-core-lock-state.mjs` дают readiness context plus gate evidence and do not by themselves constitute current-lane prep admission.
4) Выпустить один `CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json`.
5) После записи decision record выполнить CHECK_04 и CHECK_05 и остановиться.

## CHECKS
CHECK_01_PRE_FACTUAL_REFRESH_AND_ORDER_LOCK_PRESENT
CMD: node -e 'const fs=require("node:fs");const refresh=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json","utf8"));const recon=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json","utf8"));if(refresh.factualRefreshCompleted!==true)process.exit(1);if(refresh.currentBindingOrderPreserved!==true)process.exit(1);if(refresh.phase02PrepStarted!==false)process.exit(1);if(recon.decision!=="KEEP_CURRENT_ORDER")process.exit(1);if(recon.currentBindingOrderPreserved!==true)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_PHASE02_READINESS_CONTEXT_GREEN_BUT_NON_ADMISSIVE
CMD: node -e 'const fs=require("node:fs");const {spawnSync}=require("node:child_process");const packet=JSON.parse(fs.readFileSync("docs/OPS/STATUS/PHASE02_CORE_LOCK_PACKET_V1.json","utf8"));if(packet.status!=="PASS")process.exit(1);if(packet.phase02ReadinessStatus!=="PASS")process.exit(1);const run=spawnSync(process.execPath,["scripts/ops/phase02-core-lock-state.mjs","--json"],{encoding:"utf8"});if(run.status!==0)process.exit(1);const payload=JSON.parse(String(run.stdout||"{}"));if(payload.ok!==true)process.exit(1);if(payload.overallStatus!=="PASS")process.exit(1);if(payload.phase02ReadinessStatus!=="PASS")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_03_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.prestatus && echo OK
PASS: OUT == OK

CHECK_04_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){console.error("ALLOWLIST is empty");process.exit(2);}const baselinePath="/tmp/CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.prestatus";if(!fs.existsSync(baselinePath)){console.error("Missing baseline status snapshot");process.exit(1);}const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p)){console.error(`Disallowed delta: ${p}`);process.exit(1);}}process.exit(0);' docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json
PASS: exit 0

CHECK_05_POST_DECISION_RECORD_STAYS_PREP_ONLY
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","utf8"));if(j.status!=="CURRENT_LANE_PHASE02_PREP_ONLY_ADMITTED_RUNTIME_WRITES_NOT_ADMITTED")process.exit(1);if(j.phase02PrepOnlyAdmitted!==true)process.exit(1);if(j.phase02ExecutionStarted!==false)process.exit(1);if(j.phase02ExecutionAdmitted!==false)process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.runtimeAdmissionGranted!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);if(j.broadShellAdmissionClaimed!==false)process.exit(1);if(j.historicalPhase02PacketCountsAsCurrentPrepAdmission!==false)process.exit(1);if(j.contour03Admitted!==false)process.exit(1);if(j.contour04Admitted!==false)process.exit(1);if(j.contour05Admitted!==false)process.exit(1);if(j.nextStep!=="OPEN_ONE_SEPARATE_QUEUE_HEAD_PATCH_TASK_ONLY_FOR_CORE-A4-YALKEN-PHASE02-PREP-ONLY-001_COMMIT_LOOP_STILL_NOT_STARTED_NO_STAGING_OR_COMMIT_ACTIONS_IN_THIS_STEP")process.exit(1);process.exit(0);'
PASS: exit 0

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая попытка читать `PHASE02_CORE_LOCK_PACKET_V1.json` как самостоятельную current-lane prep admission authority → STOP.
- Любая попытка стартовать Phase 02 execution inside this task → STOP.
- Любая попытка открыть runtime admission, formal cutover or 03-05 admission inside this task → STOP.

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
- Никакого использования historical readiness packet как current-lane admission authority.
