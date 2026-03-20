# Yalken Writer — Repo Canon

STATUS: ACTIVE_REPO_CHANGE_CONTROL_CANON
ROLE: ENTRYPOINT_AND_INTERPRETATION_LAYER

## 0. Назначение

Этот документ фиксирует:
- как в репозитории определяется источник истины,
- какие правила считаются обязательными на уровне change control,
- как читать product-track и factual docs без split-brain.

Machine-bound blocking law определяется не этим документом сам по себе, а через active execution canon.

## 1. Источник истины

Порядок чтения:
1. `CANON_STATUS.json` и active canonical execution document.
2. Этот `CANON.md` как верхний repo entrypoint и change-control canon.
3. `docs/corex/COREX.v1.md` как философия и target architecture.
4. `docs/BIBLE.md` как product map и target model.
5. `docs/CONTEXT.md` и `docs/HANDOFF.md` как factual operational docs.

Правила:
- blocking решения принимаются только от active canon;
- product map не может сам по себе создавать blocking law;
- factual docs не могут переопределять active canon;
- split-brain между несколькими активными truth surfaces запрещён.

## 2. Active Canon Resolution

1. Active execution canon определяется только через `docs/OPS/STATUS/CANON_STATUS.json`.
2. Repo обязан иметь один must-entrypoint active canon.
3. Любое обновление active canon требует синхронной проверки bridge layer и factual docs.
4. Устаревшие milestone narratives не считаются действующим law только потому, что они когда-то были каноном.

## 3. Writer V1 Product Direction

`Yalken Writer v1` — это calm local-first writer tool со следующими обязательными ориентирами:
- strict data core,
- reliable primary editor path,
- zero-bypass command surface,
- safe reset and restore,
- bounded spatial containers,
- mutable design that never threatens text truth.

Не считаются `v1 release criteria`:
- platform-first expansion,
- executable plugin ecosystem,
- cloud truth,
- transport rollout,
- broad shell freedom,
- ecosystem breadth без прямой пользы для writing safety и recovery.

## 4. Hard Gates And Sequencing

1. `PRIMARY_EDITOR_PATH` — жёсткий stop gate для major shell и spatial work.
2. До closure разрешены только:
   - editor closure work,
   - data safety work,
   - command surface work,
   - safe derived work, не меняющий editor truth.
3. Closure должен быть подтверждён одним machine-carried packet с checklist, sign-off, evidence set и canon reference.
4. После editor closure выполняется один factual doc cutover pass.
5. После factual doc cutover в активных документах должна остаться одна active product truth.
6. Phase 04 reclassified here as design-layer baseline: old spatial-prep packet is historical only, and the visible design switch must not change document truth, recovery truth, or command semantics.

## 5. MVP Invariants

Обязательные инварианты `Writer v1`:
- desktop-first,
- offline-first,
- локальная истина без cloud или network truth,
- сцены как отдельные сущности,
- editor surface не источник истины,
- atomic write и recovery обязательны,
- DOCX first export,
- никаких paywall-зависимостей,
- никаких executable plugins в `v1`.

## 6. Process Invariants

1. Один bounded contour — один осмысленный vertical slice.
2. Write-contour не считается закрытым без commit-исхода или явно допустимого deferred-исхода для read-only OPS.
3. False-green, stale-green и scope drift запрещены.
4. Factual docs обновляются одним pass после closure, а не фрагментами “когда получится”.
5. Merge идёт только через approved PR path и действующую automation policy.

## 7. Repo Interpretation Rules

1. `docs/BIBLE.md` описывает product map и north star.
2. `docs/CONTEXT.md` описывает фактическое текущее состояние.
3. `docs/HANDOFF.md` нужен для быстрого входа следующего агента.
4. `docs/PROCESS.md` задаёт рабочий протокол исполнения.
5. Если factual docs и map docs расходятся, repo обязан выполнить cutover или reconciliation, а не жить в двух истинах.

## 8. Current Cutover Reality

Текущая активная реальность репозитория:
- primary editor closure закрыт,
- active execution canon уже содержит writer-specific narrowing и factual doc cutover rules,
- factual docs после closure обязаны описывать post-closure operating reality, а не старый transition world.

Следующий delivery axis после closure и factual cutover:
- Phase 02: data core, recovery и command kernel stabilization,
- затем shell state,
- затем bounded spatial layer,
- затем minimal pack layer только при реальной необходимости.
