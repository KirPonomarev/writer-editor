# CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001

## Document
- TASK_ID: CORE-A4-YALKEN-PHASE02-FIRST-BOUNDED-EXECUTION-BRIEF-001
- TASK_CLASS: CURRENT_LANE_PHASE02_EXECUTION_BRIEF_SELECTION_ONLY
- STATUS: POST_ACTIVATION_BRIEF_ONLY_NOT_EXECUTION_START
- ACTIVE_CANON: v3_13a_final
- BLOCKING_SOURCE: ACTIVE_CANON_ONLY

## Binding Context
- CURRENT_BINDING_ORDER: PHASE02_ONLY
- CURRENT_BINDING_NEXT_MOVE: ONE_NEW_EXPLICIT_POST_ACTIVATION_EXECUTION_BRIEF_ONLY
- RUNTIME_WRITES_ADMITTED: false
- RUNTIME_ADMISSION_GRANTED: false
- PHASE02_EXECUTION_STARTED: false
- PHASE02_EXECUTION_ATTEMPTED: false
- FORMAL_CUTOVER_CLAIMED: false
- BROAD_SHELL_ADMISSION_CLAIMED: false

## Selected First Slice
- SELECTED_FIRST_SLICE_ID: PHASE02_DATA_CORE_PROJECT_MANIFEST_AND_PROJECT_ID_BINDING
- SELECTED_FIRST_SLICE_TASK_BASENAME: CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.md

## Selection Reasons
1. CANON.md and BIBLE.md place Phase02 on data core, recovery, and command kernel stabilization before later shell work.
2. BIBLE.md requires projectId creation, storage survival, and binding by projectId instead of path or title.
3. Data-core manifest plus projectId binding is the narrowest first execution slice without mixing recovery or command-kernel work.

## Future Slice Allowlist
- CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001.md
- main.js
- projectManifestBinding.test.js

## Scope
- IN:
  - Select exactly one first bounded Phase02 execution slice.
  - Record future allowlist checks and stop conditions.
  - Keep all runtime flags false.
- OUT:
  - Any runtime write, runtime admission, or execution start.
  - Any mutation of CONTEXT.md, HANDOFF.md, CANON.md, BIBLE.md.
  - Any src or test mutation.
  - Any design OS work and any contour 03, 04, or 05 work.
  - Any recovery or command-kernel mixing.

## Stop Conditions
1. Stop if current dirty workspace is used as base.
2. Stop if any file outside allowlist is required.
3. Stop if recovery work enters scope.
4. Stop if command-kernel work enters scope.
5. Stop if any runtime admission is attempted.
6. Stop if any execution start is attempted.
7. Stop if Y7 or any other new contour is opened.
8. Stop if more than one next move is emitted.

## Delivery
- DELIVERY_MODE: COMMIT_THEN_PUSH_THEN_PR_THEN_MERGE
- PR_TARGET_BRANCH: main
- MERGE_POLICY: REPO_DEFAULT_ONLY
- REQUIRED_PR_CHECKS_POLICY: IF_REQUIRED_PR_CHECKS_EXIST_THEN_ALL_MUST_BE_GREEN_ELSE_NOT_REQUIRED

## Single Next Step
- NEXT_STEP_AFTER_SUCCESS: PREPARE_ONE_EXPLICIT_CORE-A4-YALKEN-PHASE02-DATA-CORE-PROJECT-MANIFEST-001_TASK_ONLY
