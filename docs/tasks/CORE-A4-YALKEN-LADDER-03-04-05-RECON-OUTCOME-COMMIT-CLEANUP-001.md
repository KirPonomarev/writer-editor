TASK_ID: CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-CLEANUP-001
MILESTONE: A4
TYPE: CORE
STATUS: NARROW_COMMIT_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Выполнить один narrow commit только для self-contained cleanup этого task-файла `CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-CLEANUP-001.md`. Этот task использует exact-path staging only, создает ровно один commit, не тянет второй artifact pair, не делает terminal-record patch, не создает новый status record и не открывает runtime admission.

## ENTRY_CRITERIA
- target cleanup file exists and stays `NARROW_COMMIT_ONLY_RUNTIME_WRITES_NOT_ADMITTED`
- target cleanup file contains `CHECK_01_PRE_OUTCOME_SCOPE_SELF_CONTAINED`
- target cleanup file keeps no live dependency on `CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-PRECOMMIT-001.md`
- this cleanup task file is the only intended current commit scope for this batch
- staged set is empty before this batch

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-CLEANUP-001.md

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-CLEANUP-001.md

## DENYLIST
- любые runtime surface writes
- любые изменения вне ALLOWLIST
- любые basename-only staging rules
- любые add-all patterns
- любые terminal-record patches
- любые новые status records
- любые новые contours
- любые formal cutover claims
- любые broad shell admission claims

## CONTRACT / SHAPES
- TASK_CLASS: NARROW_COMMIT_ONLY
- COMMIT_TASK_BASENAME: CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-CLEANUP-001.md
- exact-path staging only
- commit scope is exactly the one allowlist path above
- create exactly one narrow commit only
- no terminal-record patch in this batch
- runtimeWritesAdmitted remains false throughout this batch
- runtimeAdmissionGranted remains false throughout this batch

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02, CHECK_03 и CHECK_04 до staging.
1) Захватить pre-stage baseline и head baseline.
2) Выполнить `git add --` exact paths only from ALLOWLIST.
3) Проверить, что staged delta matches allowlist exactly.
4) Повторно прогнать narrow checks перед commit.
5) Создать ровно один commit с narrow scope.
6) Проверить, что последний commit содержит только allowlist paths.
7) Проверить, что локальный status tail для этого basename исчез.
8) Остановиться; outcome patch и любые дальнейшие queue moves не делать в этом task.

## CHECKS
CHECK_01_PRE_TARGET_SCOPE_SELF_CONTAINED
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-001.md","utf8");if(!t.includes("STATUS: NARROW_COMMIT_ONLY_RUNTIME_WRITES_NOT_ADMITTED"))process.exit(1);if(!t.includes("CHECK_01_PRE_OUTCOME_SCOPE_SELF_CONTAINED"))process.exit(1);if(t.includes("CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-PRECOMMIT-001.md"))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-CLEANUP-001.prestatus && echo OK
PASS: OUT == OK

CHECK_03_PRE_CAPTURE_HEAD_BASELINE
CMD: git rev-parse HEAD > /tmp/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-CLEANUP-001.head && echo OK
PASS: OUT == OK

CHECK_04_PRE_STAGED_SET_EMPTY
CMD: test -z "$(git diff --cached --name-only)" && echo OK
PASS: OUT == OK

CHECK_05_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));const baselinePath="/tmp/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-CLEANUP-001.prestatus";if(!fs.existsSync(baselinePath))process.exit(1);const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p))process.exit(1);}process.exit(0);' docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-CLEANUP-001.md
PASS: exit 0

CHECK_06_POST_STAGED_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git diff --cached --name-only",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-CLEANUP-001.md
PASS: exit 0

CHECK_07_POST_HEAD_MOVED_BY_EXACTLY_ONE_COMMIT
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const before=fs.readFileSync("/tmp/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-CLEANUP-001.head","utf8").trim();const after=execSync("git rev-parse HEAD",{encoding:"utf8"}).trim();if(!before||!after||before===after)process.exit(1);const count=execSync(`git rev-list --count ${before}..${after}`,{encoding:"utf8"}).trim();if(count!=="1")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_08_POST_LAST_COMMIT_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git show --pretty=format: --name-only HEAD",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-CLEANUP-001.md
PASS: exit 0

CHECK_09_POST_LOCAL_SCOPE_TAIL_ABSENT
CMD: ! git status --porcelain --untracked-files=all | rg 'CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-CLEANUP-001'
PASS: exit 0

## COMMIT_MESSAGE_TEMPLATE
- LINE_01: CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-CLEANUP-001
- LINE_02: SCOPE CORE-A4-YALKEN-LADDER-03-04-05-RECON-OUTCOME-COMMIT-CLEANUP-001
- LINE_03: OUTCOME COMMIT_CREATED
- LINE_04: CHECKS CHECK_01 CHECK_02 CHECK_03 CHECK_04 CHECK_05 CHECK_06
- LINE_05: NO_RUNTIME_ADMISSION_CLAIMED_TRUE

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любой extra staged path → STOP.
- Любой второй commit attempt → STOP.
- Любая попытка terminal-record patch → STOP.

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
