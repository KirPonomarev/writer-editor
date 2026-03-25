TASK_ID: CORE-A4-YALKEN-V6_1-SYMBOLIC-CLOSE-001
MILESTONE: V6_1_CLOSEOUT
TYPE: DOCS_ONLY_WRITE_TASK
STATUS: V6_1_SYMBOLIC_CLOSE_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: V6_2

## MICRO_GOAL
Зафиксировать V6_1 как исторически закрытый supervisory baseline и записать, что дальнейшее сопровождение идет через V6_2 sequential rollout, не меняя active canon, current-lane authority, runtime flags или parked-state для contour 03, contour 04 и contour 05.

## ENTRY_CRITERIA
- PR 347 already merged successfully
- current branch head remains `325f15d7a5fbd4549b7ba8925edf8b64c7afc124`
- runtime flags remain false across current-lane authority records
- contour 03, contour 04 and contour 05 remain parked
- staged set is empty before exact-path staging

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-V6_1-SYMBOLIC-CLOSE-001.md
- docs/OPS/STATUS/YALKEN_V6_1_SYMBOLIC_CLOSE_RECORD_V1.json

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-V6_1-SYMBOLIC-CLOSE-001.md
- docs/OPS/STATUS/YALKEN_V6_1_SYMBOLIC_CLOSE_RECORD_V1.json

## DENYLIST
- любые изменения вне ALLOWLIST
- любые add-all patterns
- любые basename-only staging rules
- любые second-commit actions
- любые изменения current-lane authority records
- любые изменения `docs/CONTEXT.md`
- любые изменения `docs/HANDOFF.md`
- любые изменения `docs/PROCESS.md`
- любые contour 03, contour 04 или contour 05 changes
- любые runtime surface writes
- любые mainline promotion claims
- любые PR or merge actions in this task
- любые изменения `src/**`
- любые изменения `scripts/**`
- любые изменения `test/**`

## CONTRACT / SHAPES
- TASK_CLASS: SYMBOLIC_BASELINE_CLOSEOUT_ONLY
- CLOSED_BASELINE_LABEL: YALKEN_EXECUTION_BASELINE_V6_1_REPO_LOCAL_FINAL
- REPLACEMENT_BASELINE_LABEL: YALKEN_EXECUTION_BASELINE_V6_2_SEQUENTIAL_ROLLOUT_AND_SYMBOLIC_CLOSE
- ACTIVE_CONTEXT: BRANCH_LOCAL_CONTEXT
- ACTIVE_QUEUE_HEAD_BASENAME: CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md
- exact allowlist only
- exact-path staging only
- create exactly one narrow commit only
- push current branch only after post-commit green
- no PR in this task
- no merge in this task
- runtimeWritesAdmitted remains false
- runtimeAdmissionGranted remains false
- formalCutoverClaimed remains false
- broadShellAdmissionClaimed remains false
- contour 03, contour 04 and contour 05 remain parked

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02, CHECK_03 и CHECK_04 до write-действий.
1) Создать task artifact only for `CORE-A4-YALKEN-V6_1-SYMBOLIC-CLOSE-001.md`.
2) Создать один status record only for `YALKEN_V6_1_SYMBOLIC_CLOSE_RECORD_V1.json`.
3) Выполнить CHECK_05, CHECK_06 и CHECK_07 before staging.
4) Выполнить `git add --` exact paths only from ALLOWLIST.
5) Выполнить CHECK_08.
6) Создать ровно один narrow commit.
7) Выполнить CHECK_09, CHECK_10 и CHECK_11.
8) После local green разрешен push current branch only.
9) PR и merge в этом task не выполняются.

## CHECKS
CHECK_01_PRE_PR_347_MERGED
CMD: gh pr view 347 --json state,mergeCommit | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(j.state!=="MERGED")process.exit(1);if(!j.mergeCommit||j.mergeCommit.oid!=="03863ec1b5fc94046a0ebf2b568c55361348e4f5")process.exit(1);process.exit(0);});'
PASS: exit 0

CHECK_02_PRE_RUNTIME_FLAGS_FALSE
CMD: node -e 'const fs=require("node:fs");const files=["docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json"];for(const f of files){const j=JSON.parse(fs.readFileSync(f,"utf8"));if(j.runtimeWritesAdmitted!==false||j.runtimeAdmissionGranted!==false||j.formalCutoverClaimed!==false||j.broadShellAdmissionClaimed!==false)process.exit(1);}process.exit(0);'
PASS: exit 0

CHECK_03_PRE_CONTOUR_PARKED
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json","utf8"));if(j.contour03PrepOnlyAllowed!==false||j.contour04Admitted!==false||j.contour05Admitted!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_04_PRE_CAPTURE_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-V6_1-SYMBOLIC-CLOSE-001.prestatus && git rev-parse HEAD > /tmp/CORE-A4-YALKEN-V6_1-SYMBOLIC-CLOSE-001.head && test -z "$(git diff --cached --name-only)" && echo OK
PASS: OUT == OK

CHECK_05_POST_TASK_AND_RECORD_PRESENT
CMD: test -f docs/tasks/CORE-A4-YALKEN-V6_1-SYMBOLIC-CLOSE-001.md && test -f docs/OPS/STATUS/YALKEN_V6_1_SYMBOLIC_CLOSE_RECORD_V1.json && echo OK
PASS: OUT == OK

CHECK_06_POST_RECORD_SHAPE_AND_RUNTIME_FALSE
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/YALKEN_V6_1_SYMBOLIC_CLOSE_RECORD_V1.json","utf8"));if(j.closedBaselineLabel!=="YALKEN_EXECUTION_BASELINE_V6_1_REPO_LOCAL_FINAL")process.exit(1);if(j.replacementBaselineLabel!=="YALKEN_EXECUTION_BASELINE_V6_2_SEQUENTIAL_ROLLOUT_AND_SYMBOLIC_CLOSE")process.exit(1);if(j.activeContext!=="BRANCH_LOCAL_CONTEXT")process.exit(1);if(j.activeQueueHeadBasename!=="CORE-A4-YALKEN-PHASE02-EXECUTION-ACTIVATION-001.md")process.exit(1);if(j.runtimeWritesAdmitted!==false||j.runtimeAdmissionGranted!==false||j.formalCutoverClaimed!==false||j.broadShellAdmissionClaimed!==false)process.exit(1);if(j.contour03to05State!=="PARKED")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_07_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));const parse=(txt)=>{if(!txt.trimEnd())return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync("/tmp/CORE-A4-YALKEN-V6_1-SYMBOLIC-CLOSE-001.prestatus","utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p))continue;if(!allow.has(p))process.exit(1);}process.exit(0);' docs/tasks/CORE-A4-YALKEN-V6_1-SYMBOLIC-CLOSE-001.md docs/OPS/STATUS/YALKEN_V6_1_SYMBOLIC_CLOSE_RECORD_V1.json
PASS: exit 0

CHECK_08_POST_STAGED_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git diff --cached --name-only",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-V6_1-SYMBOLIC-CLOSE-001.md docs/OPS/STATUS/YALKEN_V6_1_SYMBOLIC_CLOSE_RECORD_V1.json
PASS: exit 0

CHECK_09_POST_HEAD_MOVED_BY_EXACTLY_ONE_COMMIT
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const before=fs.readFileSync("/tmp/CORE-A4-YALKEN-V6_1-SYMBOLIC-CLOSE-001.head","utf8").trim();const after=execSync("git rev-parse HEAD",{encoding:"utf8"}).trim();if(!before||!after||before===after)process.exit(1);const count=execSync(`git rev-list --count ${before}..${after}`,{encoding:"utf8"}).trim();if(count!=="1")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_10_POST_LAST_COMMIT_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git show --pretty=format: --name-only HEAD",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-V6_1-SYMBOLIC-CLOSE-001.md docs/OPS/STATUS/YALKEN_V6_1_SYMBOLIC_CLOSE_RECORD_V1.json
PASS: exit 0

CHECK_11_POST_RUNTIME_FLAGS_AND_CONTOUR_PARKED_UNCHANGED
CMD: node -e 'const fs=require("node:fs");const laneFiles=["docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json"];for(const f of laneFiles){const j=JSON.parse(fs.readFileSync(f,"utf8"));if(j.runtimeWritesAdmitted!==false||j.runtimeAdmissionGranted!==false||j.formalCutoverClaimed!==false||j.broadShellAdmissionClaimed!==false)process.exit(1);}const contour=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json","utf8"));if(contour.contour03PrepOnlyAllowed!==false||contour.contour04Admitted!==false||contour.contour05Admitted!==false)process.exit(1);process.exit(0);'
PASS: exit 0

## COMMIT_MESSAGE_TEMPLATE
- LINE_01: CORE-A4-YALKEN-V6_1-SYMBOLIC-CLOSE-001
- LINE_02: SCOPE CORE-A4-YALKEN-V6_1-SYMBOLIC-CLOSE-001 YALKEN_V6_1_SYMBOLIC_CLOSE_RECORD_V1
- LINE_03: OUTCOME COMMIT_CREATED
- LINE_04: CHECKS CHECK_01 CHECK_02 CHECK_03 CHECK_04 CHECK_05 CHECK_06 CHECK_07 CHECK_08
- LINE_05: NO_RUNTIME_ADMISSION_CLAIMED_TRUE

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: false
- MERGE_REQUIRED: false
- TARGET_BASE_BRANCH: main
- current branch may be pushed only after post-commit green
- PR and merge remain out of scope for this task

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любой extra staged path → STOP.
- Любая попытка открыть runtime writes → STOP.
- Любая попытка reopen contour 03, contour 04 или contour 05 → STOP.
- Любая попытка открыть второй task в этом run → STOP.

## REPORT_FORMAT
- STATUS:
- TASK_ID:
- HEAD_SHA_BEFORE:
- HEAD_SHA_AFTER:
- COMMIT_SHA:
- TASK_OUTCOME:
- CHANGED_BASENAMES:
- CHECK_RESULTS:
- RUNTIME_FLAGS_STATE:
- PUSH_RESULT:
- PR_RESULT:
- PR_NUMBER:
- PR_STATE:
- MERGE_RESULT:
- MERGE_COMMIT_SHA:
- NEXT_STEP:

## FAIL_PROTOCOL
- Любой FAIL → немедленный STOP.
- Capture exact stderr for push failure.
- No PR in this task.
- No merge in this task.
- EXPLICIT_REMEDIATION_PATH_FOR_STOP_06: STOP_IMMEDIATELY_CAPTURE_DIFF_CAPTURE_FAILED_CHECK_DECLARE_ROOT_CAUSE_PROPOSE_ONE_NARROW_FIX_TASK_NO_ADDITIONAL_WRITES
