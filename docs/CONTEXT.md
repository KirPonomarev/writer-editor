# CONTEXT (Yalken Writer)

Этот файл фиксирует фактическое текущее состояние репозитория после repo-level closure, последующих bounded false-green remediation contours и принятой vertical sheets baseline, уже смерженных на main.

## Как читать репозиторий
- Верхний repo entrypoint: `CANON.md`
- Active execution canon: `docs/OPS/STATUS/CANON_STATUS.json`
- Target architecture: `docs/corex/COREX.v1.md`
- Product map: `docs/BIBLE.md`
- Process rules: `docs/PROCESS.md`
- Quick re-entry: `docs/HANDOFF.md`

## Stable Product Reality
- Продукт: `Yalken Writer`
- Режим: desktop-first, offline-first
- Текущий release axis: `Writer v1`
- Active product truth после cutover должна быть одна

## What Is Already True

### Primary editor closure
- Primary editor path закрыт machine-bound closure packet.
- Tiptap path является основным editor path.
- Legacy editor path больше не считается основной operating truth.
- No input loss rollup закрыт.
- IME composition для closure gate подтверждён.
- Existing DOCX baseline связан с machine-carried evidence.

### Import/export MVP scope closeout
- Import/export product acceptance gate is merged on current mainline via PR `1002` at merge SHA `7deeaa8f3cbbabe912df4862b2fb88d472cb11d3`.
- Active acceptance artifact is `IMPORT_EXPORT_PRODUCT_ACCEPTANCE_GATE_001_STATUS.json` with status `PASS_TO_CLOSEOUT`.
- MVP-scope product flows accepted by that gate are exactly: DOCX export, DOCX import preview accept open-scene, Markdown import, and Markdown export Save As.
- Mindmap is accepted only as derived runtime/status binding; no user-facing Mindmap export command is claimed.
- The closeout binding contour records the feature status as `FEATURE_CLOSED_FOR_MVP_SCOPE` for the named flows only.
- This closeout does not claim full release readiness, packaged release readiness, cross-platform readiness, full npm test green, production picker coverage for Markdown export or DOCX import, perfect Word layout parity, broad DOCX/Markdown fidelity, PDF/EPUB/HTML export, cloud, sync, accounts, new dependencies, or user-facing Mindmap export.

### Review bridge exact-apply lane closeout
- Review bridge controlled multi exact apply is merged on current mainline via PR `1007` at merge SHA `b12ef9178a2e86a3ee758815758bc05dde70f8cc`.
- The delivered implementation artifact is `REVIEW_BRIDGE_CONTROLLED_MULTI_EXACT_APPLY_001_R2_STATUS_V1.json` with status `delivered_merged_verified`.
- Active product closeout artifact for this lane is `REVIEW_BRIDGE_APPLY_LANE_PRODUCT_CLOSEOUT_REBIND_001_STATUS.json`.
- The exact-apply lane is closed for current MVP scope only: single exact text apply, duplicate/stale/dirty guards, and controlled same-scene batch exact apply.
- Batch exact apply is all-or-none within one scene file through command bus, main-owned context, safe writer, recovery evidence, and intent-only renderer payload containing only `requestId` and `changeIds`.
- Local JSON review packet product entry is now bound by `REVIEW_BRIDGE_LOCAL_PACKET_PRODUCT_ENTRY_001_STATUS.json`: Review menu exposes Import Review Packet and Clear Review Session, `cmd.project.review.importLocalPacket` owns dialog/read/parse in main, renderer sends only `requestId`, and successful import opens Review/Comments through canonical runtime command handling.
- Local packet intake rejects imported write-evidence fields such as receipts/applied result fields and restats the selected file before read.
- This local packet entry is session/preview wiring only; it does not write manuscript truth and does not authorize apply.
- Local JSON review packet E2E proof is bound by `REVIEW_BRIDGE_LOCAL_PACKET_E2E_PRODUCT_PROOF_001_STATUS.json`, merged via PR `1011` at merge SHA `a8ea40692afb3c2ef9c30f8152315f13375d3f48`: the proof covers default main-owned local file intake through the menu command handler, Review/Comments opening, exact single apply after import with receipt and recovery evidence, same-scene batch exact apply after import, mixed structural packet manual-only behavior, and clear-session empty surface.
- This E2E proof changed tests and status docs only; it did not change production runtime code and did not expand import/export MVP scope.
- DOCX review preflight contour is delivered and merged via PR `1013` at merge SHA `34895b960a723b816ccb7f50f171854675a43969`; it is tracked by `REVIEW_BRIDGE_DOCX_PREFLIGHT_001_STATUS.json`.
- `cmd.project.review.inspectDocxReviewPreflight` returns a pathless diagnostic-only report for DOCX comment and tracked-change evidence while keeping `canOpenReviewSession`, `canAutoApply`, `canCreateReviewPacket`, `canImportMutate`, and `canWriteStorage` false.
- The DOCX review preflight contour uses existing bounded ZIP and XML-scan primitives, adds no dependency, does not route through the DOCX import safe-create flow, and does not mutate project truth.
- DOCX review preview session activation is delivered and merged via PR `1014` at merge SHA `c608541f93688150ddc3d0dee08b33dfaab01e5f`; it is tracked by `REVIEW_BRIDGE_DOCX_PREVIEW_SESSION_ACTIVATION_001_STATUS.json`.
- `cmd.project.review.activateDocxReviewPreviewSession` accepts pathless DOCX bytes, converts DOCX comments into bounded Review Packet comment threads, activates an in-memory Review session through Stage01 preview, and opens Review/Comments on success.
- The DOCX review preview session activation contour keeps tracked changes diagnostic-only, keeps comment placements manual, uses main-owned current project/file/baseline context, and does not write manuscript truth, project truth, receipt, or recovery evidence.
- DOCX review local-file entry is delivered and merged via PR `1015` at merge SHA `824d96b739bdbd8b7a45b1bf1664b003a2a65fd2`; it is tracked by `REVIEW_BRIDGE_DOCX_REVIEW_LOCAL_FILE_ENTRY_001_STATUS.json`.
- DOCX comments-only review preview product proof is delivered and merged via PR `1016` at merge SHA `80706d1205049d071b1737634dc41cd9125e26d8`; it is tracked by `REVIEW_BRIDGE_DOCX_COMMENT_ONLY_PRODUCT_PROOF_001_STATUS.json`.
- The proof covers the current DOCX comments-only review preview path: Review menu exposes `cmd.project.review.openDocxReviewPreviewSession`, main owns DOCX picker/stat/read/restat, selected DOCX comments reach the in-memory Review surface as commentThreads plus manual commentPlacements, and successful activation opens Review/Comments through the canonical runtime command path.
- The DOCX comments-only review preview path does not route through DOCX import preview or DOCX safe-create and does not create textChanges from tracked changes, applyOps, manuscript truth writes, project truth writes, receipt, or recovery evidence.
- DOCX diagnostic evidence surface contour is delivered and merged via PR `1020` at merge SHA `02754b5f6ac6bd231b6d47659453ab92ddd6d979`; it is tracked by `REVIEW_BRIDGE_DOCX_DIAGNOSTIC_EVIDENCE_SURFACE_001_STATUS.json`.
- A tracked-changes-only DOCX can now open a visible diagnostic-only Review surface as read-only diagnosticItems while keeping `canOpenReviewSession`, `canCreateReviewPacket`, `canAutoApply`, `canImportMutate`, and `canWriteStorage` false; clean DOCX with no evidence remains no-candidate/passive.
- This diagnostic evidence surface still does not route through DOCX import preview or safe-create and does not create textChanges, applyOps, manuscript truth writes, project truth writes, receipt, or recovery evidence.
- Review Bridge first useful release gate is delivered and merged via PR `1018` at merge SHA `d76485d152c1bfa1cb00bf9eda0c242596785352`; it is tracked by `REVIEW_BRIDGE_FIRST_USEFUL_RELEASE_GATE_001_STATUS.json` as a bounded feature gate only: local JSON review packet import to Review surface plus one exact text safe apply with receipt and recovery evidence, with DOCX comments-only preview as a separate manual preview surface.
- This gate also rebinds `REVIEW_BRIDGE_APPLY_LANE_PRODUCT_CLOSEOUT_REBIND_001_STATUS.json` from stale pending-delivery wording to delivered mainline truth for PR `1008` at merge SHA `5acc7612f109153820e71ed3f474f211be213601`.
- The gate does not claim release readiness, packaged readiness, cross-platform readiness, full review import automation, full DOCX review import, exact apply from DOCX, structural apply, comment auto-apply, cross-scene atomicity, multi-file transaction truth, or import/export MVP scope expansion.
- This closeout does not claim cross-scene batch atomicity, multi-file transaction truth, structural auto-apply, comment auto-apply, full review import automation, full import/export completion beyond the existing MVP closeout, full Word layout parity, PDF/EPUB/HTML export, user-facing Mindmap export command, release readiness, or Y9 admission.
- The DOCX review preflight command itself still does not claim review packet activation or automatic Review session opening; activation is owned by the separate preview-session contour.
- The DOCX review preview session activation contour does not claim full DOCX review import, tracked-change apply, exact apply, structural apply, comment auto-apply, receipt or recovery creation, Word layout parity, or broad DOCX fidelity.
- Word evidence claim binding contour is delivered and merged; it is tracked by `REVIEW_BRIDGE_WORD_EVIDENCE_CLAIM_BINDING_001_STATUS.json`.
- The Word evidence claim binding product-binds the existing `CONTOUR_10_WORD_EVIDENCE_CHECK_R2` gate: a claim can be accepted only when a valid Word evidence packet exists, the evidence hash matches, and requested coverage does not exceed packet coverage.
- This Word evidence claim binding is not Word support: no Word support, Word import, Word roundtrip, Word layout parity, full DOCX fidelity, apply, project truth write, receipt, recovery, DOCX safe-create change, DOCX export change, or import/export MVP widening is claimed.
- Google Docs evidence claim binding contour is delivered and merged; it is tracked by `REVIEW_BRIDGE_GOOGLE_DOCS_EVIDENCE_CLAIM_BINDING_001_STATUS.json`.
- The Google Docs evidence claim binding product-binds the existing `CONTOUR_11_GOOGLE_DOCS_EVIDENCE_CHECK` gate: a claim can be accepted only when a valid Google Docs evidence packet exists, the evidence hash matches, requested coverage does not exceed packet coverage, and docsSuggestions plus driveComments coverage are both present.
- This Google Docs evidence claim binding is not Google Docs support: no Google Docs support, Google Docs import, Google Docs sync, Google Docs roundtrip, Google Docs layout parity, full Google Docs fidelity, Google API integration, network access, apply, project truth write, receipt, recovery, DOCX safe-create change, DOCX export change, or import/export MVP widening is claimed.
- Format matrix claim binding contour is delivered and merged; it is tracked by `REVIEW_BRIDGE_FORMAT_MATRIX_CLAIM_BINDING_001_STATUS.json`.
- The format matrix claim binding product-binds the existing `CONTOUR_12_FORMAT_MATRIX_CLAIM_GATE`: a claim can pass only with a valid format matrix, valid golden set, matching row, matching formatId and surface, matching golden set hash, complete requiredTests, and claimScope within the selected row surface.
- This format matrix claim binding is not format support: no new user-facing format support, import support, export support, roundtrip, layout parity, full fidelity, release claim dossier acceptance, release readiness, apply, project truth write, receipt, recovery, DOCX safe-create change, DOCX export change, or import/export MVP widening is claimed.

### Phase status
- Phase 00: PASS
- Phase 01: PASS
- Phase 02: PASS
- Phase 03: PASS
- Phase 04: PASS
- Phase 05: PASS
- Phase 06: PASS
- Phase 07: PASS

### Design OS status
- Y7: CLOSED_ON_MAIN_WITH_HONEST_PASS_HOLD_PROFILE
- Y8: FORMAL_CUTOVER_PACKET_BOUND_PASS_WITH_READINESS_HOLD
- Active Y8 formal packet record: `Y8_FORMAL_CUTOVER_PACKET_RECORD_V1.json`
- Active Y8 rollback packet: `Y8_FORMAL_CUTOVER_ROLLBACK_PACKET_V1.json`
- Y9_NOT_OPENED_BY_IMPLICATION: TRUE
- shell safe-reset and restore proof closure contour is merged on current mainline
- ci and ops command injection hardening contour is merged on current mainline
- path boundary centralization contour is merged on current mainline
- dependency truth high-critical false-green class is superseded on current mainline after merged remediation
- menu truth chain and sourcebinding reconfirm contour is merged on current mainline
- U7 and capture false-green closeout contour is merged on current mainline with honest sourcebinding sync and real capture artifacts
- license posture `LICENSE-0001` is closed on current mainline for current scope A with fresh production scan (`UNKNOWN=0`, `DENY=0`) and notices-readiness token pass
- architecture posture `ARCH-0001` is closed on current mainline for current scope A after static evidence rebind confirmed no runtime-impacting circular or unresolved break
- current scope A is symbolic closeout ready on current mainline
- blocked lanes remain explicit blocked debt; later items remain explicit later or hold debt
- security audit lane is standardized on repo mainline via generic semgrep runner and package script; generic scan is repeatable with zero findings and honest timeout reporting
- test electron lane is ready and executed on current mainline with repeated pass runs
- X102 Block 01 visual reproof completed report-only on the selected-base snapshot at the time of X102 reproof
- that reproof ended with STOP_AND_FREEZE for design write and did not prove a new live nonblocked Group 01 delta
- design write lane remains closed after the latest X102 reproof

### Vertical sheets historical baseline and current viewport repair
- Vertical sheets historical baseline merge point on main history is `4c4eca3aba79c7d689d39b822f689f8939ca58ce`.
- Current mainline head that includes C05 long-document performance window closeout is `792f28077973721669aef9cf78d9385b1fb1db29` (source contour commit `58a2aced76bb914b3128024ad75588f789b24b28`).
- The current viewport-continuity repair contour preserves the primary invariant: one TipTap/ProseMirror source, derived visual sheet stack, view-only page gaps, and no page truth written into project state.
- The repaired evidence set passes `five-sheet-visible-smoke`, `vertical-sheet-gap-smoke`, `vertical-sheet-feed-smoke`, `vertical-sheet-input-stability-smoke`, `derived-sheet-classification-smoke`, `boundary-enter-flow-smoke`, `boundary-selection-replace-smoke`, `editorial-sheet-fast-scroll-catchup-smoke`, `editorial-sheet-zoom50-boundary-leak-smoke`, and the new `editorial-sheet-visible-page-text-coverage-smoke` at 2000 and 10000 targets.
- The repair also reran `editor-sheet-instrumented-stress-smoke` at target 10000 and observed actual 11495 pages, 7 rendered sheet shells, stable text hash, zero network requests, zero dialog calls, and physical bottom proof including the final page.
- The follow-up scroll/zoom performance repair keeps the large-payload path on estimated text-length pagination, collapses the hidden ProseMirror paint/layout surface, and uses derived sheet text as the visible layer; the 10000 visible coverage smoke now carries scroll/zoom perf proof with max scroll step about 50ms and max zoom step about 80ms on the recorded local run.
- The follow-up 10000 stress run observed actual 12124 pages, 8 rendered sheet shells, stable text hash, typing undo/redo cleanup restored, zero network requests, zero dialog calls, and physical bottom proof including the final page.
- The line-clip repair contour keeps the large-payload visible layer derived-only but renders bounded line-safe runtime rows instead of one overflowing text node; `editorial-sheet-visible-page-text-coverage-smoke` now hard-fails on content-boundary text boxes, forbidden margin ink, and boundary ink leaks. Two serial 10000 visible coverage reruns observed total page count 31479, 9 boundary frame pairs, zero empty significant pages, zero empty paint pages, zero content-boundary pages, zero forbidden margin ink pages, zero boundary ink leaks, max scroll step about 68ms, and max zoom step about 86ms on the slower recorded run.
- The line-clip repair 10000 stress run observed actual 12124 pages, 8 rendered sheet shells, stable text hash, typing undo/redo cleanup restored, zero network requests, zero dialog calls, and physical bottom proof including the final page.
- `VERTICAL_SHEET_PERFORMANCE_BASELINE_RUN_001` observed 10, 50, and 100 page scenarios as report-only baseline evidence; it is not a hard performance gate and not a repo-persisted artifact.
- This repair does not claim production release readiness, cross-platform readiness, full Word-like pagination, export parity, tables/cards/media pagination, horizontal multi-page overview, above-10000 readiness, or toolbar test-tail closure.
- Page numbers, page gaps, and sheet boundaries are not document truth and must not be written into project state by implication.

### Editorial sheet 10000 stress rebind
- Current committed machine-readable stress evidence is `EDITORIAL_SHEET_STRESS_LANE_STATUS_V3.json`, generated by task `CONTOUR_04_WRITE_IMPL`; the authoritative execution binding is the artifact's `repo.headSha`.
- That committed stress artifact supports the tracked 10000 scale row: target 10000 pages, actual 11510 pages, 7 rendered sheet shells, 1132 DOM nodes, stable text hash, zero network requests, zero dialog calls, and physical bottom proof where rendered sheet numbers 11504-11510 include the final page 11510.
- Acceptance rows 2000, 3000, 4000, 5000, and 10000 pass. Diagnostic rows `VIEWPORT_CONTINUITY`, `INPUT_CONTINUITY`, and `GAP_CONTINUITY` also pass, but remain diagnostic-only and must not be converted into release/design readiness by implication.
- A later operator final-gate report named `CONTOUR_05_FINAL_NO_REGRESSION_GATE_RETRY_V4` is not a committed executable proof artifact in this tree and must not be used by itself as repo proof.
- `EDITORIAL_SHEET_5000_CLOSEOUT_SUMMARY.json` is a navigation summary only; active canon and executed proof artifacts outrank it.
- The rebind does not claim production release readiness, cross-platform readiness, manual macOS design approval, or above-10000 readiness.

### Toolbar configuration truth
- toolbar configuration subsystem rebaselined to current repo truth
- `TOOLBAR_CANONICAL_LIVE_ORDER` length is `17`
- `TOOLBAR_PLANNED_IDS` is `[]`
- `TOOLBAR_BLOCKED_IDS` exact order is:
  - `toolbar.insert.image`
  - `toolbar.proofing.spellcheck`
  - `toolbar.proofing.grammar`
- blocked reasons are explicit in catalog truth:
  - image: `offline-first image asset pipeline not selected`
  - spellcheck: `offline-first spellcheck dictionary policy not selected`
  - grammar: `offline-first grammar engine not selected`
- configurator `master` profile is visible in markup and profile switch flow
- ordering is realized in runtime projection
- old Wave C literal scope no longer matches current repo truth; truthful closure model is `Wave C1 + blocked decisions`

### Toolbar post-merge factual closeout
- contour `TOOLBAR_METRIC_SHELL_DESCALE_002` is merged on main from commit `8e41f0600fccabb43abd773aee40aa5ccb9628f5` via PR `749`
- contour `TOOLBAR_NATIVE_FLUENCY_VISUAL_REFINE_001` is merged on main from commit `59c398d8ba02390fff5dc0a435f26d1f142fbb7a` via PR `750`
- whole-shell scale is removed as effective toolbar sizing path in accepted runtime state
- width-scale channel remains preserved as metric tuning path in accepted runtime state
- native fluency toolbar contract remains enforced: no transform-scale shell path and no blur trick in toolbar shell sections
- targeted toolbar verification for both contours is pass and independent post-audit is pass
- required checks on both merged PRs passed: `oss-policy`, `x1-runtime-parity (ubuntu-latest)`, `x1-runtime-parity (windows-latest)`
- this closeout does not open any automatic runtime contour; next move remains exactly one explicit owner-selected contour

### Invariants
- editor surface не источник истины,
- локальная истина без network truth,
- scenes remain isolated entities,
- atomic write и recovery остаются обязательными,
- DOCX остаётся первым export baseline.

## Three Layers Of UI Truth
- `System constraints`: устойчивые ограничения живут в repo canon и active execution canon.
- `Current iteration visual snapshot`: временный implementation baseline конкретной UI-итерации.
- `Advisory vision`: дальнее направление, которое не заменяет active canon.

## Current Delivery Axis

Текущая repo-wide closure остаётся активной operating reality на main.
Branch-local accepted repair surface остаётся только историческим промежуточным состоянием.
Release hardening remains the last mandatory runtime axis that was closed before repo-wide post-merge reconfirm on main.
Repo-wide done подтверждён на main после merge gate и post-merge reconfirm.
Formal Y8 cutover packet is explicitly bound on main with explicit rollback packet in the same operating reality.
Owner visual confirmation for the transferred variant on main is true.
b101939f03996479e90441b1d0cd8ffb4d110e0f is the historical confirmed live point for that transferred variant.
4c4eca3aba79c7d689d39b822f689f8939ca58ce is the baseline merge point for the historical vertical sheets flow on main history; current 01R recheck quarantines vertical sheet readiness until tracked reds are repaired.
792f28077973721669aef9cf78d9385b1fb1db29 is the current mainline head that already contains C05 long-document performance closeout.
`EDITORIAL_SHEET_STRESS_LANE_STATUS_V3.json` contains the committed editorial sheet 10000 stress artifact refresh; use its `repo.headSha` as the execution-head binding.
Source anchor `e1f36ef` was successfully reproduced on main.
Local checkout `a670f276759889ce90d1aa535ac7c84746b9f470` is not source of truth.
Prep frame `YALKEN_DESIGN_OS_PREP_AND_SELECTION_FRAME_V7` is archival only.
No further transfer is required for this variant; the transfer axis is closed.
Если на current mainline честно переподтверждается live contradiction, он закрывается одним bounded contour и потом factual truth reconfirmed again.
Последний X102 Block 01 visual reproof не доказал новый live nonblocked contradiction и поэтому сохранил freeze без открытия design write contour.

Следующее допустимое состояние:
1. сохранять repo-wide closure как текущую operating reality на main
2. не открывать post-version-one evaluation как обязательную часть `Writer v1`
3. если будет переподтверждён новый nonblocked contradiction, открывать только один explicit evidence-backed contour за раз
4. не маскировать новые gaps narrative claims о полном closure
5. если новый nonblocked contradiction не переподтверждён, фиксировать symbolic closeout ready без открытия нового write contour

## What Is Not Yet Claimed
- pack layer не считается обязательным,
- post-v1 freedom не считается текущим implementation commitment и остаётся evaluation-only.

## Policies That Remain Binding
- SECURITY_POLICY: CSP, blocked navigation, blocked new-window, no remote code
- DEPENDENCY_POLICY: only OSS Tiptap layer, no `@tiptap-pro/*`, no UI frameworks, no state managers
- YJS direction remains allowed later, but not a current release gate

## Working Rules
- write contours идут bounded slices,
- false-green и stale-green запрещены,
- следующий contour берётся только из текущего execution order,
- factual docs должны описывать current operating reality, а не старый transition milestone.

## Next Practical Target
- не открывать Y9 по импликации из текста или narrative claims,
- не переинтерпретировать Y8 PASS как автоматический полный release hardening,
- если новых live nonblocked contradictions не переподтверждено, сохранять current mainline closure truth,
- при отсутствии новых live nonblocked contradictions текущий статус: symbolic closeout ready with blocked and later freeze,
- если новый live nonblocked contradiction переподтверждён, следующий шаг только один: one explicit evidence-backed nonblocked contour selection brief.
- after vertical sheets factual sync, the next move must still be selected as exactly one explicit contour; no automatic runtime, export, toolbar, or perf write opens by this text.
- after editorial sheet 10000 stress rebind, viewport-continuity repair, and import/export MVP closeout, next work remains one owner-selected contour; manual macOS design approval, post-MVP export expansion, platform adapters, collaboration, comments, history, and above-10000 profiling remain separate stage-gated lanes.
