# Canonical Yalken logo in current Electron

TASK_ID: YALKEN_CANONICAL_LOGO_20261025
TYPE: UI
CANON_VERSION: v1.0
CHECKS_BASELINE_VERSION: v1.0
ACTIVE_EXECUTION_CANON: v3.13a-final
BINDING_BASE_SHA: f6601801a9b584cd1caeb60a7f643a59f70adf55
COMMIT_REQUIRED: true
PUSH_REQUIRED: true
PR_REQUIRED: true
MERGE_REQUIRED: true

## MICRO_GOAL

Install only the owner's already selected canonical narrow Y mark and macOS icon in the latest accepted Electron source. Keep experimental 3270, typography alternatives and every unrelated interface/authoring behavior out of this change. Current developer startup-input WIP is protected in its separate worktree.

## ARTIFACT

The existing 18px titlebar mark displays the owner's precise 328:595 Y path, neutral in light/dark/forced-colors. Dock uses the approved Light app icon. Source PNG, packaged PNG and ICNS come from the validated YALKEN_CANONICAL_BRAND_DESIGN_PACK_2026-07-19. The former spiral icon and green book geometry are superseded only in their existing slots. The system title keeps its existing typography; it is not a shrunken primary logo lockup.

## ALLOWLIST

- src/renderer/index.html
- src/renderer/styles.css
- src/renderer/assets/logo.png
- src/renderer/assets/README.md
- build/icon.png
- build/icon.icns
- scripts/make-mac-icon.sh
- test/unit/r24-wp308-brand-baseline.test.mjs
- docs/tasks/2026-10-25--canonical-logo.md
- docs/WORKLOG.md

Text diff budget: 220 added/removed lines plus this specification and one factual WORKLOG entry. Binary files are exact owner asset copies. Local existing locked build dependencies, temporary build output and fresh synthetic UI inspection profile are allowed operational inputs, not new product dependencies.

## DENYLIST

All other repository source paths, including Core identity/projection, Main, preload, editor and generated bundles, package/lockfiles, command/capability/persistence/schema/security/authority files. No font file adoption or wordmark redesign; no new surface or runtime handler; no signing/distribution. No Lazyweb discovery/contact, foreign profile or process mutation, manuscript write, stash/reset/clean/rebase/amend/force-push or direct protected-branch push. No edit in owner canonical checkout or the active coder's worktree.

## CONTRACT / SHAPES

GROUP: EXISTING_SEAM_GROUP_01_VISUAL_ASSETS_ONLY
FEATURE_INTEGRATION_MANIFEST_V1: EXISTING_NONINTERACTIVE_DECORATIVE_MARK; existing identity projection/slot/state model remain unchanged, no new feature manifest.
SURFACE_MANIFEST_V1: EXISTING_TITLEBAR_SLOT_UNCHANGED; no new surface manifest.
PRODUCT_AUTHORITY: unchanged Core brand identity and authoring truth.
COMMAND_AUTHORITY: unchanged; this decoration initiates no command or effect.
READ_PATH: existing Main immutable YALKEN_ORIGINAL_V1 projection -> unchanged brandIdentitySurface -> existing titlebar brand slot.
STATE_CLASSES: transient presentation only; no persistence.
PRODUCT_PORTS: none added; no product or authoring effect.
DESIGN_OS_PORTS: existing immutable projection only.
CANONICAL_PATH: M0 0L116 210L158 595L156 189Z M328 0L212 210L170 595L172 189Z
SLOT_METRICS: unchanged 18px square, viewBox 0 0 328 595 with natural aspect ratio; unchanged 28px titlebar and title label.
MARK_INK: light #4c4a45; dark #f2ede6; forced-colors CanvasText.
FALLBACK: existing identity mismatch hides the brand; aria/name and no-interaction invariants unchanged.
HOT_PATH: no code/listener/timer/network added; only one inline SVG path.
ROLLBACK: normal revert of this one bounded change; preserve all external assets and prior receipts.

DESIGN_TOOL_ROUTER: APPLIED
DESIGN_SOURCE_OF_TRUTH: direct owner request and local approved vector/PNG/ICNS pack; screenshots and font experiments are not source geometry.
DESIGN_SELECTED_DIRECTION: canonical first-party Y, mark-only in a small slot, prepared app icon in Dock.
DESIGN_RESEARCH_SOURCES: local brand geometry/implementation/matrix, existing WP308 code/test, Design OS guide, brain:refs.
DESIGN_AUDIT_TOOLS: UI Craft review, exact geometry/asset comparison and actual Electron rendering.
DESIGN_TOOL_DEVIATIONS: no new direction research is needed. Higher-priority owner policy forbids Lazyweb for this task; legacy preflight enum APPLICABLE_LAZYWEB_FIRST is metadata only and does not denote tool use. No optional service is loaded. No Lab experiment or new design system is introduced.

## IMPLEMENTATION_STEPS

1. Validate owner pack checksum entries and exact preflight/base. Preserve all existing WIP.
2. Replace only the book paths/circle with the exact canonical path and neutral fill. Keep slot geometry, system-title font, accessible name and unchanged identity module.
3. Copy the approved source/build PNG and ICNS byte-for-byte. Make icons:mac retain source pixels instead of applying the obsolete spiral contrast/black-padding treatment; use installed macOS sips/iconutil because app-builder-bin is absent from the current locked builder. Document the source and correct obsolete mask instructions.
4. Update the maintained brand test's selected-shape expectations while preserving all nine tests, authority/identity/accessibility negatives and seven mutants. Check actual mark contrast and owner icon identity.
5. Execute focused/source/build/native proof, review the whole diff, one factual log entry and complete ordinary commit/PR/CI/merge/exact-head verification.

## CHECKS

CHECK_01_PRE_IDENTITY_AND_AUTHORITY: completed before any repository edit: registered clean f6601801 branch, verified encrypted/unlocked writable T7-Secure UUID, T777 UUID, fresh origin/main, bootstrap and architecture preflight actual0; existing WP308 whole9 passed before edit. CHECK_01 is not rerun after edits.
CHECK_02_POST_TASK_E0: node scripts/ops-gate.mjs --task docs/tasks/2026-10-25--canonical-logo.md
CHECK_03_POST_BRAND: node --test test/unit/r24-wp308-brand-baseline.test.mjs; preserve nine tests, all identity/authority negatives and seven mutants; verify actual neutral mark contrast and exact owner PNGs/ICNS.
CHECK_04_POST_BUILD: npm run build:renderer; all generated tracked artifacts remain byte-exact because no compiler input changed. icons:mac runs into task-owned temporary output; PNG remains identical to source.
CHECK_05_POST_NATIVE: fresh exact-source local Electron build, own synthetic profile, actual titlebar light/dark screenshot and native icon asset inspection. No user manuscript or active coder profile used; screenshot is visual evidence, not product acceptance.
CHECK_06_POST_SCOPE: npm run agent:guardrails; diff/name/status match allowlist; accessibility/fallback source unchanged; normal commit/push/PR/required CI/merge followed by fresh merged-source focused checks and icon verification.

## STOP_CONDITION

Stop before expanding scope, modifying another writer's work, claiming an unverified build, accepting a font experiment, changing protected source, bypassing failed required checks, or following a base drift that makes this PR unmergeable. Old passing receipts never stand in for current proof.

## REPORT_FORMAT

One text block with TASK_ID, RESULT, HEAD_SHA_BEFORE, HEAD_SHA_AFTER, COMMIT_SHA, CHANGED_BASENAMES, STAGED_SCOPE_MATCH, TESTS, COMMIT_OUTCOME, PUSH_RESULT, PR_RESULT, CI_RESULT, MERGE_RESULT, EXACT_HEAD_VERIFICATION, LIMITATIONS and NEXT_STEP. Basenames only, no URL/path in this formal block. Do not claim release acceptance.

## FAIL_PROTOCOL

Preserve actual failures and exact source/build/profile identities, report the affected gate and one next hypothesis. No weakened assertions, synthetic success, foreign process stop or silent branch transfer. After three identical failures stop the loop.
