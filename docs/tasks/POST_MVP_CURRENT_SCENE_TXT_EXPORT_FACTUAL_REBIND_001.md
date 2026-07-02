# ТЗ для Codex: POST_MVP_CURRENT_SCENE_TXT_EXPORT_FACTUAL_REBIND_001

## Контекст / ограничения
- Это не новый runtime contour, а factual rebind уже доставленного current scene TXT export.
- Source feature уже merged on main через PR `1060` с merge SHA `c79cb107d3e346df6253b50e9407811449acdd0d`.
- Scope остается post-MVP и не widening `IMPORT_EXPORT_PRODUCT_ACCEPTANCE_GATE_001_STATUS.json`.
- Offline-first, без сети, без новых зависимостей, без UI redesign.
- Нельзя расширять claim до manuscript TXT export, package export, broader text export или новых format lanes.
- Renderer не получает authority на source text или path resolution; main owns canonical source read, save dialog, and atomic write.
- Diff budget: narrow task brief, one machine-readable status artifact, and factual doc sync in active docs only.

## Файлы
- docs/tasks/POST_MVP_CURRENT_SCENE_TXT_EXPORT_FACTUAL_REBIND_001.md
- docs/OPS/STATUS/POST_MVP_CURRENT_SCENE_TXT_EXPORT_FACTUAL_REBIND_001_STATUS.json
- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/WORKLOG.md

## Проблема
- `cmd.project.exportCurrentSceneTxtV1` уже существует на current mainline, но factual docs пока не фиксируют этот delivered post-MVP contour как active truth.
- Это создает разрыв между repo reality и active docs.

## Цель
- Честно зафиксировать delivered current scene TXT export как bounded post-MVP export surface без расширения import/export MVP gate.

## Что сделать
- Добавить один narrow status artifact для delivered current scene TXT export.
- Обновить `CONTEXT.md` и `HANDOFF.md` ровно на текущую factual truth:
  - current scene only,
  - File menu surface,
  - main-owned canonical scene source,
  - external atomic TXT write only,
  - dirty or unsaved current scene fail-closed,
  - target path equal current scene or inside project root blocked.
- Добавить краткую запись в `WORKLOG.md`.
- Не трогать `BIBLE.md`, если нет прямого factual contradiction.

## Критерии приёмки
- [ ] Active docs отражают delivered current scene TXT export.
- [ ] Status artifact не расширяет scope beyond current scene TXT export.
- [ ] В wording нет broader `text export` claim.
- [ ] В wording нет MVP widening claim.
- [ ] В wording нет package export, PDF, EPUB, HTML, or Mindmap expansion claim.
- [ ] Runtime truth описан через существующий delivered command path only.

## Промежуточные тестирования
- CHECK_01 выполняется до правок: clean worktree, correct branch, source feature merged on main.
- CHECK_02: targeted contracts for current scene TXT export command surface and menu binding.
- CHECK_03: diff check and claim audit against active docs.

## Риски и откат
- Риск: случайно назвать contour более широко, чем `current scene TXT export`.
- Риск: случайно смешать delivered feature rebind и новый export implementation contour.
- Откат: убрать status artifact и factual doc lines одним bounded revert commit.
