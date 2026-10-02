# WORD_BOOKMARK_PARAGRAPHS_MAC_20261002

STATUS: CANDIDATE_NATIVE_OBSERVED_DELIVERY_PENDING
DOCUMENT_CLASS: TASK_CONTRACT
CLAIM_BOUNDARY: Controlled same-scene root paragraph bookmark rebasing on macOS.
BASE_SHA: 7194efc84339bf8346b92dd11ddc33a9734699d6
TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3

## MICRO_GOAL

O: Enter, join, multiline insertion and its pure-deletion inverse preserve bookmarked text identity and
internal links through save, Undo/Redo, restart and DOCX export to Word.
One bounded P2d substep, not full P2d or whole Mac acceptance.

## ARTIFACT

Existing Core planSave extension and behavioral contracts.
FEATURE_INTEGRATION_MANIFEST_WORD_BOOKMARK_PARAGRAPHS_V1.json records existing
product and interface seams. External architecture declaration passed preflight
on clean exact base before these drafts. Design routing is recorded in that
declaration: no product design changes.
No UI design change. Diff budget: one Core module, two existing test modules,
its mechanically generated editor bundle and required task/manifest/governance
companions; no unrelated refactoring.

## ALLOWLIST

- `src/core/word-user-bookmarks-v1.cjs`
- `src/renderer/editor.bundle.js`
- `test/contracts/rtk-word-user-bookmarks.contract.test.js`
- `test/contracts/rtk-word-user-bookmarks-runtime.contract.test.js`
- `docs/tasks/2026-10-02--word-bookmark-paragraphs-mac.md`
- `docs/OPS/RTK/FEATURE_INTEGRATION_MANIFEST_WORD_BOOKMARK_PARAGRAPHS_V1.json`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`

## DENYLIST

No new schema, writer/store, dependency, runtime network, UI composition, owner
checkout mutation, test weakening, guessed endpoint ownership or arbitrary
replacement-plus-restructure. Cell/list ownership changes and scene move/copy
remain separate full-plan work. Preserve inherited registry decoder boundary.

## CONTRACT / SHAPES

T: Saved scene/registry -> exact inherited registry check -> Core mapping ->
Main capability, lease and CAS -> existing atomic scene/notes/comments writer.
H: Ordered protected blocks and typed paragraph separators permit bounded
unambiguous root paragraph edits while preserving all protected ownership.
For every minimal candidate placement, bookmark endpoint outcomes must agree.
Text insertion retains existing left affinity. afterParagraph remains attached
to its concrete paragraph terminator; deleted or ambiguous ownership refuses.
B: IDs, names, tombstones, link targets, rich marks, notes/comment bodies,
protected table/list subtrees, undo history and recovery remain intact.
I: Exact base above; branch codex/word-bookmark-paragraphs-mac-20261002.
Paragraph attributes must be compatible; hardBreak is not a paragraph separator.
Current same-structure behavior and malformed/stale input refusals remain.
Root text duplication by multiline insertion is supported only when all endpoint
placements agree; it retains existing IDs and creates no copied bookmarks.
Protected block copy, reordering and forged registry authority still refuse.

## IMPLEMENTATION_STEPS

1. Add literal root split/join/multiline mapping counterexamples, then implement
   minimal Core extension through existing authoritative save path.
2. Execute real PM/history and Main atomic save/reopen with adjacent notes,
   comments, internal links and protected table/list leaves.
3. Run short native SOURCE and PACKAGED edits/export/Word readback before full CI.
4. Freeze reviewed candidate; required companions, commit, push, PR, CI, merge,
   exact merged-head checks. No full RTK against dirty worktree.
Source-copy verification found the changed Core is bundled into editor.bundle.js;
include its ordinary generated rebuild in scope before the first bundle write.
This changes no renderer source or UI contract.
brain:refs found generic references only; actual source and executable root
Enter-before-table probe are the relevant integration references.

## CHECKS

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
CHECK_01_PRE_ADMISSION: clean exact base, matching T7 mount UUID/encryption/
unlocked/writable, bootstrap, ordered canon reads, architecture preflight.
CHECK_02_POST_CORE: endpoints before/inside/after edits, empty/repeated leaves,
Unicode, cross-paragraph spans, point anchors, afterParagraph, rich marks,
protected subtree shifts; ambiguous/forged/boundary-invalid cases refuse.
CHECK_03_POST_CHAIN: actual Main writer and real PM history preserve IDs,
notes/comments and links across save, Undo/Redo/reopen; stale and unsupported
writes leave all protected files unchanged. Existing save regression stays green.
CHECK_04_POST_NATIVE: SOURCE and PACKAGED Enter/join/multiline paste, Undo/Redo,
restart and DOCX export reopened by Word; inspect XML identities independently.
CHECK_05_POST_DELIVERY: reviewed diff, guardrails, mandatory baseline and frozen
CI; complete required delivery chain and exact merged-head verification.
Missing, skipped or stale evidence never becomes PASS.

## STOP_CONDITION

Bounded outcome observed with required evidence and delivery complete.
No broader feature completeness or full-plan percentage follows automatically.
Stop unsafe writes on ambiguity; retain exact failed counterexample.

## REPORT_FORMAT

CODEX_OUTPUT_POLICY: one text block, KEY: VALUE, basenames only.
Report task, base/candidate/merged SHA, changed basenames, tests, commit, push,
PR, CI, merge, exact-head verification, residuals and next action.
DELIVERY_POLICY: commitRequired=true; pushRequired=true; prRequired=true;
mergeRequired=true; postMergeExactHeadVerificationRequired=true.

## FAIL_PROTOCOL

Repair failed invariant with focused proof; after three identical failures
record exact counterexample and change hypothesis. Preserve unrelated work.
ROLLBACK: revert bounded Core extension; no format migration, preserve all
scene registries, document bytes and readable recovery.

## OBSERVED_CANDIDATE_EVIDENCE

Core candidate SHA-256: 27262669887bf9fb5c9b42ac9fa939c9edb6510c43066bc4637111a4c0227d7b.
Focused actual PM/Main suite: 196 passed, zero failed/skipped/todo under Node
22.12.0. Literal endpoint tests include root split/join, multiline insertion and
inverse deletion, retained mark/property checks, ambiguous repeated content,
protected table/list occurrence identity, Unicode and afterParagraph ownership.
Actual Main tests exercise the scene/note/comment atomic cohort and injected
publication failure with recovery. Independent code review found no blocker;
comparison-only default normalization leaves raw published content unchanged.

Native SOURCE and PACKAGED runtime-02: imported the same seven-bookmark,
two-internal-link Word fixture; Enter, Undo, Redo, Backspace join, multiline paste,
Undo and Redo all saved the expected endpoint registry to disk. Each of seven
phase scene hashes matched between builds. Both restarted and exported DOCX;
Microsoft Word opened each named output with expected text and both links.
Independent standard-library OOXML traversal matched all seven named start/end
positions, including the afterParagraph marker, to saved canonical registry.
Final scene SHA-256: ee77062349052a1fcc932daeb18ef7918d9f9e24400936f6a574a91f0000c9a8.
External evidence: native02-independent-ooxml-check.json and per-phase snapshots.
Exact committed SOURCE/ASAR product-byte binding, CI and delivery remain separate
mandatory gates; this observation is not whole-plan or five-cycle acceptance.

An earlier native diagnostic exposed pinned PM defaults absent in imported
paragraphs. Comparison now removes only exact schema defaults and preserves all
meaningful/unknown values; the actual PM/Main regression covers this failure.
The unchanged source01 snapshot is excluded from positive evidence.
The generated bundle scope amendment passed preflight on a clean exact-base
linked checkout before bundle write. A prior dirty preflight attempt failed and
was not used as admission.
