# WORD_SCENE_IDENTITY_MAC_20261002

STATUS: TARGET_DECLARED_NOT_ACCEPTED
DOCUMENT_CLASS: TASK_CONTRACT
TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BASE_SHA: 35cee726420005dd561634f0b6771d4759191220

## MICRO_GOAL

O: Mac scene rename, reorder, move, copy and explicit tree Undo preserve canonical scene identity, annotation ownership and recovery through governed commands.
Acceptance: actual native SOURCE and PACKAGED rename/reorder/move/copy/tree Undo, save/restart and DOCX Word readback; canonical identity and annotations independently checked. One P2d slice, not the whole Mac plan.

## ARTIFACT

Existing transaction journal and governed tree commands. PRODUCT_UI declaration covers the small menu contribution inside one storage-dominant coherent slice. Preflight passed on clean exact base before first write. Feature and surface manifests are declared before runtime changes.

## ALLOWLIST

- `src/main.js`
- `src/core/project-transaction-v1.cjs`
- `src/core/projectTreeIdentity.mjs`
- `src/core/project-tree-cohort-v1.mjs`
- `src/core/entitlement-law-v1.cjs`
- `src/renderer/editor.js`
- `src/renderer/linkDialog.mjs`
- `src/renderer/commands/projectCommands.mjs`
- `src/renderer/commands/capabilityPolicy.mjs`
- `src/renderer/editor.bundle.js`
- `test/contracts/rtk-word-project-tree-cohort.contract.test.js`
- `test/unit/r24-wp201-project-transaction.test.js`
- `test/unit/r24-wp201-project-transaction-physics.test.js`
- `test/unit/project-tree-identity.test.mjs`
- `test/unit/project-tree-move-main.test.js`
- `test/unit/project-tree-identity-main.test.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `test/unit/sector-m-command-kernel-tree-document-adoption.test.js`
- `test/unit/sector-m-preload-tree-document-command-bridge.test.js`
- `test/unit/project-tree-pathless-contract.test.js`
- `test/unit/r24-ent0-entitlement-law.test.js`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/tasks/2026-10-02--word-scene-identity-mac.md`
- `docs/OPS/RTK/FEATURE_INTEGRATION_MANIFEST_WORD_SCENE_IDENTITY_V1.json`
- `docs/OPS/RTK/SURFACE_MANIFEST_WORD_SCENE_IDENTITY_V1.json`
- `docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json`
- `docs/OPS/CAPABILITIES_MATRIX.json`
- `src/runtime-governance/docs/OPS/CAPABILITIES_MATRIX.json`

- `test/contracts/rtk-word-c2-rich-scene-reexport.contract.test.js`
- `test/contracts/rtk-word-clean-link-label.contract.test.js`
- `test/contracts/rtk-word-combined-link-return.contract.test.js`
- `test/contracts/rtk-word-full-manuscript-current-project.contract.test.js`
- `test/contracts/rtk-word-media-return-runtime.contract.test.js`
- `test/contracts/rtk-word-nested-tables.contract.test.js`
- `test/contracts/rtk-word-round-key-durability.contract.test.js`
- `test/contracts/rtk-word-comment-return-apply.contract.test.js`
- `test/contracts/rtk-word-comment-return-delta.contract.test.js`
- `test/contracts/rtk-word-note-return-runtime.contract.test.js`
- `test/contracts/rtk-word-user-bookmarks-runtime.contract.test.js`
- `test/contracts/rtk-word-pending-return-runtime.contract.test.js`
- `test/contracts/rtk-word-pending-rich-blocks.contract.test.js`
- `test/helpers/main-docx-round-authority.js`

- `test/contracts/rtk-word-node-name-input.contract.test.js`

- `src/core/word-user-bookmarks-v1.cjs`

## DENYLIST

No owner checkout writes, new dependency/network, new writer/store, global scene-ID migration, HTML/CSS redesign, numbering or story grammar changes. No weakening tests or dropping unsupported metadata to make a copy succeed.

## CONTRACT / SHAPES

T: Renderer pathless intent -> Command Kernel -> Main private identity and dirty save barrier -> terminal durable Word round expiry -> Core pure cohort plan -> existing project transaction lease/journal/CAS writer -> readback -> current identity-guarded projection.
H: One simultaneous identity map and recoverable before/after cohort remove existing sibling-path and annotation ownership divergence.
B: Source copy bytes/history remain source-owned; stable IDs survive move; copied IDs are fresh and all typed local links retarget. Pending semantics and history retain closed note ownership; historical provenance strings are not rewritten.
I: Exact base above; codex/word-scene-identity-mac-20261002; current project/node/revision/generation required.
Undo restores exact cohort only after full after-image CAS and consumes a monotonic persisted token; text CmdZ is unchanged.
Expire OPEN Word rounds durably before tree staging under the same project queue/lease. Failure here writes no tree. Later failure and tree Undo do not reactivate expiry; fresh export is required. Never rewrite original signed baselines/capsules.
Existing scene history and commit companions must remain readable and ordinary save must work after move and Undo. Unknown ownership/bytes or symlinks fail closed before mutation.
Old binary legacy tree mutation compatibility is outside acceptance; updated readers reject unknown receipts and old transaction readers reject pending v7.

## IMPLEMENTATION_STEPS

1. Core pure validated simultaneous cohort and existing writer v7 recovery, literal identity/copy/fault tests.
2. Main governed tree integration, dirty save and late-publication barriers, durable authority fence and query projection.
3. Existing menu copy and explicit tree Undo, pathless payloads, keyboard/focus and capability denial tests.
4. Early SOURCE/PACKAGED native full route before frozen broad validation; then reviewed candidate, mandatory gates, commit/push/PR/CI/merge and clean merged-head checks.

## CHECKS

CHECK_01_PRE_ADMISSION: registry/worktree identity and T7 UUID/encrypted/unlocked/writable; bootstrap; unchanged ordered canon verified against previous read base; architecture preflight PASS.
CHECK_02_POST: Actual Main full sibling permutation active path and annotation ownership; copied note/comment/bookmark identity independence; source unchanged; save/Undo/reopen/export after tree mutation.
CHECK_03_POST: Fault every cohort publication/recovery phase, partial disk crash, unknown third-party bytes, retry/idempotence, monotonic Undo stale token refusal.
CHECK_04_POST: Forged renderer paths, project switch, late autosave, dirty scene, stale candidate apply/export activation, malformed present durable authority; expiry failure leaves tree unchanged.
CHECK_05_POST: SOURCE and PACKAGED native coherent tree edits and copy/Undo then restart/DOCX Word readback before frozen full CI.
CHECK_06_POST_DELIVERY: guardrails, oss policy/audit, baseline and frozen required CI, clean exact merged tree and relevant rerun. No skipped case becomes accepted.

## DESIGN_REFERENCES

Lazyweb reviewed Signeasy rename dialog and Coda document move context: same existing menu/dialog contribution. Generic duplicate/Undo search was weak and is not evidence for new layout. Stable reference session 825f95b9-30f8-42ae-abb7-06d5f3920d12; no external runtime dependency.
brain:refs and local manuskript.md/novelwriter.md provide context only; no GPL code copied. ui-craft applies existing tokens, labelled controls, focus and keyboard preservation.

## STOP_CONDITION

Bounded observed outcome plus mandatory proofs and delivery complete; no full-plan completion claim. Unknown identity, unsupported cohort or three repeated same failure stop the write loop and require one recorded next hypothesis.

## REPORT_FORMAT

CODEX_OUTPUT_POLICY: one text block, KEY: VALUE; files as basenames. Task/base/candidate/merged SHA, scope, tests, commit/push/PR/CI/merge, exact-head verification, residuals and next action. All delivery flags true.

## FAIL_PROTOCOL

Revert bounded command/planner integration while preserving readable journal/recovery support for created v7 artifacts. Never blindly downgrade pending journals or reactivate expired Word rounds; complete recovery first. No private documents modified outside dedicated native fixtures.

## CURRENT_EVIDENCE_AND_AMENDMENT

Checkpoint4582cb22b88f5a50ca03b3c76885b016dd0944d8 preserves the initial owned implementation before expanding existing Word test harness closure. Clean amended preflight passed for49 paths, adding13 actual affected contract harnesses and one test-only actual-Main authority helper. This is the same P2d delivery, not acceptance or a new contour. Original delivery base remains35cee726.

Core focused57 passed with zero skip/todo: inherited assets verified before tree write, retained through ordinary save, crash recovery and explicit repair; malformed UTF8 scene bytes refuse instead of replacement. Main focused19 and existing3 passed before native; UI focused49 passed. These counts do not substitute for final exact-candidate proof.

SOURCE runtime01 copied3447 files with equal digest8ab713ad6ef9f164a98440f713731a17049c43571c381a054f51903250790130. Native rename twice accepted a valid visible name and closed without changing canonical path or showing an error. This is FAIL, not acceptance. No third identical attempt. Next hypothesis: actual dialog-to-command seam or snapshot dispatch closure; inspect real error publication and runtime bridge before rebuilding. Separate actual-Main late-edit injection after durable commit found stale guard can leave active path on removed source; fix must preserve dirty authoring and rebind durable committed identity.

Native SOURCE and PACKAGED execute sequentially against the same synthetic absolute project root. Preserve each run output then restore exact initial fixture before the other process, because canonical commit receipts bind absolute paths. This does not prove cross-root portability. Initial native fixture has7 bookmarks,2 internal links,1 footnote and1 comment, authored via baseline native commands. Independent canonical inspector checks ownership, fresh copied IDs and original bookmark identity.

Retained limitations: serialized cohort packet is bounded to32MiB including before/after; replay after commit refuses by revision CAS rather than promising idempotent success. Old synchronous classifier has no runtime callers and remains legacy-only; verified runtime reader accepts v7. Non-roman rename retains the existing privately resolved route. Command/capability docs synchronize prior missing media and bookmark bindings without runtime authority expansion.

Original-plan boundary: ENGINEERING_PLAN P2d explicitly includes scene split/merge and three-way local/returned concurrency. This rename/reorder/move/copy package alone does not close P2d. Scene split/merge and any unproven independent-concurrent apply remain in the whole-plan remainder after this delivery. Expiring old review rounds during structural mutations is a safe bounded fence, not proof of automatic concurrent merge.

SOURCE02 diagnostic logging identified the native refusal: Main omitted existing backups root from captured inventory, so the planner treated that directory as absent and exact before-image CAS correctly refused. The original error was then masked by invoking single-scene recovery without a pending journal. Fix inventory capture and preserve the original prejournal failure; do not weaken directory CAS. The existing status text is hidden by literal-stage baseline, making failures invisible. Bounded UI correction exposes only the existing status text on explicit command failure or tree refusal; no dev status siblings, new surface or layout is introduced.

Second harness amendment: clean checkpointd9fcf4855961fbc2835ba04c225015fad189bd03 admits existing node-name-input contract closure, total50paths. SOURCE03 real rename, copy and active-copy Undo observed; independent canonical checks7→14→7 bookmarks,2 links per scene and1→2→1 notes/comments. Heading refresh and legacy resource retention through Undo/ordinary save are fixed for SOURCE04. No final native or delivery claim yet.

Third amendment: clean checkpoint70cc6b774d125e03e3875d69b90000574adf2753 admits51st path word-user-bookmarks-v1.cjs. Native SOURCE04 dirty insertion before CrossBlockStart -> rename saved correctly; native text Undo restored visible text but Save was blocked. Read-only literal replay proves USER_BOOKMARK_EDIT_BOUNDARY_CONFLICT with identical incoming registry, not continuation mismatch. A pure deletion touching an outer endpoint of a provably surviving range may map that endpoint to deletion start; point, fully consumed, strict interior, replacement and ambiguous minimal placements remain refused. Original endpoint pair must be read before either endpoint maps. Structural mapping unchanged. This repairs the witnessed ordinary-save inverse in this same scene lifecycle; no broader deletion grammar claim.

Actual Main concurrent Save captured before tree commit can queue behind it and resurrect the old pathname. Existing private writer guard must validate captured subject/session/project/path at queue entry and before publication, producing typed zero-write refusal while retaining dirty text. This is a required late-save invariant, not a new writer.

Additional literal checks:470 focused Main and affected Word harness cases passed before the newly exposed queued-save race; this count is not final candidate acceptance. Core surviving-range boundary fix228 passed with zero skips. Rare late dirty active-copy Undo retains buffer and readable inverse packet; only plain SaveAs is proven, rich detached SaveAs is not claimed. Recovery warning does not promise writing the rich fork through that lane.

SOURCE05 digest7132e06bd8e55fa3850c24e0274f0cff553eb97bec8aa2bc9de2186487c9374f: actual dirty prefix insertion, rename, text Undo and save restored the literal seven bookmark records, one footnote and one comment in canonical files. Copy and opening its fresh linked graph also passed independent readback. Explicit structure Undo then failed: source-history metadata differed only in final newline and an asynchronous periodic backup added a snapshot after the tree receipt. This is not acceptance; retained immutable failure snapshot binds diagnosis. Required repair must retain exact Undo CAS, use the existing backup metadata producer bytes and serialize/fence delayed backup publication against tree revision. Generic E_COMMAND_FAILED also masked the typed reason at the existing copy/Undo bridge. SOURCE05 process exited normally and initial dedicated fixture restored with fifteen file hashes verified; no owner data touched.

SOURCE06: canonical dirty rename/text Undo/save, copy, and copy Undo passed independent literal graph checks. Editor still displayed removed copy: accepted PM defaults differed from the disk bytes supplied as exact publication baseline. Drags did not dispatch because dragover read protected-mode data instead of exposed formats. Context move failed before the handler. Main29 and existing backup12 focused checks passed but did not establish native acceptance. Complete dedicated profile retained; no-window Mac process required controller termination after TERM/INT, which is diagnostic cleanup, not restart proof.

SOURCE07: exact composer publication baseline repaired, but native copy Undo still retained the copy in the editor while canonical files were restored. Literal whole-Main and renderer tests exposed a second seam: Main dirty signal generation resets to0 on open, while renderer edit generation remains monotonic. They must be separately bound; equality checks must remain exact. The native move refusal was independently traced to the generic command bridge allowlist omitting the existing governed move command; direct-handler positive evidence missed that route. UI dragover formats admission and typed failure diagnostics are fixed but native cross-chapter movement remains unverified. SOURCE07 closed its native window then exited normally under TERM; original dedicated fixture restored with15 hashes. A private authoring identity fence is required so late refused replacement cannot save a copied buffer to the rebound source path. All changes remain within the admitted files; no new IPC/preload or renderer path authority.

SOURCE08 digest7abe31fb206fa637608ce7189c3848852c7cc91e98d9d75a031335d6f5e6964a: native dirty rename/text Undo/save, fresh copy/open, active-copy structural Undo and original Save passed canonical seven-bookmark/one-note/one-comment checks and visible original heading/link identities. Recopy and context Down passed actual generic bridge and sibling pathname rebinding. Physical cross-chapter drag twice produced no observable mutation; direct frozen handler replay accepts the exact IDs, so native event delivery remains unverified. Restart reopened correct copied links and canonical fourteen/two/two graph. Native DOCX export then refused E_EXPORT_CANONICAL_SOURCE_UNAVAILABLE; no DOCX output or Word acceptance. First controller restart was attempted before old process exit: both dedicated test processes were preserved and stopped, then a single new process was launched. This is a controller error, not graceful restart acceptance. Final SOURCE08 window close and TERM exited0.

Focused SOURCE08 proof: Main41 (38 full Main plus3 old tree cases), backup12 and UI65 passed with no skips/todos; independent race probes found no remaining overwrite bypass. Retained stale-copy buffer is protected but ordinary Open cannot recover it. The same contour needs bounded explicit SaveAs recovery through private verified Undo beforeimage, fresh scene IDs and existing v7 writer; no snapshot bypass or new IPC. No package acceptance or full-plan completion claim.

Fourth checkpoint cbf0381b34ee857820fb88f023e6f35045bd2658 preserves SOURCE08 diagnostic candidate; clean recovery-amended preflight passed with the same51 paths. Explicit cmd.project.saveAs recovery is restricted to the privately captured removed-copy identity and current verified Undo packet. Core derives the former scene, annotation owners and resources from that packet, validates working edits with existing strict planners, and forks fresh IDs through the existing leased v7 transaction. Current original and unrelated annotation bytes remain protected. No new IPC, public bypass flag, writer or journal version. Unsupported anchor edits, changed pending ledger or media placements refuse.

SOURCE08 export failure was reproduced by actual Main on retained native canonical bytes: PENDING_REVISIONS_INVALID with zero project writes. Note export paragraph projection retained the recognized wordUserBookmarks root attribute, which the narrower pending paragraph reader rejects. Repair must validate the raw bookmark registry and remove only this recognized attribute from the derived paragraph projection; never alter the canonical document or silently discard unknown metadata.

SOURCE09 drag diagnostics record only bounded stage/reason flags, never IDs, paths or manuscript text; no dragover hot-loop logging. Synthetic invocation proves only handler semantics and does not substitute for physical drag event delivery. Native keyboard destination flow remains a read-only proposal, not admitted or implemented functionality.

SOURCE09 source digest908b1f19084b378a5accdff928e727f7f2ff94f8bf129b681016ed2e251e1b66: native dirty rename/text Undo/save, copy/open/structural Undo returning original heading and links, recopy/reorder all observed; literal canonical graph checks7→14→7→14 preserve notes/comments and copied identities. Native Minimal export after reorder succeeds, and actual Mac Word Open/Save As preserves seven bookmark names, both internal targets (one rewritten to a HYPERLINK field), and exact footnote body. This is not comment roundtrip: pre-existing Minimal exporter silently omits canonical comments; single-scene review export explicitly requires full manuscript for annotated scenes. Full-manuscript native export contains both canonical comments. Single-scene complete comment export remains a whole-plan limitation.

SOURCE09 native drag instrumentation received accepted start then end effect none, with no target drop. Read-only review found no dragstart tree rerender; the gesture route is unverified. Do not replace this with a synthetic success. Clean checkpointc45ca6bb782213a0d22dfd56a14cf5bb8f87d8a4 and amended preflight PASS retain51paths, admitting existing move intent via labelled chapter chooser in the existing context menu/dialog. Captured project, source, target and revision are revalidated; only node IDs pass to existing command. This accessible route will have independent native acceptance; drag remains separately unproven. Prior Lazyweb Coda move reference applies; no new visual language, IPC or storage authority.


SOURCE10 and PACKAGED10 use identical runtime digest930f6b280a9e859584a54123ef24a210e9f564ac3d02d74cac024c3883d46d7a,3433 matched files; unpackaged SOURCE uses the default profile (PRODUCT_PROFILE empty), PACKAGED uses WRITER_LOCAL_V1. Both native routes observed: ordinary keyboard append -> rename with dirty save -> text Undo/save -> copy/open -> structure Undo/original save -> new chapter/recopy/reorder -> labelled move chooser Escape and Enter -> move Undo -> move/save -> process exit0 -> same-profile restart -> full manuscript DOCX -> Microsoft Word Open/Save As. Independent raw canonical readback proves original identity and copied graph independence. Independent ZIP/XML readback compares exact body text, all14 user bookmark UTF16 ranges,4 internal targets (including Word HYPERLINK fields),2 note bodies and2 comment bodies/anchor ranges before and after Word. All matched. SOURCE10 first rich-editor selectText controller diagnostic is excluded; successful route used ordinary keyboard input. PACKAGED10 restart first launcher invocation lacked the pinned dependency environment and did not launch a process; corrected invocation reopened the same preserved profile.

Final focused evidence before broader gates: Core42 zero skips/todos, Main57 zero skips/todos plus6 after wording-only change, UI68 zero skips/todos. Actual Main covers retained-copy rich SaveAs, repeated replacement refusal, late edit, pending annotation drafts and stale context; forced native race is not claimed. Recovery continuation is bounded to8 links and32MiB. Physical drag remains unverified; the observed chapter chooser supplies the governed move route. These observations do not claim P2d or whole-plan completion. Full baseline, frozen CI and exact merged verification remain pending.


Final review found a distinct original-Undo commit race: the live rich buffer could be detached before the normal replacement fence was installed. This branch now derives a private null-path recovery fence from the verified Undo packet and the surviving source identity. Renderer retains only an inert detached-origin guard; explicit recovery publication requires that guard plus exact project, content, renderer generation and absence of annotation drafts. Main generation is captured after receipt validation, separately from the monotonic renderer epoch. Actual Main66 zero skips/todos includes rich detached SaveAs/reopen/export, seven hostile cases and late typing during receipt read; independent receipt-read and concurrent-autosave probes preserve the original and recover the copy. UI68 zero skips/todos includes the whole detached listener and recovery publication. Main SHAe0e50d9552830dd7fef7a92c368162783ef525b987c306df7fa895730dd43547, editor SHA76043e014941a80b1704008387d19c347027961f045e853f60fe4f5333db0f48. Earlier detached-rich limitation is superseded by this bounded recovery; unsupported edits still refuse. SOURCE11/PACKAGED11 targeted native rerun and final delivery evidence are recorded separately by immutable artifact hashes; SOURCE10 is not silently relabelled as this candidate.

The first full baseline attempt stopped before tests because two changed command/capability tables lacked current exact-byte approval entries. Both are already admitted task scope; their explicit owner-delegated bindings were added to the existing Interop registry. No checker or approval requirement was weakened. Existing unchanged lock audit reports13 findings (5moderate,8high,0critical); this package does not claim zero-vulnerability distribution release.
