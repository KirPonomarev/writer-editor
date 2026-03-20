# BINDING_INDEX_v0

STATUS: NORMALIZED_SIMPLIFIED
GENERATED_AT_UTC: 2026-03-20T01:00:00.000Z
DETECTOR: WS04_BRIDGE_DRIFT_SINGLE_DETECTOR_V1
SOURCE: XPLAT_UNIFIED_MASTER_EXECUTION_CONTRACT_v3.13a-final.md

| MAP_ID | MAP_SECTION | LAW_SECTIONS | GATE_TOKEN | FAILSIGNAL | MODE | BINDING |
|---|---|---|---|---|---|---|
| 0 | Режим документа/полнота | A0, A17, A4, B0 | Execution profile validity | E_EXECUTION_PROFILE_INVALID, E_SCOPEFLAG_UNKNOWN, E_REQUIRED_TOKEN_SET_DRIFT | BLK/BLK/BLK | BOUND |
| 1 | Продукт (offline-first) | A0, A11, A14, A2 | CORE_SOT_EXECUTABLE_OK, E2E_CRITICAL_USER_PATH_OK, local-only transport до X4 | E_COLLAB_TRANSPORT_FORBIDDEN_IN_MVP | ADV/BLK/BLK | SEMI |
| 10 | Plugins policy | A10, A11, A8 | No early executable/runtime wiring | E_RUNTIME_WIRING_BEFORE_STAGE, E_STAGE_PROMOTION_INVALID | ADV/BLK/BLK | BOUND |
| 11 | Поиск/индексация/навигация | A12, A6.1 | E2E_CRITICAL_USER_PATH_OK | token-fail by gate | ADV/BLK/BLK | SEMI |
| 12 | Экспорт/импорт | A12, A6.1, A9 | Hard parity for export/import semantics | token-fail by gate | ADV/BLK/BLK | BOUND |
| 12B | Minimal Book Plugin Track | A12, A2, A6.1, A9 | BookProfile, StyleMap, TOC, FrontBackMatter, PreflightLite | PROPOSED: E_BOOK_PREFLIGHT_FAIL | ADV/ADV/ADV | GAP |
| 13 | Review/история | A11, A14 | Local-first comments/history до X4 | E_COLLAB_TRANSPORT_FORBIDDEN_IN_MVP | ADV/BLK/BLK | BOUND |
| 14 | Безопасность/приватность | A15, A16, A6.2, A7 | Integrity + proofhook + config lock + no bypass | E_DIRECT_PROTECTED_BRANCH_PUSH, E_MERGE_BYPASS_ATTEMPT, integrity class failSignals | BLK/BLK/BLK | BOUND |
| 15 | AI roadmap | A0, A11, A14, A8 | Late-stage cloud, no early runtime cloud wiring | E_RUNTIME_WIRING_BEFORE_STAGE | ADV/BLK/BLK | SEMI |
| 16 | Платформы/сторы | A11, A12, A9 | Stage metrics + hard parity + platform DoD | E_STAGE_METRICS_MISSING, E_STAGE_PROMOTION_INVALID | ADV/ADV/BLK | BOUND |
| 17 | Этапы внедрения | A1, A10, A11 | Locked order + stage activation + evidence | E_SEQUENCE_ORDER_DRIFT, E_STAGE_PROMOTION_INVALID, E_STAGE_METRICS_MISSING | ADV/BLK/BLK | BOUND |
| 18 | Quality system | A17, A5, A6, A7, B4 | 80/20 blocking + anti-false-green + freshness | E_WAVE_RESULT_STALE, E_BLOCKING_TOKEN_UNBOUND | ADV/BLK/BLK | BOUND |
| 19 | Anti-bloat | A5, A6 | Process-lean + minimal blocking discipline | E_WAVE_RESULT_STALE (косвенно) | ADV/ADV/ADV | SEMI |
| 2 | Канон-связка v3.12 | A0, A10, A11, A14, A2 | Stage activation + scope discipline | E_STAGE_PROMOTION_INVALID, E_COLLAB_TRANSPORT_FORBIDDEN_IN_MVP | ADV/BLK/BLK | BOUND |
| 20 | Pain-to-Strength | A0 | Product intent layer | n/a | ADV/ADV/ADV | GAP |
| 21 | Совпадения/риски | A11, A14, A2, A8 | Risk mapping to canon constraints | n/a | ADV/ADV/ADV | SEMI |
| 22 | North Star | A0 | Vision-only | n/a | ADV/ADV/ADV | GAP |
| 23 | Финальная формула | A11, A14, A2, A8 | Composite architecture rule | n/a | ADV/ADV/ADV | SEMI |
| 24 | Normative Tags | A7, B4 | Blocking token law completeness | E_BLOCKING_TOKEN_UNBOUND | ADV/BLK/BLK | BOUND |
| 25 | Invariant Map | A6.1, A7, B4 | Invariant -> machine-check linkage | E_BLOCKING_TOKEN_UNBOUND | ADV/BLK/BLK | BOUND |
| 26 | Mode Matrix | A16, A17 | Canonical mode enforcement | fail by mapped class | AS_DEFINED_IN_A16 | BOUND |
| 27 | Command Surface | A2, A7, A8 | COMMAND_SURFACE_BUS_ONLY_OK + COMMAND_SURFACE_SINGLE_ENTRY_OK + COMMAND_SURFACE_BYPASS_NEGATIVE_TESTS_OK | E_COMMAND_SURFACE_BYPASS | ADV/BLK/BLK | BOUND |
| 28 | Gate Packs | A16, A6, B0, B4 | FAST/RELEASE/AUDIT packs (mapped to canon) | inherited from pack gates | PACK_DEPENDENT | SEMI |
| 29 | False Green Register | A5, A7, B4 | Negative tests + proof binding required | E_BLOCKING_TOKEN_UNBOUND, E_WAVE_RESULT_STALE | ADV/BLK/BLK | BOUND |
| 3 | Архитектурная иерархия | A1, A2, A8 | Locked order + runtime wiring guard | E_RUNTIME_WIRING_BEFORE_STAGE, E_CORE_CHANGE_DOD_MISSING | ADV/BLK/BLK | BOUND |
| 30 | Cross-Platform Matrix | A11, A12, A9 | Parity baseline + platform DoD + stage metrics | E_STAGE_METRICS_MISSING, E_STAGE_PROMOTION_INVALID | ADV/ADV/BLK | BOUND |
| 31 | Migration Safety | A3, A6.1, A9 | MIGRATIONS_POLICY_OK, MIGRATIONS_ATOMICITY_OK, RECOVERY_IO_OK | E_CORE_CHANGE_DOD_MISSING | ADV/BLK/BLK | BOUND |
| 32 | Race-safe Governance | A10, A5, B5, B6 | WAVE hash/TTL + required-set safety + stage consistency | E_WAVE_RESULT_STALE, E_REQUIRED_TOKEN_SET_DRIFT, E_STAGE_PROMOTION_INVALID | ADV/BLK/BLK | BOUND |
| 33 | FailSignal Glossary | A16, B1 | FailSignal registry integrity | FAILSIGNAL_REGISTRY_VALID_OK token-fail | ADV/BLK/BLK | BOUND |
| 34 | Process-Tax Budget | A5, A6 | Single-run wave + 80/20 release blocking | E_WAVE_RESULT_STALE (косвенно) | ADV/BLK/BLK | SEMI |
| 35 | Red-Team Closure | A17, A7, B4 | Closure only via machine-bound proofs | E_BLOCKING_TOKEN_UNBOUND | ADV/BLK/BLK | BOUND |
| 36 | Совместимость с концепцией | A11, A14, A2 | Core fixed + shell flexible + staged collab | E_RUNTIME_WIRING_BEFORE_STAGE, E_COLLAB_TRANSPORT_FORBIDDEN_IN_MVP | ADV/BLK/BLK | SEMI |
| 38 | Phase 04 design layer baseline | A17, B0, B4 | PHASE04_DESIGN_LAYER_BASELINE_OK | E_PHASE04_DESIGN_LAYER_BASELINE_DRIFT | ADV/BLK/BLK | BOUND |
| 37 | Drift Control (Bridge Ops) | A17, B0, B4 | PROPOSED: BINDING_INDEX_SYNC_OK | PROPOSED: E_BINDING_INDEX_DRIFT | ADV/ADV/ADV | GAP |
| 4 | Модель системы (модули) | A12, A13, A14, A2, A3, A6.1, A7 | Core safety set (RECOVERY_IO_OK, MIGRATIONS_*, NORMALIZATION_XPLAT_OK) | E_CORE_CHANGE_DOD_MISSING, E_BLOCKING_TOKEN_UNBOUND | ADV/BLK/BLK | BOUND |
| 5 | Модель данных | A13, A14, A2, A3, A6.1, A9 | Migration/recovery/roundtrip invariants | E_CORE_CHANGE_DOD_MISSING | ADV/BLK/BLK | BOUND |
| 6 | Полный интерфейс | A2, A3, A9 | No core-leak from UI | E_CORE_CHANGE_DOD_MISSING | ADV/BLK/BLK | SEMI |
| 7 | Полная строка меню | A2, A3, A8, A9 | UI free-zone + no forbidden runtime wiring | E_RUNTIME_WIRING_BEFORE_STAGE, E_CORE_CHANGE_DOD_MISSING | ADV/BLK/BLK | SEMI |
| 8 | Режимы и профили | A10, A11, A2, A9 | Stage/scope activation for advanced profiles | E_STAGE_PROMOTION_INVALID, E_STAGE_METRICS_MISSING | ADV/ADV/BLK | SEMI |
| 9 | Menu Composer/кастомизация | A10, A2, A8 | Overlay customization without runtime-stage violation | E_RUNTIME_WIRING_BEFORE_STAGE, E_STAGE_PROMOTION_INVALID | ADV/BLK/BLK | SEMI |

DRIFT_RULE: GAP_ROWS_MUST_BE_ADVISORY_ONLY
DRIFT_RULE: BOUND_ROWS_MUST_HAVE_GATE_FAILSIGNAL_MODE_LINK
DRIFT_RULE: SINGLE_DETECTOR_REPORT_DETERMINISTIC
