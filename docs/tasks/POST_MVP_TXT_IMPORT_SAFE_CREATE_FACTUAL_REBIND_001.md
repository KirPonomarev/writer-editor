# ТЗ для Codex: POST_MVP_TXT_IMPORT_SAFE_CREATE_FACTUAL_REBIND_001

## Контекст / ограничения
- Это не новый runtime contour, а factual rebind уже доставленного TXT import contour `POST_MVP_TXT_IMPORT_SAFE_CREATE_001`.
- Source feature уже merged on main через PR `1061` с merge SHA `cc0f226f68341c649423ba8761b91939cd2dbade`.
- Source feature commit в merged delivery chain: `8d0404d010030c17cde1996b9f23cf326255fc7c`.
- Scope остается post-MVP и не widening `IMPORT_EXPORT_PRODUCT_ACCEPTANCE_GATE_001_STATUS.json`.
- Offline-first, без сети, без новых зависимостей, без UI redesign.
- Нельзя расширять claim до broader text import, raw Markdown truth reopen, package import, PDF or HTML import, broader export claims или новых format lanes.
- Main остается owner для picker, stat, read, restat и safe-create; renderer не становится источником text truth, path truth или import authority.
- Diff budget: один narrow status artifact и sync active factual docs плюс worklog wording tails.

## Файлы
- docs/tasks/POST_MVP_TXT_IMPORT_SAFE_CREATE_FACTUAL_REBIND_001.md
- docs/OPS/STATUS/POST_MVP_TXT_IMPORT_SAFE_CREATE_FACTUAL_REBIND_001_STATUS.json
- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/WORKLOG.md

## Проблема
- `cmd.project.importTxtV1` уже merged on current mainline, а active docs уже описывают contour фактически delivered, но отдельного machine-carried TXT import factual status artifact на mainline нет.
- В `HANDOFF.md` snapshot summary не перечисляет delivered TXT import и оба post-MVP TXT export contours.
- В `WORKLOG.md` TXT import и selected-scenes TXT export still keep older implementation-stage wording рядом с более поздним factual rebind wording.

## Цель
- Честно зафиксировать delivered TXT import contour как bounded post-MVP local TXT preview plus safe-create lane без расширения import/export MVP gate и без открытия новых runtime claims.

## Что сделать
- Добавить один narrow status artifact для delivered TXT import factual truth.
- Обновить `CONTEXT.md` и `HANDOFF.md` так, чтобы TXT import line явно source-bindилась к PR `1061` и merge SHA `cc0f226f68341c649423ba8761b91939cd2dbade`.
- Обновить snapshot summary в `HANDOFF.md`, чтобы он перечислял delivered current-scene TXT export, selected-scenes TXT export и TXT import factual rebinds.
- Добавить краткую factual rebind запись в `WORKLOG.md`.
- Ослабить старое implementation-stage wording в `WORKLOG.md`, чтобы оно читалось как historical pre-merge context, а не как current truth.
- Не трогать `IMPORT_EXPORT_PRODUCT_ACCEPTANCE_GATE_001_STATUS.json`, `IMPORT_EXPORT_PRODUCT_CLOSEOUT_BINDING_001_STATUS.json`, current-scene TXT export truth и selected-scenes TXT export truth.

## Критерии приёмки
- [ ] Active docs отражают delivered TXT import contour.
- [ ] Новый status artifact правильно связывает PR `1061`, feature commit и merge SHA.
- [ ] TXT import wording остается bounded: preview pathless and write-free, accept creates exactly one new scene, UTF-8 and UTF-8 BOM only.
- [ ] В wording нет broader import or export claim.
- [ ] Current-scene TXT export и selected-scenes TXT export остаются отдельными contour truths.
- [ ] MVP import/export closeout wording не widened.

## Промежуточные тестирования
- CHECK_01 выполняется до правок: clean worktree, correct branch, source feature merged on main, PR plus commit plus merge chain verified.
- CHECK_02: targeted TXT import contracts and unit flow tests.
- CHECK_03: oss policy, diff check, and claim audit against active docs.

## Риски и откат
- Риск: случайно расширить TXT import до broader text import or raw Markdown truth.
- Риск: случайно затронуть already-closed current-scene or selected-scenes TXT export truth surfaces.
- Риск: случайно оставить old implementation wording as active truth in worklog or handoff summary.
- Откат: убрать new status artifact и factual doc lines одним bounded revert commit.
