TASK_ID: CORE-A4-YALKEN-CONTOUR-02-001
MILESTONE: A4
TYPE: CORE
STATUS: SURFACE_BINDING_ONLY_NOT_ADMITTED_FOR_RUNTIME_WRITES
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Подготовить только второй узкий контур `CONTOUR_02_WRITE_WORKSPACE_STATE_PERSIST_RESTORE_AND_SAFE_RESET` как prep-only exact surface-binding contour для host-owned WRITE workspace shell state без runtime writes, без shell inflation, без document-truth crossover и без editor-stack migration. Этот task допускает только preparation-layer artifacts и один narrow prep decision record, но не является runtime admission решением.

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-CONTOUR-02-001.md
- docs/OPS/STATUS/MIOS_SECOND_VERTICAL_SLICE_DEFINITION_RECORD_V1.json
- docs/OPS/STATUS/CONTOUR_02_PREP_DECISION_RECORD_V1.json

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-CONTOUR-02-001.md
- docs/OPS/STATUS/MIOS_SECOND_VERTICAL_SLICE_DEFINITION_RECORD_V1.json
- docs/OPS/STATUS/CONTOUR_02_PREP_DECISION_RECORD_V1.json

## DENYLIST
- любые runtime surface writes
- любые изменения вне ALLOWLIST
- любые новые зависимости
- любой новый storage channel
- любой новый recovery channel
- любой formal cutover claim
- любая pack promotion
- любое broad shell expansion
- любой plan or review workspace rollout
- любая editor-stack migration work
- любое contour 03 work inside this task

## CONTRACT / SHAPES
- CONTOUR_ID: CONTOUR_02_WRITE_WORKSPACE_STATE_PERSIST_RESTORE_AND_SAFE_RESET
- CONTOUR_TYPE: POST_CONTOUR_01_NARROW_SHELL_STATE_PROOF_CONTOUR
- STATE_BOUNDARY_READ_PATH_ID: WRITE_WORKSPACE_STATE_BOUNDARY_READ_PATH_V1
- STATE_BOUNDARY_WRITE_PATH_ID: WRITE_WORKSPACE_STATE_BOUNDARY_WRITE_PATH_V1
- LAYOUT_SNAPSHOT_COMMIT_PATH_ID: WRITE_WORKSPACE_LAYOUT_SNAPSHOT_COMMIT_PATH_V1
- LAYOUT_RESTORE_PATH_ID: WRITE_WORKSPACE_LAYOUT_RESTORE_PATH_V1
- SAFE_RESET_PATH_ID: WRITE_WORKSPACE_SAFE_RESET_PATH_V1
- NO_DOCUMENT_TRUTH_CROSSOVER_ID: WRITE_WORKSPACE_NO_DOCUMENT_TRUTH_CROSSOVER_V1
- EDITOR_ROOT_INVARIANT_ID: EDITOR_ROOT_REMAINS_DOCKED_IN_V1
- CHOSEN_AUX_SURFACE_ID: WRITE_PROJECT_TREE_LEFT_RAIL_DOCKED_SURFACE_V1
- chosen auxiliary surface for this contour is the existing docked left project tree in WRITE workspace
- chosen auxiliary surface is anchor-only for WRITE workspace orientation and must not be misread as the full persisted layout domain
- current repo layout commit path persists the bounded side-container layout pair and must not be misread as a fabricated one-surface layout writer
- phase03 and phase05 packets used by this task are supporting preparation evidence only and do not by themselves create admitted runtime binding for contour 02
- this preparation task resolves exact live surfaces only and does not admit runtime proof or runtime mutation
- app state remains host-owned in v1
- editor root remains docked in v1
- no second source of truth
- no parallel storage or recovery channel
- no formal cutover
- no release-scope inflation
- no contour 03 work inside this task
- contour 01 proof-only closure record is a hard precondition
- contour 02 runtime proof record is required later and is not created by this preparation task
- SAFE_RESET_PATH_ID and LAYOUT_RESTORE_PATH_ID remain separate path families in this prep contour and must not be collapsed into one proof count or one admission claim
- current phase permits task text, second definition record and one narrow prep decision record only
- current phase does not admit any runtime surface write even if later contour 02 files are known in advance
- allowlist is not runtime admission

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02, CHECK_03 и CHECK_04 до любых write-действий.
1) Прочитать active canon resolution, `CANON.md`, `docs/CONTEXT.md`, `docs/HANDOFF.md` и `docs/PROCESS.md`; подтвердить, что contour 02 читается как narrow shell-state preparation contour only.
2) Прочитать contour 01 proof closure and admission decision records; убедиться, что contour 01 closed as proof-only and contour 02 may start only as separate contour.
3) Разрешить exact live repo surfaces для state read, state write, layout commit, layout restore, safe reset, no-document-truth crossover and docked-editor invariant.
4) Зафиксировать `MIOS_SECOND_VERTICAL_SLICE_DEFINITION_RECORD_V1.json`.
5) Не создавать execution proof record, не писать proofhook, не менять runtime surfaces, не расширять allowlist.
6) После definition record остановиться и передать contour 02 в независимую инспекцию перед любым следующим admission вопросом.
7) Если независимая инспекция подтверждает чистый prep-only слой, зафиксировать один `CONTOUR_02_PREP_DECISION_RECORD_V1.json` без runtime admission claim.
8) После prep decision record остановиться; execution task for contour 02 is a separate later contour.

## CHECKS
CHECK_01_PRE_ACTIVE_CANON_RESOLVES
CMD: node -e 'const fs=require("node:fs");const p="docs/OPS/STATUS/CANON_STATUS.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.status!=="ACTIVE_CANON")process.exit(1);if(j.canonicalDocPath!=="docs/OPS/STATUS/XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md")process.exit(1);if(!fs.existsSync(j.canonicalDocPath))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_CONTOUR_01_CLOSURE_PRESENT
CMD: node -e 'const fs=require("node:fs");const c=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CONTOUR_01_PROOF_CLOSURE_RECORD_V1.json","utf8"));const d=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CONTOUR_01_ADMISSION_DECISION_RECORD_V1.json","utf8"));if(c.status!=="CLOSED_AS_PROOF_CONTOUR_WITHOUT_RUNTIME_MUTATION")process.exit(1);if(c.runtimeWritesAdmitted!==false)process.exit(1);if(c.contour02RequiresThisClosureRecord!==true)process.exit(1);if(d.decision!=="CLOSE_AS_PROOF_CONTOUR_WITHOUT_RUNTIME_MUTATION")process.exit(1);if(d.runtimeWritesAdmitted!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_03_PRE_BASELINE_STABLE_FOR_THIS_LANE
CMD: node -e 'const p=require("./package.json");const deps={...p.dependencies,...p.devDependencies};if(deps["@tiptap/core"]!=="2.27.2")process.exit(1);if(deps["@tiptap/pm"]!=="2.27.2")process.exit(1);if(deps["@tiptap/starter-kit"]!=="2.27.2")process.exit(1);if(typeof p.scripts?.["oss:policy"]!=="string")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_04_PRE_CAPTURE_TASK_STATUS_BASELINE
CMD: git status --porcelain --untracked-files=all > /tmp/CORE-A4-YALKEN-CONTOUR-02-001.prestatus && echo OK
PASS: OUT == OK

CHECK_05_POST_ALLOWED_DELTA_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const allow=new Set(process.argv.slice(1));if(!allow.size){console.error("ALLOWLIST is empty");process.exit(2);}const baselinePath="/tmp/CORE-A4-YALKEN-CONTOUR-02-001.prestatus";if(!fs.existsSync(baselinePath)){console.error("Missing baseline status snapshot");process.exit(1);}const parse=(txt)=>{if(!txt.trimEnd()) return new Set();return new Set(txt.trimEnd().split("\\n").map((line)=>{const p=line.slice(3);const parts=p.split(" -> ");return parts[parts.length-1];}));};const before=parse(fs.readFileSync(baselinePath,"utf8"));const after=parse(execSync("git status --porcelain --untracked-files=all",{encoding:"utf8"}));for(const p of after){if(before.has(p)) continue;if(!allow.has(p)){console.error(`Disallowed delta: ${p}`);process.exit(1);}}process.exit(0);' docs/tasks/CORE-A4-YALKEN-CONTOUR-02-001.md docs/OPS/STATUS/MIOS_SECOND_VERTICAL_SLICE_DEFINITION_RECORD_V1.json docs/OPS/STATUS/CONTOUR_02_PREP_DECISION_RECORD_V1.json
PASS: exit 0

CHECK_06_POST_DEFINITION_RECORD_EXISTS_AND_STAYS_NARROW
CMD: node -e 'const fs=require("node:fs");const p="docs/OPS/STATUS/MIOS_SECOND_VERTICAL_SLICE_DEFINITION_RECORD_V1.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.status!=="SURFACE_BINDING_ONLY_NOT_ADMITTED_FOR_RUNTIME_WRITES")process.exit(1);if(j.appStateOwnership!=="host-owned")process.exit(1);if(j.touchesDocumentTruth!==false)process.exit(1);if(j.introducesSecondSourceOfTruth!==false)process.exit(1);if(j.introducesParallelRecoveryChannel!==false)process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.formalCutoverClaimed!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_07_POST_REPO_SURFACES_RESOLVED
CMD: node -e 'const fs=require("node:fs");const j=JSON.parse(fs.readFileSync("docs/OPS/STATUS/MIOS_SECOND_VERTICAL_SLICE_DEFINITION_RECORD_V1.json","utf8"));if(!Array.isArray(j.repoSurfacesUsed)||j.repoSurfacesUsed.length===0)process.exit(1);for(const p of j.repoSurfacesUsed){if(!fs.existsSync(p))process.exit(1);}process.exit(0);'
PASS: exit 0

CHECK_08_POST_PREP_DECISION_RECORD_STAYS_PREP_ONLY
CMD: node -e 'const fs=require("node:fs");const p="docs/OPS/STATUS/CONTOUR_02_PREP_DECISION_RECORD_V1.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));if(j.status!=="PREP_LAYER_ACCEPTED_RUNTIME_WRITES_NOT_ADMITTED")process.exit(1);if(j.scope!=="PREPARATION_ONLY")process.exit(1);if(j.preparationComplete!==true)process.exit(1);if(j.runtimeProofStarted!==false)process.exit(1);if(j.runtimeWritesAdmitted!==false)process.exit(1);if(j.notClaimed?.runtimeAdmissionClaimed!==false)process.exit(1);if(j.notClaimed?.executionProofClaimed!==false)process.exit(1);if(j.notClaimed?.formalCutoverClaimed!==false)process.exit(1);if(j.notClaimed?.broadShellAdmissionClaimed!==false)process.exit(1);process.exit(0);'
PASS: exit 0

## STOP_CONDITION
- PASS всех CHECK → STOP.
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любая неоднозначность по contour admission, exact live surface map или no-document-truth-crossover → STOP.
- Любая необходимость менять runtime surfaces, proofhook scripts или contract tests внутри этой preparation task → STOP.
- Любая попытка выдать definition record за runtime proof → STOP.
- Любая попытка выдать prep decision record за runtime admission, execution proof или broad shell admission → STOP.

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
- Никакого PASS без отдельной независимой инспекции definition record.
- Никакого PASS по prep decision record без отдельной независимой инспекции prep-only формулировок.
