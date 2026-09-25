# W6 — Word composite fidelity and route separation

Task: WORD_COMPOSITE_FIDELITY_20260925. Base: b6986aea3db5eae54357041f284b0d6f0d63e032.
Authority: owner's approved W6 of the Word remediation plan, both directions.

O: An unformatted Word line break remains a hardBreak within its paragraph through import, save, reopen and re-export. Composite documents retain supported properties; loss reports describe the actual candidate. G and R never exchange authority.
T: DOCX bytes -> bounded parser -> validated paragraph projection -> canonical document -> existing safe-create command -> fenced persistence -> ordinary export. R additionally requires existing authenticated round and explicit Apply.
H: The rich-candidate predicate considers styling but omits hardBreak structure. Requiring rich content for internal newlines prevents paragraph-boundary ambiguity without introducing another document model.
B: Preserve original inputs, all hostile limits, unrelated work, identity and capability revalidation, page/column/section diagnostics, atomic persistence, C3 cycles and frozen denominator. No Google, dependency, shell/UI composition or runtime network changes. Rollback is this slice's revert, with no migration.
P: RED unformatted break repro; five cycles, leading/trailing/repeated breaks, empty paragraphs, tabs/Unicode, safe-create disk readback; mixed page/column negative; full table/media/list composites; real SOURCE/PACKAGED command lifecycle and native Word/raw readback; required tests, CI and exact merged verification.
I: Base above. Physical proof must bind actual commit, binary/profile and input/output hashes. Prepared inputs and component results alone confer no acceptance.

## FEATURE_INTEGRATION_MANIFEST_V1

Product plane: existing canonical rich document and bounded DOCX projection. Interface plane: existing immutable authoring projection and loss-report presentation, no new surface. Commands: existing generic safe-create, save, ordinary export and authenticated review Apply. Queries: preview and current immutable document. Events: existing import/save outcomes. Effects: existing filesystem, DOCX and native proof adapters. No new ports, writers or authority. Design OS remains read-only; source revision, project/lifecycle, artifact/candidate hashes and command revalidation remain mandatory. Unsupported input yields typed loss or block. Recovery is the existing fenced transaction protocol. DESIGN_TOOL_ROUTER=NOT_APPLICABLE; SURFACE_MANIFEST_V1 not applicable.

## G/R field matrix and proof obligations

This task matrix refines the existing WORD_SAFE_SEMANTIC_ROUNDTRIP_V4_CAPABILITY_PROFILE_V1 profile. It is not another denominator or a certification claim. G means an ordinary Word-created document with no Yalken carriers. R means a real Yalken export with authenticated return and explicit Apply. All historical evidence remains limited to its bound head; W7 supplies final unified acceptance.

| Field | G bounded disposition | R obligation | Independent observation |
|---|---|---|---|
| TEXT | Full supported text, tabs and hard breaks | Authenticated supported edits only | Full code points and paragraph graph, no count-only proof |
| ORDER | Preserve block/cell order and empty paragraphs | Preserve scene order and route | Ordered raw document graph |
| STYLES | Supported literal/resolved inline/block properties | Unchanged styles survive supported text edits; unsupported style edits stay diagnostic | Effective supported raw properties |
| NOVEL_SCENE_STRUCTURE | New local scene, never invent original book identities | Original scene boundaries and exact routing | Core manifest plus authenticated map |
| SECTIONS | Explicit typed unsupported layout; existing bounded paragraph-boundary recovery | Existing declared section envelope only | Raw boundaries, no layout equivalence claim |
| IDENTIFIERS_ANCHORS | Core-generated identities; foreign Word IDs confer no authority | Authenticated round, source revision and anchors | Wrong-scene/stale/replay negatives |
| METADATA | Unsupported foreign/custom properties stay typed; no project identity adoption | Declared local metadata continuity | Core readback and raw supported fields |
| NOTES | No guessed mapping from footnotes to project notes | Existing declared Core notes semantic only | Separate notes readback |
| FOOTNOTES_ENDNOTES | Currently typed unsupported, never EXACT for Word-origin input | Declared supported R bodies/order/anchors must survive | Independent note part and anchor reader |
| COMMENTS | Currently typed unsupported for generic scene creation | Authenticated shadow lane, separate from manuscript authority; replies/state only within profile | Comment bodies/anchors plus shadow storage |
| TRACKED_REVIEW_SEMANTICS | Foreign revisions remain explicit loss/diagnostic, no silent Apply | Original/Current and supported explicit Apply; no automatic authority | Native revision readback, signed round, replay |
| TABLES | W5 bounded geometry/properties, supported merges | Retain table properties through supported text edits | Independent raw table reader |
| MEDIA_ASSETS | Validated inline PNG, bytes/placement/alt/dimensions | W4 text-offset binding and unchanged binaries | Independent image hashes, positions, extents |
| UNICODE_IME_LOCALE | Code-point fidelity within actual supported inputs | Same, with exact coordinate guards | Unicode raw readback; no universal IME claim |

G Word-origin notes/comments sample must be retained as typed loss, not used as a false EXACT result. Any loss of already supported G/R semantics is a defect. Unsupported foreign semantics cannot be promoted solely by this matrix.

## Composite coverage

Required interactions remain the approved nine W6 cases: merged/property tables with images/text; reused PNGs with distinct placements; edit before image beside Unicode/link/comment; lists/headings/images/hardBreak; notes+comments; repeated content across scenes; write-failure recovery for media/table import; large input without truncation; hostile combinations without writes. Maintained tests cover full canonical comparisons for five-cycle table/media/list combinations and a 1500-paragraph text boundary. Existing transaction, review and hostile suites remain mandatory. Physical lifecycle evidence and unresolved combinations are recorded separately; component pass is not physical acceptance.

## Current claim

Implementation prerequisite only until real physical proof, delivery and exact merged verification. Zero self-awarded cells. W6 closure requires all nine interactions and route distinctions; W7 then verifies the official Word420 set. Two older donor tests reproduce failures on unchanged base (obsolete batch-label assertion; lexical http prohibition over XML namespace text); they are not hidden or described as passing. Historical dirty-scope donor assertions must be evaluated on committed identity, not widened silently.
