# Atomic novel Word return with existing notes and discussions on macOS

TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true
TASK_ID: WORD_BOOK_PENDING_NOTES_MAC_20261006
STATUS: IMPLEMENTATION_CANDIDATE
DOCUMENT_CLASS: TASK_CONTRACT
BINDING_BASE_SHA: 5d0c5865280684bcd9ce287d138a9200c40eb054
DESIGN_TOOL_ROUTER: bound to validated pre-edit architecture declaration; existing UI contract unchanged
CLAIM_BOUNDARY: combined fixed-topology book insert/delete, complete discussions and unchanged existing foot/endnotes; original full novel release remains open.

## MICRO_GOAL

A signed multi-scene Word return changes pending inline text and the complete
canonical discussion graph while preserving all existing note identities,
kinds and full rich bodies. Only individually proven note source occurrences
move. Apply publishes scenes, notes, discussions and receipts in one existing
atomic project cohort. Preview and Cancel remain write-free.

Owner requests autonomous completion of the agreed macOS novel direction for
writer, editor and proofreader. Complex tables/floating objects remain later;
this contract does not remove other original acceptance requirements or infer
whole release readiness from a short composed fixture.

## ARTIFACT

One bounded vertical implementation in existing Main, pure Core plans and the
existing whole-book exporter, plus affected contracts and exact-byte OPS
companions. No new writer, runtime registry, dependency or visual surface.
The hypothesis is that closed full-book note binding, source-point derivation
and regenerated annotation cohort resolve the current composite refusal
without weakening source/graph/lease/semantic guards.

Diff budget:26 explicit paths; runtime at most900 added/deleted lines; behavior
tests at most1300 added/deleted lines; generated inventory and exact hash
companions may reflect complete serialization. No unrelated formatting/refactor.

## ALLOWLIST

- `src/main.js`
- `src/core/word-note-return-delta-v1.cjs`
- `src/core/word-pending-comment-return-v1.cjs`
- `src/core/word-comment-return-delta-v1.cjs`
- `src/core/project-tree-cohort-v1.mjs`
- `src/export/docx/fullManuscriptDocxReviewPacketSource.js`
- `src/export/docx/docxReviewPacketNotes.js`
- `src/export/docx/docxReviewPacketBuilder.js`
- `src/io/revisionBridge/index.mjs`
- `test/contracts/rtk-word-pending-notes.contract.test.js`
- `test/contracts/rtk-word-mixed-return.contract.test.js`
- `test/contracts/rtk-word-mixed-return-transaction.contract.test.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `test/contracts/rtk-word-comment-return-apply.contract.test.js`
- `test/contracts/rtk-interop-word-manuscript-promotion.contract.test.js`
- `docs/tasks/2026-10-06--word-book-pending-notes-mac.md`
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

No renderer, preload, shared modal, package/lockfile, dependency or runtime-network
changes. Parser changes are restricted to the existing note-only read-only
break-format projection and the authenticated closed-book inactive default-tab
predicate described in amendment03; generic import behavior
and unrelated document/story parsing remain unchanged. No style catalog, generic default engine, tracked
format/move/structural mixtures, media/bookmark/story admission expansion or
second storage writer. Preserve existing authored rich fields and schema3
no-notes route. Do not replay old native import, pending100k profiles, giant
alert, AX/CUA capture, screenshots, WindowServer or computer failure. Do not
weaken mandatory gates, historical certification predicates or negative oracles.
If an additional exact source seam is necessary, preserve a clean checkpoint
and validate a coherent scope amendment before editing that file.

## CONTRACT / SHAPES

O: first/last scenes receive independent returned insert/delete; a discussion in
an untouched middle scene receives its reply; existing foot/endnotes preserve
full identity/kind/body and proven Original/source/export/Current occurrences.
The middle scene and unrelated metadata remain byte-exact.
T: canonical project truth plus Main-owned authenticated local round/map ->
Kernel explicit Apply -> project lease publication -> existing regenerated
atomic tree cohort -> journal/readback/receipt. Word IDs/text are evidence only.
H: the current blanket notes refusal, old source-point copy and omitted producer
points prevent this composition. A strict complete bijection plus source mapping
allows it; duplicate/foreign/missing/moved/changed occurrences must still refuse.
B: all protected old WIP/profiles, canonical checkout, history/provenance, note
rich bodies, discussion messages/status/anchors, untouched sibling bytes,
manifest and source CAS stay protected. One coherent code rollback; retain any
schema4 journals and finish current recovery before downgrade.
P: earliest short actual Main + real atomic writer and safe native SOURCE/
PACKAGED routes, then all affected suites and mandatory stable gates. Never
accept generated DOCX cycles as five genuine changed Word exchanges.
I: exact base5d0c586, branch codex word-book-pending-notes mac20261006, T7 UUID
D1F2E2C1-3210-4A39-A4E0-0AA0AD5110E2; fresh isolated synthetic identities and
exact runtime/artifact/Word-build binding in external evidence.

Product plane owns scene ledgers, manuscript notes and discussion semantics.
Interface plane only consumes existing immutable prepared delta and submits
existing intent. No new UI state model, wording, slot or surface.

FEATURE_INTEGRATION_MANIFEST_V1:

```text
featureId: word.book.pending.notes.return
featureVersion: 1
domainOwner: existing Product Core scene ledger, manuscript notes and discussions
authoritativeData: saved scene envelopes, full note/discussion graphs, local signed export baseline
derivedData: bounded validated return proof and immutable preview
commandIds: existing cmd.rtk.review.applyCommentLifecycleReturn; existing pending decision commands
eventTypes: existing canonical project commit and projection invalidation; no new event bus
queryIds: existing saved project and immutable prepared return queries
productProjectionIds: existing mixed scenes/discussions projection and editor reload
capabilityIds: existing authenticated Word return and writable project capability
authorityMap: Core semantics; Kernel Apply; Main retained admission; lease and atomic port; UI intent only
identityKeys: project scene note message round artifact source revision generation lifecycle tree and lease
revisionPolicy: full source and graph CAS before preparation and asynchronous publication
writePath: Main admission -> Kernel -> withProjectLease publish -> commitProjectTransaction tree cohort -> regenerated semantic plan -> journal/readback/receipt
readPath: canonical source -> signed ordered map -> safe package parser -> pure complete note/scene/discussion binding -> existing immutable preview
requiredProductPorts: existing ReviewDocxPackagePort, ReviewParserPort, ReviewRoundStorePort, ProjectPersistencePort and RecoveryPort
requiredDesignOsPorts: existing read-only DomainProjectionPort/DiagnosticsPort and intent-only CommandDispatchPort
adapterRequirements: existing safe ZIP/XML parser and atomic project persistence; unchanged bounded choice adapter
surfaceManifests: existing confirmation and Comments/editor surfaces; no new zone
slotRequirements: existing host confirmation effect and editor publication slots
supportedWorkspaces: existing WRITE and REVIEW
platformAvailability: existing macOS source and WRITER_LOCAL_V1 packaged desktop routes
accessibilityRequirements: unchanged Cancel-first, Tab Enter Escape, named scroll area and persistent buttons
fallbacks: typed refusal on incomplete/ambiguous/stale/unsupported input; no legacy writer or giant alert fallback
stateClasses: PROJECT_STATE canonical; AUTHORING_WORKING_STATE must save first; DERIVED_STATE proof; TRANSIENT_STATE choice; shell unchanged
persistenceClass: existing atomic multi-file tree cohort; no separate note persistence
migrations: existing schemas preserved; closed proof schema4 only if needed, schema3 book preserved
recovery: existing journal regeneration and readable rollback; controlled owned Node interruptions only
rollback: one coherent PR revert; preserve saved files/receipts and complete current recovery before decoder downgrade
performanceBudget: existing package50MiB, proof8MiB, scene source32MiB and cohort bounds unchanged; no book analysis in typing hot path
securityBoundary: safe bounded external parse before interpretation; local authenticated note/scene identities; no external paths, commands, secrets or runtime network
lifecycle: existing active local round and one-use prepared admission; every async stage rechecks identity
authoringNoLoss: dirty/autosave/pending annotation snapshot refuses; no stale overwrite
hotPathBoundary: none of this analysis occurs on a keystroke
negativeBypassChecks: full graph/body/occurrence bijection, ambiguous mapping, forged proof/output, stale source/notes/comments/sibling/generation/round/lease, Cancel and replay
forbiddenAuthority: returned IDs, matching quotes, carrier digest, counts or caller after bytes cannot authorize writes
evidenceBindings: independent source/graph/occurrence expectations; provisional/final DOCX parse; actual Main and atomic writer; short genuine native both origins; affected and mandatory gates; exact merged proof
currentReality: standalone pending notes and mixed book text/comments delivered; composition and complete source-point preservation are target until observed
integrationMode: EXISTING_SEAM
```

Native note body comparison must cover paragraph spacing/mark language and
hardBreak properties as well as text/run marks/list/table meaning. Existing
lossy equivalentBody alone cannot prove a complete unchanged rich body. Keep
standalone behavior outside this contour; reject unknown meaning rather than
silently stripping it. Authenticated comment binding is checked against the
original canonical document before adding any new note points. The independent
comment planner must regenerate the same geometry from the validated context.

Global paragraph indices become scene-local only through ordered signed blocks.
Two deletion edges can share one Current offset and remain distinct source
occurrences. New canonical source points require verified mapping; neither old
points nor incoming offsets may be blindly copied after text changes.

### SCOPE_AMENDMENT_01 — same closed book-note contour

AMENDMENT_CHECKPOINT_SHA: e714e9b17b0338ee8ce6b4cf200465c5289d6a93
AMENDMENT_PREFLIGHT: passed on clean exact checkpoint with25 explicit paths
AMENDMENT_AUTHORITY: existing owner autonomous full novel no-loss implementation;
no new stage, privilege, dependency, runtime network or delivery contour.

The exact initial real SOURCE export is34,460 bytes with artifact SHA256
5cd8115011c1bc82f5455255d3e7b1db748fba3c162efc8e8e9982569a1be6f2.
It references FootnoteText, EndnoteText, FootnoteReference and EndnoteReference,
while styles.xml declares only the two code styles. The independent full-note
style observer refuses the missing style. Notes emission must supply only its
self-contained required definitions, without undeclared base/link inheritance,
a named product style catalog or changes to global defaults/no-notes output.

An independently changed actual ZIP note break adds bold/red run properties.
Mutant SHA256461f55241914e42889c266bc024ffe1912a99f683bf74accb55024883af04a5e
still produces exactly equal parsed complete rich note bodies. Thus previous
whole-body comparison is incomplete. The narrow parser seam must retain a
bounded read-only effective break-format/occurrence projection before lossy
canonical conversion. The existing owned book comparator independently checks
it against the complete authenticated local emitted expectation, including
paragraph and UTF16 occurrence identity. Missing, duplicate, moved, unknown or
changed meaning refuses. Returned bytes never define expected defaults.

The only current note default explicitly emitted is12pt. No Times New Roman,
en-US, paragraph language propagation or unowned Word default may be invented.
Canonical note body grammar and stored bodies stay unchanged. Any transport
baseline is note-only, closed, versioned and derived from local canonical input
plus explicitly owned emission; no generic default engine, Core-to-export
circular dependency, new storage writer or caller-supplied after authority.

Required amendment proof: actual ZIP bold/color/font/language break corruption
must be observable and refused; closed baseline/returned projection is complete
and source-bound; emitted note style IDs resolve; authored Georgia14/bold/ru-RU,
spacing0/120, hardBreak, text and every note identity/reference remain preserved.
Normal no-notes export and prior standalone no-notes/notes semantics remain
within their prior contracts. Forged, omitted and stale projection must refuse.

The early native diagnostic is not acceptance: no Word edits or genuine changed
exchange executed. SOURCE child7876 exited normally(code0, no signal) through
exact-PID ordinary AppKit quit; all protected business bytes stayed exact. The
controller itself exited1 because its stopped flag did not observe external
normal quit. Word DOM read full text and all four note bodies; its owned saved
synthetic document is retained unchanged after native close API failures. No
computer/native failure replay, process crash, force quit, UI capture or foreign
document mutation occurred. System Events UI elements enabled=false; real
picker/keyboard acceptance remains a mandatory open gate, never skip/PASS.

### Amendment01 controlled proof checkpoint

Amendment01 writer HOLD13: final serial pinned Node22 suites pass108of108
(pending-notes22, mixed-return33, transaction45, selected actual Main8), with
zero fail/cancel/skip/todo. Independent fresh actual-Main DOCX XML observation
resolves all four emitted note style identities and reads the full ten-paragraph
book/four-note graph; this is controlled publication evidence, not genuine Word
exchange acceptance. Exact frozen13 source/test hashes are external. System
Events UI authorization is false; existing Hammerspoon authorization is true,
but three bounded exact-PID keyboard close requests had no observed effect.
That loop stopped. A separately resolved native Word DocClose command also
returned without closing the saved owned fixture; cause remains UNKNOWN.
No Word edit, TCC change, capture or force quit occurred. Native SOURCE/PACKAGED
changed-save/Cancel/Apply/restart proof and all release denominators remain open.
Next: exact companion freeze, whole affected suites and stable checkpoint,
then resolve native automation using changed evidence rather than blind replay.


### Amendment01 legacy and valid-plain source correction checkpoint

Final amendment01 correction HOLD13: final serial focused128of128 pass with
zero fail/cancel/skip/todo (Main28, notes22, mixed33, atomic transaction45).
The first mandatory whole Main is retained as FAIL251of266,15 failures; focused
green does not supersede that failed denominator. Its14 clean-book publication
regressions are corrected by selecting the composed gate from the authenticated
LOCAL schema2 pending binding. Valid plain source(version1, no envelope issue)
has a read-only paragraph projection only after rawSHA/identity validation in
Main and independent Core re-derivation. Untouched plain Beta stays byte-exact
through actual Main Apply/reopen/UndoRedo/second exchange; malformed typed input,
stale raw source and copied forged after refuse with precise domain codes and
full no-write evidence. Canonical rich note bodies/geometry and all guards remain.
Runtime413of900 and behavior373of1300; exact25-path aggregate scope. Fresh final
controlled public export04 and canonical expectations are immutable externally.
No Word edit, native changed exchange, capture, TCC change or new dependency.
Next required proof: fresh independent XML and whole Main/broader exact gates,
then safe native SOURCE/PACKAGED proof and full delivery; original novel release
and100k/five genuine Word exchanges remain OPEN.

### SCOPE_AMENDMENT_02 — current ordinary Apply successor evidence

AMENDMENT02_CHECKPOINT_SHA: ee28a3794917186c530a4e78e160dc11fbd83951
AMENDMENT02_PREFLIGHT: passed on clean exact checkpoint with26 explicit paths
AMENDMENT02_AUTHORITY: same owner-authorized atomic book-note contour; one
existing ordinary Apply corruption contract added, no runtime or UI expansion.

Exact-clean unmodified official RTK01 executed all236 files and3610 tests:
3609 pass,1 fail, zero cancel/skip/todo, original exit1, no signal, clean owned
process group and temporary leases. Failure is the ordinary Apply successor
contract hardcoding previous NOTES_SAFE_CONFIRMATION while the actual verifier
correctly selects current BOOK_PENDING_NOTES18 bindings. Its expected tuple must
use the current coherent cohort. The same contract becomes one of19 exact
bindings; every individual binding/policy corruption, mixed predecessor and
unrelated ancestry must still execute and throw its original typed guard.
No optional skip, relaxed matcher, altered production admission or self-PASS.

Whole Main271of271 and promotion37of37 passed on final source; earlier failed
Main251of266 and RTK3609of3610 remain immutable failed attempts. Fresh SOURCE02
and ordinary PACKAGED02 from ee28 publish34,855-byte ten-paragraph books. Root
independent seeded XML observations verify all full rich note bodies, Original/
Current text and reference geometry, pending metadata and discussion metadata/
bodies; all six protected business files stay byte-exact and both owned apps
exit normally(code0, no signal). These are export-only observations; no Word
edit, real chooser return or Apply ran. Word close/save automation remains
unresolved and native acceptance is OPEN. Draft PR2091 is pushed and attached;
merge and final delivery remain gated by native and remaining broad evidence.
Next: correct existing test binding, exact19-tuple companion freeze, clean
checkpoint, whole ordinary Apply and full mandatory graph/baseline/OPS/CI;
then complete safe genuine Word proof. Full novel denominator stays unchanged.

CI checkpoint02 retains two actual failures: strict governance rejects stale
cross-file approval bytes, and broad baseline stops at doctor exit1. The
committed primary PK1R1 has stale C2A and Interop100 rows; Interop100 also has
a stale primary back-reference. Preserve all approval/history records and
refresh in the existing delivered order C2A, Interop100, then primary PK1R1.
Every primary row must bind final actual bytes. The historical mutual
back-reference is not acceptance authority; neither evaluator nor strict gates
change. Do not claim both recursive registries are simultaneously current.
The separate writer changed only the successor constant; all19 ordinary Apply
tests pass provisionally with no skipped/todo cases and original13 hashes
unchanged. Root must freeze19 bindings and rerun the real committed candidate.

### SCOPE_AMENDMENT_03 — authenticated inactive tab with complete book notes

AMENDMENT03_CHECKPOINT_SHA: 196d56d2c4a70a80530055d10665f95662ae7cc4
AMENDMENT03_PREFLIGHT: passed on clean exact checkpoint with26 explicit paths
AMENDMENT03_AUTHORITY: same owner-authorized atomic book-note return; no new
delivery contour, UI, dependency, permission, runtime network or writer.

The owned Word lock was removed through exact cancellation of two known small
dialogs followed by normal saved-document close. Word removed its own owner
file. No force quit, lock-file deletion, permission change or failure replay.
One genuine changed Word Save As produced23334 bytes, artifact SHA256
338987b0e99088eba197d66748ed3ec8f7685f3a2a0bc96de136c5e880225aac.
Actual public SOURCE preview refused PENDING_COMMENT_DOCUMENT_FORMAT_CHANGED;
all six canonical business files stayed byte-exact. Full Current/Original body
and reference geometry match the independent pre-Word intent. Rich note
language/formatting differences remain unresolved and must continue to refuse.

Exact read-only reparse reproduces the first refusal: source-owned unconfigured
implicit default tab720 acquired an explicit708 after Word save, but foot/endnote XML makes the existing
inactive predicate refuse without their authenticated local baseline. Supply
complete baselineDocumentNotes only from the validated Main-owned active book
capsule, after signed note-digest/policy checks. Require the complete source
note roster/rich bodies and actual returned identities; inspect every source
body and returned Word XML part for active tab carriers. Missing, malformed,
foreign, duplicate or incomplete baseline/roster refuses. Note list/table
uncertainty and header/footer baselines remain unsupported by this predicate.
Explicit source settings, non708 returns and source/returned tabs still refuse.
The first comment-only format refusal may route to the complete book planner
only for multiple scenes with authenticated existing manuscript notes. This
does not admit note formatting in the comment-only publisher.
No changed language, font, spacing, break meaning or note graph is ignored;
the complete independent semantic planner and atomic publication guards remain.

Three old SOURCE04 public request timeouts are retained; that replay loop is
stopped. The actual bridge budget is120000ms. Operator/dialog acknowledgement
wait exceeded it; product latency is unproven. No timeout/preload/modal/UI repair
is admitted by this amendment. Zero full native Apply exchanges and zero
packaged changed exchanges are qualified in this resumed proof. CHECK05 and
the original100k/five-exchange/full novel acceptance remain OPEN.

### Amendment03 resume diagnostic checkpoint

The complete actual-Main suite on the owned amendment03 bytes passes272of272,
with zero failures, cancellations, skips or todo. Source bytes remain unchanged
during the run; log SHA256c7e531e81f7c925f3ed4d318d7c7eba430177a7d46571c91a7add48aa089d99e.
This controlled proof does not satisfy the native exchange gate.

Two fresh short real Word16.112 no-edit Save As controls preserve every note
text and the authored Georgia14/bold/ru-RU runs, while adding document-default
Times New Roman and ru-FI/ru-RU/ar-SA language properties, plus inherited
paragraph spacing. Original-style result SHA256
96c88fb1203b8b1171c375cec14726ebed314e3977690ffac805d719c9948451;
renamed-note-style result SHA256
9ad9fd059fc7844807b4e8ac330d0fe0355ad8cbb80faf673c5e73db284ee398.
Both source files remain exact; both owned Word documents close normally.
Renaming the four note styles therefore does not resolve the default ambiguity.
These are external diagnostic variants, not product changes or Apply evidence.
The prior changed artifact's authored ru-RU to en-US change remains a real
unresolved difference and must not be normalized away. A subsequent coherent
amendment must bind any additional note emission to an explicitly owned local
profile; returned defaults cannot define the expected canonical meaning.

### SCOPE_AMENDMENT_04 — locally pinned note emission, same atomic contour

AMENDMENT04_CHECKPOINT_SHA: 0bcf70b97a179453a03cedb07ebee09e2da586eb
AMENDMENT04_PREFLIGHT: passed on clean exact checkpoint with26 explicit paths
AMENDMENT04_AUTHORITY: existing owner autonomous full novel implementation;
same atomic contour, delivery chain, scope budget, ports and rollback.

The six precheckpoint RTK failures are retained:3606of3612 passed, zero skips.
Their complete six files pass66of66 on the actual clean0bcf70 checkpoint.
Dirty frozen scopes and committed-candidate hash selection explain those
failures; no test, oracle, allowlist or gate was disabled.

Fresh real Word16.112 style-owned control263c9ba8105bef677732d116363a7114e67b7a0af5d49eb2127d0be8b2b4a02f
saved asce957198e0ccc3acdd8543a91be1691baa50be34b9fbd18b7282c4efbc640b49
preserves all four complete typed note meanings, except Word omits before0.
The earlier per-run-only control is insufficient: Word removes break rPr and
the break inherits its paragraph style. This is diagnostic evidence, not Apply.

Version2 selection is local and restricted to multi-scene exports with existing
pending-comment bindings, the current complete atomic book proof. Other exports
keep their existing emission; a note-only delta cannot acquire transport defaults
from this unrelated planner or silently persist them into canonical note bodies.
For these newly emitted closed book notes, version2 explicitly owns only a finite
note-style transport profile: Times New Roman12pt, val/eastAsia/bidi en-US,
left alignment, spacing before0 after0 line240 auto, and unmarked text.
The font/size/language fallback matches existing local comment transport.
This is a declared local export choice, not an inferred canonical source font
or language. It supersedes amendment01's absence of additional owned defaults
only for this version2 note profile. Canonical saved bodies remain unchanged.
Source-authored run/paragraph properties override the emitted note style;
paragraph-mark language does not propagate into text or hardBreak runs.
Global defaults, no-notes output and standalone note emission remain unchanged.

Core independently reconstructs this exact closed profile from authenticated
local source and rejects missing/altered profile bytes. Complete note bodies
and every effective break retain strict comparison; returned values never
define expected defaults. Effective omitted zero spacing may compare equal
to zero; nonzero inherited spacing must remain visible and refuse. Keep the
legacy version1 baseline and its complete font/language/break corruption
negatives. The old artifact's authored ru-RU to en-US change still refuses.

No parser style catalog, generic defaults engine, Core-to-export dependency,
storage schema/writer, UI, dependency, proofing disable or global Word setting
is introduced. Required proof includes source-bound emitted profile, both note
kinds, actual ZIP default/style/run corruption, full rich-field preservation,
actual Main Cancel/Apply/reopen, standalone/no-notes regressions and genuine
SOURCE/PACKAGED changed exchanges. Original novel acceptance remains OPEN.

### Amendment04 controlled implementation checkpoint

The first note suite is retained as20of23 with three failures: the scene-local
old lossy comparator still rejected the new profile, and two historical v1
oracles expected the old emission. The scene-local v2 path now independently
rechecks the exact local profile, complete source body and every break before
using the complete comparator. The standalone path stays unchanged. Historical
v1 style and ZIP corruption oracles still execute with an explicit legacy fixture.

Final note suite passes24of24, zero failures/cancellations/skips/todo, log SHA256
747ef99bce62a29ca711e26bf3a7307dfaa4bb078f044fd328e7bda29c7f21e7.
New independent ZIP mutants cover changed document defaults, zero omission,
renamed styles, nonzero inherited spacing, every font/language slot and altered
local profile. Original canonical bodies remain unchanged.
Complete Main/mixed/atomic suites pass350of350, zero failures/cancellations/skips/todo,
log SHA256cca894fa699e4ddc38c26a40ecb775a687bf85bf6ca2a1af8b33222c43eafdcb.
Source bytes remain exact during both runs. These are controlled code proofs on
the owned0bcf70-based candidate; native exchanges, full RTK/baseline, CI, merge
and original novel release remain open. Fresh origin/main remains5d0c586.

## IMPLEMENTATION_STEPS

Root owns contract, declaration/E0, OPS, proof and full delivery. Separate code
writer owns only the original six runtime and four behavior-test paths plus
the three exact emitter/parser seams admitted by amendment01 below. Preserve original
schema3 full graph behavior. Add closed book note binding/proof, independently
derive note geometry in mixed planner and comment re-derivation, then apply
existing note-anchor plans cumulatively to one regenerated cohort. Whole-book
producer emits points and publication compares independently parsed Original,
export and full note roster/body meaning. No carrier/count-only publication.

Use three short synthetic scenes before large corpus. Independently alter
exported XML for insert/delete and discussion changes with exact source
occurrences predetermined. Exercise actual Main/Kernel/lease/atomic writer,
Cancel, Apply/reopen, existing per-scene accept/reject/Undo/Redo, second return
and reexport. Then genuine real Word changed-save and restart on both fresh
SOURCE and PACKAGED profiles, with independent saved-data/readback expectations.
These early routes do not certify the complete100k/five-exchange novel.

## CHECKS

CHECK_01_PRE_ADMISSION: CHECK_01 выполняется ДО любых изменений; CHECK_02+
выполняются ПОСЛЕ. Clean exact base, registry, verified T7, bootstrap, full
ordered reads and initial22-path preflight preceded the first file edit.
Amendment01 clean e714 checkpoint and25-path preflight precede its own edits;
E0 precedes runtime edits in both phases.
CHECK_02_POST_FOCUSED: both note kinds around insertion/deletion, repeated text,
Unicode/surrogates, co-located notes, global/local occurrence bijection, full rich
body preservation; missing/duplicate/foreign/moved/changed graph refuses.
CHECK_03_POST_ACTUAL: actual Main and atomic writer preserve all rich scenes,
IDs/provenance/history and full discussion/note graph; protected middle bytes;
Cancel/replay zero-write; stale notes/comments/sibling/generation/lease refuse.
CHECK_04_POST_RECOVERY: forged cohort output rejected; fresh owned Node journal
interruption/recovery and foreign-note conflict retain canonical and foreign
bytes. No native or computer failure scenario.
CHECK_05_POST_EARLY_NATIVE: safe fresh short real Word changed exchange through
SOURCE and ordinary PACKAGED, explicit Cancel/Apply, restart, decisions and
reexport with full content/graph checks; exact profiles and artifact hashes.
CHECK_06_POST_DELIVERY: affected whole suites; mandatory baseline/RTK/exact OPS,
audit/OSS/guardrails/scope review; commit/push/PR/required CI/merge; clean exact
merged revalidation. Heavy local lanes run serially. Skips/todo not coverage.

## STOP_CONDITION

Stop on ambiguous identity, protected dirty work, scope drift, insufficient
source/graph proof, silent semantic loss, authority bypass, missing mandatory
oracle or delivery drift. Preserve failed artifacts and actual outcomes. No new
write cluster until this delivery chain closes; full novel goal stays active.

## REPORT_FORMAT

Exactly one text KEY: VALUE block with task/before/after/merged SHA, basenames,
scope, executed test denominator and skips, commit/push/PR/CI/merge/exact-head,
open limits and one next step. No paths or URLs in that report.

## FAIL_PROTOCOL

After three identical signatures stop that loop, retain exact input/head/hashes
and expected/actual, then select one next evidence-backed hypothesis. No gate
weakening, self-PASS, swallowed errors, synthetic success or history pruning.
