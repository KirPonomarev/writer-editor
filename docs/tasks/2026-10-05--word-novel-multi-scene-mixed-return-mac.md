# WORD_NOVEL_MULTI_SCENE_MIXED_RETURN_MAC_20261005

TYPE: CORE
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
STATUS: ACTIVE_IMPLEMENTATION_NOT_DELIVERED
DOCUMENT_CLASS: PROCESS_TASK_CONTRACT
BASE_SHA: 0612a9ea13736d47e4f59c6e4964a1b71595969f
CLAIM_BOUNDARY: Scoped Mac book mixed return; complete novel and original Mac plan remain open.
DELIVERY_POLICY: COMMIT_REQUIRED=true PUSH_REQUIRED=true PR_REQUIRED=true MERGE_REQUIRED=true POST_MERGE_EXACT_REQUIRED=true

## MICRO_GOAL

One confirmed authenticated Word return applies independent text/revision edits in two saved scenes, checked supported untracked formatting in every actually affected scene, and one global discussion delta through the existing recoverable publisher.

## ARTIFACT

Existing Main/Core/parser routes, existing affected contracts and generated bundle; root-owned task/FIM, exact OPS companions and delivery evidence. No second writer or truth store.

## ALLOWLIST

- `src/main.js`
- `src/io/revisionBridge/index.mjs`
- `src/core/word-pending-comment-return-v1.cjs`
- `src/core/word-pending-text-revisions-v1.cjs`
- `src/core/word-comment-return-delta-v1.cjs`
- `src/core/project-tree-cohort-v1.mjs`
- `src/core/project-transaction-v1.cjs`
- `test/contracts/rtk-word-scene-identity-main.contract.test.js`
- `test/contracts/rtk-word-pending-return-runtime.contract.test.js`
- `test/contracts/rtk-word-pending-rich-blocks.contract.test.js`
- `test/contracts/rtk-word-mixed-return.contract.test.js`
- `test/contracts/rtk-word-mixed-return-transaction.contract.test.js`
- `test/contracts/rtk-word-project-tree-cohort.contract.test.js`
- `test/contracts/rtk-word-header-footer-transaction.contract.test.js`
- `src/renderer/editor.bundle.js`
- `docs/tasks/2026-10-05--word-novel-multi-scene-mixed-return-mac.md`
- `docs/OPS/RTK/FEATURE_INTEGRATION_MANIFEST_WORD_NOVEL_MULTI_SCENE_MIXED_RETURN_V1.json`
- `docs/CONTEXT.md`
- `docs/HANDOFF.md`
- `docs/WORKLOG.md`
- `docs/OPS/RTK/RTK_TEST_GRAPH_CATALOG_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_DATA_C1_POLICY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C1B_TEST_INVENTORY_V1.json`
- `docs/OPS/R24/CORRECTIVE/C2A_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/R24/CORRECTIVE/PK1R1_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `docs/OPS/RTK/YALKEN_INTEROP_100_GOVERNANCE_CHANGE_APPROVALS_V1.json`
- `scripts/ops/rtk-interop-data-c1.mjs`
- `scripts/ops/r24/corrective/post-audit-certification-set.mjs`
- `docs/ARCH_DIFF_LOG.md`

- `scripts/ops-gate.mjs`
- `test/contracts/ops-gate-core-purity-exception.contract.test.js`

- `src/io/revisionBridge/reviewTransportPackageParserV2.mjs`
- `src/export/docx/docxPendingRevisions.js`
- `src/core/document-content-envelope-v1.cjs`
- `src/core/word-pending-recording-v1.cjs`
- `src/core/word-pending-recording-comments-v1.cjs`
- `test/contracts/rtk-word-pending-formatting.contract.test.js`
- `test/contracts/rtk-word-pending-text-revisions.contract.test.js`
- `test/contracts/rtk-word-pending-notes.contract.test.js`
- `test/contracts/rtk-word-user-bookmarks-runtime.contract.test.js`
- `test/contracts/rtk-word-pending-recording.contract.test.js`

## DENYLIST

All undeclared source paths; renderer/preload/UI redesign; dependencies and runtime network; personal project data; staged per-scene writer loop; authority or typed-refusal weakening; skip/todo or fabricated acceptance; reset/stash/clean/checkout/rebase/force-push/commit-amend. No successor push/PR/merge until predecessor terminal closure and exact merged source-tree equality0612. Preserve frozen predecessor and unrelated work.

## CONTRACT / SHAPES

### Outcome and hypothesis

Full-manuscript Review export already collects distinct saved scenes. Pending mixed return currently refuses multi-scene input. Reuse the existing journaled tree-cohort publisher with an explicit independently validated mixed-Word semantic admission: derive every changed scene and one global discussion delta before any mutation, then publish under the existing project lease. One explicit Apply changes text/revisions in A/B and preserves scene identity/order and protected notes. C stays raw-byte exact if Word did not change its formatting; actual formatting-only changes are separately validated and explicitly included in the same cohort, with body/graph protected. No staged writer loop.

CHECK_01 выполняется ДО любых изменений; CHECK_02+ выполняются ПОСЛЕ. Clean bootstrap and27path architecture preflight passed before root task/FIM/exception writes. The scoped timing exception is recorded in ARCH_DIFF_LOG; predecessor remains OPEN, not delivered truth. All delivery flags true. Publication barrier: PR2087 terminal delivery and merged tracked tree identical to0612; otherwise STOP, no implicit rebase.

### Ownership and boundaries

Core owns canonical scenes, ledgers, scene-local history, global discussions, cohort admission/journal/recovery. Existing Kernel commands and Main snapshot revalidation/project lease remain sole mutation authority. Existing immutable Review projection and scene-history controls; no new UI, dependency, port framework, writer or durable editorial-group format. Fixed scene topology only. Old staged multi-scene route is not silently reclassified as atomic.

### Ordered acceptance

1. R0 actual Main signed three-scene return: text A/B plus reply A reproduces typed no-write refusal on base.
2. Existing real publisher completes one Apply; independent Current/Original, old/new revision identities, format and one global graph; unchanged owners and order byte-exact, formatting-only owner body/graph exact with returned styles retained. Cancel/replay/stale sibling/forged owner/dirty source/expired lease do not write.
3. Unchanged native artifact05424f26b105e4ed4e4908ffa05dae59280b1978609fab9cdf881eb9c6895c2f: strict XML ownership rPrChange→rPr→r→ins, independent parent/child decisions, exact native provenance and identity remapping, Original/Current and Review+Minimal five reimports. Child reject/parent accept, child accept/parent reject, all, UndoRedo/save/load/recording; malformed parents/spans/duplicate identities and unsupported overlaps refuse before writes. Schema5 and full/compact restored5 require feature; run exact base0612 older reader against emitted bytes. Preserve schema1–3 and note points; incompatible note/nested-format combination refuses before write, remains OPEN.
4. Per-scene Undo A, Undo B, Redo B, Redo A and reverse order; current foreign replies and scene history survive. Completed B changes before A admission survive; concurrent B mutation during admission refuses. Save/reopen fresh context; normal subsequent Save and decisions retain managed receipt correctness.
5. Early genuine short Word changed-save through SOURCE and PACKAGED before full graph. Native Apply/save/restart/UndoRedo/reexport; independent finished DOCX oracle.
6. Fresh-process SIGKILL across journal, each scene/comment/receipt/recovery packet/marker/cleanup and during recovery. Recovery converges exact all-before/all-after; foreign bytes fail closed with readable evidence. Same-process fault injection is not SIGKILL acceptance.
7. Freeze stable candidate, exact affected whole suites, full mandatory baseline/RTK/security/OSS/OPS/CI, diff review, commit/push/PR/merge and merged exact replay. Draft until all required gates pass.

### Product remainder retained

This short packet does not certify100000-word composed multi-scene capacity, five genuine changed Word exchanges, selected-chapter DOCX, named style catalogs, cross-scene structural changes or original full Mac plan. Tables and complex objects are deferred, not removed. Genuine early Word artifact05424f26b105e4ed4e4908ffa05dae59280b1978609fab9cdf881eb9c6895c2f is refused before Apply: nested language-format revisions inside a fresh insertion are not representable losslessly by the existing disjoint ledger. Preserve the failed artifact unchanged. The earlier proposed Track Formatting OFF/ON precondition was not executed and is superseded: lossless import of this observed nested insertion/run-format composition is part of current acceptance. No accepting/deleting changes in Word, tracking switch, parser-only whitelist or flattening substitutes for independent revision semantics. Broader compositions remain explicit OPEN requirements. Empty-paragraph typing draft remains subsequent scoped repair. No percentage derives from test counts.

### Inactive emission default comparison —38B target

Actual unchanged05424 Word settings changed defaultTabStop720→708. Signed scene documentFormatIr marks720 as explicit=false; independent word-part inspection found no run/literal tab carriers and retained explicit numbering tab positions. Observation alone is not mutation authority.38A required officeModeTransport=true and correctly refused this artifact: its actual signed style flag is false. Read-only source trace confirms the flag controls Google-Office empty-section emission, independently of HMAC/round authority. Do not change that source flag or file.

38B permits the existing authenticated Main route to request a default-off read-only comparison only after its existing verified capsule/round, sections, project and source checks. Exact implicit720→708 is equivalent only if complete baseline/returned effective tab carriers are absent; unknown protected story/note ownership remains refused. Explicit settings, other values, missing permit, run/literal/numeric-entity/protected-region tabs retain typed refusal. Parser comparison is never write authority: Core regeneration, Kernel capability, project lease and final CAS remain mandatory. Canonical authored property, third-scene bytes and all revision provenance are preserved. No new registry/writer/security boundary, DOCX mutation or cap increase.38B exact-base clean-peer preflight passed before replacing the38A predicate.

### Supported untracked Word formatting —38C target

The unchanged genuine05424 file also carries untracked inherited paragraph spacing/language and run properties in Alpha/Beta/Gamma. This still refuses MIXED_RETURN_STRUCTURE_OR_FORMAT_CHANGED after earlier parser fixes. Do not strip the observable properties or rewrite old histories to obtain equality. Import supported validated paragraph/run formatting losslessly while retaining strict text/ancestor topology, headings/list semantics, scene ownership and every prior pending revision meaning/provenance. Existing tracked-format before/after guards cannot be relaxed by labeling changes untracked. Unknown properties remain typed refusals; named-style catalog identity remains OPEN.

Formatting-only Beta is actually affected in this file: its source bytes may change to preserve Word formatting, while body/control text and graph remain exact. Previously untouched-byte assertions remain required for cases where Word did not alter formatting. Preserve prior rich source in roundUndo; Undo/Redo and reexports must prove prior/returned styles rather than restoring stale discussion snapshots. Existing native confirmation identifies every affected scene and formatting-only changes. Exact38C clean-peer preflight passed before this amendment's runtime edits, same38 paths and one atomic outcome/rollback.

### Rollback

Revert only this bounded admission/routing change while preserving canonical user scenes, graph, history and readable recovery. New receipt semantics require explicit older-reader refusal; code downgrade is not automatic data rollback. Temporary delivery timing exception expires at predecessor closure and does not waive ordered publication.

## IMPLEMENTATION_STEPS

Root prepares task/FIM/declared timing exception; code agent captures R0, preserves independent nested formatting/text revision semantics and explicit older-reader refusal, derives all owner scenes plus one graph, adds independently validated cohort semantics and Main leased publication; root executes early native both origins. Address focused failures before frozen global gates, then complete ordered delivery.

## CHECKS

CHECK_01_PRE_STARTUP: read-only bootstrap, authoritative reads, exact secure mount/registry/branch/scope, clean base and architecture preflight. Initial27-path preflight and clean exact-base peer29-path,30-path and31-path amendments PASS;38-path amendment passed clean exact0612 peer before any of its seven new runtime/test paths were edited. This is a scoped amendment, not retroactive initial-first-write proof; 29-path amendment precedes OPS catalog/test edits;30-path amendment precedes pending-text binding-version comparison repair;31-path amendment precedes rich-block formatter extraction maintenance. Existing successful preflight predates task/FIM/code edits. E0 task-shape gate is separately required; early draft edits are not acceptance and any late E0 cannot retroactively certify first-write sequencing.
CHECK_02_POST_SCENARIO: R0 actual refusal retained; corrected actual Main whole project Apply/save/reopen, per-scene Undo/Redo and graph/owner/C-preservation; cheapest targeted negative oracles and fresh SIGKILL/recovery.
CHECK_03_POST_NATIVE: genuine Word changed-save in SOURCE and PACKAGED; Apply/Cancel/save/restart/UndoRedo/finished DOCX independent readback. Short proof does not imply100k/five-native-exchange acceptance. Measure capacity before broader composed novel proof.
CHECK_04_POST_REQUIRED: frozen candidate affected whole suites, required full baseline and RTK, security/OSS/audit/build, exact OPS and guardrails; explicit skips separate from executed coverage.
CHECK_05_POST_DELIVERY: scope/diff review, commit/push/PR/CI/merge and clean exact merged replay. Publication waits predecessor closure; draft until all required gates pass.

## STOP_CONDITION

Authority/base/source mismatch, undeclared writes, foreign WIP, wrong scene, silent comment/history loss, stale publication, unsupported recovery, missing required gate or different predecessor merged tree. After third identical failure stop unchanged loop and record a new hypothesis.

## REPORT_FORMAT

One text block KEY: VALUE; task, before/after/merged SHA, basenames, exact test counts/qualification, commit/push/PR/CI/merge/exact verification, open limits and one next step. No narrative PASS from this task itself.

## FAIL_PROTOCOL

Preserve exact error, seed, identities, artifact hashes and protected state; no blanket fallback or data restore. Repair only declared paths, execute cheapest affected proof, freeze then required gates. Any scope widening is amended before edit. Temporary timing exception stays task-local and expires at predecessor closure.


### 38D — actual native routing correction, 2026-10-06

Frozen SOURCE02 opening unchanged genuine artifact05424 refused before confirmation. All11 pre-existing project files stayed byte-exact; no files were added. Read-only execution of the actual frozen Main comment-scene builder identified `PENDING_COMMENT_DOCUMENT_FORMAT_CHANGED`: the narrower comment-only lane runs before complete book preparation, so its stricter document-format predicate prevents the already scoped mixed book planner from being reached. Parser-only success was insufficient and is not native acceptance.

After clean exact0612 peer preflight `architecture-declaration.38paths-D.json`, authorize only routing priority in existing main.js and declared addressable tests: authenticated multi-scene pending preparation runs before comment-only routing. Complete book guards remain mandatory; any typed book failure is terminal. Null not-applicable continues existing single-scene/comment-only behavior; prepare book once. No relaxed format predicate, exception whitelist widening, new writer or scope paths. Preserve SOURCE02 refusal evidence. Original05424 must pass final actual activation and native Source/Packaged Cancel/Apply/reopen/export; forged/stale/dirty/unsupported book requests cannot fall through into another writer. Broad gates remain after stable genuine route. Predecessor2087 publication dependency remains mandatory.


### 38E — preserve existing reply routes; supersedes 38D, 2026-10-06

Risk review found universal book-priority38D intercepts existing full-book unchanged-pending reply and protected note/story paths. These paths must remain compatible. Before the adjusted runtime edit, clean exact0612 peer preflight `architecture-declaration.38paths-E.json` passed. Supersede38D priority: restore comment-only-first and give its private authenticated pending-comment scene reader the same narrowly bounded38B internal read-only inactive-default comparison permit after its existing capsule authority and signed source-hash checks. Original05424 then proceeds through existing projection/partition composite outcomes to existing complete-book fallback. No new classifier, fallback error whitelist, format predicate or publication authority. Unknown/explicit/different defaults and effective tab carriers still refuse. Prove existing full three-scene reply-only byte-exact behavior and notes/story compatibility plus original05424 actual activation before native final proof. Historical38D test greens are not final acceptance.


### 39 — post-restart genuine editorial Undo geometry proof, 2026-10-06

SOURCE03 original05424 Preview/Cancel/Apply, three-scene exact durable readback and five discussion messages, controlled restart and native DOCX reexport were observed; Word opened the returned file without visible repair and displayed retained native language/bold revisions. Native Gamma editorial Undo then refused `RECORDING_COMMENT_ROUND_SOURCE_MISMATCH`; all three scene bytes and discussion graph retained the applied values. This is a retained failed acceptance link, not stable-route PASS.

Read-only exact savedGamma reproduction finds its restored frame comparison and retained revision definitions equal; inverse geometry mapping incorrectly also requires imported supported untracked paragraph/run styles to reverse before anchors can be mapped. Before code edit, clean exact0612 peer preflight `architecture-declaration.39paths.json` passed. Add only word-pending-recording-comments-v1.cjs to existing38 paths. Permit a round-decision-only verification projection of the existing38C non-geometric style fields (spacing, paragraph-mark language, textStyle fontFamily/fontSize/language) during reconstructed-source vs exactbaseline geometry proof. Frame and Core-restored prior rich source remain exact, retained event provenance remains strict, text/topology/headings/lists/nonstyle marks remain strict. Default authored recording-save inverse proof remains strict. No canonical styles/source/history rewrite, revision synthesis, new writer or authority. Prove genuine savedGamma+Alpha UndoRedo, foreign replies, forged geometry/nonstyle/retained events and final Source/Packaged native on original05424. Existing full novel and five genuine exchanges remain open.


39B before zero-fresh predicate edit: clean exact0612 preflight passed for same39 paths. Formatting-only Beta also requires UndoRedo: within round-decision geometry proof only, permit zero fresh revisions iff exact frame and retained events match, projected full rich source and before/after text agree, and a genuine supported untracked style delta exists. Use an empty validated anchor splice plan; canonical rich restore remains exact. No-style-delta, forbidden geometry/nonstyle/provenance cases refuse; authored recording-save requirement remains strict. Final Source/Packaged acceptance covers all three affected owners.


Predecessor delivery dependency closed on2026-10-06: PR2087 merged06b4523f55ff77ac4306055d8e5d5395bdd204d9 with19/19CI, clean merged tracked tree equal0612, merged818 affected tests and63C1C3 plus OPS/guardrails passed. No successor rebase or binding-base change. Successor nativeRoundUndo and Packaged route acceptance remain OPEN; predecessor closure is not successor acceptance.


### 39C — retained tracked formatting and common underlay, 2026-10-06

After clean exact0612 peer preflight39C, permit only round-decision inverse anchor geometry comparison of retained run/paragraph formatting through existing validated formatTransitionMeaning. The independently accepted common38C supported style underlay may differ between full before/after snapshots while the actual tracked property transition remains exact. Retained IDs/nativeIds/authors/dates/states/parent relation and every other field stay exact. Altered transition, nonstyle/text/topology/geometry and forged provenance refuse. Core-restored rich frame remains exact; default authored recording-save inverse proof stays strict. Same39 paths, one outcome and rollback.

SOURCE04 actual native original saved round Undo Gamma→Alpha→Beta and Redo Beta→Gamma→Alpha succeeded. Independent frozen-runtime readback compared entire rich frames and the whole discussion graph to sequential pure Core decision replay; Redo scene raw bytes exactly matched independently derived originalApply. Expected anchorEditHistory changes explain graph byte differences; current locators/messages/status/provenance match exactly. This does not claim new SOURCE04 intake or PACKAGED acceptance. Fresh SOURCE04 genuine Word second changed round495573 refused due tracked paragraph-mark language rPrChange; all3scenes+graph remained byte-exact. Retain this new failure and originalartifact unchanged, no tracking toggle or semantic flattening.


### 40 — retain native tracked paragraph-mark property on repeated Word return, 2026-10-06

Before parser edits clean exact0612 peer preflight40 passed, same39 paths. Actual second native file495573 contains finalparagraph38 direct p/pPr/rPr/rPrChange native45, currentlangruRU and emptypriorrPr. Existing extractor already represents this as a paragraph-format event with exact native provenance; existing Core frame schema and emitter support the paragraph properties. Raw formattingParagraphs incorrectly invokes the closed property formatter on the revision container before using the checked exclusion. Repair that parser path only: validate exact direct owner, one current/prior container, closed namespaces/leaf shape/values and revision provenance; exclude only the checked container from current property formatting, retain its independent real revision event. Distinct simultaneous pPrChange and pmarkchange remains typedrefusal. No new schema/path/writer, revision synthesis, data rewrite, tracking toggle or generic skipping. Prove Original/Current, independentaccept/reject/UndoRedo/reimports and actual unchanged495573 signedbook nativeApply, every forged owner/provenance/property counterexample.


40A before index fallback edit: exact immutable495573 stack proved the actual throw is literal numbering fallback in raw Review analysis; generic note/comment path invokes it after correctly extracted pendingviews. Clean exact0612 preflight40A passed for same39paths. Permit declared index.mjs fallback to parse existing strictly checked pending unionXML, retaining raw ReviewIR realpropertyevents/provenance, count/text/list/ordinal checks and worker/artifact digests. Parser40 current pmarkformatter checkedexclusion remains needed. No generic pipeline recursion, unchecked wrapper stripping, error swallowing, lost event or new mutationauthority. Unchanged495573 nativeactivation and listnumbering/pendingrichblocks negative chains mandatory.


40B before retainedformat rebase edit: exact495573 preview/raw analysis now passes but full signedbook derivation reproduces PENDING_FORMAT_SOURCE_MISMATCH: retainedAlpha nativebold snapshots carry equal emittedTimes12 defaults while canonicalsource correctly keeps implicit font/size. Same39path clean0612 preflight40B passed. In existing word-pending-comment-return, rebase only commonpermitted38C underlay to actualcanonicalnodes after validated trackedformatTransitionMeaning equality, includingretainednestedchild; all real transitions and provenance/ownership remainexact. For newGamma paragraphmarklanguage, untracked underlay uses returned BEFORE so real empty→ruRU revision retains before/after. No rewrite of priorhistory or event synthesis. Require actual495573 signedbook, independentXMLOriginalCurrent, alteredtransition/childownership/provenance/style negatives and finalbothnativeorigins.

PKG03 failure classified independently: copiedroundauthority binds SOURCEproject physicalroot, so strictMainRTK_ROUND_STORE_INVALID is correct. Preserve oldprofile/store; newisolatedPKG05 synthetic5file projectseed with zeroexchanges is independentsetup only, notnativeimportproof. Its ownnativeexport mustcreate legitimate packagedround, then genuineWord edits/return. No cross-profile authority rebind, digest rewrite or historydeletion.


40C before history edit: immutable495573 secondreturn after SOURCE04 first-round nativeUndoRedo refuses COMMENT_RETURN_PROTECTED_HISTORY_CONFLICT because freshGamma tail changes paragraphhash of roots with protected oldround anchorEditHistory. Read-only existing Core forwardround planner reproduces new Wordcandidate anchor/status exactly and preserves alloldhistory entries with newround entries appended. Externaldiagnostic seam proves hypothesis only, notcandidateacceptance. Clean exact0612 same39path preflight40C passed. In existing mixedreturn/delta, independently recompute canonicalreplacement+existing forwardround geometry from validatedcurrent/returned sources and exactroundmetadata once peraffectedprotected owner againstCURRENTgraph. Require exact nativecandidate geometry/status; remote move/delete/resolve and allmismatches still refuse protectedhistory conflict. Retain everyoldentryexact, append existingvalidnewroundhistory, preserve allmessages/provenance/foreignscenes and finitebudgets. No history stripping, digest forgery, guardwaiver/newwriter or newpath. Actual unchanged495573 nativeApply/Cancel/restart/two-roundUndoRedo and source/package mandatory before broadgates.


40D before codeBlock style edit: read-only reproduction proved unconditional codeBlock style skipping silently loses supported font/size/language on old text. A naive removal also risks adopting inherited emitter Menlo10pt on unchanged export. Clean exact0612 peer preflight40D passed again with explicit declared exporter read source, same39 write paths. Only existing signed paragraph role plus exact existing codeBlock emission may distinguish unchanged inherited defaults from authored changes; explicit canonical properties win. Preserve supported returned Georgia14/enGB on old/new text and exact prior rich Undo; unchanged governed export must create no false font/size/language or affected owner. Unknown/rebound emission ownership typed-refuses before writes. No exporter/catalog/source/history rewrite, style catalog, custom ReviewTypography or new writer. Original05424/second495573 regressions and real transition/nonstyle/owner negatives mandatory; native final proofs still open.


40D qualification before native05 freeze: actual governed implicit and explicit Menlo10 codeBlock no-delta export must preserve canonical rich marks. Pure admitted mixed Georgia14/enGB preservation is not real Word acceptance: existing raw parser refuses actual authored Georgia14/enGB code DOCX with DOCX_CODE_BLOCK_FORMAT_UNSUPPORTED before this reader. That broader code-style combination remains OPEN typed prewrite refusal; no whitelist expansion or new style catalog. This bounded repair removes silent skipping in admitted input and preserves known emission defaults, not full code-style interoperability.


### 2026-10-06 — multi-scene Word native05 observed; delivery open

Working successor binding0612, immutable source patch5ce1793e, copy3463/3463 exact. SOURCE05 real second Word495573 Preview/Cancel/Apply preserved allscene/graph exact independentlyderived;10 native roundUndoRedo checkpoints independently matched whole rich source/history/provenance and graph. Controlled restart and fullreexport79cd276c retain strict CurrentOriginal/nested/standalone/pmark revisions and5messages; Word opened without visible repair. Fresh standard WRITER_LOCAL_V1 PACKAGED05 ownnativeexport ee13dd24 created its own local authority; genuineWordchanged1490b1b returned with exact3scene/wholegraph readback,6 nativeUndoRedo checkpoint replay, restart and fullreexport5a2f42f6 independently checked and opened in Word without visible repair. All owned native processes stopped; synthetic test profiles and immutable failed artifacts retained. No notes in these short fixtures; not a nativeimport or100k/five-exchange/full-plan claim.

Runtime/tests held after codefreeze05. Required affected whole suites, baseline/RTK/security/OPS/CI and successor commit/push/PR/merge/exact merged replay are next and remain open. Predecessor2087 already closed. Original full Mac denominator unchanged; novel priority unchanged. Residual navigator counts stale during session but correct after restart; canonical/editor/DOCX exact. CodeBlock Georgia14/enGB ownexport and nonempty programminglanguage still typed-refuse; story+pending and nestednotes combinations OPEN. No custom typography/newcatalog or dependency.

2026-10-06 frozen RTK235 local run:3514 executed,3502 pass,12 fail,zero skips/todo; mandatory acceptance remains FAIL. Inventory includes historical changed-scope checks and seven prior product-path expectations involving notes, pending replies and activation. Preserve failures; repair only after diagnosis and scoped authority. Tool-stream retention is partial; terminal TAP totals and runner cleanup are retained. Own task-shape failure from an extra H2 is corrected without weakening E0. The final clean checkpoint commit may precede immutable full validation and draft publication; such a commit remains a candidate, not acceptance or DONE. No merge until required proofs and CI pass.

40E pre-edit amendment: clean0612 peer41-path preflight passed after an external declaration-generation KeyError/missingfile failure was corrected; failedpreflight retained and gave no writeauthority. Three existing notes scenarios exposed a real regression: raw source-point equality rejects legitimate checked union-coordinate shifts and replay. Restore remembered exact round/hash no-write only after ledger/receipt validation; fresh return must retain unique noteIDs/cardinality and unchanged existing export/original semantic occurrence geometry. Missing/foreign/duplicate IDs or forged points refuse. Notes+format support stays closed. Maintain real bookprepare function in bookmark activation VM; for two mixed pendingreply negatives assert exact nested blocked refusal, absent prepared candidate and full savedbytes unchanged. This is an existing-regression repair, not expanded feature acceptance. Native05 evidence remains bound to frozen05 until final changed-code qualification.

2026-10-06 — 40E checkpoint: three existing notes regressions repaired and seven original product-path failures pass focused checks;11 total focused cases,zero skip/todo. New note cases include pending/accepted/rejected export bases and missing/foreign/extra/moved/duplicate ownership negatives. Full frozen RTK235 previousrun remainsFAIL3502of3514, not overwritten by focusedgreen. Runtime/tests frozen06; renderer rebuilt, no new dependencies. Final clean checkpoint commit is an immutable candidate only; full required baseline/RTK/OPS/CI/native affected requalification/merge/merged verification remain open.

### 40F — native third-save producer repair

2026-10-06: clean checkpointc8 full RTK235 passed3515of3515,zero skip/todo, full process-group and lease cleanup; this does not certify native acceptance. Fresh own SOURCE06 export, real Word tracked additions to Alpha and Gamma and save produced immutable artifact32e5923ca0c1d0e3d9580e7feaea84b7051d805c8752ca3e78aad4b5e6f56602. Read-only derive and native intake both refuse MIXED_RETURN_OLD_PARAGRAPH_FORMAT_CHANGED; all three canonical scene bytes and global graph are unchanged against native06-before snapshot. Gamma retained mark-only revision native45 is absent after Word save. Prior export puts previous paragraph-mark rPr inside pPrChange/pPr, which is not a legal PreviousParagraphProperties child. Supported mark-only revisions must use pPr/rPr/rPrChange; genuine structural paragraph-property revisions retain pPrChange with no illegal old mark child. Preserve id/nativeId/author/date and exact Original/Current. A single event combining both owner kinds is typed-refused rather than split or dropped. Missing-event intake guard stays strict; failed artifact is never repaired or silently accepted. New genuine export/save/return must prove retained event survives alongside independently decidable new two-scene changes.

Same41-path architecture declarationF passed clean binding0612 preflight before edits. One atomic publisher and existing command/lease/CAS authority unchanged. Cheapest proof first: strict XML carrier/provenance and composition negatives, fresh real Word third-save round; then frozen affected suites and mandatory full gates. Original full Mac scope and100k/five genuine exchanges remain open.

Primary schema evidence: https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.previousparagraphproperties?view=openxml-3.0.1 and https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.paragraphmarkrunpropertieschange?view=openxml-3.0.1 .

40F delivery identity: original binding0612 remains fixed. Main predecessor merge06b4523f55ff77ac4306055d8e5d5395bdd204d9 has exactly the same tree95455c1d1609582e9cad0479fc733d98a333d27c as binding0612. Candidatec8 is based on predecessor source branch, so main merge is not its ancestor; local mandatory npm test stopped at doctor before any broad unit test. Preserve thatFAIL. Read-only normal merge-tree(c8,06b) equals currentc8 tree00523074a6cae937d669f05f8159f0d88ab12f3d. After owned40F checkpoint, integrate this exact main merge normally (no rebase, reset, force, base replacement or source change), assert source/tree unchanged by merge, and freeze/re-run exact final gates. If target changes or merge content differs, stop and diagnose before integration.

40F legal structural parser seam: clean41G binding0612 preflight passes before extending bounded GO to existing reviewTransportPackageParserV2.mjs. Previous structural pPr snapshot legally omits independent unchanged mark properties; Original reconstruction may preserve only existing validated ordinary direct current pPr/rPr when previous has no mark owner. Tracked, duplicate, unknown and unsupported mark owners remain refused; no external default/fallback/property invention. Preserve exact rich Original/Current and retained event identity. Existing legacy prior-rPr fixture handling remains compatibility-only, never emitted by corrected producer. Same atomic route and rollback unchanged.

### 2026-10-06 — frozen07 genuine native requalification; delivery still open

40F source/tests frozen. Focused formatting30of30 passed,zero skips/todo. Runtime07 copied3463of3463 exact, digestc45a2271adb49a7f13c51bc6f63e62a2e158694d9883e25e439b9bf5ed5e73d9. Fresh SOURCE07 own export71cb05bc uses legal mark-only rPrChange; actual Word new Alpha/Gamma changes and saved d2828b63087380be7685e8fca087b2d5b5fd4c6d9688d2b6afd2d59e7baaec2a retain the old paragraph-mark event. Native Preview2 affected scenes, Cancel all40pre-existing files exact plus ordinary startupbackup; Apply all3raw scenes and wholegraph match independently derived content.12 native UndoRedo checkpoints replay all3rounds across Alpha/Gamma and compare full rich frames/history/provenance plus wholegraph;5messages remain exact. Owned SIGTERM/relaunch same profile retains scenes/graph byte-exact. Native fullreexport4900778c2d424936e459c2aa8fe6d765998e173b3757910cdc0cdd0f7881ba78 verifies strict signed CurrentOriginal/pending bindings, unchanged owner deltas and discussion history, then opens in real Word without visible repair.

Ordinary PACKAGED07 WRITER_LOCAL_V1 launched with no COLLAB_SCOPE_LOCAL or alias environment flag. Own exporte58f79cf, genuine Word changed save8eb1fe15b391481c91f83460c8a677f2ed212904020d7171605016a2b549f334, Preview2 scenes/Cancel all22pre-existing files exact plus ordinary backup, Apply all3raw/wholegraph independent equality. Existing admitted local Comments rail opens decision controls without collaboration enablement;8native UndoRedo checkpoints restore2rounds across Alpha/Gamma. Same-profile controlled restart retains entire scenes/graph; fullreexport3fd4d9d813fc4021d885a130864960ea0a00e56a04ab8e71a915164b50552713 passes signed rich/pending/graph checks and opens in Word without visible repair. Every owned native process stopped; files/profiles/failed evidence retained. Historical PACKAGED05 launch receipts did not record parent collaboration flags, so no retrospective flag-absence claim from those receipts alone.

Word native Open dialog temporarily disabled a selected SOURCE07 reexport; after3same-signature attempts the loop stopped and receipt retained. The same exact file opened through Finder Cmd+O without repair; no DOCX rewrite. Packaged native Open enabled on a later observed dialog state and was used directly. Generic Open Review Mode selects Inspector when optional collab query is disabled; local Comments rail is the available governed interop entry. This shell entry inconsistency and stale navigator counts before restart are recorded residuals, no UI changes in this contour.

These are short3scene SOURCE183word/PACKAGED181word routes, not100k, nativeimport or5genuine successive novel exchange acceptance. Single-event simultaneous paragraph-mark+structural export explicitly refuses PENDING_PARAGRAPH_MARK_COMPOSITE_EXPORT_UNSUPPORTED; implicit run-language export/binding mismatch also remains open. No event dropping/splitting, default invention or guard relaxation. c8 full RTK3515 green predates40F and is superseded; final immutable baseline/RTK/OPS/CI/delivery/merged checks remain mandatory and OPEN. Original binding0612 and full Mac denominator unchanged.
