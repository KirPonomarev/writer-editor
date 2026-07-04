# ТЗ для Codex: POST_MVP_PROJECT_TXT_EXPORT_FACTUAL_REBIND_001

## Контекст / ограничения
- Это не новый runtime contour, а factual rebind уже доставленного all scenes TXT export.
- Source feature уже merged on main через PR `1068` с merge SHA `a27bd9757dc94bcb166e349302dbebdab1ce3c07`.
- Source feature commit в merged delivery chain: `e4037c47fee3e658101d1aef3e6ef11410abbb2a`.
- Scope остается post-MVP и не widening `IMPORT_EXPORT_PRODUCT_ACCEPTANCE_GATE_001_STATUS.json`.
- Offline-first, без сети, без новых зависимостей, без UI redesign.
- Нельзя расширять claim до manuscript TXT export, package export, broader text export, chapter assembly semantics или новых format lanes.
- Main остаётся единственным authority для canonical scene-only scope rebuild, source read, save dialog resolution, target validation и atomic external TXT write.
- Renderer не получает authority на source text, source path, scene scope, chapter scope или manuscript truth; допускается только request metadata и optional outPath.
- Diff budget: узкий task brief, one machine-readable source status artifact, and factual doc sync in active docs only.

## Файлы
- docs/tasks/POST_MVP_PROJECT_TXT_EXPORT_001.md
- docs/tasks/POST_MVP_PROJECT_TXT_EXPORT_FACTUAL_REBIND_001.md
- docs/OPS/STATUS/POST_MVP_PROJECT_TXT_EXPORT_001_STATUS.json
- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/WORKLOG.md

## Проблема
- `cmd.project.exportAllScenesTxtV1` уже merged on current mainline, но source status artifact для этого contour отсутствует.
- Active docs пока не фиксируют delivered all-scenes TXT export как текущую factual truth.

## Цель
- Честно зафиксировать delivered all scenes TXT export как bounded post-MVP export surface без расширения import/export MVP gate и без открытия broader manuscript or package claims.

## Что сделать
- Добавить один narrow source status artifact для delivered all-scenes TXT export.
- Обновить `CONTEXT.md` и `HANDOFF.md` ровно на текущую factual truth:
  - all scenes File menu only,
  - main-owned canonical scene-only scope rebuild,
  - canonical scene source reads through the existing snapshot-or-disk envelope path,
  - one blank line join rule only,
  - dirty current scoped scene fail-closed,
  - target path equal any source scene or inside project root blocked,
  - no chapter-file, roman-section, materials, reference, mindmap, print, or manuscript assembly truth.
- Добавить краткую factual rebind запись в `WORKLOG.md`.
- Не трогать `BIBLE.md` и `CANON.md`, если нет прямого factual contradiction.

## Критерии приёмки
- [ ] Active docs отражают delivered all-scenes TXT export.
- [ ] Source status artifact связывает PR `1068`, feature commit и merge SHA.
- [ ] В wording нет broader `text export` claim.
- [ ] В wording нет manuscript assembly or package export claim.
- [ ] В wording нет MVP widening claim.
- [ ] Runtime truth описан через существующий delivered command path only.

## Промежуточные тестирования
- CHECK_01 выполняется до правок: clean branch относительно base, correct branch, source feature merged on main, PR or commit or merge chain verified.
- CHECK_02: targeted all-scenes TXT export contracts и adjacent current-scene plus selected-scenes plus command-surface guards.
- CHECK_03: oss policy, diff check, and claim audit against active docs.

## Риски и откат
- Риск: случайно назвать contour шире, чем `all scenes TXT export`.
- Риск: случайно смешать delivered feature rebind и новый runtime contour.
- Риск: случайно ввести manuscript assembly semantics через wording.
- Откат: убрать source status artifact и factual doc lines одним bounded revert commit.
