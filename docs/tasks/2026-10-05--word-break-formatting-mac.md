# Mac Word break formatting and exact topology

TASK_ID: WORD_BREAK_FORMATTING_MAC_20261005
TYPE: PRODUCT_CODE
BASE: 60a22cd0ff93e47104ac7d78980c7cf17a71b476
STATUS: FOCUSED_CANDIDATE_READY_NATIVE_PENDING

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
