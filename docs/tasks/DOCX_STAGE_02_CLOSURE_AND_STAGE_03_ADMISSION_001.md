TASK_ID: DOCX_STAGE_02_CLOSURE_AND_STAGE_03_ADMISSION_001
DOCUMENT_TYPE: HARD_TZ_STAGE_BOUNDARY_CLOSURE_AND_ADMISSION_RECORD
STATUS: IMPLEMENTED_PENDING_LOCAL_VERIFY_AND_DELIVERY
CANON_BOUNDARY: STAGE_BOUNDARY_RECORD_ONLY; NO_RUNTIME_EXECUTION; NO_PUBLIC_DOCX_IMPORT; NO_STAGE_03_IMPLEMENTATION
MASTER_PLAN_ANCHOR: REVISION_BRIDGE_FULL_EVOLUTION_MASTER_PLAN_R3
MASTER_PLAN_STAGE_CLOSED: STAGE_02_HOSTILE_FILE_GATE
MASTER_PLAN_STAGE_ADMITTED_NEXT: STAGE_03_EXACT_TEXT_APPLY_FOUNDATION
BASE_BRANCH_CONTEXT: ISOLATED_FEATURE_BRANCH
HEAD_SHA_BEFORE: fc549a042e43f50d903827e954cb4e65c387951a

DELIVERY_MODE: WRITE_CHAIN_ISOLATED_FEATURE_BRANCH
DELIVERY_POLICY: COMMIT_REQUIRED true; PUSH_REQUIRED true; PR_REQUIRED true; MERGE_REQUIRED true
DELIVERY_TARGET_POLICY: PR_AND_MERGE_REQUIRE_OWNER_APPROVED_ISOLATED_FEATURE_TARGET
DELIVERY_EXCEPTION_STATUS: NOT_A_DOWNGRADE_STOP_BEFORE_PR_AND_MERGE_UNTIL_OWNER_APPROVES_TARGET
DELIVERY_EXCEPTION_REASON: MAINLINE_HAS_SEPARATE_ACTIVE_DEVELOPMENT_PROCESS_AND_THIS_FEATURE_WORK_IS_ISOLATED
DELIVERY_EXCEPTION_SCOPE: PR_AND_MERGE_TARGET_SELECTION_ONLY
DELIVERY_EXCEPTION_OWNER: OWNER_IN_THREAD
DELIVERY_EXCEPTION_EXPIRY: WHEN_OWNER_APPROVES_ISOLATED_PR_TARGET_OR_ACCEPTS_STOP_NOT_DONE
DONE_ONLY_IF: COMMIT_SHA_PRESENT_AND_PUSH_DONE_AND_PR_DONE_AND_MERGE_DONE_OR_EXPLICIT_OWNER_ACCEPTED_STOP_PENDING_TARGET

PRIMARY_GOAL: close Stage 02 as proven with limits and admit Stage 03 only as declarative exact text apply foundation boundary
CONTOUR_TYPE: DOCS_ONLY_STAGE_BOUNDARY_RECORD
CONTOUR_OUTPUT_01: STAGE_02_CLOSURE_STATUS
CONTOUR_OUTPUT_02: STAGE_02_FALSE_GREEN_BOUNDARY
CONTOUR_OUTPUT_03: STAGE_03_ADMISSION_BOUNDARY
CONTOUR_OUTPUT_04: NEXT_CONTOUR_ENTRY_CRITERIA_FOR_EXACT_TEXT_APPLY_FOUNDATION_001A
CONTOUR_OUTPUT_05: DELIVERY_STATUS_SECTION_SEPARATED_FROM_TECHNICAL_PROOF_SECTION

PREVIOUS_CONTOUR_01: DOCX_HOSTILE_PACKAGE_GATE_001A
PREVIOUS_CONTOUR_02: DOCX_HOSTILE_PACKAGE_GATE_001B
PREVIOUS_CONTOUR_03: DOCX_HOSTILE_PACKAGE_GATE_001C
PREVIOUS_CONTOUR_04: DOCX_HOSTILE_PACKAGE_GATE_001D
PREVIOUS_CONTOUR_05: DOCX_HOSTILE_PACKAGE_GATE_001E
PREVIOUS_CONTOUR_06: DOCX_DIAGNOSTIC_ENVELOPE_PROBE_001
PREVIOUS_CONTOUR_07: DOCX_DIAGNOSTIC_ENVELOPE_PROBE_002

ALLOWLIST_BASENAMES: DOCX_STAGE_02_CLOSURE_AND_STAGE_03_ADMISSION_001.md
OPTIONAL_ALLOWLIST_BASENAMES: hostilePackageGate.contract.test.js only if a real machine check gap is found
DENYLIST_BASENAMES: main.js; preload.js; editor.js; index.html; styles.css; package.json; package-lock.json; reviewIrKernel.mjs; command-catalog.v1.mjs; projectCommands.mjs

SCOPE_IN_01: record Stage 02 closure status
SCOPE_IN_02: record Stage 02 proven invariants
SCOPE_IN_03: record Stage 02 false green boundaries
SCOPE_IN_04: record Stage 03 declarative admission boundary
SCOPE_IN_05: record Stage 03 first execution entry criteria
SCOPE_IN_06: record verification commands and expected result categories
SCOPE_IN_07: keep delivery status separate from technical proof status

SCOPE_OUT_01: runtime code changes
SCOPE_OUT_02: public IPC
SCOPE_OUT_03: preload API
SCOPE_OUT_04: renderer UI
SCOPE_OUT_05: command catalog entry
SCOPE_OUT_06: project command entry
SCOPE_OUT_07: semantic DOCX parser
SCOPE_OUT_08: DOCX import authorization
SCOPE_OUT_09: Review IR coupling
SCOPE_OUT_10: apply logic
SCOPE_OUT_11: storage migration
SCOPE_OUT_12: dependency changes
SCOPE_OUT_13: Word support claim
SCOPE_OUT_14: Google support claim
SCOPE_OUT_15: UI design change

STAGE_02_CLOSURE_STATUS_01: STAGE_02_STATUS_PROVEN_WITH_LIMITS
STAGE_02_CLOSURE_STATUS_02: PACKAGE_GATE_COMPLETED_DOCX_HOSTILE_PACKAGE_GATE_001A
STAGE_02_CLOSURE_STATUS_03: XML_PREFLIGHT_COMPLETED_DOCX_HOSTILE_PACKAGE_GATE_001B
STAGE_02_CLOSURE_STATUS_04: SECURITY_SURFACE_POLICY_COMPLETED_DOCX_HOSTILE_PACKAGE_GATE_001C
STAGE_02_CLOSURE_STATUS_05: INTAKE_ENVELOPE_COMPLETED_DOCX_HOSTILE_PACKAGE_GATE_001D
STAGE_02_CLOSURE_STATUS_06: EXPORT_SURFACE_GUARD_COMPLETED_DOCX_HOSTILE_PACKAGE_GATE_001E
STAGE_02_CLOSURE_STATUS_07: PRIVATE_DIAGNOSTIC_BINDING_COMPLETED_DOCX_DIAGNOSTIC_ENVELOPE_PROBE_001
STAGE_02_CLOSURE_STATUS_08: PRIVATE_DIAGNOSTIC_HARDENING_COMPLETED_DOCX_DIAGNOSTIC_ENVELOPE_PROBE_002

STAGE_02_PROVEN_INVARIANT_01: package gate blocks entry count, size, compression ratio, path traversal, empty name, duplicate name, encrypted entry, unsupported method, symlink, missing EOCD, ambiguous EOCD, invalid central directory, and ZIP64 cases
STAGE_02_PROVEN_INVARIANT_02: XML preflight blocks selected entry count, selected entry size, inflated size, large XML token, entity declaration, external relationship, and hostile target cases
STAGE_02_PROVEN_INVARIANT_03: security surface policy observes macro, OLE, and ActiveX surfaces without binary semantic parse
STAGE_02_PROVEN_INVARIANT_04: intake envelope never authorizes runtime import
STAGE_02_PROVEN_INVARIANT_05: security core export surface exposes no import enablement names
STAGE_02_PROVEN_INVARIANT_06: private main diagnostic probe is not public API
STAGE_02_PROVEN_INVARIANT_07: private main diagnostic probe accepts only Buffer and Uint8Array
STAGE_02_PROVEN_INVARIANT_08: private main diagnostic probe rejects non byte input before module load
STAGE_02_PROVEN_INVARIANT_09: private main diagnostic probe returns stable private errors without stack or path fields
STAGE_02_PROVEN_INVARIANT_10: Stage 02 output is security decision and diagnostic observation only

STAGE_02_FALSE_GREEN_BOUNDARY_01: does not prove DOCX import
STAGE_02_FALSE_GREEN_BOUNDARY_02: does not prove DOCX semantic fidelity
STAGE_02_FALSE_GREEN_BOUNDARY_03: does not prove Word support
STAGE_02_FALSE_GREEN_BOUNDARY_04: does not prove Google support
STAGE_02_FALSE_GREEN_BOUNDARY_05: does not prove Review IR coupling
STAGE_02_FALSE_GREEN_BOUNDARY_06: does not prove apply safety
STAGE_02_FALSE_GREEN_BOUNDARY_07: does not prove comment survival
STAGE_02_FALSE_GREEN_BOUNDARY_08: does not prove project level transaction
STAGE_02_FALSE_GREEN_BOUNDARY_09: does not prove public runtime API
STAGE_02_FALSE_GREEN_BOUNDARY_10: does not prove release claim

STAGE_03_ADMISSION_BOUNDARY_01: STAGE_03_STATUS_NOT_STARTED
STAGE_03_ADMISSION_BOUNDARY_02: Stage 03 admission is declarative and not execution
STAGE_03_ADMISSION_BOUNDARY_03: Stage 03 first execution may only target exact text apply foundation
STAGE_03_ADMISSION_BOUNDARY_04: Stage 03 must not enable DOCX import runtime
STAGE_03_ADMISSION_BOUNDARY_05: Stage 03 must not enable structural apply
STAGE_03_ADMISSION_BOUNDARY_06: Stage 03 must not enable multi scope apply
STAGE_03_ADMISSION_BOUNDARY_07: Stage 03 must not add review UI
STAGE_03_ADMISSION_BOUNDARY_08: Stage 03 must not use DOCX as truth

STAGE_03_ALLOWED_FIRST_EXECUTION_SCOPE_01: ApplyOp patch plus test semantics
STAGE_03_ALLOWED_FIRST_EXECUTION_SCOPE_02: project id test
STAGE_03_ALLOWED_FIRST_EXECUTION_SCOPE_03: scene id test
STAGE_03_ALLOWED_FIRST_EXECUTION_SCOPE_04: block version hash test
STAGE_03_ALLOWED_FIRST_EXECUTION_SCOPE_05: exact text guard
STAGE_03_ALLOWED_FIRST_EXECUTION_SCOPE_06: closed session blocker
STAGE_03_ALLOWED_FIRST_EXECUTION_SCOPE_07: wrong project blocker
STAGE_03_ALLOWED_FIRST_EXECUTION_SCOPE_08: baseline hash blocker
STAGE_03_ALLOWED_FIRST_EXECUTION_SCOPE_09: backup atomic write receipt for exact text only later
STAGE_03_ALLOWED_FIRST_EXECUTION_SCOPE_10: contract tests before runtime apply wiring

STAGE_03_BLOCKED_FIRST_EXECUTION_SCOPE_01: DOCX semantic import
STAGE_03_BLOCKED_FIRST_EXECUTION_SCOPE_02: DOCX review import
STAGE_03_BLOCKED_FIRST_EXECUTION_SCOPE_03: Word roundtrip claim
STAGE_03_BLOCKED_FIRST_EXECUTION_SCOPE_04: Google roundtrip claim
STAGE_03_BLOCKED_FIRST_EXECUTION_SCOPE_05: structural move split merge auto apply
STAGE_03_BLOCKED_FIRST_EXECUTION_SCOPE_06: comment thread apply
STAGE_03_BLOCKED_FIRST_EXECUTION_SCOPE_07: multi scene transaction
STAGE_03_BLOCKED_FIRST_EXECUTION_SCOPE_08: UI review surface

NEXT_CONTOUR_ENTRY_CRITERIA_01: worktree clean or explicit hygiene contour
NEXT_CONTOUR_ENTRY_CRITERIA_02: isolated feature branch confirmed
NEXT_CONTOUR_ENTRY_CRITERIA_03: Stage 02 closure record committed and pushed or owner accepted stop
NEXT_CONTOUR_ENTRY_CRITERIA_04: exact text apply foundation 001A has own allowlist
NEXT_CONTOUR_ENTRY_CRITERIA_05: exact text apply foundation 001A names contracts before runtime writes
NEXT_CONTOUR_ENTRY_CRITERIA_06: no DOCX import runtime in Stage 03 first execution
NEXT_CONTOUR_ENTRY_CRITERIA_07: no UI change in Stage 03 first execution
NEXT_CONTOUR_ENTRY_CRITERIA_08: no new dependency in Stage 03 first execution

STATIC_SCAN_POLICY: static scan is context interpreted, not raw match count
STATIC_SCAN_EXPECTED_MATCH_CONTEXT_01: existing test references to private probe
STATIC_SCAN_EXPECTED_MATCH_CONTEXT_02: existing main private function definition
STATIC_SCAN_EXPECTED_MATCH_CONTEXT_03: task record text
STATIC_SCAN_FORBIDDEN_MATCH_CONTEXT_01: ipcMain handle registration for diagnostic probe
STATIC_SCAN_FORBIDDEN_MATCH_CONTEXT_02: preload exposure for diagnostic probe
STATIC_SCAN_FORBIDDEN_MATCH_CONTEXT_03: command catalog exposure for diagnostic probe
STATIC_SCAN_FORBIDDEN_MATCH_CONTEXT_04: project commands exposure for diagnostic probe
STATIC_SCAN_FORBIDDEN_MATCH_CONTEXT_05: renderer UI exposure for diagnostic probe
STATIC_SCAN_FORBIDDEN_MATCH_CONTEXT_06: import authorized runtime action exposure

MANDATORY_CHECK_01: git status is clean before write
MANDATORY_CHECK_02: branch is isolated feature branch
MANDATORY_CHECK_03: HEAD matches expected or owner approved forward head
MANDATORY_CHECK_04: node --test test/contracts/hostilePackageGate.contract.test.js
MANDATORY_CHECK_05: node --test test/contracts/reviewIrKernel.contract.test.js test/contracts/canonicalHash.contract.test.js test/contracts/staleBaselineBlocker.contract.test.js test/contracts/matchProof.contract.test.js test/contracts/parsedSurfaceRecord.contract.test.js
MANDATORY_CHECK_06: node --test test/contracts/execution-profile-valid.contract.test.js test/contracts/verify-attestation.contract.test.js test/contracts/failsignal-registry.contract.test.js test/contracts/required-token-set-deterministic.contract.test.js
MANDATORY_CHECK_07: npm run oss:policy
MANDATORY_CHECK_08: git diff --check
MANDATORY_CHECK_09: context aware static scan finds no forbidden public surface
MANDATORY_CHECK_10: independent read only auditor pass
MANDATORY_CHECK_11: staged scope allowlist only
MANDATORY_CHECK_12: post commit clean status
MANDATORY_CHECK_13: push result done or stop reason recorded

STOP_CONDITION_01: current branch is not isolated feature branch
STOP_CONDITION_02: worktree not clean before write
STOP_CONDITION_03: HEAD drift is not owner approved
STOP_CONDITION_04: runtime code change becomes necessary
STOP_CONDITION_05: need to touch denylist basename
STOP_CONDITION_06: need to add public DOCX import
STOP_CONDITION_07: need to add preload command or UI surface
STOP_CONDITION_08: need to add dependency
STOP_CONDITION_09: need to change Review IR kernel
STOP_CONDITION_10: existing tests fail
STOP_CONDITION_11: static scan finds forbidden context
STOP_CONDITION_12: independent auditor finds false green
STOP_CONDITION_13: PR or merge target is not owner approved after push

DELIVERY_STATUS_SECTION: delivery status is separate from technical proof status
TECHNICAL_PROOF_STATUS: Stage 02 is closed only as proven with limits
NEXT_STAGE_STATUS: Stage 03 is admitted only as declarative boundary and is not started
SCREENSHOT_REQUIREMENT: not applicable because contour changes no UI or visual design surface
DEPENDENCY_STATUS: no dependency change allowed
UI_STATUS: no UI change allowed
RUNTIME_STATUS: no runtime code change allowed

TERMS_GLOSSARY_01: closure means current stage proof is recorded with limits
TERMS_GLOSSARY_02: admission means next stage entry boundary is declared
TERMS_GLOSSARY_03: execution means runtime or contract implementation work starts
TERMS_GLOSSARY_04: this contour is closure and admission, not execution

FALSE_PASS_GUARD_01: Stage 02 closure must not be used as a DOCX import release claim
FALSE_PASS_GUARD_02: private diagnostic probe must not be described as product API
FALSE_PASS_GUARD_03: Stage 03 admission must not be described as apply implementation
FALSE_PASS_GUARD_04: delivery push must not be described as PR or merge completion

NEXT_CONTOUR_AFTER_SUCCESS: EXACT_TEXT_APPLY_FOUNDATION_001A_PLAN_OR_OWNER_APPROVED_DELIVERY_TARGET
