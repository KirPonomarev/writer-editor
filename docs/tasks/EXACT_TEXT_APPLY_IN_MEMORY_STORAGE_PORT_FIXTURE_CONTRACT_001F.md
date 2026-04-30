TASK_ID: EXACT_TEXT_APPLY_IN_MEMORY_STORAGE_PORT_FIXTURE_CONTRACT_001F
DOCUMENT_TYPE: HARD_TZ_LOCAL_CONTOUR_RECORD
STATUS: IMPLEMENTED_VERIFIED_CONTRACT_ONLY_IN_MEMORY_NO_FS_WRITE
CANON_BOUNDARY: STAGE_03_EXACT_TEXT_APPLY_IN_MEMORY_STORAGE_PORT_FIXTURE_CONTRACT_ONLY
MASTER_PLAN_BINDING: REVISION_BRIDGE_FULL_EVOLUTION_MASTER_PLAN_R3
MASTER_PLAN_STAGE: STAGE_03_EXACT_TEXT_APPLY_FOUNDATION
BASE_BRANCH_CONTEXT: ISOLATED_FEATURE_BRANCH
HEAD_SHA_BEFORE: b28200c1b21eb022b866ab967f0113a46c706b1e

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
NEXT_CONTOUR_AFTER_SUCCESS: EXACT_TEXT_APPLY_REAL_STORAGE_ADMISSION_001G_OR_STAGE_04_COMMENT_SURVIVAL_PLAN

PRIMARY_GOAL: validate 001E storage adapter call plan through deterministic in memory port fixture contract without filesystem mutation
CONTOUR_TYPE: CONTRACT_ONLY_IN_MEMORY_PORT_FIXTURE
CONTRACT_ONLY: true
IN_MEMORY_ONLY: true
PURE_DATA_ONLY: true
FILESYSTEM_WRITE_PERFORMED: false
FS_MUTATION_PERFORMED: false
TEMP_DIR_USED: false
TEMP_FIXTURE_WRITE_PERFORMED: false
PRODUCT_WRITE_PERFORMED: false
PRODUCT_WRITE_CLAIMED: false
PRODUCT_STORAGE_SAFETY_CLAIMED: false
DURABLE_RECEIPT_CLAIMED: false
CRASH_RECOVERY_CLAIMED: false
APPLYTXN_CLAIMED: false
PUBLIC_SURFACE_CLAIMED: false
DOCX_IMPORT_CLAIMED: false
RELEASE_CLAIMED: false
STORAGE_IMPORTS_ADDED: false
STORAGE_PRIMITIVE_CHANGED: false

ALLOWLIST_BASENAMES: reviewIrKernel.mjs; exactTextApplyStorageAdapter.contract.test.js; exactTextApplyStoragePortFixture.contract.test.js; EXACT_TEXT_APPLY_IN_MEMORY_STORAGE_PORT_FIXTURE_CONTRACT_001F.md
DENYLIST_BASENAMES: main.js; preload.js; editor.js; index.html; styles.css; package.json; package-lock.json; command-catalog.v1.mjs; projectCommands.mjs; fileManager.js; backupManager.js; atomicWriteFile.mjs; hostilePackageGate.mjs

SCOPE_IN_01: define in memory port fixture result shape
SCOPE_IN_02: validate 001E call plan against pure in memory fixture
SCOPE_IN_03: produce backup observation with executedIo false
SCOPE_IN_04: produce atomic write observation with executedIo false
SCOPE_IN_05: produce recovery snapshot observation with executedIo false
SCOPE_IN_06: produce fixture receipt contract with durableReceipt false
SCOPE_IN_07: bind fixture result to call plan hash
SCOPE_IN_08: bind fixture result to write plan hash
SCOPE_IN_09: bind fixture result to receipt contract hash
SCOPE_IN_10: block call plan with blocked reasons
SCOPE_IN_11: block missing fixture capability
SCOPE_IN_12: block non deterministic fixture
SCOPE_IN_13: block real IO request
SCOPE_IN_14: block temp directory request
SCOPE_IN_15: block product write request
SCOPE_IN_16: block mismatched call plan request binding
SCOPE_IN_17: machine check task false flags
SCOPE_IN_18: machine check changed scope allowlist and denylist
SCOPE_IN_19: static scan no filesystem storage imports public surfaces Date random or write helpers

SCOPE_OUT_01: filesystem write
SCOPE_OUT_02: temp filesystem fixture
SCOPE_OUT_03: temp directory usage
SCOPE_OUT_04: product project or manuscript path
SCOPE_OUT_05: backup creation on disk
SCOPE_OUT_06: atomic write on disk
SCOPE_OUT_07: recovery snapshot on disk
SCOPE_OUT_08: receipt persistence
SCOPE_OUT_09: storage primitive edit
SCOPE_OUT_10: project level ApplyTxn
SCOPE_OUT_11: renderer UI
SCOPE_OUT_12: public IPC
SCOPE_OUT_13: preload API
SCOPE_OUT_14: command surface
SCOPE_OUT_15: DOCX import runtime
SCOPE_OUT_16: Word or Google support
SCOPE_OUT_17: release claim

CONTRACT_01: accepted 001E call plan produces one in memory fixture result
CONTRACT_02: fixture result hash is deterministic
CONTRACT_03: fixture result hash changes with call plan hash
CONTRACT_04: fixture result hash changes with write plan hash
CONTRACT_05: fixture result hash changes with receipt contract hash
CONTRACT_06: backup observation is present and executedIo false
CONTRACT_07: atomic write observation is present and executedIo false
CONTRACT_08: recovery snapshot observation is present and executedIo false
CONTRACT_09: blocked call plan produces zero fixture results
CONTRACT_10: non deterministic fixture produces zero fixture results
CONTRACT_11: real IO request produces zero fixture results
CONTRACT_12: temp directory request produces zero fixture results
CONTRACT_13: task false flags are machine checked
CONTRACT_14: changed scope denylist is machine checked
CONTRACT_15: no fs storage Electron IPC preload command network Date random import or call is introduced

FALSE_GREEN_BOUNDARY_01: 001F proves in memory fixture contract shape only
FALSE_GREEN_BOUNDARY_02: 001F does not prove storage execution
FALSE_GREEN_BOUNDARY_03: 001F does not prove backup execution
FALSE_GREEN_BOUNDARY_04: 001F does not prove atomic write
FALSE_GREEN_BOUNDARY_05: 001F does not prove receipt persistence
FALSE_GREEN_BOUNDARY_06: 001F does not prove crash recovery
FALSE_GREEN_BOUNDARY_07: 001F does not prove project level ApplyTxn
FALSE_GREEN_BOUNDARY_08: 001F does not prove product apply
FALSE_GREEN_BOUNDARY_09: 001F does not prove UI readiness
FALSE_GREEN_BOUNDARY_10: 001F does not prove release readiness

TEST_COMMAND_01: node --test test/contracts/exactTextApplyStoragePortFixture.contract.test.js
TEST_COMMAND_02: node --test test/contracts/exactTextApplyStorageAdapter.contract.test.js
TEST_COMMAND_03: node --test test/contracts/exactTextApplyFoundation.contract.test.js test/contracts/exactTextApplyEffectPreview.contract.test.js test/contracts/exactTextApplyWritePlanReceipt.contract.test.js test/contracts/exactTextApplyStorageAdapter.contract.test.js test/contracts/exactTextApplyStoragePortFixture.contract.test.js test/contracts/reviewIrKernel.contract.test.js test/contracts/canonicalHash.contract.test.js test/contracts/staleBaselineBlocker.contract.test.js test/contracts/matchProof.contract.test.js test/contracts/parsedSurfaceRecord.contract.test.js
TEST_COMMAND_04: node --test test/contracts/hostilePackageGate.contract.test.js
TEST_COMMAND_05: node --test test/contracts/execution-profile-valid.contract.test.js test/contracts/verify-attestation.contract.test.js test/contracts/failsignal-registry.contract.test.js test/contracts/required-token-set-deterministic.contract.test.js
TEST_COMMAND_06: npm run oss:policy
TEST_COMMAND_07: git diff --check
TEST_COMMAND_08: independent factchecker read only review
TEST_COMMAND_09: independent skeptic auditor read only review

STOP_CONDITION_01: worktree dirty before write
STOP_CONDITION_02: not on isolated feature branch
STOP_CONDITION_03: HEAD drift without owner approval
STOP_CONDITION_04: need to touch denylist basename
STOP_CONDITION_05: need to import backup manager file manager or atomic write
STOP_CONDITION_06: need to perform filesystem write
STOP_CONDITION_07: need to use temp directory
STOP_CONDITION_08: need to write temp fixture or product path
STOP_CONDITION_09: need to add UI public IPC preload command or DOCX import
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
