TASK_ID: CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001
MILESTONE: A4
TYPE: CORE
STATUS: DATA_CORE_ONLY_ONE_BOUNDED_EXECUTION_SLICE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.0

## MICRO_GOAL
Выполнить ровно один реальный bounded current-lane Phase 02 execution slice только по project manifest и `projectId` binding. Этот task не смешивает recovery, command kernel, status-record work, factual-doc work, Design OS continuation, contour 03-05, PR или merge.

## ENTRY_CRITERIA
- `CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001.md` is already closed
- selected first slice is `PHASE02_DATA_CORE_PROJECT_MANIFEST_AND_PROJECT_ID_BINDING`
- runtime flags remain false
- post-activation factual sync is already closed

## ARTIFACT
- docs/tasks/CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.md

## ALLOWLIST
- docs/tasks/CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.md
- src/main.js
- test/electron/projectManifestBinding.test.js

## DENYLIST
- any recovery work
- any command kernel work
- any runtime admission policy change
- any execution start beyond this narrow slice
- any status record mutation
- any context mutation
- any handoff mutation
- any CANON mutation
- any BIBLE mutation
- any README mutation
- any scripts mutation
- any other test mutation
- any Design OS C2 work
- any contour 03, contour 04 or contour 05 work
- any PR creation
- any merge
- any scope widening

## CONTRACT / SHAPES
- TASK_CLASS: CURRENT_LANE_PHASE02_DATA_CORE_ONLY
- exact allowlist only
- exact-path staging only
- create exactly one narrow commit only
- no push in this task
- no PR in this task
- no merge in this task
- data core only
- no recovery mixing
- no command kernel mixing
- runtimeWritesAdmitted remains false
- runtimeAdmissionGranted remains false
- formalCutoverClaimed remains false
- broadShellAdmissionClaimed remains false
- phase02ExecutionStarted remains false outside this narrow slice framing
- phase02ExecutionAttempted remains false outside this narrow slice framing

## EXECUTION_SCOPE
In scope:
- repair manifest persistence so absent, malformed or partial manifest data is normalized and written back deterministically
- preserve existing valid `projectId` during manifest normalization
- prove workspace resume binding resolves by `projectId`, not legacy path or title

Out of scope:
- recovery hardening
- migration completeness hardening
- command kernel lock work
- shell state and workspace state beyond `projectId` binding proof
- any factual or status surface mutation

## IMPLEMENTATION_STEPS
0) Выполнить PRECHECK_01 и PRECHECK_02 до write-действий.
0a) Явно зафиксировать pre-write HEAD baseline: `git rev-parse HEAD > /tmp/CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.head`.
1) Создать один task artifact only for `CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.md`.
2) Изменить только `src/main.js` в части project manifest normalization and persistence.
3) Добавить ровно один test file `test/electron/projectManifestBinding.test.js`.
4) Не трогать recovery, command kernel, status records, factual docs, Design OS, contours 03-05.
5) Выполнить CHECK_01, CHECK_02 и CHECK_03.
6) Выполнить `git add --` exact paths only from ALLOWLIST.
7) Выполнить CHECK_04.
8) Создать ровно один narrow commit.
9) Выполнить CHECK_05, CHECK_06, CHECK_07 и CHECK_08.
10) STOP.

## CHECKS
CHECK_01_PROJECT_ID_CREATED_WHEN_MANIFEST_ABSENT_OR_MALFORMED
CMD: node --test test/electron/projectManifestBinding.test.js
PASS: exit 0 and test contains absent/malformed manifest coverage

CHECK_02_EXISTING_VALID_PROJECT_ID_SURVIVES_MANIFEST_NORMALIZATION
CMD: node --test test/electron/projectManifestBinding.test.js
PASS: exit 0 and test contains existing valid projectId normalization coverage

CHECK_03_WORKSPACE_BINDING_KEYS_USE_PROJECT_ID_NOT_PATH_OR_TITLE
CMD: node --test test/electron/projectManifestBinding.test.js
PASS: exit 0 and test contains projectId-based resume binding coverage

CHECK_04_POST_STAGED_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=["docs/tasks/CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.md","src/main.js","test/electron/projectManifestBinding.test.js"].sort();const got=execSync("git diff --cached --name-only",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_05_POST_ONE_NARROW_COMMIT_ONLY
CMD: node -e 'const fs=require("node:fs");const {execSync}=require("node:child_process");const p="/tmp/CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.head";if(!fs.existsSync(p))process.exit(1);const before=fs.readFileSync(p,"utf8").trim();const after=execSync("git rev-parse HEAD",{encoding:"utf8"}).trim();if(!before||!after||before===after)process.exit(1);const count=execSync(`git rev-list --count ${before}..${after}`,{encoding:"utf8"}).trim();if(count!=="1")process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_06_POST_LAST_COMMIT_SCOPE_EQUALS_ALLOWLIST
CMD: node -e 'const {execSync}=require("node:child_process");const want=["docs/tasks/CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.md","src/main.js","test/electron/projectManifestBinding.test.js"].sort();const got=execSync("git diff-tree --no-commit-id --name-only -r HEAD",{encoding:"utf8"}).trim().split("\\n").filter(Boolean).sort();if(JSON.stringify(want)!==JSON.stringify(got))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_07_POST_NO_PR_NO_MERGE
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.md","utf8");if(!t.includes("any PR creation"))process.exit(1);if(!t.includes("any merge"))process.exit(1);process.exit(0);'
PASS: exit 0

CHECK_08_AFTER_SUCCESS_STOP_ONLY
CMD: node -e 'const fs=require("node:fs");const t=fs.readFileSync("docs/tasks/CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.md","utf8");if(!t.includes("AFTER_SUCCESS: STOP_AND_WAIT_FOR_ONE_NEW_EXPLICIT_TASK_BRIEF_ONLY"))process.exit(1);process.exit(0);'
PASS: exit 0

## COMMIT_MESSAGE_TEMPLATE
- LINE_01: CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001
- LINE_02: SCOPE DATA_CORE_PROJECT_MANIFEST_AND_PROJECT_ID_BINDING_ONLY
- LINE_03: OUTCOME COMMIT_CREATED
- LINE_04: CHECKS CHECK_01 CHECK_02 CHECK_03 CHECK_04
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
- Любая попытка смешать recovery → STOP.
- Любая попытка смешать command kernel → STOP.
- Любая попытка открыть runtime admission or broad execution policy → STOP.
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
