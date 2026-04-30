TASK_ID: EXACT_TEXT_APPLY_FOUNDATION_001A
DOCUMENT_TYPE: HARD_TZ_LOCAL_CONTOUR_RECORD
STATUS: IMPLEMENTED_PENDING_LOCAL_VERIFY_AND_DELIVERY
CANON_BOUNDARY: STAGE_03_EXACT_TEXT_APPLY_FOUNDATION_CONTRACT_ONLY_START
MASTER_PLAN_BINDING: DOCX_STAGE_02_CLOSURE_AND_STAGE_03_ADMISSION_001
DELIVERY_POLICY: COMMIT_REQUIRED true; PUSH_REQUIRED true; PR_REQUIRED true; MERGE_REQUIRED true
DELIVERY_TARGET_POLICY: PR_AND_MERGE_REQUIRE_OWNER_APPROVED_ISOLATED_FEATURE_TARGET
PR_MERGE_STOP: stopped until owner approved isolated target exists
PRIMARY_GOAL: add pure in memory contract ApplyOp patch plus test semantics for exact text decisions without runtime apply
SCOPE_IN_01: exact accepted low risk text decision compiles to one contract only ApplyOp with plan required fields
SCOPE_IN_02: runtimeWritable remains false on compile result and ApplyOp
SCOPE_IN_03: blocked decisions compile zero applyOps with explicit reason codes
SCOPE_IN_04: contract ApplyOp hash is deterministic
SCOPE_IN_05: contract ApplyOp hash changes when required fields change
SCOPE_IN_06: static guard blocks runtime write storage electron network command and public surface imports
SCOPE_OUT_01: runtime apply
SCOPE_OUT_02: file writes
SCOPE_OUT_03: backup
SCOPE_OUT_04: ApplyReceipt
SCOPE_OUT_05: ApplyTxn
SCOPE_OUT_06: DOCX import
SCOPE_OUT_07: UI
SCOPE_OUT_08: dependency changes
ALLOWLIST_BASENAMES: reviewIrKernel.mjs; exactTextApplyFoundation.contract.test.js; EXACT_TEXT_APPLY_FOUNDATION_001A.md
DENYLIST_BASENAMES: main.js; preload.js; editor.js; index.html; styles.css; package.json; package-lock.json; command-catalog.v1.mjs; projectCommands.mjs; hostilePackageGate.mjs; hostilePackageGate.contract.test.js
CONTRACT_01: accepted exact text decision emits one contract only EXACT_TEXT_REPLACE ApplyOp
CONTRACT_02: accepted and blocked outputs are contractOnly true and runtimeWritable false
CONTRACT_03: STALE_BASELINE blocks zero applyOps
CONTRACT_04: WRONG_PROJECT blocks zero applyOps
CONTRACT_05: CLOSED_SESSION blocks zero applyOps
CONTRACT_06: SCENE_MISMATCH blocks zero applyOps
CONTRACT_07: BLOCK_VERSION_MISMATCH blocks zero applyOps
CONTRACT_08: MULTI_MATCH blocks zero applyOps
CONTRACT_09: LOW_SELECTOR_CONFIDENCE blocks zero applyOps
CONTRACT_10: EXACT_TEXT_MISMATCH blocks zero applyOps
CONTRACT_11: UNSUPPORTED_SURFACE blocks zero applyOps
CONTRACT_12: STRUCTURAL_MANUAL_ONLY blocks zero applyOps
CONTRACT_13: COMMENT_APPLY_OUT_OF_SCOPE blocks zero applyOps
CONTRACT_14: MISSING_PRECONDITION blocks zero applyOps
CONTRACT_15: UNSUPPORTED_OP_KIND blocks zero applyOps
CONTRACT_16: no runtime write storage electron network command or public surface import is introduced
FALSE_GREEN_BOUNDARY_01: Contract ApplyOp is a contract record only and is not executable runtime apply
FALSE_GREEN_BOUNDARY_02: runtimeWritable false means no storage write authorization exists
FALSE_GREEN_BOUNDARY_03: exact text comparison uses caller supplied in memory text only and is not project search
FALSE_GREEN_BOUNDARY_04: no backup receipt transaction DOCX import or UI claim is made
TEST_COMMAND_01: node --test test/contracts/exactTextApplyFoundation.contract.test.js
TEST_COMMAND_02: node --test test/contracts/reviewIrKernel.contract.test.js test/contracts/canonicalHash.contract.test.js test/contracts/staleBaselineBlocker.contract.test.js test/contracts/matchProof.contract.test.js test/contracts/parsedSurfaceRecord.contract.test.js
TEST_COMMAND_03: npm run oss:policy
COMMIT_OUTCOME: NOT_RUN_PARENT_ORCHESTRATOR_OWNS_DELIVERY
PUSH_RESULT: NOT_RUN_PARENT_ORCHESTRATOR_OWNS_DELIVERY
PR_RESULT: STOPPED_UNTIL_OWNER_APPROVED_ISOLATED_TARGET
MERGE_RESULT: STOPPED_UNTIL_OWNER_APPROVED_ISOLATED_TARGET
NEXT_STEP: parent orchestrator review audit commit push PR and merge
