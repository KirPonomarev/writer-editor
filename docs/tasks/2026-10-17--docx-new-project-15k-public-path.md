# DOCX to a new project — first complete15k source path

TASK_ID: YALKEN_DOCX_NEW_PROJECT_15K_20261017
TYPE: UI
DOCUMENT_CLASS: PROCESS
STATUS: SOURCE_COMPONENT_VERIFIED_DELIVERY_PENDING
CLAIM_BOUNDARY: Source/component implementation only; Word/native remains PAUSED
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
ACTIVE_EXECUTION_CANON: v3.13a-final
BINDING_BASE_SHA: cac72773ba1abdf07a0dffa37f372b44af6739ff
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_HEAD_VERIFICATION_REQUIRED=true
ROLE: Sole direct coding agent; not orchestrator mode. Owner authorized direct implementation and the one-way new-project boundary.

## MICRO_GOAL

One ordinary DOCX becomes one fresh project with exact supported text,
comments/replies/anchors and pending insert/delete decisions. First prove a
15000-character chapter. Source input and the open project/draft are protected.
This is an executable scope contract, not another owner-facing plan revision.

## ARTIFACT

One coherent vertical slice through existing canonical commands, Core models,
product creation port/adapter and the existing preview modal. New project data
is complete and verified before the canonical manifest makes it discoverable.
The normal project-open command owns subsequent navigation and unsaved-work duty.
No old history merge, return registration or durable undo system is introduced.

## ALLOWLIST

- src/core/docx-new-project-v1.mjs
- src/product/docxNewProjectCreateV1.mjs
- src/core/word-manuscript-notes-v1.cjs
- src/core/project-tree-cohort-v1.mjs
- src/io/revisionBridge/index.mjs
- src/utils/docxImportSafeCreate.js
- src/main.js
- src/renderer/commands/projectCommands.mjs
- src/renderer/commands/command-catalog.v1.mjs
- src/renderer/editor.js
- src/renderer/editor.bundle.js
- test/contracts/rtk-word-generic-comments.contract.test.js
- test/contracts/rtk-word-manuscript-notes-import.contract.test.js
- test/contracts/revision-bridge-docx-import-e2e-command-chain.contract.test.js
- test/contracts/revision-bridge-docx-import-reference.contract.test.js
- test/contracts/b2c06-project-lifecycle-state.contract.test.js
- test/unit/docx-import-product-flow-command.test.js
- test/unit/docx-import-preview-ui-flow.test.js
- docs/tasks/2026-10-17--docx-new-project-15k-public-path.md
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/post-audit-certification-set.mjs

Handwritten runtime budget900 lines and behavior tests1200; generated bundle,
canonical task contract and exact-byte companions are separate mechanical output.
Existing maintained test-file membership and skip/oracle classifications stay fixed.

## DENYLIST

- package.json
- package-lock.json
- src/core/ipc-envelope-v1.cjs
- src/renderer/index.html
- src/renderer/styles.css
- All original projects, SOURCE80, Q1/Q2, integrity stores, native profiles, old Word release acceptance and unrelated workflows/oracles.

No new dependency, runtime network, private bus/Core, broad cleanup, native app,
Word, old project mutation, permission/heap flags, workflow changes or synthetic
acceptance receipts. Original failed evidence and prior approval tuples remain.

## CONTRACT / SHAPES

Product Core owns fresh project semantics and existing pending/comment/note data.
Command Kernel owns dispatch and repeat capability checks. The adapter reserves
only a fixed Main-owned parent plus a fresh locally minted UUID directory.
Renderer consumes immutable target/summary data and sends intent; it supplies no
filesystem path, project identity, Core payload or approval authority.

The public UI always uses explicit target=new-project. Existing no-target API
remains its declared legacy compatibility contract; unknown targets refuse.
Seeded lifecycle.create accepts only request ID, a current opaque admitted plan
reference, a bounded optional display name, and preview/create action. Preview
creates no filesystem project. Main checks both create and DOCX import capability.
Normal lifecycle.open remains separate, so navigation failure never repeats import.

Imported note candidates retain their native union and Original positions. Core
checks both projections and binds only fresh scoped local note IDs into existing
noteSourcePoints. No guard-only removal or guessed inverse point is permitted.
Supported pending revisions are text insertion/deletion inside existing paragraphs;
unsupported structure, moves and revision operations refuse before publication.

Every asynchronous publication rechecks source reference/context, target identity,
root ownership and current project lease/fence. Failure rollback can remove only
exclusive witnessed new files and empty owned directories; changed/foreign state
remains untouched. A present canonical manifest is never deleted by rollback.
Native/browser application proof is outside this source-only contour.

DESIGN_TOOL_ROUTER: APPLIED
DESIGN_SOURCE_OF_TRUTH: Owner one-way new-project intent plus existing import modal/controls; preserve HTML/CSS/typography and composition.
DESIGN_RESEARCH_SOURCES: Current guide/matrix, integration doctrine, local brain references and novelwriter note; no external code copied.
DESIGN_SELECTED_DIRECTION: Existing preview states plus explicit new-project target and separate canonical Open.
DESIGN_AUDIT_TOOLS: UI-craft guidance and focused source/component behavior checks; native visual result is not yet proved.
DESIGN_TOOL_DEVIATIONS: Direct owner optional-integration restriction supersedes old service-first routing. Native enum APPLICABLE_LAZYWEB_FIRST is a compatibility token only, not evidence of service use. No optional service is invoked.
HOT_PATH_BOUNDARY: No work added to typing; one bounded explicit import preparation/publication path.
RUNTIME_SCOPE: Code plus fresh synthetic temporary APFS projects only; no live app/profile state. Temporary prefix yalken-docx-new-project-15k-20261017-; final materials and reports stay in the dated T777 folders.

```json
{
  "schemaVersion": "FEATURE_INTEGRATION_MANIFEST_V1",
  "featureId": "docx.import.new-project.v1",
  "featureVersion": 1,
  "domainOwner": "Product Core project creation, pending text, comments and manuscript notes",
  "authoritativeData": "New manifest/scenes/comments/notes only after complete create-only publication; input DOCX remains unchanged",
  "derivedData": "Bounded immutable preview summary and source/plan hashes; private attempt state is discardable transient reservation",
  "commandIds": [
    "cmd.project.importDocxV1 target=new-project",
    "cmd.project.lifecycle.create seeded from opaque Main plan reference",
    "cmd.project.lifecycle.open"
  ],
  "eventTypes": [
    "Typed project-created result; no old history or export-return authority"
  ],
  "queryIds": [
    "Existing DOCX preview/plan and project library projections"
  ],
  "productProjectionIds": [
    "New-project import preview summary bound to request/reference context",
    "Committed project identity and counts only"
  ],
  "capabilityIds": [
    "Existing importDocxV1 and lifecycle.create/open capability/profile/entitlement decisions"
  ],
  "authorityMap": "Existing cmd.project.importDocxV1 with explicit target=new-project -> existing canonical cmd.project.lifecycle.create with a strictly validated Main-owned preview reference and preview/create action -> named product creation port. Existing cmd.project.lifecycle.open owns later navigation and normal unsaved-work safeguards. Legacy no-target API remains an explicit compatibility path, not a fallback for unknown targets.",
  "identityKeys": [
    "Exact M base, clean registered existing worktree, branch codex/docx-new-project-15k-20261017; fresh origin/main and remote binding checked before edits/delivery.",
    "Source plan/ref digest, request identity, window/lifecycle context and current reference generation; opaque Main references are required for new-target publication. Raw client plans/paths/approval booleans cannot grant write.",
    "Fresh Main-minted project UUID, source-owned note and comment positions, immutable Core preparation, fixed backend project parent, exclusive owned root inode/realpath witnesses and existing project lease/fence/manifest create-CAS.",
    "One current prepared/publishing operation with bounded small completed-result records; no large completed model cache. No worker or typing-path work introduced."
  ],
  "revisionPolicy": "Original captured artifact hash and exact private source-plan reference; fresh canonical local identities, no existing-project version matching",
  "writePath": "Existing Renderer intent -> Command Kernel profile/entitlement dispatch -> Main private admitted source reference -> Core preparation -> ProjectPersistencePort.createFromDocx adapter -> fresh exclusive owned directory -> complete durable/readback-checked files -> real Main manifest authority create-CAS under existing fenced project lease -> library registration -> typed result; canonical open remains separate.",
  "readPath": "Existing admitted source -> Core immutable summary -> existing modal; persisted new graph -> normal library/open projection -> editor",
  "requiredProductPorts": [
    "NEW_PORT: ProjectPersistencePort.createFromDocx, one explicit adapter in docxNewProjectCreateV1.mjs using existing Main manifest authority and project lease; no private Core, bus, registry or generic writer framework.",
    "Existing local DOCX file-picker/preview port, existing canonical project library and open ports."
  ],
  "requiredDesignOsPorts": [
    "Existing command catalog/availability read projection and canonical dispatch bridge; existing DOCX preview modal representation, no new visual zone or shell persistence."
  ],
  "adapterRequirements": "Fixed Main-owned project parent, exclusive new directory, inode/path/lease witnesses, full data readback, real manifest create-CAS last; no directory relocation or old absolute journal rewriting",
  "surfaceManifests": "Existing DOCX import preview modal/controls only; no new visual zone or registry",
  "slotRequirements": "Existing import modal and existing menu/palette command slot",
  "supportedWorkspaces": [
    "WRITE",
    "REVIEW"
  ],
  "platformAvailability": "Existing desktop ports; first source/component proof on macOS, no native or cross-platform acceptance claim",
  "accessibilityRequirements": "Existing focus, keyboard and disabled controls retained; target/refusals/status exposed in text, external data escaped",
  "fallbacks": [
    "Unsupported grammar/structure/revisions/media or lost/malformed source points yield typed refusal before project publication, with original DOCX unchanged. No destination fallback to current project.",
    "No adapter/capability/reference means unavailable; stale async publication refuses. Published project navigation failure never retries import.",
    "Before manifest publication, rollback may remove only this attempt exclusive, witnessed files/empty directories under its live lease; any unknown owner/changed inode remains untouched and readable. A present canonical manifest is never deleted by rollback; uncertain publication is reverified from exact Core output or reported unknown."
  ],
  "stateClasses": [
    "PROJECT_STATE",
    "DERIVED_STATE",
    "TRANSIENT_STATE",
    "AUTHORING_WORKING_STATE"
  ],
  "persistenceClass": "Fresh initialization in existing project format; manifest-last visibility point, existing local notes/comments/scene formats",
  "migrations": "No new project/history schema; existing schema3 noteSourcePoints reused. New candidate source-point descriptor is nonpersistent input data.",
  "recovery": [
    "Literal tiny and15k input independently expected; full Current/Original, root/reply/duplicate occurrence, hidden deletion quote, note reference/body and persisted accept/reject/reopen checked.",
    "Preview and Cancel create no project; malformed/ref-expired/raw plan/path/target/foreign project/capability denied/late context drift refuse without protected-state writes.",
    "Inject failures before manifest and after publication; old project, dirty draft and source bytes unchanged. Exclusive collision, symlink/hardlink/inode replacement and unknown-file controls preserve foreign data.",
    "Same request cannot duplicate a published project; explicit repeat import uses new request/new project identity. Navigation error never becomes a second import.",
    "Existing normal create/open and legacy explicit import/ack behavior retained; test membership/oracles/skips and source-byte barriers unchanged."
  ],
  "rollback": "Revert one coherent PR; imported new projects keep existing project/scene/comment/note formats and existing noteSourcePoints schema. No existing user data, native profiles, old history or protected oracle file is rewritten.",
  "performanceBudget": "First prove complete15k characters, not words, with short <=60s focused commands and minimal synthetic data. Node/component RSS is not whole-app memory; no8GiB allowance or100k/500k-word acceptance. Preserve keyboard/focus and existing modal controls, expose target and refusals in text, escape all external labels. Native/browser app execution remains PAUSED. Runtime source budget900 lines; behavior-test budget1200 lines, excluding generated bundle/mechanical bytes.",
  "securityBoundary": "Existing bounded ZIP/XML/parser and Main envelope/reference limits retained. Core enforces supported insert/delete-in-existing-paragraph profile and note source-point projection; provider native IDs are provenance only. Core never performs filesystem effects. Renderer cannot choose target paths/project IDs or write storage. No dependencies, secrets, runtime network, old trust recovery or privileged boundary expansion.",
  "lifecycle": "Preview without filesystem project -> explicit Create -> fully verified fresh graph -> canonical manifest publication -> separate normal project Open",
  "negativeBypassChecks": [
    "Literal tiny and15k input independently expected; full Current/Original, root/reply/duplicate occurrence, hidden deletion quote, note reference/body and persisted accept/reject/reopen checked.",
    "Preview and Cancel create no project; malformed/ref-expired/raw plan/path/target/foreign project/capability denied/late context drift refuse without protected-state writes.",
    "Inject failures before manifest and after publication; old project, dirty draft and source bytes unchanged. Exclusive collision, symlink/hardlink/inode replacement and unknown-file controls preserve foreign data.",
    "Same request cannot duplicate a published project; explicit repeat import uses new request/new project identity. Navigation error never becomes a second import.",
    "Existing normal create/open and legacy explicit import/ack behavior retained; test membership/oracles/skips and source-byte barriers unchanged."
  ],
  "evidenceBindings": [
    "Exact merged foundation PR2128 and CONTOUR_DELIVERY58.json are component foundation only",
    "FINAL_AFFECTED15.process.json:198/198 maintained affected tests, zero skipped/todo,16.960s. Native picker UI is substituted at its platform boundary; actual local-file preview, Main plan/ref, public command, Main creation, Core and manifest authority execute. No native acceptance credit."
  ],
  "currentReality": [
    "PR2128 fully delivered at M;90 affected contracts and13 C2A rerun on clean merged head; separate comment-only15000-character disk proof passes.",
    "This source branch now routes the existing modal explicitly to a new project; legacy no-target callers retain their current-project API. Actual15000-character chapter, notes plus pending text, discussions/replies, normal fresh/cold Stage10 bootstrap, durable reject/Undo/accept and disk reread pass. Word/native and installed application remain PAUSED/unproved;100k and500k-word stages are not accepted."
  ],
  "integrationMode": "NEW_PORT: ADDS_ONE_EXPLICIT_PORT_AND_ADAPTER"
}
```

## IMPLEMENTATION_STEPS

1. Retain/validate source note points and implement pure fresh-project preparation using existing paragraph, note, comment and identity models.
2. Add one named create-only product port/adapter with existing manifest authority, lease, complete readback and manifest-last publication.
3. Bind the seeded route to existing create and import commands, exact private references, bounded attempt state and typed results.
4. Route the existing import UI explicitly to new-project creation and canonical Open; preserve its layout and no-loss cancellation/navigation behavior.
5. Execute small causal/negative and complete affected tests, refresh native integration companions once, commit/push/PR/full CI/merge, then exact merged checks.

## CHECKS

CHECK_01_PRE_IDENTITY: bootstrap/read order, clean exact M/branch/mounts, fresh remote and architecture declaration02 before this contract/source edit. PRE is never repeated after source edits as a substitute for its original record.
CHECK_02_POST_E0: node scripts/ops-gate.mjs --task docs/tasks/2026-10-17--docx-new-project-15k-public-path.md before product implementation.
CHECK_03_POST_FOCUSED: complete affected maintained contracts and existing UI command/modal unit files from the allowlist. Actual TAP numerator, failures, skipped and todo are recorded; no name-filter exclusions or false-green parser changes.
CHECK_04_POST_OUTCOME: literal tiny and15000-character ordinary DOCX through actual Core/new-directory/manifest authority, protected-state snapshots and fresh disk reopen; comments/replies, full Current/Original text and note bodies/points preserved through supported decisions.
CHECK_05_POST_NEGATIVE: preview/Cancel no project, invalid/raw/stale/foreign refs, unknown targets, injected paths, capability revocation, root collision/swap/symlink/hardlink/unknown file, failures before/after publication, retry and navigation failure.
CHECK_06_POST_INTEGRATION: existing renderer build, native inventory/C2A emission/check, exact source pins and protected files, agent guardrails and OSS policy; no dependency changes.
CHECK_07_POST_DELIVERY: clean commit, push, attached PR, every actual required CI job succeeds on the exact candidate, normal merge and clean exact merged focused/outcome verification. Current CI19-job set is observed from source/run, not presumed20.
CHECK_08_POST_NATIVE_BOUNDARY: no native/installed-app,100k,500k-word or whole-app memory acceptance claimed. No8GiB allowance assumed; no heavy local runs.

SOURCE_OBSERVATIONS:198/198 affected tests passed with0 skipped/todo in16.960s. The15000-character/15007-UTF16 fixture has69 paragraphs, pending insert/delete, three discussions plus one reply and one footnote. Literal Current/Original text, exact duplicate occurrence, hidden-deletion quote, note body/reference, existing durable decisions and fresh/cold runtime reopen passed. Initial preview creates no project; existing saved text and a synthetic unsaved draft remain unchanged. Failure injection covers capability/context changes, collision, foreign/changed files, root swap, symlink/hardlink and uncertain published-manifest retry. The new parser descriptor binds existing schema3 source points; no new durable history. Component process RSS is not whole-app memory and establishes no large-book memory budget. Delivery still requires exact candidate CI, merge and merged checks.

## STOP_CONDITION

Stop for unresolved authority/path/source identity, foreign dirty work, lost lease,
unknown ownership, stale publication, unsupported profile, native pause violation,
protected-source/predicate/skip drift, third identical failure or unmergeable base.
An input refusal is never a successful project creation. Source/data not lost by
failure does not by itself prove the user feature complete.

## REPORT_FORMAT

Use AGENT_FINAL_REPORT_V1 fields and one text block of KEY: VALUE for the owner.
Claims bind exact SHA/build/profile and actual numerator/denominator; only basenames
in the final report. State source/component and native limits explicitly.

## FAIL_PROTOCOL

Retain the exact input, actual process result, seed, SHA and failed output; choose
one next causal hypothesis. Repair short isolated cases, without repeating heavy
book workloads or weakening an oracle. Do not chain mutation after a failed
validation command. No silent rebase, fallback writer, synthetic success or old
native acceptance. Full delivery closes before any next write contour.
