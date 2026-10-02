# WORD_SCENE_SPLIT_MERGE_MAC_20261002

STATUS: TARGET_DECLARED_NOT_ACCEPTED
DOCUMENT_CLASS: TASK_CONTRACT
CLAIM_BOUNDARY: Explicit scene split and merge preserving the represented manuscript graph on macOS; remaining original-plan operations remain open.
BASE_SHA: a2a5ae6cbefffce13475a0f71a3de3252d9deac6
TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3

## MICRO_GOAL

O: Split the active saved rich scene before the selected root paragraph or heading;
merge it with the next canonical same-parent scene. Preserve text, rich nodes,
notes, comments, bookmarks, internal links and resource evidence; keep exact
structural Undo across a new process. Late old editor snapshots cannot overwrite
new partitions. Observe both SOURCE and PACKAGED routes and actual Word readback.

## ARTIFACT

Existing Core tree planner and v7 writer, Main coordinator, existing command
and editor surfaces, focused tests and required companion bindings.
FEATURE_INTEGRATION_MANIFEST_WORD_SCENE_SPLIT_MERGE_V1.json and
SURFACE_MANIFEST_WORD_SCENE_SPLIT_MERGE_V1.json bind this existing-seam extension.
External architecture-declaration.json passed clean pre-write preflight on base.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true.

## ALLOWLIST

- `src/core/project-tree-cohort-v1.mjs`
- `src/core/projectTreeIdentity.mjs`
- `src/core/project-transaction-v1.cjs`
- `src/main.js`
- `src/renderer/editor.js`
- `src/renderer/tiptap/index.js`
- `src/renderer/commands/projectCommands.mjs`
- `src/renderer/commands/capabilityPolicy.mjs`
- `src/core/entitlement-law-v1.cjs`
- `docs/OPS/CAPABILITIES_MATRIX.json`
- `src/runtime-governance/docs/OPS/CAPABILITIES_MATRIX.json`
- `src/renderer/editor.bundle.js`
- `src/preload.bundle.cjs`
- `test/contracts/rtk-word-project-tree-cohort.contract.test.js`
- `test/unit/project-tree-identity.test.mjs`
- `test/unit/r24-wp201-project-transaction.test.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `test/unit/project-tree-pathless-contract.test.js`
- `test/unit/sector-m-tiptap-runtime-bridge.test.js`
- `test/unit/r24-ent0-entitlement-law.test.js`
- `test/contracts/capability-command-coverage.contract.test.js`
- `test/contracts/rtk-word-pending-recording-runtime.contract.test.js`
- `test/contracts/rtk-word-user-bookmarks-runtime.contract.test.js`
- `test/contracts/rtk-word-local-image.contract.test.js`
- `test/contracts/rtk-word-comment-authoring.contract.test.js`
- `test/contracts/rtk-word-note-return-runtime.contract.test.js`
- `docs/tasks/2026-10-02--word-scene-split-merge-mac.md`
- `docs/OPS/RTK/FEATURE_INTEGRATION_MANIFEST_WORD_SCENE_SPLIT_MERGE_V1.json`
- `docs/OPS/RTK/SURFACE_MANIFEST_WORD_SCENE_SPLIT_MERGE_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`

- `scripts/ops-gate.mjs`
- `test/contracts/ops-gate-core-purity-exception.contract.test.js`

- `docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json`

- `src/export/docx/docxReviewPacketComments.js`
- `test/contracts/rtk-word-canonical-comment-reexport.contract.test.js`

- `src/export/docx/fullManuscriptDocxReviewPacketSource.js`
- `test/contracts/rtk-interop-word-manuscript.contract.test.js`
- `test/contracts/revision-bridge-docx-review-preview-session-command-surface.contract.test.js`
- `docs/ARCH_DIFF_LOG.md`

## DENYLIST

No new writer, registry, IPC channel, dependency, network, project schema or
broad refactor. No changes to owner checkout, HTML, CSS, toolbar geometry,
Atlas, Pulse, Google or general distribution. Do not convert safe refusal or
test counts into feature acceptance. No guessed project reconstruction from
Word headings, renderer-supplied fragments/paths or heuristic lost-anchor repair.

## CONTRACT / SHAPES

T: Canonical manifest and rich scenes plus annotation/resource state -> validated
Core partition plan -> existing command-authorized leased transaction -> exact
readback -> revision/session-bound tree and editor publication.
H: Current planner admits only rename/move/reorder/copy. Explicit partitions and
same-ID content publication can preserve the graph without copy/delete emulation.
Predicted observation: split then merge preserves combined content and ownership;
structural Undo in a new process restores exact beforeimages, while delayed old
Save after successful new-editor ACK writes nothing.
B: Original and unrelated graphs, provenance, resource bytes, backups, dirty
buffers, existing transaction recovery and text-history semantics stay protected.
I: Base above; branch codex/word-scene-split-merge-mac-20261002; synthetic native
profiles only; exact frozen runtime and Word artifact hashes recorded per run.

Commands: cmd.project.tree.splitScene and cmd.project.tree.mergeNextScene.
Split intent: projectId,nodeId,name,expectedTreeRevision,boundaryRootIndex,
expectedDocumentId,expectedGeneration,expectedTreeContentPublicationId.
Merge intent: same identity fields, without name or boundaryRootIndex.
Main resolves the adjacent sibling and all canonical paths independently.
Snapshot rootSplitBoundary is null or exact {boundaryRootIndex,position}; Main
validates raw keys and safe integers against actual rich doc and collapsed cut.

Core split topology: {sourceNodeId,sourceRelativePath,boundaryRootIndex,newRelativePath}.
Core merge topology: {leftNodeId,leftRelativePath,rightNodeId,rightRelativePath}.
Computed outputs: scenePartitions,scenePublications,createdNodeIds,removedNodeIds,
sceneReceiptSources. Original left ID survives; split creates right ID, merge
retires right. Existing same-parent filename permutations remain checked.
Do not encode one-to-many ownership as a one-to-one identity map.

Annotations retain identity and provenance with exact root/leaf/UTF16 mapping.
Unrepresentable crossing ranges/links, conflicting metadata and pending-history
composites refuse without writes and remain full-plan residuals. Cards have no
IDs: merge concatenates exact arrays including duplicates; split leaves scene
metadata/cards with original left and defaults the right. Split retains complete
validated original resource receipts; merge unions exact resource records or
refuses conflicts. No asset deletion. Ordinary changed Save invalidates older
structural Undo rather than discarding newer bytes.

Before releasing the tree commit queue, rotate the existing private authoring
session and install a target-content fence, including same-ID/path changes.
Do not clear dirty state prematurely. Every snapshot/save request retains its
original session across awaits and validates it at actual write. Acknowledging
the new editor cannot make an old queued request valid. Renderer replacement
requires exact prior buffer/context/epoch and no intervening edit/draft.
Reset only PM history using remove/reconfigure/restore of the original history
plugin; preserve other plugin state and update the view only with final state.

Explicit Save As may fork a refused old buffer from the current verified split,
merge or structural Undo beforeimage. recoveredCopy has an exact XOR between
legacy removedNodeId and sourceNodeId variants, with receipt,retainedPacket and
workingContent. Core selects original graph from the packet; fresh output IDs,
current partitions unchanged; continuation limited to8links and32MiB.

## IMPLEMENTATION_STEPS

1. Core, Main and UI agents implement their disjoint admitted files against the
agreed shapes. Root owns docs, matrices, generated build, native proof and delivery.
2. Exercise actual planner/writer, actual Main command route and real PM adapter
on one rich composite before native work; repair affected fixtures together.
3. SOURCE early split/merge, editing/save, structural Undo and restart; inspect
canonical graph independently. PACKAGED and Word readback on stable candidate.
4. Freeze product bytes, refresh all required exact companion bindings, run
mandatory baseline and CI once per unchanged candidate, then merge and verify.

Design router: APPLIED; declaration value APPLICABLE_LAZYWEB_FIRST.
Design source: existing Yalken tree context menu and node name dialog.
Prior Lazyweb-first search produced no relevant exact split/merge specimen;
no external visual claim is made. Existing brain references manuskript.md and
novelwriter.md contribute ideas only; no GPL code. ui-craft applies to touched
controls. Existing Design OS guide/matrix read; no new visual language.
Direction: “Разделить перед текущим абзацем…” and “Объединить со следующей сценой”
with a named next scene, existing keyboard/focus behavior and typed status.

## CHECKS

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
CHECK_01_PRE_ADMISSION: T7 UUID/encryption/unlocked/writable, clean exact merged predecessor,
bootstrap and required reads; preflight PASS before these contract files.
CHECK_02_POST_CORE: rich multi-root split/merge, repeated/empty/Unicode leaves,
annotation identity and exact text conservation, resources/cards/meta, immutable
plan revalidation, before/after journal faults, recovery and restart Undo.
CHECK_03_POST_CHAIN: actual Main command bridge and PM, same-ID replacement,
old snapshot/Save/autosave released AFTER new ACK, capability/project/tree drift,
late typing/drafts, recovery-copy wrong source/tamper/receipt/resource/target.
CHECK_04_POST_NATIVE: SOURCE and PACKAGED explicit split/merge, ordinary edits,
Save, structure Undo, process restart, full manuscript export through Word;
independent ZIP/canonical readback for content and annotations. Include source
originating from Word and current-scene exports in affected-chain regression.
CHECK_05_POST_DELIVERY: declared scope and diff review, affected fixtures and
all required companions before expensive validation; baseline, guardrails,
OSS policy/audit, frozen CI, exact merged clean verification. Skips excluded.

## STOP_CONDITION

Stop unsafe mutation on unknown ownership, canon/base/scope drift, stale private
context, unexplained bytes, invalid preflight or authoritative writer failure.
No new contour until this delivery completes. Refusals are never positive support.

## REPORT_FORMAT

One text block with KEY: VALUE, basenames only; task/base/candidate/merged SHA,
tests and exclusions, scope, commit/push/PR/CI/merge, native evidence, residuals
and one next user operation. Full P2d three-way local/returned merge remains
required after this package; this contract does not reduce the complete plan.

## FAIL_PROTOCOL

Retain exact expected/actual input, HEAD, build/profile and artifact hashes.
After three identical failures change the hypothesis before another run.
Repair one reproduced blocker with focused evidence; no silent fallback,
disabled checks or weakened writer/capability. Do not repeat unchanged heavy runs.


Admission repair: exact pre-existing lexical node:path import in the cohort planner
was missing from the existing pure-runtime import table. Admit that exact source
and line only; adversarial filesystem/process/mixed-effect cases stay rejected.
No runtime effect or new policy authority is granted.

Admission repair verified: original gate failed at cohort line1; the added focused
case reproduced that failure. Existing purity contract now passes44of44, no
skips/todos, including exact-source positives and other-source, filesystem,
process and mixed-line negatives. Task shape gate passes. This proves admission
classification only, not runtime or user acceptance.

Command-binding amendment: clean owned WIP checkpoint4994c2e6049a993c131d5c34aec04044f6c0560a
admits39paths including existing COMMAND_CAPABILITY_BINDING.json. Add only the
two declared command-to-capability pairs. Preflight PASS; original delivery base
remains a2a5ae6c. Checkpoint and focused tests are not native acceptance.

Late-new-partition recovery amendment: clean checkpointb34667a091622f485e77d78479c2fa25623da697
and39path preflight PASS. Existing recoveredCopy topology variant may carry
optional exact sourceImage:after. Absent means original beforeimage; after means
the selected publication after owner/path and receipt AFTER scene, notes,
comments and resource graph. Main selects via the private fence epoch. No
renderer application attestation enables ordinary Save. Both variants only
create a separate fresh-identity scene through existing writer; current partitions
remain unchanged. Recovery-copy continuation must bind previous sourceNodeId
and exact current receipt. Wrong source, epoch, receipt, resource and copied-graph
identity negatives required. This closes the original late-edit no-loss duty.

Native SOURCE01 diagnosis: split at root8 on the imported nine-root fixture
failed E_PROJECT_TRANSACTION_RESOURCE_READBACK before journal publication.
The import receipt retained the old canonical comment-file digest, while native
comment authoring had legitimately changed that file. Independent readback proved
the original scene, notes and comments unchanged after refusal.
Repair hypothesis: structural cohorts and their retained recovery may classify
only exact canonical notes/comments resources with a matching regenerated typed
entry and validated model as managed annotation state. Existing entry before/after
CAS remains mandatory; immutable import receipts and assets remain digest-bound.
New structural receipts retain noteState/commentState and exclude obsolete mutable
resource bindings. Exact Undo restores old receipt bytes; its following ordinary
Save may use that classification only from the verified current retained packet
with exact live scene, manifest and annotation afterimages. Historical
nonstructural packet regeneration stays byte-compatible. Predicted proof is native
split, ordinary Save and restart Undo plus stale-comment/note positives and
resource, annotation, basename, role and retained-packet tamper negatives.

Native SOURCE02: split, independent annotation conservation and structural Undo
in a new process succeeded; subsequent ordinary Save discharged the obsolete
annotation resource binding. Merge then refused locally before Main dispatch.
Diagnosis reproduced with the actual presentation adapter: menu nodes have a
presentation-only parentNodeId, but revalidation resolves a raw tree node without
that field. Find the next sibling from the current raw tree topology by nodeId,
without changing that tree or accepting renderer paths as authority. Regression
uses the actual adapter clone and command handler, including unchanged-revision
refresh and changed-sibling/revision refusal. Same existing UI scope and rollback.

SOURCE02 full-manuscript Review export closed its native Save dialog without an
artifact or visible refusal. Read-only route tracing confirms typed failure is
returned normally and discarded by the native menu caller, which only observes
thrown exceptions. Existing Main export command handlers must surface the typed
failure code through existing status/log channels while returning the unchanged
receipt. No paths, document text or arbitrary exception detail in that message;
cancel stays cancellation. This bounded observation repair enables an exact
diagnosis of the required split-to-Word route without relaxing export admission.

SOURCE03 merge preserved the complete graph, but its following Undo correctly
refused an unplanned backup file. The idle backup was byte-identical to the
committed merged scene and appeared17seconds after the retained packet. Main
seeded backup hashes only for recoverySnapshot entries, which structural merge
does not create. Seed the existing backup deduplication state from verified
committed structural scene afterimages, including verified restart rehydration;
retain backups for genuine changed buffers. No Core foreign-entry relaxation or
removal of the observed file. Predicted proof: merge, idle backup tick, restart
and Undo; changed-buffer backup and actual foreign-file refusal remain intact.

SOURCE04 full-manuscript export reproduces publication refusal on imported comment
ranges sharing paragraph0 start: [0,13] and [0,14]. Builder emits shorter range
start before outer start, causing crossing marker order despite nested canonical
anchors. Current parser and publication gate correctly reject that XML. Clean
owned checkpoint87af78085bfe68e312adcec4fd02144f11c0d1c0 and41path preflight
admit only the existing DOCX comment producer and its canonical re-export test.
Order outer starts before inner starts, inner ends before outer ends, and close
exact ties in reverse start order. Preserve canonical thread/reply order, adjacent
ranges and existing genuine-crossing or point-anchor refusal. Actual emitted XML,
parser and publication gate must agree before native export retry. No parser or
gate weakening; original delivery base remains a2a5ae6c.

SOURCE05 bounded observations: existing two-scene merged state reopened in a new
process; structural Undo restored the exact split graph after the idle interval.
Independent canonical readback confirms nine roots, seven user bookmarks, two
internal links, three comment threads with reply and one footnote. SOURCE04
previously passed the same Undo after its idle timer without process restart.
SOURCE05 full-manuscript native export now creates a29996byte DOCX, SHA256
4a45a5b300033e51b736d7eba089c4349ba75bcdee42cbdc6b314d0b1eb3eb25.
Independent ZIP readback finds the represented text, all seven user bookmarks,
two internal links, four comment messages and the footnote. Source runtime
3433file copy digest67015c20e2aa57571a00bc7d92d8521dab1690fe995137d770ebd410f30c7560.
Focused current Main89of89 and canonical comment16of16 pass without skips or
todos; these are bounded proofs, not full acceptance. Current candidate still
requires actual Word save and return, PACKAGED qualification, companion refresh,
mandatory stable-candidate checks and full delivery. No whole-plan percentage.

Native Word SOURCE05 SaveAs preserves all four comment bodies and literal ranges
but removes the reply paraIdParent, yielding four roots instead of three threads.
Independent ZIP and actual parser agree; full graph acceptance is FAIL. Root
cause hypothesis: reversed nested range closure also reversed embedded references,
placing a reply reference before its root. SOURCE06 keeps properly nested closing
markers and separately emits references in original canonical message order.
No parser or Apply relaxation. Literal marker-stack and reference-order checks
pass; native Word preservation remains unproven until its new saved file readback.

SOURCE06 Word SaveAs confirms all three threads, four messages, original reply
parent, resolved state, comment ranges, footnote and seven bookmark names. The
only intended text change is paragraph1 suffix SOURCE06_WORD_EDIT. One bookmark
uses the already-supported paragraph-end versus next-start Word representation.
The native DOCX return chooser then closes without activating a new session;
manual Comments shows the original canonical session. Keyboard confirmation
reproduces this, ruling out a mistaken mouse click. Do not repeat this route
until a new observation exists. Extend the existing Main bounded status/log
observation to the actual local DOCX activation result; preserve receipt, all
checks and success/cancel/pending behavior, expose only validated codes and
reasons. Same Main and existing actual-handler contract test scope.

Native SOURCE07 now reports RTK_RETURN_INTAKE_DOCUMENT_METADATA_MISMATCH.
Exact metadata validator isolates only the redundant core creation time; signed
custom project creation, other protected fields and digest remain exact. A
diagnostic artifact removing fractional seconds still gets a fresh creation date
on Word SaveAs, disproving both precision and same-export-minute workarounds.
Clean checkpointd334ad34c314cd1e3da38e11449184a8530b01e4 and45path preflight
admit the existing metadata validator, its two affected contracts and explicit
ARCH_DIFF_LOG amendment. After authenticated round verification only, Main may
classify a valid changed DOCX core creation timestamp as provider file metadata.
Signed project creation remains exact. All missing/malformed/duplicate/date-type
and identity/digest checks remain; default validator still refuses drift. Proof
must record expected/returned timestamps and coreMetadataPreserved:false, surfaced
in the existing read-only projection. No canonical metadata writes or full core
timestamp fidelity claim. Native return and unchanged protected graph are required.

SOURCE08 native return advances past metadata validation and refuses with
RTK_USER_BOOKMARK_RETURN_CONFLICT. Runtime source digest is
53d32fa6192b422b1d0fdccfd9182bc0466d37049b12d6c004e029195de529d2.
The actual SOURCE06 Word artifact is unchanged; all five protected canonical
files match the pre-Apply baseline byte-for-byte. No Apply or full-route success
is claimed. Trace the remaining actual input through bookmark analysis and the
general text return route before another native launch. Existing bookmark-only
analysis admits link-label edits, while this fixture contains an ordinary text
edit, unchanged bookmarks, comments and a footnote. Do not remove those features
or replace the intended edit to obtain a passing scenario.

Metadata/comment whole-file tests:59of60 pass, zero skips/todos. The remaining
failure is the expected stale Main hash in mandatory historical companion
bindings; refresh only after the product candidate is stable. The actual Main
activation contract separately exposed outdated test filesystem/round fixtures
and two pinned provider parser failures; these remain open, not green.

Checkpoint d1f99734 preserves the metadata repair and meaningful activation
fixture repairs. Whole activation suite now has32passes and5failures: three
legacy authenticated text returns are intercepted by the pending-only lane;
the two Google parser failures reproduce on exact delivery base a2a5ae6c.
Clean45path preflight admits a bounded applicability repair in existing Main:
baseline pending state or pendingReturnOnly always selects the pending lane;
the current single rich-scene route also stays there. Legacy text-only rounds
may continue through their existing exact route before any pending admission.
Never fall back after a validation failure, malformed rich baseline or stale
authority. Preserve the original end-to-end Apply assertions and add direct
no-downgrade counterexamples. No Google acceptance or whole-suite green claim.
