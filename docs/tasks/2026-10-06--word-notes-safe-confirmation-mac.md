# Word notes and discussions: bounded confirmation on macOS

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true
TASK_ID: WORD_NOTES_SAFE_CONFIRMATION_MAC_20261006
STATUS: IMPLEMENTATION_CANDIDATE
DOCUMENT_CLASS: TASK_CONTRACT
CLAIM_BOUNDARY: mechanical confirmation wiring only; full novel acceptance remains open.
BINDING_BASE_SHA: 12474df25f4ce8c2cea62a1e57be65ca69f514cc
DESIGN_TOOL_ROUTER: bound to validated pre-edit architecture declaration; mechanical reuse, no design contract change

## MICRO_GOAL

Use the delivered bounded Word confirmation adapter for notes and discussion
returns, preserving their existing complete descriptions and Apply authority.
This is necessary preparation for the owner's autonomous macOS novel release.
Complex tables remain outside that release priority; their existing regressions
and displayed descriptions remain protected.

## ARTIFACT

Two mechanical Main confirmation call-site repairs and affected whole contracts.
The exact helper, surface, styles, input limits and private choice protocol are
unchanged. Source base includes merged PR2089; its hidden Electron keyboard and
32k geometry evidence qualifies only that adapter, not these new call sites.

## ALLOWLIST

- `src/main.js`
- `test/contracts/rtk-word-note-return-runtime.contract.test.js`
- `test/contracts/rtk-word-note-tables.contract.test.js`
- `test/contracts/rtk-word-comment-return-apply.contract.test.js`
- `test/contracts/rtk-interop-word-manuscript-promotion.contract.test.js`
- `docs/tasks/2026-10-06--word-notes-safe-confirmation-mac.md`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/CONTEXT.md`
- `docs/HANDOFF.md`
- `docs/WORKLOG.md`

## DENYLIST

No Core, IO parser, export, renderer, preload, helper, storage schema or dependency
changes. No new IPC, runtime network, command, capability or semantic admission.
Do not replay the old import, pending novel profiles, giant alert, AX/CUA capture,
screenshots or WindowServer failure. Do not remove negative oracles, raise bounds,
truncate detail, alter historical receipts or weaken certification predicates.

## CONTRACT / SHAPES

MAP: Outcome is a complete bounded note/discussion choice. Truth remains the
existing immutable prepared models. Main currently sends up to32k note text to
an unbounded native alert; the hypothesis is that reusing the delivered adapter
eliminates this remaining growth path. The note's final display string, including
headers and suffix, must fit32000 UTF-16 units before calling the adapter.
Oversized input refuses with NOTE_RETURN_PREVIEW_BUDGET without any choice effect.
Counts, identities, text, font, language, links, media, table descriptions and
deletion-history wording remain exact. A choice returns a boolean and does not
authorize any writer; existing Apply revalidates capability/lifecycle/project,
entity, revision, generation, source state and lease before atomic persistence.

FEATURE_INTEGRATION_MANIFEST_V1:

```text
featureId: word.return.confirmation
featureVersion: 1
domainOwner: existing Product Core prepared note and discussion delta
authoritativeData: canonical note/document/discussion models and saved project
derivedData: existing immutable complete display text
commandIds: existing cmd.project.notes.update and comment return commands
eventTypes: CHOICE_ONLY_NO_NEW_DOMAIN_EVENT
queryIds: existing prepared changes projection; no new query
productProjectionIds: prepared note and discussion changes
capabilityIds: unchanged existing authenticated Word return capability
authorityMap: Core owns semantics; Kernel owns Apply; adapter owns choice only
identityKeys: project entity revision generation lifecycle lease; captured adapter parent child session frame nonce
revisionPolicy: existing Apply revalidation after asynchronous choice
writePath: existing canonical command and leased atomic writer; untouched
readPath: prepared immutable delta to complete bounded detail to existing adapter
requiredProductPorts: existing Word return choice through confirmWordReturn
requiredDesignOsPorts: existing read-only prepared delta projection
adapterRequirements: unchanged qualified wordReturnConfirmation.cjs
surfaceManifests: existing word.return.confirmation.modal; no new surface
slotRequirements: existing main-owned confirmation effect slot
supportedWorkspaces: existing WRITE and REVIEW
platformAvailability: existing Electron desktop; missing parent cancels
accessibilityRequirements: existing named scroll region, persistent44pt buttons, Cancel initial focus, Tab Enter Escape
fallbacks: boolean false on unavailable adapter or parent failure; no native long-alert fallback
stateClasses: DERIVED_STATE display; TRANSIENT_STATE choice; product and authoring state untouched
persistenceClass: CHOICE_ONLY_NO_PERSISTENCE
migrations: NO_SCHEMA_CHANGE
recovery: cancellation preserves state; existing atomic Apply recovery unchanged
rollback: revert this single wiring chain; no data migration
performanceBudget: final detail32000 UTF-16; title256; message1024; unchanged outer760x640 maximum
securityBoundary: unchanged escaped display, CSP, sandbox, private one-shot protocol; no path or command authority from choice
lifecycle: unchanged owned adapter lifecycle and cleanup
negativeBypassChecks: oversized before adapter, unavailable parent, nonboolean response, Cancel no-write, stale revalidation and no native fallback
evidenceBindings: whole note runtime, note table description, comment Apply and unchanged adapter contracts; required whole RTK baseline CI and merged proof
currentReality: call sites implemented;120of120 focused assertions and6of6 hidden native cases executed; mandatory frozen delivery and whole novel open
integrationMode: EXISTING_SEAM
```

Protected state: owner checkout, old prepared worktree and previous synthetic
native profiles remain unchanged. No old crash scenario is a required oracle.
This task does not issue a new R24 StageAdmissionV2 stage. OPS companions bind
only exact current bytes and inventory, with all historical meanings preserved.

## IMPLEMENTATION_STEPS

Root owns contract, admission, OPS companions, acceptance and full delivery.
The separate code writer owns only Main's two confirmation functions and the
three affected call-site test files. Reuse confirmWordReturn without changing
its source, surface or labels. Compute complete final note detail once and bound
it before invoking the adapter. Preserve comment deletion and reply history
wording. Update mocks to the actual boolean port; explicitly forbid old native
fallback, preserve all semantic assertions and add final-header budget edges.
Existing helper guards and actual Main writer oracles remain mandatory.

## CHECKS

CHECK_01_PRE_ADMISSION: CHECK_01 выполняется ДО любых изменений; CHECK_02+
выполняются ПОСЛЕ. Exact clean base, registry, verified encrypted unlocked
writable T7 UUID, bootstrap, full ordered reads and16-path preflight before first
repository write. E0 validates this contract before runtime code execution.
CHECK_02_POST_FOCUSED: complete display, header/suffix budget edge, false/true
choice, unavailable parent and native fallback refusal.
CHECK_03_POST_AFFECTED: whole note runtime/table/comment Apply plus adapter and
pending/multi-scene Main chains; no skip/todo accepted as coverage.
CHECK_04_POST_SAFE_NATIVE: isolated helper-only hidden Electron native keyboard
proof with hardware acceleration disabled; no old project, Word, AX/CUA/capture.
CHECK_05_POST_DELIVERY: mandatory RTK, baseline, exact OPS, security audit, OSS,
guardrails, scope/diff review, commit, push, PR, required CI, merge and clean exact
merged-head revalidation. Heavy local lanes run serially.

Executed candidate evidence: note runtime24of24, note tables14of14, comment
Apply19of19, unchanged adapter57of57, selected pending Main4of4 and mixed-book
Main2of2; zero fail, skip or todo. Independent hidden Electron41.10.6 executes
both actual Main confirmation functions with the unchanged real adapter:
Cancel false, Apply true and Escape false for each route,6of6. Complete note
detail22506 and comment detail369 UTF-16 units are exact in DOM; outer760x640,
scroll and persistent footer are checked. Hardware acceleration is disabled;
no Yalken project, Word, old profile, AX/CUA or capture is involved. The first
driver import failed before window creation and was corrected; its log is
retained. These observations cover choice effects only. Mandatory frozen
whole gates and Git delivery remain pending; full novel acceptance stays open.

## STOP_CONDITION

Stop on ambiguous authority, unrelated dirty work, source guard bypass, semantic
loss, native fallback, unsafe geometry, failed mandatory proof or delivery drift.
No next write contour until this chain closes. Whole novel remains an active goal.

## REPORT_FORMAT

One text block KEY: VALUE with exact SHAs, basenames, scope, executed test
numerator/denominator, skips, Git delivery, residual limits and one next step.

## FAIL_PROTOCOL

After three identical failures retain input hashes, exact HEAD, expected/actual
and one next hypothesis. No swallowed failure or self-PASS. Revert one coherent
chain if needed, preserving all saved state and existing immutable evidence.
