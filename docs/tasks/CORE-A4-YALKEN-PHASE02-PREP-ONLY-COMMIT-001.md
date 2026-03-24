TASK_ID: CORE-A4-YALKEN-PHASE02-PREP-ONLY-COMMIT-001
MILESTONE: A4
TYPE: CORE
STATUS: NARROW_COMMIT_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Выполнить один narrow commit только для Phase 02 prep-only task text reconciliation and closure-start scope: `CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md` плюс одного commit-task artifact. Этот task использует exact-path staging only, создает ровно один commit, не патчит terminal records в этом batch, не делает outcome patch в этом batch, не делает второй commit и не открывает runtime admission.

## ENTRY_CRITERIA
- `CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json` points first executable queue head to `CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md`
- `CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json` allows `CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md` to open as the queue-head task only
- `CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json` stays `CURRENT_LANE_PHASE02_PREP_ONLY_ADMITTED_RUNTIME_WRITES_NOT_ADMITTED`
- `CORE-A4-YALKEN-PHASE02-PREP-ONLY-PRECOMMIT-001.md` stays `PRE_COMMIT_CHECKS_GREEN_READY_FOR_NARROW_COMMIT_NO_STAGING_NO_COMMIT_RUNTIME_WRITES_NOT_ADMITTED`
- `CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md` is reconciled to the current patch-task-only next step from lane anchors

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-COMMIT-001.md
- docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-COMMIT-001.md
- docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md

## DENYLIST
- любые runtime surface writes
- любые изменения вне ALLOWLIST
- любые basename-only staging rules
- любые add-all patterns
- любые вторые commit actions
- любые terminal-record patches
- любые новые status records
- любые новые contours
- любые formal cutover claims
- любые broad shell admission claims
- любые owner or ledger edits inside this batch
- любые изменения `CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json` inside this batch

## CONTRACT / SHAPES
- TASK_CLASS: NARROW_COMMIT_ONLY
- TARGET_TASK_BASENAME: CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md
- PRECOMMIT_SOURCE_BASENAME: CORE-A4-YALKEN-PHASE02-PREP-ONLY-PRECOMMIT-001.md
- TARGET_RECORD_BASENAME: CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json
- COMMIT_TASK_BASENAME: CORE-A4-YALKEN-PHASE02-PREP-ONLY-COMMIT-001.md
- exact-path staging only
- commit scope is exactly the two allowlist paths above
- create exactly one narrow commit only
- if extra delta appears outside allowlist subset, STOP
- runtimeWritesAdmitted remains false throughout this batch
- runtimeAdmissionGranted remains false throughout this batch
- formalCutoverClaimed remains false throughout this batch
- broadShellAdmissionClaimed remains false throughout this batch
- post-commit outcome patch, if needed, is a separate later task

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02, CHECK_03, CHECK_04 и CHECK_05 до staging.
1) Захватить pre-stage baseline and head baseline.
2) Выполнить `git add --` exact paths only from ALLOWLIST.
3) Проверить, что staged delta matches allowlist exactly.
4) Повторно прогнать narrow checks перед commit.
5) Создать ровно один commit с narrow scope.
6) Проверить, что последний commit содержит только allowlist paths.
7) Остановиться; outcome patch после commit не делать в этом task.

## CHECKS
CHECK_01_PRE_LANE_HEAD_AND_PRECOMMIT_READY
CMD: node -e 'const fs=require("node:fs");const ledger=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));const owner=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));const prep=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","utf8"));const pre=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-PRECOMMIT-001.md","utf8");if(ledger.firstExecutableQueueHeadBasename!=="CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md")process.exit(1);if(owner.queueHeadTaskBasename!=="CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md")process.exit(1);if(owner.queueHeadTaskMayOpen!==true)process.exit(1);if(prep.status!=="CURRENT_LANE_PHASE02_PREP_ONLY_ADMITTED_RUNTIME_WRITES_NOT_ADMITTED")process.exit(1);if(prep.runtimeWritesAdmitted!==false||prep.runtimeAdmissionGranted!==false)process.exit(1);if(!pre.includes("STATUS: PRE_COMMIT_CHECKS_GREEN_READY_FOR_NARROW_COMMIT_NO_STAGING_NO_COMMIT_RUNTIME_WRITES_NOT_ADMITTED"))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_TARGET_TASK_RECONCILED_AND_RUNTIME_FALSE
CMD: node -e 'const fs=require("node:fs");const task=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md","utf8");const prep=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","utf8"));const canon="OPEN_ONE_SEPARATE_QUEUE_HEAD_PATCH_TASK_ONLY_FOR_CORE-A4-YALKEN-PHASE02-PREP-ONLY-001_COMMIT_LOOP_STILL_NOT_STARTED_NO_STAGING_OR_COMMIT_ACTIONS_IN_THIS_STEP";if(!task.includes("STATUS: PREP_ONLY_RUNTIME_WRITES_NOT_ADMITTED"))process.exit(1);if(!task.includes(canon))process.exit(1);if(prep.nextStep!==canon)process.exit(1);if(prep.phase02PrepOnlyAdmitted!==true||prep.phase02ExecutionStarted!==false||prep.phase02ExecutionAdmitted!==false)process.exit(1);if(prep.runtimeWritesAdmitted!==false||prep.runtimeAdmissionGranted!==false||prep.formalCutoverClaimed!==false||prep.broadShellAdmissionClaimed!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_03_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-PHASE02-PREP-ONLY-COMMIT-001.prestatus && echo OK
PASS: OUT == OK

CHECK_04_PRE_CAPTURE_HEAD_BASELINE
CMD: git rev-parse HEAD > /tmp/CORE-A4-YALKEN-PHASE02-PREP-ONLY-COMMIT-001.head && echo OK
PASS: OUT == OK

CHECK_05_PRE_STAGED_SET_EMPTY
CMD: test -z "$(git diff --cached --name-only)" && echo OK
PASS: OUT == OK

CHECK_06_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));const baselinePath="/tmp/CORE-A4-YALKEN-PHASE02-PREP-ONLY-COMMIT-001.prestatus";if(!fs.existsSync(baselinePath))process.exit(1);const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p))process.exit(1);}process.exit(0);' docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-COMMIT-001.md docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md
PASS: exit 0

CHECK_07_POST_STAGED_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git diff --cached --name-only",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-COMMIT-001.md docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md
PASS: exit 0

CHECK_08_POST_HEAD_MOVED_BY_EXACTLY_ONE_COMMIT
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const before=fs.readFileSync("/tmp/CORE-A4-YALKEN-PHASE02-PREP-ONLY-COMMIT-001.head","utf8").trim();const after=execSync("git rev-parse HEAD",{encoding:"utf8"}).trim();if(!before||!after||before===after)process.exit(1);const count=execSync(`git rev-list --count ${before}..${after}`,{encoding:"utf8"}).trim();if(count!=="1")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_09_POST_LAST_COMMIT_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git show --pretty=format: --name-only HEAD",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-COMMIT-001.md docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md
PASS: exit 0

CHECK_10_POST_RUNTIME_FALSE_STATE_STABLE
CMD: node -e 'const fs=require("node:fs");const prep=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","utf8"));const owner=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","utf8"));const ledger=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","utf8"));if(prep.runtimeWritesAdmitted!==false||prep.runtimeAdmissionGranted!==false||prep.formalCutoverClaimed!==false||prep.broadShellAdmissionClaimed!==false)process.exit(1);if(owner.runtimeWritesAdmitted!==false||owner.runtimeAdmissionGranted!==false||owner.formalCutoverClaimed!==false||owner.broadShellAdmissionClaimed!==false)process.exit(1);if(ledger.runtimeWritesAdmitted!==false||ledger.runtimeAdmissionGranted!==false||ledger.formalCutoverClaimed!==false||ledger.broadShellAdmissionClaimed!==false)process.exit(1);process.exit(0);'
PASS: exit 0

## COMMIT_MESSAGE_TEMPLATE
- LINE_01: CORE-A4-YALKEN-PHASE02-PREP-ONLY-COMMIT-001
- LINE_02: SCOPE CORE-A4-YALKEN-PHASE02-PREP-ONLY-COMMIT-001 CORE-A4-YALKEN-PHASE02-PREP-ONLY-001
- LINE_03: OUTCOME COMMIT_CREATED
- LINE_04: CHECKS CHECK_01 CHECK_02 CHECK_03 CHECK_04 CHECK_05 CHECK_06 CHECK_07
- LINE_05: NO_RUNTIME_ADMISSION_CLAIMED_TRUE

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любой extra staged path → STOP.
- Любой второй commit attempt → STOP.
- Любая попытка сделать outcome patch в этом task → STOP.

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
- Никаких second commit or outcome patch actions inside this batch.
