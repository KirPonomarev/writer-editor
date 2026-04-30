TASK_ID: EXACT_TEXT_APPLY_REAL_FIXTURE_ROOT_CREATION_001I
DOCUMENT_TYPE: HARD_TZ_EXECUTION_RECORD
STATUS: IMPLEMENTED_VERIFIED_REAL_FIXTURE_ROOT_CREATION_TEST_ONLY
TASK_MODE: WRITE_CONTOUR_IN_ISOLATED_BRANCH
ACTIVE_CANON_COMPATIBILITY: true
CANON_BOUNDARY: exact text apply foundation only
MASTER_PLAN_STAGE: STAGE_03_EXACT_TEXT_APPLY_FOUNDATION
PREVIOUS_CONTOUR: EXACT_TEXT_APPLY_STORAGE_FIXTURE_ROOT_AND_PATH_POLICY_001H
NEXT_CONTOUR_CANDIDATE: EXACT_TEXT_APPLY_FIXTURE_TEXT_WRITE_001J

GOAL: prove first real IO boundary as isolated test fixture root directory creation only
GOAL_2: keep production kernel pure and product storage untouched
GOAL_3: prove owner approved fixture root creation can bind to accepted 001H path policy without claiming backup atomic write recovery receipt ApplyTxn or release

SCOPE_IN_01: pure real fixture root creation plan compiler
SCOPE_IN_02: contract test creates OS temp fixture directory only
SCOPE_IN_03: contract test verifies OS temp isolation from repo root
SCOPE_IN_04: contract test cleans fixture root after test
SCOPE_IN_05: negative tests for missing owner policy and missing path policy
SCOPE_IN_06: negative tests for repo root product root product path public surface and storage primitive requests
SCOPE_IN_07: task record false green guard
SCOPE_IN_08: 001H scope guard hygiene so old contour does not block current contour

SCOPE_OUT_01: product write
SCOPE_OUT_02: manuscript mutation
SCOPE_OUT_03: backup execution
SCOPE_OUT_04: atomic write execution
SCOPE_OUT_05: recovery snapshot execution
SCOPE_OUT_06: receipt persistence
SCOPE_OUT_07: ApplyTxn
SCOPE_OUT_08: crash recovery
SCOPE_OUT_09: storage primitive implementation
SCOPE_OUT_10: public IPC or command surface
SCOPE_OUT_11: UI
SCOPE_OUT_12: DOCX runtime
SCOPE_OUT_13: network
SCOPE_OUT_14: dependency change
SCOPE_OUT_15: release claim

ALLOWLIST_BASENAME_01: reviewIrKernel.mjs
ALLOWLIST_BASENAME_02: exactTextApplyRealFixtureRootCreation.contract.test.js
ALLOWLIST_BASENAME_03: exactTextApplyFixtureRootPolicy.contract.test.js
ALLOWLIST_BASENAME_04: EXACT_TEXT_APPLY_REAL_FIXTURE_ROOT_CREATION_001I.md

DENYLIST_BASENAME_01: main.js
DENYLIST_BASENAME_02: preload.js
DENYLIST_BASENAME_03: editor.js
DENYLIST_BASENAME_04: index.html
DENYLIST_BASENAME_05: styles.css
DENYLIST_BASENAME_06: package.json
DENYLIST_BASENAME_07: package-lock.json
DENYLIST_BASENAME_08: command-catalog.v1.mjs
DENYLIST_BASENAME_09: projectCommands.mjs
DENYLIST_BASENAME_10: fileManager.js
DENYLIST_BASENAME_11: backupManager.js
DENYLIST_BASENAME_12: atomicWriteFile.mjs
DENYLIST_BASENAME_13: hostilePackageGate.mjs

CONTRACT_01: accepted 001H fixture root path policy may feed deterministic real fixture root creation plan
CONTRACT_02: production kernel performs no filesystem IO
CONTRACT_03: test may create one OS temp directory only after accepted creation plan
CONTRACT_04: test fixture root must not be inside repo root or product root
CONTRACT_05: test fixture root is cleaned after test
CONTRACT_06: missing owner approval compiles zero fixture root creation decisions
CONTRACT_07: missing blocked or contaminated 001H path policy compiles zero fixture root creation decisions
CONTRACT_08: repo root product root product path public surface or storage primitive requests compile zero fixture root creation decisions
CONTRACT_09: result keeps product write backup atomic write recovery receipt ApplyTxn crash recovery UI DOCX release and storage primitive flags false
CONTRACT_10: no dependency or package surface changes

TEST_FIXTURE_ROOT_CREATED: true
TEST_MUTATING_IO_SCOPE: OS_TEMP_DIRECTORY_ONLY
TEST_NON_MUTATING_IO_SCOPE: contract reads and git scope inspection allowed
TEST_CLEANUP_REQUIRED: true
KERNEL_FILESYSTEM_WRITE_PERFORMED: false
KERNEL_FS_MUTATION_PERFORMED: false
PRODUCT_WRITE_PERFORMED: false
PRODUCT_WRITE_CLAIMED: false
FIXTURE_BACKUP_CREATED: false
FIXTURE_ATOMIC_WRITE_EXECUTED: false
FIXTURE_RECOVERY_SNAPSHOT_CREATED: false
FIXTURE_RECEIPT_PERSISTED: false
DURABLE_RECEIPT_CLAIMED: false
PRODUCT_STORAGE_SAFETY_CLAIMED: false
PUBLIC_SURFACE_CLAIMED: false
DOCX_IMPORT_CLAIMED: false
UI_CHANGED: false
APPLYTXN_CLAIMED: false
CRASH_RECOVERY_CLAIMED: false
RELEASE_CLAIMED: false
STORAGE_IMPORTS_ADDED: false
STORAGE_PRIMITIVE_CHANGED: false

EXPECTED_CHANGED_BASENAMES: reviewIrKernel.mjs; exactTextApplyRealFixtureRootCreation.contract.test.js; exactTextApplyFixtureRootPolicy.contract.test.js; EXACT_TEXT_APPLY_REAL_FIXTURE_ROOT_CREATION_001I.md
DELIVERY_POLICY: COMMIT_REQUIRED true, PUSH_REQUIRED true, PR_REQUIRED true, MERGE_REQUIRED true
STOP_RULE: without owner approved PR target and merge target final status remains STOP_NOT_DONE even if implementation tests pass
COMMIT_SHA: pending
PUSH_RESULT: pending
PR_RESULT: pending
MERGE_RESULT: pending
