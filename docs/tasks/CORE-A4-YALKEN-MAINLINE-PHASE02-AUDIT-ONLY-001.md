TASK_ID: CORE-A4-YALKEN-MAINLINE-PHASE02-AUDIT-ONLY-001
MILESTONE: A4
TYPE: CORE
STATUS: AUDIT_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Сохранить на clean mainline-safe branch только узкий audit trail о branch-local Phase 02 sequence без переноса branch-local factual surfaces в mainline factual truth. Этот task не меняет `CONTEXT.md`, `HANDOFF.md`, `PROCESS.md` или current-lane Phase 02 records, не открывает runtime writes, runtime admission, formal cutover или broad shell admission.

## ENTRY_CRITERIA
- `CORE-A4-YALKEN-MAINLINE-SAFE-ALLOWLIST-DECISION-001.md` already locks the exact allowlist for this task
- mainline factual docs already preserve repo-wide done wording
- current-lane Phase 02 status records remain absent on this clean branch
- staged set is empty before staging

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-MAINLINE-PHASE02-AUDIT-ONLY-001.md
- docs/OPS/STATUS/BRANCH_LOCAL_PHASE02_AUDIT_ONLY_RECORD_V1.json

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-MAINLINE-PHASE02-AUDIT-ONLY-001.md
- docs/OPS/STATUS/BRANCH_LOCAL_PHASE02_AUDIT_ONLY_RECORD_V1.json

## DENYLIST
- любые изменения `docs/CONTEXT.md`
- любые изменения `docs/HANDOFF.md`
- любые изменения `docs/PROCESS.md`
- любые изменения `CANON.md`
- любые изменения `docs/BIBLE.md`
- любые изменения `docs/corex/**`
- любые изменения `docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json`
- любые изменения `docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json`
- любые изменения `docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json`
- любые изменения `docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json`
- любые изменения existing mainline factual docs
- любые runtime surface writes
- любые add-all patterns
- любые PR edits outside standard PR metadata
- любые merge actions before required checks are green

## CONTRACT / SHAPES
- TASK_CLASS: MAINLINE_COMPATIBLE_PHASE02_AUDIT_ONLY
- RECORD_BASENAME: BRANCH_LOCAL_PHASE02_AUDIT_ONLY_RECORD_V1.json
- preserve mainline repo-wide-done factual wording unchanged
- preserve runtimeWritesAdmitted false
- preserve runtimeAdmissionGranted false
- preserve formalCutoverClaimed false
- preserve broadShellAdmissionClaimed false
- treat branch-local Phase 02 sequence as historical audit only
- do not promote branch-local current-lane Phase 02 state into mainline factual truth
- do not touch `CONTEXT.md`, `HANDOFF.md` or current-lane records on mainline path

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02, CHECK_03 и CHECK_04 до staging.
1) Создать один audit-only task artifact и один audit-only record.
2) Выполнить CHECK_05, CHECK_06 и CHECK_07.
3) Выполнить `git add --` exact paths only from ALLOWLIST.
4) Выполнить CHECK_08.
5) Создать ровно один narrow commit.
6) Выполнить CHECK_09, CHECK_10 и CHECK_11.
7) Если local green, push branch.
8) Если push green, create PR to main.
9) Merge only if required checks green.

## CHECKS
CHECK_01_PRE_MAINLINE_FACTUAL_DOCS_REMAIN_REPO_WIDE_DONE
CMD: node -e 'const fs=require("node:fs");const context=fs.readFileSync("docs/CONTEXT.md","utf8");const handoff=fs.readFileSync("docs/HANDOFF.md","utf8");if(!context.includes("Repo-wide done подтверждён на main после merge gate и post-merge reconfirm."))process.exit(1);if(!handoff.includes("Repo-wide done is confirmed on main after merge gate and post-merge reconfirm."))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_CURRENT_LANE_PHASE02_RECORDS_ABSENT
CMD: test ! -e docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json && test ! -e docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json && test ! -e docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json && test ! -e docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json && echo OK
PASS: OUT == OK

CHECK_03_PRE_OWNER_DECISION_TASK_PRESENT
CMD: test -f docs/tasks/CORE-A4-YALKEN-MAINLINE-SAFE-ALLOWLIST-DECISION-001.md && echo OK
PASS: OUT == OK

CHECK_04_PRE_CAPTURE_BASELINES_AND_STAGED_EMPTY
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-MAINLINE-PHASE02-AUDIT-ONLY-001.prestatus && git rev-parse HEAD > /tmp/CORE-A4-YALKEN-MAINLINE-PHASE02-AUDIT-ONLY-001.head && test -z "$(git diff --cached --name-only)" && echo OK
PASS: OUT == OK

CHECK_05_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));const baselinePath="/tmp/CORE-A4-YALKEN-MAINLINE-PHASE02-AUDIT-ONLY-001.prestatus";if(!fs.existsSync(baselinePath))process.exit(1);const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p))process.exit(1);}process.exit(0);' docs/tasks/CORE-A4-YALKEN-MAINLINE-PHASE02-AUDIT-ONLY-001.md docs/OPS/STATUS/BRANCH_LOCAL_PHASE02_AUDIT_ONLY_RECORD_V1.json
PASS: exit 0

CHECK_06_POST_RECORD_RUNTIME_FLAGS_FALSE
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/BRANCH_LOCAL_PHASE02_AUDIT_ONLY_RECORD_V1.json","utf8"));if(j.runtimeWritesAdmitted!==false||j.runtimeAdmissionGranted!==false||j.formalCutoverClaimed!==false||j.broadShellAdmissionClaimed!==false)process.exit(1);if(j.mainlineFactualDocsChanged!==false)process.exit(1);if(j.promotionDecision!=="NOT_PROMOTED_TO_MAINLINE_FACTUAL_SURFACES")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_07_POST_NO_MAINLINE_FACTUAL_REWRITE
CMD: node -e 'const fs=require("node:fs");const context=fs.readFileSync("docs/CONTEXT.md","utf8");const handoff=fs.readFileSync("docs/HANDOFF.md","utf8");if(!context.includes("Repo-wide done подтверждён на main после merge gate и post-merge reconfirm."))process.exit(1);if(!handoff.includes("Repo-wide done is confirmed on main after merge gate and post-merge reconfirm."))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_08_POST_STAGED_SCOPE_EQUALS_EXACT_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git diff --cached --name-only",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-MAINLINE-PHASE02-AUDIT-ONLY-001.md docs/OPS/STATUS/BRANCH_LOCAL_PHASE02_AUDIT_ONLY_RECORD_V1.json
PASS: exit 0

CHECK_09_POST_HEAD_MOVED_BY_EXACTLY_ONE_COMMIT
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const before=fs.readFileSync("/tmp/CORE-A4-YALKEN-MAINLINE-PHASE02-AUDIT-ONLY-001.head","utf8").trim();const after=execSync("git rev-parse HEAD",{encoding:"utf8"}).trim();if(!before||!after||before===after)process.exit(1);const count=execSync(`git rev-list --count ${before}..${after}`,{encoding:"utf8"}).trim();if(count!=="1")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_10_POST_LAST_COMMIT_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git show --pretty=format: --name-only HEAD",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-MAINLINE-PHASE02-AUDIT-ONLY-001.md docs/OPS/STATUS/BRANCH_LOCAL_PHASE02_AUDIT_ONLY_RECORD_V1.json
PASS: exit 0

CHECK_11_POST_MAINLINE_FACTUAL_DOCS_STILL_UNCHANGED
CMD: node -e 'const fs=require("node:fs");const context=fs.readFileSync("docs/CONTEXT.md","utf8");const handoff=fs.readFileSync("docs/HANDOFF.md","utf8");if(!context.includes("Repo-wide done подтверждён на main после merge gate и post-merge reconfirm."))process.exit(1);if(!handoff.includes("Repo-wide done is confirmed on main after merge gate and post-merge reconfirm."))process.exit(1);process.exit(0);'
PASS: exit 0

## COMMIT_MESSAGE_TEMPLATE
- LINE_01: CORE-A4-YALKEN-MAINLINE-PHASE02-AUDIT-ONLY-001
- LINE_02: SCOPE CORE-A4-YALKEN-MAINLINE-PHASE02-AUDIT-ONLY-001 BRANCH_LOCAL_PHASE02_AUDIT_ONLY_RECORD_V1
- LINE_03: OUTCOME COMMIT_CREATED
- LINE_04: CHECKS CHECK_01 CHECK_02 CHECK_03 CHECK_04 CHECK_05 CHECK_06 CHECK_07 CHECK_08
- LINE_05: NO_RUNTIME_ADMISSION_CLAIMED_TRUE

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true
- TARGET_BASE_BRANCH: main

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая попытка менять `CONTEXT.md`, `HANDOFF.md` или current-lane Phase 02 records → STOP.
- Любая попытка продвинуть branch-local Phase 02 narrative в mainline factual truth → STOP.
- Любой delivery failure → STOP с exact stderr.

## REPORT_FORMAT
- STATUS:
- HEAD_BEFORE:
- HEAD_AFTER:
- COMMIT_SHA:
- CHANGED_BASENAMES:
- CHECK_RESULTS:
- PUSH_RESULT:
- PR_RESULT:
- MERGE_RESULT:
- NEXT_STEP:

## FAIL_PROTOCOL
- Любой FAIL → немедленный STOP.
- Capture exact stderr for push failure.
- Capture exact stderr for PR create failure.
- Stop if required checks are not green.
