TASK_ID: CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-RECON-001
MILESTONE: A4
TYPE: CORE
STATUS: RECON_ONLY_NO_SCOPE_WIDENING_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Исправить только CHECK_09 в `CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md` так, чтобы checkchain был self-contained и воспроизводимым без зависимости от неописанного tmp baseline file.

## ENTRY_CRITERIA
- `CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md` already exists and is closed
- selected first slice remains `PHASE02_DATA_CORE_PROJECT_MANIFEST_AND_PROJECT_ID_BINDING`
- future slice allowlist remains unchanged
- runtime admission is still not opened
- execution is still not started

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-RECON-001.md

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-RECON-001.md
- docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md

## DENYLIST
- any selected slice change
- any future slice allowlist change
- any runtime write
- any runtime admission
- any execution start
- any status record mutation
- any context mutation
- any handoff mutation
- any CANON mutation
- any BIBLE mutation
- any README mutation
- any src mutation
- any scripts mutation
- any test mutation
- any Design OS C2 work
- any contour 03, contour 04 or contour 05 work
- any PR creation
- any merge
- any scope widening

## REPAIR_SCOPE
- repair `CHECK_09_POST_ONE_NARROW_COMMIT_ONLY` only
- keep selected first slice unchanged
- keep future slice exact allowlist unchanged
- prefer explicit pre-write HEAD baseline capture over semantic rewrite of the selected slice

## IMPLEMENTATION_STEPS
1) Read `CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md` and isolate the defect to `CHECK_09`.
2) Create this recon task artifact only.
3) Patch the original brief minimally so the checkchain explicitly creates and then consumes the pre-write HEAD baseline.
4) Verify that selected first slice and future slice exact allowlist remain unchanged.
5) Stage exact allowlist only.
6) Create exactly one narrow commit.
7) STOP.

## CHECKS
CHECK_01_RECON_SCOPE_IS_ONLY_CHECK_09_REPAIR
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md","utf8");if(!t.includes("CHECK_09_POST_ONE_NARROW_COMMIT_ONLY"))process.exit(1);if(!t.includes("0a) Явно зафиксировать pre-write HEAD baseline"))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_SELECTED_FIRST_SLICE_REMAINS_UNCHANGED
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md","utf8");if(!t.includes("SELECTED_FIRST_SLICE_ID: PHASE02_DATA_CORE_PROJECT_MANIFEST_AND_PROJECT_ID_BINDING"))process.exit(1);if(!t.includes("SELECTED_FIRST_SLICE_TASK_BASENAME: CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.md"))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_03_FUTURE_SLICE_ALLOWLIST_REMAINS_UNCHANGED
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md","utf8");const req=["docs/tasks/CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.md","src/main.js","test/electron/projectManifestBinding.test.js"];for(const r of req){if(!t.includes(r))process.exit(1);}process.exit(0);'
PASS: exit 0

CHECK_04_CHECK_09_NOW_HAS_EXPLICIT_HEAD_BASELINE_SOURCE
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md","utf8");if(!t.includes("git rev-parse HEAD > /tmp/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.head"))process.exit(1);if(!t.includes("if(!fs.existsSync(p))process.exit(1);"))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_05_STAGED_SCOPE_EQUALS_EXACT_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=["docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md","docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-RECON-001.md"].sort();const got=execSync("git diff --cached --name-only",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_06_ONE_NARROW_COMMIT_ONLY
CMD: node -e 'const {execSync}=require("node:child_process");const s=execSync("git diff-tree --no-commit-id --name-only -r HEAD",{encoding:"utf8"}).trim().split("\\n").filter(Boolean);const want=["docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md","docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-RECON-001.md"].sort();if(JSON.stringify(s.sort())!==JSON.stringify(want))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_07_NO_RUNTIME_ADMISSION_NO_EXECUTION_START
CMD: node -e 'const fs=require("node:fs");const files=["docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json"];for(const f of files){const j=JSON.parse(fs.readFileSync(f,"utf8"));if(j.runtimeWritesAdmitted!==false||j.runtimeAdmissionGranted!==false||j.formalCutoverClaimed!==false||j.broadShellAdmissionClaimed!==false)process.exit(1);}const execj=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json","utf8"));if(execj.phase02ExecutionStarted!==false||execj.phase02ExecutionAttempted!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_08_NO_PR_NO_MERGE
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-RECON-001.md","utf8");if(!t.includes("any PR creation"))process.exit(1);if(!t.includes("any merge"))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_09_AFTER_SUCCESS_STOP_ONLY
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-RECON-001.md","utf8");if(!t.includes("AFTER_SUCCESS: STOP_AND_WAIT_FOR_ONE_NEW_EXPLICIT_TASK_BRIEF_ONLY"))process.exit(1);process.exit(0);'
PASS: exit 0

## COMMIT_MESSAGE_TEMPLATE
- LINE_01: CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-RECON-001
- LINE_02: SCOPE CHECK_09_REPAIR_ONLY
- LINE_03: OUTCOME COMMIT_CREATED
- LINE_04: CHECKS CHECK_01 CHECK_02 CHECK_03 CHECK_04 CHECK_05
- LINE_05: NO_RUNTIME_ADMISSION_CLAIMED_TRUE

## DELIVERY_MODE
- PUSH_REQUIRED: false
- PR_REQUIRED: false
- MERGE_REQUIRED: false
- TARGET_BASE_BRANCH: main
- no push in this task
- no PR in this task
- no merge in this task

## STOP_CONDITION
- FAIL любого CHECK → STOP без auto-fix и без расширения ALLOWLIST.
- Любой extra staged path → STOP.
- Любая попытка изменить selected first slice → STOP.
- Любая попытка изменить future slice allowlist → STOP.
- Любая попытка открыть runtime writes or runtime admission in this task → STOP.
- Любая попытка start execution in this task → STOP.
- Любая попытка создать PR или merge → STOP.

## REPORT_FORMAT
- STATUS:
- TASK_ID:
- HEAD_SHA_BEFORE:
- HEAD_SHA_AFTER:
- COMMIT_SHA:
- CHECK_RESULTS:
- STAGED_SCOPE_MATCH:
- NEXT_STEP:

## FAIL_PROTOCOL
- Любой FAIL → немедленный STOP.
- No PR in this task.
- No merge in this task.
- AFTER_SUCCESS: STOP_AND_WAIT_FOR_ONE_NEW_EXPLICIT_TASK_BRIEF_ONLY
