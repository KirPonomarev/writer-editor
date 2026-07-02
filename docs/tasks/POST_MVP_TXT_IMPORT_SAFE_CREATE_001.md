# ТЗ для Codex: POST_MVP_TXT_IMPORT_SAFE_CREATE_001

## Контекст / ограничения
- Контур post-MVP, не widening старого `IMPORT_EXPORT_PRODUCT_CLOSEOUT_BINDING_001`.
- Offline-first, без сети, без новых зависимостей.
- Main-owned local file entry: chooser, stat, read, restat, file guards живут в main.
- Renderer не является источником текста; renderer только запускает preview и accept.
- Preview ничего не пишет в project truth.
- Accept создаёт только новую isolated scene под `roman/Imported`.
- Допустимы только UTF-8 и UTF-8 BOM; всё остальное fail-closed.
- Не трогать `commandSurfaceKernel` allowlist и не переоткрывать raw Markdown truth.
- Diff budget: точечные правки в import command surface, main bridge, renderer flow, menu surface, capability truth, targeted tests.

## Файлы
- main.js
- editor.js
- projectCommands.mjs
- command-catalog.v1.mjs
- capabilityPolicy.mjs
- menu-config.v2.json
- menu-locale.catalog.v1.json
- COMMAND_CAPABILITY_BINDING.json
- новые util и targeted tests для TXT import

## Проблема
- Сейчас есть Markdown import и DOCX import, но нет bounded local TXT import через preview plus safe-create.
- Нельзя безопасно выбрать `.txt` локально, проверить encoding и создать новую сцену без ручных обходов.

## Цель
- Добавить user-facing `cmd.project.importTxtV1` по паттерну DOCX import:
  - local preview в main,
  - explicit accept,
  - safe-create новой сцены,
  - refresh tree,
  - open created scene,
  - без overwrite текущей сцены.

## Что сделать
- Добавить user-facing command `cmd.project.importTxtV1`.
- Добавить bridge-only commands `cmd.project.txt.previewLocalFile` и `cmd.project.txt.importSafeCreate`.
- Реализовать main-owned TXT local preview helper с picker/stat/read/restat и strict UTF-8 guard.
- Реализовать TXT safe-create helper с admitted preview plan, create-only path и atomic write.
- Добавить renderer preview/accept flow без прямой text authority.
- Добавить file-menu entry в текущую структуру `Документ`, без redesign.
- Добавить targeted tests на command flow, preview helper, safe-create helper и renderer open-scene path.

## Критерии приёмки
- [ ] `cmd.project.importTxtV1` доступен как user-facing command.
- [ ] Preview выбирает локальный `.txt` в main и ничего не пишет.
- [ ] Не-UTF-8 и не-UTF-8-BOM входы блокируются.
- [ ] Accept создаёт только новую сцену в `Imported`, без overwrite.
- [ ] После accept дерево перезагружается и открывается ровно созданная сцена.
- [ ] `commandSurfaceKernel` allowlist не widened.
- [ ] Старые Markdown import truth tests не ломаются.

## Промежуточные тестирования
- CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
- CHECK_01: чистый worktree и корректная ветка.
- CHECK_02: targeted node tests по TXT import helper и flow.
- CHECK_03: build renderer bundle.
- CHECK_04: независимая сверка command/capability/menu truth и отсутствие scope drift.

## Риски и откат
- Риск: случайно смешать user-facing TXT contour с raw Markdown/kernel truth.
- Риск: утянуть path-bearing поля в preview/receipt surface.
- Откат: убрать TXT command family, menu entry и helpers одним bounded revert commit.
