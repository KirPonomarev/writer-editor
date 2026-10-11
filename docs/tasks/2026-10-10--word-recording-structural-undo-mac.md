# Checked structural Undo during text recording

TASK_ID: YALKEN_WORD_FINISH_AND_PROOF_GLUE_V2_STRUCTURAL_AUTHORING_UNDO
OWNER_AUTHORITY: Explicit finish-and-proof V2 task, narrow Undo correction and necessary regression/delivery work.
DELIVERY_BASE_SHA: a468003e2475e6496fa906f35ef59dc1dd23ebad
PRODUCT_CHECKPOINT_SHA: 65a995335d5038ca186da6ca382b8ff1286d79d8
PR: 2106
DESIGN_TOOL_ROUTER: NOT_APPLICABLE

SOURCE80 exposed a separate authoring defect while continuing the retained
500k-word project: after joining paragraphs, typing and using native Undo,
the working text returned to its saved baseline, but autosave, Stop recording
and ordinary Quit still refused RECORDING_INTENT_STRUCTURE_UNSUPPORTED.
Core rejected the forward structural operation before validating its Undo.
This does not establish the cause of SOURCE77's editor-snapshot timeout.

The existing pure recording derivation now validates the complete occurrence
replay of a known history group and its inverse, including original paragraph
boundary identities. Only a verified Undo can restore the saved baseline.
Surviving structure, structural Redo, manual recreation and a forged inverse
at another identical occurrence still refuse. Public commands, Main-owned
session, capability/revision/generation guards, persistence and all numerical
bounds are unchanged; no new dependency, UI, runtime network or writer exists.

The four new actual production-editor/Main regressions fail against the
preserved old Core (4 failures of 4), then pass in the affected six-file chain
(178 of 178; zero skipped, todo or cancelled). The tests exercise actual
Tiptap join/split/typing/Undo intents and Main recording/save, pending Word
revisions, three-role discussions, rich notes and retained private state.
One legitimate checked comment-Undo cursor and its store migration remain;
these are explicitly expected, not mistaken for unwanted text mutation.
Repeat Stop does not write, and a new recording followed by a text edit saves.
The immutable SOURCE80 chapter also passes a separately qualified pure Core
check: all 411 paragraphs, rich document, pending ledger, history and note
source points match. That simulated check is not a native application cycle.

Preserved failures include the native Save/Stop/Quit refusal, the first wrong
test expectations, and official CI run38081297014 at product checkpoint65a995.
Its inventory and data-policy checks reject stale source/test byte bindings.
The same PR mechanically refreshes only existing exact-byte companions,
retains every historical certificate tuple and approval, adds one complete
current tuple and admits this factual task document. Inventory classification,
test membership, skips, predicates and acceptance denominators do not change.
An attempted post-edit preflight had correctly refused dirty state; the first
product edits had already passed their clean preflight. The companion scope
amendment passed separately at the clean committed checkpoint65a995.

The owner authorized SIGTERM only for the checked SOURCE80 PID44692 after
ordinary Quit failed. All 67 original files remained byte-exact; two new
recovery backups were preserved too. All 69 files stayed unchanged afterward
and the process is gone. Controller EOF failed rather than recording a normal
exit. The profile, genuine Word-return, logs and original failures remain.
No normal Quit or complete-cycle credit is taken from that termination.

Full native accepted cycles remain zero. SOURCE77 timeout diagnosis, fresh
exact-build native structural-Undo/continued-save proof and the first coherent
Word-to-Yalken-to-Word cycle remain open. Both origins, 100k/500k, SOURCE and
ordinary PACKAGED, writer/editor/proofreader, five genuinely changed Word
rounds, conflicts, recovery, complete data comparisons and shipping SLO retain
their original acceptance denominator. Mixed heads, diagnostic instrumentation
or profiles cannot manufacture a complete accepted cycle.

Next: complete mandatory CI, normal merge and exact merged verification of
this PR, obtain fresh native admission, then continue the preserved project
through verified Undo/Redo, ordinary Quit/reopen and further editing. Revert
the one complete PR for rollback; no historical artifact is overwritten.
