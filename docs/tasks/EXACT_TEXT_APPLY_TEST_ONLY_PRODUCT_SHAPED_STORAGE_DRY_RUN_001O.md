TASK_ID: EXACT_TEXT_APPLY_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_001O
TASK_CLASS: HARD_TZ_WRITE_CONTOUR
STATUS: IMPLEMENTED_LOCALLY_PENDING_DELIVERY_VERIFICATION
MASTER_PLAN_STAGE: STAGE_03_EXACT_TEXT_APPLY_FOUNDATION
PREVIOUS_CONTOUR: EXACT_TEXT_APPLY_TEST_ONLY_STORAGE_PRIMITIVE_EXECUTION_HARNESS_001N

GOAL_1: turn 001N test only storage primitive execution evidence into product shaped fixture dry run evidence
GOAL_2: prove exact text preconditions are checked before any fixture dry run evidence is admitted
GOAL_3: prove fixture manifest stub is inert and cannot become project truth
GOAL_4: prove test only dry run receipt observation is not durable ApplyReceipt
GOAL_5: keep product apply admission product write ApplyTxn recovery UI DOCX network dependency and public surface claims blocked

TEST_ONLY: true
PRODUCT_SHAPED_FIXTURE_ONLY: true
PRODUCT_ADMISSION: false
PRODUCT_APPLY_ADMISSION_CLAIMED: false
PRODUCT_APPLY_ADMITTED: false
PRODUCT_STORAGE_DRY_RUN_ADMITTED_BY_THIS_CONTOUR: false
PRODUCT_STORAGE_SAFETY_CLAIMED: false
PRODUCT_WRITE_PERFORMED: false
PRODUCT_WRITE_CLAIMED: false
MANUSCRIPT_MUTATION_PERFORMED: false
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
COMMENT_APPLY_CLAIMED: false
STRUCTURAL_APPLY_CLAIMED: false
MULTI_SCENE_APPLY_CLAIMED: false

FIXTURE_MANIFEST_STUB_IS_NOT_PROJECT_TRUTH: true
TEST_ONLY_DRY_RUN_RECEIPT_IS_NOT_APPLYRECEIPT: true
FIXTURE_BACKUP_OBSERVATION_IS_NOT_PRODUCT_BACKUP_PROOF: true
FIXTURE_ATOMIC_WRITE_OBSERVATION_IS_NOT_PRODUCT_STORAGE_SAFETY_PROOF: true
001O_DOES_NOT_AUTHORIZE_PRODUCT_APPLY: true
001O_DOES_NOT_AUTHORIZE_PUBLIC_SURFACE: true
001O_DOES_NOT_AUTHORIZE_RELEASE_CLAIM: true

CLAIM_BOUNDARY_1: THIS_DOES_NOT_PROVE_PRODUCT_STORAGE_SAFETY
CLAIM_BOUNDARY_2: THIS_DOES_NOT_PROVE_DURABLE_APPLYRECEIPT
CLAIM_BOUNDARY_3: THIS_DOES_NOT_PROVE_PROJECT_LEVEL_APPLYTXN
CLAIM_BOUNDARY_4: THIS_DOES_NOT_PROVE_CRASH_RECOVERY
CLAIM_BOUNDARY_5: THIS_DOES_NOT_MUTATE_REAL_MANUSCRIPT
CLAIM_BOUNDARY_6: THIS_DOES_NOT_EXPOSE_PUBLIC_RUNTIME_SURFACE
CLAIM_BOUNDARY_7: THIS_DOES_NOT_EXPAND_DOCX_OR_WORD_OR_GOOGLE_SUPPORT

SCOPE_IN_01: pure compiler compileExactTextTestOnlyProductShapedStorageDryRun
SCOPE_IN_02: accepted 001N binding validation
SCOPE_IN_03: product shaped fixture packet validation
SCOPE_IN_04: inert fixture manifest stub validation
SCOPE_IN_05: project id precondition
SCOPE_IN_06: scene id precondition
SCOPE_IN_07: baseline hash precondition
SCOPE_IN_08: block version hash precondition
SCOPE_IN_09: exact text guard precondition
SCOPE_IN_10: open session precondition
SCOPE_IN_11: fixture backup observation validation
SCOPE_IN_12: fixture atomic write observation validation
SCOPE_IN_13: test only dry run receipt observation validation
SCOPE_IN_14: fixture path containment validation
SCOPE_IN_15: cleanup observation validation
SCOPE_IN_16: negative tests for false green claims

SCOPE_OUT_01: product project write
SCOPE_OUT_02: manuscript mutation
SCOPE_OUT_03: real user project root
SCOPE_OUT_04: public IPC
SCOPE_OUT_05: preload API
SCOPE_OUT_06: command catalog
SCOPE_OUT_07: renderer UI
SCOPE_OUT_08: DOCX import
SCOPE_OUT_09: Word support
SCOPE_OUT_10: Google support
SCOPE_OUT_11: broad parser
SCOPE_OUT_12: storage migration
SCOPE_OUT_13: project level ApplyTxn
SCOPE_OUT_14: durable product ApplyReceipt
SCOPE_OUT_15: crash recovery claim
SCOPE_OUT_16: editing backupManager
SCOPE_OUT_17: editing fileManager
SCOPE_OUT_18: editing atomicWriteFile
SCOPE_OUT_19: production import of backupManager from reviewIrKernel
SCOPE_OUT_20: production import of fileManager from reviewIrKernel
SCOPE_OUT_21: new dependency
SCOPE_OUT_22: release claim
SCOPE_OUT_23: comment apply
SCOPE_OUT_24: structural apply
SCOPE_OUT_25: multi scene apply

ALLOWLIST_BASENAME_01: reviewIrKernel.mjs
ALLOWLIST_BASENAME_02: exactTextApplyTestOnlyProductShapedStorageDryRun.contract.test.js
ALLOWLIST_BASENAME_03: EXACT_TEXT_APPLY_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_001O.md
ALLOWLIST_BASENAME_04: exactTextApplyProductStoragePrimitiveEvidence.contract.test.js
ALLOWLIST_BASENAME_05: exactTextApplyTestFixtureReceiptFile.contract.test.js
ALLOWLIST_BASENAME_06: exactTextApplyTestOnlyStoragePrimitiveExecutionHarness.contract.test.js
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

EXPECTED_RESULT_KIND: EXACT_TEXT_TEST_ONLY_PRODUCT_SHAPED_STORAGE_DRY_RUN_RESULT
EXPECTED_DECISION: TEST_ONLY_PRODUCT_SHAPED_DRY_RUN_EVIDENCE_ADMITTED
EXPECTED_DECISION_COUNT: 1
NEXT_DECISION_AFTER_PASS: OWNER_MAY_PLAN_PRODUCT_APPLY_READINESS_REVIEW_001P
NEXT_CONTOUR_AFTER_PASS: EXACT_TEXT_APPLY_PRODUCT_APPLY_READINESS_REVIEW_001P

MANDATORY_NEGATIVE_TEST_01: missing 001N result blocks zero decisions
MANDATORY_NEGATIVE_TEST_02: contaminated 001N product dry run admission flag blocks zero decisions
MANDATORY_NEGATIVE_TEST_03: product shaped observation missing blocks zero decisions
MANDATORY_NEGATIVE_TEST_04: fixture root not OS temp only blocks zero decisions
MANDATORY_NEGATIVE_TEST_05: fixture manifest persisted blocks zero decisions
MANDATORY_NEGATIVE_TEST_06: fixture manifest reused as project truth blocks zero decisions
MANDATORY_NEGATIVE_TEST_07: wrong project blocks zero decisions
MANDATORY_NEGATIVE_TEST_08: scene mismatch blocks zero decisions
MANDATORY_NEGATIVE_TEST_09: stale baseline blocks zero decisions
MANDATORY_NEGATIVE_TEST_10: block version mismatch blocks zero decisions
MANDATORY_NEGATIVE_TEST_11: exact text mismatch blocks zero decisions
MANDATORY_NEGATIVE_TEST_12: closed session blocks zero decisions
MANDATORY_NEGATIVE_TEST_13: product root access blocks zero decisions
MANDATORY_NEGATIVE_TEST_14: repo root access blocks zero decisions
MANDATORY_NEGATIVE_TEST_15: absolute path escape blocks zero decisions
MANDATORY_NEGATIVE_TEST_16: path traversal blocks zero decisions
MANDATORY_NEGATIVE_TEST_17: dry run receipt path outside fixture blocks zero decisions
MANDATORY_NEGATIVE_TEST_18: after write hash mismatch blocks success status
MANDATORY_NEGATIVE_TEST_19: fixture cleanup failure blocks pass
MANDATORY_NEGATIVE_TEST_20: product apply admission claim blocks zero decisions
MANDATORY_NEGATIVE_TEST_21: product write claim blocks zero decisions
MANDATORY_NEGATIVE_TEST_22: product storage safety claim blocks zero decisions
MANDATORY_NEGATIVE_TEST_23: durable receipt claim blocks zero decisions
MANDATORY_NEGATIVE_TEST_24: ApplyReceipt claim blocks zero decisions
MANDATORY_NEGATIVE_TEST_25: recovery claim blocks zero decisions
MANDATORY_NEGATIVE_TEST_26: ApplyTxn claim blocks zero decisions
MANDATORY_NEGATIVE_TEST_27: public surface claim blocks zero decisions
MANDATORY_NEGATIVE_TEST_28: DOCX claim blocks zero decisions
MANDATORY_NEGATIVE_TEST_29: UI change blocks zero decisions
MANDATORY_NEGATIVE_TEST_30: network use blocks zero decisions
MANDATORY_NEGATIVE_TEST_31: dependency change blocks zero decisions
MANDATORY_NEGATIVE_TEST_32: storage primitive edit blocks zero decisions
MANDATORY_NEGATIVE_TEST_33: comment apply blocks zero decisions
MANDATORY_NEGATIVE_TEST_34: structural apply blocks zero decisions
MANDATORY_NEGATIVE_TEST_35: multi scene apply blocks zero decisions
MANDATORY_NEGATIVE_TEST_36: production import of backupManager blocks pass
MANDATORY_NEGATIVE_TEST_37: production import of fileManager blocks pass

DELIVERY_POLICY: COMMIT_REQUIRED true, PUSH_REQUIRED true, PR_REQUIRED true, MERGE_REQUIRED true
COMMIT_SHA: pending
PUSH_RESULT: pending
PR_RESULT: pending
MERGE_RESULT: pending
NEXT_STEP: parent orchestrator owns verification commit push PR and merge stop policy
