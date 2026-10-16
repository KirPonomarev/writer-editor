# Ordinary DOCX comments on pending deleted text

TASK_ID: YALKEN_DOCX_DELETED_COMMENT_ANCHOR_20261017
DOCUMENT_CLASS: PROCESS
STATUS: COMPONENT_IMPLEMENTATION_COMPLETE_DELIVERY_PENDING
BINDING_BASE_SHA: a0bdc05ba04e047fbe80b98a1775a57babc06db9
OWNER_AUTHORITY: Direct owner instruction to start the one-way DOCX-to-new-project feature; preserve text, comment anchors and supported revisions. No new durable undo or heavy runs.
DESIGN_TOOL_ROUTER: NOT_APPLICABLE; existing rail data-label correction only, no composition, control, style or flow change.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_HEAD_VERIFICATION_REQUIRED=true

One coherent delta: an imported comment whose source interval is entirely hidden
by a pending deletion keeps the existing union locator and receives a visible
point anchor. Its quote is derived from the canonical ledger. Rejection restores
the interval exactly; existing decision history restores the point on Undo.
Adjacent deletions and genuine point boundaries use the same occurrence geometry.
Manually deleted discussions remain deleted; consumed insertion comments keep the
existing tombstone law and messages. No new schema, durable history or dependency.

The original independent fixture is literal OOXML, not a product export or a
signed return. Expected text, replies and UTF-16 positions were written before
the importer ran. A source-only guard removal was tested and rejected because
rejectAll produced PENDING_COMMENT_LOCATOR_ENDPOINT. The full fixture also found
NOTE_PENDING_IMPORT_REQUIRES_AUTHENTICATED_RETURN; that separate gap is retained.
The real disk-backed import/decision test explicitly uses the comment-only
variant. No footnote-plus-pending publication is claimed.

Observed: 83/83 affected contracts, zero skipped/todo; renderer/preload build,
OSS policy, agent guardrails and npm audit completed (zero vulnerabilities).
The component transaction uses the real Main manifest authority and verifies
scene, comment state and manifest readback. This is not native app/Word evidence.
No15k,100k or book-size acceptance, new-project UI completion, old roundtrip
progress or previous native evidence is promoted by this change.

CI initially rejected an extra standalone contract file; all nine cases now
belong to the existing maintained generic-comment contract. Existing exact-byte
integration companions are refreshed without changing their predicates, old
approvals, protected files, membership denominator or skip classifications.
Revert this one PR atomically for rollback. Artifacts/process logs are in the
2026-10-17--docx-new-project-tiny-import task folders on the owner-selected T777.
Temporary synthetic projects only use the separately declared macOS TMPDIR.

FEATURE_INTEGRATION_MANIFEST_V1 (contract only; no runtime registry):

```json
{
  "featureId": "docx.import.deleted-comment-anchor",
  "featureVersion": 1,
  "domainOwner": "Product Core pending ledger/comment geometry",
  "authoritativeData": "Canonical union source/revision ledger and scoped imported comment state",
  "derivedData": "Visible anchor and hidden-deletion quote; never new project truth",
  "commandIds": [
    "cmd.project.importDocxV1",
    "Existing pending review decision command"
  ],
  "eventTypes": [
    "Existing import receipt and comment/revision save events; no new event type"
  ],
  "queryIds": [
    "Existing workspace review surface query"
  ],
  "productProjectionIds": [
    "commentAuthoring expectedSceneSha256/expectedStateSha256/subjectId"
  ],
  "capabilityIds": [
    "Existing import and pending review availability"
  ],
  "authorityMap": "EXISTING_SEAM only: import admitted create-only plan through Core real authority; pending decision law maps exact union intervals and production transaction independently recomputes. Main synchronous quote query exposes derived data only; renderer renders immutable text and emits existing commands. Component tests are not native acceptance.",
  "identityKeys": [
    "Exact clean worktree H and fresh verified origin/main; source files hashed before/after.",
    "Verified encrypted unlocked writable T7 UUID D1F2E2C1-3210-4A39-A4E0-0AA0AD5110E2; T777 UUID F2FA9AE0-0081-3FC3-BF56-CC4280D16513 before writes.",
    "Fresh synthetic project roots/IDs only; unchanged source DOCX hash; local identity minted by existing import.",
    "No application launch, Word mutation, external service, large document or accepted memory allowance in this contour.",
    "New clean linked worktree bound to H, no prior frozen W mutation. Fresh remote main H before edit. Source DOCX hash pinned796093baf899f924a0e9f401cbc9c241144931a96beecab71e20655a2641fabf."
  ],
  "revisionPolicy": "Exact same union source/revision definitions, geometry hash and visible anchor before decisions. No quote matching.",
  "writePath": "Existing admitted importer -> real manifest authority -> Core transaction -> atomic scene/comment/manifest",
  "readPath": "Canonical saved scene + comments -> Core validated union quote -> Main projection -> existing rail escaped label",
  "requiredProductPorts": [
    "Existing DOCX local file read/preview adapter and Core project persistence/real Main manifest authority; isolated fixture filesystem only."
  ],
  "requiredDesignOsPorts": [
    "Existing public command/projection contracts read-only; no live UI execution in this component proof."
  ],
  "adapterRequirements": "Existing local DOCX and persistence adapters unchanged",
  "surfaceManifests": "NOT_APPLICABLE: no new visual zone or interaction",
  "slotRequirements": "Existing comment rail quote text only",
  "supportedWorkspaces": [
    "WRITE",
    "REVIEW"
  ],
  "platformAvailability": "Existing desktop offline import; component proof on macOS only",
  "accessibilityRequirements": "Quote and hidden/accepted deletion described in text, escaped, existing layout and controls",
  "fallbacks": [
    "Retain every failed case and exact input; fail closed on unsupported or missing semantic field.",
    "No raw restore/reseed of existing data and no tolerance that silently discards source content."
  ],
  "stateClasses": [
    "PROJECT_STATE",
    "DERIVED_STATE"
  ],
  "persistenceClass": "Existing atomic scene/comment state with unchanged schema",
  "migrations": "NONE: existing point+pendingUnionLocator canonical shape",
  "recovery": [
    "Tiny literal DOCX preview fail-before; after fix real safe-create with manifest lease/CAS, re-read comments and text; reject/accept and existing undo/redo preserve comments/quote/occurrence.",
    "Forged geometry and source quote mismatch reject; comment point on duplicate text cannot relocate by quote search. Source bytes unchanged. Existing manual tombstone never revived.",
    "Typed refusal for remaining unsupported pending endpoints, zero writes before input validation. No new long-lived undo after restart."
  ],
  "rollback": "Revert one coherent PR. Existing state schema and prior project formats unchanged; imported point+locator already valid canonical representation. Preserve literal original fixture and failed evidence. No reset/stash/cleanup user data.",
  "performanceBudget": "Tiny synthetic cases only,60sec each. Restore union anchor only for fixed-ledger point during one exact decision group; no per-keystroke worker or whole-book loop added. Quote/status escaped in existing rail; no colors-only state or new interactive affordance. No book performance claim.",
  "securityBoundary": "All DOCX bytes untrusted; existing ZIP/XML budgets and schema validation retained. No YRTK signed round/key/export requirement for ordinary fresh import. No dependencies, secret reads, network runtime or real private data.",
  "lifecycle": "Imported fresh identity -> pending deletion comment point -> rejected deletion exact range; accepted deletion hidden quote remains ledger-owned; existing history only",
  "negativeBypassChecks": [
    "Tiny literal DOCX preview fail-before; after fix real safe-create with manifest lease/CAS, re-read comments and text; reject/accept and existing undo/redo preserve comments/quote/occurrence.",
    "Forged geometry and source quote mismatch reject; comment point on duplicate text cannot relocate by quote search. Source bytes unchanged. Existing manual tombstone never revived.",
    "Typed refusal for remaining unsupported pending endpoints, zero writes before input validation. No new long-lived undo after restart."
  ],
  "evidenceBindings": [
    "AFFECTED_MAINTAINED19.process.json: actual83/83, zero skip/todo",
    "Hand-authored docx-pending-deleted-comment-import.docx SHA256796093baf899f924a0e9f401cbc9c241144931a96beecab71e20655a2641fabf",
    "No native or whole-book acceptance"
  ],
  "currentReality": [
    "Existing generic preview imports deletion-only comment using existing source locator. Exact rejection and saved Undo/Redo tested.",
    "Full fixture note-plus-pending materialization remains blocked; comment-only variant verified through real lease/CAS/transaction/readback.",
    "Public DOCX-to-new-project lifecycle and all15k/100k/book scale stages remain unproved."
  ],
  "schemaVersion": "FEATURE_INTEGRATION_MANIFEST_V1",
  "integrationMode": "EXISTING_SEAM: BOUND_TO_CURRENT_APPROVED_ENTRYPOINTS"
}
```
