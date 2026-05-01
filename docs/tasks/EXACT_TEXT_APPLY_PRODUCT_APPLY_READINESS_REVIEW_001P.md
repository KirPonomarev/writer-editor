TASK_ID: EXACT_TEXT_APPLY_PRODUCT_APPLY_READINESS_REVIEW_001P
TASK_CLASS: HARD_TZ_WRITE_CONTOUR
STATUS: IMPLEMENTED_LOCALLY_PENDING_DELIVERY_VERIFICATION
MASTER_PLAN_STAGE: STAGE_03_EXACT_TEXT_APPLY_FOUNDATION
PREVIOUS_CONTOUR: EXACT_TEXT_APPLY_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_001O

GOAL_1: review readiness for future exact text product apply admission without product write
GOAL_2: require full accepted 001O binding and 001N hash link recheck
GOAL_3: define exact text precondition requirements matrix
GOAL_4: define static product storage surface requirements matrix
GOAL_5: define receipt shape requirements matrix without implementing ApplyReceipt
GOAL_6: emit local owner decision packet for planning 001Q only

PRODUCT_APPLY_ADMISSION_ALLOWED: false
PRODUCT_WRITE_EXECUTION_ALLOWED: false
PRODUCT_APPLY_ADMISSION_CLAIMED: false
PRODUCT_APPLY_ADMITTED: false
PRODUCT_WRITE_PERFORMED: false
PRODUCT_WRITE_CLAIMED: false
MANUSCRIPT_MUTATION_PERFORMED: false
PRODUCT_STORAGE_SAFETY_CLAIMED: false
RECEIPT_REQUIREMENTS_ARE_DRAFT_ONLY: true
RECEIPT_REQUIREMENTS_MARKED_IMPLEMENTED: false
APPLY_RECEIPT_IMPLEMENTED: false
DURABLE_RECEIPT_CLAIMED: false
PRODUCT_APPLY_RECEIPT_CLAIMED: false
PRODUCT_STORAGE_SURFACE_REQUIREMENTS_ARE_STATIC_ONLY: true
RUNTIME_STORAGE_SCAN_REQUESTED: false
STORAGE_PRIMITIVE_IMPORT_OR_CALL: false
PRODUCT_SAVE_PATH_CALL: false
STORAGE_IMPORTS_ADDED: false
STORAGE_PRIMITIVE_CHANGED: false
APPLYTXN_CLAIMED: false
APPLYTXN_IMPLEMENTED: false
RECOVERY_CLAIMED: false
CRASH_RECOVERY_CLAIMED: false
PUBLIC_SURFACE_CLAIMED: false
DOCX_IMPORT_CLAIMED: false
UI_CHANGED: false
NETWORK_USED: false
DEPENDENCY_CHANGED: false
COMMENT_APPLY_CLAIMED: false
STRUCTURAL_APPLY_CLAIMED: false
MULTI_SCENE_APPLY_CLAIMED: false

OWNER_DECISION_PACKET_IS_LOCAL_CONTOUR_ONLY: true
OWNER_DECISION_PACKET_IS_RELEASE_GATE: false
UI_SCREENSHOT_CHECK: NOT_APPLICABLE_NO_UI_CHANGE
DOCX_HOSTILE_GATE_USAGE: REGRESSION_ONLY_NOT_SCOPE_IN
ADMISSION_GUARD_USAGE: SCOPE_GUARD_ONLY

CLAIM_ALLOWED: PRODUCT_APPLY_READINESS_REVIEW_COMPLETED
CLAIM_FORBIDDEN_01: PRODUCT_APPLY_ADMITTED
CLAIM_FORBIDDEN_02: PRODUCT_WRITE_PERFORMED
CLAIM_FORBIDDEN_03: PRODUCT_STORAGE_SAFE
CLAIM_FORBIDDEN_04: APPLYRECEIPT_PROVEN
CLAIM_FORBIDDEN_05: APPLYTXN_PROVEN
CLAIM_FORBIDDEN_06: RECOVERY_PROVEN
CLAIM_FORBIDDEN_07: UI_READY
CLAIM_FORBIDDEN_08: DOCX_IMPORT_READY
CLAIM_FORBIDDEN_09: RELEASE_GREEN

SCOPE_IN_01: pure compiler compileExactTextProductApplyReadinessReview
SCOPE_IN_02: accepted 001O full binding validation
SCOPE_IN_03: accepted 001N hash link recheck through 001O
SCOPE_IN_04: exact text precondition requirements matrix
SCOPE_IN_05: static product storage surface requirements matrix
SCOPE_IN_06: receipt shape requirements matrix
SCOPE_IN_07: backup atomic write requirements matrix
SCOPE_IN_08: product apply admission gap list
SCOPE_IN_09: negative test matrix for 001Q
SCOPE_IN_10: local owner decision packet for 001Q planning only

SCOPE_OUT_01: real product write
SCOPE_OUT_02: manuscript mutation
SCOPE_OUT_03: product apply admission
SCOPE_OUT_04: storage primitive import or call
SCOPE_OUT_05: product save path call
SCOPE_OUT_06: storage primitive edit
SCOPE_OUT_07: product save path edit
SCOPE_OUT_08: UI or renderer change
SCOPE_OUT_09: public IPC preload or command surface
SCOPE_OUT_10: DOCX parser expansion
SCOPE_OUT_11: Word or Google integration
SCOPE_OUT_12: storage schema migration
SCOPE_OUT_13: ApplyTxn implementation
SCOPE_OUT_14: durable ApplyReceipt implementation
SCOPE_OUT_15: recovery claim
SCOPE_OUT_16: comment apply
SCOPE_OUT_17: structural apply
SCOPE_OUT_18: multi scene apply
SCOPE_OUT_19: new dependency
SCOPE_OUT_20: network
SCOPE_OUT_21: release claim
SCOPE_OUT_22: pre stage zero governance rewrite
SCOPE_OUT_23: token catalog or ClaimGate rewrite

PRECONDITION_REQUIREMENTS_MATRIX_FIELDS: PROJECT_ID_TEST; SCENE_ID_TEST; BASELINE_HASH_TEST; BLOCK_VERSION_HASH_TEST; EXACT_TEXT_GUARD; SESSION_OPEN_TEST; LOW_RISK_EXACT_TEXT_ONLY; COMMENT_APPLY_BLOCKED; STRUCTURAL_APPLY_BLOCKED; MULTI_SCENE_APPLY_BLOCKED
STATIC_PRODUCT_STORAGE_SURFACE_REQUIREMENTS_FIELDS: BACKUP_BEFORE_WRITE_REQUIRED; ATOMIC_WRITE_REQUIRED; PRODUCT_SAVE_PATH_OWNER_APPROVAL_REQUIRED; NO_STORAGE_PRIMITIVE_EDIT_REQUIRED; NO_PUBLIC_SURFACE_REQUIRED; NO_RUNTIME_PATH_INPUTS_IN_001P
RECEIPT_SHAPE_REQUIREMENTS_FIELDS: RECEIPT_KIND; PROJECT_ID; SCENE_ID; APPLY_OP_ID; SOURCE_APPLY_OP_HASH; BEFORE_SCENE_HASH; AFTER_SCENE_HASH; BACKUP_OBSERVATION_HASH; ATOMIC_WRITE_OBSERVATION_HASH; PRECONDITION_RESULTS; BLOCKED_REASONS; RUNTIME_SURFACE_FALSE_FLAGS
OWNER_DECISION_PACKET_FIELDS: MAY_PLAN_001Q; REQUIRED_OWNER_APPROVAL; REQUIRED_TARGET_BRANCH; REQUIRED_BASE_SHA; PRODUCT_WRITE_STILL_BLOCKED; PRODUCT_APPLY_ADMISSION_STILL_BLOCKED_UNTIL_001Q

EXPECTED_RESULT_KIND: EXACT_TEXT_PRODUCT_APPLY_READINESS_REVIEW_RESULT
EXPECTED_DECISION: OWNER_MAY_PLAN_PRODUCT_APPLY_ADMISSION_001Q
EXPECTED_DECISION_COUNT: 1
EXPECTED_FAIL_DECISION: PRODUCT_APPLY_PATH_REMAINS_BLOCKED
EXPECTED_DECISION_DOES_NOT_MEAN_PRODUCT_APPLY_ADMITTED: true
EXPECTED_DECISION_DOES_NOT_MEAN_PRODUCT_WRITE_ALLOWED: true
EXPECTED_DECISION_DOES_NOT_MEAN_APPLYRECEIPT_IMPLEMENTED: true
EXPECTED_DECISION_DOES_NOT_MEAN_APPLYTXN_IMPLEMENTED: true

MANDATORY_NEGATIVE_TEST_01: missing 001O result blocks readiness pass
MANDATORY_NEGATIVE_TEST_02: missing 001O full binding shape blocks readiness pass
MANDATORY_NEGATIVE_TEST_03: contaminated 001O product apply flag blocks readiness pass
MANDATORY_NEGATIVE_TEST_04: wrong 001O to 001N hash link blocks readiness pass
MANDATORY_NEGATIVE_TEST_05: missing requirements matrix blocks readiness pass
MANDATORY_NEGATIVE_TEST_06: missing precondition blocker blocks readiness pass
MANDATORY_NEGATIVE_TEST_07: missing receipt shape requirement blocks readiness pass
MANDATORY_NEGATIVE_TEST_08: invalid owner decision packet blocks readiness pass
MANDATORY_NEGATIVE_TEST_09: owner decision packet marked release gate blocks readiness pass
MANDATORY_NEGATIVE_TEST_10: product apply admission allowed blocks readiness pass
MANDATORY_NEGATIVE_TEST_11: product write execution allowed blocks readiness pass
MANDATORY_NEGATIVE_TEST_12: product write claim blocks readiness pass
MANDATORY_NEGATIVE_TEST_13: receipt requirements marked implemented blocks readiness pass
MANDATORY_NEGATIVE_TEST_14: runtime storage scan blocks readiness pass
MANDATORY_NEGATIVE_TEST_15: storage primitive import or call blocks readiness pass
MANDATORY_NEGATIVE_TEST_16: product save path call blocks readiness pass
MANDATORY_NEGATIVE_TEST_17: recovery claim blocks readiness pass
MANDATORY_NEGATIVE_TEST_18: ApplyTxn claim blocks readiness pass
MANDATORY_NEGATIVE_TEST_19: public surface change blocks readiness pass
MANDATORY_NEGATIVE_TEST_20: DOCX claim blocks readiness pass
MANDATORY_NEGATIVE_TEST_21: network use blocks readiness pass
MANDATORY_NEGATIVE_TEST_22: dependency change blocks readiness pass
MANDATORY_NEGATIVE_TEST_23: comment apply claim blocks readiness pass
MANDATORY_NEGATIVE_TEST_24: structural apply claim blocks readiness pass
MANDATORY_NEGATIVE_TEST_25: multi scene apply claim blocks readiness pass
MANDATORY_NEGATIVE_TEST_26: governance rewrite blocks readiness pass
MANDATORY_NEGATIVE_TEST_27: token or ClaimGate rewrite blocks readiness pass
MANDATORY_NEGATIVE_TEST_28: production import of backupManager blocks pass
MANDATORY_NEGATIVE_TEST_29: production import of fileManager blocks pass

ALLOWLIST_BASENAME_01: reviewIrKernel.mjs
ALLOWLIST_BASENAME_02: exactTextApplyProductApplyReadinessReview.contract.test.js
ALLOWLIST_BASENAME_03: EXACT_TEXT_APPLY_PRODUCT_APPLY_READINESS_REVIEW_001P.md
ALLOWLIST_BASENAME_04: exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js
ALLOWLIST_BASENAME_05: exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js
ALLOWLIST_BASENAME_06: exactTextApplyProductStoragePrimitiveEvidence.contract.test.js
ALLOWLIST_BASENAME_07: exactTextApplyTestFixtureReceiptFile.contract.test.js
ALLOWLIST_SCOPE_GUARD_REPAIR_ONLY: true

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
DENYLIST_BASENAME_14: TOKEN_CATALOG.json
DENYLIST_BASENAME_15: CRITICAL_CLAIM_MATRIX.json
DENYLIST_BASENAME_16: REQUIRED_TOKEN_SET.json
DENYLIST_BASENAME_17: FAILSIGNAL_REGISTRY.json

DELIVERY_POLICY: COMMIT_REQUIRED true, PUSH_REQUIRED true, PR_REQUIRED true, MERGE_REQUIRED true
COMMIT_SHA: pending
PUSH_RESULT: pending
PR_RESULT: pending
MERGE_RESULT: pending
NEXT_STEP: parent orchestrator owns verification commit push PR and merge stop policy
