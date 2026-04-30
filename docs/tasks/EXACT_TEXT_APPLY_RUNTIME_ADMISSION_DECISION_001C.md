TASK_ID: EXACT_TEXT_APPLY_RUNTIME_ADMISSION_DECISION_001C
DOCUMENT_TYPE: HARD_TZ_LOCAL_CONTOUR_RECORD
STATUS: IMPLEMENTED_VERIFIED_PENDING_DELIVERY_RUNTIME_WRITES_NOT_ADMITTED
CANON_BOUNDARY: STAGE_03_EXACT_TEXT_APPLY_RUNTIME_ADMISSION_DECISION_ONLY
MASTER_PLAN_BINDING: REVISION_BRIDGE_FULL_EVOLUTION_MASTER_PLAN_R3
MASTER_PLAN_STAGE: STAGE_03_EXACT_TEXT_APPLY_FOUNDATION
BASE_BRANCH_CONTEXT: ISOLATED_FEATURE_BRANCH
HEAD_SHA_BEFORE: 2ed51cc52472f824e5f9fac146051362c2f6c4f1

DELIVERY_MODE: WRITE_CHAIN_ISOLATED_FEATURE_BRANCH
DELIVERY_POLICY: COMMIT_REQUIRED true; PUSH_REQUIRED true; PR_REQUIRED true; MERGE_REQUIRED true
DELIVERY_TARGET_POLICY: PR_AND_MERGE_REQUIRE_OWNER_APPROVED_ISOLATED_FEATURE_TARGET
DELIVERY_EXCEPTION_STATUS: NOT_A_DOWNGRADE_STOP_BEFORE_PR_AND_MERGE_UNTIL_OWNER_APPROVES_TARGET
DELIVERY_EXCEPTION_REASON: mainline has separate active development process and this feature work is isolated
DELIVERY_EXCEPTION_SCOPE: PR_AND_MERGE_TARGET_SELECTION_ONLY

PREVIOUS_CONTOUR_01: EXACT_TEXT_APPLY_FOUNDATION_001A
PREVIOUS_CONTOUR_02: EXACT_TEXT_APPLY_EFFECT_PREVIEW_001B
NEXT_CONTOUR_AFTER_SUCCESS: EXACT_TEXT_APPLY_WRITE_BOUNDARY_001D_OR_STAGE_04_COMMENT_SURVIVAL_PLAN

PRIMARY_GOAL: decide whether exact text runtime write boundary can be opened after contract ApplyOp and effect preview proofs
CORE_CLAIM: runtime write may only be planned after backup atomic write receipt recovery and scope limits are explicitly bound
DEFAULT_DECISION: RUNTIME_WRITE_REMAINS_BLOCKED_IN_001C
FINAL_ADMISSION_DECISION: RUNTIME_WRITE_PLANNING_BOUNDARY_ADMITTED_FOR_NEXT_CONTOUR_WITH_LIMITS
FINAL_ADMISSION_REASON: 001A proves contract ApplyOp and 001B proves dry run effect preview, but runtime write remains unimplemented unauthorized and not admitted in 001C; the next contour may only plan exact single scene text write with storage receipt and recovery boundaries

RUNTIME_WRITES_ADMITTED: false
RUNTIME_WRITES_PERFORMED: false
RUNTIME_ADMISSION_GRANTED: false
RUNTIME_WRITABLE: false
RUNTIME_WRITE_CLAIMED: false
EXECUTABLE_APPLY_CLAIMED: false
MANUSCRIPT_MUTATION_CLAIMED: false
STORAGE_WRITE_CLAIMED: false

CONTOUR_TYPE: DOCS_ONLY_ADMISSION_AND_RISK_BOUNDARY
BINARY_EXIT_DECISION_REQUIRED: true
BINARY_EXIT_OPTION_01: RUNTIME_WRITE_PLANNING_BOUNDARY_ADMITTED_FOR_NEXT_CONTOUR_WITH_LIMITS
BINARY_EXIT_OPTION_02: RUNTIME_WRITE_BOUNDARY_BLOCKED_WITH_REASON_CODES
BINARY_EXIT_RULE: no ambiguous partial pass allowed

TECHNICAL_STATUS_SECTION_REQUIRED: true
TECHNICAL_STATUS_001A: CONTRACT_APPLYOP_PROVEN_NOT_RUNTIME_WRITE
TECHNICAL_STATUS_001B: EFFECT_PREVIEW_PROVEN_NOT_FILE_MUTATION
TECHNICAL_STATUS_001C: ADMISSION_DECISION_ONLY_NOT_IMPLEMENTATION
TECHNICAL_PROOF_STATUS: NOT_PROVEN_RUNTIME_WRITE
DELIVERY_STATUS_SECTION_REQUIRED: true
DELIVERY_STATUS_RULE: technical admission status and delivery chain status must be separate

ALLOWLIST_BASENAMES: EXACT_TEXT_APPLY_RUNTIME_ADMISSION_DECISION_001C.md
DENYLIST_BASENAMES: main.js; preload.js; editor.js; index.html; styles.css; package.json; package-lock.json; command-catalog.v1.mjs; projectCommands.mjs; reviewIrKernel.mjs; hostilePackageGate.mjs

SCOPE_IN_01: record current Stage 03 proof status
SCOPE_IN_02: record what 001A proved
SCOPE_IN_03: record what 001B proved
SCOPE_IN_04: define runtime write entry criteria
SCOPE_IN_05: define storage entry criteria
SCOPE_IN_06: define receipt entry criteria
SCOPE_IN_07: define recovery entry criteria
SCOPE_IN_08: define exact text only limits
SCOPE_IN_09: define false green boundary
SCOPE_IN_10: define next contour stop conditions
SCOPE_IN_11: record binary exit decision
SCOPE_IN_12: record static scan as guard not runtime proof

SCOPE_OUT_01: runtime apply implementation
SCOPE_OUT_02: file writes beyond task record
SCOPE_OUT_03: backup implementation
SCOPE_OUT_04: atomic write implementation
SCOPE_OUT_05: ApplyReceipt implementation
SCOPE_OUT_06: ApplyTxn implementation
SCOPE_OUT_07: storage migration
SCOPE_OUT_08: UI
SCOPE_OUT_09: public IPC
SCOPE_OUT_10: preload API
SCOPE_OUT_11: command catalog entry
SCOPE_OUT_12: DOCX import
SCOPE_OUT_13: Word or Google integration
SCOPE_OUT_14: new dependency
SCOPE_OUT_15: Stage 04 comment survival implementation
SCOPE_OUT_16: Stage 06 project level ApplyTxn implementation

APPLYRECEIPT_ADMITTED: false
APPLYRECEIPT_CLAIMED: false
APPLYTXN_ADMITTED: false
APPLYTXN_CLAIMED: false
ACTUAL_ROLLBACK_CLAIMED: false
TRANSACTION_CLAIMED: false
STORAGE_SAFETY_CLAIMED: false
ATOMIC_WRITE_CLAIMED: false
RECOVERY_CLAIMED: false
BACKUP_CLAIMED: false
UI_CLAIMED: false
PUBLIC_SURFACE_CLAIMED: false
DOCX_IMPORT_CLAIMED: false
DOCX_SEMANTIC_FIDELITY_CLAIMED: false
RELEASE_CLAIMED: false
WORD_CLAIMED: false
GOOGLE_CLAIMED: false

RUNTIME_WRITE_ENTRY_CRITERIA_01: only exact single scene text scope allowed
RUNTIME_WRITE_ENTRY_CRITERIA_02: ApplyOp must be contract only source from 001A
RUNTIME_WRITE_ENTRY_CRITERIA_03: effect preview must be source from 001B
RUNTIME_WRITE_ENTRY_CRITERIA_04: project id test required
RUNTIME_WRITE_ENTRY_CRITERIA_05: scene id test required
RUNTIME_WRITE_ENTRY_CRITERIA_06: baseline hash test required
RUNTIME_WRITE_ENTRY_CRITERIA_07: block version hash test required
RUNTIME_WRITE_ENTRY_CRITERIA_08: exact text before guard required
RUNTIME_WRITE_ENTRY_CRITERIA_09: closed session blocker required
RUNTIME_WRITE_ENTRY_CRITERIA_10: wrong project blocker required
RUNTIME_WRITE_ENTRY_CRITERIA_11: ambiguous match blocker required
RUNTIME_WRITE_ENTRY_CRITERIA_12: unsupported surface blocker required
RUNTIME_WRITE_ENTRY_CRITERIA_13: runtime write admission must not authorize public surface

STORAGE_ENTRY_CRITERIA_01: backup before write must be named
STORAGE_ENTRY_CRITERIA_02: atomic write path must be named
STORAGE_ENTRY_CRITERIA_03: readable recovery snapshot must be named
STORAGE_ENTRY_CRITERIA_04: write scope must be single scene text only
STORAGE_ENTRY_CRITERIA_05: storage path boundary must be named
STORAGE_ENTRY_CRITERIA_06: failure after backup before write must have expected recovery
STORAGE_ENTRY_CRITERIA_07: failure during write must have expected recovery
STORAGE_ENTRY_CRITERIA_08: failure after write before receipt must have expected recovery

RECEIPT_ENTRY_CRITERIA_01: ApplyReceipt schema must be named before runtime write
RECEIPT_ENTRY_CRITERIA_02: ApplyReceipt must contain project id
RECEIPT_ENTRY_CRITERIA_03: ApplyReceipt must contain scene id
RECEIPT_ENTRY_CRITERIA_04: ApplyReceipt must contain before hash
RECEIPT_ENTRY_CRITERIA_05: ApplyReceipt must contain after hash
RECEIPT_ENTRY_CRITERIA_06: ApplyReceipt must contain source ApplyOp hash
RECEIPT_ENTRY_CRITERIA_07: ApplyReceipt must contain effect preview hash
RECEIPT_ENTRY_CRITERIA_08: ApplyReceipt must contain decision id
RECEIPT_ENTRY_CRITERIA_09: ApplyReceipt must contain result status
RECEIPT_ENTRY_CRITERIA_10: ApplyReceipt must not be claimed as implemented in 001C

RECOVERY_ENTRY_CRITERIA_01: recovery behavior must be defined for pre write failure
RECOVERY_ENTRY_CRITERIA_02: recovery behavior must be defined for mid write failure
RECOVERY_ENTRY_CRITERIA_03: recovery behavior must be defined for post write pre receipt failure
RECOVERY_ENTRY_CRITERIA_04: recovery behavior must be defined for stale baseline recheck failure
RECOVERY_ENTRY_CRITERIA_05: recovery behavior must be defined for hash mismatch after write

BLOCKED_SCOPE_01: multi scene apply
BLOCKED_SCOPE_02: structural move split merge
BLOCKED_SCOPE_03: comment apply
BLOCKED_SCOPE_04: DOCX review import
BLOCKED_SCOPE_05: Word support claim
BLOCKED_SCOPE_06: Google support claim
BLOCKED_SCOPE_07: public review UI
BLOCKED_SCOPE_08: project level transaction claim
BLOCKED_SCOPE_09: cloud or network path
BLOCKED_SCOPE_10: UI decision flow

APPLYTXN_LAYER_RULE_01: project level ApplyTxn is Stage 06 and is blocked future scope for 001C
APPLYTXN_LAYER_RULE_02: 001C may reference ApplyTxn only as not allowed for next runtime write contour
COMMENT_LAYER_RULE: comment survival is Stage 04 and is not implemented in 001C
UI_LAYER_RULE: UI is Stage 10 and is not implemented in 001C

STATIC_SCAN_RULE: static scan is guard not runtime proof
STATIC_SCAN_EXPECTED_ROLE: catch public surface or denylist drift
STATIC_SCAN_NOT_ALLOWED_TO_PROVE: apply safety or storage correctness or receipt durability

FALSE_GREEN_BOUNDARY_01: 001A proves contract ApplyOp not runtime write
FALSE_GREEN_BOUNDARY_02: 001B proves effect preview not file mutation
FALSE_GREEN_BOUNDARY_03: 001C proves admission decision not implementation
FALSE_GREEN_BOUNDARY_04: no ApplyReceipt claim until actual receipt exists
FALSE_GREEN_BOUNDARY_05: no ApplyTxn claim until project level transaction exists
FALSE_GREEN_BOUNDARY_06: no release claim from this contour
FALSE_GREEN_BOUNDARY_07: no runtime write claim from static scan
FALSE_GREEN_BOUNDARY_08: no storage safety claim without actual storage tests

NEXT_CONTOUR_ALLOWED_SCOPE_01: exact single scene text runtime write boundary planning only unless owner opens a separate runtime storage contour
NEXT_CONTOUR_ALLOWED_SCOPE_02: backup before write contract
NEXT_CONTOUR_ALLOWED_SCOPE_03: atomic write use through existing storage primitive or canon approved equivalent
NEXT_CONTOUR_ALLOWED_SCOPE_04: readable recovery snapshot contract
NEXT_CONTOUR_ALLOWED_SCOPE_05: ApplyReceipt schema and emission for exact text write
NEXT_CONTOUR_ALLOWED_SCOPE_06: negative tests for stale baseline wrong project closed session text mismatch and hash mismatch

NEXT_CONTOUR_FORBIDDEN_SCOPE_01: public DOCX import
NEXT_CONTOUR_FORBIDDEN_SCOPE_02: renderer UI
NEXT_CONTOUR_FORBIDDEN_SCOPE_03: command catalog surface
NEXT_CONTOUR_FORBIDDEN_SCOPE_04: preload surface
NEXT_CONTOUR_FORBIDDEN_SCOPE_05: multi scene transaction
NEXT_CONTOUR_FORBIDDEN_SCOPE_06: structural auto apply
NEXT_CONTOUR_FORBIDDEN_SCOPE_07: comment apply
NEXT_CONTOUR_FORBIDDEN_SCOPE_08: new dependency

MANDATORY_CHECK_01: clean worktree before write
MANDATORY_CHECK_02: isolated feature branch confirmed
MANDATORY_CHECK_03: HEAD matches expected or owner approved forward head
MANDATORY_CHECK_04: exact text apply foundation tests pass
MANDATORY_CHECK_05: exact text apply effect preview tests pass
MANDATORY_CHECK_06: Review IR kernel tests pass
MANDATORY_CHECK_07: hostile package gate tests pass
MANDATORY_CHECK_08: governance tests pass
MANDATORY_CHECK_09: OSS policy pass
MANDATORY_CHECK_10: diff check pass
MANDATORY_CHECK_11: static scan no public surface
MANDATORY_CHECK_12: independent auditor pass
MANDATORY_CHECK_13: staged scope matches allowlist

STOP_CONDITION_01: worktree dirty before write
STOP_CONDITION_02: not on isolated feature branch
STOP_CONDITION_03: HEAD drift without owner approval
STOP_CONDITION_04: any runtime code change required
STOP_CONDITION_05: any denylist basename required
STOP_CONDITION_06: any UI change required
STOP_CONDITION_07: any public IPC or preload required
STOP_CONDITION_08: any dependency change required
STOP_CONDITION_09: any DOCX import runtime required
STOP_CONDITION_10: any test fails
STOP_CONDITION_11: auditor finds false green
STOP_CONDITION_12: PR or merge target not owner approved after push
STOP_CONDITION_13: binary exit decision cannot be made

TEST_COMMAND_01: node --test test/contracts/exactTextApplyFoundation.contract.test.js
TEST_COMMAND_02: node --test test/contracts/exactTextApplyEffectPreview.contract.test.js
TEST_COMMAND_03: node --test test/contracts/exactTextApplyFoundation.contract.test.js test/contracts/exactTextApplyEffectPreview.contract.test.js test/contracts/reviewIrKernel.contract.test.js test/contracts/canonicalHash.contract.test.js test/contracts/staleBaselineBlocker.contract.test.js test/contracts/matchProof.contract.test.js test/contracts/parsedSurfaceRecord.contract.test.js
TEST_COMMAND_04: node --test test/contracts/hostilePackageGate.contract.test.js
TEST_COMMAND_05: node --test test/contracts/execution-profile-valid.contract.test.js test/contracts/verify-attestation.contract.test.js test/contracts/failsignal-registry.contract.test.js test/contracts/required-token-set-deterministic.contract.test.js
TEST_COMMAND_06: npm run oss:policy
TEST_COMMAND_07: git diff --check
TEST_COMMAND_08: context aware static scan for public surface drift
TEST_COMMAND_09: independent auditor read only review

ADMISSION_PASS_MEANS: next contour may plan runtime write boundary for exact single scene text only
ADMISSION_PASS_DOES_NOT_MEAN_01: runtime write exists
ADMISSION_PASS_DOES_NOT_MEAN_02: ApplyReceipt exists
ADMISSION_PASS_DOES_NOT_MEAN_03: ApplyTxn exists
ADMISSION_PASS_DOES_NOT_MEAN_04: public apply UI exists
ADMISSION_PASS_DOES_NOT_MEAN_05: DOCX import exists
ADMISSION_PASS_DOES_NOT_MEAN_06: runtime write is admitted in 001C
ADMISSION_PASS_DOES_NOT_MEAN_07: storage safety is proven
ADMISSION_PASS_DOES_NOT_MEAN_08: recovery is proven
ADMISSION_PASS_DOES_NOT_MEAN_09: backup is proven
ADMISSION_PASS_DOES_NOT_MEAN_10: atomic write is proven

NEXT_STEP_RUNTIME_RULE: separate owner approved runtime storage contour required before any runtime write storage safety recovery backup or receipt claim

COMMIT_REQUIRED_CONTENT: one task record only
PUSH_REQUIRED_CONTENT: isolated feature branch only
PR_REQUIRED_STATUS: blocked until owner approves target
MERGE_REQUIRED_STATUS: blocked until owner approves target

COMMIT_OUTCOME: PENDING_PARENT_ORCHESTRATOR_DELIVERY
PUSH_RESULT: PENDING_PARENT_ORCHESTRATOR_DELIVERY
PR_RESULT: STOPPED_UNTIL_OWNER_APPROVED_ISOLATED_TARGET
MERGE_RESULT: STOPPED_UNTIL_OWNER_APPROVED_ISOLATED_TARGET
NEXT_STEP: parent orchestrator verify audit commit push then stop for owner approved PR and merge target
