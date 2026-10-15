# Preserve Word note reference fonts and proofing languages

TASK_ID: WORD_NOTE_REFERENCE_TYPOGRAPHY_MAC_20261015
PARENT_TASK_ID: YALKEN_MAC_WORD_FINISH_V4_1_20261013
STATUS: IMPLEMENTATION_AND_PROOF_PENDING
DOCUMENT_CLASS: PROCESS
CLAIM_BOUNDARY: seven properties of main-body note reference controls only; no native acceptance
TYPE: CORE
MODE: HARD_TZ
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
BINDING_BASE_SHA: 7b7429d7f0142eb42447f0ab023af4c31c62b4cc
OWNER_AUTHORITY: verified direct autonomous finish and owner-authorized implementation delegation; sole code writer in registered existing worktree; coordinator retains native execution
DESIGN_TOOL_ROUTER: OUT_OF_SCOPE_CORE_ONLY (architecture declaration uses typed non-UI routing)
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_HEAD_VERIFICATION_REQUIRED=true

## MICRO_GOAL

O: Import and reexport both native note kinds without losing any of four
effective font slots or three proofing-language slots on their body references.
T: Bounded namespace-aware DOCX parser -> admitted SafeCreate -> canonical
manuscript note -> atomic Core notes persistence -> immutable export binding ->
DOCX serializer. Existing authenticated return commands retain the same guards.
H: The parser omits typography of zero-width reference runs; canonical payload
and serializer consequently cannot retain it. Preserve validated effective
font/language values using the existing strict style cascade and an explicit
versioned manuscript payload, then reject protected return drift before writes.
B: Preserve original profiles, anchors, authority, foreign/private/deleted notes,
all scene text, IDs, points, hashes, existing budgets, atomic recovery and CI.
P: Tiny causal RED, independent ZIP/XML GREEN, schema/legacy/cascade/malformed/
stale/bypass controls, actual durable import/readback and existing affected tests;
full official CI and normal delivery with fresh exact merged checks.
I: Exact base above. No native app, profile writer or native admission here.

## ARTIFACT

One bounded vertical slice; runtime changed-line budget 300, maintained tests
350. New pure value grammar only when needed, no generic framework or writer.
All new materials and evidence use dated word-note-reference-typography-mac
folders on verified T777. Disposable filesystem-dependent CLI fixtures use the
declared APFS f7-note-reference-typography runtime on verified encrypted T7.
Original frozen Word input is read-only; no large novel fixture copies.

## ALLOWLIST

- src/core/word-note-reference-typography-v1.cjs
- src/main.js
- src/core/word-manuscript-notes-v1.cjs
- src/core/word-note-return-delta-v1.cjs
- src/io/revisionBridge/reviewTransportPackageParserV2.mjs
- src/io/revisionBridge/index.mjs
- src/export/docx/docxReviewPacketNotes.js
- src/export/docx/docxMinBuilder.js
- test/contracts/rtk-word-note-reference-typography.contract.test.js
- test/contracts/rtk-word-manuscript-notes.contract.test.js
- test/contracts/rtk-word-manuscript-notes-import.contract.test.js
- test/contracts/rtk-word-note-return.contract.test.js
- test/contracts/rtk-word-pending-notes.contract.test.js
- test/contracts/rtk-word-core-hash-parity.contract.test.js
- test/unit/r24-wp204-lifecycle-recovery-mutants.test.js
- docs/tasks/2026-10-15--word-note-reference-typography-mac.md
- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/WORKLOG.md
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/post-audit-certification-set.mjs

## DENYLIST

All other paths; renderer, unrelated Main routes, preload, UI design, dependencies, native apps,
profiles, anchors, historical receipts, global quotas, heap/deadline changes,
new writers, fixed-font substitution, DOCX postpatching, bypass and weakened
oracles. Note-body Ref controls and other typography have no actual RED here.
No reset, stash, clean, silent rebase or force push.

## CONTRACT / SHAPES

FEATURE_INTEGRATION_MANIFEST_V1:
featureId=WORD_NOTE_REFERENCE_TYPOGRAPHY; featureVersion=1;
domainOwner=Product Core; authoritativeData=versioned manuscript reference
typography; derivedData=validated package facts and immutable export binding;
commandIds=existing import SafeCreate and Word review return commands;
eventTypes=existing notes publication; queryIds=existing notes/export reads;
productProjectionIds=existing note projections; capabilityIds=existing import,
review and export capability; authorityMap=Core truth, Kernel mutation,
adapter I/O; identityKeys=project, note, scene, revision, round, artifact;
revisionPolicy=existing lease, source-byte CAS and fresh readback;
writePath=existing admitted import/return Core transaction;
readPath=canonical notes to export projection;
requiredProductPorts=existing project persistence and DOCX adapters;
requiredDesignOsPorts=unchanged read-only projections;
adapterRequirements=existing bounded ZIP/XML and DOCX serializer;
surfaceManifests=OUT_OF_SCOPE no surface;
slotRequirements=OUT_OF_SCOPE no UI change;
supportedWorkspaces=existing WRITE and REVIEW;
platformAvailability=existing desktop export/import;
accessibilityRequirements=unchanged keyboard and locale behavior;
fallbacks=legacy schema1 remains readable without invented values;
stateClasses=PROJECT_STATE and DERIVED_STATE, authoring no-loss unchanged;
persistenceClass=existing atomic notes cohort;
migrations=schema1 unchanged, schema2 explicitly binds referenceTypography;
recovery=existing complete transaction replay and rollback;
rollback=ordinary single PR revert with schema2 downgrade refusal;
performanceBudget=existing <=256 notes and bounded fixed-size property values;
securityBoundary=no new path, identity or command authority from XML;
lifecycle=existing import and authenticated review;
negativeBypassChecks=forged plans, invalid values, stale source and changed
protected reference typography refuse before mutation;
evidenceBindings=maintained tiny contracts and independent ZIP/XML comparison;
currentReality=old imports lose seven effective reference values, note-body
controls and all other full physical meaning already match.

Integration mode: EXISTING_SEAM. Manuscript schema1 stays byte-compatible.
Schema2 requires one validated referenceTypography v1 object containing only
nonempty fontSlots (ascii, hAnsi, eastAsia, cs) and/or wordLanguage (val,
eastAsia, bidi). Effective style resolution preserves independent slot
inheritance; source expectations never enter the parser. No provider IDs or
raw XML are persisted. Unchanged schema1 returns retain their legacy policy;
schema2 reference values are protected by authenticated baseline and current
canonical state. Lost values in an already imported schema1 note cannot be
reconstructed by this code change without a separately admitted source-bound
operation. Complete native and role/exchange acceptance remains open.

## IMPLEMENTATION_STEPS

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
CHECK_01_PRE_IDENTITY: registry, mounts, clean merged base, bootstrap, current
canon, scope declaration and preflight; task OPS gate before runtime edits.
CHECK_02_POST_RED: actual tiny two-kind importer drops distinct reference facts.
CHECK_03_POST_FIX: strict versioned values through importer, Core and exporter.
CHECK_04_POST_PROOF: independent full property comparison, malformed and
protected-return negatives, durable import/reopen and affected-chain tests.
CHECK_05_POST_DELIVERY: exact-byte companions, guardrails, commit/push/PR,
required CI, normal merge and fresh relevant tests on exact merged SHA.

## CHECKS

CHECK_01_PRE_IDENTITY: actual bootstrap and clean exact-base preflight completed.
CHECK_02_POST_PROOF: maintained RED/GREEN, independent XML and full affected gates.

Run the maintained note-reference tests on Node22 and shipped Electron Node24
with explicit TAP and the unchanged mandatory evaluator. Run complete affected
notes import/model/return/pending/transaction tests; retain failures honestly.
Full official RTK and certification are required without skipped or weakened
tests. Independently parse tiny output ZIP/XML without product parser imports.

### REFERENCES

The verified tiny owner-handoff reproducer and independent RED observations on
T777, current strict style-cascade implementation and physical residual03 are
the task references. brain:refs suggestions inspected; no external design or
optional service is relevant to this Core correction.

### ROLLBACK

One normal PR revert; preserve all data and complete original evidence. Never
silently strip new metadata for an older reader or rewrite existing profiles.

## STOP_CONDITION

Stop on authority/base ambiguity, foreign WIP, scope drift, invalid required gate, third identical failure or broken delivery. Preserve original failures and data.

## REPORT_FORMAT

One text KEY: VALUE block, exact SHAs, scope, executed denominators, delivery, limitations, one next action; basenames only.

## FAIL_PROTOCOL

Retain actual RED and all failures; fix within this bounded contour. No oracle weakening or native retry. Ordinary PR revert preserves data; an older reader must reject new schema2.

### Same-contour clean scope expansion

Initial import is preserved; strict reimport exposed the minimal exporter referencing undefined note styles. Existing notePackageParts already computes their definitions. Expanded clean preflight on the same exact base admits only emitting those definitions and their existing styles relationship and content type. Original eight-file WIP is frozen on T777 and in the original registered checkout; sole code writer now uses the registered word-note-reference-typography-mac-20261015 worktree. No original runtime or profile changed.

### Literal style compatibility reference

Microsoft OpenXML RunStyle remarks reproduce ISO29500: an absent referenced character style applies no character style. The note-control reader follows this explicit rule without weakening the shared strict resolver: missing styles are inert; malformed references, defined wrong-type styles and broken basedOn chains still refuse. Source: https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.runstyle?view=openxml-3.0.1 .

### Ordinary authoring retention in the same contour

Checkpoint2ed196 executed202of202 affected tests. Fresh clean authoring
preflight adds only Main's existing manuscript binding and its maintained
command test. Actual single-case RED06 shows that rebuilding a body-only
request as schema1 drops new metadata. Main now copies reference typography
only from the fresh canonical current note under its existing lease/hash;
renderer requests still cannot supply it. Kind conversion and reanchor retain
the values, and stale/lifecycle/before-write checks remain unchanged.

### Engine-independent full input conservation oracle

Shipped09 preserved201of202 cases but failed V8-byte equality. Diagnostic11
retains69912and70024byte serializations: decoded complete typed values and
exact JSON are equal; the same transportIdentity has one-byte versus UTF16
encoding. No input or binary artifact changed. The maintained oracle now checks
all typed values, exact JSON and complete alias graph, including every Buffer
view byte; four negative mutations prove detection of text, binary, sharing and
absent-field corruption. No domain assertion, input coverage or required case
was removed. Source: https://nodejs.org/download/release/latest-jod/docs/api/v8.html#serialization-api . Final shipped9files execute203of203 with mandatory
TAP0 and no skips/todo; original failed logs remain.

### Final source qualification

Final whole9-file Node22 and shipped Electron41.10.6 execute204of204 each; unchanged mandatory TAP evaluator0, zero fail/cancel/skip/todo and all source byte barriers true. The ninth new reference test covers real tracked DOCX emission, Original3 versus Current4 coordinates and protected body-edit return refusal. Independent XML observes both full seven-property sets and unchanged note body/point, rejects16 controls, and retains only9686bytes of new DOCX outputs. Existing raw RED and failed diagnostics remain unchanged.

### Final Core bypass and catalog closure

Fresh exact242d preflight and maintained RED22 prove a body-only Core cohort could change or downgrade an existing note reference payload. Core now compares validated prior/current reference typography for every existing manuscript note, while legitimate body edits and new-note import stay admitted. Complete204case chains pass on both engines again. Checkpointb869bb retains that fix before a clean26-path preflight. The first PR candidate CI38791665020 refused before RTK tests because the new test basename was absent from the strict catalog; add exactly that basename, preserve every previous member and all runner predicates, and execute the cheap plan and catalog contract before the next push. No old failed CI is counted as test acceptance.

### Complete isolated mutation-test module graph

Candidate7e58 broad inventory executed2230 cases, with one failure: the WP204
unmodified-control sandbox copied the manuscript note model but omitted its
new reference validator and the validator's existing word-language module.
Actual local RED35 reproduces MODULE_NOT_FOUND before mutant execution.
Fresh clean27-path preflight admits only those two dependency-list entries;
all seven named mutants, real unmodified control and kill predicates remain
unchanged. No fallback, runner change or reduced coverage is permitted.

GREEN36 and SHIPPED37 execute the existing unmodified control and all seven
mutants (1of1 maintained case on each engine, no skipped/todo), with unchanged
kill predicates. Read-only copying-source review finds no second selective
notes-module graph. Full normal CI remains mandatory for the final candidate.
