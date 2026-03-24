TASK_ID: CORE-A4-YALKEN-PHASE02-NEXT-QUEUE-HEAD-DECISION-001
MILESTONE: A4
TYPE: CORE
STATUS: NARROW_QUEUE_HEAD_DECISION_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Зафиксировать один отдельный current-lane decision после prep-only closure: следующим queue head становится `CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md`, а не `CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-001.md`. Этот task не стартует execution, не открывает runtime writes, не делает mainline promotion claim и не трогает contour 03, 04 или 05.

## ENTRY_CRITERIA
- `CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json` already carries `outcomeType: COMMIT_CREATED`
- `CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json` remains future authority only
- runtime flags remain false across ledger, owner, prep-only and execution-admission records
- staged set is empty before staging exact allowlist

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-PHASE02-NEXT-QUEUE-HEAD-DECISION-001.md
- docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json
- docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json
- docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json
- docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json
- docs/CONTEXT.md
- docs/HANDOFF.md

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-NEXT-QUEUE-HEAD-DECISION-001.md
- docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json
- docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json
- docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json
- docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json
- docs/CONTEXT.md
- docs/HANDOFF.md

## DENYLIST
- любые runtime surface writes
- любые изменения вне ALLOWLIST
- любые add-all patterns
- любые second-commit actions
- любые contour 03, contour 04 или contour 05 admission changes
- любые mainline promotion claims
- любые изменения `src/**`
- любые изменения `scripts/**`
- любые изменения `test/**`

## CONTRACT / SHAPES
- TASK_CLASS: CURRENT_LANE_NEXT_QUEUE_HEAD_DECISION
- NEXT_QUEUE_HEAD_BASENAME: CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md
- AUTHORITY_RECORD_BASENAME: CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json
- exact allowlist only
- exact-path staging only
- create exactly one narrow commit only
- execution-admission remains future authority only
- runtimeWritesAdmitted remains false
- runtimeAdmissionGranted remains false
- formalCutoverClaimed remains false
- broadShellAdmissionClaimed remains false
- this task does not create the execution-activation task itself

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02, CHECK_03 и CHECK_04 до staging.
1) Захватить pre-status baseline and head baseline.
2) Прописать `CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md` как единый next queue head across ledger, owner, prep-only record, execution-admission record, `CONTEXT.md` and `HANDOFF.md`.
3) Сохранить execution-admission record как future authority only and keep runtime flags false.
4) Выполнить CHECK_05, CHECK_06 и CHECK_07 before staging.
5) Выполнить `git add --` exact paths only from ALLOWLIST.
6) Выполнить CHECK_08.
7) Создать ровно один narrow commit.
8) Выполнить CHECK_09, CHECK_10 и CHECK_11.
9) После local green разрешен push current branch only; PR and merge are out of scope for this task because narrow-diff rule is not satisfied on the current branch.

## CHECKS
CHECK_01_PRE_PREP_CLOSURE_AND_EXECUTION_ADMISSION_FUTURE_AUTHORITY
CMD: node -e 'const fs=require("node:fs");const prep=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","utf8"));const execj=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json","utf8"));if(prep.outcomeType!=="COMMIT_CREATED")process.exit(1);if(prep.commitSha!=="79c88d23d0387928058ddeb1195fad115e594ee1")process.exit(1);if(execj.phase02ExecutionAdmitted!==true)process.exit(1);if(execj.phase02ExecutionStarted!==false)process.exit(1);if(execj.runtimeWritesAdmitted!==false||execj.runtimeAdmissionGranted!==false||execj.formalCutoverClaimed!==false||execj.broadShellAdmissionClaimed!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-PHASE02-NEXT-QUEUE-HEAD-DECISION-001.prestatus && echo OK
PASS: OUT == OK

CHECK_03_PRE_CAPTURE_HEAD_BASELINE
CMD: git rev-parse HEAD > /tmp/CORE-A4-YALKEN-PHASE02-NEXT-QUEUE-HEAD-DECISION-001.head && echo OK
PASS: OUT == OK

CHECK_04_PRE_STAGED_SET_EMPTY
CMD: test -z "$(git diff --cached --name-only)" && echo OK
PASS: OUT == OK

CHECK_05_POST_LEDGER_OWNER_ALIGN_TO_NEW_ACTIVATION_HEAD
CMD: node -e 'const fs=require("node:fs");const ledger=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));const owner=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));if(ledger.firstExecutableQueueHeadBasename!=="CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md")process.exit(1);if(!Array.isArray(ledger.currentLaneSafePatchQueue))process.exit(1);if(ledger.currentLaneSafePatchQueue[0]?.taskBasename!=="CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md")process.exit(1);if(ledger.currentLaneSafePatchQueue[0]?.terminalRecordBasename!=="CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json")process.exit(1);if(owner.queueHeadTaskBasename!=="CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md")process.exit(1);if(owner.queueHeadTaskMayOpen!==true)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_06_POST_NEXTSTEP_TEXT_IDENTICAL_ACROSS_RECORDS
CMD: node -e 'const fs=require("node:fs");const canon="OPEN_ONE_SEPARATE_CURRENT_LANE_PHASE02_EXECUTION_ACTIVATION_TASK_ONLY_FOR_CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001_RUNTIME_WRITES_STILL_LOCKED_NO_EXECUTION_START_IN_THIS_STEP";const ledger=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));const owner=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));const prep=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","utf8"));const execj=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json","utf8"));if(ledger.nextStep!==canon)process.exit(1);if(owner.nextStep!==canon)process.exit(1);if(prep.nextStep!==canon)process.exit(1);if(execj.nextStep!==canon)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_07_POST_EXECUTION_ADMISSION_STAYS_FUTURE_AUTHORITY_AND_RUNTIME_FALSE
CMD: node -e 'const fs=require("node:fs");const prep=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","utf8"));const execj=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json","utf8"));if(prep.runtimeWritesAdmitted!==false||prep.runtimeAdmissionGranted!==false||prep.formalCutoverClaimed!==false||prep.broadShellAdmissionClaimed!==false)process.exit(1);if(execj.phase02ExecutionAdmitted!==true)process.exit(1);if(execj.phase02ExecutionStarted!==false||execj.phase02ExecutionAttempted!==false)process.exit(1);if(execj.runtimeWritesPerformed!==false||execj.runtimeWritesAdmitted!==false||execj.runtimeAdmissionGranted!==false||execj.formalCutoverClaimed!==false||execj.broadShellAdmissionClaimed!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_08_POST_STAGED_SCOPE_EQUALS_EXACT_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git diff --cached --name-only",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-PHASE02-NEXT-QUEUE-HEAD-DECISION-001.md docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json docs/CONTEXT.md docs/HANDOFF.md
PASS: exit 0

CHECK_09_POST_HEAD_MOVED_BY_EXACTLY_ONE_COMMIT
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const before=fs.readFileSync("/tmp/CORE-A4-YALKEN-PHASE02-NEXT-QUEUE-HEAD-DECISION-001.head","utf8").trim();const after=execSync("git rev-parse HEAD",{encoding:"utf8"}).trim();if(!before||!after||before===after)process.exit(1);const count=execSync(`git rev-list --count ${before}..${after}`,{encoding:"utf8"}).trim();if(count!=="1")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_10_POST_LAST_COMMIT_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git show --pretty=format: --name-only HEAD",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-PHASE02-NEXT-QUEUE-HEAD-DECISION-001.md docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json docs/CONTEXT.md docs/HANDOFF.md
PASS: exit 0

CHECK_11_POST_NO_SCOPE_DRIFT_AND_RUNTIME_FLAGS_STILL_FALSE
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const baselinePath="/tmp/CORE-A4-YALKEN-PHASE02-NEXT-QUEUE-HEAD-DECISION-001.prestatus";if(!fs.existsSync(baselinePath))process.exit(1);const allow=new Set(process.argv.slice(1));const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p))process.exit(1);}const files=[\"docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json\",\"docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json\",\"docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json\",\"docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json\"];for(const f of files){const j=JSON.parse(fs.readFileSync(f,\"utf8\"));if(j.runtimeWritesAdmitted!==false||j.runtimeAdmissionGranted!==false||j.formalCutoverClaimed!==false||j.broadShellAdmissionClaimed!==false)process.exit(1);}process.exit(0);' docs/tasks/CORE-A4-YALKEN-PHASE02-NEXT-QUEUE-HEAD-DECISION-001.md docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json docs/CONTEXT.md docs/HANDOFF.md
PASS: exit 0

## COMMIT_MESSAGE_TEMPLATE
- LINE_01: CORE-A4-YALKEN-PHASE02-NEXT-QUEUE-HEAD-DECISION-001
- LINE_02: SCOPE CORE-A4-YALKEN-PHASE02-NEXT-QUEUE-HEAD-DECISION-001 CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1 CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1 CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1 CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1 CONTEXT HANDOFF
- LINE_03: OUTCOME COMMIT_CREATED
- LINE_04: CHECKS CHECK_01 CHECK_02 CHECK_03 CHECK_04 CHECK_05 CHECK_06 CHECK_07 CHECK_08
- LINE_05: NO_RUNTIME_ADMISSION_CLAIMED_TRUE

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любой extra staged path → STOP.
- Любой PR attempt from current branch → STOP.
- Любая попытка открыть runtime writes or start execution in this task → STOP.

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
