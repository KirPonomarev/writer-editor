# ТЗ для Codex: POST_MVP_PROJECT_TXT_EXPORT_001

## Контекст / ограничения
- Контур post-MVP и не widening `IMPORT_EXPORT_PRODUCT_ACCEPTANCE_GATE_001_STATUS.json`.
- Offline-first, без сети, без новых зависимостей, без UI redesign.
- `cmd.project.exportCurrentSceneTxtV1` и `cmd.project.exportSelectedScenesTxtV1` already exist как более узкие TXT export paths; новый contour не должен ломать их и не должен расширять их claim.
- Main остаётся единственным authority для canonical scope rebuild, source read, save dialog, target validation и atomic external TXT write.
- Renderer не получает source text, scene paths, tree truth, assembly truth или manuscript truth.
- Export writes only one external TXT file and не пишет project truth, manuscript truth, receipt, recovery или page truth обратно в проект.
- Diff budget: точечные правки в menu surface, main command path, command kernel allowlist, targeted tests и factual docs.

## Файлы
- main.js
- menu-config.v2.json
- menu-locale.catalog.v1.json
- commandSurfaceKernel.js
- targeted tests
- docs/tasks/POST_MVP_PROJECT_TXT_EXPORT_001.md
- factual docs и status artifact

## Проблема
- Сейчас есть bounded current-scene TXT export и bounded selected-scenes TXT export, но нет безопасного user-facing whole-project TXT export для всех canonical scenes в один внешний TXT файл.
- Нельзя смешивать такой export с full manuscript assembly, chapter packaging, book profile или tree UI truth.

## Цель
- Добавить bounded project TXT export contour:
  - один user-facing File menu command,
  - main-owned canonical scene scope rebuild,
  - canonical scene source reads through existing snapshot-or-disk envelope path,
  - one external atomic TXT write,
  - deterministic minimal separator policy,
  - без renderer text authority, без tree selection authority и без assembly semantics.

## Что сделать
- Добавить user-facing command `cmd.project.exportAllScenesTxtV1` в File menu, если в локальном коде не обнаружится ещё более каноничное узкое имя того же scene-only смысла.
- Реализовать main-owned project TXT export handler с admitted payload only for request metadata and optional outPath.
- Canonically rebuild project export scope только из exportable scene documents в существующем canonical order.
- Не включать `chapter-file`, `roman-section`, `materials`, `reference`, `mindmap`, `print`, review data или любые assembly-derived layers.
- Блокировать target внутри project root и overwrite любого source scene file.
- Читать current open scene только через existing canonical snapshot path; если current scene dirty или autosave in progress и она входит в scope, fail-closed.
- Читать остальные scoped scenes canonically from disk plus envelope parse.
- Собрать один внешний TXT файл из всех scoped scene texts с deterministic minimal separator only.
- Добавить targeted contracts, adjacent TXT export regression checks и factual docs sync.

## Критерии приёмки
- [ ] `cmd.project.exportAllScenesTxtV1` доступен как bounded File menu command.
- [ ] Scope строится только из canonical scene documents и не опирается на tree UI state.
- [ ] Main остаётся единственным authority для scope, source read, save dialog, target validation и write.
- [ ] Renderer не получает text truth, path truth, tree truth или assembly truth.
- [ ] Export target cannot equal any source scene path and cannot live inside project root.
- [ ] Successful export writes exactly one external TXT file through atomic write.
- [ ] Current-scene TXT export и selected-scenes TXT export остаются отдельными contour truths и не ломаются.
- [ ] Contour не widening closed import/export MVP gate и не открывает broader manuscript/package export claim.

## Промежуточные тестирования
- CHECK_01 выполняется до правок: clean worktree и корректная ветка.
- CHECK_02: targeted project TXT export contracts.
- CHECK_03: adjacent current-scene и selected-scenes TXT export regression checks.
- CHECK_04: command namespace or allowlist checks, если новый command id добавлен в bounded kernel family.
- CHECK_05: oss policy, git diff check, packaged renderer proof only if renderer changed.
- CHECK_06: независимый skeptical audit на layer truth, command truth и non-claims.

## Delivery policy
- COMMIT_REQUIRED: true
- PUSH_REQUIRED: true
- PR_REQUIRED: true
- MERGE_REQUIRED: true

## Риски и откат
- Риск: случайно смешать project TXT export с manuscript assembly или package export semantics.
- Риск: случайно использовать tree UI state, chapter-file scope или renderer authority как export truth.
- Риск: случайно расширить command truth surface шире локального прецедента существующих TXT export paths.
- Откат: убрать project TXT export command family, tests и docs одним bounded revert commit.
