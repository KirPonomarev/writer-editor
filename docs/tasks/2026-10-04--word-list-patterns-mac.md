# WORD_LIST_PATTERNS_MAC_20261004

STATUS: TARGET_NOT_ACCEPTED
TYPE: CORE_AND_PRODUCT_UI
BASE_SHA: 2c83167326282dd06517ed4a9c69713688f93a8a
AUTHORITY: Owner-authorized full Mac Word plan P3d and section8; bounded numbering capability, not whole-plan acceptance.

## MAP
O: Literal and parent-dependent numbering survives G import, Y0 authoring, edits, Save/new-process reopen, ordinary and review export, actual Word changed-template return and explicit Apply.
T: Bounded owned OOXML -> Core wordNumbering -> existing Kernel/scene Save/formatting transaction -> immutable editor/marker projection and saved-snapshot export.
H: Current admission accepts only own-level dot templates and exporters emit one-level definitions. Typed group definitions and shared Core counters preserve live numbering and admit explicit changed-group deltas.
B: Preserve text/anchors/revisions/private notes, legacy formats and existing transaction recovery. No new dependencies/network, alternate writer, raw OOXML truth, shell redesign or artificial rendered labels in document text.
P: Independent handwritten input and literal labels; early genuine Mac Word route before heavy gates; SOURCE/PACKAGED changed cycles, focused negatives, baseline/RTK/OSS/audit/CI, independent review, merge/exact-head proof.
I: Clean merged base above, verified encrypted mounted writable T7, fresh bootstrap and37path preflight PASS before first edit. Prior PR2074 delivery closed.

## Model and boundaries
Optional orderedList attrs.wordNumbering: schemaVersion1, canonical instanceId, zero-based level, complete contiguous1..9 levels with format/start/text/restartAfterLevel. Restart is zero-based ancestor, null means never. Legacy wordListId/wordListStart mutually exclusive. attrs.start and displayed labels derived by Core; no persisted label strings. New required feature word-list-pattern.v1 refuses old readers.
Decimal starts0..2147483647; alpha1..780; Roman1..3999. Overflow and outside-profile semantics refuse explicitly, never clamp. Templates bounded256UTF16, valid scalar text, placeholders reference defined levels no deeper than current. Native boundary proof: decimal0, Roman3999, alpha26..29 and52..54 observed. Word alphabetic markers repeat one letter (z,aa,bb,cc;zz,aaa,bbb), not spreadsheet-style bijective labels. Alpha authoring bound780 follows observed Word dialog range; larger file values remain explicitly outside current positive profile, not claimed impossible in Word.
Main scene and supported table cells are positive scope. New patterns in notes/stories remain explicit compatibility gaps; existing supported legacy lists must not regress. Unknown number formats, marker-specific semantics not represented by the model, picture bullets, style links and isLgl receive explicit outcomes.
Word-side template changes must produce one source-bound group operation through existing formatting Apply. Baseline/actual identity bijection, expected levels, scene revision/raw SHA and replay/conflict behavior remain mandatory. Import/export-only proof cannot close this contour.

## Native counter calibration
Native Word screenshots of independent handwritten fixtures establish shared counters for distinct num instances referencing the same abstract definition: 3,4,9,10,11,12 with a first-use override; 3,4,5,6,7,8 without it. Distinct abstract identities with equal definitions remain independent: 3,4,9,5,10,6. Evidence and input hashes are in external native-counter-calibration.json. Initial per-instance-only counter hypothesis is disproved. Preserve canonical lineageId separately from instanceId and explicit first-use startOverrides; do not infer identity from definition equality. Native child controls establish previous-parent restart via omission and never restart via0. Redundant explicit1 at ilvl1 drops child markers in tested Word (schema-order and modern-compatibility changes did not fix it). A native Word-authored ilvl2 definition with explicit restart1 correctly renders 3.,3.a.,1,2,3.b.,3,4.,1. Export default ancestor via omission and nondefault ancestor via explicit index. This is external Word behavior evidence, not product acceptance.

## UI
One existing list-menu entry opens current dialog primitives: level/format/template/start/restart/continue and Core-computed preview. Preserve tokens/font/shell. Capture exact editor/document/selection; stale/read-only or auxiliary context cannot redirect mutation. One undoable command transaction, existing Save only.
Lazyweb search619b1c31-cef5-439f-96cc-a957d88f2bfa provides weak toolbar/modal context only, not numbering semantics. Existing project design is binding. ui-craft, Design OS guide, matrix and brain refs used; no new visual direction.

## CHECKS
CHECK_01 before edits: bootstrap, exact clean base, mount identity, independent RED fixtures, declaration preflight.
CHECK_02+: focused Core/parser/renderer/return positives and hostile/stale/overflow/refusal cases; actual source/packaged authoring and changed Word returns; required baseline/RTK/OSS/audit/CI; independent review, clean delivery, exact merged verification.
Independent RED fixtures and frozen labels reside externally in word-list-patterns-mac-2c831673, with original SHA and hashes. Malformed nested numbering scalar and unowned numbering part admitted at base; must reject after repair.

## Ownership
Core agent: Core/envelope/table/export/formatting runtime/Main and own tests. Parser agent: intake/proof/return parser and parser tests. UI agent: seven declared renderer/control/test paths. Parent: task/OPS, generated bundle, native controller, validation and delivery. No overlapping writers.

## ALLOWLIST
- `src/core/word-list-numbering-v1.cjs`
- `src/core/entitlement-law-v1.cjs`
- `src/core/document-content-envelope-v1.cjs`
- `src/core/word-pending-text-revisions-v1.cjs`
- `src/core/word-manuscript-notes-v1.cjs`
- `src/io/documentTables.js`
- `src/export/docx/docxMinBuilder.js`
- `src/export/docx/docxReviewPacketBuilder.js`
- `src/export/docx/fullManuscriptDocxReviewPacketSource.js`
- `src/io/revisionBridge/index.mjs`
- `src/io/revisionBridge/reviewTransportPackageParserV2.mjs`
- `src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs`
- `src/io/revisionBridge/reviewTransportFormattingReturnRuntime.mjs`
- `src/main.js`
- `src/renderer/editor.js`
- `src/renderer/editor.bundle.js`
- `src/renderer/index.html`
- `src/renderer/styles.css`
- `src/renderer/tiptap/documentListNumbering.mjs`
- `src/renderer/tiptap/documentTables.mjs`
- `src/renderer/tiptap/index.js`
- `src/renderer/commands/projectCommands.mjs`
- `src/renderer/commands/capabilityPolicy.mjs`
- `test/contracts/rtk-word-list-pattern.contract.test.js`
- `test/contracts/rtk-word-list-pattern-return.contract.test.js`
- `test/contracts/rtk-word-list-pattern-parser.contract.test.js`
- `test/contracts/rtk-word-list-pattern-renderer.contract.test.js`
- `test/contracts/rtk-word-list-format.contract.test.js`
- `test/contracts/rtk-word-table-editor.contract.test.js`
- `test/contracts/revision-bridge-docx-lists.contract.test.js`
- `docs/tasks/2026-10-04--word-list-patterns-mac.md`
- `docs/OPS/RTK/FEATURE_INTEGRATION_MANIFEST_WORD_LIST_PATTERNS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`

## Capability integration amendment
Intermediate owned WIP checkpoint80bd485494cda45080245e7732edd570141d916d preserves the unverified implementation. New list command required an explicit capabilityPolicy binding; initial dirty preflight refused, then clean38path preflight passed on this checkpoint before that file was edited. Original delivery base remains2c831673. This amendment adds no platform authority and no second delivery contour.

Native SOURCE01 proved import persistence and all ten expected list labels on38a88fb0. It also found the command missing from the actual palette because Core entitlement classification was absent. Clean39path preflight passed on owned checkpoint946897c5 before entitlement-law was edited; original delivery base remains2c831673. Core list editing remains free like existing list commands.

## Native02 corrective checkpoint
SOURCE01 import is evidence only for its pinned candidate; no authoring or changed-return acceptance is inherited. The next candidate must expose numbering settings through the real entitlement-backed palette and show public old/new numbering settings before explicit Apply. Reviewed Core repairs require an actual instance selector and reserve both instance and lineage identities when allocating a new group, including after deletion of its original representative. A fresh Review export is required because numbering export identifiers changed during hardening.

The independently observed explicit redundant restart form must never silently acquire visible labels after import/export. Any explicit unsupported outcome remains a compatibility gap in the full Mac plan, not evidence of full numbering fidelity. Native default omission, never-restart and nondefault ancestor cases remain positive acceptance requirements.

## Delivery
### Candidate02 regression repair
Candidate24d04b1d completed five changed Word returns in SOURCE and five in PACKAGED, plus native Y0 authoring and process reopen. Those observations do not establish acceptance: both CI RTK jobs report3034passed and24failed. Legacy exporters' padded numbering definitions are promoted to typed list attributes, breaking existing notes, table topology and authenticated return checks. Repair must prove legacy representability, retain genuine custom numbering and preserve existing Main authority and exact-shape assertions. Clean39path preflight was renewed at24d04b1d before repair; original delivery base remains2c831673.

Native PACKAGED CmdA, CmdC, CmdV on the Y0 list changed Item4/5/6 into plain4/5/6; Undo restored the original labels. Serialized clipboard input is untrusted semantic data, never source-return authority. Candidate17857c3b implements bounded definitions with fresh instance and lineage identities; native SOURCE same-scene and cross-scene copy preserved Item4/5/6, with Undo/Redo and Save. This is candidate-bound evidence, not final packaged acceptance. Independent review then reproduced hidden identity injection through ProseMirror data-pm-slice context; a clean39path preflight at17857c3b admits the guard before MIME and plain-paste fallbacks. Existing custom HTML attributes remain untrusted even when reconstructed by the editor library. Native numbering restart/continue, structural operations, table-cell patterns and never/nondefault ancestor restart remain explicit acceptance requirements.

COMMIT_REQUIRED: true
PUSH_REQUIRED: true
PR_REQUIRED: true
MERGE_REQUIRED: true
POST_MERGE_EXACT_HEAD_REQUIRED: true
Rollback: revert integrated PR; preserve failed native inputs and recovery artifacts. No claim of full family/whole Mac readiness before all its promised operations are independently proved.

## Native04 integration repair
Native Restart then Continue exposed a same-lineage early no-op. Checkpoint fe6d35a17 removes only the selected first-root reset, preserves earlier instances and child overrides; 38 focused tests passed, native corrected-candidate acceptance pending.

Candidate e89429bc CI completed with one RTK failure: standalone numbered-heading plugin construction lacks options for the new clipboard callback. Preserve optional callback compatibility and keep the unchanged regression test. Native table import persists valid canonical data but actual Editor initialization rejects an own undefined wordCell emitted by the table schema. Clean40path preflight at fe6d35a17 admits documentTables.mjs before its repair; retain strict Core validation and verify actual schema serialization. Original delivery base remains2c831673 and PR2075 remains unaccepted.

Independent pre-build review reproduced the same rejection for four optional DocumentMedia attributes. The corrective implementation therefore projects only schema-declared undefined defaults out at the numbering adapter boundary, while preserving unknown or nested malformed values for strict Core rejection. Table schema/default serialization changes are unnecessary and withdrawn; actual table and media Editor regressions replace that narrower hypothesis. This is not permission to normalize external payloads before validation.

## Native05 skipped-level repair
Native imported ancestor fixture eedf5d17 preserves logicallevel2 on disk but scene load displayed final4.a instead ofWord1. Exact input levels0,1,2,2,1,2,0,2. Clean40path preflight renewed atf14d8ac88. Core only infers reparenting for identities present in the prior document; renderer uses existing checked-document publication metadata and real history transactions to preserve explicit imported levels. Actual checked replacement tests include colliding scene-local instanceIDs and exact UndoRedo of a lifted skipped level. Separate cross-scene history grouping is under read-only investigation; the focused test explicitly separates history events and does not certify scene-switch Undo isolation.

## Native06 history isolation repair
Packaged candidate2a2c8c77 now preserves imported logical levels after restart, same-instance scene switch and Save. The actual shared Editor retained foreign scene history; the scene publication wrapper now clears history only after a successful identity-changing publication and restores its previous state on thrown or silently filtered replacement. The caller commits active identity only after successful publication. Same-identity publications retain history. Focused renderer checks25 passed; existing scene identity, tree recovery, header/footer and scene-switch checks270 passed without skips or harness changes. Final native acceptance remains pending.

An independent actual Editor operation matrix additionally reproduces WORD_LIST_NUMBERING_INVALID when lifting item2 in the nondefault-ancestor fixture. Global ancestry matching conflates distinct occurrences. Exact ProseMirror mappings identify moved and unchanged paragraphs without text matching; all resulting list groups agree on required levels, so this reproduction requires no splitting framework. This is an open implementation defect, not a supported-profile refusal or accepted numbering operation.

## Mapped authoring corrective candidate
Checkpoint7d4ae2f6 isolates scene history. The subsequent repair uses actual ProseMirror transaction mappings to identify surviving list-item paragraphs; Core validates bounded unique occurrence paths, computes logical depth changes and respects an established destination group. Additional logical correction applies only to mapped descendants in both old and new ancestry. No text matching, global instance-context inference or speculative splitting is used for this path.

Core and renderer focused checks49 passed without skips. Independent32operation actual-Editor matrix executes28 changes and4 expected no-ops without exceptions; all changes preserve table/image content and exact Undo/Redo. Previously failing item2 lift produces logical levels0,0,1,1,1,2,0,2; last skipped child joins occupied root with levels0,1,2,2,1,2,0,0. Native acceptance of this candidate remains pending. Candidate2a2 ordinary exports separately opened in real Word with expected ancestor and never-restart labels; independent raw OOXML checks7 and10 passed with layout normalization and unused empty-level omissions disclosed. Those prior-candidate observations do not certify final changed-return acceptance.

## Native07 decoration synchronization
Packaged97b08ec outdent succeeds with correct canonical levels, but live cached markers remain stale until Undo/Redo. The actual plugin normalization transaction was interpreted twice as user topology. A private module PluginKey identifies only that plugin's own normalization publication; decoration computation then uses the final canonical document. Tests assert the real cached DecorationSet before the operation, immediately after, after Undo and after Redo. Prior JSON-only assertions did not prove display fidelity. Native07 also observed cross-scene Undo leaving the destination scene intact; no foreign manuscript restored. Candidate07 stopped cleanly with retained native profile and snapshot before replacement.

## Native08 Word-save section integration
Candidate288344fa SOURCE item2 outdent displays correct labels immediately and after Undo/Redo; PACKAGED last-child outdent likewise succeeds. Both scene-history routes preserve destination content after switch and Undo. Original repeated-import attempt after editing its prior scene refused with DOCX_SAFE_CREATE_IDEMPOTENT_RECEIPT_INTEGRITY_FAILED; this is recorded separately from numbering, not counted as a successful fresh import.

A distinct copy saved by Microsoft Word introduces disabled w:docGrid linePitch360 and fails generic import with WORD_SECTIONS_UNSUPPORTED. Clean42path preflight at288344fa adds word-sections-v1.cjs and rtk-word-sections.contract.test.js. Preserve inactive grid settings through Core section metadata, ordinary and Review export, generic import and authenticated protected properties. The ECMA default type is inactive but retains latent signed integer settings; explicit active grid support remains open. Do not turn an existing positive default-grid Word return into accepted refusal or silently discard its values. Full final delivery remains pending.

Initial inactive-grid preservation checkpoint is incomplete delivery: Core21, parser17 and projection4 focused checks pass; exact Word-saved fixture now parses with linePitch360 retained. Legacy no-grid baseline addition and atomic Apply are not yet implemented. This owned checkpoint permits clean scope amendment for existing volume, actual Main return, and toolbar extraction tests; no acceptance or regression waiver is claimed.

Clean45path preflight ataa4e494d adds the existing toolbar foundation, full-manuscript volume, and real Main scene-identity tests. Toolbar extraction must follow the moved parse/publication ordering while retaining its original profile-adoption assertions. The legacy Word-added inactive-grid route retains its positive expectation: source comparison keeps the original protected proof and carries exact additions separately; Core maps each addition only to the scene owning the existing section endpoint, preserving multi-scene section topology. Metadata-only return must use an explicit section-doc-grid review operation, never a fabricated text edit. Text and formatting publication retain private candidate checks, source CAS, replay identity and atomic persistence. Implementation and native acceptance are still pending.

Inactive-grid return integration checkpoint remains RED in actual Main tests: metadata-only activation needs a private typed candidate; text publication must transform canonical content before the exact-text journal computes its output hash. A late publisher transformation was removed after it caused reconciliation conflict in the isolated test. Core24 and volume16 checks pass, including existing positive default-grid return and exact multi-scene endpoint preservation. The next clean scope amendment admits the existing exact-text writer and its contract for a private pre-journal canonical transformation; journal hash checks must remain exact. No native acceptance or completed delivery is claimed for this checkpoint.

### Journal preparation scope amendment at a1ba5bf40

CHECK_01 before edits: clean owned checkpoint, bootstrap READY, verified encrypted writable T7, declaration preflight PASS with 47 paths. Original delivery base remains 2c831673; PR2075 remains incomplete. Added exactTextMinSafeWrite.mjs and its existing contract test for private canonical preparation before hashing. CHECK_02 after edits must prove actual Main text plus grid and metadata-only Apply, cross-scene endpoint ownership, strict inverse rollback and unchanged crash reconciliation. Late publication byte mutation and journal-hash relaxation are forbidden. No new UI design or dependency.

Integration evidence on the owned journal repair: Core inverse checks 25 passed; explicit grid-policy volume suite 16 passed, zero skipped or todo. Independent review verified separation of Office omission policy, private bookmark composition, preparation before final journal hashing and inverse section validation. These are focused working-tree checks, not frozen-candidate acceptance. The unchanged exact-text crash and no-disk run passed 11 behavioral cases and failed the historical dirty-file allowlist case; rerun that unchanged check after clean commit.

Bookmark-plus-grid regression is limited to existing full-manuscript case-only bookmark renaming. Arbitrary rename lineage and unchanged-text scene-only bookmark return are pre-existing residuals, explicitly retained in whole-plan remainder; this repair must not claim either.

Actual Main publication fault proof passed: afterSceneWrite threw after changed bytes were observed through publishReviewSceneWithProjectTransaction; formatting rollback restored exact legacy plain source, preserved sibling, and retry applied grid successfully. No new production test hooks. Private canonical preparation tests verify same input and path with distinct final metadata produce distinct effect hashes, persisted journal hashes final bytes, and preparation rejection writes nothing. Native frozen-candidate qualification and delivery remain required.

Clean 4fd98e667 candidate run: 61 of 62 focused tests passed; historical C04 isolation assertion rejected the pre-existing docxHyperlinks.cjs pure normalization dependency. This is not caused by the journal hook. Same 47-path preflight renewed clean before a test-only clarification retaining Main, preload, IPC and DOCX parser isolation. No product capability or dependency changes in this clarification.

Validation correction at d481aca56: agent-reported 3 of 3 contradicted retained TAP (2 passed, 1 failed); parent independent clean run caught the same remaining static source-boundary failure. A trailing successful shell command masked the test exit. No acceptance was issued. Test exit and TAP totals must be inspected independently. Narrow the legacy Main function source slice to its actual next function, retaining every assertion; runtime stays unchanged.


## Native09 continuation correction

Clean fa4967661 independently passed 62 focused writer/list/section checks and 182 actual Main checks, with zero skipped or todo. Packaged09 imported the real Word-saved ancestor fixture and ordinarily re-exported it; independent 18 checks verified the referenced numbering levels and inactive grid. Unused empty Word numbering levels were omitted and this is disclosed, not full latent-definition equality.

The next actual scene Review exchange failed: three canonical list items include a second paragraph within item three, but the original exported DOCX already assigned four numbered paragraphs. Word retained that export defect. Diagnostic relaunch of the unchanged packaged artifact reproduced E_DOCX_REVIEW_PREVIEW_SESSION_RETURN_INTAKE_BLOCKED with RTK_RETURN_INTAKE_SCENE_RETURNED_TEXT_MISMATCH. Main attempts authenticated clean fallback after that mismatch and returns the initial code when fallback fails; analyzer separately detects list-semantics-change. The saved example contains no added docGrid, so it is not evidence for native combined text-plus-grid Apply.

Continuation ownership must be projected from canonical listItem child structure, not guessed by repeated numbering keys or text. Subsequent direct paragraphs remain unnumbered, including after a nested list, and authenticated return must preserve their exact source owner. No heuristic generic foreign list ownership is certified by this repair. Existing bounded return errors must become visible on the existing status surface. Native acceptance, full frozen checks, push, CI, merge and exact merged-head verification remain incomplete.

Parent independently verified the frozen continuation repair: 84 list/export/parser/renderer/return checks and three actual Main continuation scenarios passed with process exit zero and zero skips or todo. Actual Main proof covers unchanged export, authenticated paragraph-tail suffix Apply with exact three-item ownership and journal hashes, and rejected removal of an actual numbered item. Derived continuation indentation follows the exporter level layout only when canonical paragraph indentation is absent; explicit layout wins. Generic foreign continuation ownership remains outside this evidence. Final native qualification and delivery remain pending.

Native PACKAGED10 at clean63b17b379 confirms three real Word labels and unnumbered continuation. The Word-saved suffix still fails actual intake; exact artifact analysis identifies paragraph-spacing-change, because Word adds inherited spacing after160,line278auto and inherited language/font defaults to the originally sparse styles. Synthetic suffix-only Main tests did not include this provider shape. The failed package, pre-Word package and baseline scene hashes are retained externally. No unchanged native retry: next hypothesis is typed authenticated text-plus-spacing preservation in the same existing atomic publication, never an ignored-default exception. Clean same47path preflight renewed63b17b379 before repair. No full native acceptance or delivery claim.

The native-style repair produces private paragraph-spacing and effective-font operations from parser-owned style proof, applies the existing pure formatting transform in Main before exact-text hashing, and retains existing language operations. It does not change the exact-text public schema or weaken visible-text, final-candidate or source-CAS checks. Metadata-only inherited font now produces ordinary explicit formatting candidates. Independent review found and closed silent partial-font and metadata-only omission risks; partially unresolved font profiles explicitly refuse and remain a full-plan compatibility residual. Parent independently ran 83 parser/effective-style/formatting regressions and six affected actual Main cases: all passed, zero skips or todo, exit zero. Actual saved Word artifact analysis preserves all four paragraph intervals, language triples, Times New Roman, three items and exact suffix; this analysis does not substitute for the next native Apply.

Native PACKAGED11 at6c13676cb completed fresh scene export, actual Word suffix edit/save, intake and explicit Apply All: UI reported4applied,0blocked,0failed, and persisted scene retained3listitems with the changed continuation. This closes the reproduced native refusal only on that candidate. Full actualMain run on the same clean SHA passed186of187: the unchanged styled-list suffixfalse case proves redundant same-family formatting splits a retained Aptos text leaf. Preserve that exact-document assertion; filter only font actions proven no-op against final mapped text/language candidate coverage. Clean47path preflight renewed6c13676cb before repair. Native process stopped with exit0 and Documents snapshot retained; no final package acceptance yet.

No-op font repair independently passes23parser checks and7actualMain regressions including the previously failing exact styled-run case and real-Word-shaped formatting composite. A font set operation is omitted only when the final mapped candidate proves exact selected text, full covered range and matching canonical font on every overlapping text leaf. No run coalescing or assertion weakening. Full187Main rerun and final native successor qualification remain required.

### Reopen snapshot scope amendment at2888a9fe0

Full actualMain187of187 now passes clean. NativePACKAGED12 fresh return after process restart reaches preview but singleApply refuses RTK_CLEAN_BLOCK_TEXT_SOURCE_STALE; source bytes remain exactly the prior applied bytes. Independent actualEditor reproductions prove the cause: two adjacent persisted text leaves with identical TNR/language marks become one when ProseMirror loads them. Existing shared snapshot comparator treats this representation difference as a content change. Clean49path preflight passed before admitting reviewTransportNonTextReturnRuntime.mjs and rtk-word-comment-authoring.contract.test.js. Only read-only snapshot comparison may coalesce adjacent equal normalized text leaves inside document content. Different attributes, marks, unknown properties, node boundaries, visible text, source bytes, revision and CAS remain protected. RealEditor reopen plus second singleApply is required; raw-JSON renderer stubs are insufficient.

### Native13 reopening proof and numbering-start repair

Clean dbadc94e384763fed9f985a336054037e5465ce0 passed full187actualMain checks and five actual PACKAGED Word text-changing exchanges after Editor restart. Independent verification passed115checks and4exact journalchainlinks. Snapshot comparison no longer falsely refuses equivalent adjacent styled text leaves. Two earlier native13 attempts used a stale GUI helper closure which auto-launched runtime12; those empty exports and foreign-round results are excluded. Corrected GUI helpers take an explicit app argument and verify runtime identity plus scene filename before export.

A further real Word operation changes whole-list start4to7, retaining3items and continuation. Word updates abstract level0.start and removes concrete startOverride4. Current definition analyzer refuses lineage-or-start-override; genuine operation support is still incomplete. Same49path clean preflight renewed atdbadc before repair. The existing typed numbering operation may carry optional instanceOverrides with canonical instanceId, expectedStartOverrides and startOverrides, including explicit empty removal. Core must verify lineage, all occurrences, unique targets and exact prior overrides before atomic candidate mutation. Renderer uses existing review card and explicit Apply. Unknown fields, stale source and cross-lineage edits remain rejected. No private OOXML identifier becomes canonical mutation authority. Separate unchanged-numbering text diagnostic must not be silenced without independent numbering proof. Final native acceptance and delivery remain pending.

Frozen override repair independently passed82Core/parser/renderer/formatting checks and7actualMain affected cases, zero failures/skips/todo and exit0. Actual Main start4to7 plus concrete override removal preserves styled3item4paragraph scene and reexport labels7,8,9; stale local override remains no-write. Independent review caught locale-dependent plan sorting and regression now verifies fixed lexical mixed-case ordering accepted by Core. Unchanged-numbering text returns still show a separate source-owner-text-or-revision formatting diagnostic; this residual is not suppressed or claimed closed. Fresh native changed-numbering Apply remains required.
