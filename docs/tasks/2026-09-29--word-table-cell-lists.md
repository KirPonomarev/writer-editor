# Lists in Word table cells

TASK_ID: WORD_TABLE_CELL_LISTS_20260929
BASE_SHA: 509f8dbf939a61eaaf330a3053c804548397a6f8
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

O: Import, author, save, reopen and export bulleted and numbered lists inside
table cells, preserving nested levels, numbering starts, empty paragraphs,
rich inline text, cell ownership and existing merged-cell geometry.
T: Validated OOXML -> pure table/list projection -> Core envelope -> existing
Kernel import or authoring command -> atomic scene writer -> existing DOCX port.
H: Flatten numbered paragraph leaves with explicit cell and list ownership;
rebuild lists independently in each cell so identical text cannot change routing.
B: Preserve unrelated scenes, no-loss working state and authenticated review
bindings. Nested tables and structural tracked changes remain unsupported.
P: Five serialization cycles, actual editor authoring/history, atomic import,
malformed/boundary negatives, literal OOXML and native macOS SOURCE/PACKAGED.
I: Exact base above, clean existing worktree on verified encrypted T7, one delivery.

FEATURE_INTEGRATION_MANIFEST_V1:
productPlane: Core validates canonical table shape through the shared pure model.
interfacePlane: existing table and list nodes; schema composition only.
commands: existing import safe-create, authoring save, review and export commands.
queries: immutable document and locally authenticated review-map projections.
events: existing saved and exported receipts.
effects: existing project transaction and DOCX publication ports.
guards: cell row/column/span/paragraph identity, list ancestry and restart;
unchanged project lifecycle/revision/generation/capability revalidation.
recovery: existing rich scene envelope, atomic writer and editor undo history.
limits: table geometry remains bounded; 50000 leaves, 2048 lists, levels 0 to 8.
security: XML metadata supplies data only, never path or mutation authority.
performance: one bounded table traversal; no dependency or background worker.
accessibility: existing list semantics and table keyboard navigation.

Non-claims: nested tables, new numbering formats, arbitrary list continuation
paragraphs, structural review operations and full macOS plan qualification.
Rollback: revert this delivery while preserving scene envelopes and recovery.
