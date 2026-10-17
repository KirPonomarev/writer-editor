# Million-character DOCX import hardening

TASK_ID: YALKEN_DOCX_MILLION_HARDENING_20261018
TYPE: CORE
DOCUMENT_CLASS: PROCESS
STATUS: IMPLEMENTATION_AND_QUALIFICATION
CLAIM_BOUNDARY: One DOCX creates a new project. No roundtrip merge, universal DOCX compatibility or fresh Google editorial export claim.
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
ACTIVE_EXECUTION_CANON: v3.13a-final
BINDING_BASE_SHA: fa475b6ffd0e3136ef39f3de8d8b05dd44f339c0
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_HEAD_VERIFICATION_REQUIRED=true
ROLE: Sole direct coding agent; no delegation or second writer.
DESIGN_TOOL_ROUTER: NOT_APPLICABLE; existing importer diagnostics only.

## Outcome and scope

An unchanged Word-saved manuscript must not be refused merely because Word omits zero-valued attributes on a `nil` comment border or splits identically formatted complex-script text into many runs. Existing manuscript admission, strict return semantics, limits and fenced creation remain authoritative.

O: Preserve literal Current/Original text, comments and supported pending insertions/deletions through import, decisions, durable save and reopen.
T: Immutable DOCX -> bounded validation -> private Main preview/plan -> pure Core preparation -> existing create port -> manifest-last publication.
H: Actual Word outputs reproduced an omitted-attribute refusal; 222,524 effective formatting runs in the complex-script case exhausted the 16 MiB analysis output budget. The comment wrapper hid the resource reason.
B: No dependency, quota, authority, file-format, writer, schema or renderer redesign; no old project/profile, SOURCE80 or original fixture mutation.
P: Small failing regressions first; positive and hostile variants; existing public-command and durable-readback harness; affected million-character files; required CI and exact merged build checks.
I: Registered canonical checkout remains owner-facing. Implementation uses its verified linked worktree on encrypted T7-Secure. Evidence and final artifacts use dated T777 folders; temporary APFS profiles require ownership markers.

CHECK_01 executes before changes: mount/registry, clean exact source, architecture declaration and preflight. CHECK_02+ execute after changes. The follow-on responsiveness declaration binds committed importer checkpoint 75747f2042e8da60d94521575ddcf90a469e4ff2. A premature dirty-worktree preflight was rejected; no guard was bypassed.

## Changes and invariants

- Only the explicit manuscript profile accepts omitted `space`/`sz` on `val="nil"`. Explicit empty/nonzero values, active borders, duplicate edges, foreign attributes/elements and child content remain rejected.
- Every formatting run is parsed and validated. Adjacent runs coalesce only if all semantic fields match and offsets are contiguous. Coalesced provenance identifies the containing paragraph. Strict/default return scanning retains per-run provenance and output.
- Budget refusals remain refusals and report a resource limit, with bounded numeric evidence when available. No quota is raised.
- The ZIP Buffer is excluded before cloning parser metadata. Pure preparation avoids comparing unchanged content to itself and avoids allocating a codepoint array just to count characters.
- Pure preparation exposes internal checkpoints between scenes; the existing create adapter captures a private input snapshot before its first await, yields the event loop and revalidates publication authority between checkpoints. The synchronous API drains the same steps. No partial project or write authority is emitted by a checkpoint.
- Filesystem ownership checks, complete readback, lease fencing, manifest create-CAS, rollback and existing publication boundary are unchanged.

## Integration contract

FEATURE_INTEGRATION_MANIFEST_V1
- featureId: docx.import.new-project.v1.hardening; featureVersion:1; integrationMode:EXISTING_SEAM.
- domainOwner: Existing Product Core document/pending/comment/note models.
- authoritativeData: Source artifact is immutable; only a completely published fresh project becomes canonical.
- derivedData: Content preview, source/context-bound plan, formatting spans and preparation model.
- commandIds: Existing cmd.project.importDocxV1, cmd.project.docx.previewLocalFile, cmd.project.docx.previewImportPlan and cmd.project.lifecycle.create/open.
- eventTypes: Existing project/document lifecycle events.
- queryIds: Existing query.projectTree and query.reviewSurface.
- productProjectionIds: Existing import preview and review projections.
- capabilityIds: Existing import and lifecycle capabilities, checked again after preparation yields.
- authorityMap: Direct owner requested hardening and autonomous completion; bounded tests and installation use owned fixtures/profiles only.
- identityKeys: Source SHA, private reference/context, project/entity/revision/generation, source/build SHA and owned profile.
- revisionPolicy: Fresh project only; source snapshot cannot change between asynchronous checkpoints.
- writePath: Kernel -> Main -> Core -> existing ProjectPersistencePort.createFromDocx -> owned exclusive files -> complete readback -> manifest-last fenced publication.
- readPath: Bounded immutable preview and canonical persisted project readback.
- recoveryPolicy: Existing manifest visibility, ownership-aware rollback and cold reopen. No new recovery trust or durable undo contract.
- platformPolicy: Pure Core; Node scheduling only in existing product adapter. No browser API or new network.

## Evidence and limits

Dated external evidence roots: `/Volumes/T777/Yalken/Отчёты о работе/2026-10-18--docx-hardening` and `/Volumes/T777/Yalken/Новые материалы/2026-10-18--docx-hardening`.

Initial importer checkpoint: 77 focused tests passed, including six regressions that failed on the base. Four unchanged Word-saved million-codepoint multilingual files passed full public-command creation, all comment anchors, Current/Original text, reject/undo/accept/undo/mixed decisions and cold-process readback. The actual fresh Google native export passed complete text creation and reopen; it contains no comments or suggestions. These are component/command proofs, distinct from installed native UI evidence.

The languages cover Cyrillic/Latin/Greek, Arabic/Hebrew/Persian, Chinese/Japanese/Korean, Hindi/Bengali/Thai/Khmer, combining marks and emoji. Repeated test prose is a controlled stress corpus, not proof of every real book. A million means Unicode codepoints, not words. Million-scale notes/replies and fresh Google editorial exports are not claimed; existing small composite checks cover notes/replies.

Follow-on responsiveness, full required CI, exact merged verification and installed-app results must be read from their actual receipts. No timing threshold is waived by this document. Revert the bounded PR to undo the implementation; the installer retains a verified previous app archive. Preserve historical approvals and protected hashes; companion changes bind exact new bytes only, without altering verifier predicates, test membership or previous acceptance claims.

## Maintained-suite I/O follow-up

The local full graph stopped with `RTK_GRAPH_NO_PROGRESS_TIMEOUT` after 1,293 passing cases; it is not a completed baseline. Read-only replay identified approximately 110,560 Git blob reads in one existing test's 196 corruption checks across 177 historical binding sets. That test now retains binary blobs addressed by a complete immutable commit SHA and path within the test invocation, returning independent buffer copies. Corruption wrappers still execute above these reads. Mutable refs, ancestry, failures and verifier results are never cached; production verification and every negative assertion remain unchanged. Declaration `YALKEN_DOCX_HARDENING_TEST_IO_20261018` binds clean checkpoint 9920c9d490fca36438e0224d4433b32b949dac91 within the same delivery. No timeout, membership or evidence requirement is relaxed.
