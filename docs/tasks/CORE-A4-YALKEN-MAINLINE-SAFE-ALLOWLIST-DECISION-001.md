TASK_ID: CORE-A4-YALKEN-MAINLINE-SAFE-ALLOWLIST-DECISION-001
MILESTONE: A4
TYPE: CORE
STATUS: OWNER_DECISION_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Зафиксировать один mainline-safe owner decision only: следующий допустимый Phase 02 related mainline step может быть только reframed audit-only patch с exact allowlist из двух новых artifacts, без правок `CONTEXT.md`, `HANDOFF.md` и без переноса branch-local current-lane factual narrative на main. Этот task не создает audit record, не создает PR, не делает merge и не открывает runtime admission.

## ENTRY_CRITERIA
- mainline factual docs already preserve repo-wide done wording
- branch-local current-lane records do not exist on main and must not be introduced by direct port
- clean branch starts from latest `origin/main`
- staged set is empty before staging

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-MAINLINE-SAFE-ALLOWLIST-DECISION-001.md

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-MAINLINE-SAFE-ALLOWLIST-DECISION-001.md

## DENYLIST
- любые изменения `docs/CONTEXT.md`
- любые изменения `docs/HANDOFF.md`
- любые изменения `CANON.md`
- любые изменения `docs/BIBLE.md`
- любые изменения `docs/corex/**`
- любые изменения `docs/PROCESS.md`
- любые изменения `docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json`
- любые изменения `docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json`
- любые изменения `docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json`
- любые изменения `docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json`
- любые новые mainline factual rewrites
- любые runtime surface writes
- любые add-all patterns
- любые PR create actions
- любые merge actions

## CONTRACT / SHAPES
- TASK_CLASS: MAINLINE_SAFE_ALLOWLIST_DECISION_ONLY
- NEXT_TASK_BASENAME: CORE-A4-YALKEN-MAINLINE-PHASE02-AUDIT-ONLY-001.md
- NEXT_RECORD_BASENAME: BRANCH_LOCAL_PHASE02_AUDIT_ONLY_RECORD_V1.json
- next-task exact allowlist must contain only the two basenames above
- `CONTEXT.md` and `HANDOFF.md` stay untouched on main
- current-lane status records stay absent or untouched on main
- direct rebase and direct cherry-pick of branch-local Phase 02 commits remain forbidden
- runtimeWritesAdmitted remains false
- runtimeAdmissionGranted remains false
- formalCutoverClaimed remains false
- broadShellAdmissionClaimed remains false
- this task creates one owner-decision artifact only

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02 и CHECK_03 до любых write-действий.
1) Зафиксировать exact allowlist for the next reframed audit-only task.
2) Зафиксировать, что mainline factual truth and current-lane records remain untouched on main.
3) Выполнить CHECK_04 и CHECK_05.
4) Выполнить `git add --` exact path only from ALLOWLIST.
5) Выполнить CHECK_06.
6) Создать ровно один narrow commit.
7) Выполнить CHECK_07, CHECK_08 и CHECK_09.
8) Push branch only; PR and merge stay out of scope for this run.

## CHECKS
CHECK_01_PRE_MAINLINE_FACTUAL_DOCS_REMAIN_REPO_WIDE_DONE
CMD: node -e 'const fs=require("node:fs");const context=fs.readFileSync("docs/CONTEXT.md","utf8");const handoff=fs.readFileSync("docs/HANDOFF.md","utf8");if(!context.includes("Repo-wide done подтверждён на main после merge gate и post-merge reconfirm."))process.exit(1);if(!handoff.includes("Repo-wide done is confirmed on main after merge gate and post-merge reconfirm."))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_CURRENT_LANE_RECORDS_ABSENT_ON_MAIN
CMD: test ! -e docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json && test ! -e docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json && test ! -e docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json && test ! -e docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json && echo OK
PASS: OUT == OK

CHECK_03_PRE_CAPTURE_BASELINES_AND_STAGED_EMPTY
CMD: test -z "$(git diff --cached --name-only)" && test "$(git rev-parse HEAD)" = "1ea48f5d870edd39cada91b7b48c8a836a9f9c2c" && echo OK
PASS: OUT == OK

CHECK_04_POST_TASK_LOCKS_EXACT_ALLOWLIST_AND_MAINLINE_GUARD
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-MAINLINE-SAFE-ALLOWLIST-DECISION-001.md","utf8");const req=["NEXT_TASK_BASENAME: CORE-A4-YALKEN-MAINLINE-PHASE02-AUDIT-ONLY-001.md","NEXT_RECORD_BASENAME: BRANCH_LOCAL_PHASE02_AUDIT_ONLY_RECORD_V1.json","CONTEXT.md and HANDOFF.md stay untouched on main","current-lane status records stay absent or untouched on main","direct rebase and direct cherry-pick of branch-local Phase 02 commits remain forbidden"];for(const r of req){if(!t.includes(r))process.exit(1);}process.exit(0);'
PASS: exit 0

CHECK_05_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));const baselinePath="/tmp/CORE-A4-YALKEN-MAINLINE-SAFE-ALLOWLIST-DECISION-001.prestatus";if(!fs.existsSync(baselinePath))process.exit(1);const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p))process.exit(1);}process.exit(0);' docs/tasks/CORE-A4-YALKEN-MAINLINE-SAFE-ALLOWLIST-DECISION-001.md
PASS: exit 0

CHECK_06_POST_STAGED_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git diff --cached --name-only",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-MAINLINE-SAFE-ALLOWLIST-DECISION-001.md
PASS: exit 0

CHECK_07_POST_HEAD_MOVED_BY_EXACTLY_ONE_COMMIT
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const before=fs.readFileSync("/tmp/CORE-A4-YALKEN-MAINLINE-SAFE-ALLOWLIST-DECISION-001.head","utf8").trim();const after=execSync("git rev-parse HEAD",{encoding:"utf8"}).trim();if(!before||!after||before===after)process.exit(1);const count=execSync(`git rev-list --count ${before}..${after}`,{encoding:"utf8"}).trim();if(count!=="1")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_08_POST_LAST_COMMIT_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git show --pretty=format: --name-only HEAD",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-MAINLINE-SAFE-ALLOWLIST-DECISION-001.md
PASS: exit 0

CHECK_09_POST_MAINLINE_FACTUAL_DOCS_STILL_UNCHANGED
CMD: node -e 'const fs=require("node:fs");const context=fs.readFileSync("docs/CONTEXT.md","utf8");const handoff=fs.readFileSync("docs/HANDOFF.md","utf8");if(!context.includes("Repo-wide done подтверждён на main после merge gate и post-merge reconfirm."))process.exit(1);if(!handoff.includes("Repo-wide done is confirmed on main after merge gate and post-merge reconfirm."))process.exit(1);process.exit(0);'
PASS: exit 0

## COMMIT_MESSAGE_TEMPLATE
- LINE_01: CORE-A4-YALKEN-MAINLINE-SAFE-ALLOWLIST-DECISION-001
- LINE_02: SCOPE CORE-A4-YALKEN-MAINLINE-SAFE-ALLOWLIST-DECISION-001
- LINE_03: OUTCOME COMMIT_CREATED
- LINE_04: CHECKS CHECK_01 CHECK_02 CHECK_03 CHECK_04 CHECK_05 CHECK_06
- LINE_05: NO_RUNTIME_ADMISSION_CLAIMED_TRUE

## DELIVERY_MODE
- PUSH_REQUIRED: true
- PR_REQUIRED: false
- MERGE_REQUIRED: false
- TARGET_BASE_BRANCH: main

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая попытка touch forbidden basenames → STOP.
- Любая попытка rewrite mainline factual docs → STOP.
- Любая попытка direct port branch-local Phase 02 narrative → STOP.

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
- No PR in this run.
- No merge in this run.
