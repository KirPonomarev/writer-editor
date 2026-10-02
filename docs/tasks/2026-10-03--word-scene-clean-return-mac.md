# WORD_SCENE_CLEAN_RETURN_MAC_20261003

STATUS: TARGET_DECLARED_NOT_ACCEPTED
DOCUMENT_CLASS: TASK_CONTRACT
TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BASE_SHA: aafacb6784b63cb422028d5a6992f94185972c06

## MICRO_GOAL

Accept authenticated ordinary text edits in a scene exported to Word through the existing exact preview and guarded Apply.

## ARTIFACT

Existing Main return routing repair with actual Main contract regression and native Mac evidence.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true.

## ALLOWLIST

- `src/main.js`
- `src/io/revisionBridge/index.mjs`
- `src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `test/contracts/rtk-word-user-bookmarks.contract.test.js`
- `docs/tasks/2026-10-03--word-scene-clean-return-mac.md`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`

- `src/export/docx/fullManuscriptDocxReviewReturnRouter.js`

## DENYLIST

No owner document changes, dependencies, UI layout, workflows, new writer or loosened authentication.

## CONTRACT / SHAPES

O: Scene export, ordinary Word edit, return preview, explicit Apply, save/reopen and re-export retain the exact change.
T: Canonical scene and signed local export map -> authenticated intake -> existing analyzer -> guarded Apply and atomic persistence.
H: Scene route rejects changed paragraph before full-route clean text analysis; route only independently validated changes through existing private capsule.
B: Preserve signed identity, topology, annotations, sibling files, dirty buffers, recovery and replay guards.
P: Failing actual Main regression, focused negatives, native source and packaged canary before stable gates.
I: Exact base above; isolated synthetic fixtures and captured build/artifact hashes.
Design router: backend-only repair; no visual design contract change.

### FEATURE_INTEGRATION_MANIFEST_V1

Integration mode: EXISTING_SEAM.
Product plane: canonical scene, existing authenticated export authority and clean text analyzer.
Interface plane: unchanged Review projection and explicit Apply controls.
Commands: existing review export, activation and Apply.
Queries: existing immutable review preview.
Events: existing transaction receipt and scene reload.
Effects and ports: existing bounded DOCX read/export and CAS atomic transaction adapters.
State classes: PROJECT_STATE, AUTHORING_WORKING_STATE, DERIVED_STATE.
Identity guards: project, scene, export round, exact source hash, session and generation.
Capability: Kernel dispatch and Main precommit revalidation.
Fallback: unsupported or ambiguous return refuses mutation with typed reason.
Recovery: existing readable snapshot, journal and replay protection.
Security: returned payload never supplies trusted paths or write authority.
Performance: bounded return processing off typing hot path.
Accessibility: existing native menu and Review controls.
Current: native single-scene ordinary edit rejected; target repair unaccepted until proof.
References: brain:refs returned general UI references, not relevant to this backend defect; exact Main source and existing clean-text tests are implementation references.

Router scope added after reproducer commit daca4438 and renewed clean preflight; original delivery base remains aafacb67.

## IMPLEMENTATION_STEPS

1. Reproduce actual Main scene return refusal.
2. Reuse bounded semantic analyzer while preserving scene and precommit guards.
3. Prove native source and packaged return before one stable gate wave.
4. Commit, push, required CI, PR merge, exact merged verification.

## CHECKS

CHECK_01_PRE_ADMISSION executes before edits: clean exact base, encrypted writable T7, bootstrap and architecture preflight.
CHECK_02+ execute after edits.
CHECK_02_POST_FOCUSED: actual Main export, activation, preview, Apply, replay; ordinary edits outside bookmark end; tamper, stale, dirty and annotation negatives.
CHECK_03_POST_NATIVE: source and packaged Mac Word return with artifact readback.
CHECK_04_POST_DELIVERY: baseline, relevant companions, audit, OSS, guardrails, required CI, exact merged regression.

## STOP_CONDITION

Ambiguous authority, unrelated dirty files, repeated identical failure, or missing mandatory proof. No whole-plan percentage from test counts.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1 and CODEX_OUTPUT_POLICY; exact SHA and observed scope.

## FAIL_PROTOCOL

Preserve failures; third identical signature requires changed hypothesis. Never bypass safety checks or label partial delivery complete.
