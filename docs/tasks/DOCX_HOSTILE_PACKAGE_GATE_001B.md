TASK_ID: DOCX_HOSTILE_PACKAGE_GATE_001B
DOCUMENT_TYPE: HARD_TZ_EXECUTED_CONTOUR_RECORD
STATUS: IMPLEMENTED_PENDING_LOCAL_VERIFY_AND_DELIVERY
CANON_BOUNDARY: ISOLATED_FEATURE_BRANCH_ONLY; MAINLINE_DELIVERY_FORBIDDEN_WITHOUT_OWNER_APPROVED_TARGET
MASTER_PLAN_BINDING: REVISION_BRIDGE_FULL_EVOLUTION_MASTER_PLAN_2026_04_30_R3
MASTER_PLAN_STAGE: STAGE_02_HOSTILE_FILE_GATE
PREVIOUS_CONTOUR_01: DOCX_HOSTILE_PACKAGE_GATE_001A
DELIVERY_POLICY: COMMIT_REQUIRED true; PUSH_REQUIRED true; PR_REQUIRED true only to owner approved feature target; MERGE_REQUIRED true only to owner approved feature target
PRIMARY_GOAL: extend the pure package gate with bounded XML text preflight and OPC relationship target text preflight without XML semantic parse
CONTOUR_TYPE: PURE_CONTRACT_SECURITY_CORE
SCOPE_IN_01: package gate blocked short circuit
SCOPE_IN_02: local header metadata verification for selected entries
SCOPE_IN_03: selected XML entry count cap
SCOPE_IN_04: bounded entry content read from buffer only
SCOPE_IN_05: bounded store and deflate handling for selected XML entries only
SCOPE_IN_06: max XML entry bytes policy
SCOPE_IN_07: max total XML bytes policy
SCOPE_IN_08: max XML token length policy
SCOPE_IN_09: XML DTD, DOCTYPE, ENTITY and external entity text blockers
SCOPE_IN_10: OPC relationship TargetMode External and hostile Target text blockers
SCOPE_IN_11: selectedEntries and skippedEntries report fields
SCOPE_IN_12: xmlPreflightReport and relationshipPolicyReport sections
SCOPE_IN_13: deterministic XML preflight gate hash
SCOPE_OUT_01: DOCX semantic import
SCOPE_OUT_02: XML DOM tree building
SCOPE_OUT_03: XML validation
SCOPE_OUT_04: relationship URI or path resolution
SCOPE_OUT_05: ReviewPatchSet adapter from DOCX
SCOPE_OUT_06: comment or revision semantic extraction
SCOPE_OUT_07: runtime wiring
SCOPE_OUT_08: UI
SCOPE_OUT_09: storage migration
SCOPE_OUT_10: real project file reads
SCOPE_OUT_11: real project file writes
SCOPE_OUT_12: network
SCOPE_OUT_13: new dependencies
SCOPE_OUT_14: Review IR kernel coupling
ALLOWLIST_BASENAMES: hostilePackageGate.mjs; hostilePackageGate.contract.test.js; DOCX_HOSTILE_PACKAGE_GATE_001B.md
DENYLIST_BASENAMES: package.json; package-lock.json; main.js; preload.js; editor.js; index.html; styles.css; projectCommands.mjs; reviewIrKernel.mjs
CONTRACT_01: package gate 001A runs before XML preflight
CONTRACT_02: package gate blocked result short circuits XML preflight
CONTRACT_03: safe minimal DOCX like XML package returns allowed
CONTRACT_04: same buffer and policy produce identical XML preflight report and hash
CONTRACT_05: policy change changes XML preflight gate hash
CONTRACT_06: selected XML entry count limit returns blocked
CONTRACT_07: deflate output limit returns blocked
CONTRACT_08: XML size and token budget violations return blocked
CONTRACT_09: DTD, DOCTYPE, ENTITY and external entity text patterns return blocked
CONTRACT_10: external and hostile relationship targets return blocked without fetch
CONTRACT_11: selectedEntries and skippedEntries are reported
CONTRACT_12: existing package gate 001A contracts remain green
CONTRACT_13: module has no fs, electron, network, child process, fetch, docx, external XML library or Review IR imports
TEST_COMMAND_01: node --test hostilePackageGate.contract.test.js
TEST_COMMAND_02: node --test reviewIrKernel.contract.test.js canonicalHash.contract.test.js staleBaselineBlocker.contract.test.js matchProof.contract.test.js parsedSurfaceRecord.contract.test.js
TEST_COMMAND_03: node --test execution-profile-valid.contract.test.js verify-attestation.contract.test.js failsignal-registry.contract.test.js required-token-set-deterministic.contract.test.js
TEST_COMMAND_04: npm run oss:policy
FALSE_GREEN_BOUNDARY_01: this contour proves XML text preflight, not XML validity
FALSE_GREEN_BOUNDARY_02: this contour proves relationship target text preflight, not semantic relationship resolution
FALSE_GREEN_BOUNDARY_03: this contour does not prove DOCX import
FALSE_GREEN_BOUNDARY_04: this contour does not prove review semantics
FALSE_GREEN_BOUNDARY_05: security allowed does not mean ready to apply
NEXT_CONTOUR_AFTER_SUCCESS: DOCX_HOSTILE_PACKAGE_GATE_001C_MACRO_OLE_SURFACE_OBSERVATIONS_AND_RUNTIME_ADMISSION_BOUNDARY
