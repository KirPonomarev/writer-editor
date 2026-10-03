# WORD_EFFECTIVE_STYLE_RETURN_MAC_20261003

STATUS: TARGET_NOT_ACCEPTED
BASE_SHA: e4be0d8d22937745f691dc6121541278668139ed
AUTHORITY: Original Mac Word plan P3-08; existing effective-values and semantic-role contract, not full named-style identity preservation.

## MAP
O: Actual Word style-based changes of supported alignment, outline and inline formatting become correctly bound explicit Apply candidates, persist, restart and reexport through existing writers.
T: Untrusted bounded Word XML -> validated effective-style projection -> existing round/scene/block authority -> Main capability and revision revalidation -> existing atomic formatting writer -> renderer projection.
H: Current scanner reads only direct pPr and marks pStyle unsupported. A literal Derived basedOn Base with jc right yields empty paragraphState and unsupported pStyle. Resolve active style defaults and chains before existing action construction; unknown properties must stay unsupported.
B: Preserve source DOCX, unrelated content, exact text/scene identities, pending review, private notes, unsaved authoring, CAS and recovery. No new Core schema, style-ID persistence, UI controls, dependency or runtime network.
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
Paragraph spacing, indentation and custom tab stops; custom/multilevel numbering patterns; other original Mac families and whole-plan qualification remain open. This package cannot claim these from style resolution alone. Named style identity loss is allowed only with existing explicit disclosure.

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
