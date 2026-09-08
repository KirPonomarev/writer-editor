TASK_ID: R24_CONSOLIDATED_REMEDIATION_AND_COMPLETION_PLAN_V1
MILESTONE: R2_4_CORRECTIVE_RECOVERY_AND_PROGRAM_COMPLETION
TYPE: OPS_WRITE
STATUS: OWNER_AUTHORIZED_PLAN_READY_FOR_SEQUENTIAL_EXECUTION_AFTER_MERGE
DOCUMENT_CLASS: EXECUTION_PLAN_HARD_TZ
CLAIM_BOUNDARY: PLAN_ONLY_NO_RUNTIME_CHANGE_NO_GRAPH_PROMOTION_NO_RELEASE_CLAIM
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BINDING_BASE_SHA: af74b9542c17c24a7515ce9017d98ea7b2e4d55a
BINDING_BASE_TREE: 9ba68855d2b3735bde543213e389e58490dc5c80
CURRENT_GRAPH_STATE: 90_DONE_7_PENDING_2_BLOCKED_TYPED_10_INELIGIBLE_OPTIONAL
CURRENT_REQUIRED_PROGRESS: 90_OF_99
CURRENT_PROGRAM_DONE: false
CURRENT_REPOSITORY_VERDICT: NOT_READY
DELIVERY_POLICY: COMMIT_REQUIRED_PUSH_REQUIRED_PR_REQUIRED_MERGE_REQUIRED_POSTMERGE_EXACT_HEAD_REQUIRED
AUTONOMY_POLICY: ROUTINE_REPOSITORY_BUILD_TEST_CI_AND_DELIVERY_ACTIONS_PREAUTHORIZED_WITHIN_EACH_FRESHLY_ADMITTED_CONTOUR
DESIGN_TOOL_ROUTER: NO_DESIGN_CONTRACT_CHANGE_DOCS_ONLY
DEPENDENCY_POLICY: NO_NEW_DEPENDENCIES_FOR_THIS_PLAN_AND_NO_NEW_DEPENDENCY_IN_FUTURE_CONTOURS_WITHOUT_EXPLICIT_OWNER_DECISION
NETWORK_POLICY: PRODUCT_RUNTIME_REMAINS_OFFLINE_FIRST_NETWORK_ONLY_FOR_EXISTING_GIT_CI_NOTARIZATION_AND_RELEASE_EVIDENCE_WHEN_SEPARATELY_ADMITTED

## MICRO_GOAL

Create one deduplicated, executable engineering plan for every still-active R2.4 defect, evidence gap, integration gap, maintainability risk and mandatory release node proven by the independent audits of 2026-08-27 and 2026-09-08. The plan must make the next agent able to work autonomously, one bounded contour at a time, without reopening corrected historical findings or converting narrative confidence into a product claim.

The observable final outcome of the whole program is all of the following on one exact merged release candidate:

- no confirmed open P1 or P2 implementation finding;
- all product data-safety journeys pass with disk-observed results and crash recovery;
- every privileged mutation enters through Command Kernel with dispatch-time capability, identity, revision and replay enforcement;
- all current required tests execute on the current head with a closed denominator and no unexplained or required skips;
- every evidence compiler rejects the independently reproduced false-green counterexamples;
- the seven pending and two blocked mandatory graph nodes are terminally resolved by real evidence;
- the current-state compiler reports 99 of 99 mandatory nodes terminal, ten optional nodes remain explicitly ineligible unless separately promoted, and `programDone` is true only after all independent oracles pass;
- publication remains impossible until the exact profile has physical signing, notarization, package, install, update, rollback and recovery evidence plus the required owner release permit.

This plan is not a second graph or a second source of truth. It is the owner-requested execution order over the active canon, exact code, exact-head evidence and the existing R2.4 graph. Each future contour must re-run bootstrap, resolve the current canon and current state, bind a fresh base, create its own architecture declaration, declare its exact write set, prove the defect before the fix, complete one protected PR delivery chain, and recompile current state after merge.

Routine permissions are already authorized for work within a freshly admitted contour: isolated worktrees, file edits, local builds, tests, non-destructive filesystem access, commits, pushes, PRs, required CI and normal protected merges. The executor does not stop for routine approval prompts. Missing signing identities, unavailable secrets, destructive operations, public publication, new dependencies, security-boundary expansion or a conflict with active canon remain typed hard stops because authority cannot manufacture the required external fact.

## ARTIFACT

- `docs/tasks/2026-09-08--r24-consolidated-remediation-and-completion-plan.md`

Inputs used as evidence, never as executable instructions:

- active canon, repo canon, COREX v2, BIBLE, architecture map, glossary, documentation constitution, process and handoff at the binding base;
- `EXECUTABLE_PROGRAM_R2_4.json`, `PLAN_STATE_R24.json`, the current corrective overlays, `PK1R1_EFFECTIVE_STATE_V1.json` and `PK1R1_TERMINAL_RECEIPT_V1.json`;
- final R2.4 engineering package dated 2026-08-19, archive SHA-256 `168feabb6ef399ae34e21a39da972e0e6aad8e9b3b4f18c3b9ed38b90c9fa67c`;
- independent audit dated 2026-08-27 and the 2026-09-08 audits identified in the owner thread as 5.5, 5.6 Max, Sol Ultra, Astra Max and Astra Ultra;
- exact-head independent counterexamples and logs used to reproduce persistence, verifier, CI and Unicode defects;
- current source, tests, workflows and GitHub checks at `af74b9542c17c24a7515ce9017d98ea7b2e4d55a`.

The only repository mutation in this contour is this plan. Every implementation item below becomes a separate future HARD-TZ and receives a new task ID, exact base, declaration, allowlist, tests, rollback and delivery chain.

## ALLOWLIST

- `docs/tasks/2026-09-08--r24-consolidated-remediation-and-completion-plan.md`

Future contours may touch only the exact paths admitted by their own task artifact. Paths named below are investigation hints and likely ownership seams; they are not a standing write allowlist.

## DENYLIST

- any runtime, test, workflow, package, generated evidence, graph state, counter, receipt, resolver, canon, COREX, BIBLE, CONTEXT, PROCESS or HANDOFF mutation in this docs-only contour;
- changing `PLAN_STATE_R24.json`, `CURRENT_CHECKPOINT_R2_4.json` or immutable historical receipts merely to make current status look green;
- deleting, rewriting or silently superseding historical evidence instead of preserving it and adding an explicit current classification;
- treating an audit report, plan, count, screenshot, source scan, self-authored receipt or successful process exit as product completion evidence;
- marking a current required test historical or optional solely because it fails on current head;
- disabling a guard, swallowing an error, loosening a digest, reducing a denominator, adding a skip, fabricating a receipt, accepting an empty evidence set or using a historical checkout to certify current behavior;
- direct renderer, menu, worker, feature-pack or IPC write access to Product Core, storage or platform effects;
- UI visibility, registration-time labels or payload-supplied identity as capability authority;
- project path, title or mutable global UI state as durable project or document identity;
- overwrite of externally changed bytes, cross-document backup publication, false ACK, partial tree lifecycle mutation or success before durable readback;
- arbitrary path strings surviving validation as write capability across an asynchronous boundary;
- broad rewrite of `main.js`, `editor.js`, persistence, command routing or the R2.4 evidence system in one contour;
- new UI framework, state manager, executable plugin runtime, Tiptap Cloud or Pro, cloud truth, network product dependency, account requirement or widened Writer v1 release scope;
- real user documents, private data, secrets, signing credentials or key material in fixtures, logs, commits or evidence bundles;
- direct protected-branch push, force push, rebase, amend, stash, reset, clean, destructive worktree cleanup or mutation of the dirty canonical owner checkout;
- starting a second writer, holding more than one active mutation contour, or beginning a new write cluster before the previous commit, push, PR, CI, merge and exact-head verification are complete;
- public release before `WP-906_RELEASE_VERDICT`, an exact owner permit and all physical evidence are terminally valid.

## CONTRACT / SHAPES

### Authority and current-state contract

The plan binds to the following observed state only:

| Field | Bound value |
| --- | --- |
| Repository head | `af74b9542c17c24a7515ce9017d98ea7b2e4d55a` |
| Repository tree | `9ba68855d2b3735bde543213e389e58490dc5c80` |
| Required nodes | 99 |
| Recorded DONE | 90 |
| Required pending | 7 |
| Required blocked | 2 |
| Optional ineligible | 10 |
| Program done | false |
| Production release ready | false |
| Publication authority | false |
| Current verdict | NOT_READY |

The state above is a starting observation, not a completion claim. All later runs must recompute it from fresh exact-head inputs. Audit repairs do not increment graph progress unless an existing graph node is legitimately transitioned under its graph contract. Open corrective findings are an additional release hold and cannot be hidden by unchanged `90 DONE` counts.

### Evidence-source disposition

| Source class | Use | Prohibited interpretation |
| --- | --- | --- |
| Active execution canon | Binding execution law | It does not prove runtime behavior by itself |
| Existing R2.4 graph | Mandatory-node topology and owner gates | Frozen node state is not automatically current effective state |
| Corrective overlays and receipts | Append-only transition evidence | A historical `PASS` cannot certify a later head |
| Independent audits | Defect hypotheses, counterexamples and claim ceilings | They do not grant mutation or release authority |
| Exact source and tests | Current implementation shape | Source presence and test names do not prove user outcomes |
| Physical execution | Product and package outcome evidence | A synthetic evaluator fixture cannot replace it |
| GitHub CI | Exact run and merge evidence | Green jobs prove only the commands they actually executed |

### Consolidated active finding register

The register deduplicates overlapping reports. `ACTIVE_CONFIRMED` means the behavior was reproduced or directly established at the binding head. `REVALIDATE_CURRENT` means the audit evidence is credible but the first implementation contour must reconfirm it on its fresh base. `DEFERRED_DEBT` is real debt that does not outrank current data-safety and release blockers.

| ID | Priority | Status | Consolidated defect or gap | Required disposition |
| --- | --- | --- | --- | --- |
| GOV-01 | P1 | ACTIVE_CONFIRMED | Frozen PlanState and scheduler still select old W0 while effective overlays show 90 DONE and PK1 as the earliest unmet dependency | One current-state reducer and one operational resolver drive scheduler, status and completion |
| GOV-02 | P2 | ACTIVE_CONFIRMED | Historical checkpoint dated 2026-08-19 remains easy to mistake for current | Preserve sealed bytes, classify it historical and route all current readers through the new resolver |
| GOV-03 | P2 | ACTIVE_CONFIRMED | C3 generated entrypoint state drifts on current head | Regenerate only from canonical inputs and add current-head drift enforcement |
| GOV-04 | P1 | ACTIVE_CONFIRMED | Required/current test inventory and actual CI execution disagree | Classify every test as current, historical replay or superseded and execute every current required test |
| GOV-05 | P1 | ACTIVE_CONFIRMED | WP709 compatibility is tested in historical detached checkout while current-head compatibility fails | Current claims require current-head execution; historical capsule remains historical only |
| GOV-06 | P2 | ACTIVE_CONFIRMED | Conditional skip accounting uses stale expiry semantics and does not prove the required denominator | Version expiry against current stage and prove replacement lanes on every required head |
| GOV-07 | P1 | ACTIVE_CONFIRMED | The closed PK1R1 verifier compares its fixed 19-path admitted delta with the moving current `HEAD`; adding this one plan file produces `E_PK1R1_EXACT_ADMITTED_DELTA:20:19` in five required lanes and deadlocks every successor contour | Pin closed-stage verification to its immutable terminal candidate and require a fresh admission for each successor head |
| DATA-01 | P1 | ACTIVE_CONFIRMED | External change after open and before save can be overwritten with successful ACK | Bind save CAS to the revision opened by the editor and preserve both versions on conflict |
| DATA-02 | P1 | ACTIVE_CONFIRMED | Project rename or move leaves absolute-path commit records that block the next save | Bind commit metadata to stable project and scene identity with relocation-safe resolution |
| DATA-03 | P1 | ACTIVE_CONFIRMED | Legitimate shared-manifest advancement by scene B makes the next save of scene A look corrupt | Separate scene commit integrity from monotonic project-manifest lineage |
| DATA-04 | P1 | ACTIVE_CONFIRMED | Backup for document B can contain snapshot bytes from document A | Carry immutable document and revision identity through snapshot, queue and publication |
| DATA-05 | P1 | REVALIDATE_CURRENT | Correct durable coordinator exists but the live Stage10 path can ACK through a weaker writer without file and parent fsync | One live save port must own durable publish, readback and ACK truth |
| DATA-06 | P2 | REVALIDATE_CURRENT | Tree create and rename cross filesystem and identity-registry commits without crash-total recovery | Add journaled idempotent lifecycle transactions and killpoint recovery |
| DATA-07 | P2 | ACTIVE_CONFIRMED | TEMP_WRITE failure can leak an opened file descriptor | Close every acquired handle on every exit while preserving the primary error |
| DATA-08 | P3 | ACTIVE_CONFIRMED | Cleanup errors are swallowed and OLD versus NEW committed states are collapsed | Add bounded cleanup diagnostics and marker-aware classification without changing success semantics |
| DATA-09 | P3 | ACTIVE_CONFIRMED | Recovery ledger rewrites the full bounded file on append and its upper bound is not a hard policy | Bind the bound, measure it and optimize only if the measured budget fails |
| AUTH-01 | P1 | ACTIVE_CONFIRMED | Legacy menu and privileged paths can invoke handlers outside full command dispatch enforcement | All governed mutations enter one kernel dispatch path |
| AUTH-02 | P2 | ACTIVE_CONFIRMED | Capability class registration checks the existence of a label, not the operation-to-class semantic match | One canonical channel-to-operation-to-capability map must be enforced at registration and dispatch |
| AUTH-03 | P1 | ACTIVE_CONFIRMED | Only a small bridge subset receives full versioned envelope enforcement while the privileged denominator is larger | Generate and close the exact privileged-channel inventory; no unclassified route |
| AUTH-04 | P1 | ACTIVE_CONFIRMED | `ui:open-section` is classified as Query while creating files/directories and mutating application state | Reclassify the operation and deny effects from Query contexts |
| AUTH-05 | P1 | ACTIVE_CONFIRMED | `issuedAt` is parse-only, correlation IDs lack replay protection and timed-out mutations can execute twice | Enforce freshness, bounded replay ledger, idempotency and recoverable timeout semantics |
| AUTH-06 | P1 | ACTIVE_CONFIRMED | External target validation returns a path string vulnerable to symlink swap before write | Carry an opaque physical path capability to the final effect and revalidate at publish |
| EVID-01 | P2 | ACTIVE_CONFIRMED | Certification-set verifier accepts one valid binding duplicated 137 times across 33 stages | Verify exact normative stage-to-role-to-artifact set equality and uniqueness |
| EVID-02 | P2 | ACTIVE_CONFIRMED | PK1 accepts missing ASAR hashes and missing or wrong platform identifiers | Require complete identity in every mandatory receipt before cross-receipt equality |
| EVID-03 | P1 | ACTIVE_CONFIRMED | PK1 positive path can be exercised with self-authored in-memory receipts instead of an independent physical oracle | Separate evaluator tests from physical certification and require external tool observations |
| EVID-04 | P2 | ACTIVE_CONFIRMED | WP709 only checks ledger losses forward and accepts additional LOSS reported solely by final oracle | Require bidirectional equality between accumulated loss ledger and final oracle losses |
| EVID-05 | P2 | ACTIVE_CONFIRMED | C2A, C2B2 and C5C1 are marked required, fail on current head and are absent from current CI | Repair current contracts or classify pinned historical replay with explicit successors; never hide failure |
| EVID-06 | P2 | ACTIVE_CONFIRMED | Several files named UI E2E smoke inspect source strings without running the user flow | Rename their claim class and add real Electron journeys for release-critical behavior |
| PROD-01 | P2 | ACTIVE_CONFIRMED | Pulse exposes a read bridge and manifests but lacks a complete user opt-in, aggregate, correction, export and delete loop | Implement the already-declared privacy-safe loop or explicitly narrow capability before closure |
| PROD-02 | P3 | ACTIVE_CONFIRMED | Contextual Greek sigma fold loses the next lowercase character across run boundaries | Preserve full-context fold and coordinate mapping for mixed-case Greek and Latin neighbors |
| OPS-01 | P2 | ACTIVE_CONFIRMED | Host default Node can be outside the supported range even though repository pins 22.12.0 and npm 10.9.0 | One typed bootstrap route selects or rejects the toolchain before expensive gates |
| OPS-02 | P3 | ACTIVE_CONFIRMED | Flaky/conditional exception records can outlive their intended stage without issue and expiry truth | Require owner, reason, affected claim, expiry stage and current replacement proof |
| OPS-03 | P1 | ACTIVE_CONFIRMED | Legacy E0 core-purity admission is stale: on the binding head `ops-gate --task` stops on `anchor-lineage-v1.cjs`, while a complete static inventory finds 31 core files with effect tokens and the gate recognizes only four narrow exceptions | Repair the core/effect boundary and E0 from a complete machine inventory; never obtain green by appending the 31 paths to an exception list |
| MAINT-01 | P2 | ACTIVE_CONFIRMED | `main.js`, `editor.js` and the certification compiler concentrate unrelated authority and are costly to review | Extract only touched seams behind existing contracts; no big-bang rewrite |
| MAINT-02 | P2 | ACTIVE_CONFIRMED | Thousands of corrective artifacts and hard-coded successor exceptions obscure current truth | Freeze history, generate a concise current projection and stop adding competing trackers |
| REL-01 | BLOCKER | ACTIVE_CONFIRMED | PK1 physical release security is blocked and current receipts are not exact for the candidate | Execute real signing, notarization, fuses, ASAR, packaged recovery and critical journeys |
| REL-02 | BLOCKER | ACTIVE_CONFIRMED | V3 cannot issue a final package claim before a valid current PK1 result | Recompile from exact current PK1 without promoting unrelated profiles |
| REL-03 | REQUIRED | ACTIVE_CONFIRMED | WP-900 BBR policy is pending | Approve and bind crypto, key custody, off-host and retention policy |
| REL-04 | REQUIRED | ACTIVE_CONFIRMED | WP-901 restore is pending | Prove encrypted capsule, separate key, restore-as-new and corruption drills |
| REL-05 | REQUIRED | ACTIVE_CONFIRMED | WP-902 entitlement product is pending | Prove signed offline capability truth, expiry/refund and non-destructive downgrade |
| REL-06 | REQUIRED | ACTIVE_CONFIRMED | WP-903 brand release is pending | Bind licensed assets, accessible tokens and owner-approved baseline |
| REL-07 | REQUIRED | ACTIVE_CONFIRMED | WP-904 package content is pending | Produce SBOM, pinned inputs, allowlist and builder provenance |
| REL-08 | REQUIRED | ACTIVE_CONFIRMED | WP-905 package physical is pending | Prove final package install, update, rollback, recovery and security on supported targets |
| REL-09 | REQUIRED | ACTIVE_CONFIRMED | WP-906 release verdict is pending | Compile exact-profile verdict and consume an explicit owner public-release permit |

### Findings already corrected or outside repository implementation

These items remain in audit history but must not create duplicate corrective work:

| Historical item | Current disposition |
| --- | --- |
| Main branch lacked platform protection | Corrected by active ruleset; revalidate before release, do not reopen by reading only the classic protection endpoint |
| Four raw CTRs remained nonterminal | Corrective overlays preserve immutable history; current C2A/C2B2 tests still require GOV-04 and EVID-05 repair |
| First thirteen contours lacked complete current-style receipts | Retrospective certification exists with claim ceilings; do not rewrite original receipts |
| Quadratic UTF-16 offset construction | Corrected by linear prefix table; PROD-02 is a different semantic defect |
| Canonical owner checkout is behind and contains owner `AGENTS.md` work | Local hygiene fact, not a product defect; preserve it and use agent-managed worktrees |
| Production dependency audit had old findings | Current audit reports zero known production vulnerabilities; re-run at release, create work only if a fresh reachable finding exists |
| CI/OPS injection concerns from older state | Revalidate exact current workflows; fix only a current executable interpolation or `shell:true` path, without inventing debt |

### Non-negotiable engineering invariants

1. Stable identity is `projectId`, `sceneId`, source revision and generation. Path and title are locators, never durable identity.
2. The editor saves against the exact source revision it opened. A later external or internal advancement yields typed conflict, not overwrite.
3. ACK means file bytes, parent directory publication, commit metadata and required readback are durable under the admitted platform contract.
4. Backup bytes and target identity are captured in one immutable request and revalidated immediately before publication.
5. Query has no mutation or effect port. A mutating operation is a Command even if the UI calls it “open”.
6. Every governed Command is revalidated at dispatch for caller, capability, payload, project, entity, revision, idempotency and effect budget.
7. A path check returns an opaque capability or typed refusal. A raw string never becomes long-lived write authority.
8. Evidence completeness is set equality over normative roles and identities. Counts alone never prove coverage.
9. Current means current exact head, exact build, exact profile and actual current command set. Historical replay is labeled historical.
10. Synthetic receipts test validators; independent physical observations certify real packages.
11. No new release claim while any confirmed P1/P2 defect, current required test failure or unexplained required skip is open.
12. One contour has one outcome, one exact write set, one rollback and one completed delivery chain.

### Common future-contour packet

Every implementation contour must carry:

- exact task ID, current base SHA/tree, branch and fresh `origin/main`;
- one product outcome and one failure signature;
- O/T/H/B/P/I map: outcome, truth path, hypothesis, protected state, proof and identities;
- `FEATURE_INTEGRATION_MANIFEST_V1` for product/process changes and `SURFACE_MANIFEST_V1` only when a visual surface changes;
- exact Product, Command and Design authority boundaries;
- exact create/modify/delete/rename path set;
- pre-fix counterexample captured on unchanged base;
- focused positive, boundary/adversarial and stale/race/recovery negatives;
- implementation mutants for every release-blocking validator change;
- affected-chain baseline and required repository gates;
- commit, push, PR, required CI, protected merge and exact merged-head re-run;
- a current-state transition that preserves NOT_READY unless the exact graph and physical conditions are satisfied.

### Release claim strength

The maximum claim is the minimum of source trust, executed coverage, artifact integrity, snapshot freshness and oracle independence. Missing identity, stale input, historical checkout, skipped required case, self-authored physical evidence or unexecuted user flow yields `UNKNOWN` or `FAIL`, never `PASS`.

## IMPLEMENTATION_STEPS

Execution is strictly sequential under the one-writer rule. A later contour may be prepared read-only while CI runs, but no second repository write contour starts before the prior delivery chain is terminal. Within each contour, `CHECK_01` is performed before any edit; all other checks follow the edit unless explicitly named as pre-fix evidence.

### Phase 0 — restore trustworthy current control

#### R24-RCV-00A — Closed-stage candidate pin and successor-admission repair

Purpose: remove the control-plane deadlock in which an immutable completed stage is re-evaluated against every later repository head. The unchanged PK1R1 admitted set contains 19 paths; this docs-only successor adds one path, and five required lanes fail with `E_PK1R1_EXACT_ADMITTED_DELTA:20:19` before assessing the successor's own scope.

Bootstrap rule for this contour only:

1. Capture the exact unchanged-head failure in `ops-vector`, `actual-renderer-build-rtk` and all three hermetic platform lanes. Treat repeated instances as one signature.
2. Admit only the verifier boundary, its focused contracts, the smallest required successor-admission carrier set and generated governance bindings. No product runtime or graph transition is authorized.
3. A red pre-fix PK1R1 delta check is expected evidence for this repair and cannot be reported as a passed gate. Every affected lane must be green after the change on the exact PR merge candidate.

Implementation:

1. Identify the immutable PK1R1 terminal candidate from a digest-bound terminal receipt and protected merge evidence. Do not infer it from `HEAD`, filename order or the latest branch.
2. Verify PK1R1 base ancestry, its exact 19-path admitted delta, artifact bytes and governance bindings against that pinned candidate only.
3. Verify the new contour against a fresh current-head StageAdmission whose operation set equals the current base-to-candidate delta. A historical admission never authorizes a successor write.
4. Make the active resolver declare exactly one closed-stage candidate and exactly one active successor admission. Missing, duplicate, forked, stale or non-ancestor candidates fail typed.
5. Split failure codes for historical-stage corruption, successor admission absence, successor extra path, wrong operation class and current-base drift.
6. Preserve every PK1R1 artifact byte and its original claim ceiling. The repair changes how its verifier selects the candidate; it does not rewrite PK1R1 history or promote PK1/V3.

Required tests and mutants:

- the original 19-path PK1R1 candidate passes when the current head contains a separately admitted twentieth path;
- the same twentieth path without a fresh successor admission fails;
- one omitted, extra, modified, deleted or misclassified successor path fails;
- substituting current `HEAD` for the pinned PK1R1 candidate kills a mutant;
- altering one historical PK1R1 byte, its merge identity, ancestry or candidate digest still fails;
- a valid docs-only successor and a valid runtime successor use the same set-equality law without sharing mutation authority;
- all previously failing required CI lanes pass on the merge candidate and exact merged head.

Rollback: revert the verifier/admission repair as one chain. The rollback restores the known successor deadlock and therefore blocks later write contours; it cannot be claimed healthy.

#### R24-RCV-00B — E0 admission and core-effect boundary repair

Purpose: restore a truthful executable admission gate before any ordinary remediation contour. At the binding head, the global core-purity scan fails before it parses a task: the first reported violation is the Node crypto import in `anchor-lineage-v1.cjs`, and the full source inventory contains 31 core files with Node, filesystem, path or process effect tokens. Adding those paths to the current exception set would hide the architecture problem and is forbidden.

Bootstrap rule for this contour only:

1. Record the unchanged-head E0 failure and the complete deterministic inventory before any edit. Do not report `PRE_E0=PASS`.
2. Use the current successful repository bootstrap and architecture preflight as admission only for the bounded repair of E0 itself. This exception cannot authorize product work, release work or a second contour.
3. The repair is accepted only when E0 passes against the whole exact tree after the change, its focused contracts and mutants pass, normal guardrails pass, and the complete protected delivery chain is closed.

Implementation:

1. Replace line-token/file-name exceptions with an explicit machine-readable module-boundary model derived from the active architecture manifest and actual import graph.
2. Classify every source in the current 31-file inventory as pure domain logic, product port, platform adapter, persistence adapter or invalid placement. Every classification has an owner, allowed effect family and import-direction rule.
3. Move deterministic hashing in pure modules to the existing browser-safe deterministic hash seam or an injected product port. `anchor-lineage-v1.cjs` must no longer receive a special file-path exemption.
4. Move filesystem, process and platform access behind already-declared product ports/adapters in bounded substeps inside this one repair chain, or fail the contour with an exact residual inventory. Do not rename an effectful file to make the scanner miss it.
5. Make E0 scan the declared pure closure structurally and verify the adapter set separately: an adapter may use only its declared effects, pure modules may not import adapters, and renderer/worker paths may not import physical writers.
6. Preserve the existing evidence-bound path exception until its replacement is proven, then close the 2026-07-17 `ARCH_DIFF_LOG` entry with exact successor evidence rather than silently deleting it.
7. Make task-format parsing independently testable so a global source failure and a malformed HARD-TZ return distinct typed results.

Acceptance:

- all 31 current effect-token files have exactly one reviewed architectural classification and no unclassified residual;
- E0 parses and accepts this plan and a valid fixture against the full exact tree;
- adding Node crypto, filesystem, process, Electron or console effects to a pure module fails;
- adding an undeclared adapter, widening an adapter effect family, reversing an import edge, deleting one inventory row or duplicating an exception kills a focused mutant;
- existing deterministic hash results, persistence durability and recovery behavior remain byte-compatible where their contracts require it;
- E0, focused contracts, architecture guardrails and required affected tests pass after normal merge on the exact merged head.

Rollback: revert the complete boundary/gate repair. The rollback returns E0 to known red and therefore blocks all later contours; it cannot be presented as an operationally healthy state.

#### R24-RCV-00 — Current effective-state reducer and operational resolver

Purpose: eliminate split-brain among frozen PlanState, corrective overlays, scheduler output and late effective-state sidecars before autonomous implementation resumes.

Implementation:

1. Preserve `PLAN_STATE_R24.json`, raw CTRs and `CURRENT_CHECKPOINT_R2_4.json` as immutable historical inputs.
2. Define one registry-declared ordered transition stream. Discovery by arbitrary filename scan is forbidden.
3. Implement one read-only reducer that validates every transition schema, predecessor digest, fence, head ancestry, node identity and monotonic state rule.
4. Emit one generated current projection and one small resolver/pointer. The projection includes graph counts, open corrective findings, earliest actionable node, owner gates, current head/tree, source-set digest, timestamp class and claim ceiling.
5. Make `executable-program.mjs`, scheduler, `test:r24-authority-sot`, C3 operational entrypoint and human status commands consume the same reducer output.
6. Mark the 2026-08-19 checkpoint historical through the resolver and documentation classification without editing its sealed bytes.
7. Reject duplicate current authorities, gaps, forks, stale heads, invalid ancestry, lower fencing counters and a scheduler result that differs from effective state.

Acceptance:

- current output selects PK1/corrective recovery rather than W0;
- exactly 90 DONE, seven PENDING, two BLOCKED_TYPED and ten optional are reconstructed at the binding baseline;
- deleting, reordering, duplicating or substituting one overlay fails with a typed reason;
- scheduler and reducer state are byte/digest consistent;
- `programDone` cannot become true while the corrective register or mandatory graph set is open;
- no historical artifact is rewritten.

Rollback: revert the reducer/resolver contour; historical sources remain untouched.

#### R24-RCV-01 — Current test inventory, CI denominator and generated-artifact truth

Purpose: make green CI mean that every test declared current and required actually ran on the exact candidate.

Implementation:

1. Add an explicit classification to each governed test: `CURRENT_REQUIRED`, `HISTORICAL_REPLAY_REQUIRED`, `SUPERSEDED_WITH_SUCCESSOR` or `OPTIONAL_EXCLUDED`.
2. Repair C2A, C2B2 and C5C1 if they are current. If a contract is historical, bind its historical base and exact successor without using it for a current claim.
3. Remove fragile unique string-anchor mutation mechanics from C5C1; mutate an AST, structured fixture or exact bounded function seam.
4. Add deterministic current-required contract shards to maintained CI. Each shard reports file identities and TAP denominator; the merge gate consumes all shards.
5. Run WP709 compatibility on the current head. Keep its historical capsule replay as a separate historical job.
6. Regenerate and verify C3 artifacts from their canonical inputs; current drift is a hard failure.
7. Rebuild inventory from current files and validate hashes, lane assignment, skip policy, expiry and replacement-lane execution.
8. Ensure the full Sector U lane executes U6, U7 and U8 under the required environment on every qualifying head.
9. A skipped current required test fails. Conditional skips must have unexpired policy and a proven replacement lane in the same run.

Acceptance:

- the three known contract failures are either green as current tests or explicitly historical with valid current successors;
- all current required tests are present in CI and accounted for exactly once;
- current WP709 compatibility and C3 drift checks pass on the merged head;
- zero required and zero unexplained skips, zero todo, zero cancelled and nonzero denominators;
- removing one test from CI, misclassifying one current test or substituting a historical result kills the negative test.

Rollback: revert inventory, runner and workflow changes together; never leave a new classification without its executing lane.

### Phase 1 — close manuscript and recovery safety defects

#### R24-RCV-02 — Editor-open revision CAS and external divergence

Purpose: prevent a successful save from overwriting bytes changed after the editor opened them.

Implementation:

1. Main owns an immutable open-revision token containing project, scene, canonical source digest, format identity and revision.
2. Renderer sends intent and editor generation only; it cannot author the base digest.
3. Save re-reads canonical bytes and compares them to the stored open revision before admitting mutation, including the first WP201 save and standalone-file path.
4. On mismatch, write neither version over the other. Return a typed conflict and create a readable recovery/conflict record containing hashes and safe references to both variants.
5. Offer conflict resolution only through explicit Commands: reload external, preserve local as a new recovery copy, or owner-selected merge. No automatic merge.
6. A successful save advances the open revision atomically with persisted truth.

Required tests:

- open, external edit, save: external bytes remain and save refuses;
- same scenario before the first commit marker and after an existing marker;
- project scene and standalone document;
- external delete, replace, inode swap and same-content rewrite;
- conflict recovery is readable and does not disclose paths to renderer;
- normal save, autosave, reopen and crash recovery remain green;
- stale renderer digest and forged payload cannot authorize overwrite.

#### R24-RCV-03 — Relocation-safe commit records and shared-manifest lineage

Purpose: allow legitimate rename, move and unrelated manifest advancement without disabling corruption detection.

Implementation:

1. Replace absolute path identity in commit records with stable `projectId`, `sceneId`, project-relative validated locator and format version.
2. Resolve current project root at open and at effect time; rename/move carries or reconstructs valid commit metadata through an atomic lifecycle transaction.
3. Split scene content integrity from project-manifest lineage. A scene record binds the scene pre/post digests and the manifest revision it observed, not a forever-equal digest of all shared metadata.
4. Accept only proven monotonic manifest lineage. Reject rollback, fork, unrecognized project identity, swapped scene locator and invalid digest chain.
5. Provide migration and readable recovery for legacy absolute-path records; do not silently delete them.

Required tests:

- open, save, rename project, save, close and reopen;
- move project directory, save and reopen;
- save A, valid manifest/book-profile update through B, save A;
- save A, corrupt manifest, save A must fail;
- project clone receives new identity; ordinary move retains identity;
- legacy record migration, crash at every metadata phase and rollback;
- previous scene bytes remain readable on refusal and no false ACK occurs.

#### R24-RCV-04 — Backup snapshot-to-target identity binding

Purpose: guarantee that backup B can contain only a snapshot of B at the declared revision.

Implementation:

1. Snapshot reply includes immutable project, document, revision, generation and source digest.
2. Backup Command captures its target identity before any asynchronous wait.
3. The disk-queue closure carries the captured request, never reads mutable `currentFilePath` or current UI selection.
4. Revalidate snapshot identity, current canonical identity and generation immediately before write.
5. Mismatch cancels with typed refusal and writes no backup. Retry requires a fresh snapshot.

Required tests:

- delayed snapshot A while opening B;
- delayed settings write during A-to-B and B-to-A transitions;
- backup during close, rename, move and external divergence;
- dirty authoring buffer policy is explicit and no saved-state backup claims unsaved bytes;
- backup restore selects the correct document and verifies its digest;
- no target path or recovery authority is accepted from renderer.

#### R24-RCV-05 — One live durable save port and total handle cleanup

Purpose: make production save semantics equal the proven durability model and close descriptor leaks.

Implementation:

1. Trace every live save/autosave/project-transaction route to its final writer.
2. Select one product port for durable write. Existing Stage10 and file-manager routes must delegate to it rather than maintain a weaker parallel algorithm.
3. Enforce temp creation, write, file fsync, close, atomic publish, parent fsync, readback, commit/journal finalization and ACK in that order.
4. Track acquired resources explicitly. Every exit after open closes the handle in a `finally`-equivalent cleanup while preserving the primary failure and recording bounded secondary cleanup diagnostics.
5. Do not delete a recoverable temp or journal until the durable outcome is known.

Required tests:

- ENOSPC and injected failures at open, write, file fsync, close, rename, parent fsync, readback and journal finalization;
- actual close-call proof and zero descriptor growth over repeated failures;
- SIGKILL matrix around every phase with old-or-new readable outcome;
- production handler integration, not only direct coordinator unit tests;
- no ACK before readback and commit truth;
- all existing import/export and Review safe writers remain compatible.

#### R24-RCV-06 — Crash-total create and rename lifecycle transactions

Purpose: keep filesystem objects and identity registry convergent through process death.

Implementation:

1. Introduce one lifecycle journal with operation ID, project identity, source/target locators, expected registry revision and phase.
2. Create and rename become idempotent transactions with deterministic startup reconciliation.
3. Reconciliation distinguishes not-started, filesystem-applied/registry-pending, registry-applied/filesystem-pending, completed and conflict.
4. Never auto-attach an ambiguous object or overwrite a conflicting target.
5. Journal publication and cleanup use the durable port from R24-RCV-05.

Required tests:

- kill after each filesystem, registry and journal phase;
- retry same operation ID is idempotent;
- different operation ID cannot consume the first operation’s residue;
- existing target, case-only rename, Unicode normalization, reserved names and cross-device move refusal;
- recovery produces one canonical object and one registry identity or a typed conflict, never an orphaned silent success.

### Phase 2 — close authority, IPC and effect-boundary defects

#### R24-RCV-07 — Descriptor-bound external path capability

Purpose: prevent a validated external target from being redirected by symlink or directory replacement before publication.

Implementation:

1. Path admission returns an opaque capability bound to canonical parent identity, device/inode where supported, basename, access mode, project-boundary decision and expiry/generation.
2. The capability is created in main after dialog resolution and never serialized to renderer.
3. The disk queue receives the capability, revalidates parent and target immediately before temp creation and publication, and uses no-follow semantics where available.
4. Platform adapters report whether descriptor-bound or equivalent safe publication is supported. Missing protection yields typed unavailable, not raw-path fallback.
5. External export, review packet, Markdown, TXT, DOCX and package writers adopt the same port incrementally without widening scope.

Required tests:

- symlink swap after validation and before queue execution;
- parent replacement, target hardlink, project-root alias, case/Unicode alias and cross-device behavior;
- capability replay, wrong operation, wrong target and expired generation;
- normal Save As and external export remain functional;
- renderer never receives path capability internals.

#### R24-RCV-08 — Canonical operation taxonomy and semantic capability map

Purpose: make registration-time metadata agree with actual operation semantics.

Implementation:

1. Generate one inventory of all IPC channels and command routes with exact operation kind, state class, effect class, capability and payload schema.
2. `createCapabilityBoundRegistration` validates the exact channel-to-class mapping, not membership in an allowed label set.
3. Query context exposes no mutation, filesystem, registry, shell-write or platform-effect port.
4. Reclassify `ui:open-section` as a Command if it creates storage or changes governed state; split a pure read query if one is needed.
5. Startup fails on an unclassified route, semantic mismatch, duplicate channel or Query with effects.

Required tests:

- registering `ui:create-node` as `query.read` fails before handler execution;
- a Query attempting directory/file creation or state mutation cannot obtain the effect port;
- each existing route’s declared class matches observed ports and state writes;
- allowlist renaming or label substitution is caught structurally;
- all current pure Queries remain read-only.

#### R24-RCV-09 — Full privileged IPC admission denominator

Purpose: apply one complete admission contract to every privileged route.

Implementation:

1. Derive the exact privileged denominator from actual registrations; do not hard-code “three bridge channels” as the whole system.
2. Route every privileged handler through one guarded factory that enforces caller identity, envelope version, payload schema, operation class, capability, project/entity identity, expected revision and effect budget.
3. Explicitly list nonprivileged channels and prove they have no product, shell, filesystem or process effect.
4. Bound payload bytes, depth, breadth and collection sizes before normalization or interpretation.
5. Add a static/runtime guard that raw privileged `ipcMain.handle` registrations fail CI.

Required tests:

- inventory equality between registrations and policy;
- foreign, destroyed, stale and unbound senders;
- missing/extra/inherited fields, prototype confusion, oversize and cyclic inputs;
- wrong project, entity, revision, capability and operation class;
- direct raw registration and unclassified route mutants;
- exact live handler integration for every privileged family.

#### R24-RCV-10 — Freshness, replay, idempotency and timeout semantics

Purpose: make retries safe when renderer timeouts and main-process completion diverge.

Implementation:

1. Enforce bounded `issuedAt` age and future skew using a monotonic/server-observed admission time.
2. Maintain a bounded per-session replay ledger keyed by caller identity, command ID and correlation/idempotency ID.
3. Every mutating Command declares its idempotency policy: deduplicate and return prior result, resumable operation, or explicit non-retriable refusal.
4. Timeout cancels only cancelable work. Noncancelable committed work remains queryable by operation ID and a retry cannot duplicate it.
5. Persist idempotency for crash-sensitive mutations when process-lifetime memory is insufficient.

Required tests:

- expired, future, duplicate and cross-caller correlation IDs;
- renderer timeout immediately before and after commit;
- duplicate tree create/save/export/apply requests create at most one product effect;
- restart recovery of in-flight durable operations;
- bounded ledger eviction never permits replay inside the declared safety window;
- clocks and injected timers remain deterministic in tests.

#### R24-RCV-11 — One Command Kernel entry for menu, hotkey, palette, button and context routes

Purpose: remove direct governed handler invocation and enforce the same policy regardless of UI source.

Implementation:

1. Generate the canonical governed command inventory and all UI source bindings.
2. Define a single dispatch API with command ID plus intent payload. Kernel owns availability, capability, revision, idempotency and effect reservation.
3. Migrate menu routes first, then hotkeys, palette, toolbar/buttons and context actions in bounded route-family subcontours.
4. Legacy action IDs may map to canonical command IDs but cannot execute directly.
5. Direct handler functions become internal use cases callable only by admitted Command execution.
6. Visibility remains a Design OS projection and never changes authority.

Required tests:

- five mandatory bypass negatives: menu, hotkey, palette, direct IPC and context/button;
- hidden but directly dispatched command still enforces capability;
- visible but unavailable command refuses at dispatch;
- Free/Pro, project lifecycle, dirty/revision and platform capability matrices;
- no change to labels, visual composition or keyboard parity unless separately admitted.

### Phase 3 — eliminate verifier and evidence false-green paths

#### R24-RCV-12 — Certification-set normative coverage compiler

Purpose: make a certification-set PASS prove the exact required artifacts for every stage.

Implementation:

1. Define one normative manifest mapping stage ID to required artifact roles, canonical relative paths, schema versions and source-set digest.
2. Derive expected coverage from the stage registry and contracts, never from the candidate set itself.
3. Compare exact sets: missing, extra, duplicate, wrong-stage, wrong-role, wrong-path and wrong-digest all fail.
4. Require global uniqueness where a role is single-owner and explicitly model legitimate shared artifacts.
5. Bind the normative manifest digest into the terminal attestation.
6. Keep historical certification sets verifiable against their historical manifest; current state uses the current manifest.

Required mutants:

- one artifact duplicated 137 times;
- two stages swapped;
- correct file under wrong role;
- correct count with one missing and one extra;
- supplied self-consistent digest not equal to normative digest;
- path alias, Unicode confusable and different-head object;
- terminal attestation with substituted certification-set digest.

#### R24-RCV-13 — WP709 bidirectional fidelity and current-head certification

Purpose: prove that every final loss is declared and every declared loss remains observable.

Implementation:

1. Canonicalize field identity and compare accumulated loss ledger with final oracle LOSS entries as exact sets.
2. Require typed reason, first-loss hop, source identity and deterministic ordering for every loss.
3. Reject a final-only loss, ledger-only loss, duplicate, contradictory PRESERVED/LOSS pair, unknown field or hash-consistent substitution.
4. Run compile and verify against current head and current routing/carrier registry.
5. Preserve historical chain capsules as historical evidence only.

Required tests:

- the reproduced BODY=LOSS with empty ledger fails;
- loss introduced and later preserved cannot disappear from history;
- expected downgrade path passes with exact ledger;
- all seven routes and hostile inputs run on current head;
- source mutants for both comparison directions are killed;
- current compatibility checks are required CI.

#### R24-RCV-14 — PK1 evaluator identity completeness and oracle separation

Purpose: make a positive PK1 candidate impossible without complete artifact and platform identity, while keeping evaluator tests distinct from physical certification.

Implementation:

1. Every mandatory receipt requires a valid nonempty ASAR SHA-256, build ID, app version, platform ID, architecture, artifact digest and evidence timestamp.
2. Check completeness per receipt before checking equality across receipts.
3. Remove positive platform fallback. Unsupported, missing or mixed platform identity is a typed refusal.
4. Bind signer identity, hardened-runtime status, fuse state and notarization identity to the same exact artifact.
5. Mark synthetic receipts `EVALUATOR_TEST_ONLY`; they can prove rejection/acceptance logic but never set physical evidence ready.
6. Define the physical oracle interface now, but execute it only in R24-RCV-22 with real admitted tooling and credentials.

Required mutants:

- remove each of four ASAR hashes independently and in combinations;
- wrong/missing platform, wrong architecture and mixed artifacts;
- stale, different-head and different-build receipt;
- self-authored physical flag without tool observation;
- correct hashes attached to the wrong package;
- positive evaluator result still leaves publication authority false before physical certification.

#### R24-RCV-15 — User-journey evidence truth

Purpose: ensure that release-critical “E2E” evidence runs the product instead of scanning source text.

Implementation:

1. Reclassify source-inspection tests as static source contracts; preserve their utility without calling them UI E2E.
2. Define a small physical Electron journey set: create/open, type, selection, undo/redo, save, close, reopen, recovery, export and the corrected rename/external-edit/backup cases.
3. Use disposable synthetic projects and exact application build identity.
4. Observe disk bytes, visible state, receipts and recovery; source strings and screenshots alone cannot pass.
5. Keep platform-specific accessibility, IME and screen-reader evidence explicit and profile-bound.

Acceptance:

- each journey reports exact build, platform, fixture, actions and observed outputs;
- a no-op button, stale renderer, skipped action or source-only substitute fails;
- no private user document or persistent test residue;
- required physical lanes are present in the merge/release gate appropriate to their cost.

### Phase 4 — close bounded product and operational completeness gaps

#### R24-RCV-16 — Pulse privacy-safe complete user loop

Purpose: align the declared Pulse profile with a usable local product path while preserving default opt-out.

Implementation:

1. Confirm the existing WP804/WP806 contract and use current Settings/History surfaces; do not create a new analytics system.
2. Add canonical Commands for explicit opt-in, opt-out, correction, export and delete through the kernel fixed in Phase 2.
3. Collect only declared local aggregates after consent. No raw manuscript content, network, cloud or background collection before opt-in.
4. Provide a revision-bound history projection and clear stale/empty/opted-out states.
5. Opt-out stops future collection; delete removes governed Pulse records without deleting manuscript truth; downgrade preserves readable data according to policy.
6. If the manifest promises more than the accepted Writer v1 scope, narrow the claim explicitly instead of shipping an inert command.

Required tests:

- new profile starts opted out and empty;
- opt-in, eligible activity, aggregate, history display, correction, export, opt-out and delete;
- no collection before consent or after opt-out;
- stale revision, Free/Pro change, project switch and restart;
- export contains only declared aggregate data;
- real user-flow evidence, not fixture-injected history alone.

If composition or a new visual surface is required, that implementation contour must activate the Lazyweb-first design router and obtain a bounded owner-selected direction before UI code.

#### R24-RCV-17 — Context-correct Unicode fold

Purpose: restore search correctness without changing the declared normalization or UTF-16 coordinate policy.

Implementation:

1. Preserve the already-computed full-context fold when closing a run, or pass the next code point into the run fold explicitly.
2. Keep tape mappings deterministic for original-to-folded and folded-to-original offsets.
3. Do not use host locale.

Required tests:

- `Σα`, `ΟΣα`, `Σa`, `ΣΑ`, word-final sigma, combining marks and supplementary characters;
- search and project-search ranges return the original UTF-16 spans;
- mixed Greek/Latin case and run-boundary mutations;
- roundtrip, hostile corpus and performance budget;
- mutant that drops next-character context is killed.

#### R24-RCV-18 — Low-level storage diagnostics and bounded ledger policy

Purpose: close the remaining low-level storage debt without destabilizing the proven persistence model.

Implementation:

1. Report best-effort cleanup failure as secondary typed diagnostics while preserving the primary save result.
2. Use commit marker context to distinguish OLD_COMMITTED, NEW_COMMITTED and ambiguous old-or-new recovery states where physically knowable.
3. Make recovery-ledger maximum entries and bytes an explicit policy with compaction threshold and measured append budget.
4. Optimize append only if the current bound violates the budget; prefer a simple reliable implementation over speculative storage framework.

Acceptance:

- cleanup failure is observable but cannot convert a failed primary write into success;
- classification matches killpoint outcomes;
- ledger cannot grow beyond policy and compaction remains crash-safe;
- no loss of recovery readability or digest-chain integrity.

#### R24-RCV-19 — Toolchain and exception-policy reproducibility

Purpose: stop unsupported host runtimes and expired skip/flaky records before they create misleading failures or greens.

Implementation:

1. Keep `.node-version`, package engines and package-manager pin aligned at Node 22.12.0 and npm 10.9.0 until an explicit toolchain upgrade.
2. Add one cheap toolchain preflight used by local R2.4 entrypoints and CI. It reports actual and required versions before tests.
3. Use an existing installed/pinned runtime or an explicitly admitted fetch; do not silently run under Node 26.
4. Validate every conditional skip/flaky exception against current stage, owner, reason, affected claim, expiry and same-run replacement proof.
5. A toolchain mismatch is environment UNKNOWN/BLOCKED, not a product failure and not a reason to waive tests.

#### R24-RCV-20 — Bounded authority-seam decomposition

Purpose: reduce review and regression risk after behavioral fixes are stable.

Implementation:

1. Extract only already-corrected persistence, lifecycle, IPC inventory, command routing and Pulse seams from `main.js` into named modules with unchanged contracts.
2. Extract renderer orchestration only where the corresponding product contract is already immutable; do not redesign UI.
3. Split the certification compiler into pure normative manifest, reducer, verifier and CLI layers while preserving historical verification.
4. Add dependency-boundary tests and prevent new governed logic from returning to monolith entrypoints.
5. Freeze the old corrective history and generate indexes/projections; do not mass-delete evidence.

Acceptance:

- byte/behavior-equivalent product baselines and existing fixtures pass;
- no new private bus, registry or abstraction framework;
- each extracted module has one owner and no direct cross-plane write;
- current-state reconstruction becomes simpler and has fewer hard-coded successor exceptions;
- this contour does not change release status.

### Phase 5 — reopen the existing mandatory release graph only after correction gates are green

#### R24-RCV-21 — Pre-release corrective acceptance checkpoint

Purpose: prove that Phases 0–4 are merged and no known P1/P2 false-green remains before consuming signing or release authority.

Required result:

- current reducer, current inventory and all correction-specific negative tests pass on one fresh `origin/main`;
- complete product safety journeys and privileged-route denominator pass;
- certification-set, WP709 and PK1 counterexamples fail as intended;
- full baseline, RTK, multi-OS parity, renderer/preload build, SAST, privacy, OSS and production dependency audit are green;
- an independent read-only audit confirms the exact SHA and build;
- verdict remains NOT_READY solely for named mandatory release nodes.

This checkpoint does not increment the 109-node graph and does not issue publication authority.

#### R24-RCV-22 — `PK1_RELEASE_SECURITY_PHYSICAL`

Purpose: satisfy the existing graph outcome with real, exact-artifact physical evidence.

Execution:

1. Build the distribution candidate from a clean exact merged SHA with pinned inputs.
2. Record package, executable and ASAR hashes before and after signing steps.
3. Verify Developer ID signing, designated requirement, deep strict validation and Hardened Runtime using platform tools.
4. Verify Electron fuse state from the packaged executable.
5. Submit for notarization through the admitted Apple path, verify returned identity, staple and validate offline where supported.
6. Run packaged create/open/type/save/close/reopen/recovery/export critical journeys on each supported target/profile.
7. Bind every receipt to the same head, tree, build, platform, architecture and artifact.
8. Have a separate verifier execute the physical oracle; the builder cannot self-certify.

Hard stops:

- no configured signing identity or credential;
- notarization unavailable or rejected;
- any identity mismatch, unstapled artifact, unsafe fuse, missing ASAR hash, failed recovery or different build;
- secrets would be printed, copied into repo or embedded in evidence.

Completion: terminal PK1 receipt with exact physical denominator and publication authority still false until later graph gates.

#### R24-RCV-23 — `V3_PACKAGE_CLAIM_COMPILER`

Purpose: compute the package/security verdict from current PK1 and existing Writer claim inputs without promoting Atlas, Word, Google or optional profiles.

Acceptance:

- raw current PK1 is re-evaluated internally;
- stale, synthetic, different-head/build/platform or partial PK1 fails;
- positive package classification is exact-profile only;
- current corrective findings and delivery state remain inputs;
- `programDone` stays false while WP-900 through WP-906 are pending;
- implementation mutants kill every identity and claim-promotion bypass.

#### R24-RCV-24 — `WP-900_BBR_POLICY`

Purpose: record the approved backup/restore policy before implementing encrypted capsules.

Required decisions and evidence:

- approved cryptographic construction and versioning;
- key creation, custody, rotation, loss and recovery policy with key separate from capsule;
- off-host strategy and retention schedule compatible with offline-first Writer v1;
- metadata/privacy boundary and explicit exclusion of secrets from repository;
- threat model, rollback and unsupported states;
- owner gate `BBR_CRYPTO_KEY_ADR` bound to exact policy bytes.

No encrypted runtime is implemented until the policy is approved and machine validated.

#### R24-RCV-25 — `WP-901_BBR_RESTORE`

Purpose: implement and physically prove encrypted backup capsule and restore-as-new.

Acceptance:

- authenticated, versioned capsule with independent key material;
- atomic creation and readable inventory;
- restore creates a new project identity and never overwrites the live project silently;
- correct key succeeds; wrong key, corrupt header/body/tag, truncation, reordering and unsupported version fail before product mutation;
- killpoint tests leave the original project readable;
- off-host copy roundtrip and retention behavior are physically tested;
- no private fixture or key enters logs, Git or receipts.

#### R24-RCV-26 — `WP-902_ENTITLEMENT_PRODUCT`

Purpose: complete signed local capability truth without locking user data.

Acceptance:

- exact owner pricing/entitlement ADR is bound before behavior changes;
- signed entitlement is validated locally with version, product, device/profile and expiry identity;
- offline, clock skew, grace, expiry, refund and revoked/invalid signature behaviors are typed;
- downgrade disables capability but preserves all project data in readable shared format;
- Free editing invalidates or marks dependent Pro-derived data stale without deletion;
- no account or network truth becomes required to open, edit, save, recover or export owned text;
- capability is revalidated at Command dispatch, not inferred from UI visibility.

#### R24-RCV-27 — `WP-903_BRAND_RELEASE`

Purpose: bind only licensed and accessible release assets to the exact product baseline.

Acceptance:

- asset inventory includes origin, license, permitted use and exact digest;
- no unlicensed font, icon, image, trademark or placeholder remains in package;
- owner-approved baseline is exact and does not overwrite the established toolbar visual decision by accident;
- contrast, focus, keyboard labels, reduced motion and platform asset variants pass;
- generated assets are reproducible from governed sources;
- visual evidence is exact build/profile and does not substitute for functional tests.

Any material UI composition change uses the Lazyweb-first design protocol in its own product-UI contour.

#### R24-RCV-28 — `WP-904_PACKAGE_CONTENT`

Purpose: prove exactly what enters the release package and how it was built.

Acceptance:

- deterministic file allowlist and forbidden-file scan;
- SBOM for production package and complete license notices;
- pinned lockfile, toolchain, builder image/environment and source SHA;
- provenance binds inputs, commands, outputs, artifact/ASAR hashes and builder identity;
- no source maps, tests, secrets, private evidence, dev-only modules, unexpected native binaries or network bootstrap code;
- clean rebuild comparison documents deterministic and platform-signature differences;
- production dependency audit has zero unresolved reachable critical/high findings or an explicit time-bound policy-compliant exception.

#### R24-RCV-29 — `WP-905_PACKAGE_PHYSICAL`

Purpose: validate the final package after BBR, entitlement, brand and content inputs are complete.

Acceptance:

- signing, notarization, fuses and ASAR are re-run for the final artifact, not reused from an earlier candidate;
- fresh install, first launch, existing-project open, create/write/save/close/reopen, recovery and export pass;
- update from the supported previous version preserves project and shell-state boundaries;
- rollback restores a runnable prior version without making newer project data unreadable or deleting it;
- corrupted installer/update, interrupted install, no-space, permission and offline scenarios fail safely;
- uninstall behavior preserves user documents according to policy;
- macOS and every other claimed supported target have exact physical receipts;
- package identity is unchanged across every receipt consumed by WP-906.

#### R24-RCV-30 — `WP-906_RELEASE_VERDICT`

Purpose: compile the final exact-profile release verdict and consume the explicit public-release permit.

Acceptance:

- consumes only current exact-head outputs from WP-905 and its dependency chain;
- recomputes all mandatory graph and corrective conditions rather than trusting nested summaries;
- current-state reducer reports 99 mandatory terminal nodes, zero PENDING and zero BLOCKED_TYPED;
- ten optional nodes remain explicit optional/ineligible unless separately and lawfully promoted;
- no open P1/P2 finding, required test failure, stale receipt, required skip, WIP, active lease or incomplete delivery;
- two independent exact-head audits agree on artifact identity and claim ceiling;
- owner public-release permit names exact SHA, build, profile, platform set and artifact hashes;
- permit mismatch or absence leaves `publicationAuthority=false` and `programDone=false`;
- after a valid permit, the compiler may set the exact bounded release claim without promoting untested profiles.

### Phase 6 — final program closure and factual cutover

#### R24-RCV-31 — Exact merged-head closure

Purpose: close the program once, with one authoritative current result.

Execution:

1. Fetch and verify the exact merged release head and tree in a clean detached/worktree checkout.
2. Run the complete current required test inventory, correction negatives, implementation mutants, RTK, platform parity, package security, physical journeys and independent verifiers.
3. Verify all evidence hashes, source bindings, denominators, CI job identities, ruleset and protected merge history.
4. Compile one final effective state and terminal receipt from canonical inputs.
5. Perform one factual documentation cutover so current docs no longer present frozen August state as operational truth.
6. Preserve all historical evidence and link it through the resolver; do not mass-rewrite it.
7. Release the writer lease, prove WIP zero and archive only task-owned temporary resources.

Final success criteria:

- `programDone=true` is independently reproduced from source inputs;
- `productionReleaseReady=true` applies only to the exact certified profile and artifacts;
- `publicationAuthorityGranted=true` appears only with the exact owner permit;
- all other capabilities remain at their proven `LIVE`, `PARTIAL`, `BLOCKED`, `MANUAL_ONLY` or optional status;
- clean worktree, complete delivery chain and no unresolved blocking finding.

### Relative effort and critical path

| Group | Contours | Relative effort | Critical-path role |
| --- | --- | --- | --- |
| Admission, current truth and CI | 00A–01 | Extra large | Admission prerequisite; 00A then 00B before 00 |
| Manuscript safety | 02–06 | Extra large | Release blocker |
| Authority and security | 07–11 | Extra large | Release blocker |
| Evidence correctness | 12–15 | Large | Release blocker |
| Product/operational completeness | 16–20 | Large | 16 required for Pulse claim; remaining debt must meet final severity policy |
| Existing release graph | 21–30 | Extra large plus external latency | Mandatory graph critical path |
| Final closure | 31 | Large | Terminal step |

No calendar estimate is asserted because physical signing/notarization latency, CI load, platform access and the number of route-family migrations are external variables. Progress reporting uses completed contours and passed acceptance, never elapsed time or changed-line counts.

## CHECKS

CHECK_01_PRE_EXACT_BASE_CANON_AND_ISOLATION
CMD: verify fresh origin main, exact head and tree, canonical registry identity, encrypted T7 identity, clean isolated branch worktree, active canon and current COREX before the first repository edit
PASS: head and origin main equal the declared binding SHA, tree equals the declared tree, T7 is mounted writable encrypted and unlocked with the registered UUID, the task worktree is clean, and the dirty canonical owner checkout remains untouched

CHECK_02_POST_TASK_FORMAT
CMD: execute the task-format parser in an isolated fixture with no `src/core`, then run node scripts/ops-gate.mjs --task docs/tasks/2026-09-08--r24-consolidated-remediation-and-completion-plan.md against the complete repository
PASS: the isolated parser accepts the HARD-TZ structure, task type, canon version, baseline version, DENYLIST and PRE/POST check contract; until R24-RCV-00B closes OPS-03, the full-tree command is recorded as the expected pre-existing `CORE_PURITY_VIOLATION` and cannot be represented as green

CHECK_03_POST_SCOPE_AND_DIFF
CMD: inspect Git status, staged paths and diff check for the isolated task worktree
PASS: the plan document is the only changed path, no unrelated bytes or generated files changed, and the diff has no whitespace errors

CHECK_04_POST_PLAN_COMPLETENESS
CMD: verify the document contains every consolidated finding ID, all nine nonterminal mandatory graph nodes, phases 0 through 6, one bounded contour per outcome, acceptance, negative proof, rollback discipline, delivery discipline and final definition of done
PASS: no confirmed active finding or mandatory node is absent, overlapping findings are deduplicated, corrected historical findings are not reopened, and no plan statement promotes current product or release status

CHECK_05_POST_ARCHITECTURE_AND_CLAIM_BOUNDARY
CMD: review the plan against active canon, CANON, COREX, BIBLE, architecture map, glossary, documentation constitution, process and exact current state
PASS: Product Core, Command Kernel, Design OS, renderer, product ports and adapters remain separated; current and target are explicit; evidence creates no authority; Writer v1 scope and offline-first constraints remain intact

CHECK_06_POST_GUARDRAILS
CMD: PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run agent:guardrails
PASS: repository agent guardrails exit zero on the candidate with no runtime or governance drift caused by this document

CHECK_07_POST_DELIVERY
CMD: commit the exact plan scope, push the task branch, create a PR against main, wait for all required checks, merge normally, fetch origin main and verify the exact merged tree in a clean checkout
PASS: commit, push, PR, required CI, protected merge and exact merged-head verification all complete without bypass or base drift

CHECK_08_POSTMERGE_PLAN_PRESENCE_AND_TRUTH
CMD: read the plan from exact merged origin main and rerun task format, guardrails, scope history and current-state nonpromotion checks
PASS: merged bytes match the reviewed plan, current graph still honestly reports NOT_READY until implementation contours complete, and the next action resolves to R24-RCV-00A

## STOP_CONDITION

- active canon, current graph identity or current effective state cannot be resolved unambiguously;
- origin main changes in a way that makes the declared task base or PR unmergeable and normal merge cannot preserve scope;
- the isolated worktree contains unrelated or unowned changes;
- any implementation contour attempts to combine independent outcomes, broaden Writer v1, add a dependency, enable product network/cloud truth or create a second active tracker without an explicit owner amendment;
- a data-safety fix would remove corruption detection, recovery or CAS instead of repairing identity/lineage;
- a security fix relies on UI visibility, a label, renderer payload or raw path string as authority;
- a verifier fix reduces the denominator, deletes a failing current test, accepts self-authored physical evidence or moves current checks to historical execution to obtain green;
- real user data, secrets, signing keys or private evidence would be exposed or committed;
- destructive cleanup, reset, force action, direct protected-branch push or publication outside the exact permit is required;
- a required physical platform, signing identity, notarization service or owner-gated policy is unavailable;
- the same failure signature occurs three times without a new evidence-backed hypothesis;
- required tests, CI, merge or exact postmerge verification cannot complete normally.

On stop, preserve the branch and all owned evidence, release only the exact owned lease when safe, report expected versus actual, exact identities and one next hypothesis. Do not mark the contour done or advance to the next write cluster.

## REPORT_FORMAT

- TASK_ID
- STATUS
- HEAD_SHA_BEFORE
- HEAD_SHA_AFTER
- COMMIT_SHA
- MERGED_SHA
- MERGED_TREE
- CHANGED_BASENAMES
- STAGED_SCOPE_MATCH
- DESIGN_TOOL_ROUTER
- TEST_RESULTS_WITH_NUMERATOR_DENOMINATOR_SKIP_TODO
- COUNTEREXAMPLE_RESULT
- IMPLEMENTATION_MUTANT_RESULT
- INVARIANTS_RESULT
- CURRENT_GRAPH_COUNTS
- CURRENT_CLAIM_SCOPE
- COMMIT_OUTCOME
- PUSH_RESULT
- PR_RESULT
- CI_RESULT
- MERGE_RESULT
- POSTMERGE_RESULT
- EXTERNAL_ORACLE_RESULT
- OPEN_LIMITATIONS
- ROLLBACK
- NEXT_STEP

For implementation tasks governed by repository output policy, return exactly one `text` code block containing `KEY: VALUE` lines. `CHANGED_BASENAMES` contains basenames only. Claims name the exact SHA, build, profile, numerator, denominator, artifact hashes and oracle actually executed.

## FAIL_PROTOCOL

1. Fail closed. A failed or unknown mandatory link remains failed or unknown.
2. Preserve pre-existing work, user documents, canonical checkout changes, immutable evidence and recovery artifacts.
3. Record the exact command, phase, error code, expected observation, actual observation, head/tree, runtime, fixture or seed, affected identities and the last known durable state.
4. Distinguish product failure, test failure, environment/toolchain failure, external service failure and evidence-verifier failure.
5. Keep the primary error. Secondary cleanup errors are attached as diagnostics and never replace it.
6. Do not retry an external or mutating operation without knowing its idempotency outcome.
7. After three identical failure signatures, stop the loop and state one next hypothesis.
8. Correct only the admitted contour. A newly discovered independent defect enters the reducer’s open-finding register and receives a later bounded task.
9. Do not weaken a test or claim to fit current behavior. If the accepted product contract is wrong, obtain an explicit owner amendment and preserve the old contract as history.
10. A branch-local fix remains candidate-only until commit, push, required CI, normal protected merge and exact merged-head verification are complete.
11. A positive evaluator result remains internal evidence until an independent physical oracle proves the artifact.
12. Public release remains blocked unless the final owner permit matches the exact certified artifact set.
