# Atlas Continuity Ledger — refresh after durable Save

TASK_ID: YALKEN_ATLAS_CONTINUITY_SAVE_FRESHNESS_MAC_20261109
TYPE: UI
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
BINDING_BASE_SHA: de084f8b014e5d5f5a4240a547f31a4c916dc709
HEAD_SHA_AT_START: de084f8b014e5d5f5a4240a547f31a4c916dc709
TARGET_BRANCH: main
PUSH_BRANCH: codex/atlas-continuity-save-freshness-20261109
STATUS: ADMITTED_CAUSAL_READY
DOCUMENT_CLASS: PROCESS
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_HEAD_REQUIRED=true
OWNER_AUTHORITY: Direct standing V6 and DNA5 first Mac development, sole executor and one bounded delivery chain.

## MICRO_GOAL

While the existing Continuity Ledger is already open, save one changed scene. Its current Atlas source and opted-in Writing history update without a manual reload. The editor remains focused, existing WSE selection and author draft values stay intact, and a cold reopen reads the same saved text and one Pulse observation.

## ARTIFACT

Connect only the accepted changed current SAVED acknowledgement to the existing explicit-open Ledger query. Exact unchanged-source probe c12149badbe69a088ff4c4307f15553b83763b5acbe79d73c3460feb4787f5cb runs the actual callback, tree route and Ledger query: the tree advances and the Ledger stays on the previous source until an explicit refresh. Actual native causal 542b12c91f9bef6108a7963e798de872a6c68996eb6d8105be5f7da6a4ec061a independently proves saved source and exactly one real Pulse row, while the open Ledger stays stale; ordinary refresh reveals the same row without further write. The closed own61 profile and original errors are retained. Prior PR2215 is closed on exact main de084f8b014e5d5f5a4240a547f31a4c916dc709, final report f8b8ead5909caca7b95c4359e226d3d4b737bbe8797dc02c7e5f8868f497a00f.

## ALLOWLIST

- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/RCV01A_NORMATIVE_CLAIM_TEST_LANE_MANIFEST_V1.json
- docs/OPS/R24/EVIDENCE/ES-R24-RCV01A-NORMATIVE-CLAIM-TEST-LANE-MANIFEST-CLAIM-BINDINGS.json
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- docs/tasks/2026-11-09--atlas-continuity-save-freshness.md
- docs/tasks/2026-11-09--atlas-temporal-story-day.md
- scripts/ops/r24/corrective/interop-current-certification-deltas.mjs
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/sector-m-scope-map.json
- src/renderer/editor.bundle.js
- src/renderer/editor.js
- test/unit/navigator-derived-counters-renderer.test.js

## DENYLIST

All paths outside the exact allowlist. No Main, preload, Core, Pulse/WSE calculation, scheduler, storage, schema, app paths, command meaning, entitlement, dependency, workflow, HTML, CSS, layout, release scope or qualification change. Preserve owner data, original active and historical profiles, app artifacts, fixtures, earlier approval rows and every prior failure.

## CONTRACT / SHAPES

DESIGN_TOOL_ROUTER: INAPPLICABLE_MECHANICAL_FRESHNESS; canonical declaration enum verified in the pinned preflight. No change to the design contract.

Existing mechanical freshness seam: existing Command Kernel/Main canonical Save and persisted Pulse observation precede the typed current SAVED acknowledgement. Existing onSetDirty retains the accepted generation/dirty test and navigator and current-scene paths. The already active continuity route may call its existing explicit-open read only; no query for hidden or closed Ledger, no force-open, no typing path, no new bridge, worker, cache or authority. Existing publication guards preserve project, scene, active view, editor generation, query order and Main source/history/Pulse identities. The Ledger's WSE, Pulse and Atlas values remain projections of actual stored state. Existing visual structure and AX/keyboard behavior are unchanged. Relevant internal orientation: native-fluency-typographic-sharpness.md; use actual current Ledger controls and active editor as native baseline.

Preserve saved manuscript and authoring working state. For one accepted new generation at most one Ledger read. Ignore stale, future, protected, repeated and no-op receipts. Existing fallback for unavailable results applies; later valid generations and changed project, scene or view must prevent old publication. No new feature or surface manifest: this is a fix to an existing read path.

## IMPLEMENTATION_STEPS

1. Use the verified base and admitted exact paths. Apply this HARD task and run E0 before semantic edits. Record only the previous closure and present facts in CONTEXT and HANDOFF, retaining original bytes.
2. Append prospective behavior tests to the existing maintained navigator file using actual onSetDirty and actual Ledger publication guards. Preserve existing case bodies. Capture original runtime RED before source correction.
3. Add the single guarded existing query route and regenerate the existing bundle normally. Same frozen tests pass GREEN, original gates and current source bindings refreshed without loosening any requirements.
4. Verify actual rebuilt candidate macOS Save without manual reload, source and Pulse row, original neighboring scene and editor focus, ordinary Quit and cold reopen in own profile. Execute all required gates, normal delivery and separately rebuilt exact merged verification.

## CHECKS

CHECK_01_PRE_WRITE: verified registered clean de084f8b014e5d5f5a4240a547f31a4c916dc709, exact tree 6f86d39f479fb3001395a1b5632eea439d43c7d2, current remote main, mounted writable T777 and encrypted unlocked writable T7-Secure, no competing task writer or index lock; declaration e0456d5509cd8692bb716d1cda3f7fbf4437d498ee9f8bdd0ed34183420644f8, preflight 3bf595ecd6292407aa90e1185df09d0694714b535af90aeb505339f8ed7203f7, native causal and finite exact current evidence.
CHECK_02_POST_TASK: local task E0 before semantic edit.
CHECK_03_POST_SOURCE: same prospective RED and GREEN, current query plus stale/duplicate/hidden/closed and out-of-order guards, existing navigator and surface checks, exact diff and generated renderer bundle.
CHECK_04_POST_NATIVE: actual rebuilt macOS candidate and exact merged artifact, ordinary editor and Save with already open Ledger, exact source and one Pulse observation, unchanged neighbor, native focus, clean Quit and cold reopen, independent physical oracle and protected older profiles.
CHECK_05_POST_DELIVERY: mandatory affected/baseline/RTK/E0/Electron/OSS/audit and actual exact hosted candidate/main CI; normal commit, push, PR and merge, clean merged scope, final guardrails. T777 evidence and only admitted finite internal APFS runtime.

## STOP_CONDITION

Stop dependent writes for inconsistent source scope, capability or identity drift, unverified native identity, dirty foreign state, stale or missing proof, failed mandatory gate or changed merge base. Preserve the original evidence and continue independent permitted work.

## REPORT_FORMAT

Use AGENT_FINAL_REPORT_V1; exact commits, scope, original and current observed denominators, delivery outcomes, open limitations and one next step.

## FAIL_PROTOCOL

Retain actual raw output and exit; distinguish cheaply before fixing. No weakened predicates, silent rebase, stale acceptance, hidden failures or repeat of expensive work without changed inputs.
