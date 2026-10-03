# WORD_EFFECTIVE_STYLE_RETURN_MAC_20261003

STATUS: TARGET_NOT_ACCEPTED
BASE_SHA: e4be0d8d22937745f691dc6121541278668139ed
AUTHORITY: Original Mac Word plan P3-08; existing effective-values and semantic-role contract, not full named-style identity preservation.

## MAP
O: Actual Word style-based changes of supported alignment, outline and inline formatting become correctly bound explicit Apply candidates, persist, restart and reexport through existing writers.
T: Untrusted bounded Word XML -> validated effective-style projection -> existing round/scene/block authority -> Main capability and revision revalidation -> existing atomic formatting writer -> renderer projection.
H: Current scanner reads only direct pPr and marks pStyle unsupported. A literal Derived basedOn Base with jc right yields empty paragraphState and unsupported pStyle. Resolve active style defaults and chains before existing action construction; unknown properties must stay unsupported.
B: Preserve source DOCX, unrelated content, exact text/scene identities, pending review, private notes, unsaved authoring, CAS and recovery. No style-ID persistence, UI controls, dependency or runtime network. The native-driven spacing amendment below adds a bounded Core feature declaration.
P: Red independent literal XML; positive/default/basedOn/direct/reset/toggle tests and hostile/cycle/budget tests; actual Main Apply and no-write preview; native SOURCE/PACKAGED altered exchange early; stable candidate mandatory tests and CI; merged-SHA verification.
I: Exact base above, branch codex/word-effective-style-return-mac-20261003, existing isolated worktree. Bootstrap PASS and clean preflight PASS before writes; T7 identity verified.

## FEATURE_INTEGRATION_MANIFEST_V1
productPlane: Existing Core document/formatting model; Command Kernel owns Apply.
interfacePlane: Existing immutable review and document projections; UI unchanged.
commands: Existing authenticated formatting Apply and Save.
queries: Existing review preview and scene reads.
events: Existing transaction completion events.
effects: Existing local document read/write and export adapters.
productPorts: Existing intake/Apply/atomic scene persistence.
designOsPorts: Existing immutable scene/review projection only.
identityGuards: Round/project/scene/block/source revision/raw SHA/generation checked at existing publication boundary.
surfaceManifest: NOT_APPLICABLE; no new or changed UI design contract.
capabilityFallback: Unresolved or unsupported active semantics remain typed manual/refusal, no guessed fallback.
recovery: Existing atomic writer and journal; original DOCX retained.
performance: Bounded cached style graph per parse, no full parsing on typing.
accessibility: Existing keyboard/editor/review controls unchanged.
negativeTests: Duplicate/missing IDs, wrong types/namespaces, cycle/depth, unsupported inherited properties, stale project/revision, forged operation, no preview mutation.
currentVsTarget: TARGET until observed native route and full delivery.

## Checks and delivery
CHECK_01 before writes: bootstrap, identity, exact base, read-only red probe, declaration preflight.
CHECK_02 after changes: affected formatting scanner/candidate/Main/legacy contracts with no missing/zero-test claims.
CHECK_03 native: Word-origin supported style fixture; author and Save, ordinary/Review export, real Word style edit, preview zero-write, Apply, restart, independently inspect effective properties. SOURCE and PACKAGED frozen candidate five alternating cycles.
CHECK_04 final: baseline, RTK, OSS/audit, guardrails, diff review, clean scope, commit/push/PR/CI/merge and exact merged-head checks. Heavy gates once stable.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true.
ROLLBACK: Revert one PR; original documents and existing snapshots retained.

## Explicit remaining original-plan gaps
Spacing beyond the admitted numeric before/after/line tuple, indentation and custom tab stops; custom/multilevel numbering patterns; other original Mac families and whole-plan qualification remain open. This package cannot claim these from style resolution alone. Named style identity loss is allowed only with existing explicit disclosure.

## Allowlist
- `src/io/revisionBridge/reviewTransportPackageParserV2.mjs`
- `src/io/revisionBridge/index.mjs`
- `src/io/revisionBridge/reviewTransportFormattingReturnRuntime.mjs`
- `src/main.js`
- `test/contracts/rtk-word-effective-style-return.contract.test.js`
- `test/contracts/rtk-word-n3-formatting-return.contract.test.js`
- `test/contracts/rtk-word-v4-e08-effective-formatting.contract.test.js`
- `test/contracts/rtk-word-header-footer-transaction.contract.test.js`
- `docs/tasks/2026-10-03--word-effective-style-return-mac.md`
- `docs/OPS/RTK/FEATURE_INTEGRATION_MANIFEST_WORD_EFFECTIVE_STYLE_RETURN_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`
- `test/contracts/rtk-word-heading-outline.contract.test.js`
- `test/contracts/revision-bridge-docx-inline-styles.contract.test.js`
- `test/contracts/rtk-word-review-default-typography.contract.test.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`

## Early native evidence: Word paragraph-style semantics
The independently authored six-paragraph DOCX opens in native Word. A copied file was actually rewritten through edit, Save, Undo and Save. Its immutable final snapshot differs from the original independent expectation for a repeated bold property in a paragraph basedOn chain. Microsoft MS-OE376 section2.1.260 states that Word assigns paragraph-style toggle values rather than applying the standard toggle rule; character-style toggles are separate. Reference: https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oe376/f936abaf-a9cb-439b-923d-7f688d9202e9 .
Original expected graph, checker and FAIL are retained. A separately versioned Word-profile oracle and expected graph preserve exact text and all other fields, and match both literal input and the actual Word rewrite. Five independent corruption cases fail. This is oracle calibration backed by actual Word and vendor documentation, not product acceptance. Generic import and authenticated return must implement the same Mac Word semantics in the already admitted index and package parser. Paragraph false resets false. Within a character basedOn chain, properties first resolve by assignment; the resulting character true toggles the paragraph value once, character false leaves that value unchanged, and direct false resets false. No named-style identity claim is added.
Evidence: independent-effective-style-original.docx; independent-effective-style-word-resaved.docx; word-actual-resaved-oracle.json; word-actual-resaved-word-profile-oracle.json; word-profile-oracle-correction-and-negatives.json, external task directory.

## Native character-chain calibration
The first Word-profile XML checker was insufficient: it predicted CHARACTER_STYLE non-italic while native Word rendered italic and reported the italic toolbar active. That FAIL remains retained. A separate eight-paragraph diagnostic distinguished three hypotheses. Native Word toolbar observations were false,true,true,false,false,true,false,false, matching character-chain assignment followed by one toggle against paragraph formatting. Exact input SHA256: 2de3d42bef21a4bab6c995e33be6630900a37ba4c4fee5629c3d741ba4ce16cc. Evidence: native-character-eight-cases.json, native-character-eight-cases.jpeg and the per-selection accessibility snapshots. These establish only the tested semantics, not feature or whole-plan acceptance.

## Implemented checks before native candidate
Four actual-Main integration cases passed with no skips: inherited paragraph properties, repeated paragraph true, repeated character true, and paragraph true plus resolved character true. Each checks no-write preview, explicit existing menu Apply, real asynchronous renderer sync, exact persisted properties and unchanged sibling, idempotent replay without a second writer, and Review reexport. The independent Word-profile V2 oracle matches original, actual Word-resaved and eight-case diagnostic inputs and detects five deliberate corruptions. Native application round-trip acceptance, full gates and delivery remain pending.

## Native-driven scope amendment at clean checkpoint 1e9098df
CHECK_01 repeated for the newly admitted paths BEFORE their writes: bootstrap READY and clean 41-path preflight PASS. Same outcome, branch, PR and rollback; initial checkpoint is not accepted delivery.
Native Word creation of a paragraph style inserted active default spacing after160,line278auto and proofing language ru-FI/eastAsia ru-RU/bidi ar-SA. Six formatting rows were refused, with byte-identical source scene. No equivalence to omitted export defaults is proven. The amendment preserves those properties rather than removing them from the native fixture or ignoring them.
Core representation: optional paragraph/heading wordParagraphSpacing={before?,after?,line?,lineRule?}. Finite integers0..1000000; before/after are twips; line is240ths for auto or omitted lineRule, twips for exact/atLeast. Preserve absence versus explicit0; unknown spacing attributes remain typed-refused. Core owns a pure validator/inspector only; XML serialization stays in exporters. Existing word-language.v1 owns separate run and paragraph-mark language tuples, merged per attribute. Source semantics reference: Microsoft OpenXML SpacingBetweenLines.Line documentation.
Existing command/transaction and atomic write remain sole mutation path. Both exporters, import, persisted envelope, rich-body grammar and auxiliary comparators must preserve/compare the new values. Existing paragraph/heading extension renders document properties; no new UI controls, tokens or shell state. Native Word output and exact semantic values are required; pixel-identical page layout remains outside original baseline.
P: first reproduce actual retained Word artifact positive Apply and independent saved/reexport checks, then complete SOURCE/PACKAGED cycles and stable candidate mandatory gates. Negative tuple/descriptor/unknown-property, partial inheritance, zero, malformed units, stale revision, unsaved authoring, replay and no-write preview remain mandatory.
B: preserve original input, current failing artifact, complete imported scene and owned profile snapshot. No fixture rewrite to force acceptance. Rollback remains the single complete style-return PR.

Amended exact allowlist:
- `src/io/revisionBridge/reviewTransportPackageParserV2.mjs`
- `src/io/revisionBridge/index.mjs`
- `src/io/revisionBridge/reviewTransportFormattingReturnRuntime.mjs`
- `src/main.js`
- `test/contracts/rtk-word-effective-style-return.contract.test.js`
- `test/contracts/rtk-word-n3-formatting-return.contract.test.js`
- `test/contracts/rtk-word-v4-e08-effective-formatting.contract.test.js`
- `test/contracts/rtk-word-header-footer-transaction.contract.test.js`
- `docs/tasks/2026-10-03--word-effective-style-return-mac.md`
- `docs/OPS/RTK/FEATURE_INTEGRATION_MANIFEST_WORD_EFFECTIVE_STYLE_RETURN_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`
- `test/contracts/rtk-word-heading-outline.contract.test.js`
- `test/contracts/revision-bridge-docx-inline-styles.contract.test.js`
- `test/contracts/rtk-word-review-default-typography.contract.test.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `src/core/word-paragraph-spacing-v1.cjs`
- `src/core/document-content-envelope-v1.cjs`
- `src/core/word-rich-body-projection-v1.cjs`
- `src/renderer/tiptap/documentParagraphAlignment.mjs`
- `src/renderer/editor.bundle.js`
- `src/export/docx/fullManuscriptDocxReviewPacketSource.js`
- `src/export/docx/docxReviewPacketBuilder.js`
- `src/export/docx/docxMinBuilder.js`
- `src/export/docx/docxReviewPacketNotes.js`
- `src/export/docx/docxReviewPacketStories.js`
- `src/export/docx/docxPendingRevisions.js`
- `src/utils/docxImportLocalFilePreview.js`
- `src/io/revisionBridge/reviewTransportStoriesV1.mjs`
- `src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs`
- `src/io/revisionBridge/reviewTransportMediaReturnV1.mjs`
- `src/io/revisionBridge/reviewTransportCleanLinkLabel.mjs`
- `test/contracts/rtk-word-paragraph-spacing.contract.test.js`
- `test/contracts/revision-bridge-docx-alignment.contract.test.js`
- `test/contracts/rtk-word-header-footer-runtime.contract.test.js`

## Current checks and retained limitation
Core spacing validation and persistence passed73 focused checks; renderer and export20, including raw accessor rejection before clone without invoking getters; actual Main six cases include the native-like spacing and three-slot language defaults. These are bounded automated evidence, not native acceptance or delivery. Exact run logs remain in the external task evidence directory.
Pending paragraph-format revisions with current spacing or paragraph-mark language are explicitly refused on export because the existing prior-state grammar cannot encode those properties. No current values are copied into historical pPrChange. This tracked-format limitation remains an open original-plan requirement; legacy alignment-only revisions retain their positive route.

Authenticated empty paragraphs now accept paragraph-only formatting operations with exact zero range and no inline actions. The transaction revalidates the signed source identity and requires an actually empty target; forged zero-range edits of nonempty text are refused. Actual Main evidence includes persistence, renderer publication and replay without a second write. This does not widen tracked-revision old-state support.

## SOURCE02 native canary at 935f9bdc
The identical actual Word artifact 6ae730fb489be11cce95d86bd20f02736ac4a5550f21915da2218760077d3580 was reopened in a byte-verified clean candidate using its retained owned project profile. Parsing no longer refused spacing/language, but candidate construction produced six safe operations and six manual items for unresolved fontFamily or textAlign removals. Apply was not executed; source scene SHA stayed cb41f5bae7e5c06343ff6d0cac02e82eef0544e4a882a765d4a05330e5bdf430. The native process exited and Documents were snapshotted. This is FAIL for the complete scenario, not acceptance of the safe subset.
Clean bootstrap and same-scope preflight were repeated at935f9bdc before repair. Hypothesis: validated effective font/default-left evidence is omitted from the comparison while baseline format IR contains explicit values. Repair must consume proof of the returned effective value, never copy baseline values or suppress unknown properties. Evidence: SOURCE-02-style-return-canary.json and SOURCE-02-AX-preview.txt.

Repair evidence: retained native DOCX SHA6ae730fb489be11cce95d86bd20f02736ac4a5550f21915da2218760077d3580 plus its actual persisted round exportMap now yields12 candidates and zero diagnostics. Read-only transformation preserves all six paragraphs, exact spacing and run/mark language, baseline fonts/alignment, text and metadata. Final affected94 checks and actual Main7 cases passed without skips. Independent probes retain refusal for bidi, missing/cyclic styles, invalid alignment and unknown default shape. Native repetition is still required. The earlier red diagnostic script incorrectly labeled a text-coerced Buffer hash as artifactSha256; only the corrected byte hash and retained source artifacts establish identity.
