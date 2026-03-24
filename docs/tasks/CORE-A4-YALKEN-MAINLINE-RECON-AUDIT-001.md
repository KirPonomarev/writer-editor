TASK_ID: CORE-A4-YALKEN-MAINLINE-RECON-AUDIT-001
MILESTONE: A4
TYPE: CORE
STATUS: AUDIT_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Сохранить на mainline только узкий audit trail о branch-local reconciliation commit `517ed9119720772185bffae4c7dc81ee49e3b918` без переноса local current-lane Phase 02 narrative в active factual docs. Этот task не меняет `CONTEXT.md`, `HANDOFF.md` или active canon surfaces и не открывает runtime writes, runtime admission, formal cutover или broad shell admission.

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-MAINLINE-RECON-AUDIT-001.md
- docs/OPS/STATUS/BRANCH_LOCAL_CURRENT_LANE_RECON_AUDIT_RECORD_V1.json

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-MAINLINE-RECON-AUDIT-001.md
- docs/OPS/STATUS/BRANCH_LOCAL_CURRENT_LANE_RECON_AUDIT_RECORD_V1.json

## DENYLIST
- любые изменения `docs/CONTEXT.md`
- любые изменения `docs/HANDOFF.md`
- любые изменения `CANON.md`
- любые изменения `docs/BIBLE.md`
- любые изменения `docs/corex/**`
- любые изменения existing status records
- любые runtime surface writes
- любые новые narratives про active Phase 02 on main
- любые formal cutover claims
- любые broad shell admission claims
- любые add-all patterns

## CONTRACT / SHAPES
- TASK_CLASS: MAINLINE_COMPATIBLE_AUDIT_ONLY
- RECORD_BASENAME: BRANCH_LOCAL_CURRENT_LANE_RECON_AUDIT_RECORD_V1.json
- preserve mainline repo-wide-done factual wording unchanged
- preserve runtimeWritesAdmitted false
- preserve runtimeAdmissionGranted false
- preserve formalCutoverClaimed false
- preserve broadShellAdmissionClaimed false
- treat commit `517ed9119720772185bffae4c7dc81ee49e3b918` as branch-local historical audit only
- do not promote branch-local current-lane Phase 02 state into mainline factual truth

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02 и CHECK_03 до staging.
1) Создать один audit-only record.
2) Выполнить `git add --` exact paths only from ALLOWLIST.
3) Проверить staged scope.
4) Создать ровно один narrow commit.
5) Выполнить post-commit checks и остановиться.

## CHECKS
CHECK_01_PRE_MAINLINE_FACTUAL_DOCS_REMAIN_REPO_WIDE_DONE
CMD: node -e 'const fs=require("node:fs");const context=fs.readFileSync("docs/CONTEXT.md","utf8");const handoff=fs.readFileSync("docs/HANDOFF.md","utf8");if(!context.includes("Обязательные delivery axes внутри `Writer v1` закрыты через release hardening."))process.exit(1);if(!handoff.includes("Active docs: aligned after closure and release hardening"))process.exit(1);if(!handoff.includes("Writer v1 required runtime contours are closed."))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-MAINLINE-RECON-AUDIT-001.prestatus && echo OK
PASS: OUT == OK

CHECK_03_PRE_STAGED_SET_EMPTY
CMD: test -z "$(git diff --cached --name-only)" && echo OK
PASS: OUT == OK

CHECK_04_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));const baselinePath="/tmp/CORE-A4-YALKEN-MAINLINE-RECON-AUDIT-001.prestatus";if(!fs.existsSync(baselinePath))process.exit(1);const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p))process.exit(1);}process.exit(0);' docs/tasks/CORE-A4-YALKEN-MAINLINE-RECON-AUDIT-001.md docs/OPS/STATUS/BRANCH_LOCAL_CURRENT_LANE_RECON_AUDIT_RECORD_V1.json
PASS: exit 0

CHECK_05_POST_STAGED_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git diff --cached --name-only",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-MAINLINE-RECON-AUDIT-001.md docs/OPS/STATUS/BRANCH_LOCAL_CURRENT_LANE_RECON_AUDIT_RECORD_V1.json
PASS: exit 0

CHECK_06_POST_LAST_COMMIT_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git show --pretty=format: --name-only HEAD",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-MAINLINE-RECON-AUDIT-001.md docs/OPS/STATUS/BRANCH_LOCAL_CURRENT_LANE_RECON_AUDIT_RECORD_V1.json
PASS: exit 0

CHECK_07_POST_MAINLINE_FACTUAL_DOCS_STILL_UNCHANGED
CMD: node -e 'const fs=require("node:fs");const context=fs.readFileSync("docs/CONTEXT.md","utf8");const handoff=fs.readFileSync("docs/HANDOFF.md","utf8");if(!context.includes("Обязательные delivery axes внутри `Writer v1` закрыты через release hardening."))process.exit(1);if(!handoff.includes("Active docs: aligned after closure and release hardening"))process.exit(1);if(!handoff.includes("Writer v1 required runtime contours are closed."))process.exit(1);process.exit(0);'
PASS: exit 0

## COMMIT_MESSAGE_TEMPLATE
- LINE_01: CORE-A4-YALKEN-MAINLINE-RECON-AUDIT-001
- LINE_02: SCOPE CORE-A4-YALKEN-MAINLINE-RECON-AUDIT-001 BRANCH_LOCAL_CURRENT_LANE_RECON_AUDIT_RECORD_V1
- LINE_03: OUTCOME COMMIT_CREATED
- LINE_04: CHECKS CHECK_01 CHECK_02 CHECK_03 CHECK_04 CHECK_05
- LINE_05: NO_RUNTIME_ADMISSION_CLAIMED_TRUE

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая попытка менять factual docs mainline → STOP.
- Любая попытка перенести active Phase 02 narrative на main → STOP.

## REPORT_FORMAT
- CHANGED:
- CHECK:
- OUT:
- ASSUMPTIONS:
- FAIL_REASON:
- EVIDENCE:
