# Mac Word break formatting and exact topology

TASK_ID: WORD_BREAK_FORMATTING_MAC_20261005
TYPE: PRODUCT_CODE
BASE: 60a22cd0ff93e47104ac7d78980c7cf17a71b476
STATUS: NATIVE_SOURCE_PACKAGED_OBSERVED_DELIVERY_PENDING

Original owner priority remains complete Mac novel-text portability. PR2080 is
delivered: CI19/19, both RTK3284/3284, exact merged428/428 plus real Git/OPS
verification. Native19ae1ccc4 SOURCE/PACKAGED and final572-file equivalence are
separate observed evidence. Baseline2199passed,59historicalskips excluded.

## MAP

- O: Word font and language changes on a hardBreak survive signed preview,
  explicit Apply, Save/reopen, ordinary/Review export and replay in both Mac builds.
- T: validated Word runs and signed export IR -> existing private preview ->
  Kernel/Main revalidation -> Core document validation -> leased atomic scene
  transaction and journal. No new command, writer or authority schema.
- H: LF-only rejection hides modeled formatting; language validation excludes
  breaks, and standalone formatting lacks an exact typed-break topology check.
  Complete finite metadata support plus an ordered break-vector guard resolves
  the positive route without accepting silent line/page/column changes.
- B: preserve text, neighboring marks, comments, exact break types and all lease,
  CAS, source/raw hashes, journal/replay and recovery invariants. No new UI design,
  dependencies, runtime network, unknown property normalization or owner corpus.
- P: actual signed candidate/Main and PM roundtrip first; native SOURCE/PACKAGED
  before broad stable checks; mandatory CI/delivery and exact merged verification.
- I: exact base above, isolated synthetic profiles, actual artifact/build hashes.

CHECK_01 ran BEFORE edits: identity/mount, read-only bootstrap, unchanged canon
and clean architecture preflight. CHECK_02+ runs AFTER changes. Root owns
docs/OPS/build/native/proof/delivery; code agents own disjoint declared files.

## Contract

Before ANY formatting candidate for a paragraph, compare the complete ordered
offset/type break vector from signed formatIr runs to validated returned text
and typedBreaks. Reject malformed, moved, swapped, inserted/deleted or changed
types, including a line-to-page change combined with bold on neighboring text.
LF equality never supplies semantic authority. Keep unknown/ambiguous style and
all stale identity refusals. Empty ranges do not become changes.

Retain validated textStyle language tuples on hardBreak nodes as run metadata;
preserve typed attrs and unrelated marks. Language Apply must set/remove tuples
consistently on text and breaks without changing neighboring ranges. Existing
PM schema, clipboard HTML, import and both exporters must roundtrip the value.
Do not drop inherited language to make a font-only test pass. Modify adapter
paths only when executable evidence demonstrates an omission.

## Concrete native regression

Retained actual Word pair in predecessor evidence: PACKAGED02-review-export.docx
c833d4d9bb985430f4c2ac6f96985cf56c1daa5938729293b28df3581df05729;
PACKAGED02-word-changed.docx
77fba3ad26bf7414827b923ef36d8303193c5f3426abf36ceaf437226b5364b7.
Both have paragraph1 line break UTF16[35,36). Word adds inherited Times New Roman
and language {val:ru-FI,eastAsia:ru-RU,bidi:ar-SA};12pt remains unchanged.
This is an inherited font AND language case, not a font-only example.

## Proof and delivery

Positive: actual signed parser/preview/Main Apply, inherited and explicit
font/language set/remove on line/page/column, adjacent breaks, exact neighbors,
PM schema/HTML roundtrip, raw ordinary/Review XML, journal/replay/reopen.
Negative: changed complete break vectors, malformed tuples/unknown properties,
forged map/offsets/raw hash, stale scene, no unauthorized or partial write.
Native: fresh export, actual Word save/change, truthful preview, explicit Apply,
restart, both exports and independent XML/saved-state observations. Broad tests
follow stable native; no skipped/self-authored success substitutes for an oracle.

Default commit/push/PR/merge and exact clean merged verification are required.
One integrated rollback; no whole-plan completion/percentage from this packet.
Next substantive mixture uses the shared deterministic MULTI_SCENE C2 manuscript
and FULL_SYNTHETIC_NOVEL100k base: pending text plus comments with unchanged
revision ledger, before broader composite edits and full five-cycle acceptance.
Original remaining requirements and complex objects stay in the full plan.

## Focused first candidate

Real signed export/activation/Main formatting Apply/journal/reexport passed5/5
for line/page/column explicit font+language, inherited font+language and changed
type zero-write. Full existing N3 candidate contract43/43; language/canonical
and both-export contracts49/49; typed-break/actual PM schema tests18/18, all zero
skips. These are automated observations, not native or whole-plan acceptance.

Actual PM DOMSerializer/DOMParser and paste transaction exposed language-only
span loss because upstream textStyle parsing required CSS. The declared adapter
repair accepts a validated data-word-language span while retaining upstream
rules. XML DOM compatibility used in the test is bounded; no native clipboard
proof is claimed. Exporters and formatting writer needed no change.

## Stable native and affected-chain observations

Native candidate `fc9aa9f56530bcb3375dc1dcf2732a8ff3a0443b` was executed in
SOURCE and PACKAGED on macOS27 arm64 with Word16.112. Each used a fresh signed
export and real Word selections of line, page and column breaks at UTF16[1,2)
in three separate paragraphs. Georgia18pt changes plus the inherited complete
language tuple returned as15 operations through explicit Apply. Literal text,
paragraph count and break kinds remained equal. Neighbors retained inherited
Times New Roman; Georgia did not spread into adjacent text. Both ordinary and
Review reexports preserve all three break fonts, sizes and language tuples in
raw XML. Each app really restarted; canonical scene bytes remained exact and
the saved formatting journal was inspected. PACKAGED required explicit scene
selection before that query; the earlier unbound view is retained as evidence.
Reopening the old return AFTER a new export is stale-refused without a second
write; this is distinct from an idempotent fresh-session Apply claim.
External NATIVE_OBSERVATIONS_VERIFIED.json binds16 artifacts and literal checks.

Nine complete affected test files passed387/387, zero skipped/todo/cancelled,
on the native SHA in120.85s; source/test hashes stayed unchanged. OSS policy
and npm audit passed. Mandatory CI and delivery remain pending.

### Discovered original-plan residual, not silently accepted

Actual Word Select All -> Georgia18 also writes pPr/rPr rFonts(ascii,hAnsi),
sz and szCs. The current paragraph-mark model only carries language, so all
four paragraphs correctly refuse that unmodeled typography. Retained Word
artifact297b4b6ddab4532bd186f3dc0384fa0a1c800fc85e8cfdea8badaa2d99855bcc
and baseline d9e85fdc848588db0d7d2682f77dd63802aed8df18246abd6315600d4e6e1c4f
bind this gap. No guard was removed; break-only native scope is explicit.
Future complete novel typography needs a finite paragraph-mark carrier with
separate script font axes and normal/complex-script sizes, preserved on empty
paragraphs, both exports and subsequent authoring. Also retain the packaged
restart binding presentation issue. These join the original residual plan.
Fixture setup initially used an incomplete sectPr, rejected WORD_SECTIONS_INVALID;
a minimal corrected seed passed before positive execution. One Word focus error
was undone and the failed artifact retained. Neither is product success evidence.

## CI consumer correction — 2026-10-05 06:12 EEST

CI37257433260 at1f57fa059 failed both full RTK lanes on the same obsolete
renderer test:3294 passed of3295, zero skips. The old assertion required
valid manuscript break language to refuse, contradicting this packet's
validated preservation contract. Other executable jobs passed; dependent
merge and compatibility gates correctly failed. This run is not acceptance.

A clean-head declaration amendment at1f57fa059 explicitly adds the renderer
consumer test; original PR base60a22cd0f is unchanged. The repaired full file
passes14/14, zero skips: exact adjacent marks/language are preserved, and
malformed tag, unknown tuple key, empty tuple, unknown field and unsupported
mark refusals remain. No runtime bytes changed. It is now in the affected and
exact-merged test lists. Repeat mandatory CI before merge.
