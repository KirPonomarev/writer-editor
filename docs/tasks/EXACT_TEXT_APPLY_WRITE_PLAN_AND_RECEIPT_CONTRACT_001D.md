TASK_ID: EXACT_TEXT_APPLY_WRITE_PLAN_AND_RECEIPT_CONTRACT_001D
DOCUMENT_TYPE: HARD_TZ_LOCAL_CONTOUR_RECORD
STATUS: IMPLEMENTED_VERIFIED_CONTRACT_ONLY_NO_PRODUCTION_WRITE
CANON_BOUNDARY: STAGE_03_EXACT_TEXT_APPLY_WRITE_PLAN_AND_RECEIPT_CONTRACT_ONLY
MASTER_PLAN_BINDING: REVISION_BRIDGE_FULL_EVOLUTION_MASTER_PLAN_R3
MASTER_PLAN_STAGE: STAGE_03_EXACT_TEXT_APPLY_FOUNDATION
BASE_BRANCH_CONTEXT: ISOLATED_FEATURE_BRANCH
HEAD_SHA_BEFORE: ea5b1e0b6749015876bd37a4b9528f58df9eff77

DELIVERY_MODE: WRITE_CHAIN_ISOLATED_FEATURE_BRANCH
DELIVERY_POLICY: COMMIT_REQUIRED true; PUSH_REQUIRED true; PR_REQUIRED true; MERGE_REQUIRED true
DELIVERY_TARGET_POLICY: PR_AND_MERGE_REQUIRE_OWNER_APPROVED_ISOLATED_FEATURE_TARGET
DELIVERY_EXCEPTION_STATUS: NOT_A_DOWNGRADE_STOP_BEFORE_PR_AND_MERGE_UNTIL_OWNER_APPROVES_TARGET
DELIVERY_EXCEPTION_REASON: mainline has separate active development process and this feature work is isolated
DELIVERY_EXCEPTION_SCOPE: PR_AND_MERGE_TARGET_SELECTION_ONLY

PREVIOUS_CONTOUR_01: EXACT_TEXT_APPLY_FOUNDATION_001A
PREVIOUS_CONTOUR_02: EXACT_TEXT_APPLY_EFFECT_PREVIEW_001B
PREVIOUS_CONTOUR_03: EXACT_TEXT_APPLY_RUNTIME_ADMISSION_DECISION_001C
NEXT_CONTOUR_AFTER_SUCCESS: EXACT_TEXT_APPLY_TEMP_FIXTURE_STORAGE_EXECUTION_001E_OR_STAGE_04_COMMENT_SURVIVAL_PLAN

PRIMARY_GOAL: add pure in memory write plan and receipt contract for exact single scene text apply without product manuscript write
CONTOUR_TYPE: CONTRACT_ONLY_IN_MEMORY_WRITE_PLAN_AND_RECEIPT_CONTRACT
CONTRACT_ONLY: true
IN_MEMORY_ONLY: true
PRODUCTION_WRITE_PERFORMED: false
STORAGE_MUTATION_PERFORMED: false

PRODUCT_WRITE_CLAIMED: false
DURABLE_RECEIPT_CLAIMED: false
STORAGE_SAFETY_CLAIMED: false
CRASH_RECOVERY_CLAIMED: false
APPLYTXN_CLAIMED: false
PUBLIC_SURFACE_CLAIMED: false
DOCX_IMPORT_CLAIMED: false
RELEASE_CLAIMED: false
UI_CLAIMED: false
WORD_CLAIMED: false
GOOGLE_CLAIMED: false

SCOPE_IN_01: compile accepted contract ApplyOp and effect preview into one write plan contract
SCOPE_IN_02: compile accepted write plan contract into one receipt contract
SCOPE_IN_03: bind write plan to source ApplyOp hash
SCOPE_IN_04: bind write plan to effect preview hash
SCOPE_IN_05: bind receipt contract to write plan hash
SCOPE_IN_06: record before hash and expected after hash
SCOPE_IN_07: record project id scene id baseline hash and block version hash
SCOPE_IN_08: record backup atomic scene write and readable recovery snapshot requirements as requirements only
SCOPE_IN_09: block product write request
SCOPE_IN_10: block runtimeWritable input
SCOPE_IN_11: block contractOnly false input
SCOPE_IN_12: block mismatched effect preview
SCOPE_IN_13: block missing effect preview hash before hash or after hash
SCOPE_IN_14: preserve all false green flags as false

SCOPE_OUT_01: production manuscript mutation
SCOPE_OUT_02: storage primitive change
SCOPE_OUT_03: backup implementation
SCOPE_OUT_04: atomic scene write implementation
SCOPE_OUT_05: persistence of receipt contract
SCOPE_OUT_06: crash recovery implementation
SCOPE_OUT_07: project level ApplyTxn
SCOPE_OUT_08: renderer UI
SCOPE_OUT_09: public IPC
SCOPE_OUT_10: preload API
SCOPE_OUT_11: command catalog entry
SCOPE_OUT_12: DOCX import runtime
SCOPE_OUT_13: Word or Google integration
SCOPE_OUT_14: new dependency
SCOPE_OUT_15: multi scene transaction
SCOPE_OUT_16: structural apply
SCOPE_OUT_17: comment apply

ALLOWLIST_BASENAMES: reviewIrKernel.mjs; exactTextApplyWritePlanReceipt.contract.test.js; EXACT_TEXT_APPLY_WRITE_PLAN_AND_RECEIPT_CONTRACT_001D.md
DENYLIST_BASENAMES: main.js; preload.js; editor.js; index.html; styles.css; package.json; package-lock.json; command-catalog.v1.mjs; projectCommands.mjs; fileManager.js; backupManager.js; atomicWriteFile.mjs; hostilePackageGate.mjs

CONTRACT_01: accepted exact text ApplyOp plus effect preview produces one write plan contract
CONTRACT_02: accepted write plan contract produces one receipt contract
CONTRACT_03: write plan contract is deterministic
CONTRACT_04: receipt contract is deterministic
CONTRACT_05: write plan and receipt hashes change with source ApplyOp hash
CONTRACT_06: write plan and receipt hashes change with effect preview hash
CONTRACT_07: write plan and receipt hashes change with before or after hash
CONTRACT_08: stale baseline produces zero write plans
CONTRACT_09: wrong project produces zero write plans
CONTRACT_10: effect preview mismatch produces zero write plans
CONTRACT_11: product write request produces zero write plans
CONTRACT_12: runtimeWritable true produces zero write plans
CONTRACT_13: contractOnly false produces zero write plans
CONTRACT_14: missing effect preview identity fields produce zero write plans
CONTRACT_15: task record false flags are machine checked by test
CONTRACT_16: no fs storage Electron IPC preload command network Date Math random or dependency surface is introduced

FALSE_GREEN_BOUNDARY_01: 001D proves contract shape only, not product write
FALSE_GREEN_BOUNDARY_02: 001D proves in memory receipt contract only, not persistence
FALSE_GREEN_BOUNDARY_03: 001D records backup atomic write recovery requirements only, not storage safety
FALSE_GREEN_BOUNDARY_04: 001D does not prove crash recovery
FALSE_GREEN_BOUNDARY_05: 001D does not prove project level ApplyTxn
FALSE_GREEN_BOUNDARY_06: 001D does not prove public API
FALSE_GREEN_BOUNDARY_07: 001D does not prove DOCX import
FALSE_GREEN_BOUNDARY_08: 001D does not prove release readiness

TEST_COMMAND_01: node --test test/contracts/exactTextApplyWritePlanReceipt.contract.test.js
TEST_COMMAND_02: node --test test/contracts/exactTextApplyFoundation.contract.test.js test/contracts/exactTextApplyEffectPreview.contract.test.js test/contracts/exactTextApplyWritePlanReceipt.contract.test.js test/contracts/reviewIrKernel.contract.test.js test/contracts/canonicalHash.contract.test.js test/contracts/staleBaselineBlocker.contract.test.js test/contracts/matchProof.contract.test.js test/contracts/parsedSurfaceRecord.contract.test.js
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
STOP_CONDITION_05: need to mutate product manuscript
STOP_CONDITION_06: need to edit storage primitive
STOP_CONDITION_07: need to add UI public IPC preload command or DOCX import
STOP_CONDITION_08: need to add dependency
STOP_CONDITION_09: any false flag cannot remain false
STOP_CONDITION_10: any test fails
STOP_CONDITION_11: auditor finds false green
STOP_CONDITION_12: PR or merge target not owner approved after push

COMMIT_OUTCOME: NOT_RUN_PENDING_PARENT_ORCHESTRATOR_DELIVERY
PUSH_RESULT: NOT_RUN_PENDING_PARENT_ORCHESTRATOR_DELIVERY
PR_RESULT: STOPPED_UNTIL_OWNER_APPROVED_ISOLATED_TARGET
MERGE_RESULT: STOPPED_UNTIL_OWNER_APPROVED_ISOLATED_TARGET
NEXT_STEP: parent orchestrator verify audit commit push then stop for owner approved PR and merge target
