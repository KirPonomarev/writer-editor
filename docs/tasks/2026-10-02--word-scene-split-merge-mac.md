# WORD_SCENE_SPLIT_MERGE_MAC_20261002

STATUS: TARGET_DECLARED_NOT_ACCEPTED
DOCUMENT_CLASS: TASK_CONTRACT
CLAIM_BOUNDARY: Explicit scene split and merge preserving the represented manuscript graph on macOS; remaining original-plan operations remain open.
BASE_SHA: a2a5ae6cbefffce13475a0f71a3de3252d9deac6
TYPE: CORE
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3

## MICRO_GOAL

O: Split the active saved rich scene before the selected root paragraph or heading;
merge it with the next canonical same-parent scene. Preserve text, rich nodes,
notes, comments, bookmarks, internal links and resource evidence; keep exact
structural Undo across a new process. Late old editor snapshots cannot overwrite
new partitions. Observe both SOURCE and PACKAGED routes and actual Word readback.

## ARTIFACT

Existing Core tree planner and v7 writer, Main coordinator, existing command
and editor surfaces, focused tests and required companion bindings.
FEATURE_INTEGRATION_MANIFEST_WORD_SCENE_SPLIT_MERGE_V1.json and
SURFACE_MANIFEST_WORD_SCENE_SPLIT_MERGE_V1.json bind this existing-seam extension.
External architecture-declaration.json passed clean pre-write preflight on base.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true.

## ALLOWLIST

- `src/core/project-tree-cohort-v1.mjs`
- `src/core/projectTreeIdentity.mjs`
- `src/core/project-transaction-v1.cjs`
- `src/main.js`
- `src/renderer/editor.js`
- `src/renderer/tiptap/index.js`
- `src/renderer/commands/projectCommands.mjs`
- `src/renderer/commands/capabilityPolicy.mjs`
- `src/core/entitlement-law-v1.cjs`
- `docs/OPS/CAPABILITIES_MATRIX.json`
- `src/runtime-governance/docs/OPS/CAPABILITIES_MATRIX.json`
- `src/renderer/editor.bundle.js`
- `src/preload.bundle.cjs`
- `test/contracts/rtk-word-project-tree-cohort.contract.test.js`
- `test/unit/project-tree-identity.test.mjs`
- `test/unit/r24-wp201-project-transaction.test.js`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `test/unit/project-tree-pathless-contract.test.js`
- `test/unit/sector-m-tiptap-runtime-bridge.test.js`
- `test/unit/r24-ent0-entitlement-law.test.js`
- `test/contracts/capability-command-coverage.contract.test.js`
- `test/contracts/rtk-word-pending-recording-runtime.contract.test.js`
- `test/contracts/rtk-word-user-bookmarks-runtime.contract.test.js`
- `test/contracts/rtk-word-local-image.contract.test.js`
- `test/contracts/rtk-word-comment-authoring.contract.test.js`
- `test/contracts/rtk-word-note-return-runtime.contract.test.js`
- `docs/tasks/2026-10-02--word-scene-split-merge-mac.md`
- `docs/OPS/RTK/FEATURE_INTEGRATION_MANIFEST_WORD_SCENE_SPLIT_MERGE_V1.json`
- `docs/OPS/RTK/SURFACE_MANIFEST_WORD_SCENE_SPLIT_MERGE_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`

- `scripts/ops-gate.mjs`
- `test/contracts/ops-gate-core-purity-exception.contract.test.js`

- `docs/OPS/STATUS/COMMAND_CAPABILITY_BINDING.json`

## DENYLIST

No new writer, registry, IPC channel, dependency, network, project schema or
broad refactor. No changes to owner checkout, HTML, CSS, toolbar geometry,
Atlas, Pulse, Google or general distribution. Do not convert safe refusal or
test counts into feature acceptance. No guessed project reconstruction from
Word headings, renderer-supplied fragments/paths or heuristic lost-anchor repair.

## CONTRACT / SHAPES

T: Canonical manifest and rich scenes plus annotation/resource state -> validated
Core partition plan -> existing command-authorized leased transaction -> exact
readback -> revision/session-bound tree and editor publication.
H: Current planner admits only rename/move/reorder/copy. Explicit partitions and
same-ID content publication can preserve the graph without copy/delete emulation.
Predicted observation: split then merge preserves combined content and ownership;
structural Undo in a new process restores exact beforeimages, while delayed old
Save after successful new-editor ACK writes nothing.
B: Original and unrelated graphs, provenance, resource bytes, backups, dirty
buffers, existing transaction recovery and text-history semantics stay protected.
I: Base above; branch codex/word-scene-split-merge-mac-20261002; synthetic native
profiles only; exact frozen runtime and Word artifact hashes recorded per run.

Commands: cmd.project.tree.splitScene and cmd.project.tree.mergeNextScene.
Split intent: projectId,nodeId,name,expectedTreeRevision,boundaryRootIndex,
expectedDocumentId,expectedGeneration,expectedTreeContentPublicationId.
Merge intent: same identity fields, without name or boundaryRootIndex.
Main resolves the adjacent sibling and all canonical paths independently.
Snapshot rootSplitBoundary is null or exact {boundaryRootIndex,position}; Main
validates raw keys and safe integers against actual rich doc and collapsed cut.

Core split topology: {sourceNodeId,sourceRelativePath,boundaryRootIndex,newRelativePath}.
Core merge topology: {leftNodeId,leftRelativePath,rightNodeId,rightRelativePath}.
Computed outputs: scenePartitions,scenePublications,createdNodeIds,removedNodeIds,
sceneReceiptSources. Original left ID survives; split creates right ID, merge
retires right. Existing same-parent filename permutations remain checked.
Do not encode one-to-many ownership as a one-to-one identity map.

Annotations retain identity and provenance with exact root/leaf/UTF16 mapping.
Unrepresentable crossing ranges/links, conflicting metadata and pending-history
composites refuse without writes and remain full-plan residuals. Cards have no
IDs: merge concatenates exact arrays including duplicates; split leaves scene
metadata/cards with original left and defaults the right. Split retains complete
validated original resource receipts; merge unions exact resource records or
refuses conflicts. No asset deletion. Ordinary changed Save invalidates older
structural Undo rather than discarding newer bytes.

Before releasing the tree commit queue, rotate the existing private authoring
session and install a target-content fence, including same-ID/path changes.
Do not clear dirty state prematurely. Every snapshot/save request retains its
original session across awaits and validates it at actual write. Acknowledging
the new editor cannot make an old queued request valid. Renderer replacement
requires exact prior buffer/context/epoch and no intervening edit/draft.
Reset only PM history using remove/reconfigure/restore of the original history
plugin; preserve other plugin state and update the view only with final state.

Explicit Save As may fork a refused old buffer from the current verified split,
merge or structural Undo beforeimage. recoveredCopy has an exact XOR between
legacy removedNodeId and sourceNodeId variants, with receipt,retainedPacket and
workingContent. Core selects original graph from the packet; fresh output IDs,
current partitions unchanged; continuation limited to8links and32MiB.

## IMPLEMENTATION_STEPS

1. Core, Main and UI agents implement their disjoint admitted files against the
agreed shapes. Root owns docs, matrices, generated build, native proof and delivery.
2. Exercise actual planner/writer, actual Main command route and real PM adapter
on one rich composite before native work; repair affected fixtures together.
3. SOURCE early split/merge, editing/save, structural Undo and restart; inspect
canonical graph independently. PACKAGED and Word readback on stable candidate.
4. Freeze product bytes, refresh all required exact companion bindings, run
mandatory baseline and CI once per unchanged candidate, then merge and verify.

Design router: APPLIED; declaration value APPLICABLE_LAZYWEB_FIRST.
Design source: existing Yalken tree context menu and node name dialog.
Prior Lazyweb-first search produced no relevant exact split/merge specimen;
no external visual claim is made. Existing brain references manuskript.md and
novelwriter.md contribute ideas only; no GPL code. ui-craft applies to touched
controls. Existing Design OS guide/matrix read; no new visual language.
Direction: “Разделить перед текущим абзацем…” and “Объединить со следующей сценой”
with a named next scene, existing keyboard/focus behavior and typed status.

## CHECKS

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
CHECK_01_PRE_ADMISSION: T7 UUID/encryption/unlocked/writable, clean exact merged predecessor,
bootstrap and required reads; preflight PASS before these contract files.
CHECK_02_POST_CORE: rich multi-root split/merge, repeated/empty/Unicode leaves,
annotation identity and exact text conservation, resources/cards/meta, immutable
plan revalidation, before/after journal faults, recovery and restart Undo.
CHECK_03_POST_CHAIN: actual Main command bridge and PM, same-ID replacement,
old snapshot/Save/autosave released AFTER new ACK, capability/project/tree drift,
late typing/drafts, recovery-copy wrong source/tamper/receipt/resource/target.
CHECK_04_POST_NATIVE: SOURCE and PACKAGED explicit split/merge, ordinary edits,
Save, structure Undo, process restart, full manuscript export through Word;
independent ZIP/canonical readback for content and annotations. Include source
originating from Word and current-scene exports in affected-chain regression.
CHECK_05_POST_DELIVERY: declared scope and diff review, affected fixtures and
all required companions before expensive validation; baseline, guardrails,
OSS policy/audit, frozen CI, exact merged clean verification. Skips excluded.

## STOP_CONDITION

Stop unsafe mutation on unknown ownership, canon/base/scope drift, stale private
context, unexplained bytes, invalid preflight or authoritative writer failure.
No new contour until this delivery completes. Refusals are never positive support.

## REPORT_FORMAT

One text block with KEY: VALUE, basenames only; task/base/candidate/merged SHA,
tests and exclusions, scope, commit/push/PR/CI/merge, native evidence, residuals
and one next user operation. Full P2d three-way local/returned merge remains
required after this package; this contract does not reduce the complete plan.

## FAIL_PROTOCOL

Retain exact expected/actual input, HEAD, build/profile and artifact hashes.
After three identical failures change the hypothesis before another run.
Repair one reproduced blocker with focused evidence; no silent fallback,
disabled checks or weakened writer/capability. Do not repeat unchanged heavy runs.


Admission repair: exact pre-existing lexical node:path import in the cohort planner
was missing from the existing pure-runtime import table. Admit that exact source
and line only; adversarial filesystem/process/mixed-effect cases stay rejected.
No runtime effect or new policy authority is granted.

Admission repair verified: original gate failed at cohort line1; the added focused
case reproduced that failure. Existing purity contract now passes44of44, no
skips/todos, including exact-source positives and other-source, filesystem,
process and mixed-line negatives. Task shape gate passes. This proves admission
classification only, not runtime or user acceptance.

Command-binding amendment: clean owned WIP checkpoint4994c2e6049a993c131d5c34aec04044f6c0560a
admits39paths including existing COMMAND_CAPABILITY_BINDING.json. Add only the
two declared command-to-capability pairs. Preflight PASS; original delivery base
remains a2a5ae6c. Checkpoint and focused tests are not native acceptance.
