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
