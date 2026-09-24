# C4 Google Office raw DOCX return compatibility

STATUS: PRODUCT_REPAIR_PENDING_PHYSICAL_PROOF

The real Google Office-mode round-trip of a synthetic three-scene manuscript
returned a DOCX whose body, comments, signed custom properties and section
boundaries were present. Google renamed the advisory `customXml` part directory
to `customXML`, linked it from the document using the package-confined
`../customXML/item1.xml` target, and omitted core title and identifier. The
original provider bytes are retained outside the repository with their hash.
The earlier failed product intake made no scene or manifest mutation.

This repair admits only those observed inert package shapes. Stage02 still
checks the target against an existing entry and rejects package escapes,
external active relationships, duplicate case-folded names, unknown parts,
oversized parts and hostile XML. The review parser records the exact custom XML
relationship as inert; it cannot supply a locator, signature, or write
authority. After the ordinary signed carrier, YRTK2 and local round checks,
the metadata validator may accept absent core title and identifier if the
custom properties and signed digest match exactly. A nonempty wrong value,
missing core part, duplicate protected core property or changed creator/time
still fails. Project metadata continues to come only from Product Core.

The outcome is a **degraded metadata ledger**, not metadata preservation.
`METADATA` cells remain unproved. No C4 multi-scene cell is accepted by this
code change, unit tests, or the earlier provider run. Admission requires a
fresh physical source and packaged Office-mode journey, independent raw
readback, exact tree and state checks, normal CI/merge, and the official unified
verifier on the merged SHA. Revert this bounded change if the genuine return
still cannot pass without weakening the signed authority or source-state
checks; retain the raw evidence and the synthetic project for diagnosis.
