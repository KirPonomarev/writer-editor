# Audit Summary — AUDIT_NOW_REMEDIATION_AND_RECONFIRM_v1.1

## Baseline / Binding
- Required base SHA: `4032ca41da7067b7dbff1f71574c4068f27ea0e6`
- HEAD: `4032ca41da7067b7dbff1f71574c4068f27ea0e6`
- origin/main: `4032ca41da7067b7dbff1f71574c4068f27ea0e6`
- Binding verdict: PASS

## Current Gates
- `node scripts/doctor.mjs --strict` => `0`
- `npm test` => `0`
- `npm run oss:policy` => `0`
- `npm audit --audit-level=high --json` => `0` (0 findings)
- `PATH="$HOME/Library/Python/3.9/bin:$PATH" semgrep --config p/javascript --config p/nodejs --json .` => `0` (0 findings, 3 timeouts on `src/renderer/editor.bundle.js`)
- Current gate verdict: PASS_WITH_SCANNER_TIMEOUT_WARN

## Current Mainline Status
- `SCA-0001`: CLOSED_ON_CURRENT_MAINLINE
- `SAST-0001`: CLOSED_ON_CURRENT_MAINLINE
- `SAST-0002`: CLOSED_ON_CURRENT_MAINLINE
- `LICENSE-0001`: CLOSED_ON_CURRENT_MAINLINE
- `ARCH-0001`: CLOSED_ON_CURRENT_MAINLINE
- `DUP-0001`: DROP
- `ELECTRON-0001`: DROP

## Notes
- Fresh production license scan (`npm ls --omit=dev --json --long`) reports `UNKNOWN=0` and `DENY=0`; review set is limited to `AGPL-3.0-or-later` with no new review licenses.
- Architecture rebind on current mainline confirms no circular or unresolved graph break in current depcruise raw evidence and no runtime-impacting orphan claim.
- Old knip dependency unused claims for `@tiptap/core`, `@tiptap/pm`, and `@tiptap/starter-kit` are stale against current runtime wiring (`src/renderer/tiptap/index.js` + installed dependency graph).
- Old `src/renderer/flags.js` orphan narrative is stale because `src/renderer/index.html` wires it in the active renderer entrypoint.
- Blocked environment lanes such as live perf, Electron runtime execution, and mac build readiness are not promoted to PASS by this audit closeout.

## Severity Counts
- P0: **0**
- P1: **0**
- P2: **0**
- P3: **2**

## Final Decision
- **CURRENT_MAINLINE_NOW_SET_CLOSED**
- Basis: fast gates are green, current dependency audit has zero findings, current generic semgrep scan has zero findings, targeted P1 remediation contours are merged on mainline, and both `LICENSE-0001` and `ARCH-0001` are explicitly closed for current scope A.
