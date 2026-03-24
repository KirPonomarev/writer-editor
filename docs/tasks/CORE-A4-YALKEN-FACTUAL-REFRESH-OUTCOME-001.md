TASK_ID: CORE-A4-YALKEN-FACTUAL-REFRESH-OUTCOME-001
MILESTONE: A4
TYPE: CORE
STATUS: POST_COMMIT_OUTCOME_PATCH_ONLY_NO_STAGING_NO_COMMIT_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Выполнить один отдельный post-commit outcome patch для `CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json` после уже созданного narrow commit `b1c1b58936238373d6402a7d6fa41d6503519c1a`. Этот task не делает staging, не делает commit, не создает новый terminal record, не меняет factual refresh decision layer и не открывает runtime admission.

## ENTRY_CRITERIA
- HEAD equals `b1c1b58936238373d6402a7d6fa41d6503519c1a`
- last commit scope equals `CORE-A4-YALKEN-FACTUAL-REFRESH-COMMIT-001.md`, `CORE-A4-YALKEN-FACTUAL-REFRESH-001.md`, `CONTEXT.md`, `HANDOFF.md`, `CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json`
- target record still keeps `FACTUAL_REFRESH_COMPLETE_RUNTIME_WRITES_NOT_ADMITTED`

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-FACTUAL-REFRESH-OUTCOME-001.md
- docs/OPS/STATUS/CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-FACTUAL-REFRESH-OUTCOME-001.md
- docs/OPS/STATUS/CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json

## DENYLIST
- любые staging actions
- любые commit actions
- любые новые status records
- любые новые contours
- любые изменения `status`
- любые изменения `factualRefreshCompleted`
- любые изменения `currentBindingOrderPreserved`
- любые изменения `contour01ProofOnlyClosed`
- любые изменения `contour02ProofOnlyClosed`
- любые изменения `phase02PrepStarted`
- любые изменения `historicalPhase02PacketCountsAsCurrentPrepAdmission`
- любые изменения `runtimeWritesAdmitted`
- любые изменения `runtimeAdmissionGranted`
- любые изменения `formalCutoverClaimed`
- любые изменения `broadShellAdmissionClaimed`
- любые изменения `nextStep`
- любые runtime surface writes

## CONTRACT / SHAPES
- TASK_CLASS: POST_COMMIT_OUTCOME_PATCH_ONLY
- TARGET_TASK_BASENAME: CORE-A4-YALKEN-FACTUAL-REFRESH-001.md
- TARGET_COMMIT_TASK_BASENAME: CORE-A4-YALKEN-FACTUAL-REFRESH-COMMIT-001.md
- TARGET_RECORD_BASENAME: CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json
- TARGET_COMMIT_SHA: b1c1b58936238373d6402a7d6fa41d6503519c1a
- preserve existing factual refresh and runtime contract fields exactly
- add outcome metadata only
- constrain `checksPassed` to exact check ids from `CORE-A4-YALKEN-FACTUAL-REFRESH-COMMIT-001.md` only
- no staging and no commit in this batch
- no new terminal record in this batch

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02 и CHECK_03 до любых write-действий.
1) Прочитать target record и подтвердить exact last commit scope.
2) Создать один task artifact для post-commit outcome patch.
3) Дописать в target record только outcome metadata fields.
4) Выполнить CHECK_04, CHECK_05 и CHECK_06.
5) Остановиться; staging и commit остаются отдельным later batch.

## CHECKS
CHECK_01_PRE_HEAD_MATCHES_TARGET_COMMIT
CMD: test "$(git rev-parse HEAD)" = "b1c1b58936238373d6402a7d6fa41d6503519c1a" && echo OK
PASS: OUT == OK

CHECK_02_PRE_LAST_COMMIT_SCOPE_MATCHES_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=[...process.argv.slice(1)].sort();const got=execSync("git show --pretty=format: --name-only HEAD",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);' docs/tasks/CORE-A4-YALKEN-FACTUAL-REFRESH-COMMIT-001.md docs/tasks/CORE-A4-YALKEN-FACTUAL-REFRESH-001.md docs/CONTEXT.md docs/HANDOFF.md docs/OPS/STATUS/CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json
PASS: exit 0

CHECK_03_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-FACTUAL-REFRESH-OUTCOME-001.prestatus && echo OK
PASS: OUT == OK

CHECK_04_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));const baselinePath="/tmp/CORE-A4-YALKEN-FACTUAL-REFRESH-OUTCOME-001.prestatus";if(!fs.existsSync(baselinePath))process.exit(1);const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p))process.exit(1);}process.exit(0);' docs/tasks/CORE-A4-YALKEN-FACTUAL-REFRESH-OUTCOME-001.md docs/OPS/STATUS/CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json
PASS: exit 0

CHECK_05_POST_RECORD_PRESERVES_CONTRACT_AND_ADDS_OUTCOME_FIELDS
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json","utf8"));const checks=["CHECK_01","CHECK_02","CHECK_03","CHECK_04","CHECK_05","CHECK_06","CHECK_07","CHECK_08","CHECK_09"];if(j.status!=="FACTUAL_REFRESH_COMPLETE_RUNTIME_WRITES_NOT_ADMITTED")process.exit(1);if(j.factualRefreshCompleted!==true)process.exit(1);if(j.currentBindingOrderPreserved!==true)process.exit(1);if(j.contour01ProofOnlyClosed!==true)process.exit(1);if(j.contour02ProofOnlyClosed!==true)process.exit(1);if(j.phase02PrepStarted!==false)process.exit(1);if(j.historicalPhase02PacketCountsAsCurrentPrepAdmission!==false)process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.runtimeAdmissionGranted!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);if(j.broadShellAdmissionClaimed!==false)process.exit(1);if(j.nextStep!=="OPEN_ONE_SEPARATE_CURRENT_LANE_PHASE02_PREP_ONLY_TASK")process.exit(1);if(j.taskId!=="CORE-A4-YALKEN-FACTUAL-REFRESH-001")process.exit(1);if(j.commitOutcomeTaskId!=="CORE-A4-YALKEN-FACTUAL-REFRESH-COMMIT-001")process.exit(1);if(j.checksPassedSourceTaskId!=="CORE-A4-YALKEN-FACTUAL-REFRESH-COMMIT-001")process.exit(1);if(j.checksPassedScope!=="COMMIT_TASK_ONLY")process.exit(1);if(j.outcomeType!=="COMMIT_CREATED")process.exit(1);if(j.commitSha!=="b1c1b58936238373d6402a7d6fa41d6503519c1a")process.exit(1);if(j.stagedScopeMatchesAllowlist!==true)process.exit(1);if(JSON.stringify(j.checksPassed)!==JSON.stringify(checks))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_06_POST_NO_STAGING_AND_NO_COMMIT
CMD: test -z "$(git diff --cached --name-only)" && test "$(git rev-parse HEAD)" = "b1c1b58936238373d6402a7d6fa41d6503519c1a" && echo OK
PASS: OUT == OK

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без staging и без commit.
- Любое изменение factual or runtime contract fields → STOP.
- Любая попытка создать новый terminal record → STOP.
- Любая попытка интерпретировать outcome metadata как runtime admission → STOP.

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
- Никаких staging or commit actions внутри этого batch.
