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
- `test/contracts/rtk-parser01-namespace-atoms.contract.test.js`
- `src/export/docx/docxMinBuilder.js`
- `src/io/revisionBridge/exactTextMinSafeWrite.mjs`
- `src/io/revisionBridge/exactTextApplyJournal.mjs`
- `src/utils/docxImportSafeCreate.js`
- `test/unit/docx-import-safe-create.test.js`
- `src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs`
- `src/export/docx/fullManuscriptDocxReviewReturnRouter.js`
- `src/io/revisionBridge/reviewTransportFormattingReturnRuntime.mjs`
- `test/contracts/rtk-word-nested-tables.contract.test.js`
- `test/contracts/rtk-word-table-cell-lists.contract.test.js`

- `test/contracts/rtk-interop-100-denominator.contract.test.js`
- `test/contracts/rtk-word-local-image.contract.test.js`
- `test/contracts/rtk-word-pending-rich-blocks.contract.test.js`
- `test/contracts/rtk-word-review-default-typography.contract.test.js`
- `test/contracts/rtk-word-table-cell-shift.contract.test.js`
- `test/unit/project-tree-pathless-contract.test.js`
- `test/unit/r24-wp204-lifecycle-recovery-mutants.test.js`

## Required proof and delivery

Check point bounds, graphemes, shared-offset marker ordering, duplicate text, overlapping anchors, insertion at boundaries/interior, whole-anchor deletion/history, list continuations and cell ownership. Check stale session/scene/generation, incomplete replay, forged after-state, failed persistence and restart. Prove native creation, ordinary import/export, changed authenticated return and five alternating exchanges per build for the admitted route. Do not claim all P1-04 topology or whole-plan acceptance from this slice.
No new dependency or runtime network. No test skip, assertion weakening or generic acceptance fallback. Before broad gates freeze a native-working candidate. Repeated failure signature three times requires a recorded counterexample and a new hypothesis. Commit, push, PR, CI, merge and exact merged verification are mandatory.

## Current packet acceptance mapped to the original plan

Implementation, delivery and native acceptance are separate observations. This packet is implemented locally and PR2076 is unmerged; historical receipts below do not certify the final candidate.

| Original row | Promised operation and observable result | Required evidence and remaining qualification |
| --- | --- | --- |
| P1-02 | Insert/delete before, inside and after a single-paragraph range or point; preserve exact occurrence, affinity and foreign text/discussions after Save/reopen and Word return. Include table list continuation with literal edge hard breaks. | Actual renderer, Core and whole-Main tests cover the bounded operations; SOURCE07 proves retained table return and inside-range Save/reboot. Final SOURCE/PACKAGED changed cycles remain required. Cross-block and cross-scene edits remain outside this packet. |
| P1-03 | Create a point/range through the editor; ordinary import/export preserves root/reply bodies, IDs and coincident/overlapping supported anchors. | Point/export/generic/authoring tests and historical SOURCE authoring exist. Final both-build creation, ordinary export and Word readback remain required. Arbitrary range topology is not claimed. |
| P1-04 | Apply combined text and existing discussion changes atomically; whole-anchor deletion tombstones the discussion and Undo/Redo restores the same identity through Save/reopen. | Actual Main combined Apply, stale/forged/failed-publication recovery and actual-editor history cases are required with native deletion/Undo/Redo. Existing root/reply lifecycle delivery is preserved; this packet does not recertify every prior lifecycle combination. |
| P5-05, bounded dependency only | Near-limit comment graph survives the existing journal and restart without a second writer. | Executed 1000-paragraph/four15500-byte-message cases prove only that volume and the stated journal bounds. Full-book performance, cancellation and all resource boundaries remain open. Mutable CONTINUATION.json is a resume pointer, not immutable acceptance evidence. |

Five changed Word exchanges per build must bind each input/output artifact, actual runtime SHA/profile, operation and persisted result. Full mandatory gates then run on that frozen runtime. General full-plan acceptance and the separate P1-01 PACKAGED qualification tail remain open until their own evidence closes them.

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

The first proposed shared whole-document traversal introduced a supported-blockquote refusal, caught independently before any native freeze or delivery. The final narrower repair preserves the existing generic-import recursion and replaces only presentation-trimmed leaf text with exact Core text. The production ordinary-export→preview→atomic-import regression now includes an annotated blockquote, table continuation with edge hard breaks, point/range/reply, prior V3 discussion preservation and idempotent retry. Rehashed legitimately admitted offset/hash mutations reach the inner anchor guard and leave all project files unchanged. Focused safe-create suite11 passed without failures/skips; independent final diff review found no remaining blocker in this bounded repair. SOURCE04 remains the next real-user observation, not an inherited PASS.


## Authenticated unchanged-table text return at b0ea8170

Clean48path preflight passed before admitting the existing user-bookmark return analyzer. SOURCE04 ordinary safe-create and native table-continuation edit Save, Undo Save, Redo Save independently preserve eight discussion identities and ten messages, exact range and point offsets, literal edge hardBreaks, and the unrelated scene. The subsequent actual Word insertion after the range moves the point from11to12. Authenticated intake refuses before Preview with RTK_USER_BOOKMARK_RETURN_CONFLICT; no project write occurred.

Exact saved Word XML and parser diagnosis identify two blanket table refusals: raw structural occurrence inventory and the table leaf guard, despite unchanged table topology. Reuse the existing topology binder against original authenticated local exportMap and raw parsed occurrence evidence. Externally carried proof never grants admission. Existing paragraph, table property, technical owner, numbering, language, source-CAS and private final-candidate checks remain mandatory. Fontless hardBreak runs may retain their original absence only with exact typed break and baseline correspondence; partially unresolved actual-text font remains a refusal.

Acceptance requires an actual Main two-scene table/list-continuation range/point/reply regression and hostile topology, owner, font and stale-source cases, then native Apply using the retained saved Word document on the next frozen candidate. Read-only reconstruction from captured source scenes is diagnosis, never native authentication proof. No complete table-comment exchange, final SOURCE or PACKAGED cycles, or delivery is claimed at this amendment.

SOURCE04 Electron stopped after saved project bytes were independently matched. Its external launch wrapper failed to reap the exited child and spun at high CPU; after preserving and hash-checking all34 Documents files, only the owned wrapper was terminated. The retained session reports137; no clean-process-exit acceptance is claimed. Original profile and immutable DOCX remain available for SOURCE05.


The actual Main composite regression exposed the same trimmed-leaf coordinate error in authenticated block routing, concurrent-writer preparation and the final exact-text writer. Clean49path preflight passed at09e06440 before adding fullManuscriptDocxReviewReturnRouter.js; Main and exactTextMinSafeWrite.mjs were already admitted. The correction is restricted to exact Core paragraph text in these private authenticated-owner checks. Full-document marker reconstruction, source hashes, exact selected text, trusted operation digest, block ownership and final candidate comparison remain mandatory. Global presentation normalization is unchanged, and ambiguous collapsed layouts must refuse rather than guess. The intermediate09e06440 checkpoint is explicitly incomplete, not delivered.


## Candidate repair before SOURCE05

Exact authenticated leaf text now survives router ownership validation, concurrent candidate preparation and final rich text publication. Actual Main affected suite23 passed without skips, including table Apply, preserved foreign discussion, table geometry/property/owner refusal and stale-source zero writes. Two native-default continuation cases also exposed a pre-existing private proof defect, reproduced against immutable b0ea8170: language-only operations were incorrectly entered as literal text deltas. Main now passes only changed literal rows to that proof while retaining every formatting operation in the full candidate. Core continues to compare every returned paragraph against authenticated original or proved new text.

The point/fontless-break suite8 passed with unresolved real-text font, forged break bounds and lost explicit break-font negatives. Writer/router25 functional checks passed; its historical dirty-file allowlist assertion must be rerun on the clean checkpoint. This is code-level evidence only. SOURCE05 must apply the retained original Word input, whose inserted R is outside the range end: range quote stays contQinued, point moves11to12. The synthetic Main positive inserts inside the range and therefore correctly expands its quote. Final native cycles, mandatory gates and delivery are still pending.


## SOURCE05 native return and inherited table formatting

Clean96d1a64a runtime copy matched all3456 tracked runtime files; clean writer/router suite26 passed. Retained native Word return still refused before Preview, with both scenes and comment bytes unchanged. Exact native nonsecret authority and raw Word input reproduce RTK_FORMATTING_EXPECTED_TEXT_MISMATCH: formatting runtime also used presentation-trimmed paragraph text at boundary hardBreaks. Clean50path preflight at96d1a64a admits reviewTransportFormattingReturnRuntime.mjs for the same literal Core paragraph law. Global visible-result equality remains intact. Bounded machine-code diagnostics now include the existing formatting and clean-text prefixes; raw messages remain excluded.

Independent raw OOXML inspection found a second coupled defect before accepting the repaired admission: Word omitted direct paragraph spacing but retained docDefaults after160,line278,auto. Parser V2 explicitly skipped effective paragraph style resolution for tables, inventing spacing-removal operations. Acceptance must preserve inherited spacing, paragraph-mark language and text properties when no competing table text-style layer exists, and refuse unsupported competing layers instead of silently approximating. Actual Main must separately prove true spacing removal and inherited spacing preservation. Native success is still pending; external reconstructed admission alone is not acceptance. SOURCE05 subsequently exited0 with all34 Documents files matching its saved snapshot; SOURCE06 reuses the preserved native profile.


The parser now reuses existing effective document/paragraph style resolution for table paragraphs only after proving there is no competing table text-style layer. Explicit/default table style references and same-type basedOn chains are bounded and cycle-checked; nested table ownership uses exclusive XML boundaries. Hidden paragraph/run/conditional properties in table style containers refuse. Empty paragraph-mark language uses the existing0..0 formatting operation instead of a fabricated text edit. Main comment authoring also uses literal Core leaf text for admitted flat paragraphs; actual range and point creation at edge hardBreaks now passes with exact canonical hashes.

Focused parser/style/point suites42 passed, with malformed and nested-owner negatives. Broader table checks identified two existing renderer test harnesses missing the new mode predicate and an obsolete continuation-refusal expectation. These two test files require a clean scope amendment before editing; current checkpoint remains incomplete and unmerged. Existing native input private Main diagnosis preserves spacing160/278, language and explicit Aptos, but actual native Apply is still required.


## SOURCE06 frozen runtime candidate

Clean52path preflight passed atc457dfd0 before the two test-only compatibility repairs. Existing nested-table harnesses now provide the renderer mode predicate; all real selection, stale publication and grapheme assertions remain. The now-supported list continuation has a positive two-exporter text/numbering/ownership check; other malformed cases still reject. Affected nine-suite run121 passed with no skips.

The full actual Main file had209 passes and one invalid new fixture: changing global Word defaults legitimately changed an implicitly formatted foreign comment. The corrected positive binds table, sibling and comment-body spacing explicitly before export, matching the native specimen; only direct table spacing is omitted while effective spacing remains unchanged. Global font/language mutation is retained as a separate exact FOREIGN_SCENE zero-write negative. Five focused final Main cases pass. The prior full run is not described as green; final mandatory RTK must execute the full corrected file. Source runtime is unchanged fromc457dfd0; SOURCE06 must prove actual native return and then final changed exchanges in both builds.


## SOURCE06 actual Apply counterexample

SOURCE06 at0f9d2433 reached native Preview with the retained actual Word file, then explicit Apply refused REVISION_BRIDGE_CANONICAL_PREPARATION_INVALID. Independent hashes prove both source scenes and all8threads10messages unchanged. The isolated process exited0; all36 Documents files matched its retained snapshot. This is an observed refusal, not acceptance.

Complete actual Main Apply in a temporary fixture reproduces the failure using the native document and baseline with fresh authenticated technical identities. Canonical diff isolates an absent-content versus empty-array mismatch in the unchanged trailing paragraph. The analyzer must preserve the original property presence; final candidate equality stays strict. Independent runtime reproduction also finds an admitted inherited font action on a hardBreak returning success without changing its marks, and the private preparation lacks reconstruction of the supported empty-paragraph language operation. These proven defects must be corrected and checked through full Apply/re-export before another native freeze. The native observer additionally requires the two Word-resolved Times New Roman break fonts at literal offsets0and24.

The producer repair preserves absent versus present paragraph content without loosening equality. Formatting applies admitted marks to covered typed breaks and private preparation reconstructs only admitted font, spacing and paragraph-mark language families. Both existing exporters now pass break marks through their existing validation/serialization path; no new mark semantics are admitted. The focused six-case run passes full native-shaped Main Apply/re-export/reactivation, explicit nondefault Georgia break font, nonempty candidate tamper with zero writes, empty-paragraph language set/remove, and typed-break font removal/invalid-range checks. Parser/export suite10 passes, including six ordinary/review exports of line/page/column breaks with nondefault font/size/color/bold; unformatted break serialization stays unchanged. Final native SOURCE07 and PACKAGED, mandatory broad gates and delivery remain pending.


## SOURCE07 native success and required CI remediation

At7b0e1b7c, the retained real Word document passed native explicit Apply:1applied,0blocked,0failed. Independent persisted readback retains all8threads10messages, exact range/point coordinates, table/list/paragraph properties, inherited TNR break fonts and the foreign scene. Native collapsed-cursor authoring created a ninth thread at continuation offset12; insertion I inside the existing range then saved the range contIQinued and moved both points to13. These9threads11messages and exact scene bytes survived the owner-requested reboot. This is bounded native proof, not whole-plan or final both-build acceptance.

Clean59path preflight at7b0e1b7c admits the seven existing CI test files added above. PR2076 initial CI reports3186of3195RTK tests passed and9failed, with0skips, plus2broad-baseline failures. Several isolated code-evaluation/shadow-copy harnesses lack newly used dependencies; the delivery negative still calls the now-admitted preload path unadmitted; the table typography expectation predates bounded inheritance admission. Four shifted-cell tests expose a real inherited-language source-proof compatibility regression and must be repaired without weakening explicit formatting or donor/receiver identity checks. Final acceptance is blocked until corrected mandatory checks pass.

The shifted-cell repair normalizes only comparison-local inherited language under the already validated default profile when every signed source run omitted language and the donor has no direct language or character style. Explicit paragraph/table styles still refuse. Returned IR and the subsequent full rich Original check remain unchanged; coordinated direct-language injection, signed language mismatch and changed document-default language still fail the required proof. Three focused suites79passed with0skips. Five harness suites71passed with0skips after supplying real Core dependencies and the new snapshot provider; runtime bytes were unchanged by these harness repairs. Independent scoped review found no blocker in the parser delta. The delivery negative now checks the newly admitted preload source hash and retains unadmitted-delta refusal using the unchanged external flags module. Broad final checks remain pending.

## PACKAGED08 insertion beside a literal hard break

At d5a93d45 the packaged app imported both real Word specimens, preserved the foreign scene and its discussions, created a native table point, and saved an interior Q insertion. Two subsequent changed Word exchanges (interior R insertion and deletion) applied with 1 applied, 0 blocked, 0 failed. Independent raw XML and persisted-state observations retain nine threads, eleven messages, exact anchors, table properties and foreign bytes. For the newly authored plain comment only, the first Word exchange materializes its actual inherited document defaults; the observer derives the exact expected rich body from raw Word XML instead of ignoring that field.

The third exchange inserted B immediately after the leading hard break and before the range. Actual intake refused RTK_USER_BOOKMARK_RETURN_CONFLICT with no scene or comment writes. The retained Word input has SHA256 e2a75ac2bb4edb3e54d2518e55f98dd9ff08bc882e9c2c6842762c0142c1ebaa. Read-only production analysis with that same input, actual locally bound export map, authority store and baseline isolates label-linebreak-unsupported. Pure insertion minimization retained the left character, unintentionally including the unchanged break in the text replacement. Analyzer and writer now retain the adjacent complete right text grapheme for this shape. Existing break-type, structure, owner and full-candidate guards remain unchanged; a structural-only footprint still refuses.

The actual Main regression fails before the fix and passes after it, including a supplementary-plane leading character, full Apply/re-export/reactivation, original messages and foreign-scene equality. Twelve focused Main checks pass with zero skips. Five affected suites report 232 passes and one historical dirty-file allowlist failure; that check must pass on the clean commit. The exact retained native probe now admits the expected B insertion, but this is not native Apply acceptance. PACKAGED09 must apply the same retained input and complete final both-build observations.

The d5a93d45 CI run completed 19 of 19 checks successfully. Its local broad run was interrupted when the native counterexample appeared and is explicitly not PASS. The packaged process exited 0 and all 32 saved Documents files matched its shutdown snapshot. Final broad gates and delivery must bind the corrected frozen candidate, not these earlier results.


## Final native acceptance and local gate diagnostic repair

At aa0811dc both SOURCE09 and PACKAGED09 completed five changed Word exchanges with independent raw-XML and persisted-state checks. Each build created a native point and range, preserved eleven threads/thirteen messages through interior edits, whole-range deletion and saved Undo/Redo, exported an ordinary DOCX opened in Word, and reopened exact saved scene/comment bytes. Both apps exited zero with matching saved-file snapshots. NATIVE_ACCEPTANCE-aa0811dc.json binds the actual runtime, profiles, native inputs/outputs, observer hashes and limitations. This remains bounded single-paragraph/table-continuation acceptance, not the complete Mac plan.

CI at aa0811dc passed all19 checks. Local baseline completed2160 passes and59 existing skips, which are not acceptance coverage. The first local RTK was3194pass/4fail from owned baseline scratch; all six generated files were preserved with SHA256 before removal. Two clean RTK runs were3196pass/2fail: after a legitimate timeout or invalid heartbeat, macOS temporarily reported the same PID/PGID/start with executable <defunct>, and cleanup overwrote the original typed failure. The owned parallel probe retained this exact observation and zero survivors in process-identity-parallel-diagnosis.json. Further broad repeats stopped.

Clean preflight at aa0811dc admits the existing terminal orchestrator and its contract test as a required-gate diagnostic repair. Preserve the primary failure alongside cleanup ambiguity, retaining ok=false, quarantine and all PID/PGID identity checks. A deterministic actual-stage counterexample fails before the fix; its companion verifies that a zero-exit stage still fails on ambiguous descendant cleanup. Fixtures exit on an explicit test handshake, avoiding a new natural-exit timing race. No product runtime, dependency, UI or native project bytes change. Final successor RTK, CI and delivery remain required.
