TASK_ID: DOCX_DIAGNOSTIC_ENVELOPE_PROBE_002
DOCUMENT_TYPE: HARD_TZ_EXECUTED_CONTOUR_RECORD
STATUS: IMPLEMENTED_PENDING_LOCAL_VERIFY_AND_DELIVERY
CANON_BOUNDARY: INTERNAL_DIAGNOSTIC_ENVELOPE_PROBE_ONLY; NO_PUBLIC_RUNTIME_API; NO_DOCX_IMPORT_AUTHORIZATION
MASTER_PLAN_STAGE: STAGE_02_HOSTILE_FILE_GATE
PREVIOUS_CONTOUR_01: DOCX_HOSTILE_PACKAGE_GATE_001A
PREVIOUS_CONTOUR_02: DOCX_HOSTILE_PACKAGE_GATE_001B
PREVIOUS_CONTOUR_03: DOCX_HOSTILE_PACKAGE_GATE_001C
PREVIOUS_CONTOUR_04: DOCX_HOSTILE_PACKAGE_GATE_001D
PREVIOUS_CONTOUR_05: DOCX_HOSTILE_PACKAGE_GATE_001E
PREVIOUS_CONTOUR_06: DOCX_DIAGNOSTIC_ENVELOPE_PROBE_001
DELIVERY_MODE: WRITE_CHAIN_ISOLATED_FEATURE_BRANCH
DELIVERY_POLICY: COMMIT_REQUIRED true; PUSH_REQUIRED true; PR_REQUIRED true; MERGE_REQUIRED true
DELIVERY_TARGET_POLICY: PR_AND_MERGE_REQUIRE_OWNER_APPROVED_ISOLATED_FEATURE_TARGET
DELIVERY_EXCEPTION_STATUS: NOT_A_DOWNGRADE_STOP_BEFORE_PR_AND_MERGE_UNTIL_OWNER_APPROVES_TARGET
DELIVERY_EXCEPTION_REASON: MAINLINE_HAS_SEPARATE_ACTIVE_DEVELOPMENT_PROCESS_AND_THIS_FEATURE_WORK_IS_ISOLATED
DELIVERY_EXCEPTION_SCOPE: PR_AND_MERGE_TARGET_SELECTION_ONLY
DELIVERY_EXCEPTION_OWNER: OWNER_IN_THREAD
DELIVERY_EXCEPTION_EXPIRY: WHEN_OWNER_APPROVES_ISOLATED_PR_TARGET_OR_ACCEPTS_STOP_NOT_DONE
DONE_ONLY_IF: COMMIT_SHA_PRESENT_AND_PUSH_DONE_AND_PR_DONE_AND_MERGE_DONE_OR_EXPLICIT_OWNER_ACCEPTED_STOP_PENDING_TARGET
PRIMARY_GOAL: harden private main diagnostic probe input handling and failure envelopes without adding public DOCX import or command surface
CONTOUR_TYPE: INTERNAL_RUNTIME_DIAGNOSTIC_PROBE_HARDENING
SCOPE_IN_01: private main probe accepts Buffer
SCOPE_IN_02: private main probe accepts Uint8Array
SCOPE_IN_03: Uint8Array input is copied to a new Buffer using the view byte range
SCOPE_IN_04: string input is rejected with typed private diagnostic error
SCOPE_IN_05: null input is rejected with typed private diagnostic error
SCOPE_IN_06: array input is rejected with typed private diagnostic error
SCOPE_IN_07: plain object input is rejected with typed private diagnostic error
SCOPE_IN_08: number input is rejected with typed private diagnostic error
SCOPE_IN_09: boolean input is rejected with typed private diagnostic error
SCOPE_IN_10: unsupported typed view input is rejected with typed private diagnostic error
SCOPE_IN_11: module load failure is wrapped as stable private diagnostic error
SCOPE_IN_12: inspectDocxIntakeEnvelopeDecision throw is wrapped as stable private diagnostic error
SCOPE_IN_13: diagnostic failure envelope includes ok false code reason diagnosticProbeVersion diagnosticOnly true docxImportAuthorized false runtimeAction NONE message
SCOPE_IN_14: diagnostic failure envelope excludes stack outPath currentFilePath projectPath
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
SCOPE_OUT_13: dependencies
ALLOWLIST_BASENAMES: main.js; hostilePackageGate.contract.test.js; DOCX_DIAGNOSTIC_ENVELOPE_PROBE_002.md
DENYLIST_BASENAMES: preload.js; editor.js; index.html; styles.css; package.json; package-lock.json; reviewIrKernel.mjs; command-catalog.v1.mjs; projectCommands.mjs; storage.js; network.js
CONTRACT_01: private probe is not registered in ipcMain handle
CONTRACT_02: private probe is not registered in UI command bridge
CONTRACT_03: private probe is not registered in menu command handlers
CONTRACT_04: preload command catalog and project commands do not expose probe
CONTRACT_05: probe source does not call write or revision session paths
CONTRACT_06: probe returns safe 001D decision without import authorization
CONTRACT_07: probe returns invalid zip XML hostile and macro hostile 001D blocked decisions
CONTRACT_08: probe rejects non Buffer and non Uint8Array inputs before module load or inspect
CONTRACT_09: probe copies Uint8Array view bytes to a new Buffer
CONTRACT_10: probe wraps module load failure as stable diagnostic error
CONTRACT_11: probe wraps inspectDocxIntakeEnvelopeDecision throw as stable diagnostic error
CONTRACT_12: diagnostic errors have no stack outPath currentFilePath or projectPath fields
FALSE_GREEN_BOUNDARY_01: this contour proves only private diagnostic binding and defensive probe envelopes
FALSE_GREEN_BOUNDARY_02: this contour does not prove public runtime API
FALSE_GREEN_BOUNDARY_03: this contour does not prove DOCX import
FALSE_GREEN_BOUNDARY_04: this contour does not prove DOCX semantic fidelity
FALSE_GREEN_BOUNDARY_05: this contour does not prove Word support
FALSE_GREEN_BOUNDARY_06: this contour does not prove Google support
FALSE_GREEN_BOUNDARY_07: this contour does not prove apply safety
TEST_COMMAND_01: node --test test/contracts/hostilePackageGate.contract.test.js
TEST_COMMAND_02: git diff --check
NEXT_CONTOUR_AFTER_SUCCESS: OWNER_APPROVED_DELIVERY_TARGET_OR_ACCEPTED_STOP_PENDING_TARGET_THEN_NEXT_CONTOUR_SELECTION
