TASK_ID: EXACT_TEXT_APPLY_TEST_FIXTURE_TEXT_WRITE_001J
DOCUMENT_TYPE: HARD_TZ_EXECUTION_RECORD
STATUS: IMPLEMENTED_VERIFIED_TEST_FIXTURE_TEXT_WRITE_ONLY
TASK_MODE: WRITE_CONTOUR_IN_ISOLATED_BRANCH
ACTIVE_CANON_COMPATIBILITY: true
CANON_BOUNDARY: exact text apply foundation only
MASTER_PLAN_STAGE: STAGE_03_EXACT_TEXT_APPLY_FOUNDATION
PREVIOUS_CONTOUR: EXACT_TEXT_APPLY_REAL_FIXTURE_ROOT_CREATION_001I
NEXT_CONTOUR_CANDIDATE: EXACT_TEXT_APPLY_TEST_FIXTURE_ATOMIC_WRITE_OBSERVATION_001K

GOAL: prove test only fixture file write inside isolated OS temp fixture root
GOAL_2: keep production kernel pure and product storage untouched
GOAL_3: prove before and after text hash observation without claiming durable receipt

SCOPE_IN_01: pure test fixture text write plan compiler
SCOPE_IN_02: accepted 001I fixture root creation plan binding
SCOPE_IN_03: contract test writes one OS temp file only
SCOPE_IN_04: contract test reads fixture file back for hash observation
SCOPE_IN_05: contract test cleans fixture root after test
SCOPE_IN_06: negative tests for missing owner policy and missing 001I plan
SCOPE_IN_07: negative tests for contaminated 001I upstream flags
SCOPE_IN_08: negative tests for product path repo root public surface and storage primitive requests
SCOPE_IN_09: hash mismatch negative tests
SCOPE_IN_10: task record false green guard
SCOPE_IN_11: 001I scope guard hygiene so old contour does not block current contour

SCOPE_OUT_01: product write
SCOPE_OUT_02: manuscript mutation
SCOPE_OUT_03: backup execution
SCOPE_OUT_04: atomic write execution
SCOPE_OUT_05: product atomicity claim
SCOPE_OUT_06: recovery snapshot execution
SCOPE_OUT_07: product recovery claim
SCOPE_OUT_08: receipt persistence
SCOPE_OUT_09: durable ApplyReceipt claim
SCOPE_OUT_10: ApplyTxn
SCOPE_OUT_11: crash recovery
SCOPE_OUT_12: storage primitive implementation
SCOPE_OUT_13: public IPC or command surface
SCOPE_OUT_14: UI
SCOPE_OUT_15: DOCX runtime
SCOPE_OUT_16: network
SCOPE_OUT_17: dependency change
SCOPE_OUT_18: release claim

ALLOWLIST_BASENAME_01: reviewIrKernel.mjs
ALLOWLIST_BASENAME_02: exactTextApplyTestFixtureTextWrite.contract.test.js
ALLOWLIST_BASENAME_03: exactTextApplyRealFixtureRootCreation.contract.test.js
ALLOWLIST_BASENAME_04: EXACT_TEXT_APPLY_TEST_FIXTURE_TEXT_WRITE_001J.md

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

CONTRACT_01: accepted 001I result may feed deterministic test fixture text write plan
CONTRACT_02: production kernel performs no filesystem IO
CONTRACT_03: test mutating IO is OS temp file write only
CONTRACT_04: fixture write path is single segment relative path inherited through accepted fixture path policy
CONTRACT_05: product root product path repo root and public surface requests compile zero fixture text write decisions
CONTRACT_06: contaminated upstream 001I false flags compile zero fixture text write decisions
CONTRACT_07: write test verifies beforeHash and afterHash as hash observation only
CONTRACT_08: hash mismatch compiles zero fixture text write decisions
CONTRACT_09: cleanup removes fixture root and written fixture file
CONTRACT_10: no product storage safety claim is emitted
CONTRACT_11: no backup atomic recovery receipt ApplyTxn crash recovery UI DOCX release or storage primitive claim is emitted
CONTRACT_12: no dependency or package surface changes

TEST_FIXTURE_TEXT_WRITTEN: true
TEST_MUTATING_IO_SCOPE: OS_TEMP_FILE_ONLY
TEST_NON_MUTATING_IO_SCOPE: contract reads and git scope inspection allowed
TEST_CLEANUP_REQUIRED: true
HASH_OBSERVATION_ONLY: true
HASH_OBSERVATION_NOT_RECEIPT: true
TEST_CLEANUP_NOT_RECOVERY: true
NO_PRODUCT_ATOMICITY_CLAIM: true
NO_PRODUCT_STORAGE_ADAPTER_CLAIM: true
NO_STORAGE_PRIMITIVE_IMPLEMENTATION: true
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

EXPECTED_CHANGED_BASENAMES: reviewIrKernel.mjs; exactTextApplyTestFixtureTextWrite.contract.test.js; exactTextApplyRealFixtureRootCreation.contract.test.js; EXACT_TEXT_APPLY_TEST_FIXTURE_TEXT_WRITE_001J.md
DELIVERY_POLICY: COMMIT_REQUIRED true, PUSH_REQUIRED true, PR_REQUIRED true, MERGE_REQUIRED true
STOP_RULE: without owner approved PR target and merge target final status remains STOP_NOT_DONE even if implementation tests pass
COMMIT_SHA: pending
PUSH_RESULT: pending
PR_RESULT: pending
MERGE_RESULT: pending
