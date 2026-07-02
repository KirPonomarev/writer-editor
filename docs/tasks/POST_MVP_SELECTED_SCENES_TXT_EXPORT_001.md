# ТЗ для Codex: POST_MVP_SELECTED_SCENES_TXT_EXPORT_001

## Контекст / ограничения
- Контур post-MVP и не widening `IMPORT_EXPORT_PRODUCT_ACCEPTANCE_GATE_001_STATUS.json`.
- Offline-first, без сети, без новых зависимостей, без UI redesign.
- `cmd.project.exportCurrentSceneTxtV1` already exists как current-scene-only bounded path; новый contour не должен ломать или расширять его claim.
- Main остаётся единственным authority для canonical scene scope, source read, save dialog, target validation и atomic external TXT write.
- Renderer не получает source text, scene paths или tree truth; renderer может владеть только transient picker intent и confirmed sceneIds.
- Tree sidebar selection не должна становиться export truth и не должна превращаться в persistent multi-select contour.
- Export writes only one external TXT file and не пишет page truth, project truth или manuscript truth обратно в проект.
- Diff budget: точечные правки в menu surface, main command path, renderer transient modal, targeted tests и factual docs.

## Файлы
- main.js
- editor.js
- editor.bundle.js
- index.html
- styles.css
- commandSurfaceKernel.js
- menu-config.v2.json
- menu-locale.catalog.v1.json
- новые targeted tests
- factual docs и status artifact

## Проблема
- Сейчас есть bounded current-scene TXT export и bounded TXT import, но нет безопасного user-facing selected-scenes TXT export для нескольких canonical scenes в один внешний TXT файл.
- Нельзя использовать tree row selection как truth, потому что текущая tree wiring single-path и open-document driven.

## Цель
- Добавить bounded selected-scenes TXT export contour:
  - File menu entry,
  - transient picker в renderer,
  - main-owned canonical scene scope query,
  - confirmed sceneIds only from renderer,
  - canonical disk-backed source reads,
  - one external atomic TXT write,
  - без persistent tree multi-select и без renderer text authority.

## Что сделать
- Добавить user-facing command `cmd.project.exportSelectedScenesTxtV1` в File menu.
- Открывать transient selected-scenes picker только через canonical runtime command path.
- Добавить main-owned workspace query для renderer-safe scene candidates без path leakage.
- Реализовать main-owned selected-scenes TXT export handler с admitted payload `confirmed`, `requestId`, `outPath`, `selectedSceneIds`.
- Валидировать, что каждый selected item canonically resolves to kind `scene`.
- Блокировать overwrite selected source files и любой target внутри project root.
- Читать selected scene content canonically: current clean scene через existing snapshot path, остальные сцены через disk plus envelope parse.
- Собрать один внешний TXT файл из selected scene texts в canonical order.
- Добавить targeted contracts, renderer UI-flow tests, bundle proof и factual docs sync.

## Критерии приёмки
- [ ] `cmd.project.exportSelectedScenesTxtV1` доступен как bounded File menu command.
- [ ] Renderer открывает только transient picker и передаёт только confirmed sceneIds.
- [ ] Renderer не становится источником text truth, path truth или tree multi-select truth.
- [ ] Main canonically rebuilds selected scene scope и fail-closed на unknown or invalid scene ids.
- [ ] Export target cannot equal any selected source path and cannot live inside project root.
- [ ] Successful export writes exactly one external TXT file through atomic write.
- [ ] Current-scene TXT export contour остаётся отдельным и не ломается.
- [ ] Contour не widening closed import/export MVP gate и не открывает broader text export claim.

## Промежуточные тестирования
- CHECK_01 выполняется до правок: clean worktree и корректная ветка.
- CHECK_02: build renderer bundle.
- CHECK_03: targeted selected-scenes TXT export contracts и renderer flow tests.
- CHECK_04: adjacent current-scene TXT export and command namespace regression checks.
- CHECK_05: oss policy, packaged renderer bundle proof, git diff check.
- CHECK_06: независимый skeptical audit на layer truth и path guard.

## Delivery policy
- COMMIT_REQUIRED: true
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true

## Риски и откат
- Риск: случайно смешать transient tree or modal UI state с canonical export truth.
- Риск: случайно протащить renderer authority fields, scene paths или raw text в export payload.
- Риск: случайно превратить contour в broader manuscript TXT export claim.
- Откат: убрать selected-scenes command family, transient picker, scope query, tests и docs одним bounded revert commit.
