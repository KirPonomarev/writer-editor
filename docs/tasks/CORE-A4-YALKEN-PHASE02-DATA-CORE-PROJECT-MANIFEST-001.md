# CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001

## Document
- TASK_ID: CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001
- TASK_CLASS: CURRENT_LANE_PHASE02_DATA_CORE_ONLY
- STATUS: BOUNDED_EXECUTION_SLICE_ONLY
- ACTIVE_CANON: v3_13a_final
- BLOCKING_SOURCE: ACTIVE_CANON_ONLY

## Slice Goal
Land one bounded data-core slice for:
1. project manifest normalization,
2. stable projectId persistence,
3. workspace binding by projectId (not by path or title).

## Scope
- IN:
  - main.js: manifest normalization and projectId persistence behavior only.
  - projectManifestBinding.test.js: targeted checks for projectId behavior and binding semantics.
- OUT:
  - recovery work,
  - command kernel work,
  - status records and factual docs,
  - UI files and dependencies,
  - design OS and Y7.

## Runtime Flags
- RUNTIME_WRITES_ADMITTED: false
- RUNTIME_ADMISSION_GRANTED: false
- PHASE02_EXECUTION_STARTED: false
- PHASE02_EXECUTION_ATTEMPTED: false

## Checks
1. projectId is created when manifest is absent or malformed.
2. existing valid projectId survives normalization.
3. workspace binding keys use projectId and project-relative path, not legacy title/path keys.
4. scope remains exact allowlist only.

## Stop Conditions
1. Stop if any non-allowlist file is required.
2. Stop if recovery or command-kernel work enters scope.
3. Stop if any status record or factual doc is touched.
4. Stop if any UI or dependency change appears.
5. Stop if more than one next move is emitted.

## Single Next Step
- NEXT_STEP_AFTER_SUCCESS: STOP_AND_WAIT_FOR_ONE_NEW_EXPLICIT_TASK_BRIEF_ONLY
