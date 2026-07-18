# ARCH_DIFF_LOG (исключения из канона)

Любое исключение из `CANON.md` (и/или `docs/BIBLE.md`):
- фиксируется здесь,
- имеет причину,
- имеет rollback,
- временное (и содержит план удаления/возврата к канону).

Исключение без записи = ошибка.

---

## Шаблон записи

```md
## YYYY-MM-DD — <короткое название исключения>

- Контекст: (какая задача/почему возникло)
- Что нарушаем: (какой пункт канона/политики)
- Причина: (почему нельзя сделать “как в каноне” сейчас)
- Риск: (что может сломаться / чем это опасно)
- Rollback: (как быстро откатить)
- План удаления исключения: (когда/в каком milestone вернёмся к канону)
```

## 2026-04-10 — Menu About Licenses Adapter Exception

- Контекст: contour MENU_SINGLE_SOURCE_OF_TRUTH_001 убирает structural split-brain меню и оставляет пункт about licenses в main process adapter layer.
- Что нарушаем: полный принцип одного authoring source для всех menu entries.
- Причина: пункт about licenses завязан на main process dialog и пока остаётся явным adapter-only augmentation поверх help menu.
- Риск: если исключение начнёт расширяться, main.js снова станет вторым structural source.
- Rollback: перенести help-about-licenses в canonical menu authoring source и убрать ensureAboutLicensesMenuEntry из main.js.
- План удаления исключения: закрыть вместе с следующим контуром menu i18n или menu modes, когда help surface будет полностью переведена в canonical authoring chain.

## 2026-04-14 — Toolbar Wave C Literal Baseline Deviation

- Контекст: после `TOOLBAR_EXPANSION_WAVE_C1_001` repo truth закрыла оставшиеся пункты `toolbar.insert.image` и `toolbar.proofing.spellcheck` как explicit blocked decisions, а не как live Wave C delivery.
- Что нарушаем: старую literal формулировку baseline, где полный Wave C предполагал live promotion для image и spellcheck.
- Причина: для image и spellcheck отсутствует безопасно выбранный offline-first execution path; форсированная live-promotion создала бы ложный green и недостоверную capability truth.
- Риск: если deviation не зафиксировать явно, docs и acceptance могут расходиться с catalog truth и снова создать split-brain.
- Rollback: либо реализовать полноценные offline-first image и spellcheck paths и перевести элементы в live, либо сохранить blocked и поддерживать factual rebaseline в docs и tests.
- План удаления исключения: снять исключение, когда для image и spellcheck будет принято owner-approved runtime решение и закрыт соответствующий write contour без false-green.

## 2026-04-26 — Toolbar Scale Markup Parity Index Structure Exception

- Контекст: contour `TOOLBAR_SCALE_MARKUP_PARITY_CLOSEOUT_001` удаляет устаревшие scale-handle узлы и scale-class tails из `index.html` после runtime descale.
- Что нарушаем: правило не менять структуру `src/renderer/index.html` без отдельного ТЗ.
- Причина: без очистки markup остаются stale scale tails и временный runtime purge path, что создает архитектурный шум и false-green risk.
- Риск: случайное удаление нужных узлов могло бы повлиять на drag affordance или поведение toolbar shell.
- Rollback: вернуть commit `22ce7a40b0e975fb67a4d3c74ecb0e2c7bc67393` через `git revert` если проявится регрессия move/width/rotate.
- План удаления исключения: исключение считается закрытым сразу после merge этого контура, потому что оно одноразовое и не вводит новый постоянный bypass.

## 2026-07-17 — Evidence-bound core purity gate exceptions

- Контекст: локальный E0 gate на current main останавливается на `src/core/io/path-boundary.js` и трёх scene admission модулях, хотя path-boundary guard уже закрыт и доказан артефактом `X71_PATH_BOUNDARY_EXCEPTION_STATE_V1.json`, а admission-модули используют только детерминированный `createHash`.
- Что нарушаем: буквальный запрет любых effect tokens внутри `src/core`.
- Причина: текущий guard обязан проверять реальные пути и symlink boundaries через `node:path`, `node:fs` и `process.cwd`; scene admission hashes требуют точного `node:crypto` импорта. Перенос этих boundaries выходит за scope repository-tail hygiene.
- Риск: слишком широкое исключение могло бы скрыть новый effectful core код.
- Rollback: удалить evidence-bound ветку из `scripts/ops-gate.mjs` и соответствующий contract test; E0 снова будет блокировать current path-boundary implementation.
- План удаления исключения: вынести filesystem и current-working-directory probes в IO adapter, а deterministic hash port — в чистый contract adapter отдельным owner-approved architecture contour, затем удалить исключения.

## 2026-07-18 — Main Toolbar Uniform Scale Restoration

- Контекст: owner отдельно подтвердил продуктовый контракт, в котором основная форматирующая панель независимо перемещается, меняет ширину и равномерно масштабируется в горизонтальной и вертикальной ориентациях.
- Что нарушаем: ранее принятый runtime descale main-toolbar shell и одноразовое удаление scale-handle markup из `index.html`.
- Причина: descale устранил прежний `transform: scale` из-за риска размытия, но вместе с реализацией потерялся нужный пользовательский сценарий. Новый контур возвращает сценарий через отдельный layout-zoom канал с диапазоном 0.5x–2.0x, не смешивая его с width-scale и не затрагивая редакторский лист.
- Риск: Chromium layout zoom может изменить геометрию popup anchors, hit targets и позиционное ограничение панели на крайних значениях.
- Rollback: откатить commit контура; сохранённый ключ scale останется совместимым и будет безопасно проигнорирован старым runtime.
- План удаления исключения: после визуального и interaction gate закрепить независимый scale как текущий Design OS contract и перевести запись из временного исключения в каноническое описание панели; при провале sharpness gate вернуть descale.
