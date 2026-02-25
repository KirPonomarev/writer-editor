# CONTOUR_SUPPLEMENT_PLAN_P0_STABILITY_v1

status: ACTIVE
version: 1
owner: DOCS_OPERATOR

## Goal
Eliminate remote-resume loops and manual retry spirals without reducing safety checks.

## Scope
- Policy/process only.
- No runtime code-path expansion.
- No lockfile/dependency changes.

## Mandatory flow
1. Remote failure is classified and fingerprinted.
2. Autofix series runs with bounded retry budget.
3. If remote still failing after budget: auto wait mode only.
4. Auto-resume from previous step after remote pass.
5. Manual PR-resume is forbidden while remote is failing.

## Guard rails
- Single blocking evaluator remains canonical.
- Secondary evaluators are advisory only.
- New expansion tickets are forbidden until P0-01 and P0-02 are closed.
- Same stop code + same fingerprint + stateDelta NONE cannot be re-executed.
- No business-path retry loops on unchanged infra state.

## Exit condition
Remote-failure path must end in one of:
- autofix success and automatic resume, or
- auto wait mode with next probe time, with no manual-resume spiral.
