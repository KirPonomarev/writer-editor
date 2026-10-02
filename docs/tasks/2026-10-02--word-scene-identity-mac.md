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
