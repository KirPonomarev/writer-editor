# Individual reply deletion

Task: WORD_REPLY_DELETION_20260927
Base: 82cec5fb053f3ed1892d2873984336568357d33b
Authority: owner's autonomous Word correction plan, P1c-R.

O: delete an individual reply in Word or through the existing local comment
command, preserve root and remaining identities, reopen and re-export.
T: signed baseline plus COMPLETE independent package inventory -> pure Core
delta -> explicit native confirmation -> private admission -> Kernel -> lease
and atomic writer. Local authoring uses the existing editComment command.
H: join retained replies by durable identity with a strictly ordered subsequence;
archive missing replies separately rather than purging history or rejecting all.
B: original body/provenance retained in deletedMessages and recovery. Archived
IDs are export tombstones, never revived. Existing bounds cover active+archived
messages together. Preserve manuscript, CAS, replay and foreign WIP.
P: real exporter/parser, local and return tests; missing carriers, partial optional
metadata, reparent/reorder/collision, replay and recovery negatives; native Word
SOURCE/PACKAGED Cancel/Apply/reopen/export; mandatory RTK/CI and merged checks.
I: exact base above, signed export round, complete artifact hash, project,
lifecycle, current scene generation and canonical revision revalidated.

FEATURE_INTEGRATION_MANIFEST_V1: existing bounded comment lifecycle extension.
Product plane owns graph and history. Interface plane consumes immutable previews
and existing confirmation text; DESIGN_TOOL_ROUTER: NOT_APPLICABLE.
Commands: cmd.project.review.editComment and cmd.rtk.review.applyCommentLifecycleReturn.
Queries: current canonical graph and signed baseline. Events: WORD_COMMENT_AUTHORED
and WORD_COMMENT_RETURN_APPLIED. Effects: existing project lease, atomic graph and
readable recovery ports. PROJECT_STATE persists history; authoring text is protected;
parser and preview remain DERIVED_STATE without write authority.

No dependencies, runtime network, new surface or schema-version migration.
No rich-body/mixed-manuscript claim and zero official cell credit from this repair.
Rollback: revert implementation and exact admissions; retain JSON history/recovery.

Native mixed-origin repro: Word removes empty UTC extension entries but retains
entries with timestamps. Export now represents an existing explicit ISO UTC date
in transport metadata, without altering canonical provenance. No local or missing
date is inferred. Authenticated return accepts only the same transport instant or
Word's already supported minute precision; arbitrary date changes still fail.
This repairs the producer while retaining the COMPLETE deletion gate.
