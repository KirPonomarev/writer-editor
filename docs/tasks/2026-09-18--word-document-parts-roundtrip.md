# Preserve and prove Word document parts

TYPE: PRODUCT_CODE_AND_OPS_EVIDENCE
CANON_VERSION: v3.13a-final
TASK_ID: WORD_DOCUMENT_PARTS_ROUNDTRIP_20260918
BINDING_BASE_SHA: af5da809d9cbf60b8eb471f0f3be977ea6a4c489
AUTHORITY: Owner instruction to personally continue the frozen 1120-cell program without delegation. The 228-cell exact-merged closure is the protected baseline.
DESIGN_TOOL_ROUTER: NOT_APPLICABLE. This contour changes backend DOCX transport, intake, independent evidence, and admission only.

## MICRO_GOAL

Add one reusable, bounded semantic transport seam for Word document parts, then use it in small independently provable vertical slices. The first slice is `SECTIONS`: derive sections from canonical consecutive scene groups, emit real Word section properties, parse them after native Word save, compare them with the signed local baseline, reject structural drift with zero write, and admit at most 24 fresh cells across C1 review, C2 and C3, four valid volumes, and two runtime profiles. Notes, footnotes/endnotes, tables and media follow through the same seam only after this slice closes.

## FEATURE_INTEGRATION_MANIFEST_V1

- featureId: WORD_DOCUMENT_PARTS_ROUNDTRIP; featureVersion: 1; integrationMode: EXISTING_SEAM.
- domainOwner: Product Core owns project structure and saved scene state; Command Kernel owns mutations.
- authoritativeData: canonical ordered scene paths, saved scene bytes and the main-owned active export authority.
- derivedData: Word section properties, immutable parser projection, loss ledger and physical evidence.
- productPlane: existing full-manuscript export, bounded return intake, explicit review apply, atomic save, reopen and reexport.
- interfacePlane: no UI change; the existing immutable intake result gains a sanitized read-only section binding.
- commandIds: existing full-manuscript review export, review activation, exact text apply, save and open commands.
- operationKinds: COMMAND, QUERY, EFFECT and PROJECTION. Returned section data creates no write authority.
- productPorts: canonical project reader, DOCX builder, bounded ZIP/XML parser, main-only authority store, atomic persistence/recovery and test-only native Word adapter.
- designOsPorts: existing read-only projections only.
- stateClasses: PROJECT_STATE for canonical scene hierarchy and saved scenes; AUTHORING_WORKING_STATE for unsaved text; DERIVED_STATE for DOCX, parser output and evidence.
- identityKeys: project, ordered scene IDs, paragraph boundaries, section digest, round, export, source revision/generation, artifact hash, provider/profile and exact SHA/tree.
- revisionPolicy: export revalidates ordered scene IDs and scene bytes before publication; intake verifies returned sections against the HMAC-bound local baseline.
- writePath: existing canonical commands and atomic writer only. Returned sections are advisory and never write project structure.
- readPath: scene hierarchy -> signed section projection -> OOXML sectPr -> native Word -> bounded parser -> main binding -> independent raw reader.
- requiredProductPorts: existing ports only; no dependency, migration, network, cloud or renderer writer.
- surfaceManifests: none.
- fallbacks: missing, duplicated, relocated, malformed, reordered or changed protected section properties reject intake with a typed reason and zero project write.
- recovery: existing atomic recovery remains unchanged. Reverting this contour restores the previous transport while preserving the 228-cell closure.
- performanceBudget: target at most 300 seconds for a complete native journey; every phase is measured and failures are retained.
- securityBoundary: synthetic projects only; bounded namespace-aware XML; secrets never enter DOCX, renderer or worker.
- negativeBypassChecks: missing section, duplicated section, moved boundary, changed page size, changed orientation, changed margins and forged signed digest.
- evidenceBindings: exact product/Lab revisions, raw artifact hashes, native lifecycle receipts, frozen section subcases, independent raw OOXML oracle and fresh exact-merged verification.
- currentReality: 228/1120 cells closed; `sectPr` is inventory-only and `SECTIONS` has zero accepted cells.
- targetOnly: 24 `SECTIONS` cells after fresh native and merged proof. No credit for the four later document-part fields until separately implemented and proved.

## SECTIONS CONTRACT

One Word section represents each consecutive canonical scene-directory group. A single-scene document has one final section. Multi-chapter fixtures have a section per chapter group. Protected semantics are the exact paragraph boundary sequence, next-page break policy, A4 portrait page size, one-inch margins and single-column spacing. Source scene membership is stored in the signed local projection; Word carries the corresponding section boundaries and page properties.

Known provider-added section children are recorded in a loss ledger and receive no authority. Missing or changed protected properties fail closed. Intake does not mutate project hierarchy or layout state.

The frozen subcases are:

1. sectionCountPreserved
2. paragraphBoundarySequencePreserved
3. canonicalSceneCoverageBound
4. pageSizeAndOrientationPreserved
5. pageMarginsPreserved
6. sectionBreakPolicyPreserved
7. signedSectionDigestBound
8. sectionLossLedgered

## MAP -> MOVE -> PROVE

O: Up to 24 fresh whole-cell proofs whose native and product paths preserve all protected section semantics and account for provider additions.

T: Frozen denominator -> canonical scene hierarchy -> product export -> native Word -> product intake/apply/save/reopen/reexport -> independent OOXML reader -> batch admission -> exact merged closure.

H: Section boundaries can be derived from existing canonical scene paths and bound to the current signed transport without a new database, command or dependency.

B: Preserve all 228 accepted predicates, owner data, frozen axes, parser budgets, zero-write intake, authority separation and delivery gates.

P: Focused builder/parser/validator tests; coherent negative mutants; one native pilot; complete cohort; maintained/OPS/OSS/CI gates; PR merge and exact merged rerun.

I: Exact base SHA above; verified encrypted writable T7; clean isolated worktree; source and packaged runtime identities per observation.

## STOP CONDITION

After the third identical failure signature, retain expected and actual values, seed, exact revisions and hashes, and record one next hypothesis. Partial, stale, self-authored or count-only evidence never becomes PASS.
