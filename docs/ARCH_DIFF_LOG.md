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
