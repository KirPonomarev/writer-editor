# Mac novel: bounded Word return confirmation

TYPE: UI
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true
STATUS: IMPLEMENTATION_CANDIDATE
DOCUMENT_CLASS: TASK_CONTRACT
CLAIM_BOUNDARY: bounded confirmation repair only; native acceptance and delivery remain open.

Task: `WORD_NOVEL_NATIVE_PREVIEW_MAC_20261006`.
Binding base: `7e8f878c203b261e7b93abda93781df84748eadb`.
Stage: IMPLEMENTATION; no delivered acceptance claim.

## MICRO_GOAL

Provide one bounded, complete and fail-closed confirmation for prepared Word returns.

### Observed failure

A fresh, synthetic ten-scene project contains 1,000 paragraphs, 104,777
independently counted letter words, and 200 discussions with 400 messages.
Normal packaged Mac Yalken exported the whole project; actual Microsoft Word
opened 105,777 words on 225 pages. Word saved all paragraph text and discussion
message bodies unchanged. Word renumbered all 400 comment identifiers and
materialized inherited font, language and paragraph properties. Their semantic
equivalence to unspecified canonical properties is not established.

In a separate Word copy, Track Changes recorded three real insertions in
scenes 1, 5 and 10. Native intake refused with
`PENDING_RETURN_PREVIEW_BUDGET`. The exact input SHA-256 is
`82a9d7a55cf535e47ad5e346f3056668dbac81555f3b27d1920bc6a33fb2953b`.
All 23 protected project files remained byte-identical; no Apply occurred.

The existing native confirmation serializes full changed paragraphs,
Original/Current projections, and both full discussion bodies before enforcing
its 32,000-character bound. The genuine return also carries Word's inherited
format changes, so a small text edit can produce an enormous presentation.
Main-thread V8 activity and an accessibility timeout were observed; the
sampling trace does not establish a JavaScript CPU hotspot or worker timing.

The prepared exact-grouping repair reached the 32,000-character budget, but
native `showMessageBox` still created a 448 by 9,566 point window. WindowServer
crashed during accessibility capture. A character budget is therefore not a
geometry budget. SAFETY_HOLD: do not replay that native alert, launch the old
reproducer, or use AX/CUA/screenshots to inspect it. This continuation uses
focused Node contract tests; any later native acceptance must first qualify
the bounded replacement geometry and respect the safety hold.

The first fake-event contracts passed, but independent hidden Chromium proof
showed that native GET forms to `about:` did not navigate. Those mocks did not
prove the real button transport. A clean exact-base peer preflight admitted
the same-scope fixed CSP-hashed choice-handler amendment; current E0 passed
before that script edit. This does not repair the original E0 ordering error.
The fixed trusted handler ran, but query/fragment `about:blank` navigations
did not produce the cancellable Electron will events. A second clean-peer
preflight and current E0 precede the private local-protocol amendment. The
independent prototype reached actual Cancel=false and Apply=true with owned
frame/initiator and bounded complete text; exact final adapter proof remains
pending, and the prototype is not delivered runtime evidence.
Root subsequently observed real Cancel=false and Apply=true on the exact
production helper, with all 26,813 preview units preserved, 760 by 640 outer
geometry, visible footer and matching script hashes. Maximum-size and keyboard
qualification plus delivery remain root-owned checks; no full novel acceptance
is inferred. Root records the task-local NONE+reason manifest marker exception
in ARCH_DIFF_LOG; the E0 rule remains strict elsewhere. Other legacy note and
comment native dialogs are separate OPEN contours, outside this pending-return repair.

## ARTIFACT

Existing exact grouped delta and one secure platform confirmation adapter with
focused semantic and safety contracts. The former prepared worktree is preserved.

## ALLOWLIST

- `src/main.js`
- `src/main/wordReturnConfirmation.cjs`
- `test/contracts/rtk-word-pending-return-runtime.contract.test.js`
- `test/contracts/rtk-word-return-confirmation.contract.test.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `test/contracts/rtk-word-pending-rich-blocks.contract.test.js`
- `test/contracts/rtk-word-comment-return-apply.contract.test.js`
- `docs/tasks/2026-10-06--word-novel-native-preview-mac.md`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `scripts/ops-gate.mjs`
- `docs/ARCH_DIFF_LOG.md`
- `docs/CONTEXT.md`
- `docs/HANDOFF.md`
- `docs/WORKLOG.md`

## DENYLIST

No Core/parser/storage/capability changes, renderer or preload changes, new IPC,
dependencies, runtime network, old native alert reproduction, AX/CUA capture,
Word/project launches or expanded novel acceptance claim.

## CONTRACT / SHAPES

### MAP

- Outcome: this exact genuine Word return reaches an honest bounded
  confirmation; Cancel preserves the project, and explicit Apply follows the
  existing atomic Command Kernel path.
- Truth: prepared immutable Core documents, revision ledgers and discussions;
  native presentation creates no mutation authority.
- Hypothesis: exact grouping can keep the full semantic delta within the
  existing character budget; fixed window geometry and a scrollable body must
  independently keep its physical presentation bounded. Grouping alone did
  not make the former native dialog safe. Actual text, changed values and
  identities remain visible without truncation or semantic normalization.
- Boundary: no Core admission, export defaults, parser, renderer, capability,
  identity guard, persistence, worker limit or dependency changes. The seed and
  actual Word inputs remain unchanged.
- Proof: focused semantic, geometry and refusal tests with fake BrowserWindow
  events first. Native confirmation/Cancel/Apply and independent raw readback
  remain a separate unexecuted acceptance gate after bounded geometry review.
- Identity: exact base above; isolated `codex/word-novel-native-preview-mac-20261006`
  evidence branch remains preserved; continuation branch is
  `codex/word-novel-safe-confirmation-20261006`; fresh owned project
  `project-f807fdb4-a8e4-434d-bdc1-aa818822fdb9`.

### FEATURE_INTEGRATION_MANIFEST_V1

```text
featureId: word.return.confirmation
featureVersion: 1
integrationMode: EXISTING_SEAM; explicit BrowserWindow adapter for existing confirmation effect
domainOwner: existing Product Core Word prepared-return model
authoritativeData: immutable prepared scene documents, ledgers and discussion graph
derivedData: complete bounded semantic delta text
commandIds: existing cmd.project.review.decidePendingRevision Apply route; no new command
eventTypes: NONE; confirmation creates no domain event
queryIds: existing prepared return projection; no new query
productProjectionIds: preparedPendingReturn.changes
capabilityIds: existing Word pending-return Apply capability
authorityMap: Core owns meaning; Kernel owns Apply; adapter owns presentation and boolean choice
identityKeys: captured parent, child, webContents, private session, main frame, source URL and random one-shot nonce
revisionPolicy: existing Apply revalidates lifecycle, project, scene, revision and generation after confirmation
writePath: unchanged prepared.apply through existing Kernel and atomic writer
readPath: prepared changes to exact delta text to escaped adapter HTML
requiredProductPorts: existing local Word pending-return confirmation effect; ephemeral session-local word-return-choice rejection port
requiredDesignOsPorts: read-only prepared delta projection
adapterRequirements: bounded modal BrowserWindow; one fixed CSP-hashed trusted choice handler; sandboxed; fail-closed boolean
surfaceManifests: word.return.confirmation.modal
slotRequirements: existing main-owned confirmation effect slot; no product renderer DOM insertion
supportedWorkspaces: existing WRITE and REVIEW return flow
platformAvailability: existing desktop Electron; unavailable adapter cancels
accessibilityRequirements: named dialog and scroll region, persistent named buttons, Cancel autofocus, Tab and Enter, Escape cancel, visible focus
fallbacks: cancel on invalid input, unavailable geometry, closed parent, load/process failure or invalid navigation; no native long-alert fallback
stateClasses: DERIVED_STATE projection; TRANSIENT_STATE modal, focus and response
persistenceClass: NONE; confirmation never persists state
migrations: NONE; no schema or storage change
recovery: close and failed adapter cancel; prepared Apply remains separately guarded
rollback: revert single repair chain; no project migration
performanceBudget: title 256 and message 1024 UTF-16 units; detail 32000 units; outer window at most 760 by 640 points
securityBoundary: escaped input; fixed choice-script and style hashes in CSP; no executable payload, Node, preload, IPC, eval, network, redirect, new window or webview
lifecycle: load hidden; verify source; show; settle exactly once; destroy owned child, then release private protocol and parent listeners
negativeBypassChecks: untrusted submit, forged nonce, response, frame, initiator, source URL, session/child identity, protocol registration/fallback, unexpected navigation, duplicate response, failure and cancellation cannot confirm
evidenceBindings: focused adapter contracts plus existing grouped semantic and actual Main Apply safety contracts
currentReality: candidate implementation; isolated exact-helper Cancel/Apply observed by root; full novel and delivery acceptance remain open
```

### SURFACE_MANIFEST_V1

```text
surfaceId: word.return.confirmation.modal
surfaceKind: platform confirmation dialog
featureId: word.return.confirmation
allowedPostures: existing desktop modal confirmation
allowedTransforms: NONE; no scaling, animation or content-driven window growth
slotMap: existing main-owned confirmation effect slot
platformAvailability: desktop Electron BrowserWindow adapter
fallbackSurface: cancellation; never the unsafe former native alert
designBindings: Yalken canvas f8f5ef, card fffdf8, ink 6d6861; accessible darker button ink; native system font
projectionAdapter: wordReturnConfirmation.cjs consumes complete immutable display text
inputIntents: Cancel or Apply only
commandRepresentations: Apply signals intent to existing prepared.apply; visibility is not authority
contextRequirements: live captured parent, owned child and private session; loaded exact document; one-shot nonce
readProjectionIds: preparedPendingReturn.changes semantic delta
stateOwnership: adapter transient window/focus/choice; no project or authoring state
interactionStates: loading, ready, confirmed, cancelled; all failure paths cancelled
accessibilityContract: Cancel initial focus; native Tab and Enter; Escape; named dialog; keyboard-scrollable full detail; visible focus; buttons at least 44 points high
responsiveContract: fixed outer 760 by 640 maximum; clamp to display workarea with 16-point margin; insufficient area cancels; header/body scroll independently and footer persists
performanceClass: bounded confirmation effect outside typing hot path
evidenceBindings: focused fake BrowserWindow geometry, escaping, lifecycle, navigation, keyboard and full-text tests; root isolated exact-helper full-text and geometry proof; maximum-size and keyboard qualification pending
```

## IMPLEMENTATION_STEPS


The runtime writer may change only `main.js`, `wordReturnConfirmation.cjs`,
`rtk-word-pending-return-runtime.contract.test.js`,
`rtk-word-return-confirmation.contract.test.js` and this task contract. Root
owns the separately declared mandatory inventory, hash, catalog and delivery
companions. The prepared three-file bytes are copied exactly before repair;
the original worktree is untouched. The data projection may group only exact
before/after property meanings, retaining all scene/thread identities,
affected ranges, counts, genuine text deltas and revision provenance.
Large ungroupable semantic changes must still refuse before dialog or writer.
No blanket truncation, skipped category, raised bound or synthetic success.
Small and legacy complete previews remain covered and use the same bounded
adapter. No prepared pending return falls back to the unbounded native alert.

The existing confirmation effect gets one explicit platform adapter. Its
fixed 760 by 640 outer window is clamped inside the selected display work area;
very small or unavailable work areas cancel. The full escaped text sits in a
scroll region with `min-height: 0`, wrapping even long tokens; Cancel and Apply
remain outside it. Cancel has initial focus. Native form controls support Tab
and Enter; Escape and every close/failure path cancel. There is no motion.

The adapter has no Node, preload, IPC or product writer. Context isolation,
sandbox and strict CSP apply. One fixed, internally authored choice handler
is allowed only by its CSP hash; no document content is interpolated into
executable source. It prevents every native form default, accepts only a trusted
Cancel or Apply submission and requests a private nonce-bound
`word-return-choice` local response. Native form fallback is blocked by CSP; no
response has a network target or OS protocol launch. The child owns one
nonpersistent session-local rejecting protocol handler, installed before load
and released after child destruction; it always cancels if interception is
missed. Session identity is part of the guard. No global protocol is registered. `will-frame-navigate` prevents every navigation before
validating the owned window/webContents, exact main frame and initiator,
loaded source URL and exact one-shot nonce-bound response. Exact main-frame
choice start events are observations only, because Electron emits them before
the will event; unexpected starts or completed navigations cancel. Redirects, new
windows and webviews are blocked. The result is only a boolean; the existing
Apply Kernel capability, lifecycle, scene/revision/generation, lease and
atomic publication checks remain the mutation authority.

DESIGN_TOOL_ROUTER: APPLIED
DESIGN_SOURCE_OF_TRUTH: owner-authorized bounded confirmation repair; existing Yalken palette and native system font.
DESIGN_RESEARCH_SOURCES: Lazyweb dialog patterns inspected by root; ui-craft; existing Design OS guide and tool matrix.
DESIGN_SELECTED_DIRECTION: fixed scrollable content with persistent Cancel and Apply; no external style copied.
DESIGN_AUDIT_TOOLS: focused Node geometry, security, full-text and keyboard contract tests; native visual acceptance pending.
DESIGN_TOOL_DEVIATIONS: native AX, CUA and screenshot execution prohibited by observed WindowServer failure and safety hold.

## CHECKS

CHECK_01_PRE_ADMISSION: Exact clean base, registry and secure mount identity,
bootstrap and full canon reads, UI discovery, declared full write set and clean
architecture preflight. E0 was missed before runtime edit, then failed with
Missing TYPE; this ordering exception is recorded, never retroactive admission.
CHECK_02_POST_TASK_SHAPE: Current E0 task-shape validation before acceptance and publication.
CHECK_03_POST_ADAPTER: Focused Node bounds, full escaping, geometry, native-control
markup, lifecycle and forged navigation contracts; no old alert reproduction.
CHECK_04_POST_SEMANTICS: Existing full semantic assertions, genuine insertions,
comments, identities, ranges, refusal before adapter and no-write cancellation.
CHECK_05_POST_SAFE_CHROMIUM: Independent isolated small hidden Electron adapter
form-submission proof with hardware acceleration disabled; no project, Word,
old native alert, AX, CUA or screenshot. This cannot certify the full novel flow.
CHECK_06_POST_DELIVERY: Required affected-chain and baseline gates, RTK, OPS,
OSS policy, dependency audit, guardrails, scope and diff review, commit, push,
PR, CI, merge and clean exact merged-head verification. Original full Mac
acceptance remains open; no self-authored or skipped evidence becomes PASS.

## STOP_CONDITION

Stop on authority or scope ambiguity, unbounded geometry, semantic loss, unsafe
navigation, open blocking review or mandatory failed evidence. SAFETY_HOLD remains
in force. No new write contour before this delivery chain closes.

## REPORT_FORMAT

One text block with KEY: VALUE, exact identities, changed basenames, tests,
delivery outcomes, limits and next step; no slash paths or URLs.

## FAIL_PROTOCOL

After three identical failure signatures retain exact input, HEAD, expected and
actual result and one next hypothesis. Preserve pre-existing work and rollback
this single repair chain. No project migration or authority reset.


Required: focused negative and affected-chain checks; genuine native Mac
operation and byte readback; full RTK, required baseline and OPS; OSS policy,
dependency audit, guardrails, diff review; commit, push, PR, CI, merge; clean
exact merged-head verification. No new write contour until delivery closes.

Rollback: revert this bounded commit chain. No project migration or authority
reset is part of the change.

The original full Mac plan and its denominator remain unchanged. This repair
does not certify five complete novel exchanges, full novel acceptance, or a
percentage increase. Export default ownership and other original-plan gaps
remain separate work after this delivery chain closes.

### Root exact-adapter acceptance checkpoint

Root acceptance checkpoint2026-10-06: final helper0fab12a1399dcffbad810aa7e268cd541b73cff2e8118d5f586bed7179b9791a passed isolated hidden Electron41.10.6 with native Enter on Cancel, native Enter on Apply and native Escape: false,true,false. Full32000-unit hostile multiline text is byte-exact in DOM;760x640 outer bounds and persistent footer are verified in all3cases. Hardware acceleration was disabled; no Yalken project, Word import, old native alert, AX/CUA or screenshot ran. This qualifies only the fixed adapter, not the full novel journey. Whole adapter contracts57/57 pass with0skip/todo. Required broad gates and Git delivery remain pending. Current18-path clean-peer scope amendment precedes mandatory RTK catalog edit; the earlier17-path first-edit preflight remains historical, not retroactively relabeled.

RTK_CATALOG_COMPANION: new maintained contract added to required graph after clean exact-base18-path amendment; no discovery or denominator exclusion.

WHOLE_CHAIN_FAILURE_CHECKPOINT: first whole affected run passed 680 of 682 cases,
with two failures in actual Main mixed-book tests. Their fixture still observed
the old native message-box call while the production path had moved to the new
boolean confirmation effect; no request was captured. This run remains FAIL.
Clean exact-base19-path scope amendment and current E0 precede the fixture
repair. Observe the new adapter request and explicit boolean response while
retaining every no-write Cancel, semantic, atomic Apply, replay and Undo check.
No native fallback, disabled assertion or production authority change is allowed.

FULL_RTK_FAILURE_CHECKPOINT: frozen e83e23478c9e6213f0dd2a7e65cbb7df56965c68
passed3580 of3582 maintained cases with0skip/todo. One remaining rich-block
preview VM fixture omitted the new confirmation port. The admission contract's
custom Git adapter kept Node's default1MiB buffer, below the current1,672,503-byte
Main binding; the production verifier's bounded64MiB adapter admits the exact
candidate. This RTK run remains FAIL. Clean exact-base21-path preflight and
current E0 precede both fixture repairs. Retain all paragraph-leaf assertions;
use the production-equivalent bounded Git read and mutate every current
successor binding and guard, preserving mixed-byte and ancestry rejection.
The repository verifier predicates, runtime authority and source remain unchanged.
