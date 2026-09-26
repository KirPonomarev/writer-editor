# P0a: explicit rejection of unrepresentable Word visibility and Ruby

STATUS: ACTIVE_IMPLEMENTATION
ROLE: TASK_CONTRACT
CLAIM_BOUNDARY: bounded generic-import safety repair; no positive fidelity cells
TASK_ID: WORD_P0A_VISIBILITY_RUBY_20260926
BASE_SHA: 14754f850a389118df18ee50a7f8a48cde408455
TYPE: PRODUCT_CODE
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

Owner directly requested implementation of the revision-3 Word audit plan.
This is its first bounded slice. Execution is personal/solo as directed by the
owner, not the historical orchestrator-only mode in factual documents.

O: generic DOCX import cannot silently expose hidden runs or concatenate Ruby
base and pronunciation into a successful writable candidate.
T: untrusted bytes -> existing bounded package/XML reader -> derived preview
and plan -> existing main admission and Command Kernel -> fenced persistence.
H: parse visibility using the existing style cascade, distinguish vanish toggle
from webHidden replacement, and reject effective hidden runs plus Ruby before
publication. Direct false and unused styles retain supported visible text.
B: source DOCX, private notes, project files, buffers, other WIP, frozen IDs,
R authority, size/depth budgets and old evidence remain protected. No new
document model, UI redesign, dependency, network or schema change.
P: negative reproducer before fix; actual parser/plan and fenced no-write
checks; controls and affected-chain regression; mandatory CI and exact merged
verification. Parser tests do not create native or positive-fidelity claims.
I: exact base above; Node 22.12.0; synthetic owned inputs only.

## FEATURE_INTEGRATION_MANIFEST_V1

featureId: word-import-visibility-ruby-rejection; featureVersion: 1.
Integration mode: EXISTING_SEAM. domainOwner/authoritativeData: existing Core
document and transaction owners. derivedData: validated import preview/plan.
commandIds: cmd.project.docx.previewContent, previewImportPlan, importSafeCreate.
queryIds/productProjectionIds: current immutable content preview/import plan.
eventTypes: existing import outcome; no new event. capabilityIds: existing
generic import; authorityMap: foreign source supplies no local write authority.
identityKeys: project, source hash, revision, generation, admitted plan digest.
revisionPolicy: existing dispatch and precommit checks. writePath: existing
main admission -> Command Kernel -> fenced safe-create. readPath: bounded
bytes -> parser -> immutable diagnostics. requiredProductPorts: existing file
intake/project persistence. requiredDesignOsPorts: existing diagnostics.
adapterRequirements: bounded offline bytes; surfaceManifests/slotRequirements:
not applicable, existing error surface unchanged. supportedWorkspaces: existing
import entrypoint. platformAvailability: existing supported runtime; native
claims need independent profile-specific proof. accessibilityRequirements:
existing diagnostic presentation. fallbacks: typed rejection before writes.
stateClasses: DERIVED_STATE; PROJECT_STATE and AUTHORING_WORKING_STATE protected.
persistenceClass/migrations: no format change. recovery: rejected input has no
write; existing recovery preserved. rollback: revert this bounded PR.
performanceBudget: current package/XML/style/run limits; no typing-path work.
securityBoundary: namespace/attribute validation before interpretation.
lifecycle: intake -> reject/preview -> existing explicit import lifecycle.
negativeBypassChecks: malformed/spoofed props, inheritance, rejected plan write,
stale source and admission gates. evidenceBindings: exact SHA plus input/test
hashes. currentReality: hidden/Ruby loss reproduced on base; full editable
support remains future P3-09, not a claim of this repair.

## CHECK and delivery

CHECK_01 runs before repository changes: bootstrap, source identity, declaration
and clean target. CHECK_02+ run after changes: targeted and affected checks,
guardrails, required delivery and merged-head revalidation. One contour,
one rollback, commit/push/PR/CI/merge required before next slice.

DENYLIST: dependency and lock changes; unrelated product state; UI design;
new runtime authority; altered denominators; fabricated native evidence.

References: Microsoft Open XML Vanish and WebHidden semantics; vanish is a
style toggle, webHidden is an independently inherited web-view property.
https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.vanish
https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.webhidden
