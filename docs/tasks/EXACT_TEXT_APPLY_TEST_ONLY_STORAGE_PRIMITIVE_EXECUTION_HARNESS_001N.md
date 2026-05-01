TASK_ID: EXACT_TEXT_APPLY_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_001N
TASK_CLASS: HARD_TZ_WRITE_CONTOUR
STATUS: IMPLEMENTED_LOCALLY_PENDING_DELIVERY_VERIFICATION
MASTER_PLAN_STAGE: STAGE_03_EXACT_TEXT_APPLY_FOUNDATION
PREVIOUS_CONTOUR: EXACT_TEXT_APPLY_PRODUCT_STORAGE_PRIMITIVE_EVIDENCE_GATE_001M

GOAL_1: turn static 001M primitive evidence into executable test only evidence
GOAL_2: execute existing backupManager createBackup only under explicit OS temp fixture basePath
GOAL_3: execute existing fileManager writeFileAtomic only under OS temp fixture root
GOAL_4: prove path containment hash observations and cleanup for the fixture harness
GOAL_5: prevent product storage dry run product write ApplyReceipt ApplyTxn recovery UI DOCX network dependency and public surface claims

TEST_ONLY: true
EVIDENCE_LAYER_ONLY: true
PRODUCT_ADMISSION: false
PRODUCT_STORAGE_DRY_RUN_ADMITTED_BY_THIS_CONTOUR: false
THIS_DOES_NOT_ADMIT_PRODUCT_STORAGE_DRY_RUN_BY_ITSELF: true
PRODUCT_STORAGE_SAFETY_CLAIMED: false
PRODUCT_WRITE_PERFORMED: false
PRODUCT_WRITE_CLAIMED: false
DURABLE_RECEIPT_CLAIMED: false
APPLY_RECEIPT_IMPLEMENTED: false
PRODUCT_APPLY_RECEIPT_CLAIMED: false
APPLYTXN_CLAIMED: false
RECOVERY_CLAIMED: false
CRASH_RECOVERY_CLAIMED: false
PUBLIC_SURFACE_CLAIMED: false
DOCX_IMPORT_CLAIMED: false
UI_CHANGED: false
NETWORK_USED: false
DEPENDENCY_CHANGED: false
STORAGE_IMPORTS_ADDED: false
STORAGE_PRIMITIVE_CHANGED: false

CLAIM_BOUNDARY_1: THIS_DOES_NOT_PROVE_PRODUCT_STORAGE_SAFETY
CLAIM_BOUNDARY_2: THIS_DOES_NOT_PROVE_DURABLE_APPLYRECEIPT
CLAIM_BOUNDARY_3: THIS_DOES_NOT_PROVE_CRASH_RECOVERY
CLAIM_BOUNDARY_4: THIS_DOES_NOT_PROVE_PROJECT_LEVEL_APPLYTXN
CLAIM_BOUNDARY_5: THIS_DOES_NOT_AUTHORIZE_PUBLIC_SURFACE_OR_RUNTIME_APPLY
CLAIM_BOUNDARY_6: RECOVERY_TESTS_ARE_REGRESSION_ONLY_NOT_RECOVERY_CLAIM
CLAIM_BOUNDARY_7: HOSTILE_PACKAGE_TESTS_ARE_REGRESSION_ONLY_NOT_DOCX_CLAIM
CLAIM_BOUNDARY_8: ADMISSION_GUARD_TESTS_ARE_SCOPE_GUARD_NOT_PRODUCT_STORAGE_PROOF
RECOVERY_TESTS_ARE_REGRESSION_ONLY_NOT_RECOVERY_CLAIM: true
HOSTILE_PACKAGE_TESTS_ARE_REGRESSION_ONLY_NOT_DOCX_CLAIM: true
ADMISSION_GUARD_TESTS_ARE_SCOPE_GUARD_NOT_PRODUCT_STORAGE_PROOF: true

SCOPE_IN_01: pure compiler compileExactTextTestOnlyStoragePrimitiveExecutionHarness
SCOPE_IN_02: accepted 001M binding validation
SCOPE_IN_03: test only Electron documents path stub
SCOPE_IN_04: backupManager createBackup under explicit OS temp fixture basePath
SCOPE_IN_05: fileManager writeFileAtomic under OS temp fixture root
SCOPE_IN_06: fixture path containment evidence
SCOPE_IN_07: backup content and atomic write content hash evidence
SCOPE_IN_08: cleanup observed evidence
SCOPE_IN_09: negative tests for unsafe evidence variants
SCOPE_IN_10: production kernel import guard for backupManager fileManager and electron
SCOPE_IN_11: contour specific scope guard repair for 001M and 001L regression tests

SCOPE_OUT_01: product project write
SCOPE_OUT_02: manuscript mutation
SCOPE_OUT_03: real user project root
SCOPE_OUT_04: public IPC
SCOPE_OUT_05: preload API
SCOPE_OUT_06: command catalog
SCOPE_OUT_07: renderer UI
SCOPE_OUT_08: DOCX import
SCOPE_OUT_09: Word or Google support
SCOPE_OUT_10: broad parser
SCOPE_OUT_11: storage migration
SCOPE_OUT_12: project level ApplyTxn
SCOPE_OUT_13: durable product ApplyReceipt
SCOPE_OUT_14: crash recovery claim
SCOPE_OUT_15: editing backupManager
SCOPE_OUT_16: editing fileManager
SCOPE_OUT_17: editing atomicWriteFile
SCOPE_OUT_18: production import of backupManager from reviewIrKernel
SCOPE_OUT_19: production import of fileManager from reviewIrKernel
SCOPE_OUT_20: new dependency
SCOPE_OUT_21: release claim

ALLOWLIST_BASENAME_01: reviewIrKernel.mjs
ALLOWLIST_BASENAME_02: exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js
ALLOWLIST_BASENAME_03: EXACT_TEXT_APPLY_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_001N.md
ALLOWLIST_BASENAME_04: exactTextApplyProductStoragePrimitiveEvidence.contract.test.js
ALLOWLIST_BASENAME_05: exactTextApplyTestFixtureReceiptFile.contract.test.js

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

EXPECTED_RESULT_KIND: EXACT_TEXT_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_RESULT
EXPECTED_DECISION: TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_EVIDENCE_ADMITTED
EXPECTED_DECISION_COUNT: 1
NEXT_DECISION_AFTER_PASS: OWNER_MAY_PLAN_SEPARATE_PRODUCT_SHAPED_DRY_RUN_CONTOUR

MANDATORY_NEGATIVE_TEST_01: missing 001M result blocks zero decisions
MANDATORY_NEGATIVE_TEST_02: contaminated 001M product write flag blocks zero decisions
MANDATORY_NEGATIVE_TEST_03: missing Electron stub blocks zero decisions
MANDATORY_NEGATIVE_TEST_04: real documents path stub blocks zero decisions
MANDATORY_NEGATIVE_TEST_05: backup basePath omitted blocks zero decisions
MANDATORY_NEGATIVE_TEST_06: documents path outside fixture blocks zero decisions
MANDATORY_NEGATIVE_TEST_07: product root access blocks zero decisions
MANDATORY_NEGATIVE_TEST_08: repo root access blocks zero decisions
MANDATORY_NEGATIVE_TEST_09: absolute path escape blocks zero decisions
MANDATORY_NEGATIVE_TEST_10: path traversal blocks zero decisions
MANDATORY_NEGATIVE_TEST_11: backup content mismatch blocks zero decisions
MANDATORY_NEGATIVE_TEST_12: atomic write content mismatch blocks zero decisions
MANDATORY_NEGATIVE_TEST_13: fixture cleanup failure blocks pass
MANDATORY_NEGATIVE_TEST_14: public surface claim blocks zero decisions
MANDATORY_NEGATIVE_TEST_15: ApplyReceipt claim blocks zero decisions
MANDATORY_NEGATIVE_TEST_16: ApplyTxn claim blocks zero decisions
MANDATORY_NEGATIVE_TEST_17: storage primitive edit blocks zero decisions
MANDATORY_NEGATIVE_TEST_18: dependency change blocks zero decisions
MANDATORY_NEGATIVE_TEST_19: production import of backupManager blocks pass
MANDATORY_NEGATIVE_TEST_20: production import of fileManager blocks pass

DELIVERY_POLICY: COMMIT_REQUIRED true, PUSH_REQUIRED true, PR_REQUIRED true, MERGE_REQUIRED true
COMMIT_SHA: pending
PUSH_RESULT: pending
PR_RESULT: pending
MERGE_RESULT: pending
NEXT_STEP: parent orchestrator owns commit push PR and merge
