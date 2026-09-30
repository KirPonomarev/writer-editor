# Mac user bookmarks and internal links

TASK_ID: WORD_USER_BOOKMARKS_MAC_20260930
TYPE: CORE
STATUS: TARGET_NOT_ACCEPTED
ROLE: BOUNDED_PRODUCT_FEATURE_CONTRACT
CLAIM_BOUNDARY: Same-scene declared user bookmark and internal-link operations on Mac
CANON_VERSION: v3.13a-final
CHECKS_BASELINE_VERSION: v1.3
BASE_SHA: 9a8922d54e60169ea820c159b1d8ec56a8ec9f7c
DESIGN_SCOPE: EXISTING_MENU_AND_DIALOG_CONTRIBUTION; NO_GLOBAL_VISUAL_CHANGE
DIFF_BUDGET: 48 exact paths, at most 5600 authored added lines plus generated bundle and exact-byte governance companions; widen only via clean-base preflight

## MICRO_GOAL

O: User bookmarks and internal links survive G import, local authoring including same-scene bookmark duplicate, Y0 export and authenticated clean R without target substitution, label loss or silent unlink.
T: Core validated registry and private baseline -> Kernel capability/revision checks -> existing atomic transaction -> generation-bound saved projection -> governed DOCX export.
H: Existing parsers treat all user bookmarks as unsupported and external-only links as the only form. Separate stable local identity and validated bounded endpoints permit lossless same-scene Word anchors while keeping transport authority separate.
B: Preserve all pre-existing rich content, annotations, pending state, owner checkout, key storage and historical proofs. No new dependency, network, sidecar writer or shell/style redesign.
P: Native discovery fixtures; real Core and main-seam hostile tests; authoring ACK/stale-save tests; SOURCE and packaged Mac native authoring/export/changed-return/restart/history; independent literal XML inventory; required CI and exact merged-head checks.
I: Exact base above; branch codex/word-user-bookmarks-mac-20260930; candidate SHA and synthetic artifact hashes bound only after tests actually execute.

## ARTIFACT

Bounded Core registry, typed internal links, existing command/UI/transaction integration and lossless DOCX parser/export path. Feature and surface contracts exist before runtime edits.

## ALLOWLIST

- docs/tasks/2026-09-30--word-user-bookmarks-mac.md
- docs/OPS/RTK/FEATURE_INTEGRATION_MANIFEST_WORD_USER_BOOKMARKS_V1.json
- docs/OPS/RTK/SURFACE_MANIFEST_WORD_USER_BOOKMARKS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json
- scripts/ops/rtk-interop-data-c1.mjs
- scripts/ops/r24/corrective/post-audit-certification-set.mjs
- docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json
- docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json
- docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json
- src/core/word-user-bookmarks-v1.cjs
- src/core/document-content-envelope-v1.cjs
- src/export/docx/fullManuscriptDocxReviewPacketSource.js
- src/export/docx/docxReviewPacketBuilder.js
- src/export/docx/docxMinBuilder.js
- src/io/revisionBridge/index.mjs
- src/io/revisionBridge/reviewTransportPackageParserV2.mjs
- src/io/revisionBridge/reviewTransportUserBookmarksV1.mjs
- src/main.js
- src/renderer/tiptap/userBookmarks.mjs
- src/renderer/tiptap/index.js
- src/renderer/tiptap/ipc.js
- src/renderer/editor.js
- src/renderer/linkDialog.mjs
- src/renderer/commands/projectCommands.mjs
- src/renderer/commands/capabilityPolicy.mjs
- src/core/entitlement-law-v1.cjs
- src/menu/menu-config.v2.json
- src/menu/menu-locale.catalog.v1.json
- src/renderer/editor.bundle.js
- src/command/commandSurfaceKernel.js
- src/shared/productCommandRegistry.cjs
- src/shared/workspaceQueryRegistry.cjs
- src/utils/docxImportLocalFilePreview.js
- src/io/docxHyperlinks.cjs
- test/contracts/rtk-word-canonical-comment-reexport.contract.test.js
- test/contracts/rtk-word-full-manuscript-current-project.contract.test.js
- test/contracts/rtk-word-user-bookmarks.contract.test.js
- test/contracts/rtk-word-user-bookmarks-runtime.contract.test.js
- test/contracts/rtk-word-user-bookmarks-authoring.contract.test.js
- test/fixtures/word-user-bookmarks-native-v1.json
- test/contracts/rtk-word-link-authoring.contract.test.js
- test/contracts/rtk-word-http-links.contract.test.js
- test/contracts/rtk-release01-terminal-claims.contract.test.js

- test/unit/r24-r5-lifecycle-physics.test.js

- test/unit/r24-wp200-durable-save-physics.test.js

- test/unit/sector-m-tiptap-runtime-bridge.test.js

## DENYLIST

No dependency, runtime network, new executable plugin, arbitrary field evaluation, alternative storage writer, global renderer HTML/CSS restructuring or false whole-plan acceptance. Do not change historical ESM/hash mutant bytes to accommodate a new dependency. No silent unsupported-composite flattening.

## CONTRACT / SHAPES

FEATURE_INTEGRATION_MANIFEST_WORD_USER_BOOKMARKS_V1.json and SURFACE_MANIFEST_WORD_USER_BOOKMARKS_V1.json bind product and interface planes. Optional registry stores stable IDs, names and bounded endpoints/revisions only; it never stores a duplicate manuscript. Validate raw present state before normalization. Absent/null defaults remain equivalent.

Word numeric IDs, names and equal quotes do not supply authority. User identity remains distinct from YRTK locators and _GoBack. Preserve exact document-global Word names with native case-insensitive uniqueness; collisions across scenes block publication with a typed reason. Rename retains ID; delete preserves label and explicit broken target. No opportunistic rebinding on name reuse, including a case variant or a surviving broken link in another scene.

Endpoints distinguish text-end from paragraph-mark-inclusive edge; collapsed point left-affinity is native-observed. Strictly-before/inside edits may map only when every possible exact edit location produces the same endpoint result. Native Word canaries prove text-edge insertion left-affinity at both range endpoints: insertion at start is included, insertion at end is excluded. A uniquely proven insertion follows this policy; ambiguous placement, deletion at an endpoint, split, text/scene copy, move or cross-scene transform has typed no-write behavior until its explicit subsequent proof.

Renderer preserves inert attrs and sends selection/intents. Core alone maps validated before/working content. A mapped root attr requires same-generation metadata projection and an ACK matching actual persisted bytes; stale response neither overwrites text nor clears dirty state. Verify subsequent save and editing during save at the real main seam.

Authenticated R uses the private exact baseline, trusted scene/block bindings and revalidation immediately before atomic publication. Generic G creates a new scene with fresh local identity. New tracked bookmark/link composites remain unsupported explicitly; this package cannot claim their acceptance.

Design evidence was gathered first with Lazyweb. The search did not supply a matching bookmark flow; its selected reference calibrates density only. Use the existing Yalken Commands inspector button, Command Palette and dialog controls with their current tokens. Native menu artifacts and locks remain byte-exact; raw menu source is not runtime publication authority. Functional behavior follows observed Word and existing product patterns; no external design code is copied.

Version discrimination was admitted by clean exact-base PRE before format edits on the unchanged 39-path scope. A nonnull registry uses a declared readable two-record scene payload v3 inside the existing doc-v2 length frame: exact format/version/requiredFeatures header, then one complete canonical document JSON. Null/absent registry preserves legacy encoding. A nonnull registry presented in an undeclared legacy single-record payload rejects before normalization: no released predecessor possessed this feature, and accepting that fabricated form would bypass version discrimination. Genuine legacy without the registry still upgrades through the checked first-operation recovery path. Future/unknown/malformed headers reject before normalization. The immutable previous reader and actual writer must refuse with zero scene writes, including old no-continuity startup; manifest version alone was independently shown insufficient. First local upgrade requires the existing readable premigration recovery snapshot before atomic publication; denied snapshot aborts without scene mutation. Native G retains its original input artifact. Exploratory external refusal probe is not exact-candidate acceptance.

HTTP compatibility extension was admitted by a fresh clean exact-base 40-path PRE before editing the existing HTTP test. The previous bare internal-anchor negative describes behavior superseded by this authorized feature: it now requires a positive typed broken-target tombstone with exact label and name. Forged namespace, meaningful tooltip, malformed/nested link, relationship and transport hostility negatives remain. No production heuristic may reject a valid standalone broken link merely to preserve the obsolete expectation. Existing parser hostility/malformed/budget diagnostic precedence and technical transport ownership enforcement remain unchanged.

Ordinary text Undo after rename is inside this package: ProseMirror may restore an older link spelling from its character slice while retaining the current canonical registry. A bounded Main-owned successful-rename receipt lineage may admit only the exact former href/name pair for the same privately authenticated stable bookmark ID, under project/file/lifecycle and current durable-source CAS. Core validates shape before this explicit admission and uses the current canonical name. The lineage is ephemeral receipt evidence, never a public alias authority, query truth, second manuscript or sidecar. Consecutive renames, another ID reusing the old name, foreign/public aliases and stale source/lifecycle are mandatory counterexamples; external links stay exact. Clean 40-path PRE was executed before these edits. The existing periodic backup must also pass its unsaved rich snapshot through the same checked Core projection when the matching private rename receipt is present, followed by immediate project/lifecycle/generation/durable CAS before the existing backup port. This protects text Undo followed by backup and process restart before ordinary autosave, without persisting aliases or introducing another writer. No valid private receipt means no repair authority. Actual backup and restore routes, unchanged legacy backup and hostile/stale zero-write are mandatory. Direct entity CmdZ remains a separate subsequent obligation.

Canonical routing qualification: the five exact bookmark IDs follow the existing governed writer bridge used by manuscript notes. They must resolve in the runtime command catalog, remain on the fixed UI bridge allowlist, pass dispatch profile/entitlement and repeated handler capability/lifecycle/source guards, and reach only the existing atomic writer. They do not acquire a new Stage10 Product domain or donor-kernel admission. Actual IPC-to-dispatch-to-write and native visible Command Palette first CRUD are mandatory; module-only harness success is insufficient.

The41-path PRE admitted a possible current-wording helper adjustment, but palette-only delivery does not require it: the RELEASE01 test, raw menu sources, runtime menu artifacts, locks, donor allowlist and Product registry remain exact base bytes. Existing gate-pinned current editor qualification and the entire historical predecessor chain remain enforced. No unused menu contribution or extra publication path is claimed. Bookmark QUERY reads a validated saved-scene context without manifest preparation or normalization writes; legacy defaults, future schema and unsaved/non-scene inputs are mandatory zero-write counterexamples. Mutation preparation separately rejects raw future manifests before any canonical manifest write, including changes during asynchronous preparation.

## IMPLEMENTATION_STEPS

1. Freeze native point/range, same-text/same-range identities, paragraph-mark boundary, broken-target and retarget inventories.
2. Implement pure registry validation/plans and strict import/export semantics with negative counterexamples.
3. Bind canonical commands, query, inert editor attrs and generation-bound save ACK to the existing transaction.
4. Add the bounded existing palette/dialog contribution and verify keyboard/error/broken states.
5. Run affected chains and mandatory gates, then final native SOURCE/PACKAGED proof and protected delivery.

Same-scene bookmark Copy is declared after clean-base PRE on the same39path scope: source endpoints come only from the private active bookmark record; fresh local identity and a distinct valid name are required. It copies no text, scene or transport. Native same-range/distinct-name example grounds this operation.

Minimal and review/full export routes are both within the declared publication contract; no loss through the existing minimal DOCX command. Expanded 39-path declaration was checked PRE on the clean exact9a89 verification worktree before minimal builder edit.

## CHECKS

CHECK_01_PRE: Read-only bootstrap, clean exact base, full applicable canon and architecture preflight before edits.
CHECK_02_CORE: Names, duplicate/missing endpoints, namespace spoofing, Unicode/surrogate bounds, paragraph edge, stable identity, target deletion/name reuse and conservative ordinary edit mapping.
CHECK_03_RUNTIME: Versioned payload validation, actual N-1 zero-write refusal, readable premigration snapshot/failure and interrupted recovery, raw registry authority, CAS/lifecycle/capability, stale query/dialog/ACK, editing during save, subsequent save, exact saved-vs-live metadata, atomic failure/recovery and replay zero-write.
CHECK_04_NATIVE: SOURCE and packaged Mac create/rename/delete, link label/retarget/remove, broken state, export/native Word changed return, save/restart/Undo/Redo and independent endpoint/link readback. Constructed fixtures cannot replace native proof.
CHECK_05_DELIVERY: Diff/scope review, required baseline, dependency/purity checks, guardrails, CI, protected merge and relevant tests on exact merged SHA. No skipped/todo/zero-test or historical evidence presented as current acceptance.

History distinction: ordinary text CmdZ/Redo must remain intact. Local bookmark CRUD and changed cleanR use existing recovery checkpoints and governed full rich restoreApply/restoreUndo, validated against artifact and current source; this is not direct entity CmdZ. Direct CRUD semantic CmdZ/Redo remains an explicit subsequent P2c/P2d obligation and prevents a whole-feature completion claim.

Dependency audit boundary: the actually executed full audit reports nine pre-existing development/toolchain findings (seven moderate, two high), matching the previous contour counts. Package and lock remain unchanged. The separately executed production subset is zero. This subset cannot replace the full C6D release audit: full release audit remains FAIL and prevents a whole-release-ready claim; this bounded feature contour does not rewrite that historical policy or add dependencies.

## STOP_CONDITION

Stop on identity ambiguity, unknown protected state, unrelated dirty work, missing required proof or authority leakage. After three identical failure signatures freeze exact expected/actual/artifacts and switch one hypothesis.

## REPORT_FORMAT

AGENT_FINAL_REPORT_V1 with exact SHA, basename scope, test coverage, commit/push/PR/CI/merge, limitations and one next step. Whole Mac plan remains open beyond this package.

COMMIT_REQUIRED: true
PUSH_REQUIRED: true
PR_REQUIRED: true
MERGE_REQUIRED: true
POST_MERGE_EXACT_HEAD_VERIFICATION_REQUIRED: true

## FAIL_PROTOCOL

Preserve original artifacts and receipt hashes. Typed conflict or unsupported outcome is never PASS for a promised positive operation. Cross-scene copy/transfer, arbitrary structural anchor transforms, REF fields, tracked bookmark/link composites and final frozen Mac feature qualification remain explicit plan obligations.

Native bridge correction admitted by fresh clean9a89 PRE42 before sanitizer edits: actual local-file preview and Main private-reference sanitizers preserve validated userBookmarkInventory; actual native dialog -> private preview references -> create-only transaction must preserve user endpoints and typed target IDs. Full raw inventory validation precedes interpretation, and all local-file budgets/private-path/forbidden-key checks remain mandatory. The actual renderer runs with attachIpc:false: publication must validate the renderer-owned complete captured content and generation through its existing channel, then apply only checked metadata without resetting PM history. No second IPC listener or mutation authority is introduced.

Native metadata counterexample at candidate11cda: the actual renderer applied the bookmark registry correctly, but its complete snapshot retained the scene meta block while Main CRUD had dropped it by spreading parsed.hasMetaBlock into a composer expecting metaEnabled. The preserved failure has zero first-create acceptance credit; 2139 passing tests do not replace that native outcome. All newly introduced bookmark composers explicitly preserve parsed metadata enablement and cards. CRUD/authenticated cleanR compare live metadata/cards with the trusted captured source before writes, while mapped ordinary save and backup preserve their validated working envelope. No exact-content ACK relaxation, duplicate IPC listener or renderer reset is admitted. The existing unrelated pending-recording composer has the same pre-existing pattern and remains a separate whole-plan obligation. Native SOURCE/PACKAGED replay on the corrected final candidate is mandatory.

Current-project full-export blocker admitted by fresh clean exact9a PRE43 before source edits. Actual native export in a nondefault project failed because the existing scope builder read DEFAULT_PROJECT_NAME. This promised positive blocks closure of the current bookmark/full-export package. Capture the active project identity before scope enumeration and revalidate it after asynchronous reads and before publication; unrelated default project state supplies no source or identity. Remove the cross-project default manifest fallback. The new actual Main scope contract preserves historical full-export oracles and tests unrelated empty/populated default projects plus lifecycle/capability races. Genuine nondefault SOURCE/PACKAGED export and Word return are mandatory; default-only native success cannot substitute. This is a correction of the current export outcome, not a second write contour.

Native Word field correction admitted by fresh clean exact9a PRE45 before edits. Actual Word16.112 ordinary Save converted exported w:hyperlink internal anchor to a balanced complex HYPERLINK local field. Complete literal XML disproved the preliminary lost-start hypothesis: Word moved the paired technical start to a body sibling immediately before the original paragraph; names and semantic endpoints remain exact. Preserve existing strict literal leading-body ownership; do not rescue malformed or genuinely orphan endpoints through text/IDs. Admit only bounded inert local field grammar. Actual native saved artifact and fresh SOURCE/PACKAGED exports must prove authenticated intake and selected apply. Canonical-comment reexport VM must load actual new private binding dependencies and fixture identities without weakening existing source/comment/lifecycle rejection assertions. Budget5100 for observed blockers; generated bundle and exact-byte companions remain separate.

Reopened-link compatibility admitted by fresh clean exact9a PRE45 before edits. Actual c8b8 native reopened source d3a223ff retains text, registry and IDs but pinned Tiptap adds absent target, rel, class and title defaults; the unchanged private source is incorrectly rejected as stale. A pure Core helper validates raw registry and typed links before filling only absent pinned defaults. The bookmark-specific Main comparison applies that representation to both snapshots; global comment comparison, metadata, raw disk CAS, unsaved-state, lifecycle and capability guards remain exact. IO identity updates preserve explicit attrs from the trusted exact source piece. Materialize durable candidate only after semantic effect classification, without inventing revision/effects. Meaningful negatives must retain custom attr differences, forged identity, label/extra marks and zero writes. Fresh native second exchange after reopen and five changed SOURCE/PACKAGED exchanges remain required. Budget5600 on unchanged45 paths covers this observed compatibility defect and tests; prior failed exchange has zero acceptance credit.

Maintained CI compatibility admitted by fresh clean exact9a PRE48. Three unit files extend the superseded static ACK denominator and direct Link import expectation to the actual new bookmark ACK paths and inherited UserBookmarkLink; preserve original six callsites, durable captured-byte/generation binding, dirty/lifecycle laws and all inert options. Historical ENT0/WP100 oracles remain byte-exact. Five new bridge commands are explicit literal IDs; repeated handler entitlement remains through the same product-owned law. No dead imports, no removed enforcement or hidden failure. Actual broad npm test is now mandatory alongside RTK/OPS and native qualification because the earlier local partial checks missed these CI failures.

Native review-card correction admitted by fresh clean exact9a PRE48 before edits. Actual c8b8 card cannot offer Apply: generic planner compares full visible quote to rich-frame bytes; renderer also routes only the HTTP private prefix to batch. Derive a no-write semantic preview only from the exact privately authenticated bookmark candidate/changeId after key/source/project/lifecycle/capability revalidation. Display bookmark/link names and semantic deltas in the existing card; no fictitious text replacement or authority from renderer. Existing Apply routes to the private batch path; single-command entry must also enforce this route and refuse generic fallback. Actual refresh -> renderer view/click -> Main private apply and forged/missing/stale/race zero-write tests plus native visible Apply click are mandatory. Tokens, composition and menu stay fixed. Harness command success alone gives no native UI acceptance.

The same reopened-link compatibility is admitted for bookmark CRUD by fresh clean exact9a PRE48 after actual Main bridge plus pinned-schema red reproduces imported minimal typed-link rename refusal USER_BOOKMARK_EDITOR_STALE, writes0. Only this bookmark saved/live comparison applies the validated missing-default helper; raw registry equality, disk CAS, metadata, unsaved-state, lifecycle/generation/capability remain exact. Generic-import reopen CRUD positive and explicit attr/identity/label/race negatives are required. Query stays pure with no new normalization or writer.
