TASK_ID: CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001
MILESTONE: A4
TYPE: CORE
STATUS: EXECUTION_ACTIVATION_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Открыть один отдельный current-lane Phase 02 execution-activation task artifact как текущую queue-head surface для следующего bounded write-chain. Этот task не стартует execution, не выполняет runtime writes, не открывает runtime admission, не делает mainline promotion claim и не трогает contour 03, contour 04 или contour 05.

## ENTRY_CRITERIA
- `CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json` already points queue head to `CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md`
- `CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json` already allows that queue-head task to open
- `CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json` remains authority-only and does not start execution
- runtime flags remain false across ledger, owner, prep-only and execution-admission records
- this task artifact already exists as the tracked queue-head surface and may be reconciled in place only

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md

## DENYLIST
- любые runtime surface writes
- любые изменения вне ALLOWLIST
- любые add-all patterns
- любые basename-only staging rules
- любые second-commit actions
- любые изменения `docs/OPS/STATUS/**`
- любые изменения `docs/CONTEXT.md`
- любые изменения `docs/HANDOFF.md`
- любые contour 03, contour 04 или contour 05 changes
- любые mainline promotion claims
- любые PR attempts from current branch to main
- любые изменения `src/**`
- любые изменения `scripts/**`
- любые изменения `test/**`

## CONTRACT / SHAPES
- TASK_CLASS: CURRENT_LANE_PHASE02_EXECUTION_ACTIVATION_ONLY
- AUTHORITY_RECORD_BASENAME: CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json
- QUEUE_HEAD_BASENAME: CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md
- exact allowlist only
- exact-path staging only
- create exactly one narrow commit only
- push current branch only after post-commit green
- no PR creation from current branch in this task
- no merge in this task
- this task opens the activation artifact only
- this task does not create patch, precommit, commit or outcome scaffold artifacts
- this task does not start execution
- this task does not grant runtime admission
- runtimeWritesAdmitted remains false
- runtimeAdmissionGranted remains false
- formalCutoverClaimed remains false
- broadShellAdmissionClaimed remains false
- execution-admission record remains authority-only and future-facing

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02, CHECK_03 и CHECK_04 до любых write-действий.
1) Reconcile exactly one task artifact in place only for `CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md`.
2) После записи task выполнить CHECK_05 и CHECK_06.
3) Выполнить `git add --` exact path only from ALLOWLIST.
4) Выполнить CHECK_07.
5) Создать ровно один narrow commit.
6) Выполнить CHECK_08, CHECK_09 и CHECK_10.
7) После local green разрешен push current branch only.
8) PR и merge в этом task не выполняются.

## CHECKS
CHECK_01_PRE_LANE_ANCHORS_POINT_TO_ACTIVATION_HEAD
CMD: node -e 'const fs=require("node:fs");const ledger=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));const owner=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));const prep=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","utf8"));const execj=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json","utf8"));const canon="OPEN_ONE_SEPARATE_CURRENT_LANE_PHASE02_EXECUTION_ACTIVATION_TASK_ONLY_FOR_CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001_RUNTIME_WRITES_STILL_LOCKED_NO_EXECUTION_START_IN_THIS_STEP";if(ledger.firstExecutableQueueHeadBasename!=="CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md")process.exit(1);if(ledger.currentLaneSafePatchQueue[0]?.taskBasename!=="CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md")process.exit(1);if(owner.queueHeadTaskBasename!=="CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md")process.exit(1);if(owner.queueHeadTaskMayOpen!==true)process.exit(1);if(prep.nextStep!==canon)process.exit(1);if(execj.taskBasename!=="CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md")process.exit(1);if(execj.nextStep!==canon)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_RUNTIME_FALSE_AND_NO_EXECUTION_START
CMD: node -e 'const fs=require("node:fs");const files=["docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json"];for(const f of files){const j=JSON.parse(fs.readFileSync(f,"utf8"));if(j.runtimeWritesAdmitted!==false||j.runtimeAdmissionGranted!==false||j.formalCutoverClaimed!==false||j.broadShellAdmissionClaimed!==false)process.exit(1);}const execj=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json","utf8"));if(execj.phase02ExecutionStarted!==false||execj.phase02ExecutionAttempted!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_03_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.prestatus && echo OK
PASS: OUT == OK

CHECK_04_PRE_CAPTURE_HEAD_BASELINE
CMD: git rev-parse HEAD > /tmp/CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.head && test ! -e docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md && echo OK
PASS: OUT == OK

CHECK_05_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));const baselinePath="/tmp/CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.prestatus";if(!fs.existsSync(baselinePath))process.exit(1);const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p))process.exit(1);}process.exit(0);' docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md
PASS: exit 0

CHECK_06_POST_TASK_STAYS_ACTIVATION_ONLY_AND_RUNTIME_FALSE
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md","utf8");const req=["STATUS: EXECUTION_ACTIVATION_ONLY_RUNTIME_WRITES_NOT_ADMITTED","this task does not start execution","this task does not grant runtime admission","no PR creation from current branch in this task","push current branch only after post-commit green"];for(const r of req){if(!t.includes(r))process.exit(1);}const execj=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json","utf8"));if(execj.phase02ExecutionStarted!==false||execj.runtimeWritesAdmitted!==false||execj.runtimeAdmissionGranted!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_07_POST_STAGED_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git diff --cached --name-only",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md
PASS: exit 0

CHECK_08_POST_HEAD_MOVED_BY_EXACTLY_ONE_COMMIT
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const before=fs.readFileSync("/tmp/CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.head","utf8").trim();const after=execSync("git rev-parse HEAD",{encoding:"utf8"}).trim();if(!before||!after||before===after)process.exit(1);const count=execSync(`git rev-list --count ${before}..${after}`,{encoding:"utf8"}).trim();if(count!=="1")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_09_POST_LAST_COMMIT_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git show --pretty=format: --name-only HEAD",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md
PASS: exit 0

CHECK_10_POST_RUNTIME_FALSE_AND_REMOTE_DELIVERY_MODE_SAFE
CMD: node -e 'const fs=require("node:fs");const files=["docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json"];for(const f of files){const j=JSON.parse(fs.readFileSync(f,"utf8"));if(j.runtimeWritesAdmitted!==false||j.runtimeAdmissionGranted!==false||j.formalCutoverClaimed!==false||j.broadShellAdmissionClaimed!==false)process.exit(1);}const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md","utf8");if(!t.includes("PR and merge remain out of scope on the current branch because narrow-diff discipline is not satisfied against main."))process.exit(1);process.exit(0);'
PASS: exit 0

## COMMIT_MESSAGE_TEMPLATE
- LINE_01: CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001
- LINE_02: SCOPE CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001
- LINE_03: OUTCOME COMMIT_CREATED
- LINE_04: CHECKS CHECK_01 CHECK_02 CHECK_03 CHECK_04 CHECK_05 CHECK_06 CHECK_07
- LINE_05: NO_RUNTIME_ADMISSION_CLAIMED_TRUE

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: false
- MERGE_REQUIRED: false
- TARGET_BASE_BRANCH: main
- current branch may be pushed only after post-commit green
- PR and merge remain out of scope on the current branch because narrow-diff discipline is not satisfied against main.

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любой extra staged path → STOP.
- Любая попытка открыть runtime writes or start execution in this task → STOP.
- Любая попытка создать PR from current branch to main in this task → STOP.

## REPORT_FORMAT
- STATUS:
- TASK_ID:
- HEAD_SHA_BEFORE:
- HEAD_SHA_AFTER:
- COMMIT_SHA:
- CHECK_RESULTS:
- STAGED_SCOPE_MATCH:
- RUNTIME_FLAGS_STATE:
- PUSH_RESULT:
- PR_RESULT:
- MERGE_RESULT:
- NEXT_STEP:

## FAIL_PROTOCOL
- Любой FAIL → немедленный STOP.
- Capture exact stderr for push failure.
- No PR creation from current branch in this task.
- No merge in this task.
- EXPLICIT_REMEDIATION_PATH_FOR_STOP_06: OPEN_ONE_NARROW_RECON_TASK_ONLY_FOR_THE_FAILED_SCOPE_WITHOUT_SCOPE_WIDENING
