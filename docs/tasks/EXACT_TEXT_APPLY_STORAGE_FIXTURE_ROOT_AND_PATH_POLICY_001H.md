TASK_ID: EXACT_TEXT_APPLY_STORAGE_FIXTURE_ROOT_AND_PATH_POLICY_001H
DOCUMENT_TYPE: HARD_TZ_LOCAL_CONTOUR_RECORD
STATUS: IMPLEMENTED_VERIFIED_CONTRACT_ONLY_PATH_POLICY_NO_FS_WRITE
CANON_BOUNDARY: STAGE_03_EXACT_TEXT_APPLY_STORAGE_FIXTURE_ROOT_AND_PATH_POLICY_CONTRACT_ONLY
MASTER_PLAN_BINDING: REVISION_BRIDGE_FULL_EVOLUTION_MASTER_PLAN_R3
MASTER_PLAN_STAGE: STAGE_03_EXACT_TEXT_APPLY_FOUNDATION
BASE_BRANCH_CONTEXT: ISOLATED_FEATURE_BRANCH
HEAD_SHA_BEFORE: 280832a4d1939c877b9c761e914b752594842cef

DELIVERY_MODE: WRITE_CHAIN_ISOLATED_FEATURE_BRANCH
DELIVERY_POLICY: COMMIT_REQUIRED true; PUSH_REQUIRED true; PR_REQUIRED true; MERGE_REQUIRED true
DELIVERY_TARGET_POLICY: PR_AND_MERGE_REQUIRE_OWNER_APPROVED_ISOLATED_FEATURE_TARGET
DELIVERY_EXCEPTION_STATUS: NOT_A_DOWNGRADE_STOP_BEFORE_PR_AND_MERGE_UNTIL_OWNER_APPROVES_TARGET
DELIVERY_EXCEPTION_REASON: mainline has separate active development process and this feature work is isolated
DELIVERY_EXCEPTION_SCOPE: PR_AND_MERGE_TARGET_SELECTION_ONLY

PREVIOUS_CONTOUR_01: EXACT_TEXT_APPLY_FOUNDATION_001A
PREVIOUS_CONTOUR_02: EXACT_TEXT_APPLY_EFFECT_PREVIEW_001B
PREVIOUS_CONTOUR_03: EXACT_TEXT_APPLY_RUNTIME_ADMISSION_DECISION_001C
PREVIOUS_CONTOUR_04: EXACT_TEXT_APPLY_WRITE_PLAN_AND_RECEIPT_CONTRACT_001D
PREVIOUS_CONTOUR_05: EXACT_TEXT_APPLY_STORAGE_ADAPTER_CONTRACT_001E
PREVIOUS_CONTOUR_06: EXACT_TEXT_APPLY_IN_MEMORY_STORAGE_PORT_FIXTURE_CONTRACT_001F
PREVIOUS_CONTOUR_07: EXACT_TEXT_APPLY_STORAGE_ADMISSION_GATE_001G
NEXT_CONTOUR_AFTER_SUCCESS: EXACT_TEXT_APPLY_REAL_STORAGE_EXECUTION_OR_STAGE_04_COMMENT_SURVIVAL_PLAN

PRIMARY_GOAL: add deterministic contract only fixture root and path policy after 001G admission result without filesystem write temp dir product path public API UI DOCX execution or dependencies
CONTOUR_TYPE: CONTRACT_ONLY_FIXTURE_ROOT_AND_PATH_POLICY
CONTRACT_ONLY: true
PATH_POLICY_ONLY: true
CONSUMES_001G_ADMISSION_RESULT: true
FILESYSTEM_WRITE_PERFORMED: false
FS_MUTATION_PERFORMED: false
TEMP_DIR_USED: false
TEMP_FIXTURE_WRITE_PERFORMED: false
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
DEPENDENCIES_ADDED: false

ALLOWLIST_BASENAMES: reviewIrKernel.mjs; exactTextApplyFixtureRootPolicy.contract.test.js; exactTextApplyStorageAdmission.contract.test.js; EXACT_TEXT_APPLY_STORAGE_FIXTURE_ROOT_AND_PATH_POLICY_001H.md
DENYLIST_BASENAMES: main.js; preload.js; editor.js; index.html; styles.css; package.json; package-lock.json; command-catalog.v1.mjs; projectCommands.mjs; fileManager.js; backupManager.js; atomicWriteFile.mjs; hostilePackageGate.mjs

SCOPE_IN_01: define fixture root path policy result shape
SCOPE_IN_02: consume accepted 001G storage admission result
SCOPE_IN_03: require fixture root policy schema
SCOPE_IN_04: require explicit isolated marker
SCOPE_IN_05: reject product root
SCOPE_IN_06: reject product path
SCOPE_IN_07: reject relative traversal
SCOPE_IN_08: reject absolute path escape
SCOPE_IN_09: reject unsafe symlink policy
SCOPE_IN_10: require case collision policy
SCOPE_IN_11: require reserved name policy
SCOPE_IN_12: require long path policy
SCOPE_IN_13: carry newline and unicode hash policy forward
SCOPE_IN_14: deterministic result hash
SCOPE_IN_15: all filesystem product durable public UI DOCX storage primitive flags remain false
SCOPE_IN_16: inherited 001G blockers survive path policy
SCOPE_IN_17: machine check task false flags
SCOPE_IN_18: machine check changed scope allowlist and denylist
SCOPE_IN_19: static scan no filesystem storage imports public surfaces Date random or write helpers
SCOPE_IN_20: keep prior 001G scope guard future contour aware

SCOPE_OUT_01: filesystem write
SCOPE_OUT_02: temp directory creation
SCOPE_OUT_03: temp fixture write
SCOPE_OUT_04: product project or manuscript path write
SCOPE_OUT_05: backup creation on disk
SCOPE_OUT_06: atomic write on disk
SCOPE_OUT_07: recovery snapshot on disk
SCOPE_OUT_08: durable receipt persistence
SCOPE_OUT_09: storage primitive edit
SCOPE_OUT_10: project level ApplyTxn
SCOPE_OUT_11: renderer UI
SCOPE_OUT_12: public IPC
SCOPE_OUT_13: preload API
SCOPE_OUT_14: command surface
SCOPE_OUT_15: DOCX execution
SCOPE_OUT_16: dependency addition
SCOPE_OUT_17: release claim

CONTRACT_01: accepted 001G admission and accepted fixture root policy produce one path policy decision
CONTRACT_02: result is deterministic
CONTRACT_03: decision binds to 001G result hash and decision hash
CONTRACT_04: decision carries fixture execution call plan write plan and receipt hashes forward
CONTRACT_05: fixture root policy snapshot carries newline unicode and normalization policy
CONTRACT_06: missing fixture root schema blocks zero decisions
CONTRACT_07: missing isolated marker blocks zero decisions
CONTRACT_08: product root blocks zero decisions
CONTRACT_09: product path blocks zero decisions
CONTRACT_10: traversal blocks zero decisions
CONTRACT_11: absolute path escape blocks zero decisions
CONTRACT_12: unsafe symlink policy blocks zero decisions
CONTRACT_13: missing case reserved or long path policy blocks zero decisions
CONTRACT_14: inherited 001G blocker blocks zero decisions
CONTRACT_15: no fs storage Electron IPC preload command network Date random import or call is introduced

FALSE_GREEN_BOUNDARY_01: 001H proves fixture root and path policy contract only
FALSE_GREEN_BOUNDARY_02: 001H does not prove storage execution
FALSE_GREEN_BOUNDARY_03: 001H does not prove backup execution
FALSE_GREEN_BOUNDARY_04: 001H does not prove atomic write
FALSE_GREEN_BOUNDARY_05: 001H does not prove recovery snapshot creation
FALSE_GREEN_BOUNDARY_06: 001H does not prove receipt persistence
FALSE_GREEN_BOUNDARY_07: 001H does not prove crash recovery
FALSE_GREEN_BOUNDARY_08: 001H does not prove project level ApplyTxn
FALSE_GREEN_BOUNDARY_09: 001H does not prove product apply
FALSE_GREEN_BOUNDARY_10: 001H does not prove UI readiness
FALSE_GREEN_BOUNDARY_11: 001H does not prove release readiness

TEST_COMMAND_01: node --test test/contracts/exactTextApplyFixtureRootPolicy.contract.test.js
TEST_COMMAND_02: node --test test/contracts/exactTextApplyStorageAdmission.contract.test.js
TEST_COMMAND_03: node --test test/contracts/exactTextApplyStorageAdapter.contract.test.js test/contracts/exactTextApplyStoragePortFixture.contract.test.js
TEST_COMMAND_04: git diff --check
TEST_COMMAND_05: independent factchecker read only review
TEST_COMMAND_06: independent skeptic auditor read only review

STOP_CONDITION_01: worktree dirty before write
STOP_CONDITION_02: not on isolated feature branch
STOP_CONDITION_03: HEAD drift without owner approval
STOP_CONDITION_04: need to touch denylist basename
STOP_CONDITION_05: need to import backup manager file manager or atomic write
STOP_CONDITION_06: need to perform filesystem write
STOP_CONDITION_07: need to use temp directory
STOP_CONDITION_08: need to write temp fixture or product path
STOP_CONDITION_09: need to add UI public IPC preload command or DOCX execution
STOP_CONDITION_10: need to add dependency
STOP_CONDITION_11: need to claim durable receipt
STOP_CONDITION_12: need to claim crash recovery
STOP_CONDITION_13: need to claim ApplyTxn
STOP_CONDITION_14: any false flag cannot remain false
STOP_CONDITION_15: any test fails
STOP_CONDITION_16: auditor finds false green
STOP_CONDITION_17: PR or merge target not owner approved after push

COMMIT_OUTCOME: NOT_RUN_PENDING_PARENT_ORCHESTRATOR_DELIVERY
PUSH_RESULT: NOT_RUN_PENDING_PARENT_ORCHESTRATOR_DELIVERY
PR_RESULT: STOPPED_UNTIL_OWNER_APPROVED_ISOLATED_TARGET
MERGE_RESULT: STOPPED_UNTIL_OWNER_APPROVED_ISOLATED_TARGET
NEXT_STEP: parent orchestrator verify audit commit push then stop for owner approved PR and merge target
