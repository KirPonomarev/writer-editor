# ТЗ для Codex: POST_MVP_SELECTED_SCENES_TXT_EXPORT_FACTUAL_REBIND_001

## Контекст / ограничения
- Это не новый runtime contour, а factual rebind уже доставленного selected scenes TXT export.
- Source feature уже merged on main через PR `1063` с merge SHA `fd95fba386b31add3373c6179fcef97c2b89afcf`.
- Source feature commit в merged delivery chain: `a7826d1e5045961125737bc14de5881bd80832b2`.
- Scope остается post-MVP и не widening `IMPORT_EXPORT_PRODUCT_ACCEPTANCE_GATE_001_STATUS.json`.
- Offline-first, без сети, без новых зависимостей, без UI redesign.
- Нельзя расширять claim до manuscript TXT export, package export, broader text export, persistent tree multi-select, palette command или новых format lanes.
- Renderer не получает authority на source text, source path или tree truth; renderer владеет только transient picker intent и confirmed sceneIds.
- Diff budget: узкий task brief, точечный update source status artifact и sync active factual docs.

## Файлы
- docs/tasks/POST_MVP_SELECTED_SCENES_TXT_EXPORT_FACTUAL_REBIND_001.md
- docs/OPS/STATUS/POST_MVP_SELECTED_SCENES_TXT_EXPORT_001_STATUS.json
- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/WORKLOG.md

## Проблема
- `cmd.project.exportSelectedScenesTxtV1` уже merged on current mainline, но source status artifact все еще помечен как pending delivery.
- Active docs пока не фиксируют delivered selected-scenes TXT export как текущую factual truth.

## Цель
- Честно зафиксировать delivered selected scenes TXT export как bounded post-MVP export surface без расширения import/export MVP gate и без открытия новых runtime claims.

## Что сделать
- Обновить `POST_MVP_SELECTED_SCENES_TXT_EXPORT_001_STATUS.json` только в stale delivery/binding truth:
  - merged PR,
  - merged feature commit,
  - merge SHA,
  - delivered status,
  - active-doc binding completion.
- Обновить `CONTEXT.md` и `HANDOFF.md` ровно на текущую factual truth:
  - selected scenes File menu only,
  - renderer transient checkbox picker plus confirmed sceneIds only,
  - main-owned canonical scope rebuild, source reads, save dialog, target validation и atomic external TXT write,
  - pathless and project-root-free scope query,
  - no tree truth rewrite and no persistent multi-select,
  - target path cannot equal selected sources and cannot live inside project root.
- Добавить краткую factual rebind запись в `WORKLOG.md`.
- Не трогать `BIBLE.md` и `CANON.md`, если нет прямого factual contradiction.

## Критерии приёмки
- [ ] Active docs отражают delivered selected scenes TXT export.
- [ ] Source status artifact больше не утверждает pending delivery.
- [ ] Source status artifact правильно связывает PR `1063`, feature commit и merge SHA.
- [ ] В wording нет broader `text export` claim.
- [ ] В wording нет persistent tree multi-select claim.
- [ ] В wording нет palette command claim.
- [ ] Current-scene TXT export и TXT import остаются отдельными contour truth.

## Промежуточные тестирования
- CHECK_01 выполняется до правок: clean worktree, correct branch, source feature merged on main, PR/commit/merge chain verified.
- CHECK_02: targeted selected-scenes TXT export contracts и adjacent current-scene плюс command-surface guards.
- CHECK_03: claim audit against active docs и `git diff --check`.

## Риски и откат
- Риск: случайно зафиксировать неверный feature commit SHA вместо реального PR head commit.
- Риск: случайно назвать contour шире, чем `selected scenes TXT export`.
- Риск: случайно смешать factual rebind contour с новым runtime contour.
- Откат: убрать factual doc lines и source status rebind одним bounded revert commit.
