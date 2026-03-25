TASK_ID: CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001
MILESTONE: A4
TYPE: CORE
STATUS: EXECUTION_BRIEF_SELECTION_ONLY_RUNTIME_WRITES_NOT_ADMITTED
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Выпустить ровно один explicit brief, который выбирает первый bounded current-lane Phase 02 execution slice, но не стартует его в этом run. Этот task не выполняет runtime writes, не открывает runtime admission, не стартует execution, не трогает Design OS C2 и не меняет factual status records.

## ENTRY_CRITERIA
- `CORE-A4-YALKEN-PHASE02-POST-ACTIVATION-FACTUAL-SYNC-001.md` is already closed
- current-lane factual docs now point to `OPEN_ONE_NEW_EXPLICIT_POST_ACTIVATION_EXECUTION_BRIEF_ONLY`
- runtime flags remain false across ledger, owner, prep-only and execution-admission records
- no concrete Phase 02 execution slice is yet selected

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md

## DENYLIST
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

## CONTRACT / SHAPES
- TASK_CLASS: CURRENT_LANE_PHASE02_EXECUTION_BRIEF_SELECTION_ONLY
- SELECTED_FIRST_SLICE_ID: PHASE02_DATA_CORE_PROJECT_MANIFEST_AND_PROJECT_ID_BINDING
- SELECTED_FIRST_SLICE_TASK_BASENAME: CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.md
- exact allowlist only
- exact-path staging only
- create exactly one narrow commit only
- no push in this task
- no PR in this task
- no merge in this task
- this task selects one slice only and does not start it
- runtimeWritesAdmitted remains false
- runtimeAdmissionGranted remains false
- formalCutoverClaimed remains false
- broadShellAdmissionClaimed remains false
- phase02ExecutionStarted remains false
- phase02ExecutionAttempted remains false

## SELECTION_DECISION
First bounded Phase 02 execution slice:
- `PHASE02_DATA_CORE_PROJECT_MANIFEST_AND_PROJECT_ID_BINDING`

Why this slice is first:
- `CANON.md` and `docs/BIBLE.md` place Phase 02 on data core, recovery and command kernel stabilization before later shell work
- this brief must not mix data core, recovery and command kernel in one slice
- `projectId` and project manifest invariants are explicitly named in `docs/BIBLE.md` as binding data-core identity rules
- `src/main.js` already contains the narrow manifest and project-binding seams needed for a bounded first execution slice

Explicitly out of scope for the first slice:
- atomic write hardening beyond existing path
- migration retry and completeness hardening
- recovery smoke expansion
- command kernel lock work
- any shell core, spatial layer, contour 03-05 or Design OS continuation

## FUTURE_EXECUTION_SLICE_CONTRACT
Future task basename:
- `CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.md`

Future slice micro-goal:
- harden project manifest normalization and `projectId` binding invariants without mixing recovery or command-kernel work

Future slice exact allowlist:
- docs/tasks/CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.md
- src/main.js
- test/electron/projectManifestBinding.test.js

Future slice required checks:
- `projectId` is created when manifest is absent or malformed
- existing valid `projectId` survives manifest normalization
- workspace binding keys continue to use `projectId`, not path or title
- staged scope equals exact allowlist
- runtime flags remain false until a later task explicitly changes them

Future slice stop conditions:
- any attempt to mix recovery hardening into the same slice
- any attempt to mix command kernel work into the same slice
- any runtime admission attempt
- any execution start attempt
- any scope outside future exact allowlist

Future slice commit outcome policy:
- exactly one narrow commit only

## IMPLEMENTATION_STEPS
0) Выполнить CHECK_01, CHECK_02 и CHECK_03 до любых write-действий.
0a) Явно зафиксировать pre-write HEAD baseline: `git rev-parse HEAD > /tmp/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.head`.
1) Создать один task artifact only for `CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md`.
2) Зафиксировать ровно один first execution slice and its future exact allowlist, checks, stop conditions and commit policy.
3) Не стартовать execution slice и не открывать runtime admission.
4) Выполнить CHECK_04, CHECK_05, CHECK_06 и CHECK_07.
5) Выполнить `git add --` exact path only from ALLOWLIST.
6) Выполнить CHECK_08.
7) Создать ровно один narrow commit.
8) Выполнить CHECK_09 и CHECK_10.
9) STOP.

## CHECKS
CHECK_01_PRE_POST_ACTIVATION_STATE_CONFIRMED
CMD: node -e 'const fs=require("node:fs");const c=fs.readFileSync("docs/CONTEXT.md","utf8");const h=fs.readFileSync("docs/HANDOFF.md","utf8");if(!c.includes("one new explicit post-activation execution brief only"))process.exit(1);if(!h.includes("one new explicit post-activation execution brief only"))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_02_PRE_NEXT_STEP_FORMULA_CONFIRMED
CMD: node -e 'const fs=require("node:fs");const want="OPEN_ONE_NEW_EXPLICIT_POST_ACTIVATION_EXECUTION_BRIEF_ONLY";const files=["docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json"];for(const f of files){const j=JSON.parse(fs.readFileSync(f,"utf8"));if(j.nextStep!==want)process.exit(1);}process.exit(0);'
PASS: exit 0

CHECK_03_PRE_RUNTIME_FLAGS_ALL_FALSE
CMD: node -e 'const fs=require("node:fs");const files=["docs/OPS/STATUS/CURRENT_LANE_COMMIT_REMEDIATION_LEDGER_V1.json","docs/OPS/STATUS/CURRENT_LANE_OWNER_BLOCKER_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_PREP_ONLY_DECISION_RECORD_V1.json","docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json"];for(const f of files){const j=JSON.parse(fs.readFileSync(f,"utf8"));if(j.runtimeWritesAdmitted!==false||j.runtimeAdmissionGranted!==false||j.formalCutoverClaimed!==false||j.broadShellAdmissionClaimed!==false)process.exit(1);}const execj=JSON.parse(fs.readFileSync("docs/OPS/STATUS/CURRENT_LANE_PHASE02_EXECUTION_ADMISSION_DECISION_RECORD_V1.json","utf8"));if(execj.phase02ExecutionStarted!==false||execj.phase02ExecutionAttempted!==false)process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_04_POST_ONLY_ONE_NEW_TASK_ARTIFACT_CREATED
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md","utf8");if(!t.includes("TASK_ID: CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001"))process.exit(1);if(!t.includes("TYPE: CORE"))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_05_POST_BRIEF_SELECTS_EXACTLY_ONE_SLICE
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md","utf8");const req=["SELECTED_FIRST_SLICE_ID: PHASE02_DATA_CORE_PROJECT_MANIFEST_AND_PROJECT_ID_BINDING","SELECTED_FIRST_SLICE_TASK_BASENAME: CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.md","Future slice exact allowlist:"];for(const r of req){if(!t.includes(r))process.exit(1);}if(t.includes("RECOVERY_AND_COMMAND_KERNEL"))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_06_POST_BRIEF_DOES_NOT_START_EXECUTION
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md","utf8");const req=["this task selects one slice only and does not start it","- no push in this task","- no PR in this task","- no merge in this task"];for(const r of req){if(!t.includes(r))process.exit(1);}process.exit(0);'
PASS: exit 0

CHECK_07_POST_BRIEF_DOES_NOT_ADMIT_RUNTIME_WRITES
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md","utf8");const req=["runtimeWritesAdmitted remains false","runtimeAdmissionGranted remains false","phase02ExecutionStarted remains false","phase02ExecutionAttempted remains false"];for(const r of req){if(!t.includes(r))process.exit(1);}process.exit(0);'
PASS: exit 0

CHECK_08_POST_STAGED_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=["docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md"];const got=execSync("git diff --cached --name-only",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_09_POST_ONE_NARROW_COMMIT_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const p="/tmp/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.head";if(!fs.existsSync(p))process.exit(1);const before=fs.readFileSync(p,"utf8").trim();const after=execSync("git rev-parse HEAD",{encoding:"utf8"}).trim();if(!before||!after||before===after)process.exit(1);const count=execSync(`git rev-list --count ${before}..${after}`,{encoding:"utf8"}).trim();if(count!=="1")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_10_POST_NO_PR_NO_MERGE
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md","utf8");if(!t.includes("any PR creation"))process.exit(1);if(!t.includes("any merge"))process.exit(1);process.exit(0);'
PASS: exit 0

## COMMIT_MESSAGE_TEMPLATE
- LINE_01: CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001
- LINE_02: SCOPE FIRST_BOUNDED_EXECUTION_BRIEF_ONLY
- LINE_03: OUTCOME COMMIT_CREATED
- LINE_04: CHECKS CHECK_01 CHECK_02 CHECK_03 CHECK_04 CHECK_05 CHECK_06 CHECK_07 CHECK_08
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
- Любая попытка открыть runtime writes or runtime admission in this task → STOP.
- Любая попытка start execution in this task → STOP.
- Любая попытка смешать recovery or command kernel with the selected data-core slice → STOP.
- Любая попытка создать PR или merge → STOP.

## REPORT_FORMAT
- STATUS:
- TASK_ID:
- HEAD_SHA_BEFORE:
- HEAD_SHA_AFTER:
- COMMIT_SHA:
- CHECK_RESULTS:
- STAGED_SCOPE_MATCH:
- RUNTIME_FLAGS_STATE:
- NEXT_STEP:

## FAIL_PROTOCOL
- Любой FAIL → немедленный STOP.
- No PR in this task.
- No merge in this task.
- AFTER_SUCCESS: STOP_AND_WAIT_FOR_ONE_NEW_EXPLICIT_TASK_BRIEF_ONLY
