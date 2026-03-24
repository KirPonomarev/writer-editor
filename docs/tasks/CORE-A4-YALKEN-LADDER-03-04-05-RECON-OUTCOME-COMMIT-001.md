TASK_ID: CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-001
MILESTONE: A4
TYPE: CORE
STATUS: NARROW_COMMIT_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Выполнить один narrow commit только для outcome pair `CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-001.md` и `CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json` плюс одного commit-task artifact. Этот task использует exact-path staging only, создает ровно один commit, не патчит terminal record outcome fields после commit в этом же batch, не делает второй commit и не открывает runtime admission.

## ENTRY_CRITERIA
- `CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-PRECOMMIT-001.md` stays green and says `READY_FOR_NARROW_COMMIT`
- `CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-001.md` exists and stays `POST_COMMIT_OUTCOME_PATCH_ONLY_NO_STAGING_NO_COMMIT_RUNTIME_WRITES_NOT_ADMITTED`
- target record preserves governance fields and already carries commit outcome metadata for `21ed5c37f41fd91ccd9ea0a1b125ed7126a488f6`

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-001.md
- docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-001.md
- docs/OPS/STATUS/CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-001.md
- docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-001.md
- docs/OPS/STATUS/CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json

## DENYLIST
- любые runtime surface writes
- любые изменения вне ALLOWLIST
- любые basename-only staging rules
- любые add-all patterns
- любые вторые commit actions
- любые terminal-record outcome patches after commit inside this batch
- любые новые status records
- любые новые contours
- любые formal cutover claims
- любые broad shell admission claims

## CONTRACT / SHAPES
- TASK_CLASS: NARROW_COMMIT_ONLY
- TARGET_TASK_BASENAME: CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-001.md
- TARGET_RECORD_BASENAME: CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json
- COMMIT_TASK_BASENAME: CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-001.md
- exact-path staging only
- commit scope is exactly the three allowlist paths above
- create exactly one narrow commit only
- if extra delta appears outside allowlist subset, STOP
- runtimeWritesAdmitted remains false throughout this batch
- runtimeAdmissionGranted remains false throughout this batch
- post-commit outcome patch, if needed, is a separate later task

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02, CHECK_03, CHECK_04 и CHECK_05 до staging.
1) Захватить pre-stage baseline and head baseline.
2) Выполнить `git add --` exact paths only from ALLOWLIST.
3) Проверить, что staged delta matches allowlist exactly.
4) Повторно прогнать narrow checks перед commit.
5) Создать ровно один commit с narrow scope.
6) Проверить, что последний commit содержит только allowlist paths.
7) Остановиться; outcome patch после этого commit не делать в этом task.

## CHECKS
CHECK_01_PRE_OUTCOME_PRECOMMIT_PASS
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-PRECOMMIT-001.md","utf8");if(!t.includes("STATUS: PRE_COMMIT_CHECKS_GREEN_READY_FOR_NARROW_COMMIT_NO_STAGING_NO_COMMIT_RUNTIME_WRITES_NOT_ADMITTED"))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_OUTCOME_TASK_AND_TARGET_RECORD_PASS
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-001.md","utf8");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json","utf8"));if(!t.includes("STATUS: POST_COMMIT_OUTCOME_PATCH_ONLY_NO_STAGING_NO_COMMIT_RUNTIME_WRITES_NOT_ADMITTED"))process.exit(1);if(j.status!=="CURRENT_BINDING_ORDER_PRESERVED_RUNTIME_WRITES_NOT_ADMITTED")process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.runtimeAdmissionGranted!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);if(j.broadShellAdmissionClaimed!==false)process.exit(1);if(j.commitSha!=="21ed5c37f41fd91ccd9ea0a1b125ed7126a488f6")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_03_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-001.prestatus && echo OK
PASS: OUT == OK

CHECK_04_PRE_CAPTURE_HEAD_BASELINE
CMD: git rev-parse HEAD > /tmp/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-001.head && echo OK
PASS: OUT == OK

CHECK_05_PRE_STAGED_SET_EMPTY
CMD: test -z "$(git diff --cached --name-only)" && echo OK
PASS: OUT == OK

CHECK_06_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));const baselinePath="/tmp/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-001.prestatus";if(!fs.existsSync(baselinePath))process.exit(1);const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p))process.exit(1);}process.exit(0);' docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-001.md docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-001.md docs/OPS/STATUS/CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json
PASS: exit 0

CHECK_07_POST_STAGED_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git diff --cached --name-only",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-001.md docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-001.md docs/OPS/STATUS/CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json
PASS: exit 0

CHECK_08_POST_HEAD_MOVED_BY_EXACTLY_ONE_COMMIT
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const before=fs.readFileSync("/tmp/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-001.head","utf8").trim();const after=execSync("git rev-parse HEAD",{encoding:"utf8"}).trim();if(!before||!after||before===after)process.exit(1);const count=execSync(`git rev-list --count ${before}..${after}`,{encoding:"utf8"}).trim();if(count!=="1")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_09_POST_LAST_COMMIT_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git show --pretty=format: --name-only HEAD",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-001.md docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-001.md docs/OPS/STATUS/CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json
PASS: exit 0

## COMMIT_MESSAGE_TEMPLATE
- LINE_01: CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-001
- LINE_02: SCOPE CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-001 CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-001 CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1
- LINE_03: OUTCOME COMMIT_CREATED
- LINE_04: CHECKS CHECK_01 CHECK_02 CHECK_03 CHECK_04 CHECK_05 CHECK_06 CHECK_07
- LINE_05: NO_RUNTIME_ADMISSION_CLAIMED_TRUE

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любой extra staged path → STOP.
- Любой второй commit attempt → STOP.
- Любая попытка сделать outcome patch после commit внутри этого task → STOP.

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
