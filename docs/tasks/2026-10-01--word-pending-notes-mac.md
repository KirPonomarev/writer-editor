# WORD_PENDING_NOTES_MAC_20261001

STATUS: TARGET_NOT_ACCEPTED
DOCUMENT_CLASS: TASK_CONTRACT
CLAIM_BOUNDARY: Unchanged-note single-scene pending text roundtrip on macOS only.
BASE_SHA: 3cc581010faefe65dffece89398c89852450a2ea
TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3

## MICRO_GOAL

O: Return tracked text around existing footnotes/endnotes; preserve each note
through explicit Apply, accept/reject, Undo/Redo, restart and DOCX re-export.
This is the unchanged-note substep of P2d, not the whole P2d or full Mac plan.

## ARTIFACT

Existing pending-ledger extension, parser/export/Main integration and focused
behavioral tests. Integration contract:
FEATURE_INTEGRATION_MANIFEST_WORD_PENDING_NOTES_V1.json.
Architecture declaration and passed pre-write preflight are preserved externally.
Design routing is recorded in that declaration: no product design changes.

## ALLOWLIST

- `src/main.js`
- `src/core/word-pending-text-revisions-v1.cjs`
- `src/core/word-pending-recording-v1.cjs`
- `src/core/word-manuscript-notes-v1.cjs`
- `src/core/word-note-return-delta-v1.cjs`
- `src/core/document-content-envelope-v1.cjs`
- `src/io/revisionBridge/index.mjs`
- `src/io/revisionBridge/reviewTransportPackageParserV2.mjs`
- `src/export/docx/docxPendingRevisions.js`
- `src/export/docx/docxReviewPacketBuilder.js`
- `src/export/docx/docxMinBuilder.js`
- `src/renderer/editor.bundle.js`
- `test/contracts/rtk-word-pending-notes.contract.test.js`
- `test/contracts/rtk-word-pending-return-runtime.contract.test.js`
- `test/contracts/rtk-word-pending-revisions-runtime.contract.test.js`
- `test/contracts/rtk-word-pending-rich-blocks.contract.test.js`
- `test/contracts/rtk-word-nested-tables.contract.test.js`
- `docs/tasks/2026-10-01--word-pending-notes-mac.md`
- `docs/OPS/RTK/FEATURE_INTEGRATION_MANIFEST_WORD_PENDING_NOTES_V1.json`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`

## DENYLIST

No unrelated work, package metadata, workflow weakening, new writer/store,
UI composition, heuristic Current-to-source inversion, silent downgrade,
unvalidated annotation authority or changes to the canonical owner checkout.
Changed note bodies, multi-scene pending intake, mixed comments/media and
unsupported structural changes remain separate explicit full-plan residuals.

## CONTRACT / SHAPES

T: Saved canonical scene and notes -> locally authenticated export map -> bounded
OOXML projection -> Main admission -> Command Kernel -> existing atomic writer.
H: Distinct source points collapse across deleted text. Versioned source-point
bindings in the existing pending ledger and round frames preserve identity.
Shape: noteSourcePoints [{noteId, paragraphIndex, offsetUtf16}], strictly bounded
and validated; unchanged note identity/kind/body proven against retained baseline.
B: Preserve note ids/bodies, other scenes, prior ledgers, comments, images and
native source evidence. Unsupported composites refuse before any write.
I: Exact base above; branch codex/word-pending-notes-mac-20261001.
N-1 readers must reject unsupported semantics, never silently drop fields.
Equal visible text is not sufficient for a no-write decision: repeated text can
retain the same string while the canonical note reference changes occurrence.
Recording preserves new bindings when supported or rejects before mutation.

## IMPLEMENTATION_STEPS

1. Reproduce collapsed endpoint case AxxB deletion [1,3): source note points 1
   and 3 project to Current 1 but Reject must restore their separate positions.
2. Implement the minimal durable identity solution through existing Core,
   authenticated Main transaction and DOCX parser/export/readback path.
3. Run short real SOURCE and PACKAGED cycles before broad frozen validation.
4. Freeze reviewed candidate; update necessary governance companions; complete
   commit, push, PR, required CI, merge and exact merged-head verification.
Existing brain:refs returned generic writing-app references; no copied code.

## CHECKS

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
CHECK_01_PRE_ADMISSION: clean exact base, T7 identity/encryption/unlocked/writable,
bootstrap, ordered startup reads and architecture preflight (already passed
before the two saved parent task/manifest drafts; do not rerun PRE on dirty WIP).
CHECK_02_POST_CORE: schema upgrade and old-reader refusal; both deletion endpoints,
disjoint edits, repeated/empty/nested leaves, Unicode boundaries, all decision
states, round Undo/Redo and envelope reparse preserve each note identity.
CHECK_03_POST_CHAIN: actual authenticated Main Apply/export and atomic scene/notes
writer; reject changed note body/id, missing/duplicate/consumed points, stale
notes digest, bypass, replay, CAS and transaction failure without partial writes.
CHECK_04_POST_NATIVE: SOURCE and PACKAGED Word edit, explicit Apply, accept/reject,
Undo/Redo, process restart, reexport and independent note position/body readback.
CHECK_05_POST_DELIVERY: scope and diff review, guardrails, applicable baseline,
mandatory frozen CI, full delivery chain and exact merged-head focused proof.
No synthetic writer or source-string-only assertion replaces transaction proof.

## STOP_CONDITION

One bounded delivered route with observed outcome and required evidence.
Missing proof stays UNKNOWN; no full-plan acceptance or five-cycle claim by
implication. Stop unsafe mutation on authority ambiguity or protected-state risk.

## REPORT_FORMAT

CODEX_OUTPUT_POLICY: one text block with KEY: VALUE lines and basenames only.
Report task id, before/after/merged SHA, changed basenames, tests, commit, push,
PR, CI, merge, exact-head verification, residuals and one next action.
DELIVERY_POLICY: commitRequired=true; pushRequired=true; prRequired=true;
mergeRequired=true; postMergeExactHeadVerificationRequired=true.

## FAIL_PROTOCOL

Repair specific failed invariant with targeted proof before repeating heavy
checks. After three identical failures retain exact counterexample and choose
one new hypothesis. Preserve owned WIP and all unrelated state; no reset/clean.
ROLLBACK: revert this extension while preserving documents and recovery;
old readers refuse unsupported ledger identity rather than flattening it.
