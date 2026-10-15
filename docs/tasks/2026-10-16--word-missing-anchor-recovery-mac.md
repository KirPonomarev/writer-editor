# Explicit missing-anchor recovery for a preserved Word novel

TASK_ID: WORD_MISSING_ANCHOR_RECOVERY_MAC_20261016
PARENT_TASK_ID: YALKEN_MAC_WORD_FINISH_V4_1_20261013
STATUS: CANDIDATE_SOURCE_VERIFIED_DELIVERY_PENDING
DOCUMENT_CLASS: PROCESS
CLAIM_BOUNDARY: new local integrity root only; original trust and lost Word export secrets are never reconstructed
TYPE: CORE
MODE: HARD_TZ
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
BINDING_BASE_SHA: 4d477f143b8ed17f896fcd27a3e6065c6eebab60
OWNER_AUTHORITY: direct human recovery-contract decision verified in original coordinator-thread user message; sole product writer; coordinator alone owns native execution
DESIGN_TOOL_ROUTER: OUT_OF_SCOPE_CORE_ONLY
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_HEAD_VERIFICATION_REQUIRED=true

## MICRO_GOAL

O: The original retained SOURCE80 can explicitly establish new trust, preserving
all old files, raw session, authority and history. Ordinary reopen then works.
T: Main read-only selected binding -> existing Kernel recovery command -> raw
schema/receipt/full production replay and strict Core snapshot -> native Cancel-
default consent -> fresh selection, snapshot, pair and missing-artifact CAS
under the existing shared project lease -> exclusive durable anchor publication.
H: A distinct versioned recovery root removes the missing-anchor blocker without
fabricating an old predecessor, rewriting history or weakening ordinary reopen.
B: All69 retained SOURCE80 files, old keys/rounds, private/deleted data, current
profiles and anchors remain protected. No native launch or restore in this task.
P: Causal RED, real tiny APFS persistence, strict Core snapshot, Cancel at actual
startup, schema/replay/corruption/stale/foreign/race/crash negatives, ordinary
commit/reopen and existing affected suites, full official CI and merged proof.
I: Clean registered W10 starts at M8 above. Native SOURCE80 identity and storage
are independently owned by the coordinator; no new profile or image here.

## ARTIFACT

One bounded vertical slice with one rollback. Runtime budget500 changed lines,
maintained tests450 lines. No general recovery framework or alternate writer.
New materials/evidence: verified T777 dated2026-10-16 word-missing-anchor-recovery-
mac folders. Disposable tiny CLI fixtures require APFS and use only the declared
T7-Secure runtime f8-missing-anchor-recovery. They are not acceptance profiles.
No large novel copies. Existing original69 and frozen Word inputs are read-only.

## ALLOWLIST

- src/product/stage10IntegrityAnchor.mjs
- src/product/stage10ProductWiring.mjs
- src/product/stage10MainPersistenceAdapter.mjs
- src/core/project-transaction-v1.cjs
- src/command/commandSurfaceKernel.js
- src/main.js
- test/contracts/rtk-word-missing-anchor-recovery.contract.test.js
- test/contracts/yalken-atlas-v5-stage10-pr1391-audit-repair.contract.test.js
- docs/tasks/2026-10-16--word-missing-anchor-recovery-mac.md
- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/WORKLOG.md
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/post-audit-certification-set.mjs

- test/contracts/donor-port-command-surface-kernel.contract.test.js
- test/contracts/b2c09-command-surface-kernel.contract.test.js
- scripts/ops/b2c09-command-surface-kernel.mjs

- test/unit/r24-wp302-session-continuity.test.mjs

## DENYLIST

All other paths; renderer, preload, unrelated Main flows, dependencies, native
builds/launches, restored profiles, old anchors, authority and history rewrites,
old key regeneration, quota/heap/deadline relaxation, weakened tests, private bus,
reset/stash/clean/rebase/force push and deletion of foreign state.

## CONTRACT / SHAPES

FEATURE_INTEGRATION_MANIFEST_V1:
featureId=WORD_MISSING_ANCHOR_RECOVERY; featureVersion=1;
domainOwner=Product Core; authoritativeData=raw preserved pair and v2 integrity
anchor with explicit recoveryRoot provenance; derivedData=strict recovery
eligibility and canonical snapshot digest; commandIds=cmd.project.recoverMissingIntegrityAnchor;
eventTypes=integrity root publication receipt; queryIds=missing-only eligibility,
Core verified recovery snapshot; productProjectionIds=immutable eligibility;
capabilityIds=Main local selected-project recovery; authorityMap=Core validation,
Kernel entry, native consent adapter, existing persistence/shared lease;
identityKeys=projectId, absolute root, raw pair digests, snapshot digest, lease;
revisionPolicy=fresh checks after consent and under lease;
writePath=existing Stage10 adapter exclusive anchor creation;
readPath=read-only raw pair and Core novel cohort;
requiredProductPorts=existing Stage10 persistence, Main manifest authority,
project lease and native dialog, strict Core recovery snapshot query;
requiredDesignOsPorts=OUT_OF_SCOPE_CORE_ONLY no renderer surface;
adapterRequirements=physical lstat absence, no symlink, atomic no-clobber fsync;
surfaceManifests=OUT_OF_SCOPE_CORE_ONLY existing native confirmation only;
slotRequirements=OUT_OF_SCOPE_CORE_ONLY no DOM; supportedWorkspaces=local startup;
platformAvailability=desktop native adapter; accessibilityRequirements=native
keyboard confirmation, Cancel default; fallbacks=normal fail-closed refusal;
stateClasses=PROJECT_STATE, DERIVED_STATE, TRANSIENT_STATE;
persistenceClass=one new anchor file, original pair untouched;
migrations=v1 remains unchanged; v2 explicit new trust at original generation,
provenance retained on all later normal commits and pending recovery;
recovery=atomic publication followed by normal validated reopen; rollback=normal
PR revert, v2 downgrade refused, preserve recovery artifacts;
performanceBudget=outside typing, existing payload budgets, bounded project
snapshot <=2048 files, <=256 directories, depth16 and <=512MiB observed bytes;
securityBoundary=no renderer path/boolean authority, strict raw validation before
normalization; lifecycle=local missing-only explicit consent;
negativeBypassChecks=Cancel, malformed/null/false/present/symlink anchor, leftover
previous/pending/legacy trust, raw schema/replay corruptions, foreign/stale pair,
project/snapshot drift, expired lease, EEXIST race and publication interruption;
evidenceBindings=maintained real writer tests and unchanged mandatory TAP gate;
currentReality=SOURCE80 raw pair replays but external original anchor is lost.
Integration mode: EXISTING_SEAM. No speculative registry or new command bus.

## IMPLEMENTATION_STEPS

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
CHECK_01_PRE_IDENTITY: canonical registry, mounts, clean exactM8, bootstrap,
full startup reads, owner authority, declaration/preflight and scoped branch.
CHECK_02_POST_RED: normal missing-anchor reopen refuses; explicit recovery absent.
CHECK_03_POST_FIX: v2 honest root, strict raw validation, complete Core snapshot,
Kernel native consent and shared-lease exclusive publication.
CHECK_04_POST_PROOF: meaningful complete positive, boundary and race/recovery
negatives; existing Stage10/Core/command and Word affected chains on both engines.
CHECK_05_POST_DELIVERY: byte companions, inventory, guardrails, OSS/audit,
commit/push/PR/required CI/normal merge and fresh exact merged checks.

## CHECKS

CHECK_01_PRE_IDENTITY: declared exact base and preflight before first repo edit.
CHECK_02_POST_PROOF: real APFS tests with explicit TAP and unchanged mandatory
RTK evaluator; no skipped/todo native acceptance substitution.
CHECK_03_POST_DELIVERY: full required CI and exact merged evidence.

Acceptance and rollback:

Original pair is byte-exact after recovery. Present invalid trust is never
replaced. Cancel runs before project migration/structure/recovery writers.
A committed root preserves original generation and explicitly new provenance;
normal commits and pending recovery carry it forward without false predecessor.
A crash before publication leaves missing trust; after publication normal reopen
resolves the same root. Whole-feature readiness and actual SOURCE80 restoration,
GUI consent, Quit/reopen, roles and genuine Word exchanges belong to coordinator.
Old Word export keys remain LOST and old authenticated documents may refuse.
Rollback: revert the single PR, retain all data and v2 provenance, refuse downgrade.

## STOP_CONDITION

Stop on authority/base ambiguity, foreign WIP, scope drift, invalid gate, third
identical failure or broken delivery; preserve all original data and failures.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1 exact schema; CODEX_OUTPUT_POLICY one text block with
KEY: VALUE, basenames only, no slash paths or URLs; precise scope and counts.

## FAIL_PROTOCOL

Record expected, actual, exact source SHA, seed and digests; no silent fallback,
skips or self-PASS. Diagnose one causal hypothesis before another attempt.

Same-slice integration after clean checkpoint5402 and expanded preflight12:
the maintained donor allowlist includes the new Main-only recovery command.
The pre-existing B2C09 detector failed already on M8 because it required legacy
direct ipcMain.handle while production uses guardedProtocolHandle. Its corrected
check binds the actual guarded IPC block, envelope validation before interpretation,
route and command allowlist; maintained remove/reorder controls reject each bypass.
No command boundary, renderer allowlist or proof requirement is weakened.
Raw recovered pair must use its existing owned writer pretty-JSON wire form;
this rejects duplicate keys/alternate spellings rather than normalizing them.
The actual original SOURCE80 pair satisfies that form byte-for-byte.
Recovery performs two complete snapshots: preparation before consent, then fresh
post-consent validation under the shared lease after candidate temp creation.
Selection/capability is checked again inside publication immediately after the
final snapshot. There is no cross-invocation Core cache or skipped verification.

Final source checkpoints:5402 then7a32 within the same contour. Final complete
Node14 and shipped15 chains pass204of204 each, mandatory0, no fail/cancel/skip/todo
and stable source bytes. Actual fresh-child SIGKILL retry/reopen preserves old
orphan candidates and every project byte. SOURCE69_READONLY07 proves exact frozen
69-file/252527670-byte original roster before/after,21scenes and3retained packets,
without profile restoration or native credit. Independent stdlib18 checks actual
shipped tiny raw pair/root and two normal commit links, rejects8corruptions.
Normal required CI, merge and exact merged verification remain pending.

PR2123 candidate5f057 required inventory CI38810239584 exposed two maintained
WP302 VM initializeApp extractors missing the new startup seam. Raw failing job
116681349320 and local whole-file RED42 reproduce both ReferenceErrors. Clean
same-slice preflight41 admits only the additional unit harness path; product
runtime remains byte-exact. Harnesses now record the actual recovery-before-
migration/directory/journal/tree/Stage10 order and explicitly reject integrity
refusal before any writer or window/autosave/last-file continuation. No noop,
skip or relaxed assertion is used. Every initializeApp source consumer is checked;
whole affected files execute on both engines before one amended delivery push.
The old CI failure remains unaccepted; other full jobs finish before resubmission.
