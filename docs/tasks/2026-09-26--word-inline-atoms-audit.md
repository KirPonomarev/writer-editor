# Independent Word transfer audit: standard inline text atoms

STATUS: ACTIVE_IMPLEMENTATION
ROLE: TASK_CONTRACT
CLAIM_BOUNDARY: bounded Word text preservation, not arbitrary OOXML fidelity
TASK_ID: WORD_INLINE_ATOMS_INDEPENDENT_AUDIT_20260926
BASE_SHA: 23adf37d73fe58b243750e8bf8e2acf74d3de90e

Owner requested an independent audit and personal repair of Word transfer in
both directions. Fresh main reproduces silent deletion of w:cr,
w:noBreakHyphen and w:softHyphen during ordinary DOCX import. The previous
420-cell receipt is authentic finite-fixture evidence; it does not cover these
counterexamples or automatically certify changed runtime bytes.

O: standard text atoms retain their code points or equivalent hardBreak,
formatting, order and adjacent media offsets through import, durable save,
reopen and export. R preserves its authenticated authority and rejection rules.
T: validated ZIP/XML -> bounded derived preview -> main admission -> existing
Command Kernel -> fenced Core transaction -> immutable projection/export.
H: readers omit three standard inline atoms. Explicit, namespace-bound atom
mapping, consistent coordinate counts and native serialization remove this
loss without introducing another document model or writer.
B: protect source DOCX, all existing project data, foreign WIP, historical
receipts, 1120 denominator, Word420 route/profile requirements, C3 five cycles,
independent raw oracles and all stale/replay/hostile gates. No Google, UI design,
dependency, network truth, schema migration or automatic Apply changes.
P: failing independent raw packages; aliases, spoofing and malformed ownership;
formatting/media/table/list interactions; five cycles; fenced persistence;
SOURCE/PACKAGED native Word and independent raw readback; required regression,
CI, delivery and exact merged-head verification. Count-only proof is invalid.
I: base above, exact Node 22.12.0/npm 10.9.0, synthetic owned native targets.

## FEATURE_INTEGRATION_MANIFEST_V1

Existing DOCX product plane owns validated semantic projections; Core retains
all durable truth and transaction ownership. Interface plane consumes existing
immutable preview and authoring projections. Commands: existing generic import,
save/export and explicitly confirmed authenticated review Apply. Queries:
preview/current document. Events: existing import/save result. Effects: current
ZIP/XML, filesystem and native proof adapters. State: DERIVED_STATE preview,
PROJECT_STATE saved document, AUTHORING_WORKING_STATE editor. Guards: project,
lifecycle, artifact/plan digest, source revision, operation identity and lease.
No new port or surface; DESIGN_TOOL_ROUTER=NOT_APPLICABLE. Unsupported/unsafe
input retains typed failure, no mutation or hidden loss fallback. The change
runs only in bounded import/export, not the typing hot path. Recovery and
accessibility remain on their existing routes. Rollback: revert this PR while
retaining independent artifacts; all four delivery steps are required.

## External semantic reference

Microsoft Open XML documents [CarriageReturn](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.carriagereturn),
[NoBreakHyphen](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.nobreakhyphen)
and [SoftHyphen](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.softhyphen).
An untyped carriage return ends the line, like a text-wrapping break. The two
hyphens preserve U+2011 and U+00AD semantics respectively. These references
inform expected behavior; actual native evidence remains necessary.
