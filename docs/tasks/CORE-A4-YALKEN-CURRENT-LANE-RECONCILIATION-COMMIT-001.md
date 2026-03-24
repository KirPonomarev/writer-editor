TASK_ID: CORE-A4-YALKEN-CURRENT-LANE-RECONCILIATION-COMMIT-001
MILESTONE: A4
TYPE: CORE
STATUS: NARROW_COMMIT_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Выполнить один narrow reconciliation commit только для current-lane governance surfaces и factual docs: `CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json`, `CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json`, `CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json`, `CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json`, `CONTEXT.md`, `HANDOFF.md` плюс одного commit-task artifact. Этот task устраняет split-brain по current head и immediate next step, не открывает runtime writes, не делает formal cutover claims, не делает broad shell admission claims и не начинает Phase 02 precommit chain внутри этого batch.

## ENTRY_CRITERIA
- `CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json` already points queue head to `CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md`
- `CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json` already points owner head to `CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md`
- current-lane reconciliation patch is already present in the working tree and awaits one narrow commit outcome
- `CONTEXT.md` and `HANDOFF.md` now describe the local current-lane phase02 admission state without reopening runtime

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-CURRENT-LANE-RECONCILIATION-COMMIT-001.md
- docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json
- docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json
- docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json
- docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json
- docs/CONTEXT.md
- docs/HANDOFF.md

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-CURRENT-LANE-RECONCILIATION-COMMIT-001.md
- docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json
- docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json
- docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json
- docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json
- docs/CONTEXT.md
- docs/HANDOFF.md

## DENYLIST
- любые runtime surface writes
- любые изменения вне ALLOWLIST
- любые basename-only staging rules
- любые add-all patterns
- любые вторые commit actions
- любые новые status records
- любые новые owner-advance batches
- любые новые contours
- любые formal cutover claims
- любые broad shell admission claims
- любой Phase 02 precommit work inside this batch

## CONTRACT / SHAPES
- TASK_CLASS: NARROW_RECONCILIATION_COMMIT_ONLY
- AUTHORITATIVE_HEAD_BASENAME: CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md
- AUTHORITATIVE_NEXT_STEP: OPEN_ONE_SEPARATE_QUEUE_HEAD_PATCH_TASK_ONLY_FOR_CORE-A4-YALKEN-PHASE02-PREP-ONLY-001_COMMIT_LOOP_STILL_NOT_STARTED_NO_STAGING_OR_COMMIT_ACTIONS_IN_THIS_STEP
- exact-path staging only
- commit scope is exactly the seven allowlist paths above
- create exactly one narrow commit only
- keep runtimeWritesAdmitted false throughout this batch
- keep runtimeAdmissionGranted false throughout this batch
- keep formalCutoverClaimed false throughout this batch
- keep broadShellAdmissionClaimed false throughout this batch
- do not start Phase 02 execution inside this batch
- do not reopen contours 03, 04, or 05 inside this batch

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02, CHECK_03, CHECK_04 и CHECK_05 до staging.
1) Захватить pre-stage baseline and head baseline.
2) Выполнить `git add --` exact paths only from ALLOWLIST.
3) Проверить, что staged delta matches allowlist exactly.
4) Повторно прогнать narrow reconciliation checks перед commit.
5) Создать ровно один commit с narrow scope.
6) Проверить, что последний commit содержит только allowlist paths.
7) Остановиться; никаких новых governance steps внутри этого task не делать.

## CHECKS
CHECK_01_PRE_RECONCILED_HEAD_AND_NEXT_STEP_READY
CMD: node -e 'const fs=require("node:fs");const ledger=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));const owner=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));const prep=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","utf8"));const execRec=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json","utf8"));const context=fs.readFileSync("docs/CONTEXT.md","utf8");const handoff=fs.readFileSync("docs/HANDOFF.md","utf8");const canon="OPEN_ONE_SEPARATE_QUEUE_HEAD_PATCH_TASK_ONLY_FOR_CORE-A4-YALKEN-PHASE02-PREP-ONLY-001_COMMIT_LOOP_STILL_NOT_STARTED_NO_STAGING_OR_COMMIT_ACTIONS_IN_THIS_STEP";if(ledger.firstExecutableQueueHeadBasename!=="CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md")process.exit(1);if(owner.queueHeadTaskBasename!=="CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md")process.exit(1);if(ledger.nextStep!==canon||owner.nextStep!==canon||prep.nextStep!==canon||execRec.nextStep!==canon)process.exit(1);const req=["Current-lane Phase 02 prep-only is already admitted as governance only.","Current-lane Phase 02 execution admission record already exists as future authority only.","one separate queue-head patch task only for current-lane Phase 02 prep-only"];for(const r of req){if(!context.includes(r)||!handoff.includes(r))process.exit(1);}process.exit(0);'
PASS: exit 0

CHECK_02_PRE_RUNTIME_FALSE_AND_PHASE02_ADMISSION_STATE_STABLE
CMD: node -e 'const fs=require("node:fs");const ledger=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));const owner=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));const prep=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","utf8"));const execRec=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json","utf8"));if(ledger.runtimeWritesAdmitted!==false||ledger.runtimeAdmissionGranted!==false||ledger.formalCutoverClaimed!==false||ledger.broadShellAdmissionClaimed!==false)process.exit(1);if(owner.runtimeWritesAdmitted!==false||owner.runtimeAdmissionGranted!==false||owner.formalCutoverClaimed!==false||owner.broadShellAdmissionClaimed!==false)process.exit(1);if(prep.phase02PrepOnlyAdmitted!==true||prep.phase02ExecutionStarted!==false||prep.phase02ExecutionAdmitted!==false)process.exit(1);if(prep.runtimeWritesAdmitted!==false||prep.runtimeAdmissionGranted!==false)process.exit(1);if(execRec.phase02ExecutionAdmitted!==true||execRec.phase02ExecutionStarted!==false||execRec.phase02ExecutionAttempted!==false)process.exit(1);if(execRec.runtimeWritesPerformed!==false||execRec.runtimeWritesAdmitted!==false||execRec.runtimeAdmissionGranted!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_03_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-CURRENT-LANE-RECONCILIATION-COMMIT-001.prestatus && echo OK
PASS: OUT == OK

CHECK_04_PRE_CAPTURE_HEAD_BASELINE
CMD: git rev-parse HEAD > /tmp/CORE-A4-YALKEN-CURRENT-LANE-RECONCILIATION-COMMIT-001.head && echo OK
PASS: OUT == OK

CHECK_05_PRE_STAGED_SET_EMPTY
CMD: test -z "$(git diff --cached --name-only)" && echo OK
PASS: OUT == OK

CHECK_06_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));const baselinePath="/tmp/CORE-A4-YALKEN-CURRENT-LANE-RECONCILIATION-COMMIT-001.prestatus";if(!fs.existsSync(baselinePath))process.exit(1);const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p))process.exit(1);}process.exit(0);' docs/tasks/CORE-A4-YALKEN-CURRENT-LANE-RECONCILIATION-COMMIT-001.md docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json docs/CONTEXT.md docs/HANDOFF.md
PASS: exit 0

CHECK_07_POST_STAGED_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git diff --cached --name-only",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-CURRENT-LANE-RECONCILIATION-COMMIT-001.md docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json docs/CONTEXT.md docs/HANDOFF.md
PASS: exit 0

CHECK_08_POST_HEAD_MOVED_BY_EXACTLY_ONE_COMMIT
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const before=fs.readFileSync("/tmp/CORE-A4-YALKEN-CURRENT-LANE-RECONCILIATION-COMMIT-001.head","utf8").trim();const after=execSync("git rev-parse HEAD",{encoding:"utf8"}).trim();if(!before||!after||before===after)process.exit(1);const count=execSync(`git rev-list --count ${before}..${after}`,{encoding:"utf8"}).trim();if(count!=="1")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_09_POST_LAST_COMMIT_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git show --pretty=format: --name-only HEAD",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-CURRENT-LANE-RECONCILIATION-COMMIT-001.md docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json docs/CONTEXT.md docs/HANDOFF.md
PASS: exit 0

CHECK_10_POST_RECONCILED_SURFACES_AND_FACTUAL_DOCS
CMD: node -e 'const fs=require("node:fs");const ledger=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));const owner=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));const prep=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","utf8"));const execRec=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json","utf8"));const context=fs.readFileSync("docs/CONTEXT.md","utf8");const handoff=fs.readFileSync("docs/HANDOFF.md","utf8");const canon="OPEN_ONE_SEPARATE_QUEUE_HEAD_PATCH_TASK_ONLY_FOR_CORE-A4-YALKEN-PHASE02-PREP-ONLY-001_COMMIT_LOOP_STILL_NOT_STARTED_NO_STAGING_OR_COMMIT_ACTIONS_IN_THIS_STEP";if(ledger.firstExecutableQueueHeadBasename!=="CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md")process.exit(1);if(owner.queueHeadTaskBasename!=="CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md")process.exit(1);if(ledger.nextStep!==canon||owner.nextStep!==canon||prep.nextStep!==canon||execRec.nextStep!==canon)process.exit(1);if(prep.phase02PrepOnlyAdmitted!==true||execRec.phase02ExecutionAdmitted!==true)process.exit(1);if(ledger.runtimeWritesAdmitted!==false||owner.runtimeWritesAdmitted!==false||prep.runtimeWritesAdmitted!==false||execRec.runtimeWritesAdmitted!==false)process.exit(1);const req=["Current-lane Phase 02 prep-only is already admitted as governance only.","Current-lane Phase 02 execution admission record already exists as future authority only.","one separate queue-head patch task only for current-lane Phase 02 prep-only"];for(const r of req){if(!context.includes(r)||!handoff.includes(r))process.exit(1);}process.exit(0);'
PASS: exit 0

## COMMIT_MESSAGE_TEMPLATE
- LINE_01: CORE-A4-YALKEN-CURRENT-LANE-RECONCILIATION-COMMIT-001
- LINE_02: SCOPE CORE-A4-YALKEN-CURRENT-LANE-RECONCILIATION-COMMIT-001 CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1 CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1 CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1 CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1 CONTEXT HANDOFF
- LINE_03: OUTCOME COMMIT_CREATED
- LINE_04: CHECKS CHECK_01 CHECK_02 CHECK_03 CHECK_04 CHECK_05 CHECK_06 CHECK_07
- LINE_05: NO_RUNTIME_ADMISSION_CLAIMED_TRUE

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любой extra staged path → STOP.
- Любой второй commit attempt → STOP.
- Любая попытка стартовать Phase 02 precommit chain внутри этого task → STOP.

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
- Никаких second commit actions inside this batch.
