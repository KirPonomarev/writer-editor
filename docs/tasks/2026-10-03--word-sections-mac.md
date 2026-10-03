# WORD_SECTIONS_MAC_20261003

STATUS: NATIVE_VERIFIED_REQUIRED_GATES_PENDING
DOCUMENT_CLASS: TASK_CONTRACT
TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BASE_SHA: 7a07647e6b8e90da334902f0db7f653ca23613ff

## MICRO_GOAL

Preserve Word section semantics through Mac content import, authoring, durable Save, ordinary and Review export, and authenticated text return.

## ARTIFACT

One typed root document registry, integrated into existing import, Save and export paths.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true.

## ALLOWLIST

- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`
- `src/core/word-sections-v1.cjs`
- `src/core/word-user-bookmarks-v1.cjs`
- `src/core/document-content-envelope-v1.cjs`
- `src/io/revisionBridge/index.mjs`
- `src/io/revisionBridge/reviewTransportPackageParserV2.mjs`
- `src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs`
- `src/main.js`
- `src/utils/docxImportLocalFilePreview.js`
- `src/export/docx/docxMinBuilder.js`
- `src/export/docx/docxReviewPacketBuilder.js`
- `src/export/docx/fullManuscriptDocxReviewPacketSource.js`
- `src/renderer/tiptap/documentSections.mjs`
- `src/renderer/tiptap/index.js`
- `src/renderer/editor.bundle.js`
- `test/contracts/rtk-word-sections.contract.test.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `test/contracts/rtk-word-table-editor.contract.test.js`
- `test/contracts/rtk-word-composite-fidelity.contract.test.js`
- `docs/tasks/2026-10-03--word-sections-mac.md`

## DENYLIST

No owner documents, dependencies, cloud, alternate writer, new layout controls or section-to-scene conversion. No raw XML retention as project truth. No whole-plan completion claim.

## CONTRACT / SHAPES

O: Ordered paragraph-carried and body-final section properties survive import, text authoring, Undo/Redo, Save/reopen, export and text return.
T: Literal validated source -> Core root registry -> existing safe-create and atomic Save -> existing export projection; authenticated section projection gates returned text mutation.
H: Current parser drops unsupported type values and canonical construction ignores section metadata. Root registry with paragraph-end identity avoids duplicated paragraph attrs on split. Final section type must be emitted because it describes that section's start.
B: Preserve canonical scene identity, folder-derived manuscript grouping, current Google recovery path, sibling state, existing atomicity and no silent loss. Invalid or ambiguous boundary mutation refuses before writing.
P: Independent literal DOCX reproducer; focused import/schema/save/editor/export/return tests; actual SOURCE and PACKAGED changed cycles before stable full checks.
I: Exact base above, isolated task branch; synthetic fixture independent-six-sections.docx. No reinterpretation of historical evidence as current.

### FEATURE_INTEGRATION_MANIFEST_V1

featureId: word-sections.v1; featureVersion: 1; integration: EXISTING_SEAM.
domainOwner: Product Core; authoritativeData: canonical typed root section registry with paragraph-end boundaries and explicit final section; derivedData: validated import inventory and export protected-section projection.
commandIds: existing import safe-create, canonical Save, DOCX exports and explicit Review Apply; eventTypes: existing save/apply publications; queryIds: existing immutable document and review queries.
productProjectionIds: existing document snapshot and authenticated return projection; capabilityIds: existing import/save/export/review capability bindings.
authorityMap: Core owns semantics, Kernel revalidates dispatch, Main owns file effects; identityKeys: project, scene, revision, generation, export and artifact identity.
revisionPolicy: existing CAS and stale lifecycle guards; writePath: validated import or canonical Save/Apply -> atomic scene/manifest gateway; readPath: saved canonical scene -> export projection.
requiredProductPorts: existing bounded local file, Save, recovery and DOCX ports; requiredDesignOsPorts: existing document/review projection; adapterRequirements: pinned Mac runtime, no new dependency.
surfaceManifests: existing surfaces only; no new surface; slotRequirements: existing editor root schema only; supportedWorkspaces: WRITE and REVIEW; platformAvailability: macOS qualification only.
accessibilityRequirements: preserve existing editor interaction; no invisible UI action grants mutation authority.
fallbacks: reject invalid types, duplicate/foreign declarations, unsupported carrier topology and ambiguous mapping; unsupported geometry/stories explicitly remain outside exact layout claim.
stateClasses: PROJECT_STATE, AUTHORING_WORKING_STATE, DERIVED_STATE; persistenceClass: existing scene envelope with required feature; migrations: absent/null compatible, old readers refuse new required feature.
recovery: existing atomic writer and readable snapshots; rollback: PR revert with original DOCX and feature-protected scene retained.
performanceBudget: bounded parser and Core save traversal; no parse/diff in typing hot path; securityBoundary: input validation precedes canonicalization, no raw XML authority.
lifecycle: existing project/scene lifecycle; negativeBypassChecks: stale, replay, dirty, forged registry, changed return section, unsupported topology and zero-write refusal.
evidenceBindings: exact candidate and merged SHA, synthetic artifact hashes and physical Mac cycles; currentReality: all section types lost by generic import, final type omitted by review serializer.
Design router: unchanged product design; exact enum recorded in validated external architecture declaration.

## IMPLEMENTATION_STEPS

1. Strict typed section model and import inventory, preserving explicit final properties.
2. Core save mapping and inert editor schema with history/no-loss behavior.
3. Both exporters and protected authenticated return projection.
4. Native changed cycles, stable mandatory tests and complete delivery.

## CHECKS

CHECK_01_PRE_ADMISSION: clean exact base, active canon, encrypted writable mount, bootstrap and architecture preflight. Performed before any edit.
CHECK_02_POST_FOCUSED: five kinds plus default; final nondefault type; namespace/duplicate/malformed negatives; split/join/history/save; both export paths; unchanged protected return and changed-section refusal.
CHECK_03_POST_NATIVE: actual SOURCE/PACKAGED import, edit, Save, export, Word edit, Apply, restart and re-export; independent ZIP/XML readback.
CHECK_04_POST_DELIVERY: required full RTK, baseline, governance companions, guardrails, OSS, audit, CI, merge and exact merged verification.

## STOP_CONDITION

Ambiguous identity, unrelated WIP, missing required proof or third repeated failure signature. No claim beyond observed evidence.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1 and CODEX_OUTPUT_POLICY.

## FAIL_PROTOCOL

Record expected/actual, exact head, seed and hashes; fix one grounded hypothesis without disabling oracle or shrinking the original Mac plan.

## OBSERVED_CANDIDATE_01

Candidate 4a93cd75685343eb3c4ac262beb273b8ea51c2d6: SOURCE import, text edit, Undo/Redo, Save, Review export, actual Word text edit, explicit Apply, Save, process restart and re-export observed. Apply reported 1 applied, 0 blocked, 0 failed. Independent ZIP/XML oracle confirmed six types including final continuous, two columns, page geometry and returned text. SOURCE input actually selected was an independently exported and Word-saved fixture; original fixture selection was not claimed. PACKAGED original-fixture import observed only, then owned processes stopped. These observations do not accept a successor candidate.

Pre-delivery independent review found canonical numbered-paragraph carrier rejection and default-type single-final geometry loss. Both require repair before delivery. Multiple text-edit regions combined with topology changes remain conservative refusal and are an open authoring limitation. Unsupported section properties refuse explicitly; no full layout compatibility claim. Unchanged dependency audit reports 5 moderate and 11 high advisories, 0 critical; OSS policy passed.

## OBSERVED_CANDIDATE_02

Candidate b2eb0473d2e0ead9f1e6a9347f624d2fc0e6d649 corrected list/blockquote carrier admission and custom final-only geometry. Focused current-candidate checks: 227 passed, 0 skipped, 0 todo.

SOURCE and PACKAGED each completed native import from independent-six-sections.docx, editor text change, Undo/Redo, Save, Review export, actual Word text change and Save, explicit Apply (1 applied, 0 blocked, 0 failed), Save, owned process restart and Review re-export. PACKAGED also completed ordinary current-scene DOCX export after restart. Independent Python ZIP/XML observations verified each ordered section type, final continuous, two-column properties, supported page geometry and exact changed paragraph texts across output artifacts. Runtime copy evidence binds both profiles to the exact candidate. All owned native processes stopped after observation.

No whole-plan completion claim. Renderer pagination fidelity, unsupported section properties, section-boundary edits from Word and arbitrary mixed multi-region text/structural authoring remain outside this qualified slice. Required full RTK, baseline, CI and merged-head verification still pending at this evidence commit.
