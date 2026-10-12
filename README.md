⚠️ Work in progress (writer v1). APIs and behavior may change.
# Yalken

Спокойный локальный редактор для письма и редактуры текста.

Yalken развивается как desktop-first и offline-first writer tool с приоритетом на:
- надёжный primary editor path,
- предсказуемое восстановление текста,
- локальное хранение,
- минимальную хрупкость интерфейса и процесса.

## Канон
- Active execution canon: `docs/OPS/STATUS/CANON_STATUS.json`
- Верхний repo canon: `CANON.md`
- COREX resolver: `docs/corex/COREX.md`
- Current COREX: `docs/corex/COREX.v2.md`
- Product map: `docs/BIBLE.md`
- Agent start protocol: `docs/AGENT_START_PROTOCOL.md`
- Architecture one-page: `docs/ARCHITECTURE_ONE_PAGE.md`
- Product glossary: `docs/PRODUCT_GLOSSARY.md`
- Factual context: `docs/CONTEXT.md`
- Process: `docs/PROCESS.md`
- Handoff: `docs/HANDOFF.md`
- Feature integration: `docs/YALKEN_DESIGN_OS_FEATURE_INTEGRATION_DOCTRINE_V1.md`

## Архитектура интеграции

- Product Core владеет данными и доменным смыслом.
- Command Kernel владеет действиями и availability.
- Design OS владеет вычисляемой формой интерфейса.
- Новая фича подключает product plane и interface plane раздельно.
- Мутации идут через canonical Commands, внешние эффекты — через product ports
  и adapters, интерфейс — через surface manifests и typed slots.
- UI, workers и feature packs не получают прямой доступ к project storage.
- Несохранённый текст является authoring working state с no-loss duty и не
  принадлежит shell-state.
- Видимость команды вычисляет Design OS, но capability при dispatch всегда
  повторно проверяет Command Kernel.
- Manifests сначала фиксируются в ТЗ; они не создают speculative runtime
  registry или feature pack автоматически.

## Writer V1

Текущий ориентир версии:
- strict data core,
- reliable primary editor path,
- zero-bypass command surface,
- safe reset and restore,
- bounded spatial containers,
- mutable design that never threatens text truth.

## Current State

Сейчас merged repair wave уже подтверждена как repo-wide closed state на main:
- earlier closure claims не считаются достаточным доказательством полного repo-level closure,
- repo-wide done уже подтвержден на main после merge gate и post-merge reconfirm,
- Phase 03 blocker уже закрыт на main через merged repair wave,
- true Phase 04 design-layer baseline уже закрыт на main через merged repair wave,
- Phase 05 bounded spatial shell chain уже закрыт на main через merged repair wave,
- Phase 06 explicit skip contour уже закрыт на main через merged repair wave,
- Phase 07 required closure set уже закрыт на main через post-merge reconfirm,
- branch-local closure остаётся историческим этапом и не является текущим repo-wide состоянием,
- broader freedom не открывается автоматически после repair closure.

Это не означает автоматический переход к новой обязательной версии:
- broader freedom остаётся только post-version-one evaluation axis,
- future expansion не переоткрывает закрытый `Writer v1`,
- evaluation-only работа не считается новой release law сама по себе.

## MVP Invariants
- desktop-first
- offline-first
- сцены как отдельные сущности
- atomic write и recovery обязательны
- DOCX first export
- без cloud truth и network truth в `v1`
- без executable plugin runtime в `v1`

## Не входит в текущий scope
- аккаунты и авторизация
- синхронизация и облачное хранение
- social layer
- executable plugin ecosystem
- platform-first expansion

## Запуск
```bash
npm install
npm run dev
```

## Старт агента

Агенту достаточно репозитория и одной конкретной цели. Перед чтением task-specific
файлов он запускает read-only bootstrap:

```bash
npm run agent:bootstrap -- --objective "один конкретный результат"
```

Перед любым write агент заполняет архитектурную декларацию и запускает:

```bash
npm run agent:preflight -- --declaration path-to-declaration.json
npm run agent:guardrails
```

Полный маршрут и STOP-условия находятся в `docs/AGENT_START_PROTOCOL.md`.

## Проверка зависимостей
- `npm run oss:policy`

## Сборка macOS
- `npm run build:mac`

## Где хранятся данные

Полная [карта хранения Ялкена](docs/STORAGE_MAP.md) проверена 12 октября 2026:
точные пути, роли носителей, восстановление архивов и устаревшие ссылки.

| Что | Текущее место |
|---|---|
| Рабочий Git | `/Volumes/T7-Secure/storage/yalken/canonical/writer-editor-codex` |
| Worktrees | `/Volumes/T7-Secure/worktrees/yalken` |
| Прежние исследования, runtime и evidence | `/Volumes/T7-Secure/storage/yalken` |
| Архивы, перенесённые из iCloud | `/Volumes/T777/Yalken/Из iCloud 2026-10-12` |
| Все новые данные и материалы Ялкена | `/Volumes/T777/Yalken/Новые материалы` |
| Новые отчёты, логи и результаты проверок | `/Volumes/T777/Yalken/Отчёты о работе` |
| Исторический дизайн и исследования | `/Volumes/T7/YALKEN_MASTER_VAULT_2026-07-17` |
| Тестовые материалы на Яндексе | `/Users/kirillponomarev/Yandex.Disk.localized/Yalken — тестовые материалы` |

На T777 перенесена только прежняя коллекция iCloud: 193 файла / 15,68 ГБ,
включая 72 архива. Яндекс и остальные источники этим переносом не менялись.
**Все новые материалы и отчёты нашей работы по Ялкену сохраняем на T777**,
в датированных папках задач. iCloud и Яндекс для новых результатов не используем.
Код и обязательные Git-документы остаются в рабочем репозитории; прежние активные
БД и профили этим правилом не перемещаются. При недоступном T777 новые результаты
не складываем молча на другой носитель. Карта отдельно
перечисляет оставшиеся на Mac материалы, raw-истории Codex и контрольные журналы.

Данные самого редактора: по умолчанию `~/Documents/craftsman/`, служебное
состояние macOS — `~/Library/Application Support/craftsman/`.
Legacy `WriterEditor`, выбранные project roots и изолированные тестовые профили
могут иметь другие пути; см. карту и код `src/utils/fileManager.js`, `src/main.js`.
Эти папки не являются полной картой материалов разработки. Нативная задача
Yalken ↔ Word for Mac V4.1 возобновлена прямым поручением владельца
13 октября 2026; это не означает завершённую native-приёмку.
Новые материалы этой задачи сохраняются в
`/Volumes/T777/Yalken/Новые материалы/2026-10-13--mac-word-finish-v4-1`,
отчёты и логи — в
`/Volumes/T777/Yalken/Отчёты о работе/2026-10-13--mac-word-finish-v4-1`.
Необходимый временный APFS runtime объявляется отдельно по карте хранения;
конечные материалы остаются на T777. Автоматическое перемещение не настроено.

## Лицензия
- AGPL-3.0-or-later
