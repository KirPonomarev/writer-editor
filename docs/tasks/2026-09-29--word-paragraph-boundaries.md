# Pending paragraph boundaries

TASK_ID: WORD_PARAGRAPH_BOUNDARIES_20260929
BASE_SHA: 1fc9811a6aeb1a84e6a3087e9f433613a3d0bb35
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

O: Preserve pending Word paragraph split/merge through import, authoring,
decisions, history, export and changed native return on macOS.
T: Validated native paragraph-mark ownership -> Core scene ledger -> existing
Kernel capability and atomic scene writer -> immutable projection -> export port.
H: Native Word places self-closing ins/del in pPr/rPr. These own the following
paragraph boundary; the current parser rejects their structure. Add checked
boundary semantics and independently bind both Original and Current.
B: Keep pre-existing revisions, source rich runs, history, annotations guards,
project identity and canonical checkout intact. No table or list-item topology.
P: Native Word Original/Current and property-choice observations; literal XML,
malformed ownership, Unicode/empty paragraphs, decisions/history, authoring
save/restart, minimum/full exports, native changed returns and mandatory gates.
I: Exact base above. Native discovery artifacts are separate from product truth.

FEATURE_INTEGRATION_MANIFEST_V1:
productPlane: Core owns checked paragraph boundary revisions and projections.
interfacePlane: Existing cards label paragraph split/merge; no new surface.
commands: Existing recording, save, decision, import, export and return commands.
queries: Existing revision-bound scene and review projections.
events: Existing scene-save, decision and authenticated-return receipts.
effects: Existing atomic writer and governed DOCX publication adapters.
guards: Same-container adjacent paragraph ownership, exact endpoint, unique
boundary revision, Unicode-safe spans and existing project/lifecycle/CAS checks.
recovery: Existing durable scene ledger and recording/return Undo/Redo frames.
performance: Existing document/revision/history bounds; no new dependency.
accessibility: Existing keyboard editor and accessible review controls.

Word's literal boundary rule was observed on controlled Mac documents before
implementation. Removing a boundary concatenates runs and uses the following
surviving paragraph's properties. A controlled XML variation opened in Word
separately verified this rule with center and right alignment.

Table row/cell changes, cross-container and list-item boundaries, mixed
annotations and final full-plan Mac acceptance remain separate work.
Rollback: revert this bounded contour while preserving envelopes and recovery.
