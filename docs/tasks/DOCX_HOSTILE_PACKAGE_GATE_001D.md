TASK_ID: DOCX_HOSTILE_PACKAGE_GATE_001D_INTAKE_BOUNDARY_SEAM_CONTRACT
DOCUMENT_TYPE: HARD_TZ_EXECUTED_CONTOUR_RECORD
STATUS: IMPLEMENTED_PENDING_LOCAL_VERIFY_AND_DELIVERY
CANON_BOUNDARY: PURE_INTAKE_ENVELOPE_DECISION_ONLY; NO_RUNTIME_ADMISSION; NO_DOCX_IMPORT_AUTHORIZATION
MASTER_PLAN_STAGE: STAGE_02_HOSTILE_FILE_GATE
PREVIOUS_CONTOUR_01: DOCX_HOSTILE_PACKAGE_GATE_001A
PREVIOUS_CONTOUR_02: DOCX_HOSTILE_PACKAGE_GATE_001B
PREVIOUS_CONTOUR_03: DOCX_HOSTILE_PACKAGE_GATE_001C
DELIVERY_MODE: WRITE_CHAIN_ISOLATED_FEATURE_BRANCH
DELIVERY_POLICY: COMMIT_REQUIRED true; PUSH_REQUIRED true; PR_REQUIRED true; MERGE_REQUIRED true
DELIVERY_TARGET_POLICY: PR_AND_MERGE_REQUIRE_OWNER_APPROVED_ISOLATED_FEATURE_TARGET
DELIVERY_EXCEPTION_STATUS: NOT_A_DOWNGRADE_STOP_BEFORE_PR_AND_MERGE_UNTIL_OWNER_APPROVES_TARGET
DELIVERY_EXCEPTION_REASON: MAINLINE_HAS_SEPARATE_ACTIVE_DEVELOPMENT_PROCESS_AND_THIS_FEATURE_WORK_IS_ISOLATED
DELIVERY_EXCEPTION_SCOPE: PR_AND_MERGE_TARGET_SELECTION_ONLY
DELIVERY_EXCEPTION_OWNER: OWNER_IN_THREAD
DELIVERY_EXCEPTION_EXPIRY: WHEN_OWNER_APPROVES_ISOLATED_PR_TARGET_OR_ACCEPTS_STOP_NOT_DONE
DONE_ONLY_IF: COMMIT_SHA_PRESENT_AND_PUSH_DONE_AND_PR_DONE_AND_MERGE_DONE_OR_EXPLICIT_OWNER_ACCEPTED_STOP_PENDING_TARGET
PRIMARY_GOAL: add a pure DOCX intake envelope boundary seam that aggregates package inventory, XML preflight and security surface policy without authorizing import
CONTOUR_TYPE: PURE_CONTRACT_SECURITY_CORE
SCOPE_IN_01: 001A package inventory runs first
SCOPE_IN_02: 001B XML preflight runs only when 001A allows
SCOPE_IN_03: 001C security surface policy runs only when 001B allows
SCOPE_IN_04: first blocked gate short circuits the aggregate decision
SCOPE_IN_05: safe package result is ENVELOPE_GATE_CLEARED_NOT_IMPORT_AUTHORIZED
SCOPE_IN_06: every aggregate outcome returns docxImportAuthorized false
SCOPE_IN_07: every aggregate outcome returns runtimeAction NONE
SCOPE_IN_08: subordinate gate hashes are included for gates that ran
SCOPE_IN_09: blocked aggregate result includes blockedGateHash
SCOPE_IN_10: aggregate decision hash is deterministic and policy bound
SCOPE_IN_11: safe aggregate result includes explicit reason code that DOCX import needs separate owner approved contour
SCOPE_OUT_01: runtime admission
SCOPE_OUT_02: DOCX semantic import
SCOPE_OUT_03: production callback for semantic parse
SCOPE_OUT_04: quarantine implementation
SCOPE_OUT_05: UI
SCOPE_OUT_06: storage migration
SCOPE_OUT_07: network
SCOPE_OUT_08: new dependencies
SCOPE_OUT_09: Review IR kernel coupling
ALLOWLIST_BASENAMES: hostilePackageGate.mjs; hostilePackageGate.contract.test.js; DOCX_HOSTILE_PACKAGE_GATE_001D.md
DENYLIST_BASENAMES: reviewIrKernel.mjs; package.json; package-lock.json; main.js; preload.js; editor.js; index.html; styles.css; projectCommands.mjs
CONTRACT_01: safe package clears intake envelope but does not authorize DOCX import
CONTRACT_02: safe aggregate result includes 001A, 001B and 001C gate hashes
CONTRACT_03: package gate blocker short circuits before XML preflight and surface policy
CONTRACT_04: XML preflight blocker short circuits before surface policy
CONTRACT_05: security surface blocker is reported after package and XML gates pass
CONTRACT_06: aggregate never authorizes runtime import for safe, package blocked, XML blocked or surface blocked outcomes
CONTRACT_07: aggregate decision hash is deterministic
CONTRACT_08: policy change changes aggregate decision hash
CONTRACT_09: production exports expose no semantic parse callback or enablement names
CONTRACT_10: safe aggregate result has envelopeDecisionHash equal to gateHash
CONTRACT_11: safe aggregate result has no silent allow reason code gap
TEST_COMMAND_01: node --test hostilePackageGate.contract.test.js
FALSE_GREEN_BOUNDARY_01: this contour proves only intake envelope gate ordering and aggregation
FALSE_GREEN_BOUNDARY_02: envelope cleared does not mean DOCX import is allowed
FALSE_GREEN_BOUNDARY_03: this contour does not parse DOCX review semantics
FALSE_GREEN_BOUNDARY_04: this contour does not wire runtime application
FALSE_GREEN_BOUNDARY_05: this contour does not prove runtime bypass resistance in main process or preload
NEXT_CONTOUR_AFTER_SUCCESS: OWNER_APPROVED_DOCX_IMPORT_CONTOUR_REQUIRED_AFTER_PARENT_DELIVERY
