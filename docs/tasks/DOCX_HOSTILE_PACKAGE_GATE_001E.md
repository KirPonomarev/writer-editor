TASK_ID: DOCX_HOSTILE_PACKAGE_GATE_001E_SECURITY_CORE_EXPORT_SURFACE_GUARD
DOCUMENT_TYPE: HARD_TZ_EXECUTED_CONTOUR_RECORD
STATUS: IMPLEMENTED_PENDING_LOCAL_VERIFY_AND_DELIVERY
CANON_BOUNDARY: PURE_CONTRACT_SECURITY_CORE_EXPORT_SURFACE_GUARD_ONLY; NO_RUNTIME_ADMISSION; NO_DOCX_IMPORT_AUTHORIZATION
MASTER_PLAN_STAGE: STAGE_02_HOSTILE_FILE_GATE
PREVIOUS_CONTOUR_01: DOCX_HOSTILE_PACKAGE_GATE_001A
PREVIOUS_CONTOUR_02: DOCX_HOSTILE_PACKAGE_GATE_001B
PREVIOUS_CONTOUR_03: DOCX_HOSTILE_PACKAGE_GATE_001C
PREVIOUS_CONTOUR_04: DOCX_HOSTILE_PACKAGE_GATE_001D
DELIVERY_MODE: WRITE_CHAIN_ISOLATED_FEATURE_BRANCH
DELIVERY_POLICY: COMMIT_REQUIRED true; PUSH_REQUIRED true; PR_REQUIRED true; MERGE_REQUIRED true
DELIVERY_TARGET_POLICY: PR_AND_MERGE_REQUIRE_OWNER_APPROVED_ISOLATED_FEATURE_TARGET
DELIVERY_EXCEPTION_STATUS: NOT_A_DOWNGRADE_STOP_BEFORE_PR_AND_MERGE_UNTIL_OWNER_APPROVES_TARGET
DELIVERY_EXCEPTION_REASON: MAINLINE_HAS_SEPARATE_ACTIVE_DEVELOPMENT_PROCESS_AND_THIS_FEATURE_WORK_IS_ISOLATED
DELIVERY_EXCEPTION_SCOPE: PR_AND_MERGE_TARGET_SELECTION_ONLY
DELIVERY_EXCEPTION_OWNER: OWNER_IN_THREAD
DELIVERY_EXCEPTION_EXPIRY: WHEN_OWNER_APPROVES_ISOLATED_PR_TARGET_OR_ACCEPTS_STOP_NOT_DONE
DONE_ONLY_IF: COMMIT_SHA_PRESENT_AND_PUSH_DONE_AND_PR_DONE_AND_MERGE_DONE_OR_EXPLICIT_OWNER_ACCEPTED_STOP_PENDING_TARGET
PRIMARY_GOAL: add contract-only guard that security core export surface exposes the pure intake envelope decision without DOCX import enablement names
CONTOUR_TYPE: PURE_CONTRACT_SECURITY_CORE
SCOPE_IN_01: local test helper validates security core export surface
SCOPE_IN_02: security core exports inspectDocxIntakeEnvelopeDecision
SCOPE_IN_03: export names do not include import enablement, runtime admission, semantic parse, callback, quarantine, or apply names
SCOPE_IN_04: local negative export fixture is rejected by the helper
SCOPE_IN_05: local test helper validates intake envelope result shape
SCOPE_IN_06: current 001D safe result has docxImportAuthorized false
SCOPE_IN_07: current 001D safe result has runtimeAction NONE
SCOPE_IN_08: current 001D safe result has decisionStatus ENVELOPE_GATE_CLEARED_NOT_IMPORT_AUTHORIZED
SCOPE_IN_09: local negative result fixtures reject docxImportAuthorized true
SCOPE_IN_10: local negative result fixtures reject runtimeAction IMPORT, PARSE, and APPLY
SCOPE_IN_11: helpers are deterministic for repeated equivalent inputs
SCOPE_OUT_01: production implementation changes
SCOPE_OUT_02: runtime admission
SCOPE_OUT_03: DOCX semantic import
SCOPE_OUT_04: runtime bypass proof
SCOPE_OUT_05: UI
SCOPE_OUT_06: main process
SCOPE_OUT_07: preload
SCOPE_OUT_08: package files
SCOPE_OUT_09: Review IR kernel
SCOPE_OUT_10: storage
SCOPE_OUT_11: network
SCOPE_OUT_12: dependencies
ALLOWLIST_BASENAMES: hostilePackageGate.contract.test.js; DOCX_HOSTILE_PACKAGE_GATE_001E.md
DENYLIST_BASENAMES: hostilePackageGate.mjs; reviewIrKernel.mjs; package.json; package-lock.json; main.js; preload.js; editor.js; index.html; styles.css; projectCommands.mjs
CONTRACT_01: security core export surface includes inspectDocxIntakeEnvelopeDecision
CONTRACT_02: security core export surface excludes forbidden import enablement names
CONTRACT_03: local negative export fixture rejects forbidden export names
CONTRACT_04: current safe intake envelope result remains not import authorized
CONTRACT_05: current safe intake envelope result remains runtimeAction NONE
CONTRACT_06: current safe intake envelope result remains ENVELOPE_GATE_CLEARED_NOT_IMPORT_AUTHORIZED
CONTRACT_07: local negative result fixture rejects docxImportAuthorized true
CONTRACT_08: local negative result fixtures reject runtimeAction IMPORT, PARSE, and APPLY
CONTRACT_09: export surface helper is deterministic
CONTRACT_10: result shape helper is deterministic
FALSE_GREEN_BOUNDARY_01: this contour proves only contract-level export surface and result-shape guard behavior
FALSE_GREEN_BOUNDARY_02: this contour does not prove DOCX import is safe
FALSE_GREEN_BOUNDARY_03: this contour does not parse DOCX review semantics
FALSE_GREEN_BOUNDARY_04: this contour does not wire runtime application
FALSE_GREEN_BOUNDARY_05: this contour does not prove runtime bypass resistance in main process or preload
FALSE_GREEN_BOUNDARY_06: this contour is not runtime bypass proof
TEST_COMMAND_01: node --test test/contracts/hostilePackageGate.contract.test.js
TEST_COMMAND_02: git diff --check
NEXT_CONTOUR_AFTER_SUCCESS: OWNER_DECIDES_NEXT_CONTOUR_AFTER_DELIVERY_CHAIN_OR_ACCEPTED_STOP
