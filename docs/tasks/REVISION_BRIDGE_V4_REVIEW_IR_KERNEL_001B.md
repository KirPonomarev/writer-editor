TASK_ID: REVISION_BRIDGE_V4_REVIEW_IR_KERNEL_001B
DOCUMENT_TYPE: HARD_TZ_EXECUTED_CONTOUR_RECORD
STATUS: IMPLEMENTED_PENDING_LOCAL_VERIFY_AND_DELIVERY
CANON_BOUNDARY: ISOLATED_FEATURE_BRANCH_ONLY; MAINLINE_DELIVERY_FORBIDDEN_WITHOUT_OWNER_APPROVED_TARGET
MASTER_PLAN_BINDING: REVISION_BRIDGE_FULL_EVOLUTION_MASTER_PLAN_2026_04_30_R3
PREVIOUS_CONTOUR: REVISION_BRIDGE_V4_REVIEW_IR_KERNEL_001A
DELIVERY_POLICY: COMMIT_REQUIRED true; PUSH_REQUIRED true; PR_REQUIRED true only to owner approved feature target; MERGE_REQUIRED true only to owner approved feature target
PRIMARY_GOAL: extend the pure Review IR kernel with static MatchProof and ParsedSurfaceRecord contracts without creating a real matcher, real adapter, parser expansion, runtime wiring, storage migration, UI, network, or dependency changes
SCOPE_IN_01: deterministic static MatchProof record
SCOPE_IN_02: MatchProof status and reason code propagation into ReviewOpIR
SCOPE_IN_03: deterministic static ParsedSurfaceRecord record for synthetic in memory parsed surfaces
SCOPE_IN_04: source view state and selector stack reuse from 001A
SCOPE_IN_05: negative contract guards proving no parser, matcher engine, project search, apply compiler, runtime, network, electron, or storage import
SCOPE_OUT_01: real Markdown adapter
SCOPE_OUT_02: real DOCX parser
SCOPE_OUT_03: project text search
SCOPE_OUT_04: fuzzy matcher or matcher quorum engine
SCOPE_OUT_05: apply compiler that emits writable ApplyOps
SCOPE_OUT_06: ReviewBOM matrix expansion
SCOPE_OUT_07: UI or renderer changes
SCOPE_OUT_08: storage migration
SCOPE_OUT_09: dependency changes
ALLOWLIST_BASENAMES: reviewIrKernel.mjs; matchProof.contract.test.js; parsedSurfaceRecord.contract.test.js; REVISION_BRIDGE_V4_REVIEW_IR_KERNEL_001B.md
DENYLIST_BASENAMES: package.json; package-lock.json; main.js; preload.js; editor.js; index.html; styles.css; projectCommands.mjs
CONTRACT_01: MatchProof is deterministic and hash bound
CONTRACT_02: ambiguous MatchProof carries MULTI_MATCH and is manual only when attached to ReviewOpIR
CONTRACT_03: no match carries LOW_SELECTOR_CONFIDENCE and is manual only when attached to ReviewOpIR
CONTRACT_04: ParsedSurfaceRecord identity is bound to artifact hash and context hash
CONTRACT_05: ParsedSurfaceRecord remains static and synthetic only
CONTRACT_06: no parser, matcher engine, project search, runtime wiring, storage, electron, fetch, or apply compiler is introduced
CONTRACT_07: existing 001A contracts remain green
TEST_COMMAND_01: node --test reviewIrKernel.contract.test.js canonicalHash.contract.test.js staleBaselineBlocker.contract.test.js matchProof.contract.test.js parsedSurfaceRecord.contract.test.js
TEST_COMMAND_02: node --test execution-profile-valid.contract.test.js verify-attestation.contract.test.js failsignal-registry.contract.test.js required-token-set-deterministic.contract.test.js
TEST_COMMAND_03: npm run oss:policy
ACCEPTANCE_01: targeted Review IR kernel tests pass
ACCEPTANCE_02: adjacent governance tests pass
ACCEPTANCE_03: oss policy passes
ACCEPTANCE_04: changed basenames match allowlist
ACCEPTANCE_05: commit and push complete on isolated branch
FALSE_GREEN_BOUNDARY_01: MatchProof in this contour is a static evidence record, not a real matching capability
FALSE_GREEN_BOUNDARY_02: ParsedSurfaceRecord in this contour is a synthetic in memory record, not a real import adapter
FALSE_GREEN_BOUNDARY_03: ReviewBOM remains minimal and is not a capability matrix
FALSE_GREEN_BOUNDARY_04: blocked apply preview still emits zero ApplyOps and is not production apply
NEXT_CONTOUR_AFTER_SUCCESS: DOCX_HOSTILE_FILE_GATE_001 or owner approved continuation of kernel contracts
