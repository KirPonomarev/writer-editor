# Native Word inline text moves

TASK_ID: WORD_PENDING_TEXT_MOVES_20260929
BASE_SHA: 5f27365e4cf22e07197d4474c20ee0a5353d264a
STATUS: TARGET_NOT_ACCEPTED
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

O: Preserve a native Word inline move as one paired decision through generic
import, authoring, durable history, export and authenticated single-scene return.
T: Bounded namespace-validated XML -> Core ledger -> immutable review projection
-> existing Kernel decision/import command -> atomic scene persistence.
H: Word links source and destination by range name, not revision wrapper ID.
Its smart cut may leave different boundary whitespace on the two sides. Store
both exact spans, preserving an independent inserted space as its own revision.
B: Existing canonical scene identity, topology, author/date, Original/Current,
baseline and persistence remain protected. Do not infer moves from equal text.
P: Native Word-origin file; pair decisions and Undo/Redo; five serialization
and returned-history cycles; cells, reversed endpoints, multi-scene export name
isolation; orphan, crossing, malformed, mixed and stale negatives; Mac runtime.
I: Exact base above, verified encrypted volume, existing isolated worktree.

FEATURE_INTEGRATION_MANIFEST_V1:
productPlane: Core owns optional move provenance and atomic group decisions.
interfacePlane: Existing review cards name move source, destination and action.
commands: Existing import, recording, review decisions, return and export.
queries: Existing immutable document and review projections.
events: Existing scene saved, exported and review applied receipts.
effects: Existing atomic scene writer and governed DOCX publication adapter.
guards: Range names never authorize scene routing. Unique complete ranges each
own one inline wrapper within one paragraph. Both sides share author and name;
both group states change together. Existing artifact authentication, project,
scene, baseline, lifecycle and generation checks remain required.
recovery: Existing durable decisions, returned rounds and transaction backups.
bounds: Existing XML budgets, 1024 revision and 4 MiB ledger limits; bounded
nonempty range names and explicit canonical paragraph coordinates.
performance: Existing bounded parser and export segment traversal.
accessibility: Same controls, keyboard actions and native confirmation dialog.

Supported endpoints may occupy different existing paragraphs, list items or
table cells. Export regenerates range names scoped by scene and canonical group.
Original/Current keep exact per-side text, including smart whitespace changes.
Native Word evidence uses moveFrom text runs (w:t), distinct source/destination
wrapper IDs and matching range names. This agrees with the Open XML move range
contract: https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.movefromrangestart

Non-claims: New moves inferred from Yalken clipboard gestures; paragraph-mark
moves, multi-wrapper ranges, cross-scene moves, nested revisions, mixed comments
or notes, formatting or structural tracked changes. Full qualification remains
separate. Ordinary authoring recording remains insertion/deletion recording.
Rollback: Revert this delivery while retaining document envelopes and backups.
