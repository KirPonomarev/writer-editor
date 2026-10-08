TASK_ID: WORD_PARSER_QUERY_PERFORMANCE_MAC_20261008
MILESTONE: macOS large novel; measured DOCX parser query performance
TYPE: CORE
STATUS: IMPLEMENTED_DELIVERY_PENDING
ROLE: BOUNDED_EXECUTION_TASK
CLAIM_BOUNDARY: exact parser semantics with measured query acceleration; full novel release OPEN
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BINDING_BASE_SHA: 9d4c8247026c8c98f8255d38f4101ee1f627789b
BRANCH: codex/word-parser-query-performance-mac-20261008
COMMIT_REQUIRED: true
PUSH_REQUIRED: true
PR_REQUIRED: true
MERGE_REQUIRED: true
DESIGN_TOOL_ROUTER: bound to validated pre-edit declaration; private parser queries, existing UI unchanged

## MICRO_GOAL

Remove measured repeated whole-document token scans from three private parser
queries while preserving every current parser and publication-gate result.
The complete novel has 500108 words, 8391 paragraphs and 21 scenes, with three
rich notes and 200 discussions containing 400 messages. No validation is removed.

## ARTIFACT

One private parser performance delta with append-only contracts in one existing
maintained test. A separate code writer owns those two paths; root owns task,
docs, seven mechanical OPS companions, independent proof and Git delivery.
One outcome, one rollback, one complete delivery chain.

PR2096 is fully closed at the binding base: official19of19, both mandatory
RTK blocks4020of4020, post-audit359of359, exact-merged affected contracts195of195.
Closure SHA7824e78f8b0ef48df284e6bb26f22992a4408e5e2c0f5ec39b6648d96e81d84c.
The actual complete Main wrapper took285694.6915ms on a contended owner host.
Parser inclusive sampled attribution was93.19percent; this is diagnostic elapsed
attribution, not isolated shipping performance. Diagnosis
SHAe4192577cad5665920214a1c3a63f6fc08d7f758d6733544491538d7299c5498.
Independent complete retained DOCX XML matched all paragraphs/body formatting,
rich notes and discussion bodies/authors/dates/anchors/reply graph, comparison
SHA2c26af0653d8c4311945d6a8521fe271f1d39c56aa4ea8222fe1f95b79d0a05a.
That is component evidence; genuine Word return and full native release remain OPEN.

## ALLOWLIST

- src/io/revisionBridge/reviewTransportPackageParserV2.mjs
- test/contracts/rtk-parser01-namespace-atoms.contract.test.js
- docs/tasks/2026-10-08--word-parser-query-performance-mac.md
- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/WORKLOG.md
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/post-audit-certification-set.mjs

## DENYLIST

Every other runtime path, main/index/Core/export/renderer/preload, all136 compiler
inputs, both generated bundles, package/dependency files, workflow and mandatory
TAP parser. No API, budget/default/security change, parse removal, accepted-output
cache, global project index, new writer or native effect. No foreign process,
owner checkout, private data, old crash profile or failed heavy-route replay.

## CONTRACT / SHAPES

productPlane: existing Product Core truth and pure ReviewParserPort semantics
interfacePlane: existing UI and immutable parser consumers unchanged
canonicalCommands: existing Word export/import command IDs unchanged
canonicalQueries: existing complete parser analysis; private lookup acceleration only
canonicalEvents: existing events unchanged; no new event or background process
canonicalEffects: existing validated DOCX publication/persistence effects unchanged
coreOwnership: canonical project, scene, note, comment and manuscript truth remains Core
commandKernelOwnership: current availability/capability and publication revalidation unchanged
designOsOwnership: form only; no design contract change or new visual zone
featureOwnership: existing Word semantic roundtrip; no new feature registry
planeOwnership: Core truth; Kernel mutation; Design OS existing form only
identityKeys: exact scan/token/logical paragraph cohorts; existing project/revision/generation guards
revisionPolicy: all existing product pre/post-await and publication guards unchanged
writePath: existing Kernel -> Main -> parser -> publication/intake -> atomic persistence
readPath: one validated scan -> private ephemeral index -> exact legacy query results
requiredProductPorts: existing ReviewParserPort and DocxPackagePort
requiredDesignOsPorts: EXISTING_BACKEND_SEAM_NO_DESIGN_PORT
adapterRequirements: existing bounded ZIP/XML/crypto adapters unchanged
surfaceManifests: NO_NEW_VISUAL_ZONE_EXISTING_SURFACE
slotRequirements: NO_NEW_UI_EXISTING_SLOTS
supportedWorkspaces: existing WRITE and REVIEW; no new capability
platformAvailability: existing macOS SOURCE and ordinary packaged path
accessibilityRequirements: EXISTING_UI_ACCESSIBILITY_UNCHANGED
stateClasses: PROJECT_STATE, AUTHORING_WORKING_STATE, DERIVED_STATE
persistenceClass: existing atomic persistence; no new durable state or schema
fallbacks: exact legacy order for overlapping/nested/nonmonotonic paragraph cohorts
migrations: NO_MIGRATION_EXISTING_SCHEMA_UNCHANGED
recovery: existing fail-closed diagnostics, no silent success or authority from cache
rollback: one coherent PR revert to reachable9d4; preserve every old test byte
performanceBudget: owned component lane900s and40000000000B; Node32GiB if necessary
securityBoundary: exact namespace checks, containment, budgets, reasons and semantic digests
lifecycle: synchronous per-scan derived index only; no stale publication or lifecycle writer
negativeBypassChecks: malformed/foreign XML, strict budgets, nested tokens, table order and inclusive endpoints
evidenceBindings: pinned baseline profile, complete old/new output oracle, mandatory TAP and merged SHA
currentReality: private per-scan range and paragraph queries implemented; complete old/new source parity observed
targetOnly: full-novel timing and native Word acceptance pending separate admission and delivery

O: same complete DOCX analysis and gate results with fewer repeated token visits.
T: existing validated scan -> private query index -> unchanged result/authority path.
H: repeated linear searches dominate this novel; bounded lookup should remove that work.
B: preserve descendant membership, scanner postorder, sorting, inclusive ends and every output.
P: deterministic legacy scaling RED, full parity/negative controls, complete affected TAP and required gates.
I: exact9d4 base/branch, verified encrypted T7, pinned two code files and all protected compiler bytes.

## IMPLEMENTATION_STEPS

1. Fresh bootstrap/applicable startup reads, root HARD task/E0 and pre-edit declaration.
2. Freeze both writer paths and protected inputs; append meaningful failing scaling control.
3. Implement only the private lookup correction, within180 runtime added+deleted lines.
4. Preserve complete old test prefix; at most240 appended lines and four top-level cases.
5. Prove complete old/new semantic parity and operation scaling; hold for independent root review.
6. Root updates exact bindings/docs, executes required gates and completes delivery.
7. Fresh large component timing/profile or native workload requires separate pinned admission.

## CHECKS

CHECK_1_PRE_AUTHORITY: fresh bootstrap, active canon, exact base/branch and pre-edit declaration.
CHECK_2_PRE_BYTES: freeze two writer paths, old test prefix, all136 compiler inputs and generated bundles.
CHECK_3_POST_SEMANTICS: full old/new outputs, deterministic operation scaling and complete affected TAP.
CHECK_4_POST_SCOPE: exact13-path diff, protected byte equality, literal and policy DATA bindings.
CHECK_5_POST_DELIVERY: required gates, official CI, normal merge, clean exact-merged repeat.

Before runtime edit retain deterministic legacy scaling failure and complete expected
semantic values. Cover Unicode, empty bodies, default/alternate/foreign namespaces,
malformed XML, nested descendants, self-closing and scanner postorder, inclusive
touching endpoints, NaN/Infinity, logical table ordering and strict budgets.
Do not turn an existing rejection into acceptance or alter a reason/digest.

Run complete affected parser/formatting/notes/comments/table/publication/full-volume
files with the unchanged mandatory TAP parser; no name filters, skips or todo.
Old/new comparison must cover full output objects and ordered arrays, not counts.
Preserve all136 compiler inputs and both generated artifacts; no redundant build.
Root taskE0, strict DATA626 admissions/484 source identities, frozenE0 behaviors
and mutants, OSS policy, npm audit, guardrails, official CI, normal merge and
exact-merged relevant repeat are mandatory. Preserve all235 historical certificate
tuples byte-exact and append one nonrecursive successor; no predicate change.

Actual implementation proof at the binding base plus the admitted delta:
runtime73of180 added+deleted; tests177of240 appended lines/four top-level cases;
original27128B test prefix byte-exact. Complete unfiltered14-file union338of338,
zero fail/cancel/skip/todo,66.4855s, childRUmax2478981120B, sampled aggregate
2152710144B under owned900s/40GB and explicit32GiB Node development heap.
Unchanged mandatory TAP parsed the entire log; root repeat-reader
SHA03276f0a3b5e9c513eb49ce108dcd08e306f44c9391c6d6c2bfbfec4f08f7389.
Full exact old parser module comparisons cover14 public output pairs, six
complete factory/DOCX/analysis pairs and twelve publication-gate pairs, including
malformed-final refusals. Independent full operand review
SHA20c317373429bc373e5e6c9d2b040a26d011d045d70d434e24752e9477a2a3bf.
Observed private query field reads32/64/128 paragraphs:12567/26071/54039 versus
138382/540942/2138638 old. Same scaling bounds retained. These are operation
observations, not total validation counts, wall-time speedup or native acceptance.
Writer HOLD SHAed826edaa1782c047755a54d07e7dd0647c54483c983bfa4452f931c4c697a91;
root source/physical review SHA5b6061cfd6870c4ca6022a1b80277708cab0b0261039fefad2bdafdd849e40d9.
All578 other package sources,136 compiler inputs, both generated artifacts and
3434 shared tracked source/script/test/package entries rehashed exact; no rebuild.
Five original writer failure records and the root TAP reader field error remain
retained with their actual classifications; no failed process is relabeled green.
Commit/push/PR/official CI/merge/exact merged repeat remain pending at this write.

## STOP_CONDITION

Stop on ambiguous authority/identity, unexpected source/bundle delta, widened scope,
changed parser semantics or security predicate, failing mandatory proof, stale
publication, base drift, or a repeated failure signature reaching the repo limit.
The current full native novel release remains OPEN regardless of this component result.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1 and repository CODEX_OUTPUT_POLICY: one text block, key/value
lines, exact task/base/commit/merged SHA, basenames, numerator/denominator, actual
delivery and limitations, one next action. No unsupported release or timing claim.

## FAIL_PROTOCOL

Preserve actual failing inputs, seed, exact SHA, whole output/logs/hashes and one
next hypothesis. No swallowed failure, substitute oracle, test deletion, bypass,
reset/stash/clean/rebase/force or repetition of an old machine-crash route.
