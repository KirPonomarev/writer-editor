# Где хранятся данные Ялкена

STATUS: OBSERVED_STORAGE_MAP
DOCUMENT_CLASS: REFERENCE
OBSERVED_AT: 2026-10-12T20:13:53.861993+03:00
SOURCE_CODE_SHA: 3408f3616c8871728a32cacdd70fda70a019c741
CLAIM_BOUNDARY: проверенные пути этого Mac и подключённых дисков; не полнота удалённых облаков, не разрешение на очистку и не подтверждение всех runtime-функций.

## Главное

По решению владельца от 12 октября 2026 архивы нашей работы, ранее отправленные с Mac в iCloud, хранятся на **T777**. По последующему прямому указанию владельца **все новые данные, материалы и отчёты нашей работы по Ялкену сохраняются на T777**, включая исследования, выгрузки, архивы, рендеры, проверочные данные, логи и результаты проверок. Это правило касается новых материалов; оно не запускает перенос остальных существующих источников. Действующий Git и рабочие лаборатории остаются на **T7-Secure**. Исторические коллекции остаются на **T7**, пользовательские данные и исходные истории — на **Mac**, тестовые материалы — на **Яндекс.Диске**. Эта карта не перемещает данные и не запускает синхронизацию.

**T777 не содержит копию всего Ялкена со всех носителей.** Перенос ограничен прежней папкой Ялкена в iCloud: 193 файла, 15 677 655 301 байт, включая 72 архива (50 ZIP и 22 GZIP). Файлы перечитаны с T777 по SHA-256; архивы также сопоставлены с исходными хешами создания. Подробная приёмка находится по путям ниже. Папка iCloud отсутствует в локальном пространстве имён; отдельное подтверждение удаления со стороны сервера iCloud не получено.

## Основные места

| Роль | Точный путь | Что там и как использовать |
|---|---|---|
| Рабочий Git | `/Volumes/T7-Secure/storage/yalken/canonical/writer-editor-codex` | Единственный канонический checkout. Локальный main при проверке: 5d0c5865; remote main: 3408f361. Наличие папки не означает синхронность веток. |
| Реестр проектов | `/Volumes/T7-Secure/storage/PROJECTS.json` | Выбирает canonical_path; его verified_head — датированный снимок, текущий SHA проверять через Git. |
| Рабочие деревья | `/Volumes/T7-Secure/worktrees/yalken` | Технические worktrees; точные регистрации: git worktree list --porcelain из канонического repo. Это не независимые бэкапы. |
| Материалы разработки | `/Volumes/T7-Secure/storage/yalken` | Лаборатории, исследования, evidence, recovery, runtime и архивы; разбор ниже. |
| Архив из iCloud | `/Volumes/T777/Yalken/Из iCloud 2026-10-12` | Проверенная коллекция из 193 файлов; сохранять весь набор. |
| Все новые данные и материалы | `/Volumes/T777/Yalken/Новые материалы` | Подготовленная папка; автоматического копирования нет. |
| Новые отчёты и доказательства работы | `/Volumes/T777/Yalken/Отчёты о работе` | Для каждой задачи отдельная датированная папка: отчёт, опись, SHA-256 и результаты проверок. |
| Повторная проверка 12 октября | `/Volumes/T777/Yalken/Отчёты о работе/2026-10-12--storage-recheck` | FULL_READBACK.json, PATH_RECHECK.json, REMOTE_DOCS_SCAN.json и итоговый отчёт. |
| Доказательства переноса | `/Volumes/T777/Yalken/Проверка переноса 2026-10-12` | PLAN.json, FINAL_VERIFICATION.json, EXTENDED_METADATA.json, COMPLETE.json, POST_MOVE_AUDIT.json. |
| Исторический мастер-архив | `/Volumes/T7/YALKEN_MASTER_VAULT_2026-07-17` | Снимки дизайна, бренда, исследований, кода и recovery с июля 2026; не действующий Git. |
| Старые сборки с Mac | `/Volumes/T7-Secure/storage/yalken/archives/storage-cleanup-20261010` | 226 архивов в вложенной структуре. Точные назначения — COPY_VERIFICATION_COMPLETE.json. Удаление исходных Mac-копий — LOCAL_COPY_REMOVAL_COMPLETE.json. |
| Яндекс.Диск | `/Users/kirillponomarev/Yandex.Disk.localized/Yalken — тестовые материалы` | Проверено наличие локального каталога и трёх групп ниже; удалённая полнота/гидратация не подтверждаются. Ничего не переносилось и не удалялось. |
| Контроль Mac → iCloud | `/Users/kirillponomarev/Documents/Yalken-iCloud-Migration-2026-10-11` | Описи, исходные пути, инструменты и исторические результаты миграции. |
| Контроль очистки и паузы | `/Users/kirillponomarev/Documents/Yalken-iCloud-Migration-2026-10-11/supervision-20261012` | Прежние checkpoints и доказательства очисток Mac/T7. TASK/STATE не являются текущей командой продолжать старую миграцию. |
| Контроль iCloud → T777 | `/Users/kirillponomarev/Documents/Yalken-iCloud-to-T777-2026-10-12` | Точная опись, финальные проверки, журналы удаления только прежнего iCloud-источника. |
| Аудит этой карты | `/Users/kirillponomarev/Documents/Yalken-iCloud-to-T777-2026-10-12/documentation-audit-20261012` | PATH_AUDIT.json: наблюдения путей, ссылки, результаты поиска по документации; исходный README сохранён отдельно. |

Git remote кода: `https://github.com/KirPonomarev/writer-editor.git`. GitHub не хранит автоматически локальный WIP, raw-истории, архивы или тестовые профили. Техническая ветка документации не становится новым каноническим checkout. Доставка выполняется обычным Git PR; синхронизация main не перемещает пользовательские данные.

## Как открыть архивы на T777

- ZIP, GZIP, metadata и restore.py: `/Volumes/T777/Yalken/Из iCloud 2026-10-12/Архив Mac 2026-10-11`.
- Инструкция восстановления: `/Volumes/T777/Yalken/Из iCloud 2026-10-12/Архив Mac 2026-10-11/Учёт переноса 1791753731962598000/КАК ВОССТАНОВИТЬ.txt`.
- Опись, контрольные суммы и прежние отчёты: `/Volumes/T777/Yalken/Из iCloud 2026-10-12/Архив Mac 2026-10-11/Учёт переноса 1791753731962598000`.
- Прежняя опись Яндекса, а не сами материалы Яндекса: `/Volumes/T777/Yalken/Из iCloud 2026-10-12/Учёт Яндекс Диска 1791759811963179000`.

`restore.py` находится непосредственно рядом с 50 ZIP, а текстовая инструкция — во вложенной папке учёта. Скрипт читает manifests из всех ZIP, разрешает ссылки на соседние ZIP и проверяет SHA-256 восстановленного содержимого. Запускать только с новым, ещё не существующим каталогом назначения и достаточным свободным местом. Не направлять восстановление в текущие Documents, checkout, профили или .codex. Полное восстановление может быть значительно больше 15,68 ГБ.

22 файла `sanitizedhistory-*.jsonl.gz` распаковываются отдельно; соответствующие `*.metadata.json` содержат контрольные суммы. Это очищенные производные журналы; исходные raw-сессии на Mac ими не заменяются. `files.jsonl.gz` в папке учёта — каталог метаданных, а не содержимое всех файлов.

Папки `Дизайн`, `Исследования`, `Материалы`, `Сборки` внутри перенесённого корня сохранены как часть прежней структуры. Они не доказывают наличие новых материалов: смотреть фактическую опись.

exFAT сохраняет Unicode-имена в иной нормализации и создаёт AppleDouble-файлы `._*` для метаданных. Их не считать самостоятельными архивами и не удалять как мусор. ResourceFork textClipping и FinderInfo сохранены и проверены; прочие исходные атрибуты и права записаны в EXTENDED_METADATA.json. Технические атрибуты безопасности не применялись как новые права.

## Что осталось на T7-Secure

Все перечисленные ниже каталоги существуют непосредственно внутри `/Volumes/T7-Secure/storage/yalken`. Названия описывают назначения; это не классификация на «можно удалить». Состояние конкретного запуска определяют его собственные receipts, admission и checkpoint.

| Группа | Каталоги относительно корня |
|---|---|
| Код и отдельные исследовательские окружения | `canonical`, `interop-lab`, `sandboxes` |
| Рабочие и тестовые приложения | `runtime`, `interop-test-runtime`, `word-lab`, `lab`, `post-d1-editor-lab` |
| Word / interop / физические проверки | `word-safe-semantic-v4`, `word-latest-semantic-v2`, `word-safety-remediation-v1`, `word-roundtrip-release-audit-night-01`, `google-docs-real-account-e2e-v1`, `audit-r1-physical`, `r24-corrective-physical-evidence`, `interop-chain`, `c5-tiny-preflight` |
| Результаты и восстановление | `evidence`, `recovery`, `recovery-packets`, `checkpoints`, `program-checkpoints`, `codex-session-archives`, `archives` |
| Управление задачами | `handoff`, `supervision`, `task-declarations`, `mission-state-r24`, `architecture` |
| Исследования | `research`, `final-scientific-research-20260819.8WbT9B` |
| Технические каталоги — статус каждого проверять отдельно | `agent-temp`, `generated-trash`, `npm-cache`, `toolchains` |

Word/native остаётся **PAUSED** по решению владельца. Сохранённые профили, authority stores, исходные документы и evidence не становятся кэшем из-за названия runtime/lab. Историческое «продолжать автономно» в старых документах не снимает текущую паузу.

## История и дизайн на T7

Корень: `/Volumes/T7/YALKEN_MASTER_VAULT_2026-07-17`. Файлы `00_START_HERE/README_RU.md` и `KEY_ENTRYPOINTS_RU.md` описывают коллекцию на дату её сборки. Их слова «текущий код» или «текущий канон» означают июльский снимок, а не рабочий checkout октября.

| Папка относительно мастер-архива | Назначение |
|---|---|
| `00_START_HERE` | Историческая навигация и отчёты |
| `01_DESKTOP_ORDERED_AND_RECOVERED` | Эволюция дизайна и восстановленные материалы |
| `02_CURRENT_DOWNLOADS` | Сохранённые оригиналы выгрузок; использовать прямые пути вместо сломанных ссылок Downloads |
| `03_T7_MIGRATED_ARCHIVE` | Ранняя миграция и архивные ветки |
| `04_LEGACY_CRAFTSMAN_WORKSPACE` | Снимок старого workspace |
| `05_OBSIDIAN_KNOWLEDGE_BASE` | Снимок базы знаний Pushkin |
| `06_CURRENT_RUNTIME_AND_CODE` | Исторический код/runtime и Git bundle |
| `07_CODEX_THREADS_AND_RENDERS` | Восстановленные треды, вложения, рендеры |
| `08_RECOVERY_BUNDLES` | Recovery-пакеты |
| `09_SPECIAL_CONSOLIDATED_PACKS` | Сводные UI-пакеты |
| `10_RESEARCH_DELIVERIES` | Исследования рынка и продукта |
| `11_YALKEN_LOGO_LIBRARY_ALL_VARIANTS` | Библиотека вариантов логотипа |
| `12_YALKEN_CANONICAL_BRAND_DESIGN_PACK_2026-07-19` | Исторический бренд-пакет |
| `13_YALKEN_AESTHETIC_LAB_20_2026-07-19` | Дизайн-эксперименты |
| `99_MANIFESTS` | Описи источников, дубликатов и контрольных сумм |

Дополнительные существующие материалы Ялкена вне мастер-архива:

- `/Volumes/T7/YALKEN_EXPERT_REVIEW_HANDOFF_2026-07-18`.
- `/Volumes/T7/YALKEN_EXPERT_REVIEW_HANDOFF_2026-07-18.zip`.
- `/Volumes/T7/YALKEN_LAST_MOCKUP_2026-07-18.html`.
- `/Volumes/T7/yalken-audit-20260815`.
- `/Volumes/T7/yalken-engineering-capsule-v1.zip`.
- `/Volumes/T7/все рендеры ялкена`.

В `/Users/kirillponomarev/Documents/Yalken-iCloud-to-T777-2026-10-12/documentation-audit-20261012/PATH_AUDIT.json` записаны 103 старые ссылки среди найденных именных объектов; 21 не разрешается. Для всех 21 в `02_CURRENT_DOWNLOADS` найден одноимённый объект. Это проверка наличия, а не новая побайтная аттестация всех 21; доказательство прежней очистки отдельно покрывает 19 точных дублей. Сами ссылки этой задачей не менялись.

Следующие имена в Downloads — **сломанные ссылки**. Использовать одноимённый объект под `/Volumes/T7/YALKEN_MASTER_VAULT_2026-07-17/02_CURRENT_DOWNLOADS`; пробелы в конце имени сохраняются:

- `Yalken_Brand_Identity_Final_v1`
- `yalken-2026-07-06-deepseek-router-lite-handoff`
- `yalken_brand_pack`
- `yalken_deep_research_v1`
- `yalken_editor_icons_svg`
- `yalken_full_screen_suite`
- `yalken_icon_benchmark_v2`
- `yalken_icon_probes`
- `yalken_identity_refined_pack(1)`
- `yalken_minimal_assets`
- `yalken_polished`
- `yalken_redesign_package (1)`
- `yalken_redesign_renders`
- `yalken_renders`
- `yalken_screen_render_pack_v01`
- `yalken_screen_render_pack_v01.zip`
- `Финальные документы по ялкен ос`
- `архив работа ялкин`
- `предпоследний ялкин дизайн `
- `продолжение ялкин ос `
- `финальный ялкин`

Оставшиеся рабочие ссылки Downloads указывают на `/Volumes/T7/Migrated/Home/Downloads`; точные конечные пути и состояние каждой ссылки записаны в PATH_AUDIT.json. Не считать их отдельной Mac-копией. Имена старых путей могут ссылаться на другие проекты — такие корни не становятся источниками Ялкена целиком.

## Что находится на Mac

| Данные | Точный путь | Граница |
|---|---|
| Проекты редактора | `/Users/kirillponomarev/Documents/craftsman` | Существующий стандартный каталог; библиотека может выбирать другой project root. |
| Старый каталог редактора | `/Users/kirillponomarev/Documents/WriterEditor` | Существует. Legacy fallback/migration в fileManager; не удалять по одному названию. |
| Настройки и состояние приложения | `/Users/kirillponomarev/Library/Application Support/craftsman` | Существует: settings.json, индекс библиотеки и служебное состояние. Не равно папке рукописи. |
| Исходные сессии Codex | `/Users/kirillponomarev/.codex/sessions` | Общий каталог всех проектов, не только Ялкена. |
| Архивированные сессии Codex | `/Users/kirillponomarev/.codex/archived_sessions` | Общий каталог; не заменяется sanitizedhistory. |
| Базы и остальное состояние Codex | `/Users/kirillponomarev/.codex` | Не переносить и не чистить целиком; эта карта не публикует содержимое БД или конфигурации. |
| Рендеры и результаты Codex | `/Users/kirillponomarev/.codex/visualizations` | Общий каталог; принадлежность Ялкену проверять по задаче/описи. |
| Другие результаты Codex | `/Users/kirillponomarev/.codex/outputs` | Общий каталог; частично архивированные материалы не означают, что весь каталог скопирован. |
| Датированные рабочие результаты | `/Users/kirillponomarev/Documents/Codex` | Смешанные задачи; только точные Yalken-пути в описях входят в эту работу. |

Дополнительно подтверждены следующие самостоятельные каталоги с именем Ялкена/редактора. Это навигация к имеющимся материалам, не подтверждение актуальности старых копий исходников:

- `/Users/kirillponomarev/Desktop/Phosphor Icons — Yalken MIT`.
- `/Users/kirillponomarev/Desktop/YALKEN — ФИНАЛ ПРАВОК — восстановлено 2026-09-09`.
- `/Users/kirillponomarev/Desktop/проработка дизайна Ялкена `.
- `/Users/kirillponomarev/Desktop/ялкен лого финал`.
- `/Users/kirillponomarev/Downloads/YALKEN_GLOBAL_WRITING_MARKET_2026_DELIVERY`.
- `/Users/kirillponomarev/Downloads/YALKEN_REIMAGINED_DELIVERY_2026-07-15`.
- `/Users/kirillponomarev/Downloads/YALKEN_TEXT_INTEGRITY_AUDIT_PACKAGE_V4`.
- `/Users/kirillponomarev/Downloads/Yalken_Atlas_Research_Package(1)`.
- `/Users/kirillponomarev/Downloads/Yalken_audit_recheck_2026-08-04`.
- `/Users/kirillponomarev/Downloads/Yalken_audit_recheck_2026-08-04 2`.
- `/Users/kirillponomarev/Downloads/Yalken_audit_recheck_2026-08-04 3`.
- `/Users/kirillponomarev/Downloads/writer-editor-main`.
- `/Users/kirillponomarev/Downloads/writer-editor-main-2`.
- `/Users/kirillponomarev/Downloads/writer-editor-main-3`.
- `/Users/kirillponomarev/Downloads/yalken-archival-v6`.
- `/Users/kirillponomarev/Downloads/yalken-final-ux`.
- `/Users/kirillponomarev/Downloads/yalken-ultimate-v5`.
- `/Users/kirillponomarev/Downloads/ялкен вайбы дизайна `.
- `/Users/kirillponomarev/Documents/Yalken Experiments`.
- `/Users/kirillponomarev/Documents/Yalken Reference Lab`.
- `/Users/kirillponomarev/Documents/Yalken-native-check-26b`.

Отдельные ZIP, DOCX, исследования и выгрузки из Desktop/Downloads перечислены в PATH_AUDIT.json с фактическим типом, существованием и конечным путём ссылки. Поиск именных объектов не доказывает отсутствие других файлов Ялкена с нейтральными именами внутри общих папок.

### Путь приложения зависит от профиля

Проверены `src/utils/fileManager.js` (getDocumentsPath/migrateDocumentsFolder) и `src/main.js` (getSettingsPath/migrateUserData, индекс project-library-index.v1.json, автономный path root). Обычный macOS-профиль использует Documents/craftsman и Application Support/craftsman; legacy WriterEditor остаётся веткой восстановления. Для открытого проекта путь определяет выбранный project root. `YALKEN_AUTONOMOUS_APP_PATH_ROOT` переназначает Documents/appData/userData в допущенном временном профиле; последующая настройка userData проходит через migrateUserData. Поэтому стандартный путь нельзя выдавать за адрес каждого native-теста. Эта проверка не запускает приложение.

## Яндекс.Диск — отдельный сохранённый источник

В локальном каталоге `/Users/kirillponomarev/Yandex.Disk.localized/Yalken — тестовые материалы` обнаружены:

- `2026-10-09 — роман 500k — 5ca5d936`
- `2026-10-10 — роман — 4ae2ac5b`
- `2026-10-10 — роман — 565c43f8`
- `ПОРЯДОК ХРАНЕНИЯ.txt`

Проверялись только имена и наличие папок. Не выполнялись удаление, перенос, загрузка содержимого или полная сверка удалённого Яндекса. Папка «Учёт Яндекс Диска» на T777 содержит старую опись, а не копию этих данных.

## Старые пути и документы

- Прежний iCloud: `/Users/kirillponomarev/Library/Mobile Documents/com~apple~CloudDocs/Работа/Yalken` — локально отсутствует после проверенного переноса. Не создавать заново и не использовать как новое основное хранилище.
- `/Volumes/Work` — отключённое legacy-место. Не использовать как fallback, не делать aliases/symlinks и не чинить .git на этот путь.
- Старые TASK.txt, STATE.json, ПОРЯДОК ХРАНЕНИЯ.txt, КАК ВОССТАНОВИТЬ.txt и отчёты внутри архивных наборов сохраняют исходные байты. Их указание складывать новое в iCloud отменено владельцем; техническая инструкция restore.py остаётся полезна с новым расположением архивов.
- Внутренние source paths архивов описывают происхождение. Они не обещают, что исходный файл ещё существует: ранее удалены 445 проверенных Mac-копий, а 226 старых сборок с Mac сохранены отдельно на T7-Secure. Новая карта не расширяет прежние разрешения на удаление.
- Исторические docs/OPS evidence и frozen-снимки в Git не переписываются под новые пути. В основном README, CONTEXT и HANDOFF дана эта текущая карта.

## Диски и дальнейшее хранение

| Том | UUID | Проверенное состояние |
|---|---|
| T7-Secure | `D1F2E2C1-3210-4A39-A4E0-0AA0AD5110E2` | APFS, encrypted, unlocked, writable |
| T7 | `66E01FE4-7792-4F1E-BC82-A542678B53C5` | APFS, writable; тот же физический APFS-контейнер, что T7-Secure |
| T777 | `F2FA9AE0-0081-3FC3-BF56-CC4280D16513` | exFAT, writable; отдельный диск |

**Правило для следующих задач на этом Mac:**

1. До создания новых материалов проверить mount, UUID T777 и доступность записи. Не выбирать Mac, T7, T7-Secure, iCloud или Яндекс как запасное постоянное хранилище при отсутствии T777; остановить запись новых результатов и сообщить владельцу.
2. Все новые данные и материалы работы по Ялкену сохранять в датированной папке задачи внутри `/Volumes/T777/Yalken/Новые материалы`. Новые отчёты, описи, логи и результаты проверок — в датированной папке внутри `/Volumes/T777/Yalken/Отчёты о работе`. Для крупных результатов записывать состав, исходные пути, размер и SHA-256; для отчётов указывать task id, дату, exact Git SHA и реально выполненные проверки.
3. Эта политика задаёт место материалов разработки, а не меняет продуктовые пути хранения. Код и обязательные version-controlled task/docs остаются в каноническом Git на T7-Secure; полный внешний отчёт и тяжёлые evidence — на T777, в Git достаточно точного указателя. Старые raw-истории, БД, authority, проекты приложения и сохранённые профили не перемещать.
4. Если конкретный тест или приложение требует APFS, executable permissions, symlinks либо закреплённый временный путь, не заменять его вслепую на exFAT. Требуемое временное размещение объявить в задаче до запуска; конечные данные и отчёт всё равно сохранять на T777 с проверкой. Никакой автоматической очистки исходников из этого правила не следует.
5. Прежние указания о новых материалах на iCloud, Яндексе или в локальных migration-control каталогах являются историческими. Существующие записи сохранить по старым путям; новые отчёты вести на T777. Другие проекты и личные материалы исключены.

Действующий Git на exFAT не переносится. Эти правила не устанавливают фоновый copier, watcher или таймер.

Перед обращением к внешнему диску проверять mount и UUID. Если диск отсутствует, остановиться, а не создавать имитацию папки в /Volumes. Никакого автоматического таймера или фоновой миграции нет. Наличие одной копии на T777 не означает автоматически вторую резервную копию.

## Граница проверки документации

Первый аудит на 5d0c5865 охватил 489 отслеживаемых Markdown/TXT файлов; совпадения найдены в 6 документах. Повторный поиск на согласованном source SHA 3408f361 охватил все 507 отслеживаемых Markdown/TXT файлов; совпадения найдены в 13 документах. Старые указания задач о Яндексе сохраняются как историческая привязка прежних результатов; текущее правило T777 закреплено в AGENTS и наверху CONTEXT/HANDOFF. Содержательно проверены основные entrypoints, прежний README T777, инструкция восстановления, навигация мастер-архива T7 и итоговые migration/cleanup receipts. PATH_AUDIT.json хранит точные совпадения и 479 наблюдений путей. Исторические product-claims не переаттестованы этой задачей. Смешанные каталоги и удалённые облака не объявляются полностью обследованными.

Повторный FULL_READBACK.json на T777 подтверждает полное чтение 193 из 193 файлов: 15 677 655 301 байт, SHA-256, размер и identity совпадают с FINAL_VERIFICATION.json, составленным до удаления iCloud-источника. Пять копий migration receipts совпадают побайтно; применённые native-метаданные проверены заново. Повторно проверены все 479 прежних наблюдений путей: изменения наличия и целей ссылок не обнаружены; 21 старая сломанная ссылка остаётся явно перечисленной. Эта проверка не делает новую распаковку всех архивов и не аттестует всё содержимое T7, Mac или Яндекса.
