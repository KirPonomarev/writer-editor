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

## 2026-07-18 — Main Toolbar Layout Zoom Exception Resolution

- Контекст: owner visual review подтвердил потерю резкости и смешение content, popup и transform-handle layers при масштабировании всей shell через Chromium layout zoom.
- Что нарушаем: новых исключений не вводится; этот контур закрывает временный layout-zoom implementation path из предыдущей записи, сохраняя owner-approved scale contract.
- Причина: основная панель уже имеет scoped chrome tokens, поэтому равномерный размер можно проецировать как DPR-snapped реальные метрики без растягивания готовой shell.
- Риск: неполная карта метрик могла бы оставить отдельный control несогласованного размера; popup anchors и сохранённые item offsets требуют отдельной проверки после удаления zoom coordinates.
- Rollback: откатить metric-scale contour к предыдущему layout-zoom runtime, не меняя сохранённые scale и widthScale state keys.
- План удаления исключения: предыдущий layout-zoom риск считается закрытым после renderer, interaction, persistence и visual sharpness gates; постоянный контракт — metric scale для body layer и native scale для popup и transform layers.

## 2026-07-18 — Main Toolbar Optical Projection Closeout

- Контекст: повторный owner visual gate показал, что буквальная проекция состояния 0.5x–2.0x через реальные метрики технически резкая, но на верхнем диапазоне даёт чрезмерно крупные поля, радиусы и интервалы и поэтому воспринимается мягкой и композиционно тяжёлой.
- Что нарушаем: новых исключений не вводится; уточняется постоянная семантика scale state после закрытия layout-zoom exception.
- Причина: полная горизонтальная панель имеет существенно больший footprint, чем вертикальная, поэтому один буквальный геометрический multiplier не может сохранять native-fluency плотность в обеих ориентациях.
- Риск: значение сохранённого scale больше не является буквальным CSS multiplier; регрессия возможна, если будущий код обойдёт orientation-aware projection или начнёт масштабировать popup и transform layers.
- Rollback: откатить optical-projection contour; сохранённые scale и widthScale state keys останутся совместимыми.
- План удаления исключения: запись фиксирует закрытие visual sharpness gate как постоянный контракт — state range остаётся 0.5x–2.0x, body metrics проецируются в 0.8x–1.15x горизонтально и 0.75x–1.35x вертикально, optical rhythm растёт по square-root projection, popup и transform layers остаются native-scale.

## 2026-09-09 — R24-RCV-00B Post-audit Preflight Order Deviation

- Контекст: в R24-RCV-00B initial declaration и preflight прошли до первого edit для effective-state compiler scope. После push PR CI показал фактический failure в post-audit verifier admission, поэтому контур был расширен до verifier-support files и исправлен в том же delivery chain. Расширенная declaration была записана для evidence, но clean preflight для расширенного scope уже нельзя было выполнить на dirty worktree.
- Что нарушаем: правило `TASK_ARCHITECTURE_DECLARATION_V1` и `agent:preflight` до первого edit для всего фактического write scope.
- Причина: failure обнаружился только после remote CI на уже изменённой ветке; остановка без repair оставляла бы merged-head admission red, а задним числом заявлять pre-edit preflight для расширения нельзя.
- Риск: если этот порядок считать нормой, future contours могут расширять scope после mutation и создавать false authority для admission, verifier или carrier edits.
- Rollback: откатить только эту запись, если owner отдельно решит не фиксировать процесс-дефект; R24-RCV-00B commits, PR merge, admission logic и evidence carriers не изменяются этой записью.
- План удаления исключения: исключение не переносится в future contours; после merge этой записи оно закрывает только исторический процесс-дефект R24-RCV-00B. Любое дальнейшее scope expansion требует fresh declaration и preflight на clean worktree перед первым edit расширенного scope.

## 2026-09-14 — R24 Command Palette Visible Commands Successor Preflight Deviation

- Контекст: initial declaration и clean preflight прошли до первого edit для Design OS command palette visible_commands slice. После focused/source-runtime proof mandatory exact baseline выявил единственный blocker: WP307 требовал, чтобы current editor digest следовал через latest wording-surface successor, но исторический WP806 successor должен остаться immutable. Owner разрешил продолжить без rollback и закрыть blocker через append-only current-editor successor.
- Что нарушаем: expanded write scope получил declaration update после появления self-authored dirty state, поэтому `agent:preflight` для полного фактического scope нельзя честно переисполнить как pre-edit gate.
- Причина: blocker обнаружился только после product slice и exact baseline; переписывать WP806 historical carrier запрещено, а остановка без append-only successor оставляла бы required baseline red.
- Approval source: governance change detection and CI use task-local `PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json` for this R24 lane; only the three approvals created by this delta are recorded there: current `editor.bundle.js` generated-runtime hash, the new command-palette successor JSON hash and the claim-binding evidence stamp required by docs claim lint. The unrelated stale global approval registry entries remain outside this task scope.
- Риск: future agents могут принять post-edit declaration update за обычный порядок и расширять wording/evidence scope без fresh owner authority.
- Rollback: откатить эту запись, новый command-palette successor, WP307 test update и три product slice files; WP806 historical bytes не затрагиваются.
- План удаления исключения: запись закрывает только этот bounded current-editor successor repair. Future editor wording-surface changes должны заранее включать successor bookkeeping в clean declaration/preflight либо получать отдельный fresh contour.


## 2026-09-16 — C1 large-document import reference repair

Owner-authorized task C1_IMPORT_BREADTH_REPAIR_20260916 repairs the reproduced 64-paragraph E_ENVELOPE_BREADTH failure. The data-recipe qualification now admits the explicitly enumerated runtime repair and its generated renderer bundle, guarded by exact source hashes. This extends the previous OPS-only post-evaluation path exception for this bounded repair; it grants no cell acceptance and carries no historical runtime PASS onto the new source. The raw independent reader, frozen denominator and global IPC limits remain byte-identical. Fresh native merged-head evidence is required. Rollback: revert this product PR and corresponding local Lab driver qualification; retain prior evidence.

### C1 import preview repair — CI fixture follow-up

The candidate CI run 35094206293 identified a historical bundle assertion comparing an old wording successor with the new generated bundle, and an old admission fixture loading the growing live test inventory. The bounded task now includes the two affected test files. Keep all historical successors and the admission verifier unchanged: bind the current bundle through the existing exact runtime repair qualification; seed the historical unit fixture from the recorded 0a45daf base inventory and retain a negative control for wrong inventory scope. The real current inventory remains separately mandatory. This grants no product cell PASS. Rollback remains the same PR and corresponding local Lab qualification.

## 2026-09-25 — W3 inline PNG display size

Owner-approved bounded Word remediation. Optional paired integer EMU placement fields preserve display size independently of immutable PNG identity; legacy nodes keep intrinsic sizing. Review-only resize remains explicit manual residual without an apply capability. No new dependency, network, route, denominator or oracle exception. Rollback: revert the single W3 delivery; preserve original inputs and retained proof.

## 2026-09-25 — WORD_MEDIA_TEXT_OFFSET_20260925

- Контекст: owner-approved W4, authenticated tracked text adjacent to unchanged inline PNG.
- Что нарушаем: none; no canon exception or weaker authority/oracle.
- Решение: bounded Original/Current correspondence tied to entire source paragraph and ordered image occurrences; existing main-owned Apply revalidation and recovery remain mandatory.
- Риск: ambiguous text or placement must remain blocked/manual; no new cell credit before aggregate acceptance.
- Rollback: revert W4 delivery; original files and recovery snapshots retained.

## 2026-09-25 — WORD_TABLE_PROPERTIES_20260925

Owner-approved W5 continuation from e53782a9: bounded optional canonical table and cell properties preserve absolute grid widths, fixed layout, literal shading and borders through existing import/editor/export. Independent raw table reader covers those properties and mutation counterexamples. Namespace identity is checked before table interpretation. Existing command, recovery and transport authority retained. No architecture exception, dependencies, runtime network or general UI change. One rollback: revert the W5 delivery; no source document rewrite. No accepted-cell credit from this prerequisite.

## 2026-09-25 — W6 Word composite fidelity
Owner-approved WORD_COMPOSITE_FIDELITY_20260925 on b6986aea: preserve unformatted hardBreak structure in the existing canonical document model and align diagnostics with actual rich candidates. Page/column and other unsupported losses, G/R authority separation, fenced persistence and frozen acceptance remain unchanged. No architecture exception, new dependency or runtime network. Rollback: revert bounded W6 delivery.

W6 composite follow-up: authenticated media text Apply preserves unchanged hyperlink context; existing Apply journal carries a bounded, exact snapshot-verified canonical comment anchor transition. No gate exception or new mutation entry point; ambiguous/changed anchors remain blocked.

## 2026-09-25 — W7 implicit auto-fit table review

Owner-approved WORD420_TABLE_AUTOFIT_CLOSURE_20260925 repairs a native Word return blocked by derived grid widths in an implicit legacy auto-fit table. Only the authenticated local map can establish absence of stored geometry; explicit properties, cell topology and no-write preview remain strict. No canon or oracle exception, new dependency or authority. This is a runtime repair requiring fresh physical evidence, not proof-only promotion. Rollback: revert the bounded W7 delivery; all original DOCX and failed/successful evidence retained.

## 2026-10-02 — Word SaveAs file creation timestamp versus project creation

- Scope: owner-authorized complete Mac Word plan, current WORD_SCENE_SPLIT_MERGE_MAC_20261002 delivery. Clean45path preflight on d334ad34c314cd1e3da38e11449184a8530b01e4 precedes new metadata files.
- Amended historical assumption: the2026-09-18 metadata task required the redundant core creation carrier to remain within the canonical project's creation minute. Actual Word SaveAs replaces that carrier with the new file creation minute. Both the ordinary product DOCX and a seconds-only diagnostic reproduce this. Historical results are not promoted to new acceptance.
- Decision: distinguish canonical project creation (exact signed custom property and digest) from provider file creation. Only the already authenticated Main return route may explicitly admit the latter change. The default validator remains strict. Missing or invalid dates, wrong timestamp types, duplicates, changed project properties and forged signatures still reject. Returned metadata never writes project truth.
- Observation: accepted provider changes report both timestamps, an explicit loss entry and coreMetadataPreserved:false through the read-only projection; they cannot count as full preservation of the redundant core carrier.
- Risk and rollback: accepting arbitrary unvalidated metadata or enabling this before authentication would cross authority boundaries and is prohibited. Revert this opt-in and its projection while retaining original documents and failed/successful evidence. No migration or new writer.
- Closure: this evidence-backed distinction replaces the historical carrier assumption for authenticated Word SaveAs only; it does not change frozen acceptance denominators or grant any whole-plan completion claim.

## 2026-10-05 — bounded recovery of writer-produced oversized Word authority

- Context: WORD_NOVEL_EDITORIAL_CAPACITY_MAC_20261005; native03 wrote22.8MiB-ish legacy pretty JSON while its strict reader admits16MiB, breaking the next governed export. Exact byte/read-only diagnosis retained; actual file22812767B.
- Deviation: temporary recovery admission for fully validated existing logical legacy authority up to32MiB raw. Ordinary new encoded authority remains16MiB; expanded storage representation has explicit64MiB/depth64/1million-node limits. This does not authorize external input, stale publication, missing digest, path bypass or extra rounds.
- Reason: preserve all saved round identities, snapshots, lifecycle and provenance without snapshot restoration or pruning; use existing governed Main exporter and atomic writer.
- Risk: compression/expansion and unknown format need bounded validation; old readers must refuse new encoded storage. Independent corrupted/oversized/stale/no-write and strict reopen proofs required.
- Rollback: preserve readable decoded recovery and original files; code rollback alone is insufficient for new storage. Never silently restore old scenes or discard rounds.
- Removal: legacy oversize recovery is only compatibility admission for existing writer-produced records; remove after an explicit no-loss migration/sunset task verifies their absence. This packet makes no full novel release claim.

## 2026-10-05 — One isolated novel successor during hosted-runner outage

- Контекст: WORD_NOVEL_MULTI_SCENE_MIXED_RETURN_MAC_20261005; owner repeatedly directs autonomous acceleration without quality loss. Predecessor PR2087 candidate0612a9ea13736d47e4f59c6e4964a1b71595969f has completed both Mac native routes and local mandatory gates; its delivery is still OPEN. GitHub Actions incident3q1yb5m7ltvb prevents hosted-runner acquisition.
- Что нарушаем: AGENTS11, PROCESS Hard Git Delivery Discipline and Word V4 EXECUTION_DISCIPLINE timing prohibition on beginning a successor before predecessor delivery closure. Only this one separately preflighted successor may be implemented in its own clean linked worktree from frozen0612. This record does not weaken runtime authority, compatibility, source validation, security or any acceptance gate.
- Причина: waiting for provider recovery adds no product evidence; the immediate owner-priority blocker is one atomic mixed return across saved novel scenes.
- Риск: predecessor revision or merge divergence could invalidate successor base. Predecessor source/worktree stays frozen and untouched. No successor push, PR, merge or delivery claim until predecessor required CI, merge and exact merged replay complete AND merged tracked tree is byte-identical to frozen0612. Any mismatch stops publication; no implicit rebase or transfer.
- Rollback: preserve successor branch and owned evidence; stop its publication if predecessor cannot close. Revert only scoped successor commits through the ordinary delivery path if needed; never overwrite user scenes or remove histories/recovery evidence.
- План удаления исключения: timing exception expires at predecessor terminal closure; normal serial publication is already retained. No third contour starts under this exception. All commit/push/PR/CI/merge/post-merge checks remain required. This is a task-local exception, not a rewritten general policy.


2026-10-06 — terminal closure of isolated-successor timing exception: PR2087 candidate0612a9ea13736d47e4f59c6e4964a1b71595969f passed19/19 required CI after official provider recovery, merged as06b4523f55ff77ac4306055d8e5d5395bdd204d9. Clean detached exactorigin/main verification proves full tracked tree identical to0612; merged affected818/818 zero skip/todo, C1C363/63 zero skip/todo, five OPS admission checks and agent guardrails passed. External DELIVERY09_RECEIPT binds hashes and limits. The predecessor publication dependency is now closed; timing exception expires. Successor remains on its original binding0612 without rebase/base transfer, with byte-identical merged predecessor. Its own native, local, CI, commit/push/PR/merge gates remain mandatory and not yet complete.

## 2026-10-06 — task-shape gate ordering deviation, bounded confirmation repair

- Task: WORD_NOVEL_NATIVE_PREVIEW_MAC_20261006, exact base7e8f878c203b261e7b93abda93781df84748eadb. Clean17-path architecture preflight passed before any write. Prepared three-file bytes and old owner state were preserved.
- Deviation: PROCESS Enforcement E0 requires the task-shape OPS gate before runtime implementation. The task/manifests were prepared first, but root requested E0 after the helper/Main edits had started. No pre-edit E0 receipt exists; a later PASS cannot retrospectively prove the required ordering.
- Cause and boundary: orchestration sequencing error during the owner-authorized safe confirmation continuation. It creates no Core writer, authority exception, weakened oracle, first-write claim or delivered acceptance. Scope remains the declared17 paths and one rollback; no further contour begins.
- Remedy: execute and repair the task-shape gate now before acceptance or publication, then retain all focused, broad and Git delivery gates. Report the ordering limitation separately from actual executed acceptance. Do not rerun or relabel preflight as first-write evidence.
- Rollback: revert the single repair delivery if acceptance fails; preserve pending novel projects and original prepared worktree. This sequencing deviation expires at closure of this contour and does not amend PROCESS or future task order.

## 2026-10-06 — manifest unused-field token conflict in existing task-shape gate

- Task: WORD_NOVEL_NATIVE_PREVIEW_MAC_20261006. The feature doctrine prescribes an explicit unused-field marker with a reason; E0 currently rejects its literal marker globally for every non-OPS_REPORT task, including mandatory feature/surface manifest blocks.
- Narrow representation exception: this task uses NONE plus a precise reason for no new events, migrations or irrelevant fields. No field is omitted or empty, no architecture responsibility changes, and no runtime/authority/acceptance gate is waived. The fixed confirmation remains an effect returning intent to the existing independently revalidated Apply path.
- Do not broaden E0 or add a governance subsystem during the UI repair. Both full manifests remain reviewable in the declared task document. The unused-field wording exception belongs only to this task and does not change the doctrine or future output rules.
- Rollback/removal: revert the task together with the single repair chain if needed. A separately scoped future task-shape correction can reconcile exact normative markers; do not reuse this exception as standing authority.

## 2026-10-07 — owner-authorized16MiB novel DOCX capacity profile

- Authority: direct owner instruction to increase megabyte limits and finish the
  macOS large-novel product direction; same WORD_BOOK_BODY_TYPOGRAPHY_MAC_20261007
  original42b PR2093, clean1859cb40b pre-edit56-path declaration/preflight/E0.
- Deviation: WordV4 PACKAGE_BUDGETS part10MiB becomes task-versioned16MiB for
  bounded strict DOCX review package intake. Existing Main/local DOCX input
  limits10MiB become16MiB. Shared V6 and mirrored Core defaults/declared ceiling
  change together; effective-budget digest continues to bind the actual values.
  This limit concerns each inflated part, including auxiliary XML. Generic
  content preview retains existing32MiB host part envelope; no claim of16MiB
  inflated generic enforcement. No new public profile/schema or authority flag.
- Reason: actual500108-word exported DOCX8772919B disproves old test8MiB limit;
  bounded16MiB provides declared headroom for authored formatting and corrections.
  Raising byte capacity alone does not prove full transfer, latency or memory.
- Protected:50MiB raw package/strict total, ratio200, depth64, attributes128,
  hard30s and canon512MiB memory; existing generic host and source8MiB/snapshot/
  private/round caps. Tighter requested budgets and all integrity/CAS/no-write
  gates remain. No Google execution or broader semantic capability is opened.
- Risk: larger inputs may need more memory/time. Real boundary, hostile package,
  full rich500k publication and production phase measurements are mandatory;
  an exhausted unchanged resource budget remains a typed refusal, never PASS.
- Rollback: revert only the single coherent delivery through ordinary Git path;
  preserve readable projects, original DOCX, all history and failed evidence.
  No scene rewrite, pruning, reset or old-profile crash reproduction.
- Removal: integrate the measured capacity into a later explicitly versioned
  canonical profile after full native/resource qualification, or restore10MiB
  through verified no-loss delivery. Until then this is one owner-bound task
  exception; it never waives remaining original novel or delivery requirements.

- Executed qualification18: exact16MiB/+1/tighter limits pass; complete clean
  500108-word publication is observed through real Main,86946.656ms and
  peakRSS1842774016B. This exceeds the unchanged memory target; no resource or
  native whole-feature PASS follows. The test did not retain its final package.
  Remaining actual Office empty-section RAW binding and untouched third-fixture
  identity failures remain open; no safety/semantic refusal is waived.

## 2026-10-07 — measured private large-novel import snapshot capacity

- Authority: direct owner megabyte expansion and full macOS novel implementation;
  same original42b task, PR2093, declared72 paths and clean9a81 preflight.
- Deviation: only Main-owned disposable import references change from8MiB per
  snapshot/16MiB total to16MiB per snapshot/32MiB total. Utility defaults stay;
 64-entry bound,10-minute TTL, project-generation context and invalidation stay.
- Cause: actual500k DOCX8772919B parses and full21scene text compares correctly,
  but actual Main content snapshot10901820B exceeds8MiB. Actual plan10473416B plus
  preview fit32MiB together; independent original-factory wrong-context lookup
  refuses. Exact artifact and failed85.989s/RSS1610596352B observation are retained.
- Protected: existing IPC4MiB wire limit, reference-only confirmation, per-input
  DOCX16MiB strict profile,50MiB package/total, ratio200, CRC/XML/identity/HMAC,
  source/private bounds, admission/CAS/lease and atomic no-loss writers unchanged.
  No broader public budget or mutation authority is created.
- Proof duty: actual same-package full500k Main preview/plan and complete literal
  readback, store bounds/eviction/TTL/context negatives, native storage/reopen and
  measured resources remain required. Canon512MiB and hard30s are not raised;
  synthetic observed resource excess is not performance or release acceptance.
- Rollback/removal: ordinary revert of the one coherent original42b delivery;
  retain original DOCX, readable projects/history and failed evidence. Integrate
  this owner-bound capacity only after full native qualification or restore old
  limits through verified no-loss delivery. No scene rewrite/pruning/crash replay.

### Amendment23 measured final candidate and open authoring capacity finding

Root independently byte-verifies final HOLD02 SHA256
505c681ff15bef767cdcc729d74ebc41ebe6f47f9ae3fe387bf4815bdae5b21d:
60 source/test/generated pins, all retained logs/addenda/artifacts, seven final
diffs and exact five pre-final admission docs. Runtime988of1800 and behavior
2044of2600 from original42b; compiler133 closure and generated outputs unchanged.
Executed finite suites22of22 cell-shift,57of57 ZIP/content/reference/e2e,
231of231 pending/notes/mixed/transaction/typography,23of23 finite volume.
The separately planned500k test now executes1of1 at these exact frozen bytes:
complete21-scene publication/readback plus Main content/plan and every8391
literal paragraph,500108 whitespace-delimited words;90.071s, sampled owned
aggregate RSS1891090432B, no watchdog. No native or resource acceptance follows.

Independent actual strict Main references preserve both real snapshots within
16MiB each/32MiB total and refuse wrong context/kind and actual generation
invalidation.11.582s, sampled793608192B. Actual leased Core atomic import writes
one rich scene9680486B, SHA256
d9860ae52481988026ac595726f8d1593c7d8c91343c434ef6680cf1059ba2e5;
all complete proposed/raw document bytes and literal text match. Idempotent
retry makes zero further manifest writes;15.787s, sampled789544960B.
Host Function evaluation of verbatim Main sections shares the original strict
guard and real provider realm. Original observer01 incorrectly mixed host
guard with foreign VM command-result prototype; actual refusal after one
write is retained, observer-only correction02 is explicit. No guard weakened.
These are synthetic actual Main/Core disk proofs, not native renderer/ACK.

Fresh5001 SOURCE control75.495s, sampled1133838336B preserves all literal
source/current/original/provenance nodes, complete ledger and nonempty redo;
absent profile and tight budgets still refuse. No publicApply/native claim.
Ordinary complete XML unchanged at1280 paragraphs:2667.407ms before versus
28.368ms after local equivalent predicate. This is one component measurement,
not full Word latency or portable performance acceptance.

OPEN PRODUCT FINDING: the actual atomically imported9680486-byte rich scene
is refused by Main readCommentAuthoringContext8MiB guard. Actual Core one-edit
ledger input6784185B refuses PENDING_REVISIONS_BUDGET at4MiB. Root actual
read-only observation retains unchanged scene and manifest bytes. Importing
whole text is therefore not three-role authoring completion. Other book/notes/
comments/tree8MiB guards are source findings, not executed acceptance. Next
bounded same-original42b continuation must align import and real authoring
capacity after current checkpoint gates/Git; no silent bypass or speculative
registry. Native SOURCE/ordinary PACKAGED, both origins/scopes, three roles,
five real exchanges, hard30s/512MiB targets, merge and release remain OPEN.
Same72 paths, one rollback, draft PR2093; no new independent write contour.
