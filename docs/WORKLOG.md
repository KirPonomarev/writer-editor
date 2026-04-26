# WORKLOG (Craftsman)

Короткая хронология изменений и решений. Это не полный лог чата, а сжатые записи “что сделали / зачем / что дальше”.
Если в переписке были важные продуктовые/UX‑решения (даже без кода) — фиксируйте их здесь короткими пунктами.

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
