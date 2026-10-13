# Lossless opaque text color serialization

TASK_ID: WORD_OPAQUE_COLOR_CANONICALIZATION_MAC_20261013
PARENT_TASK_ID: YALKEN_MAC_WORD_FINISH_V4_1_20261013
STATUS: COMPONENT_VERIFIED_DELIVERY_OPEN
DOCUMENT_CLASS: PROCESS
CLAIM_BOUNDARY: Exact producer regression and source correction; no native clipboard attribution or completed Word exchange.
TYPE: CORE
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
MODE: HARD_TZ
BINDING_BASE_SHA: e78264f8d59e8d50dbd717a6bd14357d61483acf
OWNER_AUTHORITY: Existing owner Mac Word V4.1 goal; Root delegated one causal opaque-color correction and normal delivery.
DESIGN_TOOL_ROUTER: INACTIVE_BACKEND_CORRECTION; architecture declaration carries the validated inactive enum.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_HEAD_VERIFICATION_REQUIRED=true

## MICRO_GOAL

Canonicalize only lossless opaque CSS RGB and hex spellings of ordinary visible
textStyle color in the existing shared document serializer. Preserve unsupported
values, all other marks and the strict raw pending-ledger invariant.

### MAP

O: Actual production PM DOMParser and serializer produce lowercase six-digit
hex for supported opaque colors; recording derivation preserves complete rich
Current/Original and bound note/history meaning.
T: Existing clipboard PM parser -> document serializer -> existing snapshot
transport -> Main recording validation -> Core derivation -> existing atomic save.
H: Installed Color copies raw CSS strings; pending validateSource accepts only
lowercase six-digit hex. RGB and uppercase hex refuse while canonical hex and
plain text succeed on the same frozen rejected source and exact edit intents.
B: Raw source ledger, round frames, notes/comments/private data, all noncolor
fields and existing source/session/Kernel/lease/CAS checks. Unsupported values
remain literal, with existing typed no-loss refusal. No new throw or fallback.
P: Maintained real PM RED before runtime edit; focused positive/negative and
complete affected-chain tests; generated renderer idempotence; independent
review, required baseline/RTK/OPS/CI, normal merge and exact merged verification.
I: Exact base above; codex/word-opaque-color-canonicalization-mac-20261013;
Node22.12.0/npm10.9.0. Native apps remain stopped.

## ARTIFACT

One serializer delta, regressions appended to two existing contracts, normal
compiler-generated companions and factual/mechanical bindings. Handwritten
runtime changed-line budget80; appended test budget600. Existing assertions,
test membership and all numerical limits remain unchanged.

## ALLOWLIST

- src/core/document-content-envelope-v1.cjs
- test/contracts/rtk-word-pending-recording-runtime.contract.test.js
- test/contracts/rtk-word-review-default-typography.contract.test.js
- src/renderer/editor.bundle.js
- src/preload.bundle.cjs
- docs/tasks/2026-10-13--word-opaque-color-canonicalization-mac.md
- docs/CONTEXT.md
- docs/HANDOFF.md
- docs/WORKLOG.md
- README.md
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/post-audit-certification-set.mjs

## DENYLIST

Every unlisted path; Core ledger/recording validation, Main, clipboard routing,
Color extension, renderer handwritten code, package/dependencies/workflows;
unsupported-value stripping, alpha approximation, style or history rewriting;
native/UI/profile/authority writes, new runtime copies, resource-cap changes,
reset/stash/clean/rebase/force push or merge bypass.

## CONTRACT / SHAPES

EXISTING_SEAM: canonicalizeDocumentJson validates raw optional domain state
before cloning; normalize supported color only on copied ordinary marks in the
existing content walk. Opaque ledger/history attrs are not traversed or changed.
Allowed exact spellings: case-insensitive three/six-digit hex and comma-form
rgb integer channels0..255, surrounding whitespace; output lowercase six-digit
hex. Unknown types, invalid channels, alpha and other CSS syntax stay literal.
No unsupported-color exception is added: readEditorDocument's existing fallback
must not silently lose rich content. No coercion of object values or accessors.
Product Core owns truth; existing save/record commands and Kernel own mutation;
Design OS and surfaces remain unchanged. No new schema, port or feature registry.
All existing async source/session/generation/lease and authoritative replay checks
remain. Compiled artifacts are regenerated only by the unchanged normal compiler.

## IMPLEMENTATION_STEPS

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ.
Full ordered current startup completed; fresh remote main/base and clean branch,
registered worktree and both storage UUIDs/writability verified. Architecture
F3H_OPAQUE_COLOR_PRODUCT_ARCHITECTURE01.json preflight actual0 before task write.
Run OPS-GATE E0 and obtain Root task review before runtime/test edits.

## CHECKS

CHECK_01_PRE_IDENTITY: Actual clean-base bootstrap, fresh remote, mounts and
architecture preflight completed before task edit; never rerun PRE after writes.
CHECK_02_POST_E0: Task OPS-GATE and independent Root review before code edits.
CHECK_03_POST_CAUSAL: Maintained actual RED then focused corrected proof.

Append minimal production PM regression, run actual RED on unchanged serializer
and retain raw TAP/process/source hashes on T777. Implement only declared seam;
prove RGB/hex/control, unsupported retained/refused, full marks/text/history,
Original, source immutability and protected accessor refusal. No native claims.

### CHECK_03_ACTUAL_RESULTS

F3H_OPAQUE_COLOR_RED01 is a retained fixture-setup failure from separate PM
module instances; same-bundle DOMParser resolves it. RED02 reproduces raw RGB
on the unchanged serializer. Focused corrected proof passes6/6 selected tests;
these are filtered evidence only. Six whole affected/source-risk contracts
pass337/337 with zero exclusions and immutable test/source inputs. Both normal
builds succeed with byte-identical final bundles; renderer changes, preload does
not. Raw failures from incremental fixture assertions are retained on T777.
Root source review is conditional on the remaining required gates and delivery.
Owner says continue only code: no native launch or keyboard actions.

### CHECK_04_POST_CHAIN

Run complete affected contracts and source-risk neighbors, unchanged compiler
twice, independent review and exact mechanical binding. Run mandatory repository
gates and normal commit/push/PR/CI/merge/exact-head verification; do not skip or
relabel failed evidence. New renderer bytes invalidate old affected native proof.

## STOP_CONDITION

Stop for semantic loss, wider grammar/authority need, foreign WIP or third same
failure. Preserve every failure and existing profile. One normal PR/revert owns
this coherent scope. SOURCE25 remains FAILED; its actual clipboard text/color
attribution is UNKNOWN. No complete native cycle or original Mac-plan closure.

## REPORT_FORMAT

One text block with exact identities, changed basenames, test coverage and full
delivery outcomes. Evidence and new materials remain dated T777 task folders;
temporary small test artifacts use declared D03, no persistent alternate storage.

## FAIL_PROTOCOL

Preserve exact error, source/input hashes and raw logs. After three identical
signatures stop that loop and present one causal next hypothesis. Missing or
excluded coverage never becomes acceptance; scope expansion requires fresh
admission before its first edit. Required delivery remains open until complete.
