TASK_ID: CORE-A4-YALKEN-LADDER-03-04-05-RECON-001
MILESTONE: A4
TYPE: CORE
STATUS: RECONCILIATION_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Зафиксировать одно repo-local решение `KEEP_CURRENT_ORDER` по delivery order для лестницы 03-04-05. Этот task не переписывает binding docs, не создает runtime admission, не создает formal cutover и не открывает contour 03 по narrative force. Любая попытка отдельно допустить 03-04-05 order требует другого task id и другого decision record.

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md
- docs/OPS/STATUS/CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md
- docs/OPS/STATUS/CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json

## DENYLIST
- любые изменения `CANON.md`
- любые изменения `docs/CONTEXT.md`
- любые изменения `docs/HANDOFF.md`
- любые изменения `docs/OPS/STATUS/CANON_STATUS.json`
- любые runtime surface writes
- любые contour 03, contour 04 или contour 05 execution artifacts
- любые новые status records кроме одного decision record
- любые runtime admission claims
- любые formal cutover claims
- любые broad shell admission claims
- любые новые зависимости
- любые изменения `src/**`
- любые изменения `scripts/**`
- любые изменения `test/**`

## CONTRACT / SHAPES
- TASK_CLASS: DELIVERY_ORDER_RECONCILIATION_ONLY
- DECISION_RECORD_BASENAME: CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json
- TASK_REVISION_DECISION_SCOPE: KEEP_CURRENT_ORDER_ONLY
- SEPARATE_ADMISSION_RULE: ADMIT_03_04_05_ORDER requires one separate task id and one separate decision record
- decision record must state delivery-order governance only
- decision record must keep currentBindingOrderPreserved true when decision is KEEP_CURRENT_ORDER
- decision record must keep contour03PrepOnlyAllowed false when decision is KEEP_CURRENT_ORDER
- decision record must keep contour04Admitted false
- decision record must keep contour05Admitted false
- decision record must keep runtimeWritesAdmitted false
- decision record must keep runtimeAdmissionGranted false
- decision record must keep formalCutoverClaimed false
- decision record must keep broadShellAdmissionClaimed false
- decision record must keep parallelTruthCreated false
- decision record must state that external 03-04-05 ladder docs remain supporting only until separately admitted

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02 и CHECK_03 до любых write-действий.
1) Прочитать `CANON.md`, `docs/CONTEXT.md`, `docs/HANDOFF.md`, `docs/OPS/STATUS/CANON_STATUS.json` и `CONTOUR_02_PROOF_CLOSURE_RECORD_V1.json`.
2) Подтвердить, что current binding order в repo-local truth surfaces все еще требует factual doc refresh и Phase 02 раньше wider shell truth.
3) Выпустить один `CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json` с решением `KEEP_CURRENT_ORDER`.
4) Не менять binding docs и не интерпретировать supporting 03-04-05 docs как admission evidence.
5) После записи decision record выполнить CHECK_04 и CHECK_05 и остановиться.

## CHECKS
CHECK_01_PRE_ACTIVE_CANON_RESOLVES
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CANON_STATUS.json","utf8"));if(j.status!=="ACTIVE_CANON")process.exit(1);if(j.canonVersion!=="v3.13a-final")process.exit(1);if(j.canonicalDocPath!=="docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_CURRENT_BINDING_ORDER_IS_EXPLICIT
CMD: node -e 'const fs=require("node:fs");const canon=fs.readFileSync("CANON.md","utf8");const context=fs.readFileSync("docs/CONTEXT.md","utf8");const handoff=fs.readFileSync("docs/HANDOFF.md","utf8");if(!canon.includes("Phase 02: data core, recovery и command kernel stabilization"))process.exit(1);if(!context.includes("1. factual doc cutover and active doc reconciliation"))process.exit(1);if(!context.includes("2. data core, recovery и command kernel stabilization"))process.exit(1);if(!handoff.includes("1. complete one-pass factual doc refresh"))process.exit(1);if(!handoff.includes("2. lock Phase 02 data core and command kernel contours"))process.exit(1);if(!handoff.includes("3. move only then into wider shell truth"))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_03_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.prestatus && echo OK
PASS: OUT == OK

CHECK_04_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){console.error("ALLOWLIST is empty");process.exit(2);}const baselinePath="/tmp/CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.prestatus";if(!fs.existsSync(baselinePath)){console.error("Missing baseline status snapshot");process.exit(1);}const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p)){console.error(`Disallowed delta: ${p}`);process.exit(1);}}process.exit(0);' docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md docs/OPS/STATUS/CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json
PASS: exit 0

CHECK_05_POST_DECISION_RECORD_STAYS_NARROW_AND_PRESERVES_ORDER
CMD: node -e 'const fs=require("node:fs");const p="docs/OPS/STATUS/CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.status!=="CURRENT_BINDING_ORDER_PRESERVED_RUNTIME_WRITES_NOT_ADMITTED")process.exit(1);if(j.decision!=="KEEP_CURRENT_ORDER")process.exit(1);if(j.orderScope!=="DELIVERY_ORDER_ONLY")process.exit(1);if(j.currentBindingOrderPreserved!==true)process.exit(1);if(j.contour03PrepOnlyAllowed!==false)process.exit(1);if(j.contour04Admitted!==false)process.exit(1);if(j.contour05Admitted!==false)process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.runtimeAdmissionGranted!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);if(j.broadShellAdmissionClaimed!==false)process.exit(1);if(j.parallelTruthCreated!==false)process.exit(1);if(j.nextStep!=="CONTINUE_FACTUAL_DOC_REFRESH_AND_PHASE_02_SEQUENCE")process.exit(1);process.exit(0);'
PASS: exit 0

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая необходимость менять binding docs внутри этого task → STOP.
- Любая попытка использовать этот task как runtime admission, formal cutover или contour 03 admission → STOP.
- Любая попытка создать второй decision или inspector artifact внутри этого task → STOP.

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
- Никакого auto-admission для 03-04-05.
