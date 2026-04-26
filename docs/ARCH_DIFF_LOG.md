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
