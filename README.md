⚠️ Work in progress (writer v1). APIs and behavior may change.
# Yalken

Спокойный локальный редактор для письма и редактуры текста.

Yalken развивается как desktop-first и offline-first writer tool с приоритетом на:
- надёжный primary editor path,
- предсказуемое восстановление текста,
- локальное хранение,
- минимальную хрупкость интерфейса и процесса.

## Канон
- Верхний repo canon: `CANON.md`
- Active execution canon: `docs/OPS/STATUS/CANON_STATUS.json`
- COREX: `docs/corex/COREX.v1.md`
- Product map: `docs/BIBLE.md`
- Factual context: `docs/CONTEXT.md`
- Process: `docs/PROCESS.md`
- Handoff: `docs/HANDOFF.md`

## Writer V1

Текущий ориентир версии:
- strict data core,
- reliable primary editor path,
- zero-bypass command surface,
- safe reset and restore,
- bounded spatial containers,
- mutable design that never threatens text truth.

## Current State

Сейчас репозиторий находится в repair-closed state для текущей волны:
- earlier closure claims не считаются достаточным доказательством полного repo-level closure,
- текущая repair wave честно закрыта в этом repo после final sweep,
- Phase 03 blocker уже закрыт в текущей repair branch,
- true Phase 04 design-layer baseline уже закрыт в текущей repair branch,
- Phase 05 bounded spatial shell chain уже закрыт в текущей repair branch,
- Phase 06 explicit skip contour уже закрыт в текущей repair branch,
- Phase 07 conditional cross-branch proof repair уже закрыт в текущей repair branch,
- overall repair wave подтверждена локальными machine checks в этой repair branch,
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

## Проверка зависимостей
- `npm run oss:policy`

## Сборка macOS
- `npm run build:mac`

## Где хранятся данные
- Основная папка: `~/Documents/craftsman/`
- Дополнительные настройки: `app.getPath('userData')`

## Лицензия
- AGPL-3.0-or-later
