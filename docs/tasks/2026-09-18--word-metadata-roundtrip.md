# Preserve and prove Word document metadata

TYPE: PRODUCT_CODE_AND_OPS_EVIDENCE
CANON_VERSION: v3.13a-final
TASK_ID: WORD_METADATA_ROUNDTRIP_20260918
BINDING_BASE_SHA: 2cc4a5f69daf29a3859799e3fa75543bbd3a4bcd
AUTHORITY: Owner instruction to personally continue the frozen 1120-cell program without delegation. The 204-cell exact-merged closure is the protected baseline.
DESIGN_TOOL_ROUTER: NOT_APPLICABLE. This contour changes backend DOCX transport, intake, independent evidence, and admission only.

## MICRO_GOAL

Preserve canonical project identity metadata through the existing C1 review-return, C2 and C3 Word journeys. Prove the result from raw OOXML and the product intake without allowing returned document metadata to mutate project truth. Admit at most 24 new whole METADATA cells: three routes, four valid volumes, and two runtime profiles.

## FEATURE_INTEGRATION_MANIFEST_V1

- featureId: WORD_METADATA_ROUNDTRIP; featureVersion: 1; integrationMode: EXISTING_SEAM.
- domainOwner: Product Core owns projectId, projectName, createdAtUtc and saved manuscript state.
- authoritativeData: normalized canonical project manifest plus main-owned active export authority.
- derivedData: DOCX core/custom properties, immutable parser projection, loss ledger, physical readback, and receipts.
- productPlane: existing full-manuscript export, bounded return intake, explicit review apply, atomic save, reopen and reexport.
- interfacePlane: no UI change; existing immutable review projections gain a sanitized read-only documentMetadata result.
- commandIds: cmd.project.review.exportFullManuscriptDocxReviewPacket, cmd.project.review.activateDocxReviewPreviewSession, cmd.project.review.applyExactTextChangesBatch, plus existing save/open commands.
- operationKinds: COMMAND, QUERY, EFFECT and PROJECTION. Returned metadata creates no command or write authority.
- productPorts: canonical manifest reader, DOCX packet builder, bounded ZIP/XML parser, main-only authority store, atomic persistence/recovery, and test-only native Word adapter.
- designOsPorts: existing read-only document/review projections; unchanged.
- stateClasses: PROJECT_STATE for canonical metadata and saved scenes; AUTHORING_WORKING_STATE for unsaved manuscript text; DERIVED_STATE for DOCX/readback/evidence.
- identityKeys: projectId, manifest path, canonical createdAtUtc, metadata digest, roundId, exportId, source revision/generation, artifact hash, provider/profile, source/merged SHA and tree.
- revisionPolicy: export revalidates current manifest metadata and scene/comment snapshots immediately before publication; intake verifies the returned protected metadata against the HMAC-bound local baseline.
- writePath: existing canonical commands and atomic project writer only. Returned metadata is advisory and never writes the manifest.
- readPath: manifest -> dual OOXML carriers -> native Word -> bounded parser -> main binding -> independent raw reader.
- requiredProductPorts: existing ports only; no dependency, migration, network, cloud, or renderer writer.
- surfaceManifests: none; supportedWorkspaces and visual slots are unchanged.
- fallbacks: missing, malformed, duplicated, conflicting, stale or forged protected metadata rejects intake with a typed reason and zero project write.
- recovery: existing atomic recovery remains unchanged. A single revert restores the prior transport while preserving the 204-cell closure.
- performanceBudget: target at most 300 seconds for each full native journey, with every phase measured and outliers retained.
- securityBoundary: synthetic projects only; bounded namespace-aware XML; authority tokens remain main-verified and secrets never enter DOCX, renderer or worker.
- negativeBypassChecks: changed title, changed project ID, changed creation time, missing core part, missing custom property, duplicate protected property, forged signed digest, and relabelled receipt. Provider changes to lastModifiedBy, modified time and revision remain visible but allowed.
- evidenceBindings: exact product/Lab revisions, raw artifact hashes, native lifecycle receipts, frozen six subcases, independent Python oracle and fresh exact-merged verification.
- currentReality: 204/1120 cells closed; METADATA has zero accepted cells; current product packets omit docProps/core.xml.
- targetOnly: 24 METADATA cells after fresh native and merged proof. No arbitrary Word parity, Google metadata credit, denominator change or credit from generic hostile-file rejection.

## METADATA CONTRACT

Protected values are projectId, projectName, createdAtUtc and the explicit application creator `Yalken`. They are emitted in `docProps/core.xml`, repeated in named public custom properties, digested, and bound into the signed authority envelope. The creator means the application that produced the file; Yalken does not infer a human author.

Word may change lastModifiedBy, modified time and revision. These values are provider-volatile observations. Unknown custom properties are named in a loss ledger and receive no authority. Intake never copies any returned metadata into the canonical manifest.

The native Word pilot proved that Word truncates the core `dcterms:created` value to minute precision. The exact canonical instant therefore remains signed in `YALKEN_PROJECT_CREATED_AT_UTC`; the core value is an independently checked carrier that must stay within the same UTC minute. Cross-minute drift is rejected. This provider normalization is recorded explicitly in every proof.

The six frozen subcases are:

1. documentPropertiesAccounted
2. customPropertiesAccounted
3. authorshipPolicyDeclared
4. timestampPolicyDeclared
5. receiptIdentityBound
6. metadataLossLedgered

## MAP -> MOVE -> PROVE

O: 24 fresh whole-cell proofs whose native and product paths preserve every protected value and account for every provider-volatile or unknown value.

T: frozen denominator -> canonical manifest -> product export -> native Word -> product intake/apply/save/reopen/reexport -> independent raw OOXML reader -> batch admission -> exact merged closure.

H: the missing product seam is explicit DOCX metadata serialization plus return comparison; the existing physical journeys can prove it without another test framework.

B: all 204 accepted predicates, owner data, frozen axes, safety budgets, no-write intake, authority separation and delivery gates stay protected.

P: focused builder/parser/validator tests; field-specific mutants; one native pilot; complete 24-journey cohort; maintained/OPS/OSS/CI gates; PR merge and exact merged rerun.

I: exact base SHA above; verified encrypted writable T7; clean isolated worktree; source and packaged runtime identities recorded per observation.

## STOP CONDITION

Stop after the third identical failure signature, preserve expected/actual values, seed, exact revisions and hashes, and record one next hypothesis. Never convert partial, stale, self-authored or count-only evidence into PASS.
