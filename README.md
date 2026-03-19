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

Сейчас репозиторий находится в post-closure factual state:
- primary editor path закрыт и является основным,
- editor closure подтверждён machine-bound packet,
- factual docs синхронизируются с active canon,
- дальнейшая работа идёт уже после closure, а не внутри старого transition milestone.

Это не означает, что весь `Writer v1` завершён:
- data core hardening,
- wider shell truth,
- bounded spatial layer,
- optional pack layer,
- release hardening
ещё впереди.

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
