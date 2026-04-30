TASK_ID: DOCX_HOSTILE_PACKAGE_GATE_001A
DOCUMENT_TYPE: HARD_TZ_EXECUTED_CONTOUR_RECORD
STATUS: IMPLEMENTED_PENDING_LOCAL_VERIFY_AND_DELIVERY
CANON_BOUNDARY: ISOLATED_FEATURE_BRANCH_ONLY; MAINLINE_DELIVERY_FORBIDDEN_WITHOUT_OWNER_APPROVED_TARGET
MASTER_PLAN_BINDING: REVISION_BRIDGE_FULL_EVOLUTION_MASTER_PLAN_2026_04_30_R3
MASTER_PLAN_STAGE: STAGE_02_HOSTILE_FILE_GATE
PREVIOUS_CONTOUR_01: REVISION_BRIDGE_PRE_STAGE_00_ADMISSION_GUARD_001
PREVIOUS_CONTOUR_02: REVISION_BRIDGE_V4_REVIEW_IR_KERNEL_001A
PREVIOUS_CONTOUR_03: REVISION_BRIDGE_V4_REVIEW_IR_KERNEL_001B
DELIVERY_POLICY: COMMIT_REQUIRED true; PUSH_REQUIRED true; PR_REQUIRED true only to owner approved feature target; MERGE_REQUIRED true only to owner approved feature target
PRIMARY_GOAL: add a pure in memory ZIP package inventory gate that blocks hostile archive envelopes before any DOCX semantic parse
CONTOUR_TYPE: PURE_CONTRACT_SECURITY_CORE
SCOPE_IN_01: buffer only ZIP end of central directory scan
SCOPE_IN_02: central directory metadata read
SCOPE_IN_03: no extract by default policy
SCOPE_IN_04: entry count budget
SCOPE_IN_05: total compressed size budget
SCOPE_IN_06: total uncompressed size budget
SCOPE_IN_07: declared compression ratio budget
SCOPE_IN_08: store and deflate only compression method policy
SCOPE_IN_09: encrypted entry rejection
SCOPE_IN_10: ZIP64 unsupported blocker for 001A
SCOPE_IN_11: path traversal, absolute path, drive letter, backslash path, empty name and duplicate normalized name rejection
SCOPE_IN_12: symlink entry rejection when external attribute metadata is present
SCOPE_IN_13: package shape observations for minimal OPC parts
SCOPE_IN_14: deterministic report hash
SCOPE_OUT_01: DOCX semantic import
SCOPE_OUT_02: OOXML review parser
SCOPE_OUT_03: XML parser or XML policy implementation
SCOPE_OUT_04: OPC relationship target mode scan implementation
SCOPE_OUT_05: macro and OLE deep classifier
SCOPE_OUT_06: ReviewPatchSet adapter from DOCX
SCOPE_OUT_07: Review IR kernel coupling
SCOPE_OUT_08: runtime wiring
SCOPE_OUT_09: UI
SCOPE_OUT_10: storage migration
SCOPE_OUT_11: real project file reads
SCOPE_OUT_12: real project file writes
SCOPE_OUT_13: network
SCOPE_OUT_14: new dependencies
SCOPE_OUT_15: quarantine session implementation
ALLOWLIST_BASENAMES: hostilePackageGate.mjs; hostilePackageGate.contract.test.js; DOCX_HOSTILE_PACKAGE_GATE_001A.md
DENYLIST_BASENAMES: package.json; package-lock.json; main.js; preload.js; editor.js; index.html; styles.css; projectCommands.mjs; reviewIrKernel.mjs
CONTRACT_01: valid minimal DOCX like ZIP buffer returns allowed security status
CONTRACT_02: same buffer and policy produce identical report and gate hash
CONTRACT_03: policy change changes gate hash
CONTRACT_04: budget violations return blocked report with explicit reason codes
CONTRACT_05: hostile paths return blocked report before semantic parse
CONTRACT_06: duplicate normalized entry names return blocked report
CONTRACT_07: encrypted entries, unsupported compression methods and detectable symlinks return blocked report
CONTRACT_08: missing EOCD, ambiguous EOCD, invalid central directory and ZIP64 return blocked report
CONTRACT_09: missing OPC parts create package shape observations, not security blockers
CONTRACT_10: module stays pure and decoupled from parser, runtime, storage, network and Review IR layers
TEST_COMMAND_01: node --test hostilePackageGate.contract.test.js
TEST_COMMAND_02: node --test reviewIrKernel.contract.test.js canonicalHash.contract.test.js staleBaselineBlocker.contract.test.js matchProof.contract.test.js parsedSurfaceRecord.contract.test.js
TEST_COMMAND_03: node --test execution-profile-valid.contract.test.js verify-attestation.contract.test.js failsignal-registry.contract.test.js required-token-set-deterministic.contract.test.js
TEST_COMMAND_04: npm run oss:policy
FALSE_GREEN_BOUNDARY_01: this contour proves package envelope security only
FALSE_GREEN_BOUNDARY_02: this contour does not prove DOCX import
FALSE_GREEN_BOUNDARY_03: this contour does not prove XML safety
FALSE_GREEN_BOUNDARY_04: this contour does not prove OPC relationship safety
FALSE_GREEN_BOUNDARY_05: this contour does not prove Word support or Google support
FALSE_GREEN_BOUNDARY_06: security allowed does not mean ready to apply
NEXT_CONTOUR_AFTER_SUCCESS: DOCX_HOSTILE_PACKAGE_GATE_001B_XML_AND_OPC_RELATIONSHIP_POLICY
