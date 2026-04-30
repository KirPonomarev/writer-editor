TASK_ID: DOCX_HOSTILE_PACKAGE_GATE_001C
DOCUMENT_TYPE: HARD_TZ_EXECUTED_CONTOUR_RECORD
STATUS: IMPLEMENTED_PENDING_LOCAL_VERIFY_AND_DELIVERY
CANON_BOUNDARY: PURE_REPORT_ONLY_SECURITY_SURFACE_POLICY; NO_RUNTIME_WIRING
MASTER_PLAN_STAGE: STAGE_02_HOSTILE_FILE_GATE
PREVIOUS_CONTOUR_01: DOCX_HOSTILE_PACKAGE_GATE_001A
PREVIOUS_CONTOUR_02: DOCX_HOSTILE_PACKAGE_GATE_001B
DELIVERY_POLICY: COMMIT_REQUIRED true; PUSH_REQUIRED true; PR_REQUIRED true only to owner approved isolated feature target; MERGE_REQUIRED true only to owner approved isolated feature target
PRIMARY_GOAL: extend the pure hostile package gate with macro, OLE and active content surface observations without DOCX import authorization
CONTOUR_TYPE: PURE_CONTRACT_SECURITY_CORE
SCOPE_IN_01: package gate 001A runs before surface policy
SCOPE_IN_02: XML preflight 001B runs before surface policy
SCOPE_IN_03: prior blocked gate short circuits surface observation
SCOPE_IN_04: vbaProject entry name observation
SCOPE_IN_05: macro content type text observation from bounded Content_Types text only
SCOPE_IN_06: macro relationship type text observation from bounded rels text only
SCOPE_IN_07: embedding entry name observation
SCOPE_IN_08: OLE relationship type text observation from bounded rels text only
SCOPE_IN_09: activeX entry name observation
SCOPE_IN_10: active content relationship type text observation from bounded rels text only
SCOPE_IN_11: deterministic surface evidence observation hashes
SCOPE_IN_12: deterministic surface policy report hash
SCOPE_IN_13: docxImportAuthorized false for every outcome
SCOPE_IN_14: runtimeAction NONE for every outcome
SCOPE_OUT_01: DOCX semantic import
SCOPE_OUT_02: runtime admission
SCOPE_OUT_03: quarantine implementation
SCOPE_OUT_04: VBA binary parse
SCOPE_OUT_05: OLE binary parse
SCOPE_OUT_06: relationship resolution
SCOPE_OUT_07: XML DOM
SCOPE_OUT_08: DOCX semantics
SCOPE_OUT_09: Review IR kernel coupling
SCOPE_OUT_10: UI
SCOPE_OUT_11: storage migration
SCOPE_OUT_12: network
SCOPE_OUT_13: new dependencies
ALLOWLIST_BASENAMES: hostilePackageGate.mjs; hostilePackageGate.contract.test.js; DOCX_HOSTILE_PACKAGE_GATE_001C.md
DENYLIST_BASENAMES: reviewIrKernel.mjs; package.json; package-lock.json; main.js; preload.js; editor.js; index.html; styles.css
CONTRACT_01: safe package reports no high risk surface and does not authorize DOCX import
CONTRACT_02: package gate blocked result short circuits surface observation
CONTRACT_03: XML preflight blocked result short circuits surface observation
CONTRACT_04: vbaProject entry name is high risk evidence
CONTRACT_05: macro content type is high risk evidence
CONTRACT_06: macro relationship type is high risk evidence
CONTRACT_07: embedding entry name is high risk evidence
CONTRACT_08: OLE relationship type is high risk evidence
CONTRACT_09: activeX entry name is high risk evidence
CONTRACT_10: active content relationship type is high risk evidence
CONTRACT_11: same buffer and policy produce identical surface report and hash
CONTRACT_12: policy change changes surface report hash
CONTRACT_13: evidence observation hashes are deterministic and evidence-bound
CONTRACT_14: production exports do not expose runtime admission or quarantine terms
CONTRACT_15: high risk macro, OLE or active content surface sets securityStatus BLOCKED
CONTRACT_16: top level docxImportAuthorized is false for safe, blocked and high risk surface outcomes
CONTRACT_17: top level runtimeAction is NONE for safe, blocked and high risk surface outcomes
FALSE_GREEN_BOUNDARY_01: this contour proves surface observation only
FALSE_GREEN_BOUNDARY_02: this contour does not prove DOCX import
FALSE_GREEN_BOUNDARY_03: this contour does not parse VBA or OLE binaries
FALSE_GREEN_BOUNDARY_04: this contour does not resolve relationships
FALSE_GREEN_BOUNDARY_05: this contour does not authorize runtime apply
FALSE_GREEN_BOUNDARY_06: this contour does not implement runtime admission
FALSE_GREEN_BOUNDARY_07: this contour does not implement quarantine
NEXT_CONTOUR_AFTER_SUCCESS: OWNER_APPROVED_DOCX_IMPORT_CONTOUR_REQUIRED_AFTER_LOCAL_DELIVERY_CHAIN
