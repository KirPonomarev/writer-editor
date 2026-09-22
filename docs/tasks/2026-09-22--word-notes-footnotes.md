# Preserve selected notes through native Word

TYPE: PRODUCT_CODE_AND_OPS_EVIDENCE
TASK_ID: WORD_NOTES_FOOTNOTES_ROUNDTRIP_20260922
BINDING_BASE_SHA: 67183b1c89f41e256018452526bc9d76766e2004
CANON_VERSION: v3.13a-final
AUTHORITY: Owner instruction to implement the remaining frozen interop cells personally, using shared physical batches.
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

## Outcome and boundary

Export explicitly selected canonical project notes as native footnotes or endnotes, preserve their literal titles and bodies, and bind references to saved manuscript positions. Authenticated return intake compares the complete note projection with its signed local baseline. Provider notes never write canonical notes. Missing, additional, moved or changed notes reject with zero write. Default export includes no private notes.

The next independently proved cohort targets 48 additional cells: NOTES and FOOTNOTES_ENDNOTES across C1 review return, C2 and five-cycle C3, four existing valid volumes, and two runtime profiles. The existing 252 cells remain a protected historical closure. Candidate tests and physical pilots grant zero credit; fresh exact-merged native proof is required.

## FEATURE_INTEGRATION_MANIFEST_V1

- featureId: WORD_SELECTED_NOTES; featureVersion: 1; integrationMode: EXISTING_SEAM.
- productPlane: canonical saved notes and manuscript -> explicit export -> native Word -> authenticated return -> existing text apply/save/reopen -> reexport.
- interfacePlane: existing read-only review result; no new UI, surface, command, storage format or dependency.
- authoritativeData: existing notes.craftsman.json, saved scenes, project identity and main-owned signed export authority.
- derivedData: note selections, reference offsets, native OOXML, parser projection, loss ledger and independent evidence.
- commands: existing full-manuscript review export, authenticated return activation, exact text apply, project save and document open.
- queries: existing notes and project tree read models. Events remain existing lifecycle invalidations.
- effects: existing canonical file readers, DOCX builder, bounded parser, atomic export/recovery and synthetic native Word adapter.
- productPorts: existing saved notes and scene readers, main-only authority store and existing publication/writer ports.
- designOsPorts: existing immutable read-only projections; no product writer in the renderer.
- stateClasses: PROJECT_STATE owns notes/scenes, AUTHORING_WORKING_STATE retains no-loss duty, DERIVED_STATE owns transport and proof.
- identities: project, scene, selected note ID, note-state hash, source revision, exact UTF-16 range, round/export, provider/profile, build/SHA and artifact hashes.
- revisionPolicy: main revalidates saved notes, scenes and publication lifecycle before write. Intake verifies the signed complete projection before entering apply.
- fallback: fail closed on invalid/deleted/unselected source, wrong project, stale range, unsupported content, loss, duplication, changed reference or budget excess. No truncation or fuzzy relocation.
- recovery: unchanged canonical notes and existing atomic writer/recovery. One product PR and companion Lab change form one rollback.
- performance: share the existing 24 Word journeys across both fields; separately measure physical, proof and delivery time.
- accessibility: existing UI and keyboard behavior unchanged.
- security: explicit note selectors confer no path authority; bounded namespace-aware ZIP/XML; no provider write authority, dependency, product network or secret change.
- negativeChecks: private/deleted note exclusion, stale state, wrong project, malformed selectors, surrogate boundaries, lost/duplicated/moved references, changed bodies, dangling/external relationships, unsupported note structure and resource limits.
- currentReality: 252 admitted cells; notes exist in canonical storage; native footnotes/endnotes remain unsupported for complete roundtrip.
- targetOnly: at most 48 new cells after full native and independent merged proof.

## Note transport contract

The existing export command accepts options.documentNotes: a bounded array of exact {noteId, kind} selectors, where kind is footnote or endnote. No bodies, paths, provider IDs or executable fields are accepted there. The main reader resolves each selection from the saved canonical notes document. Deleted, duplicate and missing IDs fail. Project, manuscript and explicitly selected inbox notes attach to the first manuscript paragraph. Scene notes attach to the first paragraph of their canonical scene. Selection notes require a nonempty exact UTF-16 range and quote hash over the saved scene's paragraph text joined with LF; the reference is placed at the end of that range. A range spanning paragraphs is unsupported and fails explicitly.

Each note has two native paragraphs: literal canonical title, then literal body using explicit Word line-break/tab atoms. Both footnotes and endnotes carry a native reference mark. The signed semantic projection protects kind, document paragraph and offset, title/body paragraphs and reference order. Native numbering IDs are validated as a bijection, not trusted as canonical note IDs. Canonical scope, attachment and IDs remain in the local signed source binding. Returned notes are read-only and may not mutate the source sidecar.

## MAP -> MOVE -> PROVE

O: Complete independent note and footnote field proofs with unchanged canonical notes through return, text apply, save, fresh reopen and reexport.
T: Frozen denominator -> saved project truth -> existing command/effect path -> native artifacts -> independent raw oracle -> official admission.
H: Explicit source selection plus a signed semantic note projection permits real native notes without a new editor schema or persistence writer.
B: Protect private/unselected notes, authored scene text, existing 252-cell evidence, input budgets and command authority. Rollback is one revertible delivery.
P: Focused positive and adversarial contracts, real small native pilot, required baseline/CI, merged native cohort and independent raw readback.
I: Exact binding base above, verified encrypted writable T7, isolated worktree, clean product/Lab identities, immutable run artifacts.

Technical references: Microsoft WordprocessingML Footnote and Endnote elements and their separate parts/reference relationships.
https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.footnote
https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.endnote

After three identical failures, preserve the failure signature, identities and raw evidence and change the hypothesis. Never turn a candidate, unsupported or count-only result into product credit.
