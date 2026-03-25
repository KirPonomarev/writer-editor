TASK_ID: CORE-A4-YALKEN-PHASE02-POST-ACTIVATION-FACTUAL-SYNC-001
MILESTONE: A4
TYPE: CORE
STATUS: FACTUAL_SYNC_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Синхронизировать factual docs и минимальный current-lane status set с фактом, что execution-activation уже материализован и закрыт как отдельный bounded step. Этот task не открывает runtime execution slice, не выполняет runtime writes, не открывает runtime admission, не выбирает concrete post-activation execution contour и не трогает contour 03, contour 04, contour 05 или Design OS C2.

## ENTRY_CRITERIA
- `CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md` уже materialized and reconciled in place
- latest activation recon commit already exists in local history
- runtime flags remain false across ledger, owner, prep-only and execution-admission records
- current factual docs still read as if activation is the pending next move

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-PHASE02-POST-ACTIVATION-FACTUAL-SYNC-001.md

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-POST-ACTIVATION-FACTUAL-SYNC-001.md
- docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json
- docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json
- docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json
- docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json
- docs/CONTEXT.md
- docs/HANDOFF.md

## DENYLIST
- any runtime write
- any runtime admission
- any execution start
- any contour 03, contour 04 or contour 05 work
- any Design OS C2 or other Design OS task
- any src change
- any scripts change
- any test change
- any CANON change
- any BIBLE change
- any README change
- any status record outside ALLOWLIST
- any PR creation
- any merge
- any scope widening

## CONTRACT / SHAPES
- TASK_CLASS: CURRENT_LANE_PHASE02_POST_ACTIVATION_FACTUAL_SYNC_ONLY
- NEXT_STEP_FORMULA: OPEN_ONE_NEW_EXPLICIT_POST_ACTIVATION_EXECUTION_BRIEF_ONLY
- exact allowlist only
- exact-path staging only
- create exactly one narrow commit only
- no push in this task
- no PR in this task
- no merge in this task
- do not choose a concrete execution slice in this task
- runtimeWritesAdmitted remains false
- runtimeAdmissionGranted remains false
- formalCutoverClaimed remains false
- broadShellAdmissionClaimed remains false
- phase02ExecutionStarted remains false
- phase02ExecutionAttempted remains false

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02 и CHECK_03 до любых write-действий.
1) Создать один task artifact only for `CORE-A4-YALKEN-PHASE02-POST-ACTIVATION-FACTUAL-SYNC-001.md`.
2) Синхронизировать только ALLOWLIST surfaces так, чтобы activation уже читался как materialized historical step, а следующий ход читался как one new explicit post-activation execution brief only.
3) Не выбирать и не открывать concrete execution slice внутри этого task.
4) Выполнить CHECK_04, CHECK_05, CHECK_06 и CHECK_07.
5) Выполнить `git add --` exact paths only from ALLOWLIST.
6) Выполнить CHECK_08.
7) Создать ровно один narrow commit.
8) Выполнить CHECK_09, CHECK_10 и CHECK_11.
9) STOP.

## CHECKS
CHECK_01_PRE_ACTIVATION_COMMIT_EXISTS_AND_IS_CLOSED
CMD: node -e 'const {execSync}=require("node:child_process");const head=execSync("git rev-parse HEAD",{encoding:"utf8"}).trim();if(head!=="96f199b54c8c6cc7876e78feaaab1f117bb451b5")process.exit(1);const parent=execSync("git rev-parse 96f199b54c8c6cc7876e78feaaab1f117bb451b5^",{encoding:"utf8"}).trim();if(parent!=="08cfb9238b1e1f144656205190b207fd73502424")process.exit(1);const scope=execSync("git show --pretty=format: --name-only 96f199b54c8c6cc7876e78feaaab1f117bb451b5",{encoding:"utf8"}).trim().split("\\n").filter(Boolean);if(scope.length!==1||scope[0]!=="docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_RUNTIME_FLAGS_ALL_FALSE
CMD: node -e 'const fs=require("node:fs");const files=["docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json"];for(const f of files){const j=JSON.parse(fs.readFileSync(f,"utf8"));if(j.runtimeWritesAdmitted!==false||j.runtimeAdmissionGranted!==false||j.formalCutoverClaimed!==false||j.broadShellAdmissionClaimed!==false)process.exit(1);}const execj=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json","utf8"));if(execj.phase02ExecutionStarted!==false||execj.phase02ExecutionAttempted!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_03_PRE_ACTIVE_POINTER_STILL_LAGS_ON_ACTIVATION_LANGUAGE
CMD: node -e 'const fs=require("node:fs");const old="OPEN_ONE_SEPARATE_CURRENT_LANE_PHASE02_EXECUTION_ACTIVATION_TASK_ONLY_FOR_CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001_RUNTIME_WRITES_STILL_LOCKED_NO_EXECUTION_START_IN_THIS_STEP";const files=["docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json","docs/CONTEXT.md","docs/HANDOFF.md"];for(const f of files){const t=fs.readFileSync(f,"utf8");if(!t.includes(old) && !t.includes("one separate current-lane Phase 02 execution-activation task only"))process.exit(1);}process.exit(0);'
PASS: exit 0

CHECK_04_POST_CONTEXT_AND_HANDOFF_MATCH_POST_ACTIVATION_REALITY
CMD: node -e 'const fs=require("node:fs");const files=["docs/CONTEXT.md","docs/HANDOFF.md"];for(const f of files){const t=fs.readFileSync(f,"utf8");const req=["activation task is already materialized","one new explicit post-activation execution brief only"];for(const r of req){if(!t.includes(r))process.exit(1);}}process.exit(0);'
PASS: exit 0

CHECK_05_POST_LEDGER_AND_OWNER_NO_LONGER_POINT_TO_OPEN_ACTIVATION_AS_PENDING_ACTION
CMD: node -e 'const fs=require("node:fs");const ledger=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));const owner=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));if(ledger.nextStep!=="OPEN_ONE_NEW_EXPLICIT_POST_ACTIVATION_EXECUTION_BRIEF_ONLY")process.exit(1);if(owner.nextStep!=="OPEN_ONE_NEW_EXPLICIT_POST_ACTIVATION_EXECUTION_BRIEF_ONLY")process.exit(1);if(owner.queueHeadTaskMayOpen!==false)process.exit(1);if(owner.decision!=="REQUIRE_ONE_NEW_EXPLICIT_POST_ACTIVATION_EXECUTION_BRIEF_ONLY")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_06_POST_EXECUTION_ADMISSION_REMAINS_FUTURE_AUTHORITY_ONLY
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json","utf8"));if(j.phase02ExecutionAdmitted!==true)process.exit(1);if(j.phase02ExecutionStarted!==false||j.phase02ExecutionAttempted!==false)process.exit(1);if(j.runtimeWritesAdmitted!==false||j.runtimeAdmissionGranted!==false||j.formalCutoverClaimed!==false||j.broadShellAdmissionClaimed!==false)process.exit(1);if(j.nextStep!=="OPEN_ONE_NEW_EXPLICIT_POST_ACTIVATION_EXECUTION_BRIEF_ONLY")process.exit(1);const notes=JSON.stringify(j.notes);if(!notes.includes("activation task is already materialized"))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_07_POST_NEXT_STEP_TEXT_EQUALS_OPEN_ONE_NEW_EXPLICIT_POST_ACTIVATION_EXECUTION_BRIEF_ONLY
CMD: node -e 'const fs=require("node:fs");const want="OPEN_ONE_NEW_EXPLICIT_POST_ACTIVATION_EXECUTION_BRIEF_ONLY";const jsons=["docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json"];for(const f of jsons){const j=JSON.parse(fs.readFileSync(f,"utf8"));if(j.nextStep!==want)process.exit(1);}const task=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-POST-ACTIVATION-FACTUAL-SYNC-001.md","utf8");if(!task.includes("NEXT_STEP_FORMULA: OPEN_ONE_NEW_EXPLICIT_POST_ACTIVATION_EXECUTION_BRIEF_ONLY"))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_08_POST_STAGED_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git diff --cached --name-only",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-PHASE02-POST-ACTIVATION-FACTUAL-SYNC-001.md docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json docs/CONTEXT.md docs/HANDOFF.md
PASS: exit 0

CHECK_09_POST_ONE_NARROW_COMMIT_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const before=fs.readFileSync("/tmp/CORE-A4-YALKEN-PHASE02-POST-ACTIVATION-FACTUAL-SYNC-001.head","utf8").trim();const after=execSync("git rev-parse HEAD",{encoding:"utf8"}).trim();if(!before||!after||before===after)process.exit(1);const count=execSync(`git rev-list --count ${before}..${after}`,{encoding:"utf8"}).trim();if(count!=="1")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_10_POST_RUNTIME_FLAGS_STILL_FALSE
CMD: node -e 'const fs=require("node:fs");const files=["docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json"];for(const f of files){const j=JSON.parse(fs.readFileSync(f,"utf8"));if(j.runtimeWritesAdmitted!==false||j.runtimeAdmissionGranted!==false||j.formalCutoverClaimed!==false||j.broadShellAdmissionClaimed!==false)process.exit(1);}const execj=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json","utf8"));if(execj.phase02ExecutionStarted!==false||execj.phase02ExecutionAttempted!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_11_POST_NO_PR_NO_MERGE_NO_RUNTIME_ADMISSION
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-POST-ACTIVATION-FACTUAL-SYNC-001.md","utf8");const req=["- no push in this task","- no PR in this task","- no merge in this task","- do not choose a concrete execution slice in this task"];for(const r of req){if(!t.includes(r))process.exit(1);}process.exit(0);'
PASS: exit 0

## COMMIT_MESSAGE_TEMPLATE
- LINE_01: CORE-A4-YALKEN-PHASE02-POST-ACTIVATION-FACTUAL-SYNC-001
- LINE_02: SCOPE POST_ACTIVATION_FACTUAL_SYNC
- LINE_03: OUTCOME COMMIT_CREATED
- LINE_04: CHECKS CHECK_01 CHECK_02 CHECK_03 CHECK_04 CHECK_05 CHECK_06 CHECK_07 CHECK_08
- LINE_05: NO_RUNTIME_ADMISSION_CLAIMED_TRUE

## DELIVERY_MODE
- PUSH_REQUIRED: false
- PR_REQUIRED: false
- MERGE_REQUIRED: false
- TARGET_BASE_BRANCH: main
- no push in this task
- no PR in this task
- no merge in this task

## STOP_CONDITION
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любой extra staged path → STOP.
- Любая попытка открыть runtime writes or runtime admission in this task → STOP.
- Любая попытка start execution or choose a concrete execution slice in this task → STOP.
- Любая попытка создать PR или merge → STOP.

## REPORT_FORMAT
- STATUS:
- TASK_ID:
- HEAD_SHA_BEFORE:
- HEAD_SHA_AFTER:
- COMMIT_SHA:
- CHECK_RESULTS:
- STAGED_SCOPE_MATCH:
- RUNTIME_FLAGS_STATE:
- NEXT_STEP:

## FAIL_PROTOCOL
- Любой FAIL → немедленный STOP.
- No PR in this task.
- No merge in this task.
- EXPLICIT_REMEDIATION_PATH_FOR_STOP: OPEN_ONE_NARROW_RECON_TASK_ONLY_FOR_THE_FAILED_SCOPE_WITHOUT_SCOPE_WIDENING
