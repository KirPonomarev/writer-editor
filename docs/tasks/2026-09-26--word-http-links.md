# P1a: external HTTP(S) hyperlinks through the Word chain

TASK_ID: WORD_P1A_HTTP_LINKS_20260926
BASE_SHA: 396938247b5480dc24d4c5d4d01b744a6dc13e82
STATUS: TARGET_IMPLEMENTATION_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: APPLICABLE_LAZYWEB_FIRST

Owner directly authorized personal implementation of the revision-3 Word plan.
P0a is delivered by PR 2001. This slice has one rollback and one delivery chain.

O: external HTTP(S) label/target survive native generic import, existing editor
authoring, save/new-process reopen, generic export, Word edit and authenticated
review preview/Apply. Test element and bounded HYPERLINK field serialization.
T: bounded foreign package -> immutable projection -> existing main admission
and Command Kernel -> existing canonical rich document transaction. Returned
content requires the locally authenticated export map and exact revision.
H: carry a validated inert href on the existing link mark and through the
existing formatting action, instead of flattening it or creating another writer.
B: source files, canonical projects, unsaved buffers, private data, other WIP,
existing frozen IDs, budgets, journal/recovery and all authority guards remain.
P: independently specified label/target graphs, real parser/export regression,
stale/replay/no-write negatives, native Word and SOURCE/PACKAGED routes, five
alternating exchanges, mandatory CI and exact merged-head verification.
I: base above, exact Node 22.12.0/npm 10.9.0, owned synthetic documents only.

## FEATURE_INTEGRATION_MANIFEST_V1

featureId: word-http-links; featureVersion: 1; integrationMode: EXISTING_SEAM.
productPlane: Core owns canonical rich link marks and transaction history.
interfacePlane: existing editor/review projections and modal tokens; native
link address dialog repairs the existing command input seam.
domainOwner/authoritativeData: existing document Core; no retained XML truth.
derivedData: bounded foreign href/range projections and review candidates.
commandIds: cmd.project.docx.previewContent, cmd.project.docx.previewImportPlan,
cmd.project.docx.importSafeCreate, cmd.project.insert.linkPrompt,
cmd.project.save, cmd.project.review.exportDocxReviewPacket,
cmd.project.review.activateDocxReviewPreviewSession,
cmd.rtk.review.applyMultiSceneFormattingReturn, existing tracked-text Apply.
queryIds/productProjectionIds: existing import and review immutable projections.
eventTypes: existing document/import/review outcomes; no new event bus.
capabilityIds/authorityMap: existing project import/editor/review capabilities;
foreign relationships and URLs confer no filesystem, network or write authority.
identityKeys: project, source SHA, export-map identity, scene/block, source
revision, generation and operation digest. revisionPolicy: existing dispatch
and precommit revalidation. writePath: admitted command -> guarded transaction.
readPath: bounded ZIP/XML -> semantic projection -> authenticated correspondence.
requiredProductPorts: existing file intake, export and persistence adapters.
requiredDesignOsPorts: existing editor/review read-only projections.
adapterRequirements: offline bounded bytes, exact native process/document.
surfaceManifests/slotRequirements: bounded native link dialog described below. supportedWorkspaces: existing
WRITE/REVIEW commands. platformAvailability: qualify SOURCE/PACKAGED separately;
native Word for Mac proof does not certify Windows or arbitrary Word versions.
accessibilityRequirements: existing link command and review surface retained.
fallbacks: unsupported field/scheme/ambiguous correspondence is explicit,
never silent flattening or partial successful acceptance.
stateClasses: PROJECT_STATE and AUTHORING_WORKING_STATE; derived previews.
persistenceClass/migrations: existing link marks; no new project schema.
recovery: existing journal and stale/replay checks. rollback: revert bounded PR.
performanceBudget: existing ZIP/XML/run bounds; bounded href and field grammar.
securityBoundary: namespace/relationship validation before href interpretation;
never fetch, execute or follow imported targets. lifecycle: preview -> explicit
import/Apply -> save -> reopen; derived output supplies no mutation authority.
negativeBypassChecks: unsafe schemes, duplicate/missing/spoofed relationships,
stale/replayed source, grapheme/range mismatch, no-write on reject.
evidenceBindings: exact SHA and independent input/output/oracle hashes.
baseReality: the editor already had link marks; generic import/export dropped
their target and review lacked href-delta application. Candidate implementation
repairs these paths; delivery and exact merged qualification remain required.

## Closed profile and acceptance boundary

Positive profile: external HTTP(S) link label and target, create/change/remove,
split runs, Unicode/graphemes and declared adjacent formatting. Element and
bounded non-nested HYPERLINK field forms must be covered. Internal bookmarks,
tooltip/frame semantics and arbitrary field evaluation remain explicit gaps.
Do not strip a native Hyperlink style or trust its cached theme color to obtain
a passing fixture. Native cases need effective formatting to remain accounted
for. Each source occurrence must resolve to one exact link range.

Existing 420/1120 IDs and policy stay frozen. Partial G or parser evidence gives
zero new complete bidirectional cases. A positive claim requires all declared
hops and independent full label/target comparison; positive and negative
denominators are separate. Completion requires commit/push/PR/CI/merge and
exact merged verification, with no open blocking finding for this profile.

## Bounded link command surface

The declared Cmd/Ctrl+K was not dispatched by the global key handler. The
existing input used synchronous window.prompt. Replace that input only;
preserve the command registry, canonical link marks, persistence and tokens.
The address is transient input, never product authority. The command checks
captured project/document/content/generation and capability after awaiting it.
An incoming document cancels the dialog, including reload/ABA cases.

SURFACE_MANIFEST_V1:
- surfaceId: word-link-address; surfaceKind: native modal dialog.
- featureId: word-http-links; allowedPostures: existing WRITE editor.
- allowedTransforms: fit existing viewport; slotMap: title, address, error, actions.
- platformAvailability: existing Electron renderer and browser dialog API.
- fallbackSurface: cancellation on lifecycle invalidation; no prompt fallback.
- designBindings: existing modal classes and card/foreground/control tokens.
- projectionAdapter: editor formatting and selected range, read only.
- inputIntents: accept, remove, cancel; commandRepresentations: existing
  cmd.project.insert.linkPrompt via toolbar, menu/palette and Cmd/Ctrl+K.
- contextRequirements: current editable Tiptap document and selected/link range.
- readProjectionIds: existing editor formatting state and selection offsets.
- stateOwnership: transient address; AUTHORING_WORKING_STATE remains editor owned.
- interactionStates: initial, invalid address, accepted, removed, cancelled,
  stale document, capability denied; no network resolution or URL opening.
- accessibilityContract: native modal top layer, labelled address, initial focus,
  focus containment/restoration, Enter, Escape and inline live error.
- responsiveContract: bounded width/height with scrolling, existing typography.
- performanceClass: one dialog and snapshots on invocation/acceptance only.
- evidenceBindings: actual async-handler race/capability tests plus exact-build
  native keyboard authoring, pending until physical proof and delivery complete.

UI evidence: ui-craft and Lazyweb consulted; bounded ClickUp editing-toolbar
reference only, not a new design language or a claim about its link dialog.
Lazyweb search: 6995d7b2-23e5-4315-9b83-eb1a74d088d8.
No new dependency, cloud runtime, global style or renderer structure change.

## Native findings and bounded repairs

Word 16.112 Mac physically rewrites links into complex HYPERLINK fields, moves
paragraph bookmark starts to the immediately preceding body position, and may
move a 12pt run size into docDefaults. The parser admits only namespace-exact,
unique start/end pairs for the immediately following paragraph. Default size
resolution is bounded: unknown inheritance never becomes guessed formatting.
Both the standalone scanner and the verified evidence-packet path consume the
same validated styles and relationships. Full Word style support remains P3.

The scene return path now extracts paragraph text from the rich document
projection while retaining the full original raw hash for revision guards. A
locally authenticated scene export map may prepare formatting-only review;
the foreign DOCX cannot provide that map or write authority. The main command
still rejects caller operations, dirty buffers, stale scene hashes and replay.

PACKAGED WRITER_LOCAL_V1 previously allowed review export/intake and text Apply,
but rejected the formatting Apply command. Owner authorization to implement
this Word plan covers admitting this one existing guarded command. No optional
system, cloud, signing, distribution or general review capability is enabled.
The source profile, capability revalidation and transaction writer are unchanged.

## Evidence boundary during implementation

On cb08c8b2 SOURCE completed five real native Word hyperlink target changes,
with authenticated main preview/Apply and independent saved rich-run comparison
after every cycle. New-process reopen preserved the fifth result. Earlier
failed experiments remain evidence of defects, not accepted cycles.
The packaged import and native Yalken create/change/remove/label edits worked;
its first Apply found the profile denial described above. The repair requires a
fresh packaged build and fresh signed exports before claiming this route.

The round-key vault currently survives only within a main-process session.
Export-before-restart then return-after-restart is blocked with missing local
secret; no fallback reconstructs authority from the foreign artifact. This is
an explicit durability gap for the subsequent round lifecycle work, not a
successful cross-restart return. Reopen of already applied content is tested
separately. Historical 420 and global 1120 coverage are not recalculated here.

Further native proof: on 95a92643 PACKAGED completed the same five target-change
cycles and new-process reopen with the exact same canonical output hashes as
SOURCE. Native Word deletion then removed only the selected link. On c31476ea
native Word creation (character style inherited from Default Paragraph Font,
Hyperlink theme RGB and underline) was authenticated and applied to exactly
characters 0..10; neighboring labels, spaces, targets and formatting survived.
Unresolved styles are surfaced as explicit review diagnostics, never a guessed
RGB or a generic empty review. Style inheritance is cached per parse, not on
keystrokes. These receipts do not by themselves complete the full P1a matrix.
