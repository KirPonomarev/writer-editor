# Mac novel pending revisions and comments

TASK_ID: WORD_PENDING_COMMENTS_MAC_20261005
TYPE: CORE
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
MODE: A
STATUS: IMPLEMENTING_NOT_ACCEPTED
BASE: f557f7cb0b267ccbee7c7c24406727e2bc925c16
COMMIT_REQUIRED: true
PUSH_REQUIRED: true
PR_REQUIRED: true
MERGE_REQUIRED: true

## MICRO_GOAL
O: shared authored novel with retained inline insertion/deletion and canonical
root/reply comments: generic import, normal editing/save, ordinary + Review
export, actual Word reply-only return through explicit Apply, replay/restart.
Current/Original text, pending ownership, provenance, rich formatting, typed
breaks, every scene and ledger/history bytes survive reply-only return.


Original whole Mac plan remains open. Writer/editor/proofreader text workflows
have priority. This packet does not close revision accept/reject with comments:
Main currently refuses those decisions while active scene comments exist.

## ARTIFACT

Current architecture declaration and FEATURE_INTEGRATION_MANIFEST_WORD_PENDING_COMMENTS_V1.json,
production code, contract tests and bound native SOURCE/PACKAGED observations.

## ALLOWLIST

- `src/core/word-pending-text-revisions-v1.cjs`
- `src/core/word-comment-return-delta-v1.cjs`
- `src/export/docx/docxPendingRevisions.js`
- `src/export/docx/docxReviewPacketComments.js`
- `src/export/docx/docxMinBuilder.js`
- `src/export/docx/docxReviewPacketBuilder.js`
- `src/export/docx/fullManuscriptDocxReviewPacketSource.js`
- `src/io/revisionBridge/reviewTransportPackageParserV2.mjs`
- `src/io/revisionBridge/genericWordComments.mjs`
- `src/io/revisionBridge/index.mjs`
- `src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs`
- `src/main.js`
- `src/renderer/editor.bundle.js`
- `test/contracts/rtk-word-pending-text-revisions.contract.test.js`
- `test/contracts/rtk-word-comment-return-delta.contract.test.js`
- `test/contracts/rtk-word-pending-revisions-package.contract.test.js`
- `test/contracts/rtk-word-pending-rich-blocks.contract.test.js`
- `test/contracts/rtk-word-canonical-comment-reexport.contract.test.js`
- `test/contracts/rtk-word-generic-comments.contract.test.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `test/contracts/rtk-word-comment-return-apply.contract.test.js`
- `test/unit/docx-scene-comments.test.js`
- `test/contracts/rtk-word-scene-comment-export.contract.test.js`
- `docs/tasks/2026-10-05--word-pending-comments-mac.md`
- `docs/OPS/RTK/FEATURE_INTEGRATION_MANIFEST_WORD_PENDING_COMMENTS_V1.json`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/CONTEXT.md`
- `docs/HANDOFF.md`
- `docs/WORKLOG.md`

## DENYLIST

No reset, stash, clean, rebase, amend, force-push, owner-checkout mutation or
unrelated cleanup. No dependency, runtime network, UI design or private owner
corpus change. No silent metadata loss, ledger rewrite for reply-only return,
blanket guard deletion, automatic revision decisions or self-PASS. Paths not
listed in the admitted declaration require a clean checkpoint and preflight
before edit. No merge before required proof. Scope exceptions need explicit
recording; protected original work remains intact.

## CONTRACT / SHAPES

T: canonical scene ledger/comment state -> validated signed export and private
parsed evidence -> Core independent proof -> existing Main/Kernel revalidation
and leased atomic comment writer. No scene writer for unchanged pending reply.

H: current guards conflate unchanged tracked content with revision decisions,
and comment source/current coordinates plus Word native wrapper partition are
not modeled in the mixed route. Finite occurrence laws preserve both meanings.

B: no dropped hierarchy/marks/anchors, no second truth/writer, no newdependency,
no changed product design. Existing notes/bookmarks/media/structural revisions
remain protected; unsupported mixed cases refuse, not flatten. New runtime
network, private owner corpus, automatic accept/reject and broad guard removal
are outside scope. Revert one packet, preserve readable data/recovery.


- Pure Core buildCommentExportBinding and verifyCommentReturnBinding in current
  pending model; exact names/signatures coordinated before implementation.
- Signed map ties bounded baseline ledger digest, union/Current/Original rich
  projections, revision spans and exact comment occurrence endpoints. Main
  carries validated returned ledger/atoms, never a trusted:true flag. Core
  recomputes full proof before comment delta and during existing publication.
- Export emits one native wrapper per original revision. Actual Word may
  split it around comment reply references. Allow only an ordered gapless
  nonoverlapping partition within one authenticated span; every fragment used
  once, no crossing/merging of two canonical revisions, no empty wrapper.
- List continuation remains owned by its original list item. Indentation alone
  is not sufficient evidence. A finite explicit exporter style/semantic marker
  may declare continuation for generic parsing; validate marker grammar and
  prior list ownership. The marker supplies document semantics only, never
  command/storage authority. Signed return also checks authenticated block
  ownership. Unknown or contradictory declarations refuse; no flattening.
- Exact operation/provenance/rich atom equality. Current and Original both
  equal. Zero-width comment markers/reference runs are not manuscript text.
- Current anchors inside insertion map through unique source occurrence;
  hidden-deletion ambiguity refuses unless exact source provenance exists.
  Union quote and Current quote are independently validated, never substituted.
- Every baseline pending scene is accounted, even without changed comments.
  Keep original canonical ledger bytes/history; only one new reply admitted
  for first signed mixed route. All foreign or changed states no-write.
- Emitted paragraph layout is bound by exact original signed exportParagraphs
  and independently verified canonical quote/list role. Missing canonical
  indentation may acquire only the producer's proven effective default in an
  ephemeral comparison projection. Authored indentation is never replaced;
  returned full indent object must equal expected, including absence of extra
  right/hanging/firstLine properties. No normalization of arbitrary indent.
- Effective typography may normalize ONLY explicitly signed emitted defaults.
  Existing exportTypography binds fontSize only; no guessed font/language.
  Actual explicit font/language positive corpus; unresolved inheritance stays
  an explicit remaining case until backed by a finite source-style binding.


## IMPLEMENTATION_STEPS


Use MULTI_SCENE/C2 DEFAULT 3scenes first, same FULL_SYNTHETIC_NOVEL100k later.
Keep quote/code blocks, list continuation, HTTP links and marked hardBreaks.
Core finite admission + real generic single-scene import must preserve these;
separate-scene signed proof alone does not establish generic whole-book route.
500k boundary and five changed cycles remain original final acceptance.

Core agent: pending model, comment-return-delta, focused laws/tests.
Parser/export agent: finite pending parser/generic comment projection, ordinary
and Review marker emission, full manuscript signed map and readback; tests.
Main agent: src/main.js + actual scene-identity-main test. Replace exact export
guard with proof; classify before prepareAuthenticatedPendingReturn; existing
comment writer only with complete private proof.
Root: docs/OPS, build, native fixture and execution, proof/delivery.

Negatives: missing/extra/changed revision or provenance, modified second fragment,
untracked gap, crossrevision fragment, empty revision, altered Current/union
anchor, hidden deleted endpoint ambiguity, stale sibling/raw/hash/generation/
comment state, malformed hierarchy/marks/tuple/link and invalid native graph.
No synthetic self-pass, skips or stale evidence supplies acceptance.

1. Implement the finite mixed route in the declared disjoint code lanes.
2. Exercise actual generic and Main signed paths before broad checks.
3. Freeze a clean candidate, run SOURCE and PACKAGED with real Word reply,
   inspect persisted scenes/ledger/comment state, restart and replay.
4. Run direct consumers and mandatory gates on stable bytes; deliver through
   PR and verify exact merged SHA. Continue original plan only after closure.

## CHECKS

CHECK_01_PRE_ADMISSION: completed before first edit: verified T7 UUID,
encryption/unlocked/writable state, canonical worktree identity, bootstrap,
canon reads and clean exact-base 34-path preflight. PR2081 already delivered
with CI19/19, fullRTK3295/3295 twice and merged401/401 plus Git/OPS/guardrails.
Scope amendment: clean checkpoint8039bf18f, preflight36paths PASS before edits
to the two direct consumer tests. The original delivery base remains f557f7cb0.

CHECK_02_POST_VERTICAL: actual generic import and Main signed reply-only Apply;
normal, boundary, foreign/stale inputs; no writes on refusal, complete retention.
CHECK_03_POST_NATIVE: real Word reply on immutable exported artifacts; SOURCE
and PACKAGED import/export/preview/Apply/replay/restart bound to runtime bytes.
CHECK_04_POST_REGRESSION: relevant consumer suite, renderer build, inventory,
mandatory repository baseline/CI/guardrails; no skipped or stale credit.
CHECK_05_POST_DELIVERY: declared scope and diff review, commit/push/PR/merge,
exact clean merged-tree verification and relevant checks on merged SHA.
CHECK_01 executes before edits; CHECK_02+ executes after edits.

Observed early integration gaps (not accepted): Word native reply splits one
revision wrapper; union/current comment coordinates differ across deletion;
Word adds section metadata; a reply-only early route needs full protection of
nonpending scene formatting, notes and stories. These are checked before CI.
The first preliminary export was overwritten by its generator; retained native
file is diagnostic only, with original observed hash and explicit missing-pair
qualification. Subsequent native artifacts use immutable generation names.

Candidate-focused evidence: actual Main13/13, scene consumers33/33, Core51/51;
no full candidate acceptance from these counts. Native Word v04 true language
changes refused; preserved as negative and separate original-plan residual.
Actual Word v04 file is next generic input baseline, never edited to fit proof.

## STOP_CONDITION

No missing authority, ambiguous identity, unpreserved manuscript/metadata,
bypassed revalidation, required-proof failure or open blocking finding.
At third identical failure stop that loop, record exact expected/actual/hash,
and choose one evidence-backed next hypothesis. Whole-plan DONE is not implied
by completing this bounded packet.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1: task, before/after/merged SHA, changed basenames, tests,
commit/push/PR/CI/merge outcomes, exact-head proof, residuals and next step.
For task completion report one text code block with KEY: VALUE, no URLs/paths.

## FAIL_PROTOCOL

Preserve failing evidence, original artifacts and exact source bindings; no
synthetic PASS. Repair only inside declared scope, rerun affected proofs after
changes. Revert the single packet for rollback; keep user data and recovery.

Process correction 2026-10-05: initial task prose had required substantive
scope/declaration but lacked the ten-section HARD task presentation. Corrected
before candidate acceptance; earlier validation never claimed task-shape PASS.
