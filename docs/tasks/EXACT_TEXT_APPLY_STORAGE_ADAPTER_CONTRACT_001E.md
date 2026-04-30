TASK_ID: EXACT_TEXT_APPLY_STORAGE_ADAPTER_CONTRACT_001E
DOCUMENT_TYPE: HARD_TZ_LOCAL_CONTOUR_RECORD
STATUS: IMPLEMENTED_VERIFIED_CONTRACT_ONLY_NO_FS_WRITE
CANON_BOUNDARY: STAGE_03_EXACT_TEXT_APPLY_STORAGE_ADAPTER_PORT_CONTRACT_ONLY
MASTER_PLAN_BINDING: REVISION_BRIDGE_FULL_EVOLUTION_MASTER_PLAN_R3
MASTER_PLAN_STAGE: STAGE_03_EXACT_TEXT_APPLY_FOUNDATION
BASE_BRANCH_CONTEXT: ISOLATED_FEATURE_BRANCH
HEAD_SHA_BEFORE: f2ad48fe38e601056c8e0193a82ffa667ae3d7d8

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
NEXT_CONTOUR_AFTER_SUCCESS: EXACT_TEXT_APPLY_STORAGE_PORT_FIXTURE_EXECUTION_001F_OR_STAGE_04_COMMENT_SURVIVAL_PLAN

PRIMARY_GOAL: define deterministic storage adapter port contract for future exact text write without filesystem mutation
CONTOUR_TYPE: CONTRACT_ONLY_STORAGE_ADAPTER_PORT
CONTRACT_ONLY: true
PURE_DATA_ONLY: true
FS_MUTATION_PERFORMED: false
TEMP_FIXTURE_WRITE_PERFORMED: false
PRODUCT_WRITE_PERFORMED: false
PRODUCT_WRITE_CLAIMED: false
PRODUCT_MANUSCRIPT_MUTATION_CLAIMED: false
STORAGE_IMPORTS_ADDED: false
DURABLE_RECEIPT_CLAIMED: false
PRODUCT_STORAGE_SAFETY_CLAIMED: false
CRASH_RECOVERY_CLAIMED: false
APPLYTXN_CLAIMED: false
PUBLIC_SURFACE_CLAIMED: false
DOCX_IMPORT_CLAIMED: false
RELEASE_CLAIMED: false
STORAGE_PRIMITIVE_CHANGED: false

STORAGE_PRIMITIVE_POLICY: NO_IMPORTS_NO_EDITS_NO_FS_MUTATION
PUBLIC_SURFACE_POLICY: FORBIDDEN
PRODUCTION_UI_POLICY: FORBIDDEN
DOCX_RUNTIME_POLICY: FORBIDDEN
NETWORK_POLICY: FORBIDDEN
DEPENDENCY_POLICY: NO_NEW_DEPENDENCIES

ALLOWLIST_BASENAMES: reviewIrKernel.mjs; exactTextApplyStorageAdapter.contract.test.js; EXACT_TEXT_APPLY_STORAGE_ADAPTER_CONTRACT_001E.md
DENYLIST_BASENAMES: main.js; preload.js; editor.js; index.html; styles.css; package.json; package-lock.json; command-catalog.v1.mjs; projectCommands.mjs; fileManager.js; backupManager.js; atomicWriteFile.mjs; hostilePackageGate.mjs

SCOPE_IN_01: define storage adapter port capability shape
SCOPE_IN_02: define storage adapter call plan shape
SCOPE_IN_03: define backup before write observation request contract
SCOPE_IN_04: define atomic write observation request contract
SCOPE_IN_05: define recovery snapshot observation request contract
SCOPE_IN_06: compile 001D write plan contract to storage adapter call plan
SCOPE_IN_07: bind call plan to write plan hash
SCOPE_IN_08: bind call plan to receipt contract hash
SCOPE_IN_09: block if backup capability missing
SCOPE_IN_10: block if atomic write capability missing
SCOPE_IN_11: block if recovery snapshot capability missing
SCOPE_IN_12: block if product filesystem write requested
SCOPE_IN_13: block if storage port is marked non deterministic
SCOPE_IN_14: machine check task false flags
SCOPE_IN_15: static scan no filesystem storage imports or public surfaces

SCOPE_OUT_01: filesystem write
SCOPE_OUT_02: temp directory write
SCOPE_OUT_03: product project or manuscript path
SCOPE_OUT_04: backup manager import
SCOPE_OUT_05: file manager import
SCOPE_OUT_06: atomic write import
SCOPE_OUT_07: storage primitive edit
SCOPE_OUT_08: receipt persistence implementation
SCOPE_OUT_09: crash recovery implementation
SCOPE_OUT_10: project level ApplyTxn
SCOPE_OUT_11: renderer UI
SCOPE_OUT_12: public IPC
SCOPE_OUT_13: preload API
SCOPE_OUT_14: command surface
SCOPE_OUT_15: DOCX import runtime
SCOPE_OUT_16: Word or Google support
SCOPE_OUT_17: release claim

STORAGE_PORT_CAPABILITY_REQUIRED_01: CAN_BACKUP_BEFORE_WRITE
STORAGE_PORT_CAPABILITY_REQUIRED_02: CAN_ATOMIC_WRITE_SCENE_TEXT
STORAGE_PORT_CAPABILITY_REQUIRED_03: CAN_CREATE_READABLE_RECOVERY_SNAPSHOT
STORAGE_PORT_CAPABILITY_REQUIRED_04: CAN_REPORT_BEFORE_HASH
STORAGE_PORT_CAPABILITY_REQUIRED_05: CAN_REPORT_AFTER_HASH
STORAGE_PORT_CAPABILITY_REQUIRED_06: DETERMINISTIC_OBSERVATION_IDS
STORAGE_PORT_CAPABILITY_REQUIRED_07: NO_PRODUCT_PATH_ACCESS_IN_THIS_CONTOUR

CONTRACT_01: accepted 001D write plan produces one storage adapter call plan
CONTRACT_02: call plan hash is deterministic
CONTRACT_03: call plan hash changes with write plan hash
CONTRACT_04: call plan hash changes with receipt contract hash
CONTRACT_05: missing backup capability produces zero call plans
CONTRACT_06: missing atomic write capability produces zero call plans
CONTRACT_07: missing recovery capability produces zero call plans
CONTRACT_08: non deterministic port produces zero call plans
CONTRACT_09: product filesystem write request produces zero call plans
CONTRACT_10: task false flags are machine checked
CONTRACT_11: no fs storage Electron IPC preload command network Date random import or call is introduced

FALSE_GREEN_BOUNDARY_01: 001E proves storage adapter port contract not storage execution
FALSE_GREEN_BOUNDARY_02: 001E proves call plan compilation not backup execution
FALSE_GREEN_BOUNDARY_03: 001E proves mock observation request shape not atomic write execution
FALSE_GREEN_BOUNDARY_04: 001E does not prove temp fixture write
FALSE_GREEN_BOUNDARY_05: 001E does not prove product apply
FALSE_GREEN_BOUNDARY_06: 001E does not prove receipt persistence
FALSE_GREEN_BOUNDARY_07: 001E does not prove crash recovery
FALSE_GREEN_BOUNDARY_08: 001E does not prove project level ApplyTxn
FALSE_GREEN_BOUNDARY_09: 001E does not prove UI ready
FALSE_GREEN_BOUNDARY_10: 001E does not prove DOCX import ready
FALSE_GREEN_BOUNDARY_11: 001E does not prove release ready

TEST_COMMAND_01: node --test test/contracts/exactTextApplyStorageAdapter.contract.test.js
TEST_COMMAND_02: node --test test/contracts/exactTextApplyFoundation.contract.test.js test/contracts/exactTextApplyEffectPreview.contract.test.js test/contracts/exactTextApplyWritePlanReceipt.contract.test.js test/contracts/exactTextApplyStorageAdapter.contract.test.js test/contracts/reviewIrKernel.contract.test.js test/contracts/canonicalHash.contract.test.js test/contracts/staleBaselineBlocker.contract.test.js test/contracts/matchProof.contract.test.js test/contracts/parsedSurfaceRecord.contract.test.js
TEST_COMMAND_03: node --test test/contracts/hostilePackageGate.contract.test.js
TEST_COMMAND_04: node --test test/contracts/execution-profile-valid.contract.test.js test/contracts/verify-attestation.contract.test.js test/contracts/failsignal-registry.contract.test.js test/contracts/required-token-set-deterministic.contract.test.js
TEST_COMMAND_05: npm run oss:policy
TEST_COMMAND_06: git diff --check
TEST_COMMAND_07: context aware static scan for public surface drift
TEST_COMMAND_08: independent factchecker read only review
TEST_COMMAND_09: independent skeptic auditor read only review

STOP_CONDITION_01: worktree dirty before write
STOP_CONDITION_02: not on isolated feature branch
STOP_CONDITION_03: HEAD drift without owner approval
STOP_CONDITION_04: need to touch denylist basename
STOP_CONDITION_05: need to import backup manager file manager or atomic write
STOP_CONDITION_06: need to perform filesystem write
STOP_CONDITION_07: need to write temp fixture or product path
STOP_CONDITION_08: need to add UI public IPC preload command or DOCX import
STOP_CONDITION_09: need to add dependency
STOP_CONDITION_10: need to claim receipt persistence
STOP_CONDITION_11: need to claim crash recovery
STOP_CONDITION_12: need to claim ApplyTxn
STOP_CONDITION_13: any false flag cannot remain false
STOP_CONDITION_14: any test fails
STOP_CONDITION_15: auditor finds false green
STOP_CONDITION_16: PR or merge target not owner approved after push

COMMIT_OUTCOME: NOT_RUN_PENDING_PARENT_ORCHESTRATOR_DELIVERY
PUSH_RESULT: NOT_RUN_PENDING_PARENT_ORCHESTRATOR_DELIVERY
PR_RESULT: STOPPED_UNTIL_OWNER_APPROVED_ISOLATED_TARGET
MERGE_RESULT: STOPPED_UNTIL_OWNER_APPROVED_ISOLATED_TARGET
NEXT_STEP: parent orchestrator verify audit commit push then stop for owner approved PR and merge target
