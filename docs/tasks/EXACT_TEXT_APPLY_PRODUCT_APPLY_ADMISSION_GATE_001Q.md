TASK_ID: EXACT_TEXT_APPLY_PRODUCT_APPLY_ADMISSION_GATE_001Q
TASK_CLASS: HARD_TZ_WRITE_CONTOUR
STATUS: IMPLEMENTED_LOCALLY_PENDING_DELIVERY_VERIFICATION
MASTER_PLAN_STAGE: STAGE_03_EXACT_TEXT_APPLY_FOUNDATION
PREVIOUS_CONTOUR: EXACT_TEXT_APPLY_PRODUCT_APPLY_READINESS_REVIEW_001P

GOAL_1: turn accepted 001P readiness review into strict owner bound admission to open 001R
GOAL_2: keep 001Q as admission gate only
GOAL_3: require owner admission packet separate from delivery target packet
GOAL_4: require accepted 001P binding plus 001O and 001N hash recheck
GOAL_5: keep product write runtime execution manuscript mutation public surface UI DOCX dependency and release claims blocked

PRODUCT_WRITE_IMPLEMENTATION_ALLOWED_IN_001Q: false
PRODUCT_WRITE_IMPLEMENTATION_ALLOWED_AFTER_001Q_ONLY_IN_001R: true
PRODUCT_APPLY_ADMISSION_TO_OPEN_001R_ALLOWED_IF_PASS: true
PRODUCT_APPLY_RUNTIME_EXECUTION_ALLOWED_IF_PASS: false
PRODUCT_WRITE_EXECUTION_ALLOWED_IF_PASS: false
MANUSCRIPT_MUTATION_ALLOWED_IF_PASS: false
PUBLIC_SURFACE_ALLOWED_IF_PASS: false
UI_ALLOWED_IF_PASS: false
DOCX_IMPORT_ALLOWED_IF_PASS: false
RELEASE_CLAIM_ALLOWED_IF_PASS: false

PRODUCT_APPLY_ADMITTED: false
PRODUCT_APPLY_ADMISSION_CLAIMED: false
PRODUCT_WRITE_PERFORMED: false
PRODUCT_WRITE_CLAIMED: false
MANUSCRIPT_MUTATION_PERFORMED: false
PRODUCT_STORAGE_SAFETY_CLAIMED: false
APPLY_RECEIPT_IMPLEMENTED: false
DURABLE_RECEIPT_CLAIMED: false
PRODUCT_APPLY_RECEIPT_CLAIMED: false
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

OWNER_ADMISSION_PACKET_IS_NOT_DELIVERY_TARGET: true
DELIVERY_TARGET_PACKET_IS_NOT_RUNTIME_PERMISSION: true
UI_SCREENSHOT_CHECK: NOT_APPLICABLE_NO_UI_CHANGE
DOCX_HOSTILE_GATE_USAGE: REGRESSION_ONLY_NOT_SCOPE_IN
ADMISSION_GUARD_USAGE: SCOPE_GUARD_ONLY

CLAIM_ALLOWED: PRODUCT_APPLY_ADMISSION_PLANNING_GATE_COMPLETED
CLAIM_FORBIDDEN_01: PRODUCT_WRITE_READY
CLAIM_FORBIDDEN_02: MANUSCRIPT_MUTATED
CLAIM_FORBIDDEN_03: APPLYRECEIPT_IMPLEMENTED
CLAIM_FORBIDDEN_04: APPLYTXN_IMPLEMENTED
CLAIM_FORBIDDEN_05: RECOVERY_PROVEN
CLAIM_FORBIDDEN_06: UI_READY
CLAIM_FORBIDDEN_07: DOCX_IMPORT_READY
CLAIM_FORBIDDEN_08: RELEASE_GREEN

SCOPE_IN_01: pure compiler compileExactTextProductApplyAdmissionGate
SCOPE_IN_02: accepted 001P full binding validation
SCOPE_IN_03: accepted 001O hash link validation through 001P
SCOPE_IN_04: accepted 001N hash link validation through 001O
SCOPE_IN_05: owner admission packet validation
SCOPE_IN_06: delivery target packet validation
SCOPE_IN_07: exact single scene text only admission policy
SCOPE_IN_08: product write implementation entry criteria for 001R
SCOPE_IN_09: receipt implementation entry criteria for 001R
SCOPE_IN_10: backup atomic write entry criteria for 001R
SCOPE_IN_11: recovery regression entry criteria for 001R
SCOPE_IN_12: denylist and false green guards
SCOPE_IN_13: negative test matrix for 001R

SCOPE_OUT_01: actual product write
SCOPE_OUT_02: manuscript mutation
SCOPE_OUT_03: product save path call
SCOPE_OUT_04: storage primitive import or call
SCOPE_OUT_05: backupManager edit
SCOPE_OUT_06: fileManager edit
SCOPE_OUT_07: atomicWriteFile edit
SCOPE_OUT_08: ApplyReceipt implementation
SCOPE_OUT_09: ApplyTxn implementation
SCOPE_OUT_10: storage migration
SCOPE_OUT_11: public IPC
SCOPE_OUT_12: preload API
SCOPE_OUT_13: command catalog change
SCOPE_OUT_14: renderer UI
SCOPE_OUT_15: DOCX parser expansion
SCOPE_OUT_16: Word integration
SCOPE_OUT_17: Google integration
SCOPE_OUT_18: network
SCOPE_OUT_19: new dependency
SCOPE_OUT_20: comment apply
SCOPE_OUT_21: structural apply
SCOPE_OUT_22: multi scene apply
SCOPE_OUT_23: release claim
SCOPE_OUT_24: governance token rewrite

OWNER_ADMISSION_PACKET_REQUIRED_01: packet kind EXACT_TEXT_PRODUCT_APPLY_ADMISSION_OWNER_PACKET_001Q
OWNER_ADMISSION_PACKET_REQUIRED_02: owner approved opening 001R true
OWNER_ADMISSION_PACKET_REQUIRED_03: owner approved direct product write false
OWNER_ADMISSION_PACKET_REQUIRED_04: product write still blocked until 001R true
OWNER_ADMISSION_PACKET_REQUIRED_05: public surface still blocked true
OWNER_ADMISSION_PACKET_REQUIRED_06: release claim still blocked true
OWNER_ADMISSION_PACKET_REQUIRED_07: exact text single scene only true
OWNER_ADMISSION_PACKET_REQUIRED_08: comment structural multi scene remain blocked true

DELIVERY_TARGET_PACKET_REQUIRED_01: packet kind EXACT_TEXT_PRODUCT_APPLY_DELIVERY_TARGET_PACKET_001Q
DELIVERY_TARGET_PACKET_REQUIRED_02: target branch present
DELIVERY_TARGET_PACKET_REQUIRED_03: base sha present
DELIVERY_TARGET_PACKET_REQUIRED_04: PR target policy explicit
DELIVERY_TARGET_PACKET_REQUIRED_05: merge target policy explicit
DELIVERY_TARGET_PACKET_REQUIRED_06: isolated branch policy explicit
DELIVERY_TARGET_PACKET_REQUIRED_07: mainline separate development acknowledged true

EXPECTED_RESULT_KIND: EXACT_TEXT_PRODUCT_APPLY_ADMISSION_GATE_RESULT
EXPECTED_DECISION_COUNT: 1
PASS_DECISION: OWNER_MAY_OPEN_EXACT_TEXT_PRODUCT_WRITE_IMPLEMENTATION_001R
FAIL_DECISION: PRODUCT_APPLY_IMPLEMENTATION_REMAINS_BLOCKED
EXPECTED_DECISION_DOES_NOT_MEAN_PRODUCT_WRITE_READY: true
EXPECTED_DECISION_DOES_NOT_MEAN_RUNTIME_APPLY_ALLOWED: true
EXPECTED_DECISION_DOES_NOT_MEAN_APPLYRECEIPT_IMPLEMENTED: true
EXPECTED_DECISION_DOES_NOT_MEAN_APPLYTXN_IMPLEMENTED: true

MANDATORY_NEGATIVE_TEST_01: missing 001P result blocks admission
MANDATORY_NEGATIVE_TEST_02: weak 001P result shape blocks admission
MANDATORY_NEGATIVE_TEST_03: contaminated 001P product apply admitted flag blocks admission
MANDATORY_NEGATIVE_TEST_04: contaminated 001P product write flag blocks admission
MANDATORY_NEGATIVE_TEST_05: contaminated 001P product write claimed flag blocks admission
MANDATORY_NEGATIVE_TEST_06: wrong 001P to 001O hash link blocks admission
MANDATORY_NEGATIVE_TEST_07: wrong 001O to 001N hash link blocks admission
MANDATORY_NEGATIVE_TEST_08: missing owner admission packet blocks admission
MANDATORY_NEGATIVE_TEST_09: owner admission packet tries to approve direct product write blocks admission
MANDATORY_NEGATIVE_TEST_10: owner admission packet allows public surface blocks admission
MANDATORY_NEGATIVE_TEST_11: owner admission packet allows release claim blocks admission
MANDATORY_NEGATIVE_TEST_12: missing delivery target packet blocks admission
MANDATORY_NEGATIVE_TEST_13: delivery target packet without target branch blocks admission
MANDATORY_NEGATIVE_TEST_14: delivery target packet without base sha blocks admission
MANDATORY_NEGATIVE_TEST_15: delivery target packet without isolated branch acknowledgement blocks admission
MANDATORY_NEGATIVE_TEST_16: multi scene scope blocks admission
MANDATORY_NEGATIVE_TEST_17: structural scope blocks admission
MANDATORY_NEGATIVE_TEST_18: comment apply scope blocks admission
MANDATORY_NEGATIVE_TEST_19: product write execution request blocks admission
MANDATORY_NEGATIVE_TEST_20: product save path call blocks admission
MANDATORY_NEGATIVE_TEST_21: storage primitive import or call blocks admission
MANDATORY_NEGATIVE_TEST_22: ApplyReceipt implementation claim blocks admission
MANDATORY_NEGATIVE_TEST_23: ApplyTxn claim blocks admission
MANDATORY_NEGATIVE_TEST_24: recovery claim blocks admission
MANDATORY_NEGATIVE_TEST_25: UI change blocks admission
MANDATORY_NEGATIVE_TEST_26: public surface change blocks admission
MANDATORY_NEGATIVE_TEST_27: DOCX claim blocks admission
MANDATORY_NEGATIVE_TEST_28: network use blocks admission
MANDATORY_NEGATIVE_TEST_29: dependency change blocks admission
MANDATORY_NEGATIVE_TEST_30: token or ClaimGate rewrite blocks admission
MANDATORY_NEGATIVE_TEST_31: production import of backupManager blocks pass
MANDATORY_NEGATIVE_TEST_32: production import of fileManager blocks pass
MANDATORY_NEGATIVE_TEST_33: production import of electron blocks pass

ALLOWLIST_BASENAME_01: reviewIrKernel.mjs
ALLOWLIST_BASENAME_02: exactTextApplyProductApplyAdmissionGate.contract.test.js
ALLOWLIST_BASENAME_03: EXACT_TEXT_APPLY_PRODUCT_APPLY_ADMISSION_GATE_001Q.md
ALLOWLIST_BASENAME_04: exactTextApplyProductApplyReadinessReview.contract.test.js
ALLOWLIST_BASENAME_05: exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js
ALLOWLIST_BASENAME_06: exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js
ALLOWLIST_BASENAME_07: exactTextApplyProductStoragePrimitiveEvidence.contract.test.js
ALLOWLIST_BASENAME_08: exactTextApplyTestFixtureReceiptFile.contract.test.js
ALLOWLIST_BASENAME_09: revision-bridge-pre-stage-00-admission-guard-state.mjs
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
DENYLIST_BASENAME_16: FAILSIGNAL_REGISTRY.json

DELIVERY_POLICY: COMMIT_REQUIRED true, PUSH_REQUIRED true, PR_REQUIRED true, MERGE_REQUIRED true
DELIVERY_EXCEPTION: PR_AND_MERGE_STOP_ALLOWED_UNTIL_OWNER_APPROVES_TARGET_FOR_ISOLATED_BRANCH
COMMIT_SHA: pending
PUSH_RESULT: pending
PR_RESULT: pending
MERGE_RESULT: pending
NEXT_STEP: parent orchestrator owns verification commit push PR and merge stop policy
