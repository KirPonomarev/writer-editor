# Ordinary Word reply return

Task: WORD_COMMENT_REPLY_RETURN_20260927
Base: d7aa45522b39a02ae33a8ffe896d4a2232948bf7
Authority: direct owner instruction to personally finish Word roundtrip fixes and normal delivery.

## Observed failure and bounded correction

A fresh local Word reply to an exported existing thread is parsed into the preview,
but canonical Apply is blocked with DOCX_GENERIC_COMMENT_METADATA_UNSUPPORTED.
Word uses a localized paragraph style ID (a3), whose actual definition is the
built-in annotation text style. The observed definition inherits Normal and
contains only size and paragraph spacing. Proofing language is already ledgered.

Resolve the referenced style, its explicit default Normal parent and document
defaults before admitting literal text. Only the closed font, size, spacing and
proofing profile is accepted. Unknown properties, hidden text, rich emphasis,
numbering, duplicate definitions and invalid inheritance fail closed. Record the
style normalization in the return ledger. Generic create-only import is unchanged.
No new canonical writer, command, schema, dependency or UI composition is added.

## MAP / architecture

O: a new plain Word reply reaches the existing canonical thread through ordinary
file entry, explicit Apply, persistence and reopen, with unchanged prior messages.
T: bounded DOCX parser -> authenticated export baseline -> existing delta planner
-> one-shot Command Kernel Apply -> existing atomic product port.
H: actual built-in style resolution removes the demonstrated false rejection
without allowing arbitrary style effects to disappear from literal messages.
B: preserve text, root/reply identities, provenance, anchors, unsaved author state,
all historical admission sets and no-write conflict/replay behavior. Revert this PR
for rollback; no data migration or deletion.
P: focused actual exporter/parser/planner chain with Unicode and adversarial style
variants; ordinary SOURCE and PACKAGED Word return, Cancel, Apply, new-process
reopen and independent raw re-export inspection; mandatory repository CI gates.
I: exact base above; candidate and merged SHA, native runtime and artifact hashes
are recorded in external execution evidence, not inferred from this brief.

Product plane: validated derived parser projection; existing Core owns persistence.
Interface plane: unchanged. State classes: DERIVED_STATE and existing PROJECT_STATE;
AUTHORING_WORKING_STATE remains protected by the existing Apply guards.
Commands/ports: existing local review entry, prepared comment lifecycle command,
canonical non-text-return state port. No renderer authority or new effect route.
DESIGN_TOOL_ROUTER: NOT_APPLICABLE.

## Limits

Literal comment body, author, date and thread topology are the return contract;
Word font/size/spacing presentation is explicitly normalized, not claimed preserved.
This does not qualify new independent roots, deletions, reanchors, rich comment
formatting, complete five-cycle P1c, Windows native Word, or the official cell
denominator. Native success and delivery alone add zero officially accepted IDs.
