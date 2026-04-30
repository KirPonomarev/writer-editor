TASK_ID: EXACT_TEXT_APPLY_EFFECT_PREVIEW_001B
DOCUMENT_TYPE: HARD_TZ_LOCAL_CONTOUR_RECORD
STATUS: IMPLEMENTED_PENDING_LOCAL_VERIFY_AND_DELIVERY
CANON_BOUNDARY: STAGE_03_EXACT_TEXT_APPLY_EFFECT_PREVIEW_CONTRACT_ONLY
MASTER_PLAN_BINDING: DOCX_STAGE_02_CLOSURE_AND_STAGE_03_ADMISSION_001
DELIVERY_POLICY: COMMIT_REQUIRED true; PUSH_REQUIRED true; PR_REQUIRED true; MERGE_REQUIRED true
DELIVERY_TARGET_POLICY: PR_AND_MERGE_REQUIRE_OWNER_APPROVED_ISOLATED_FEATURE_TARGET
PRIMARY_GOAL: add pure contract only effect preview records from 001A contract ApplyOps without runtime apply
SCOPE_IN_01: accepted contract ApplyOp emits one exact text effect preview
SCOPE_IN_02: preview contains effectPreviewId effectPreviewKind sourceApplyOpId sourceApplyOpHash projectId sceneId baselineHash blockVersionHash exactTextBefore exactTextAfter beforeHash afterHashPreview inversePatchPreview runtimeWritable canonicalHash
SCOPE_IN_03: preview hash is deterministic
SCOPE_IN_04: preview hash changes when source ApplyOp hash text baseline or block version changes
SCOPE_IN_05: blocked or empty applyOps emit zero effect previews
SCOPE_IN_06: runtimeWritable true input blocks previews
SCOPE_IN_07: contractOnly false input blocks previews
SCOPE_IN_08: missing precondition input blocks previews
SCOPE_IN_09: static guard covers no file write storage electron network command public surface dependency or runtime apply expansion
SCOPE_OUT_01: runtime apply
SCOPE_OUT_02: file writes
SCOPE_OUT_03: backup
SCOPE_OUT_04: actual receipt
SCOPE_OUT_05: actual rollback
SCOPE_OUT_06: transaction
SCOPE_OUT_07: public surfaces
SCOPE_OUT_08: dependency changes
ALLOWLIST_BASENAMES: reviewIrKernel.mjs; exactTextApplyEffectPreview.contract.test.js; EXACT_TEXT_APPLY_EFFECT_PREVIEW_001B.md
DENYLIST_BASENAMES: main.js; preload.js; editor.js; index.html; styles.css; package.json; package-lock.json; command-catalog.v1.mjs; projectCommands.mjs; hostilePackageGate.mjs; hostilePackageGate.contract.test.js
CONTRACT_01: accepted contract ApplyOp produces one effect preview
CONTRACT_02: effect preview field set is exact and contract only
CONTRACT_03: preview hash deterministic
CONTRACT_04: preview hash changes when source ApplyOp hash changes
CONTRACT_05: preview hash changes when text changes
CONTRACT_06: preview hash changes when baseline changes
CONTRACT_07: preview hash changes when block version changes
CONTRACT_08: blocked applyOps produce zero previews
CONTRACT_09: empty applyOps produce zero previews
CONTRACT_10: runtimeWritable true input blocks
CONTRACT_11: contractOnly false input blocks
CONTRACT_12: missing precondition blocks
CONTRACT_13: no file writes actual receipt actual rollback backup transaction public surfaces or dependencies are introduced
FALSE_GREEN_BOUNDARY_01: effect preview is data only and is not executable runtime apply
FALSE_GREEN_BOUNDARY_02: runtimeWritable false means no runtime write authorization exists
FALSE_GREEN_BOUNDARY_03: inversePatchPreview is preview data only and not a rollback planner
FALSE_GREEN_BOUNDARY_04: no actual receipt backup transaction or public surface claim is made
TEST_COMMAND_01: node --test test/contracts/exactTextApplyEffectPreview.contract.test.js
TEST_COMMAND_02: node --test test/contracts/exactTextApplyFoundation.contract.test.js test/contracts/reviewIrKernel.contract.test.js test/contracts/canonicalHash.contract.test.js test/contracts/staleBaselineBlocker.contract.test.js test/contracts/matchProof.contract.test.js test/contracts/parsedSurfaceRecord.contract.test.js
COMMIT_OUTCOME: NOT_RUN_PARENT_ORCHESTRATOR_OWNS_DELIVERY
PUSH_RESULT: NOT_RUN_PARENT_ORCHESTRATOR_OWNS_DELIVERY
PR_RESULT: NOT_RUN_PARENT_ORCHESTRATOR_OWNS_DELIVERY
MERGE_RESULT: NOT_RUN_PARENT_ORCHESTRATOR_OWNS_DELIVERY
NEXT_STEP: parent orchestrator review audit commit push PR and merge
