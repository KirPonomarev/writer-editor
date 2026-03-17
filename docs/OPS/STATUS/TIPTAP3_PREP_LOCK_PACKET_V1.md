# TIPTAP3_PREP_LOCK_PACKET_V1

STATUS: READY
PACK_CLASS: PREP_LOCK
SCOPE_POLICY: PREP_ONLY_NO_BEHAVIORAL_SOURCE_CHANGE
UPGRADE_ELIGIBLE_AFTER: PREP_LOCK_PASS
UPGRADE_ALLOWED_AFTER: FORBIDDEN

## Purpose

This packet locks the prep contour before any Tiptap3 upgrade execution work.
Prep lock is allowed to define scope, freeze oracle behavior, and tighten prep-only instrumentation.
Prep lock is not allowed to edit runtime behavior sources.

## Exact Repo Allowlist

REPO_ARTIFACT_01: docs/OPS/STATUS/TIPTAP3_PREP_LOCK_PACKET_V1.md
REPO_ARTIFACT_02: scripts/ops/tiptap3-prep-smoke.mjs

## Tmp Only Rule

TMP_ONLY_RULE: Any exploratory prep notes, draft task records, or local comparison output must stay outside the repo in tmp-only storage unless explicitly promoted later.

## Runtime Source Freeze

RUNTIME_SOURCE_CHANGE_IN_PREP_LOCK: FORBIDDEN
RUNTIME_SOURCE_01: main.js
RUNTIME_SOURCE_02: index.js
RUNTIME_SOURCE_03: ipc.js
RUNTIME_SOURCE_04: styles.css
RUNTIME_SOURCE_05: editor.js

If prep lock needs any behavioral source edit, contour status becomes HOLD and must be re-scoped as implementation work.

## Serialization Oracle Lock

Oracle is the current legacy observable payload behavior exposed by parseObservablePayload and composeObservablePayload.
The lock below freezes observable behavior only. It does not claim that the behavior is ideal.

SERIALIZATION_EDGE_01_EMPTY_PARSE:
- input: empty string
- output text: empty string
- output meta: default meta
- output cards: empty array

SERIALIZATION_EDGE_02_ABSENT_SECTIONS:
- absent meta section parses to default meta
- absent cards section parses to empty cards array
- cards-only payload leaves text empty and meta defaulted
- meta-only payload leaves text empty and cards empty

SERIALIZATION_EDGE_03_NEWLINE_NORMALIZATION_ON_PARSE:
- parse removes leading blank runs
- parse removes trailing blank runs
- parse collapses runs of three or more newlines to two newlines inside text payload

SERIALIZATION_EDGE_04_EMPTY_COMPOSE:
- compose with empty text, metaEnabled false, and empty cards returns empty string

SERIALIZATION_EDGE_05_META_SECTION_ABSENCE_RULE:
- compose emits no meta section when metaEnabled is false

SERIALIZATION_EDGE_06_CARDS_SECTION_ABSENCE_RULE:
- compose emits no cards section when cards is empty

SERIALIZATION_EDGE_07_EMPTY_META_COMPOSE:
- compose with metaEnabled true and empty default meta emits a meta block only
- exact synopsis line is `synopsis: ` with one trailing ASCII space after the colon
- current locked exact shape:
  [meta]
  status: черновик
  tags: POV=; линия=; место=
  synopsis: 
  [/meta]

SERIALIZATION_EDGE_08_TRAILING_NEWLINE_COMPOSE:
- compose preserves a trailing newline if it is already present in text input

## Autosave And Backup Not Applicable Reason Codes

The following reason codes are the only allowed NOT_APPLICABLE values inside prep lock pass records for autosave and backup checks.

NOT_APPLICABLE_REASON_01: AUTOSAVE_ENTRYPOINT_OUT_OF_PREP_SCOPE
NOT_APPLICABLE_REASON_02: BACKUP_ENTRYPOINT_OUT_OF_PREP_SCOPE
NOT_APPLICABLE_REASON_03: PREP_LOCK_NO_RUNTIME_WRITE_EXERCISE
NOT_APPLICABLE_REASON_04: FIXTURE_DOES_NOT_TOUCH_AUTOSAVE_BACKUP_PATHS

If a prep record uses NOT_APPLICABLE for autosave or backup without one of these exact reasons, the record is invalid.

## Interpretation Lock

PREP_PASS_MEANS: upgrade eligible after prep lock
PREP_PASS_DOES_NOT_MEAN: automatic approval to execute the next upgrade contour
