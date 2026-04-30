TASK_ID: DOCX_DIAGNOSTIC_ENVELOPE_PROBE_001
DOCUMENT_TYPE: HARD_TZ_EXECUTED_CONTOUR_RECORD
STATUS: IMPLEMENTED_PENDING_LOCAL_VERIFY_AND_DELIVERY
CANON_BOUNDARY: INTERNAL_DIAGNOSTIC_ENVELOPE_PROBE_ONLY; NO_PUBLIC_RUNTIME_API; NO_DOCX_IMPORT_AUTHORIZATION
MASTER_PLAN_STAGE: STAGE_02_HOSTILE_FILE_GATE
PREVIOUS_CONTOUR_01: DOCX_HOSTILE_PACKAGE_GATE_001A
PREVIOUS_CONTOUR_02: DOCX_HOSTILE_PACKAGE_GATE_001B
PREVIOUS_CONTOUR_03: DOCX_HOSTILE_PACKAGE_GATE_001C
PREVIOUS_CONTOUR_04: DOCX_HOSTILE_PACKAGE_GATE_001D
PREVIOUS_CONTOUR_05: DOCX_HOSTILE_PACKAGE_GATE_001E
DELIVERY_MODE: WRITE_CHAIN_ISOLATED_FEATURE_BRANCH
DELIVERY_POLICY: COMMIT_REQUIRED true; PUSH_REQUIRED true; PR_REQUIRED true; MERGE_REQUIRED true
DELIVERY_TARGET_POLICY: PR_AND_MERGE_REQUIRE_OWNER_APPROVED_ISOLATED_FEATURE_TARGET
DELIVERY_EXCEPTION_STATUS: NOT_A_DOWNGRADE_STOP_BEFORE_PR_AND_MERGE_UNTIL_OWNER_APPROVES_TARGET
DELIVERY_EXCEPTION_REASON: MAINLINE_HAS_SEPARATE_ACTIVE_DEVELOPMENT_PROCESS_AND_THIS_FEATURE_WORK_IS_ISOLATED
DELIVERY_EXCEPTION_SCOPE: PR_AND_MERGE_TARGET_SELECTION_ONLY
DELIVERY_EXCEPTION_OWNER: OWNER_IN_THREAD
DELIVERY_EXCEPTION_EXPIRY: WHEN_OWNER_APPROVES_ISOLATED_PR_TARGET_OR_ACCEPTS_STOP_NOT_DONE
DONE_ONLY_IF: COMMIT_SHA_PRESENT_AND_PUSH_DONE_AND_PR_DONE_AND_MERGE_DONE_OR_EXPLICIT_OWNER_ACCEPTED_STOP_PENDING_TARGET
PRIMARY_GOAL: add a private main scope diagnostic probe bound to 001D intake envelope decision without public command preload UI or import support claim
CONTOUR_TYPE: INTERNAL_RUNTIME_DIAGNOSTIC_PROBE
SCOPE_IN_01: private main scope probe exists
SCOPE_IN_02: probe loads hostile package gate via existing dynamic import pattern
SCOPE_IN_03: probe returns 001D safe envelope decision for safe package bytes
SCOPE_IN_04: probe returns 001D blocked envelope decision for invalid zip
SCOPE_IN_05: probe returns 001D blocked envelope decision for XML preflight hostile package
SCOPE_IN_06: probe returns 001D blocked envelope decision for macro security surface package
SCOPE_IN_07: every probe outcome has docxImportAuthorized false
SCOPE_IN_08: every probe outcome has runtimeAction NONE
SCOPE_IN_09: probe has diagnosticOnly true and diagnostic probe version
SCOPE_OUT_01: public IPC
SCOPE_OUT_02: preload API
SCOPE_OUT_03: command catalog
SCOPE_OUT_04: project commands
SCOPE_OUT_05: renderer UI
SCOPE_OUT_06: DOCX semantic import
SCOPE_OUT_07: Review IR coupling
SCOPE_OUT_08: revision session creation
SCOPE_OUT_09: project write
SCOPE_OUT_10: manuscript mutation
SCOPE_OUT_11: quarantine storage
SCOPE_OUT_12: network
SCOPE_OUT_13: new dependencies
ALLOWLIST_BASENAMES: main.js; hostilePackageGate.contract.test.js; DOCX_DIAGNOSTIC_ENVELOPE_PROBE_001.md
DENYLIST_BASENAMES: preload.js; editor.js; index.html; styles.css; package.json; package-lock.json; reviewIrKernel.mjs; command-catalog.v1.mjs; projectCommands.mjs
CONTRACT_01: private probe is not registered in ipcMain handle
CONTRACT_02: private probe is not registered in UI command bridge
CONTRACT_03: private probe is not registered in menu command handlers
CONTRACT_04: preload command catalog and project commands do not expose probe
CONTRACT_05: probe source does not call write or revision session paths
CONTRACT_06: probe returns safe 001D decision without import authorization
CONTRACT_07: probe returns invalid zip XML hostile and macro hostile 001D blocked decisions
FALSE_GREEN_BOUNDARY_01: this contour proves only private diagnostic binding to 001D
FALSE_GREEN_BOUNDARY_02: this contour does not prove public runtime API
FALSE_GREEN_BOUNDARY_03: this contour does not prove DOCX import
FALSE_GREEN_BOUNDARY_04: this contour does not prove DOCX semantic fidelity
FALSE_GREEN_BOUNDARY_05: this contour does not prove Word support
FALSE_GREEN_BOUNDARY_06: this contour does not prove Google support
FALSE_GREEN_BOUNDARY_07: this contour does not prove apply safety
TEST_COMMAND_01: node --test test/contracts/hostilePackageGate.contract.test.js
TEST_COMMAND_02: node --test review IR regression contracts
TEST_COMMAND_03: node --test governance regression contracts
TEST_COMMAND_04: npm run oss policy
TEST_COMMAND_05: git diff check
NEXT_CONTOUR_AFTER_SUCCESS: OWNER_DECIDES_NEXT_CONTOUR_AFTER_DELIVERY_CHAIN_OR_ACCEPTED_STOP
