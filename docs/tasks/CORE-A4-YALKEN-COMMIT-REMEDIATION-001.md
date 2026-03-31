TASK_ID: CORE-A4-YALKEN-COMMIT-REMEDIATION-001
MILESTONE: A4
TYPE: CORE
STATUS: LEDGER_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Зафиксировать один узкий commit-remediation ledger для текущего Yalken packet без runtime writes, без новых контуров и без первого commit loop. Этот task только собирает exact queue, разделяет historical frozen blockers и current-lane safe patch queue, а также лочит исполнимые правила staging и outcome patching.

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-COMMIT-REMEDIATION-001.md
- docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-COMMIT-REMEDIATION-001.md
- docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json

## DENYLIST
- любые runtime surface writes
- любые изменения вне ALLOWLIST
- любые git add --all, git add -A или эквиваленты
- любые реальные git commit внутри этого task
- любые новые контуры
- любые Phase 02 execution artifacts
- любые изменения existing terminal records
- любые новые зависимости
- любые formal cutover claims
- любые broad shell admission claims
- любые попытки объявить commit chain непрерывной до owner decision по historical frozen blockers

## CONTRACT / SHAPES
- TASK_CLASS: COMMIT_REMEDIATION_LEDGER_ONLY
- LEDGER_RECORD_BASENAME: CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json
- current commit allowlist may be a proper subset of task allowlist for one narrow commit
- staging must use exact paths from current commit allowlist and not basenames
- if commitSha remains mandatory, one separate post-commit outcome patch step is allowed later
- terminal record outcome patching is allowed later only if existing contract fields remain valid
- explicit deferred for write-task remains forbidden without one separate owner blocker decision
- this task does not open the first commit loop
- this task does not grant runtime admission
- this task may record historical frozen blockers if retrofitting outcome fields would create provenance drift

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01 и CHECK_02 до любых write-действий.
1) Прочитать Yalken write-task docs и их terminal records по contour 01, contour 02 и current-lane packet.
2) Зафиксировать в одном ledger:
   - earliest unclosed historical task,
   - historical frozen blocker chain,
   - current-lane safe patch queue,
   - exact-path staging rule,
   - subset allowlist rule,
   - post-commit patch rule,
   - contract-preserving patch rule,
   - deferred rule.
3) Не выполнять commit, не патчить existing terminal records и не открывать новые admission layers внутри этого task.
4) После записи ledger выполнить CHECK_03 и CHECK_04 и остановиться.

## CHECKS
CHECK_01_PRE_RELEVANT_TASKS_AND_TERMINAL_RECORDS_EXIST
CMD: test -f docs/tasks/CORE-A4-YALKEN-CONTOUR-01-001.md && test -f docs/OPS/STATUS/CONTOUR_01_PROOF_CLOSURE_RECORD_V1.json && test -f docs/tasks/CORE-A4-YALKEN-CONTOUR-02-CLOSE-001.md && test -f docs/OPS/STATUS/CONTOUR_02_PROOF_CLOSURE_RECORD_V1.json && test -f docs/tasks/CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md && test -f docs/OPS/STATUS/CONTOUR_03_04_05_ORDER_RECONCILIATION_DECISION_RECORD_V1.json && test -f docs/tasks/CORE-A4-YALKEN-FACTUAL-REFRESH-001.md && test -f docs/OPS/STATUS/CURRENT_LANE_FACTUAL_DOC_REFRESH_COMPLETE_RECORD_V1.json && test -f docs/tasks/CORE-A4-YALKEN-PHASE02-PREP-ONLY-001.md && test -f docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json && test -f docs/tasks/CORE-A4-YALKEN-PHASE02-EXECUTION-ADMISSION-001.md && test -f docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json
PASS: exit 0

CHECK_02_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-COMMIT-REMEDIATION-001.prestatus && echo OK
PASS: OUT == OK

CHECK_03_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){console.error("ALLOWLIST is empty");process.exit(2);}const baselinePath="/tmp/CORE-A4-YALKEN-COMMIT-REMEDIATION-001.prestatus";if(!fs.existsSync(baselinePath)){console.error("Missing baseline status snapshot");process.exit(1);}const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p)){console.error(`Disallowed delta: ${p}`);process.exit(1);}}process.exit(0);' docs/tasks/CORE-A4-YALKEN-COMMIT-REMEDIATION-001.md docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json
PASS: exit 0

CHECK_04_POST_LEDGER_STAYS_NARROW_AND_EXECUTABLE
CMD: node -e 'const fs=require("node:fs");const p="docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.status!=="COMMIT_REMEDIATION_LEDGER_ONLY_RUNTIME_WRITES_NOT_ADMITTED")process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.runtimeAdmissionGranted!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);if(j.broadShellAdmissionClaimed!==false)process.exit(1);if(j.currentCommitAllowlistMayBeSubsetOfTaskAllowlist!==true)process.exit(1);if(j.exactPathStagingRequired!==true)process.exit(1);if(j.postCommitOutcomePatchAllowedIfCommitShaRequired!==true)process.exit(1);if(j.terminalRecordPatchMustPreserveExistingContractFields!==true)process.exit(1);if(j.writeTaskDeferredRequiresOwnerBlockerDecision!==true)process.exit(1);if(j.earliestUnclosedHistoricalTaskBasename!=="CORE-A4-YALKEN-CONTOUR-01-001.md")process.exit(1);if(!Array.isArray(j.historicalFrozenBlockers)||j.historicalFrozenBlockers.length<2)process.exit(1);if(!Array.isArray(j.currentLaneSafePatchQueue)||j.currentLaneSafePatchQueue.length!==4)process.exit(1);if(j.currentLaneSafePatchQueue[0]?.taskBasename!=="CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md")process.exit(1);if(j.firstExecutableQueueHeadBasename!=="CORE-A4-YALKEN-LADDER-03-04-05-RECON-001.md")process.exit(1);if(j.continuousCommitChainReady!==false)process.exit(1);if(j.nextStep!=="OPEN_ONE_OWNER_BLOCKER_DECISION_FOR_HISTORICAL_PROOF_CHAIN_BEFORE_FIRST_COMMIT")process.exit(1);process.exit(0);'
PASS: exit 0

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая попытка открыть commit loop внутри этого task → STOP.
- Любая попытка патчить existing terminal records внутри этого task → STOP.
- Любая попытка выдать ledger за commit outcome chain → STOP.

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
- Никаких новых decision records вместо честной ledger-классификации.
