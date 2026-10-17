# Theme colors in one-way manuscript import

TASK_ID: YALKEN_DOCX_THEME_COLORS_20261017
TYPE: CORE
DOCUMENT_CLASS: PROCESS
STATUS: IMPLEMENTATION_PENDING
CLAIM_BOUNDARY: Existing DOCX to independent new project; deterministic RGB normalization, not exact Word renderer replication.
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
ACTIVE_EXECUTION_CANON: v3.13a-final
BINDING_BASE_SHA: df5418ad974c21e85186c40e0f8b257995e8582b
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_HEAD_VERIFICATION_REQUIRED=true
ROLE: Sole coding agent; no delegated writer.

## MICRO_GOAL

O: Existing one-way importer resolves supported theme foreground/shading into literal RGB instead of losing color or refusing pending text revisions; unresolved effective colors identify the paragraph and cause.
T: Bounded selected DOCX -> validated relationships and XML -> existing style cascade -> pure RGB projection -> existing admitted plan and atomic new-project creation.
H: Effective theme references are deliberately classified as unsupported. Resolving explicit sRGB palette entries through document mapping and HSL luminance transforms removes this cause without changing text, anchors or persistence.
B: Keep legacy/review behavior, strict input validation, original files/projects/profiles, comments, notes, revision decisions, protected pins and prior approvals. No system-color guesses, new dependencies, bounds or network.
P: Small maintained causal tests; actual Word RTF matrix; complete editorial model comparisons; existing affected contracts, mandatory governance/CI and merged exact-head verification.
I: Clean delivered M6, verified T7-Secure/T777 UUIDs; exact input/source hashes. No SOURCE80 or old native project admission.

## ARTIFACT

Bounded resolution in the existing parser, explicit normalization text in the existing preview diagnostic, and precise refusal for unresolved colors with pending text revisions. Fixed maps and constant-time integer arithmetic only. No new architecture or visual surface.

## ALLOWLIST

- src/io/revisionBridge/index.mjs
- src/renderer/editor.js
- src/renderer/editor.bundle.js
- test/contracts/revision-bridge-docx-colors.contract.test.js
- test/contracts/rtk-generic01-create-only-import.contract.test.js
- test/unit/docx-import-preview-ui-flow.test.js
- docs/tasks/2026-10-17--docx-theme-colors.md
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/post-audit-certification-set.mjs

## DENYLIST

- src/core
- src/product
- src/main.js
- src/renderer/index.html
- src/renderer/styles.css
- package.json
- package-lock.json
- Existing manuscripts, profiles, trust, histories, SOURCE80 and original input documents.

## CONTRACT / SHAPES

FEATURE_INTEGRATION_MANIFEST_V1
featureId: docx.import.new-project.v1.theme-colors
productPlane: Pure existing DOCX parser owns semantic color resolution; existing Core and atomic persistence own publication unchanged.
interfacePlane: Existing immutable preview and diagnostic text; no new surface, styles, palette, layout or component states.
Commands: Existing importDocxV1 and safe new-project confirmation; no new command or capability.
Queries: Existing preview/plan/summary shapes unchanged.
Events: Existing project publication unchanged.
Effects: Existing bounded local read/compute and atomic create ports unchanged.
Identity: Existing source digest, private refs, project/context/window/revision/generation and Kernel revalidation retained.
StateClasses: DERIVED_STATE only in this parser; PROJECT_STATE and AUTHORING_WORKING_STATE protected.
Fallback: Missing, transformed or system-dependent palette values and patterned shading remain explicit losses; pending unsupported color refuses with a bounded specific paragraph diagnostic. Cached w:val never substitutes for a theme definition.
Normalization: Resolve explicit sRGB using fixed semantic mapping, tint/shade HSL luminance formulas and final integer truncation. Word's closed-source byte rounding is not reproduced; disclose possible small shade differences in the existing one-way presentation warning. No claim of pixel-exact Word colors. Tint has precedence when both modifiers exist per MS-OI29500.
Performance: Fixed-size maps and constant-time safe integer arithmetic per used run; no new process, cache or budget.
Accessibility: Existing text diagnostic and modal unchanged.
Recovery: Existing no-write preview, admitted plan and atomic new-project rollback unchanged.
DESIGN_TOOL_ROUTER_DECLARATION: Pure parser and existing diagnostic text only; no product UI design contract change. Declaration03 carries the machine router value.
RUNTIME_SCOPE: Fresh synthetic/public-domain fixtures and owned APFS temporary tests only; all final materials/evidence in dated T777 theme-colors-fix folders. User app update is a subsequent separately bound action after source delivery.

## IMPLEMENTATION_STEPS

1. Declaration03 and original task E0 before runtime edits; preserve exact M6 and closed predecessor.
2. Add maintained causal theme/mapping/modifier/legacy and pending-diagnostic regressions.
3. Resolve validated theme references at effective color consumption, including note/break consumers. Keep unknown values explicit.
4. Compare actual pure compute/plan/Core model against independent Word RTF colors and complete editorial controls; state normalization differences honestly.
5. Update only mechanical source/test/task hashes, preserving membership, protected pins and prior tuples. Run required gates, ordinary PR/CI/merge and clean exact-head checks.

## CHECKS

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
CHECK_01_PRE_IDENTITY: Clean M6, current remote main, mandatory startup, verified mounts and declaration03 PASS.
CHECK_02_POST_E0: Original ops-gate validates this exact task before parser edits.
CHECK_03_POST_CAUSAL: New theme cases fail on original source and pass on candidate; missing theme, malformed input, remapping, override and legacy behavior checked.
CHECK_04_POST_DATA: Actual compute path retains complete text/comments/replies/revisions/notes; both clean and pending imports support themes; mathematical shade differences disclosed rather than mislabeled exact Word support.
CHECK_05_POST_AFFECTED: Complete existing color/theme-font/import/pending/note chains pass without skipped/todo cases.
CHECK_06_POST_GOVERNANCE: Exact source/protected pins, unchanged inventory membership and retained approvals; guardrails, OSS policy and audit.
CHECK_07_POST_DELIVERY: Required full CI, merge, clean merged SHA and repeated relevant tests; no native or installed-build credit from source proof.

## STOP_CONDITION

Unknown ownership, stale base/authority, unrelated WIP, bypass, text/anchor mutation, mandatory failed proof or scope drift stops this contour. After three identical failures retain exact inputs and change hypothesis; no silent retry or predicate relaxation.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1; one text block, KEY: VALUE, basenames only.

## FAIL_PROTOCOL

Retain failed logs and exact hashes; no invented green, native acceptance, rounding equivalence or historical proof promotion. Rollback is this single PR revert.

REFERENCES: brain refs returned generic UI notes, inapplicable to this mechanical parser fix. Algorithm derives from Microsoft MS-OI29500 2.1.72 and existing bounded parser contracts; no third-party code copied or dependency installed. Original 72-case Word RTF matrix is retained as independent observations, including differences from mathematical HSL normalization.

SAME_CONTOUR_CHECKPOINT: 038e35555 contains the parser plus18 passing color cases. Declaration13 freshly binds that clean checkpoint before a mechanical existing-modal message change and official bundle rebuild. Existing modal previously discarded specific refusal diagnostics; reconstruct only the fixed color explanation from exact diagnostic code and bounded paragraph index. No new surface or component state. ui-craft discovery confirms existing vanilla CSS/modal; no design choices, tokens or external research. Original M6 binding and this one rollback/delivery chain remain intact.

SOURCE_OBSERVATIONS: Four new maintained cases reproduce missing theme support and generic pending refusal on M6; final18 color cases cover real worker execution, literal precedence, mappings, modifiers, strict legacy behavior and accept/reject/reopen/undo/redo. Independent Fraction HSL agrees with all72 actual imported matrix outputs. Native Word RTF matches61 exactly; the remaining11 differ by one channel unit, disclosed as normalization rather than exact Word rounding. All original six editorial paragraphs, four comment/reply bodies, exact anchors, revision records and notes remain equal across11 supported pending variants. Both no-revision contrasts also prepare successfully. The first matrix intentionally removed its referenced note and correctly refused; the coherent matrix retains the controls. Overbroad local partition08 entered historical whole-book tests and was stopped with no PASS credit, respecting the owner's light-local-testing preference; complete maintained graph remains mandatory in remote CI. No test is skipped or disabled. All final focused color/theme-font/UI cases pass on Node22 and the shipped Electron Node engine, with unchanged source hashes and no fail/cancel/skip/todo. Packaging/installation and native project acceptance remain outside these source claims.
