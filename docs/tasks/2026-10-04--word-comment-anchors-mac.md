# Mac Word point comments and edits inside anchors

TASK_ID: WORD_COMMENT_ANCHORS_MAC_20261004
STATUS: IMPLEMENTATION_IN_PROGRESS
TYPE: PRODUCT_UI
BASE_SHA: f5dd73ea86deeae90f563f517ac11ab5cfbaf4a5

## Observable outcome and authority

O: Create/import a point or single-paragraph range comment, edit text inside its anchor, Save/reopen, export to actual Mac Word, change anchored text, import the authenticated review and explicitly Apply while preserving thread/reply identity and exact text. Scene and comment state publish atomically, with Undo/recovery.
T: Original owner Mac plan P1-02/P1-03/P1-04 -> active canon -> existing editComment/Save/Apply commands -> Core validation -> existing transaction -> persisted source and read-only projection.
H: Current refusal comes from nonempty-only anchor validation and snapshot-only rebasing. Versioned point anchors and bounded source-bound edit intent replay let Core preserve occurrence identity without searching duplicate text. Word return uses authenticated IDs and marker coordinates in a combined private candidate.
B: Preserve all existing text, comment bodies/replies/status/IDs, unrelated scenes, source CAS, recovery and security. One reversible PR. Cross-paragraph/cross-scene topology remains explicit full-plan remainder, not a silently accepted flattening.
P: Early real SOURCE/PACKAGED point and inside-anchor route before heavy gates; focused stale/hostile/replay/recovery cases; actual renderer/Main tests; mandatory baseline, RTK, OSS/audit and CI; independent review; merge and exact merged checks.
I: Clean merged PR2075 base above; T7 UUID verified, encrypted/unlocked/writable; bootstrap and 41-path preflight passed before first edit. PR2075 delivery receipt and 324 merged checks retained externally.

## Native Word calibration before implementation

Actual Word at collapsed document-start automatically selected word Alpha. Deleting that selected word removed its comment and markers. Do not silently reinterpret deletion as retained point; preserve deleted content in canonical history/tombstone and support Undo.
A synthetic reference-only fixture derived from Word-authored bytes was opened in actual Word, edited elsewhere and saved. Word emitted adjacent start/end markers at offset5, retained the body, and subsequently moved both markers to6 after native insertion X at offset5. This proves native serialization and that insertion case, not native point-creation UI.
Artifacts are retained externally: NATIVE-comment-deletion-observation.json, CALIBRATION-point-before-boundary-insert.docx, CALIBRATION-point-affinity-observation.json. Exact generic parser refuses DOCX_GENERIC_COMMENT_ANCHOR while V2 semantic parser retains start=end=5. Existing exporter emits ends before starts at shared offsets, so true point events require explicit start/end/reference order.

## Architecture and bounded contract

Feature integration manifest is FEATURE_INTEGRATION_MANIFEST_WORD_COMMENT_ANCHORS_V1.json. Legacy nonempty ranges remain readable. New point semantics must be versioned; old readers must not silently erase anchors. Core validates paragraph owner, UTF16/grapheme bounds, exact source text and hashes. Point insertion affinity is explicit. Empty-string quote search is forbidden.
Renderer supplies bounded authoring splice intents, not resulting canonical anchors. Main binds existing project/scene/session/generation and source revision; Core replays intents, checks removed text and exact final document text/topology, and derives anchor changes. The existing project transaction independently validates the same plan and preserves atomic recovery. Renderer history must retain the identity needed for Undo/Redo; no new private storage or command bus.
Word return validates authenticated comment identity and parsed point/range coordinates, applies text and comment changes as one private candidate, and retains original source CAS. Invalid mixed changes fail before any publication.
Existing comment surface and design tokens are reused; collapsed selection gets explicit point context. Lazyweb reference c5e4ce16-ebcb-475c-8448-def4d6b4a2e4 and ui-craft consulted; references are design context, not semantic authority. No new visual surface or shell styling.

## Scope and ownership

Core agent owns Core comment model/replay, project transaction, Main, table leaf traversal and corresponding existing authoring/save/Main/table tests.
Parser agent owns generic intake, transport/non-text return, comment return delta, DOCX comment export and corresponding generic/export/return tests.
UI agent owns editor snapshot/transaction capture, existing comment command UI, and actual-renderer intent tests. Parent owns docs/OPS/generated bundle/native checks/delivery. No overlapping writers. Shared contract changes are coordinated before edits.

Exact admitted paths:
- `src/core/word-comment-authoring-v1.cjs`
- `src/core/word-comment-anchor-save-v1.cjs`
- `src/core/word-comment-body-v1.cjs`
- `src/core/word-comment-return-delta-v1.cjs`
- `src/core/project-transaction-v1.cjs`
- `src/io/documentTables.js`
- `src/io/revisionBridge/genericWordComments.mjs`
- `src/io/revisionBridge/reviewTransportPackageParserV2.mjs`
- `src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs`
- `src/io/revisionBridge/index.mjs`
- `src/export/docx/docxReviewPacketComments.js`
- `src/export/docx/fullManuscriptDocxReviewPacketSource.js`
- `src/main.js`
- `src/preload.js`
- `src/renderer/editor.js`
- `src/renderer/editor.bundle.js`
- `src/renderer/tiptap/index.js`
- `src/renderer/tiptap/documentCommentEditIntents.mjs`
- `src/renderer/commands/projectCommands.mjs`
- `src/renderer/commands/capabilityPolicy.mjs`
- `src/core/word-comment-edit-intents-v1.cjs`
- `src/renderer/tiptap/documentTables.mjs`
- `test/contracts/rtk-word-comment-anchor-save.contract.test.js`
- `test/contracts/rtk-word-comment-authoring.contract.test.js`
- `test/contracts/rtk-word-comment-return-delta.contract.test.js`
- `test/contracts/rtk-word-canonical-comment-reexport.contract.test.js`
- `test/contracts/rtk-word-generic-comments.contract.test.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `test/contracts/rtk-word-comment-edit-intents-renderer.contract.test.js`
- `test/contracts/rtk-word-comment-points.contract.test.js`
- `test/contracts/rtk-word-table-editor.contract.test.js`
- `docs/tasks/2026-10-04--word-comment-anchors-mac.md`
- `docs/OPS/RTK/FEATURE_INTEGRATION_MANIFEST_WORD_COMMENT_ANCHORS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`

## Required proof and delivery

Check point bounds, graphemes, shared-offset marker ordering, duplicate text, overlapping anchors, insertion at boundaries/interior, whole-anchor deletion/history, list continuations and cell ownership. Check stale session/scene/generation, incomplete replay, forged after-state, failed persistence and restart. Prove native creation, ordinary import/export, changed authenticated return and five alternating exchanges per build for the admitted route. Do not claim all P1-04 topology or whole-plan acceptance from this slice.
No new dependency or runtime network. No test skip, assertion weakening or generic acceptance fallback. Before broad gates freeze a native-working candidate. Repeated failure signature three times requires a recorded counterexample and a new hypothesis. Commit, push, PR, CI, merge and exact merged verification are mandatory.

## Native range-affinity calibration

Independent actual Word edits establish the bounded endpoint policy before implementation: Alpha range0..5 with interior INSIDE insertion at2 becomes AlINSIDEpha range0..11; END insertion exactly at11 leaves the range0..11; START insertion at0 shifts it to5..16. Thus these cases support range start-right/end-left and point-right affinity. Exact DOCX snapshots and raw marker offsets are retained in CALIBRATION-range-edit-observation.json. This does not infer cross-paragraph or arbitrary replacement behavior.

## Early implemented export against actual Word

Before broad gates, production exporter emitted two coincident points (one with reply) and ranges ending/starting at the same offset. Actual Word opened the file, accepted an unrelated text suffix and saved all five bodies, exact coordinates, reply-parent relationship, statuses and durable IDs. Independent raw XML receipt is EARLY-point-coincident-native-observation.json. Synthetic source origin is explicit; this is not native Yalken authoring or Apply acceptance.
The saved file exposed an integration error: physical XML marker spans straddled an adjacent range even though the point interval is empty. The semantic parser now exempts only same-paragraph zero-length points from crossing rejection; nonempty crossing remains guarded. The same Word-saved file then passes generic preview/import with four threads, two points, one reply and both exact ranges. The failure and repaired readback are retained separately.
Native full-anchor replacement Alpha to Beta also removes the Word comment, not just full deletion. Core tombstones the discussion for either full-cover edit and retains its content/history for explicit Undo. Calibration is CALIBRATION-range-full-replacement-observation.json.

## Early checkpoint, incomplete implementation

Owned parser/export checks pass80 with no skips; existing raw parser run has58 passes and one now-obsolete expectation that a valid reference-only point must be unanchored. Its exact test path requires the next clean preflight scope amendment; this run is not green. Renderer actual-editor7 and existing rich-comment14 checks pass. Core reports five focused cases including actual Main replacement/tombstone/Undo/Save and80 outside-anchor groups; a prior full local run had one missing new snapshot-helper stub, corrected but full rerun pending.
This checkpoint is for early SOURCE native observation, not delivery or feature acceptance. Remaining implementation: in-flight Save acknowledgment must checkpoint a saved prefix while retaining newer intents; covered-point deletion must tombstone as actual Word proved; bounded persisted history validation/compaction; table continuation/hard-break leaf ownership; combined authenticated text-plus-comment Apply through one atomic transaction. Native user route, final frozen gates and delivery remain pending.

## Checkpoint continuation admission

Clean af4614bd preflight passed with43 paths before resumed writes. Added rtk-parser01-namespace-atoms.contract.test.js to replace the obsolete valid-point refusal assertion with exact point acceptance and malformed-marker negatives. Added docxMinBuilder.js for coherent table-list continuation export; Core agent owns this file. Delivery base remains f5dd73ea. SOURCE01 uses an immutable af4614bd runtime copy, independently verified live; observations cannot certify later working-tree changes.

## Early actual SOURCE result at af4614bd

Actual UI imported the Word-saved coincident-point fixture with four threads and one reply. Boundary insertion X moved both points5to6, inside-range INSIDE insertion expanded Alpha to AlINSIDEpha and moved points6to12. Save, Undo, Save restored exact scene bytes, thread/message identities and anchors; raw persisted snapshots and seven explicit checks are retained in SOURCE01-edit-observation.json. Native collapsed-cursor authoring then created a fifth thread at offset20. Ordinary scene DOCX export opened in actual Word; Word smart-paste inserted a space plus Z and moved the point20to22, preserving all six message bodies. Raw before/after ZIP inspection is SOURCE01-native-point-word-observation.json. This is early SOURCE evidence only, not packaged or authenticated-return qualification. An initial handwritten offset expectation19 was corrected to the literal prefix length20 without product edits.

Parent independently ran the frozen renderer intent suite after hash-bound prefix acknowledgment repair:12 passed, zero failures/skips/todo. Combined Main integration and independent review remain in progress; no broad final gates have been run on this changing candidate.

## Second incomplete checkpoint

Actual Main combined unannotated-text plus comment-body Apply passes. Inside-anchor actual Main currently fails at the existing outer exact-text journal with RTK_COMMENT_REBASE_RANGE_CHANGED before atomic project publication. This is a reproduced integration defect, not accepted refusal. The next clean scope amendment must admit exactTextMinSafeWrite.mjs and exactTextApplyJournal.mjs to carry and independently validate the private combined plan through that existing journal; no additional writer or validation bypass. Code owners frozen before bundle and companion refresh. Parser independent review found no concrete bypass in the reviewed inner private proof, CAS and foreign-thread preservation; outer journal integration remains unproved.

Clean77ad82859 checkpoint amendment passed45-path preflight before admitting exactTextMinSafeWrite.mjs and exactTextApplyJournal.mjs to Core ownership. The private mixed-comment plan must be recomputed at outer journal preparation and verified against canonical after-bytes at commit/reconciliation. The project transaction remains the sole publisher. Original delivery base remains f5dd73ea.

Independent review reproduced stale local anchor history after an authenticated reanchor to another paragraph: the old return plan emitted unreadable COMMENT_HISTORY_INVALID state. Return delta now clears local restore history on authoritative anchor/status changes and validates the final graph. Actual local Save→export→return reanchor, unchanged-history preservation and remote resolve/delete versus local Undo are covered; focused return plus point suites45 passed without skips. Actual native-authored ordinary DOCX after Word editing was also parsed back with five threads, six exact bodies and point22.

## Mixed return candidate focused proof

Frozen Core authoring, anchor-save and table-editor suites:68 passed, zero failures/skips. Four actual whole-Main focused cases pass: text plus body, inside-anchor movement, stale comment bytes with no writes, and injected failure after inner publication followed by idempotent outer reconciliation. Fault case also rejects torn BEFORE/AFTER pairs, altered proof and mixed journal modes. No second comment writer was introduced. Logs comment-core-local-final.log and comment-mixed-final4b.log retain exact execution output. Remaining required checks include multirow partial selection, near64KiB boundary, table continuation/hardBreak export, affected full Main and final gates/native builds. Explicit limits: serialized private mixed plan128KiB under existing256KiB journal; retained32 destructive history groups with explicit expired-history refusal preserving draft. These limits are outstanding whole-plan work, not complete large-book or general Undo acceptance.

## Resumed integration repair before native freeze

At6b617 the first actual SOURCE authenticated Word exchange completed with one applied operation, five threads and six exact messages retained; inside-range insertion and point movement were checked against raw persisted state. Round2 reached preview but was not applied before the requested pause. Its original profile and hash-equal21-file Documents snapshot were retained; no authentication secret was copied. Later runtime changes require a fresh candidate observation, not inherited acceptance.

Actual Editor regressions exposed full and partial replacement followed by Save, continued typing in the same Undo group, another Save, then Undo/Redo. Core now advances the existing group's exact saved endpoint and retains the deleted quote in tombstone snapshots. Actual-editor14, anchor-save41 and authoring19 checks pass without skips. Legacy released V1/V2 remain readable; the earlier unreleased V3 tombstone-history shape is superseded. The retained native profile has no history entries. Table-list continuation now survives the Review source projection; an ordinary and Review raw-OOXML check confirms two numbered items, an unnumbered continuation, hard breaks and exact leaf ownership.

The previous128KiB private-plan bound rejected supported near64KiB comment graphs. The private proof now keeps only the paragraph ownership/text fields consumed by Core, while the signed authority map and full formatting candidate remain unchanged; projected and original comment results must match exactly. IO losslessly encodes large journal proofs with versioned Brotli, strict fields/base64/hash/length, bounded decompression and no trailing stream. Canonical comment state stays64KiB, decoded plan is bounded at2MiB, encoded envelope192KiB, and the outer journal remains256KiB. Existing plain journals remain readable. No new dependency, writer or semantic fallback was added.

Whole-Main checks cover actual Apply for1000 paragraphs and four distinct15500-byte messages, exact expected text and discussion state, success and injected post-publication failure, fresh-process recovery, repeated reconciliation, malformed envelopes and forged source/block proof. The final two large tests pass; the preceding seven-case run includes the unchanged small mixed/stale/torn-pair/partial-selection chain. Independent execution of the production projection retained an800853-byte plan and173376-byte envelope with byte-identical canonical result. This proves only the stated volume. Native SOURCE/PACKAGED completion, final mandatory gates and delivery remain pending;32 retained destructive history groups remain an explicit bounded limitation.

## Early composite ordinary-import repair

Clean802667c5 preflight passed47 paths, adding docxImportSafeCreate.js and its existing unit suite. SOURCE03 applied the retained signed round2 with five threads and six exact messages preserved. The next ordinary Word-saved table/list continuation import previewed successfully but safe-create failed before publication. Read-only reproduction identified DOCX_GENERIC_COMMENT_ANCHOR: presentation-text extraction trimmed leading/trailing hard breaks, contradicting exact comment paragraph hashes and offsets. Existing V3 state is valid. Reuse the existing Core paragraph law; prove actual safe-create preserves the three imported threads plus all five existing threads, exact continuation/range/point/reply, replay and malformed-anchor zero-write behavior. Native completion and delivery remain pending.
