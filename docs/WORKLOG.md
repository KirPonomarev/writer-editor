# WORKLOG (Craftsman)

Короткая хронология изменений и решений. Это не полный лог чата, а сжатые записи “что сделали / зачем / что дальше”.
Если в переписке были важные продуктовые/UX‑решения (даже без кода) — фиксируйте их здесь короткими пунктами.

## 2026-07-02
- Review Bridge: opened `REVIEW_BRIDGE_WORD_EVIDENCE_CLAIM_BINDING_001` as a bounded Word evidence claim binding contour after DOCX diagnostic evidence surface.
- Review Bridge: delivered `REVIEW_BRIDGE_WORD_EVIDENCE_CLAIM_BINDING_001` via PR `1022` merge SHA `d2a5fc07649aaa994730bcefb7943f24a66e6179`; repo status is rebound to `delivered_merged_verified`.
- Word evidence claim binding: product-binds the existing `CONTOUR_10_WORD_EVIDENCE_CHECK_R2` gate; accepted claims require valid packet, matching evidence hash, and non-exceeded coverage.
- Scope truth: this is not Word support; no Word import, Word roundtrip, Word layout parity, full DOCX fidelity, apply, project truth write, receipt, recovery, DOCX safe-create change, DOCX export change, or import/export MVP widening is claimed.
- Review Bridge: opened `REVIEW_BRIDGE_GOOGLE_DOCS_EVIDENCE_CLAIM_BINDING_001` as a bounded Google Docs evidence claim binding contour after Word evidence claim binding.
- Review Bridge: delivered `REVIEW_BRIDGE_GOOGLE_DOCS_EVIDENCE_CLAIM_BINDING_001` via PR `1024` merge SHA `37c0dfee965a1f4d8c74400079ba0e9df77f6021`; repo status is rebound to `delivered_merged_verified`.
- Google Docs evidence claim binding: product-binds the existing `CONTOUR_11_GOOGLE_DOCS_EVIDENCE_CHECK` gate; accepted claims require valid packet, matching evidence hash, non-exceeded coverage, and both docsSuggestions and driveComments coverage.
- Scope truth: this is not Google Docs support; no Google Docs import, Google Docs sync, Google Docs roundtrip, Google Docs layout parity, full Google Docs fidelity, Google API integration, network access, apply, project truth write, receipt, recovery, DOCX safe-create change, DOCX export change, or import/export MVP widening is claimed.
- Review Bridge: opened `REVIEW_BRIDGE_FORMAT_MATRIX_CLAIM_BINDING_001` as a bounded format matrix claim binding contour after Google Docs evidence claim binding.
- Review Bridge: delivered `REVIEW_BRIDGE_FORMAT_MATRIX_CLAIM_BINDING_001` via PR `1026` merge SHA `47a14974811eaa58f56de80f61268f5371aefd45`; repo status is rebound to `delivered_merged_verified`.
- Format matrix claim binding: product-binds the existing `CONTOUR_12_FORMAT_MATRIX_CLAIM_GATE`; accepted claims require valid matrix, valid golden set, matching row, matching formatId and surface, matching golden set hash, complete requiredTests, and claimScope inside row surface.
- Scope truth: this is not format support; no new user-facing format support, import support, export support, roundtrip, layout parity, full fidelity, release claim dossier acceptance, release readiness, apply, project truth write, receipt, recovery, DOCX safe-create change, DOCX export change, or import/export MVP widening is claimed.
- Review Bridge: opened `REVIEW_BRIDGE_RELEASE_CLAIM_DOSSIER_BINDING_001` as a bounded release claim dossier binding contour after format matrix claim binding.
- Review Bridge: delivered `REVIEW_BRIDGE_RELEASE_CLAIM_DOSSIER_BINDING_001` via PR `1028` merge SHA `06ca9d07c03fc095dda683e2a0f2c79e068c7f91`; repo status is rebound to `delivered_merged_verified`.
- Release claim dossier binding: product-binds the existing `CONTOUR_12B_RELEASE_CLAIM_DOSSIER_GATE`; dossier gate acceptance requires valid schema, non-empty items, unique itemId values, valid matrix/golden-set/claim rows, matching hashes, complete requiredTests, and claimScope inside row surface.
- Scope truth: this is not release readiness; no release readiness, user-facing release, release admission completion, release execution completion, release publication completion, Word support, Google Docs support, import support, export support, roundtrip, layout parity, full fidelity, apply, project truth write, receipt, recovery, DOCX safe-create change, DOCX export change, or import/export MVP widening is claimed.
- Review Bridge: opened `REVIEW_BRIDGE_RELEASE_CLAIM_ADMISSION_BINDING_001` as a bounded release claim admission binding contour after release claim dossier binding.
- Release claim admission binding: product-binds and hardens the existing `CONTOUR_12C_RELEASE_CLAIM_ADMISSION_GATE`; admission requires accepted 12B dossier provenance, claimScope covered by accepted 12B item evaluations, required claim classes, and no baseline debt; caller-supplied coveredScope cannot widen admission coverage.
- Release claim admission binding delivery: PR 1030 merged; status rebound to delivered, merged, and verified.
- Scope truth: this is not release readiness; no release readiness, user-facing release, release mode decision completion, release execution completion, release publication completion, Word support, Google Docs support, import support, export support, roundtrip, layout parity, full fidelity, apply, project truth write, receipt, recovery, DOCX safe-create change, DOCX export change, or import/export MVP widening is claimed.
- Review Bridge: opened `REVIEW_BRIDGE_RELEASE_CLAIM_MODE_DECISION_BINDING_001` as a bounded release claim mode decision binding contour after release claim admission binding.
- Release claim mode decision binding: product-binds and hardens the existing `CONTOUR_12D_RELEASE_CLAIM_MODE_DECISION_GATE`; accepted 12D requires accepted 12B dossier provenance and accepted 12C admission provenance, and derives claimId, dossierId, and matrixId from accepted upstream provenance.
- Release claim mode decision binding downstream guard: immediate 12E attestation and 12F packet emit now re-evaluate raw upstream payloads to reject forged accepted 12D or 12E envelopes.
- Release claim mode decision binding delivery: PR 1032 merged at `a48039cd7c79f9bc00e37b427436999ab9f47b78`; status rebound to delivered, merged, and verified.
- Scope truth: this is not release readiness; no release readiness, user-facing release, attestation completion, packet emit completion, release execution completion, release publication completion, Word support, Google Docs support, import support, export support, roundtrip, layout parity, full fidelity, apply, project truth write, receipt, recovery, DOCX safe-create change, DOCX export change, or import/export MVP widening is claimed.
- Review Bridge: opened `REVIEW_BRIDGE_RELEASE_CLAIM_ATTESTATION_BINDING_001` as a bounded release claim attestation binding contour after release claim mode decision binding.
- Release claim attestation binding: product-binds and hardens the existing `CONTOUR_12E_RELEASE_CLAIM_ATTESTATION_GATE`; accepted 12E requires accepted 12D provenance, raw 12D re-evaluation, matching recomputed 12D envelope, matching decisionHash, matching commandRunDigest, matching evidenceHash, and RELEASE_MODE release evidence fields.
- Release claim attestation downstream guard: immediate 12F packet emit now blocks mixed accepted 12D and 12E pairs when 12E decisionHash does not match the top-level accepted 12D result.
- Release claim attestation binding delivery: PR 1034 merged at `4d8e0a1b2eb065913bdc018304106c1f7e0973f1`; status rebound to delivered, merged, and verified.
- Scope truth: this is not release readiness; no release readiness, user-facing release, packet emit completion, release execution completion, release publication completion, Word support, Google Docs support, import support, export support, roundtrip, layout parity, full fidelity, apply, project truth write, receipt, recovery, DOCX safe-create change, DOCX export change, or import/export MVP widening is claimed.
- Review Bridge: opened `REVIEW_BRIDGE_RELEASE_CLAIM_PACKET_EMIT_BINDING_001` as a bounded release claim packet emit binding contour after release claim attestation binding.
- Release claim packet emit binding: product-binds the existing `CONTOUR_12F_RELEASE_CLAIM_PACKET_EMIT`; accepted 12F requires own packetMeta, accepted 12D provenance, accepted 12E provenance, raw 12D and raw 12E re-evaluation, and matching mode, claimId, dossierId, matrixId, and decisionHash bindings.
- Release claim packet emit hardening: inherited prototype fields are stripped before packetMeta and accepted 12D/12E envelope checks; inherited packetMeta, inherited accepted envelopes, and inherited RELEASE_MODE `USER_FACING_CLAIM_READY` packet paths are blocked.
- Release claim packet emit binding delivery: PR 1036 merged at `9d10189e78fe516a6d33a53714bcb85ede987b28`; status rebound to delivered, merged, and verified.
- Scope truth: this is not release readiness; no release readiness, user-facing release, release execution completion, release publication completion, Word support, Google Docs support, import support, export support, roundtrip, layout parity, full fidelity, apply, project truth write, receipt, recovery, DOCX safe-create change, DOCX export change, or import/export MVP widening is claimed.
- Review Bridge: opened `REVIEW_BRIDGE_RELEASE_CLAIM_USER_FACING_BOUNDARY_BINDING_001` as a bounded release claim user-facing boundary binding contour after release claim packet emit binding.
- Release claim user-facing boundary binding: product-binds the existing `CONTOUR_12G_RELEASE_CLAIM_USER_FACING_BOUNDARY_GATE`; accepted 12G is boundary admission only and requires accepted 12F packet emit provenance, raw packet emit binding fields for mode, claimId, dossierId, matrixId, releaseClass, packetId, and attestationId, matching packet/report/binding fields for mode, claimId, dossierId, matrixId, and releaseClass, and packetHash, packetId, and attestationId linkage across packet, report, summary, and binding.
- Release claim user-facing boundary hardening: inherited prototype fields are stripped before boundary input and packetEmitResult acceptance checks; inherited boundary input, inherited accepted packet emit results, and inherited nested packet provenance are blocked.
- Release claim user-facing boundary binding delivery: PR 1038 merged at `a94d19671aede4a12ed4b38310bfb4de5368efaf`; status rebound to delivered, merged, and verified.
- Scope truth: this is not release readiness, not a user-facing release, and not a user-facing UI state; no release readiness, user-facing release, release execution completion, release publication completion, publication authority, command admission, kernel fence, Word support, Google Docs support, import support, export support, roundtrip, layout parity, full fidelity, apply, project truth write, receipt, recovery, DOCX safe-create change, DOCX export change, or import/export MVP widening is claimed.
- Review Bridge: opened `REVIEW_BRIDGE_RELEASE_CLAIM_PUBLICATION_GATE_BINDING_001` as a bounded release claim publication gate binding contour after release claim user-facing boundary binding.
- Release claim publication gate binding: product-binds the existing `CONTOUR_12H_RELEASE_CLAIM_PUBLICATION_GATE`; accepted 12H requires raw 12G boundary input, re-evaluates 12G internally, and requires the internally accepted 12G result to carry mode, claimId, dossierId, matrixId, releaseClass, claimSurface, packetId, and attestationId.
- Release claim publication gate hardening: inherited prototype fields are stripped before publication input and boundaryResult acceptance checks; stale or fabricated boundaryResult values are blocked unless they match the internally re-evaluated 12G result.
- Scope truth: this is not product publication, not release readiness, not a user-facing release, and not a user-facing UI state; no product publication, release readiness, user-facing release, release execution completion, release publication completion, publication authority, command admission, kernel fence, Word support, Google Docs support, import support, export support, roundtrip, layout parity, full fidelity, apply, project truth write, receipt, recovery, DOCX safe-create change, DOCX export change, or import/export MVP widening is claimed.
- Review Bridge: delivered `REVIEW_BRIDGE_DOCX_DIAGNOSTIC_EVIDENCE_SURFACE_001` via PR `1020` at merge SHA `02754b5f6ac6bd231b6d47659453ab92ddd6d979` as a bounded DOCX diagnostic evidence surface contour.
- DOCX diagnostic evidence surface: tracked-changes-only DOCX can open a visible read-only diagnosticItems surface; clean no-evidence DOCX remains no-candidate/passive.
- Scope truth: diagnostic evidence stays out of DOCX import safe-create, textChanges, applyOps, manuscript/project truth writes, receipt, recovery, release readiness, and import/export MVP widening.
- Review Bridge: delivered `REVIEW_BRIDGE_FIRST_USEFUL_RELEASE_GATE_001` via PR `1018` merge SHA `d76485d152c1bfa1cb00bf9eda0c242596785352` as a bounded first useful feature gate.
- First useful gate scope: local JSON review packet import to Review surface plus one exact text safe apply with receipt and recovery evidence; DOCX comments-only remains separate preview/manual-only evidence.
- First useful gate truth sync: rebound `REVIEW_BRIDGE_APPLY_LANE_PRODUCT_CLOSEOUT_REBIND_001_STATUS.json` from stale pending-delivery wording to delivered PR `1008` merge SHA `5acc7612f109153820e71ed3f474f211be213601`.
- Scope truth: no release readiness, packaged readiness, cross-platform readiness, full review import, full DOCX review import, exact apply from DOCX, structural apply, comment auto-apply, cross-scene atomicity, multi-file transaction truth, or import/export MVP widening is claimed.
- Review Bridge: opened `REVIEW_BRIDGE_DOCX_COMMENT_ONLY_PRODUCT_PROOF_001` as product proof for the already delivered DOCX comments-only Review path.
- DOCX comments-only proof: rebound `REVIEW_BRIDGE_DOCX_REVIEW_LOCAL_FILE_ENTRY_001` to PR `1015` merge SHA `824d96b739bdbd8b7a45b1bf1664b003a2a65fd2`.
- DOCX comments-only proof: delivered via PR `1016` merge SHA `80706d1205049d071b1737634dc41cd9125e26d8`; repo status is rebound to `delivered_merged_verified`.
- Scope truth: DOCX comments can reach the in-memory Review surface as commentThreads plus manual commentPlacements and open Review/Comments; no tracked-change apply, exact apply from DOCX, structural apply, comment auto-apply, receipt, recovery, project write, import/export MVP widening, release readiness, or Word parity is claimed.

## 2026-07-01
- Review Bridge: opened `REVIEW_BRIDGE_DOCX_REVIEW_LOCAL_FILE_ENTRY_001` as the user-facing DOCX chooser entry for in-memory comments review.
- DOCX review local-file entry: added `cmd.project.review.openDocxReviewPreviewSession` in the Review menu; main owns DOCX picker/stat/read/restat and calls the delivered preview-session activation path.
- Scope truth: local DOCX review entry is separate from DOCX import preview and safe-create; no exact apply, structural apply, receipt, recovery, manuscript write, project truth write, dependency, editor UI redesign, or import/export MVP expansion is claimed.
- Tests: targeted DOCX review local-file entry and menu config/locale contracts passed locally with 16 tests.
- Review Bridge: rebound `REVIEW_BRIDGE_DOCX_PREVIEW_SESSION_ACTIVATION_001` delivery truth to PR `1014` merge SHA `c608541f93688150ddc3d0dee08b33dfaab01e5f`.
- Review Bridge: delivered preflight status was rebound after PR `1013` merge at `34895b960a723b816ccb7f50f171854675a43969`.
- Review Bridge: opened `REVIEW_BRIDGE_DOCX_PREVIEW_SESSION_ACTIVATION_001` as a separate DOCX-comments-to-in-memory-review-session contour.
- DOCX review preview session activation: added `cmd.project.review.activateDocxReviewPreviewSession` and `buildDocxReviewPreviewSessionCandidateFromZipBytes`.
- Scope truth: DOCX comments can open a manual Stage01 preview Review session; tracked changes stay diagnostic-only; no exact apply, structural apply, receipt, recovery, manuscript write, project truth write, dependency, UI, or import/export MVP expansion is claimed.
- Tests: targeted DOCX review preview session builder and command contracts passed locally with 14 tests; targeted DOCX review/import preview plus review mutate regression pack passed locally with 104 tests.
- Review Bridge: opened `REVIEW_BRIDGE_DOCX_PREFLIGHT_001` as a diagnostic-only DOCX review evidence contour, separate from the closed import/export MVP flow.
- DOCX review preflight: added `cmd.project.review.inspectDocxReviewPreflight` and `buildDocxReviewPreflightReportFromZipBytes` to detect comments and tracked-change markers without Review session activation, apply, receipt, recovery, or project writes.
- Tests: targeted DOCX review preflight, DOCX intake/content/import preview, and review mutate contracts passed locally with 72 tests.
- Scope truth: no UI change, no dependency change, no Word parity claim, no full DOCX review import claim.

## 2026-04-26
- Vertical closeout chain: main head `792f28077973721669aef9cf78d9385b1fb1db29` contains C05 long-document performance contour from source commit `58a2aced76bb914b3128024ad75588f789b24b28`.
- Scope truth: C05 changed only `editor.js`, `editor.bundle.js`, and `vertical-sheet-performance-window-smoke.mjs`; no storage or export files were touched.
- Docs refresh: factual snapshot docs were rebound to current mainline head and baseline wording was corrected from “current mainline baseline point” to “baseline merge point on main history”.
- Toolbar contour closeout: merged `TOOLBAR_METRIC_SHELL_DESCALE_002` from commit `8e41f0600fccabb43abd773aee40aa5ccb9628f5` through PR `749`.
- Toolbar contour closeout: merged `TOOLBAR_NATIVE_FLUENCY_VISUAL_REFINE_001` from commit `59c398d8ba02390fff5dc0a435f26d1f142fbb7a` through PR `750`.
- Toolbar runtime truth: effective whole-shell scale path removed, width-scale metric channel preserved, rotate or width mechanics unchanged.
- Toolbar quality evidence: targeted toolbar tests passed and independent post-audit passed for both contours.
- CI evidence: required checks passed on both merged PRs (`oss-policy`, `x1-runtime-parity` on ubuntu and windows).
- Post-merge docs sync: `CONTEXT.md` and `HANDOFF.md` rebound to include factual toolbar closeout without opening runtime scope.

## 2026-04-22
- Transfer closeout: correct main head `b101939f03996479e90441b1d0cd8ffb4d110e0f` was confirmed and the transfer axis was closed.
- Authority rebind: local checkout `a670f276759889ce90d1aa535ac7c84746b9f470` was downgraded as non-authority.

## 2026-04-21
- False-green: merged `YALKEN_U7_AND_CAPTURE_FALSE_GREEN_CLOSEOUT_001`; U7 sourcebinding and capture route were rebound honestly on current mainline with real runtime artifacts.
- X102: completed `YALKEN_BLOCK01_CURRENT_MAINLINE_VISUAL_REPROOF_001` as report-only reproof on the current selected-base snapshot; result is `STOP_AND_FREEZE`.
- Design write: no new live nonblocked Group 01 visual delta was proved by the X102 Block 01 reproof, so no design write contour was opened.
- Docs: rebound `HANDOFF.md`, `CONTEXT.md`, and `WORKLOG.md` to the accepted April 21 reality without opening a new runtime or design contour.

## 2026-03-11
- Process: принят минимальный advisory UI-process layer в существующих repo docs без нового канона и без нового blocking-layer.
- Reason: UI быстро эволюционирует, но репозиторий должен хранить только устойчивые инварианты и текущий исполнимый срез.
- UI: visual baseline зафиксирован как временный и итерационный, а не как постоянная истина продукта.

## 2026-04-02
- False-green: merged current-mainline reconfirm for menu truth chain and sourcebinding.
- False-green: merged factual doc truth reconfirm and shell safe-reset or restore proof closure.
- Security: merged SAST-0001 CI and ops command injection hardening and SAST-0002 path boundary centralization.
- Dependency truth: merged narrow remediation on current mainline; current `npm audit --audit-level=high` is clean.
- Docs and OPS artifacts: factual and audit truth surfaces were reconfirmed after the merged proof-changing contours.
- Closeout: current scope A is recorded as symbolic closeout ready on mainline with blocked and later debt explicitly frozen.
- Security lane standardized: added repo-runner generic semgrep lane with package script; current generic scan remains zero-findings with timeout events reported honestly.
- Test lane readiness: `npm run -s test:electron` rerun twice on current mainline, both pass; TEST_ELECTRON moved from blocked to ready and executed.
- License posture closure: fresh production license scan reports `UNKNOWN=0` and `DENY=0`; notices-readiness token remains pass; `LICENSE-0001` moved from later to closed on current mainline for current scope A.
- Architecture posture closure: old knip and depcruise later-claims were rebound to current mainline static evidence and closed as stale or nonblocking for current runtime truth.
- Design OS guide: added `YALKEN_DESIGN_OS_CHANGE_GUIDE_V2_2.md` as the shared human-plus-agent operating guide with snapshot binding, group selection, file-touch map, and stop rules.
- Docs hygiene: `HANDOFF.md` clarified that reading order follows `CANON_STATUS.json` plus the active execution canon, and that handoff state is snapshot-bound rather than a permanent local machine invariant.

## 2026-01-27
- Canon: добавлен `CANON.md` (верхний канон решений/изменений) + `docs/BIBLE.md` (Craftsman vNext).
- CI: добавлен OSS‑guard `scripts/check-no-paid-tiptap.mjs` + workflow `.github/workflows/oss-policy.yml` (pre/post install) + `npm audit`.
- Docs: синхронизированы `README.md`, `agents.md`, `docs/CONTEXT.md`, `docs/HANDOFF.md`, шаблоны и `docs/references/ROADMAP.md` под vNext; добавлен `docs/AGENT_START_PROMPT.md`.

## 2026-01-23
- UI: рамка `.editor-panel` приведена к разделителю sidebar (используется `var(--sidebar-border)` вместо более контрастной переменной).
- Toolbar: кнопка `min/max` перемещена в поток тулбара; добавлен компактный режим (скрытие части контролов) и переключение `min` ⇄ `max`.
- Toolbar: добавлены новые шрифты в font-select (Circe, Roboto Mono, American Typewriter) + добавлен селект “Styles” как одноразовая команда.
- Styles (MVP A): принято решение, что одного добавления маркеров недостаточно — нужен визуальный стиль.
- Editor: начата миграция с `textarea` на `contenteditable` для возможности стилизовать строки/фрагменты.
- Editor: добавлены базовые утилиты для plain text, обработка `paste` (только text/plain) и Enter (вставка `\n`).
- Editor: добавлен базовый рендер paragraph‑стилей + code fences (визуальное отличие по классам) и CSS‑переменные/стили под референсы.
- Открыто: inline стили `*...*` и `` `...` `` в отображении; возможные проблемы с undo/redo из-за перерендера.
- Docs: добавлен лёгкий процесс “Spec‑Lite” (`docs/PROCESS.md`) + шаблоны ТЗ/регресс‑проверок (`docs/templates/*`) + заметки по Spec Kit (`docs/references/spec-kit.md`).
- Docs: обновлён шаблон ТЗ под наш стиль “ТЗ для Codex” (контекст/ограничения → проблема → цель → что сделать → приёмка → тесты): `docs/templates/FEATURE_TZ.md`.
- Docs: добавлены “brain” утилиты для handoff/log/new-task (`scripts/brain.mjs`) + папка задач `docs/tasks/` + команды в `package.json`.
- Docs: добавлены git “save points” в процесс (`docs/PROCESS.md`) и команда `brain:savepoint` (подсказка для коммита по этапам).
- Docs: зафиксирована перспектива после MVP (платформы/облако/аккаунты/коллаб/экспорт/масштаб): `docs/CONTEXT.md`.
- Docs: добавлена структура для референсов (index + checklist + шаблон заметок): `docs/references/*`.
- Docs: добавлена база референсов по OSS проектам (`docs/references/ROADMAP.md` + `docs/references/projects/*.md`) и улучшен `brain:refs` (теги разбиваются на части).
- Process: разделили режимы ChatGPT (ТЗ/план/проверки, без правок в репо) и Codex (правки по ТЗ по умолчанию); коммиты/push вручную пользователем (если не оговорено иначе).
