# WORD_NOTE_TABLE_RETURN_MAC_20261001

STATUS: TARGET_NOT_ACCEPTED
BASE: f5e2a1472dba6b0533c2b0056e72a8880771db73

O: A Word edit only to a note table's topology/properties is offered for explicit Apply and survives save, re-export and reopen without requiring a text edit.
T: Validated DOCX -> authenticated return baseline -> pure note delta -> existing guarded explicit Apply -> existing atomic notes transaction.
H: Original rich body may be reused only if both inline meanings and existing strict table topology/property comparison match. Expected: width 2000 -> 3500 produces one note update with width 3500.
B: Private/other-scene notes, main text, references, identity, revision and replay gates unchanged. Existing wordCell grammar gains bounded optional preferred width; no new UI, dependency or writer. One comparison repair rollback.
P: Actual package mutation with identical text for width/borders/fill/row-cell structure; no-op/default-equivalent cases; existing stale/replay tests. SOURCE and PACKAGED native property-only edit -> explicit Apply -> three exports -> restart with independent XML/state readback. Required CI and merged-head checks.
I: Base above; production runtime change restricted to existing note-return planner. Design router NOT_APPLICABLE.

Before repair: synthetically altered full exported DOCX (not a native Word oracle) parses successfully with grid [3500], but planner returns original [2000], changes [], unchanged true. A direct validated-model reproducer agrees. The table metadata was missing from effectiveBody; text-only tests did not detect it.

Limits: this repair does not implement nested tables, note media or full Mac Word acceptance. Existing authenticated legacy auto-fit grid equivalence policy remains unchanged; explicit dimensions/properties are compared strictly.

Native integration finding: Word materializes preferred cell width independently of grid, including after border-only edits. Preserve bounded DXA preference separately from grid and serialize both. Earlier strict parser refusal was safe but prevented real return. No loss diagnostic is suppressed.
