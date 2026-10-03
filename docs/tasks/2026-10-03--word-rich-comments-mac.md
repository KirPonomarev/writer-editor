# WORD_RICH_COMMENTS_MAC_20261003

STATUS: TARGET_NOT_ACCEPTED
TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BASE_SHA: 23d8a2cb2ebfe897dd3cb9de0eb76eb0e2899574
AUTHORITY: Owner-authorized Mac Word plan P1-03 supported inline rich root and reply bodies. No whole-plan acceptance claim.

## MICRO_GOAL
O: Rich root and reply comment content survives generic import, actual editing, save/reopen, ordinary and Review export, Word formatting-only edits and authenticated Apply.
T: Bounded OOXML -> validated Core content -> Kernel/Main identity and capability revalidation -> existing atomic non-text transaction -> immutable projection and DOCX export.
H: Body-only comparison loses formatting; one canonical versioned richBody with checked derived literal body closes every seam without granting document authority.
B: Preserve old body-only state, authors/times/IDs, anchors, pending revisions, unsaved manuscript, original DOCX and recovery snapshots. No shell redesign or new dependencies.
P: Focused malformed/stale/format-only/legacy checks, early full native route, stable SOURCE and PACKAGED changed cycles, mandatory baseline/RTK/OSS/audit/CI, independent diff review and exact merged checks.
I: Clean fetched base above, verified encrypted T7, branch codex/word-rich-comments-mac-20261003; architecture preflight PASS before edits. Prior PR2073 delivery closed.

## ARTIFACT
One complete rich comment authoring and exchange capability, with independent native evidence.

## ALLOWLIST
- `src/core/word-comment-body-v1.cjs`
- `src/core/word-comment-authoring-v1.cjs`
- `src/core/word-comment-return-delta-v1.cjs`
- `src/io/revisionBridge/reviewTransportNonTextReturnRuntime.mjs`
- `src/export/docx/docxReviewPacketComments.js`
- `src/io/revisionBridge/reviewTransportPackageParserV2.mjs`
- `src/io/revisionBridge/genericWordComments.mjs`
- `src/io/revisionBridge/index.mjs`
- `src/main.js`
- `src/renderer/editor.js`
- `src/renderer/editor.bundle.js`
- `src/renderer/tiptap/manuscriptNotes.mjs`
- `src/renderer/tiptap/index.js`
- `test/unit/sector-m-toolbar-expansion-wave-a2.test.js`
- `test/unit/r24-wp204-lifecycle-recovery-mutants.test.js`
- `test/contracts/rtk-word-link-authoring.contract.test.js`
- `test/contracts/rtk-word-user-bookmarks-authoring.contract.test.js`
- `test/contracts/rtk-word-comment-authoring.contract.test.js`
- `test/contracts/rtk-word-comment-return-delta.contract.test.js`
- `test/contracts/rtk-word-canonical-comment-reexport.contract.test.js`
- `test/contracts/rtk-word-rich-comment-body.contract.test.js`
- `test/contracts/rtk-word-generic-comments.contract.test.js`
- `test/contracts/rtk-word-rich-comment-parser.contract.test.js`
- `test/contracts/rtk-word-rich-comments-renderer.contract.test.js`
- `docs/tasks/2026-10-03--word-rich-comments-mac.md`
- `docs/OPS/RTK/FEATURE_INTEGRATION_MANIFEST_WORD_RICH_COMMENTS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`

- `src/core/project-transaction-v1.cjs`
- `test/unit/r24-wp201-project-transaction.test.js`
- `test/unit/docx-import-safe-create.test.js`

- `src/export/docx/fullManuscriptDocxReviewPacketSource.js`

## DENYLIST
No out-of-scope writes, user-data modifications, new dependencies, runtime network, weakened gates, self-PASS, silent flattening, global Word quit, reset/stash/clean/force-push or historical evidence rewrite.

## CONTRACT / SHAPES
FEATURE_INTEGRATION_MANIFEST_V1: FEATURE_INTEGRATION_MANIFEST_WORD_RICH_COMMENTS_V1.json.
Message richBody is optional {schemaVersion:'yalken.word.comment-body.v1',document:{type:'doc',content:[paragraph...]}}. Legacy body-only messages remain intact. body is a checked derived literal projection, never a second independently editable truth. New rich intent may omit body; stored/imported messages with both must agree.
Core wrapper exports validateCommentRichBody, validateCommentMessageContent, commentBodyDocument and commentBodyEqual. Strict paragraph/text/hardBreak only; inline bold/italic/underline/strike/textStyle(color,fontFamily,fontSize,wordLanguage)/highlight/safe HTTP(S) link and existing supported paragraph attributes. Tabs and breaks retain literal and structural meanings. No comment lists/tables/media silently flattened.
Retain16KiB literal and64KiB aggregate state budgets. Formatting-only changes count as deltas; rich-to-plain explicitly removes stale rich content. Author/time/IDs/anchor ownership preserved. Comments relationships belong to comments.xml; modern metadata binds exact final paragraph.
UI reuses existing manuscript rich editor and Review rail. Draft editor persists across projection rerenders with undo/selection/IME; stale project or scene disables save without discarding draft. Failure preserves content; success or explicit cancel cleans up. No direct renderer persistence.
Design evidence: Lazyweb search41bcb2e9-cfeb-441b-817c-30861f4d5ece and ui-craft; no new CSS, shell structure, tokens or slots.

## IMPLEMENTATION_STEPS
Core/export, parser/import and renderer execute through separate code agents with disjoint files. Parent owns docs/OPS/bundle/checks/native/delivery. One integrated slice and rollback.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true.
ROLLBACK: Revert the single PR, retain fixtures and canonical transaction recovery data.

## CHECKS
CHECK_01_PRE_ADMISSION выполняется ДО любых изменений: mount/registry, exact clean base, bootstrap and canon reads, architecture preflight, task admission.
CHECK_02_POST_TARGETED выполняется ПОСЛЕ: strict profile and budget negatives, text agreement, legacy/N-1, semantic formatting-only delta, stale/replay/no-write/recovery, affected comment chains.
CHECK_03_POST_NATIVE выполняется ПОСЛЕ: early real Word root/reply multiparagraph canary before broad tests; final SOURCE/PACKAGED five altered cycles each, ordinary exports, reopen, independent XML and state graph oracle; native rich create/edit and failed/stale draft checks.
CHECK_04_POST_DELIVERY выполняется ПОСЛЕ: required baseline, full RTK, OSS/audit, guardrails, independent diff review, clean scope, commit/push/PR/CI/merge, exact merged-head checks.

## STOP_CONDITION
Stop affected path on mandatory failure; preserve input and first failing invariant. No new contour until this delivery closes.

## REPORT_FORMAT
One text block, exact identities, changed basenames, checks and delivery status, limitations, one next step.

## FAIL_PROTOCOL
After third identical failure signature stop looping; record exact HEAD/input/hashes/expected/actual and one new hypothesis.


N-1 amendment: existing v1 readers ignore unknown richBody and can flatten export; first rich write upgrades outer schema to yalken.rtk.word.non-text-return-state.v2 while retaining existing filename. Current readers support v1 and v2; v1 forbids richBody and v2 never downgrades. Generic append transaction must validate schema transition and unchanged prior threads. Expanded34-path clean preflight PASS before new-path edits; all seven existing owned files preserved externally and restored byte-for-byte.

Transport baseline amendment:35-path clean preflight PASS. Full-manuscript and selected-scene Review projection receives actual existing REVIEW_DOCX_TYPOGRAPHY_DEFAULTS; ordinary export keeps absence. Derived transportRichBody permits unchanged effective formatting comparison without altering legacy canonical content or inventing12pt for Minimal. Main selected-scene projection call is included in this exact scope.

Focused-editor amendment:36-path clean base preflight PASS before adding index.js. All23 existing owned changes backed up and restored byte-for-byte. Native Cmd-U in comment dispatched formatting to manuscript; executing real format dispatch with separate editor spies confirmed manuscript-only writes. Route formatting to focused auxiliary editor, forbid main fallback for unsupported or read-only auxiliary command, preserve main editor behavior when actually focused. Acceptance requires unchanged manuscript while rich root/reply edit saves.

Native IPC amendment: richBodyJson is an exclusive bounded string on the existing command envelope; Core parses only after UTF-8 byte bounds and strictly validates canonical richBody. No global IPC depth or key budget increase. Early native save exposed E_ENVELOPE_DEPTH; unchanged envelope validates the bounded string. Native next-save COMMENT_SAVE_SCENE_FIRST remains unresolved until focused routing and live-versus-saved scene comparison are checked.

Link-target amendment:38-path clean preflight PASS; existing link/bookmark handler harnesses updated to consume captured target API while preserving lifecycle and selection assertions. Global link dialog keeps original editor identity, document and selection across await; no main fallback for auxiliary editor.

Toolbar test amendment:39-path clean preflight PASS; update obsolete link dispatch source assertion to captured target API, retain behavioral selection and lifecycle tests. Own changes restored byte-for-byte.

Early native evidence (intermediate source snapshots, NOT final qualification):
- early02 local-toolbar save reproduced COMMENT_SAVE_SCENE_FIRST independently of Cmd-U routing. Actual full Tiptap schema adds only wordPendingRevisions:null and wordUserBookmarks:null at doc root; strict comparator now accounts for those declared defaults. Ten substantive property/ledger/registry changes still refuse.
- early03 actual Cmd-U reply edit saved revision1->2 with unchanged manuscript bytes, exported via native full Review menu, and Word opened both root and reply with bold/highlight/underline. Root select-all exposed NOTE_BODY_BREAK: real Tiptap marks the hardBreak. Comment-only validator/export/parser now retain and validate those marks; shared note grammar unchanged.
- early04 actual root Cmd-U saved revision2->3; formatted hardBreak retained and manuscript bytes unchanged. Native full Review export208ab49d3e0ee10fb79c54ce66d55ee6cc7f0ca4136301c10177926657b2d8ed opened in Word. Native comment Cmd-A/Cmd-I/Save produced73a5792c868849ecab8ac48607edde0ace55baf62ceb57085969f12c53ecc5f2. Native Open DOCX Review recognized one changed discussion and Apply committed revision3->4. Independent saved-state/XML checks: root literal/identity unchanged, all root text and break italic, reply exact unchanged, manuscript byte-identical. Break language inherited from actual Word docDefaults ru-FI (not a parser guess).
- Global async InsertLink captured-target correction independently reviewed; focused editor, snapshot and selection are bound across the dialog, with stale/destroyed/read-only/project-change refusal.
Final candidate SOURCE/PACKAGED qualification, broader mandatory checks and full delivery remain outstanding.

Final scope narrows from39 to37 paths: removed two nonexistent legacy shorthand test paths before any write. Actual existing rtk-word-c5v2 root/lifecycle suites remain read-only affected-chain checks, no implementation removed.

### OWNER_PAUSE_CHECKPOINT
PAUSED by direct owner instruction2026-10-03 in auditor chat: reboot requested. Working branch codex/word-rich-comments-mac-20261003, base23d8a2cb2ebfe897dd3cb9de0eb76eb0e2899574; current rich-comment delta is UNCOMMITTED and NOT_ACCEPTED. No push/PR/merge for this package.
Observed early source route: rich reply edit/save/export; root multi-paragraph+hardBreak edit/save; actual Word format change -> authenticated Apply -> restart, manuscript bytes unchanged. New root creation subsequently saved revision5; empty new reply draft explicitly cancelled before stopping own runtime. Test project preserved externally with WIP bytes and hashes.
209 integrated focused checks passed before the latest digest repair; OSS policy and npm audit exited0. Baseline01 and RTK01 were explicitly aborted as superseded after independent review found root supportedSemanticDigest omitted richBody; neither is PASS. Parser root digest now includes richBody, but its new focused regression currently FAILS; last log preserved. No further investigation after pause.
Runtime early04 does not include the latest digest repair. Source bindings/OPS hashes and bundle require freshness recheck after resume. Full stable SOURCE/PACKAGED acceptance and required delivery remain outstanding.
ONE_NEXT_STEP: inspect saved rich-root-semantic-digest-fixed.log and resolve the digest regression without losing assertions, then continue existing package acceptance. Do not resume until new direct owner authorization.

RESUMED after owner instruction in auditor chat following reboot. Verified encrypted mount UUID, linked worktree and all39 saved file hashes. Root semantic digest regression repaired without runtime delta: compare complete semantic reply and separately verify exact XML offsets in each input;22of22 focused parser checks PASS0skip. This supersedes the checkpoint's active pause and failing-test status only; package acceptance remains incomplete.


Baseline repair amendment:38-path clean preflight PASS at candidate80fdb2ff before repairs; original integrated delivery base remains23d8a2cb. Baseline candidate run completed2141pass5fail59skip. Preserve legacy DOCX malformed-surrogate diagnostic before rich-body validation; include the new body module in the isolated lifecycle mutation sandbox. Existing negative assertions and all seven mutants unchanged;43focusedchecksPASS0skip. Three timing failures independently rerun sequentially:11of11PASS0skip; this does not turn the failed baseline green.
SOURCE01 candidate evidence: actual Word root italic formatting Apply revision3->4; independent XML/state oracle19assertionsPASS, reply/anchor/identity/literal/main scene preserved. Repeating the same DOCX Apply leaves state bytes and revision4 unchanged. Later root Cmd-U and local underline button both advanced revision without retaining intended underline. These authoring observations are FAIL, not acceptance; UI serialization investigation active. SOURCE/PACKAGED full qualification and delivery remain incomplete.

Native authoring root cause and repair: shared document language validation rejects formatted hardBreak language admitted by comment grammar. The comment editor now validates a marked break through an exact temporary newline text node and restores its structural position; manuscript language grammar is unchanged. Save reads the live editor and refuses serialization errors before dispatch, preserving the draft instead of publishing its prior value. Actual-schema underline, invalid-language, and failed-save checks cover this path. Runtime01 is superseded for final authoring acceptance; its independent Word Apply/replay observations retain only their original80fdb2ff scope.
