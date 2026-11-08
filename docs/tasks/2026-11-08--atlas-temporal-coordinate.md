# Atlas Time — честная основа координат

TASK_ID: YALKEN_ATLAS_TEMPORAL_COORDINATE_MAC_20261108
TYPE: CORE
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
BINDING_BASE_SHA: 895e221b5fbb92e34e67ea19dc1248c1bfd4974e
HEAD_SHA_AT_START: 895e221b5fbb92e34e67ea19dc1248c1bfd4974e
TARGET_BRANCH: main
PUSH_BRANCH: codex/atlas-temporal-coordinate-20261108
STATUS: BOUNDED_DELIVERY_CLOSED_MERGED_08C4
DOCUMENT_CLASS: PROCESS
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_HEAD_REQUIRED=true
OWNER_AUTHORITY: Autonomous V6 and DNA5 macOS delivery, one executor and one delivery chain.

DELIVERY_CLOSURE: PR2213 normal merge08c4d7811a6d00e073a085f2d918eb345ba486ce; candidatef52052a951ab0ec45cd904317633f8f06d570c1e; identical treede78487dd4755b9c056d3b965e5d9f74520f7f00. Candidate and main20CI each; merged27local; build089b23a988d8bb2fcb799f59f254570691c85f9b7f37e8058ac4e094e9d31ba9/ASAR820b09b667c0bb00325b75564e0923dd952fc443d253bf444e9cc0c5d74e2349; own54FIRST18/COLD16 and two actual zero exits, independent native4bc9cd209723d3e40d60226e2016543892639c557c07a4ca0715b34196204152. Full profile108entries56files and protected54profiles26bundles preserved. Final19field report9ad6fb5db4af0c650e3903ed9af759b32f9867455167ccc10ca79a028401d9fc records exact limits and all original failures. Full Mac/all17 remain NOT_READY/UNKNOWN. No numeric-story UI or release qualification is inferred.
NEXT_CURRENT: The separate admitted2026-11-08--atlas-temporal-range-authoring task on08c4. Original implementation contract and historical stage notes below remain unchanged; their pending native/delivery instructions are historical, not a request to repeat the closed chain.

## MICRO_GOAL

Stop treating the placeholder zero in a calendar date or label as an authored ordinal day. Preserve real day zero. When story coordinates cannot share an explicit numeric scale, show the existing events in scene order and name that basis visibly and accessibly. Do not invent calendar arithmetic or inter-calendar conversions.

## ARTIFACT

One correction to the existing read-only Time projection and its existing slider label. The real Core/query discriminator on exact 895e returns distinct coordinates for ordinal days 2 and 9 and for 0 and 9, but returns zero for both distinct calendar dates and for both distinct labels. The normalized nonordinal points have a placeholder dayIndex of zero. Unknown ranges already use scene order without explaining the basis. M20 merged first/cold observations independently show overlapping markers. No manuscript or anchor mutation occurs in the probe.

## ALLOWLIST

- docs/tasks/2026-11-08--atlas-temporal-coordinate.md
- docs/tasks/2026-11-07--atlas-temporal-range-display.md
- docs/CONTEXT.md
- docs/HANDOFF.md
- src/derived/atlas/deriveAtlasTemporalLayout.mjs
- src/renderer/editor.js
- src/renderer/editor.bundle.js
- test/contracts/yalken-atlas-v5-e06-c06-atlas-temporal-layout-time-slider-surface.contract.test.js
- test/unit/atlas-temporal-author-input.test.js
- docs/OPS/GOVERNANCE_APPROVALS/GOVERNANCE_CHANGE_APPROVALS.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/RCV01A_NORMATIVE_CLAIM_TEST_LANE_MANIFEST_V1.json
- docs/OPS/R24/EVIDENCE/ES-R24-RCV01A-NORMATIVE-CLAIM-TEST-LANE-MANIFEST-CLAIM-BINDINGS.json
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/interop-current-certification-deltas.mjs
- scripts/ops/sector-m-scope-map.json

## DENYLIST

Every other path until a fresh exact declaration admits a necessary current binding correction. Protect Core, Main, preload, command contracts, persistence, all profiles, schemas, HTML, CSS, dependencies, workflows and frozen evidence. No calendar converter, guessed date distance, marker jitter, collision lanes, new control, daemon, framework or parallel writer. Equal real ordinal values may coincide. Office remains paused; Black Box follows full Mac. All seventeen Full-Mac qualification rows require their own exact candidate evidence.

## CONTRACT / SHAPES

FEATURE_INTEGRATION_MANIFEST_V1: Product Core owns authored temporal kinds, ranges, precision, calendar identity and history. The existing QUERY path reads immutable sceneTemporalAnchors and relationSegments through deriveAtlasTemporalLayout; no COMMAND, EVENT or EFFECT changes. Only typed safe ordinalDay points supply numeric days. If a common numeric story basis is unavailable, all events in that projection use their existing scene ordinal, avoiding a mixed calendar/day/scene scale. Open and approximate labels retain their authored meaning. The existing surface.atlas.temporalLayout and rightRail.context.atlas.temporalLayout slot consume layoutPacket and timeSliderState. The axis basis travels in the existing axis label and appears in the existing slider text and accessible name. Existing explicit-open, capability, project/revision/generation publication guards, bounds and keyboard/list fallback remain unchanged. PROJECT_STATE is read only; coordinates are DERIVED_STATE and slider interaction is TRANSIENT_STATE. No persistence adapter or product port is added.

DESIGN_TOOL_ROUTER: APPLIED
DESIGN_VISUAL_QUESTION: Can the existing Time surface disclose scene-order positioning without claiming a calendar conversion?
DESIGN_SOURCE_OF_TRUTH: Existing native Time surface on merged 895e, canonical typed anchors and the existing surface manifest.
DESIGN_RESEARCH_SOURCES: Current source and own47 first/cold screenshots and independent native outcome 69a3fcea99495079d1ea1e6ebe56b37fb2e43c2068528a7f1a6d64ca599b90dc; native-fluency-typographic-sharpness.md; YALKEN_DESIGN_TOOL_MATRIX_V1.md; ui-craft implementation rules. Brain reference lookup b3c75e97d36d0e3a49cc919d54195e7220ffef048a82ea7b9869fa43bbac2609.
DESIGN_SELECTED_DIRECTION: Reuse the existing slider label, native range input, marker and list controls. Preserve the existing typography, tokens and composition.
DESIGN_AUDIT_TOOLS: Source review before implementation; candidate and merged native observation remains pending.
DESIGN_TOOL_DEVIATIONS: No external design service or separate lab is needed for this source-causal correction. No CSS, font, token or interaction-model change.

## IMPLEMENTATION_STEPS

1. Run E0 before test or implementation edits. Preserve the original source and failing output. Append coordinate cases to the existing contract without deleting prior assertions.
2. Correct typed numeric extraction and choose one honest coordinate basis per projection. Bind that basis into the existing visible and accessible slider label. Rebuild the generated renderer.
3. Prove the same original cases, Core immutability, both open directions, approximation, unknown and mixed scales, genuine zero, genuine equal-day overlap, slider bounds, selection, list parity and budgets. Review the exact diff. Refresh factual documents with the proven M20 merged status and this task's actual stage, retaining historical blocks byte for byte.
4. Through a fresh exact preflight, refresh only necessary current governed bindings. Preserve all historical approvals, source bytes and verifier predicates. Run mandatory affected and baseline checks, actual rebuilt candidate first/cold in a new own profile and an independent physical oracle before product push. Complete ordinary PR, required CI, normal merge and exact merged verification including rebuilt native. No partial or full release claim from a green PR.

The metadata phase is admitted on clean source checkpoint 004145fb184e1fe0b24a19522796d9606da24bda by declaration e66fed5bb54058251f5a2bbfb834caaf0c4eb2d7f90e26f0256afa47cd1b885a. Only the nine technical paths added above and this task allowlist may change in that phase. The existing seven-target finalizer retains its complete validation and size limits. Preserve the previous current delta verbatim and append the new selected delta with the full inherited binding set. Current witnesses use the owner's standing both-registry authority; no prior approval is replaced. These metadata carry no release or Office acceptance.

## CHECKS

CHECK_01_PRE_WRITE: clean exact base/tree and origin/main, registered worktree and volume identity, sole writer, bootstrap, complete required normative startup and scoped factual reads, architecture preflight 7a394b716719c9300c6d4dcc5836b4289447c252959ec85818e5eceebe6172ce. CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.

CHECK_02_POST_TASK: E0 task gate before test/runtime edits.

CHECK_03_POST_SOURCE: exact original RED and corrected GREEN, no removed assertions, query immutability and unchanged manuscripts/anchors, typed numeric and fallback counterexamples, renderer build and guardrails.

CHECK_04_POST_NATIVE: rebuilt candidate and merged application; own profile first/cold; visible coordinate basis, pointer and keyboard/list navigation to exact scenes; independent canonical data, history, source, bundle and protected-profile readback.

CHECK_05_POST_DELIVERY: current bindings, required software and hosted checks, ordinary commit/push/PR/merge, fresh exact merged proof and schema-valid final report.

## STOP_CONDITION

Refuse dependent mutation or delivery on ambiguous scope, identity, authority, missing mandatory evidence, stale native admission or profile guard failure. Preserve the original failure and continue independent work. Third identical failure ends that loop with one next hypothesis.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1 and CODEX_OUTPUT_POLICY: exact identities, scope and actual numerator/denominator, delivery and one next action. Full Mac remains unqualified until every required row is proven.

## FAIL_PROTOCOL

Retain original source, input, expected and actual coordinates, exact SHA, output and all errors. Distinguish pure query proof, actual native behavior and complete release qualification. No synthetic success, skips, weakened guard or inferred calendar truth.

### Native counterexample and focus amendment

Exact a9669f7fb9f77a5d175a64fd0f857b6e68ae21bf was independently verified across the 29 pre-default software rows. A separately rebuilt actual Electron 43.8.4 app, ASAR 540c21ec94fc4b505a49a6196a106f8bc329bfc2a421830aaad691fec12171a5, ran in new own48. Its two calendar markers were visibly separate. Pointer activation of both markers, roving ArrowRight/Return and keyboard list activation opened the exact original scene texts. The independent physical readback e8069365852f761dd901e6ed7c2319f278889c34a2839a7a8045dad155cfe24b retains literal seed11 and both manuscript files, with zero Time author commands.

The same native run exposed a usable-slider counterexample: one keyboard increment changes value0 to1, but the loading/result rerenders destroy the focused range and move focus to the document root. Retain all28 AX observations under 4164be19b302a11495d47fb30b41264094bab9e3c3cd15e820e2a771d97dda33 and the causal actual-refresh-function probe 064d0dbea19b4a26aa363b774cc2fffa0c6044198ee5f902db44352c8e9629e3. Own48 exited normally, no helpers and old47 profiles intact, receipt 9a7a8f32d60a6a25324d44fe8fe804e2220dfdf4fac2c67379c7632fb5ba7a13. Its full closed bytes are preserved under e6dd2bc46ead1c62ae6bfb57403daf4cdfe2d58c63b8b4a2b2efd9240fa1138f. This candidate's cold/default proofs were not run and are not claimed.

Fresh source declaration a124bbb67c633aea1b786d650f61d7e865b5e8046666ba8e2791e1bb255b025f admits only the actual renderer refresh, generated bundle, appended C06 cases and this brief. Before implementation, E0 and the original failing function cases are required. Keep a focused owned native range mounted while its query waits. Restore only its current replacement if that same range still owns focus when a valid current result publishes. Later editor/control focus, a foreign input, project/lifecycle/generation drift or closed surface must prevent restoration. No new focus service, listeners, timers, command authority, UI composition or calendar semantics.

Rebuild and checkpoint the minimal source correction, then freshly bind current metadata. Early actual first/cold on a new own49 with all48 old profiles and20 bundles protected precedes a new expensive wave. Keep every earlier result at its original identity; repeat required dependent final-source gates and the remaining default baseline before normal product delivery. The existing form does not author ordinal story points: native observes the calendar/label fallback; numeric story behavior remains separately proven by real Core/query software cases.

### Native visibility counterexample and disclosure amendment

The rebuilt own49 app at 49a32800e47a6f34bc74f767a5b751e4c955b3ae, ASAR db60c2c7d616baa7e02e3a2376c3a2aed999f2d9cb9c28cc0e290efe56d46f4c, confirms that Right0to1 and Left1to0 now retain the native slider focus. However, its result redraw reopens the deliberately collapsed Author controls and pushes the slider to the viewport lower edge. The seven actual AX observations are retained under d03af3fd93b99a387cdd9e090096c0ba92b31482ea2db4d4882daef82ae9e6a4 and the screenshot under 66c4895f4a64438a306863742a4ab36927e7bd4a3f3e0985d50ca44bf59e8892. No visibility acceptance or cold run is claimed for this superseded candidate. Independent physical readback a21976ba7a91b1edad6a156de4b87e7dca32f6e8c55a99ac2b4bad7d9bc7aa60 confirms literal seed11 and both manuscripts with zero Time author commands. Normal Quit returned0 with all48 prior profiles intact; exit a052d9e4fa742ca886ac585a3315e2ac5f93fc0f94903c673757ff1b2de7c3b3 and full closed104entries52files ff14e4587291bddd77a852cb5a838247db41f9aff375641fe5de00ff147a5c98 remain preserved.

Fresh declaration cb98a54bee151d6a7130eb3260abbef6b8bf1175263bc34a9a148cddc949c0d7 and preflight aeed6f123a32b60f1ed8cf306517f62389d3e0750af08c3951721197b2e678de admit the same four source paths. The actual renderer and actual author-control helper reproduce the disclosure reset before implementation: RED 5a7fb643a195d2d53e57b2586fc14dc45b582639c0d0a83681f1c5dd1317d61d has38cases,32pass,6fail including the outer case. Preserve the current mounted disclosure's boolean open value before clearing the host, and apply it to its replacement. This is transient presentation only: no new persisted state, listener, timer, command, visual composition or author-data change. Every earlier31 case byte remains a prefix. GREEN 7207f210bdf23da7012ee5b74252831749b91895f1e0528bff69e71b046ac88f passes38of38, including repeated direction changes, current toggles during the await, loading/unavailable redraws and later editor focus.

The next freshly bound candidate requires early rebuilt own50 first/cold with all49 old profiles and21 bundles protected. Only cheap focused/current-binding/safety checks precede that native observation. All mandatory final-source gates and DEFAULT, normal PR/CI/merge and exact merged native proof remain pending. Preserve every superseded source, raw error, profile and observation at its original identity.

### Actual disclosure ownership and test-double correction

Own50 FIRST at ef64a03e939bccbb7669b55c3c0625514ee483e8, ASAR d4efaef080b5c8d5454ee18f0b6545a7f29a1d51dc7587fb48f089d40c92d754, retains range focus in both directions but reproduces the native visibility failure. Keep AX175fb349c1e41a2685648e5eef3e95563b2c9dacca7bc5ddbf65f3b372447cb4 and screenshot17c139d8d4f07415248656c0e6fe656db151e29d6f4a6a43d02e9fc4045cd521. The actual appendAtlasOverviewSection creates details with summary and body children, then returns the body div. The new test double incorrectly returned details and fabricated an open property on every generic element. Consequently the earlier source GREEN did not prove the actual native disclosure state. Retain it under its original identity, with this limitation. No COLD/default or native completion is claimed for ef64. Physical71c7c1db754ff74d09b42112f5b0b3f326070b462695379437156d34f2706ed2 proves unchanged seed11 and both manuscripts with zero Time author commands. Normal exit d64ac03ebd09b3689d98f8123f294430bfc4898b9de26a3b9944663dba6b69c4 and full closed105entries53files 452eade48b69c56894f91317e850af3740bd0d92ba45df95fdd9d3f5f0b8fafc remain preserved.

Declaration8f4a047cee1bb850a29f464590213b338f7e84d34c19bb1d207f21cb2e8e531f and preflight188b3367f96cfd9efd6cb54d25d8bc686ea73be22349db283d965cb958c22a91 admit the same four source paths and correction of only that newly authored harness. It now executes all four actual functions, including appendAtlasOverviewSection, models native details separately from a generic div, and retains actual parentElement containment. Every earlier31 test byte, all38 existing case names and every assertion remain. One structural control prevents repetition of this API mismatch. Before implementation RED5495f455b577ddab0c43f9c028192f3eda3ee030125e93b9098eb10ff1398ccd reproduces the failure with39cases33pass6fail. The two-line source correction marks and returns the actual parent disclosure while leaving fields and publication closures on the body. GREEN6ffd13b8f40a65124c21a5ce88b6bf7b7381e41e853bab2fe69b27cafa49df03 passes39of39. This is software evidence only until the rebuilt native observation.

Early rebuilt own51 first/cold must protect50 old profiles and22 bundles before a new expensive final-source wave. This is the second native repetition of the visibility signature; a third identical failure must end that loop with exact inputs and one next hypothesis, never another blind retry. Complete all final mandatory gates, DEFAULT and normal delivery only after actual native success; all seventeen full-Mac qualification rows remain UNKNOWN.

### Existing author-unit DOM compatibility

At 9ad6550981f5569596d8f6d100859570b5ff8675 the rebuilt own51 first/cold native observations and independent physical readback are verified under 0c5fef42855b9c257f4b8ff5a16a837cb8ddbe8bdf54eae5755cbf98678368f4. Both runs retain visible range focus through repeated directions, keep the author disclosure collapsed, navigate both exact scenes by pointer/roving keyboard/list, preserve literal seed11 and manuscripts and issue zero Time author commands. All50 prior profiles and22 bundles remain exact. These observations retain their original source/build identity and do not prove full release qualification.

The subsequent original affected-chain run fa9987f129f4c516b4ba2682f1edfefcb4f58a60891b4ab805f56207f485974c executes2313cases with2306pass7fail. Every failure is the existing author-input unit Element.append omitting the native parentElement link before reaching its authoring assertions. Read-only in-memory control12f469bc9b6fb2171e307aad80e2ea0bbe174bffe2d7e669a024a3a9714ad6e2 supplies only that standard relationship and passes all7 original cases without editing disk or removing assertions. Actual product/runtime files remain fixed. Fresh declaration8bc55e5ed62729728d41fbc06578b9348479445988c484c2be60e8f15ee18763 and preflight19984e910183ad532cb52c3d7dc75647200c3e925a377c9e6d785d6184646584 admit this existing unit as the eighteenth path. Its fixture now supplies parentElement on append. Keep every original case and assertion; do not add a product fallback solely for a mock.

RTK naturally completed4419of4419 at9ad, raw140d56dee44075c312b05b88831c71a70405fec605d9d240f6aab590268e7ca9. The newly started own C1C family was explicitly terminated after this known source qualification failure, request151772317a8aec1e973c942fd53bcd9b9d63a88e7520bdf9592805939bef7088, actual exit-15 and raw2f5ac9d06dc2b6b02fcad1764afc399144aed0a3650b97a034270b3a36b80a07. C1C remains UNKNOWN; later LONG1 gates and DEFAULT were not run. All earlier results and failures remain at their actual identities. The existing unit is already in CERT/DATA: refresh only current source hashes with the unchanged finalizer, retain all memberships and frozen history, then complete the required final candidate and merged proofs before delivery.

### Exact Sector M task admission after full baseline

At bc60b4d521c9654298a2abc2052dd7e1e0eae9d9, the terminal DEFAULT receipt120633ec8ae303fc5f69448f0e4ee019a9fea6c329f509d178581e625ba28a72 has ops3pass and unit4564 with4503pass2fail59named skips. Preserve raw e19ab0c07b746cb48cd0f363669ffe6c73a4969c504a2b66f36a6ec114057bd1 and full unit artifactccb53611c24811ef0b216b287688a2da2ed3c85676ee2ad0a2267debc8796570. Both failures are the exact Sector M scope and fast-artifact checks refusing this task document, which is missing from the existing DONE allowlist. This baseline remains FAIL. The earlier29 pre-default proofs and own52 first/cold remain at their original source identity.

Read-only causal control41a4ab2d72b5b456dab71d065f1c5baa98c7a3e15cbe9a04dae2dd855a5ebf10 changes only that one map entry in memory and passes all12 original scope/runner cases; unknown and nearby paths remain denied. Fresh declaration0053b284c1f774d21fcb2ad41dc3e2f685ead6064d7af32d84062f13cf15359d and preflightc09b27dfe1c9cb61072c28d7a45e1a9aa519cc4fe92426954c1803b0f4c58d8f admit the map as the nineteenth path. Before edit E0be2546940a6d3ad75e9e9ec7d2ffabf0803a25b94500e3ab8bbf9a75228a9c33 passes. Append only this exact task to DONE, next to the preceding temporal task. All prior entries, prefixes, phase rules, carveouts and verifier predicates remain literal. No product/runtime or test assertion changes.

Four inactive own DEFAULT traces were losslessly archived0d06ba18648c1bfc4ee780be4504bd0e91549563d3e05038c8bb52e1573c3666, physically restored and independently hashed under6d2fff0aed78cf727b924ca32f28a3797915df96ecc8f0dcaa31bc1d20956702. Only those exact generated copies were removed after verified restore; existing fencing records and original failures remain untouched. Readable non-authority archive pointer60a72b7da192d6c558428b29f60f41be10fae404d615f7498bbcec5cce985294 is retained on the original manifest-transitions directory.

Run the actual existing Sector M baseline-three checks without the read control before checkpointing source, then refresh current hashes through the unchanged finalizer. Execute cheap scope/admission proof before the fresh exact-head native and required full-source wave, including DEFAULT. No old result is retagged and no requirement is weakened. All seventeen Full-Mac qualification rows remain UNKNOWN.
