# C4 Google Office multi-scene admission

STATUS: EXACT_PHYSICAL_EVIDENCE_PENDING_OFFICIAL_MERGED_HEAD
TASK_ID: YALKEN-C4-GOOGLE-OFFICE-MULTISCENE-ADMISSION-20260924

The frozen 1120-cell denominator is unchanged. This contour admits at most
six IDs: TEXT, ORDER, and NOVEL_SCENE_STRUCTURE for MULTI_SCENE/C4 in
SOURCE_RUNTIME and PACKAGED_BUILD_RUNTIME. It does not inherit the historical
single-scene C4 proof or any Word cohort.

Two separate synthetic three-scene DOCX journeys ran against product runtime
`e2cfd79a8a3fbea40ed644df866d8dbe9f1e9a7c`, through a Google Office
DOCX file rather than native conversion. Each saved observation is
`READY_FOR_EXTERNAL_BINDING` with `admissionCredit: 0`:

- `ORDER__MULTI_SCENE__C4__SOURCE_RUNTIME__2026-09-24T20-41-20-654Z`
- `ORDER__MULTI_SCENE__C4__PACKAGED_BUILD_RUNTIME__2026-09-24T20-45-02-890Z`

The versioned policy pins their run IDs and observation hashes, the exact
product runtime, the registered Lab, the independent reader, and the only
verifier/governance paths allowed between physical execution and current
merged HEAD. Product runtime drift invalidates promotion. The official
`verifyInterop100` entrypoint reports a 1120-cell set for this mode; it
never adds historical counts from another head or provider route.

The same entrypoint accepts these two C4 runs alongside freshly verified Word
cohorts through the existing mixed aggregate. Every member must independently
pass on the same current HEAD and tree with the frozen 1120 denominator.
Unknown IDs, overlapping IDs, missing or failed members, duplicate decisions,
stale identity, or a caller-supplied count invalidate the entire aggregate.
Only the new verifier, tests, policy, and task document are added to Word's
verifier-only promotion paths. Runtime changes still require their own proof;
this contour does not promote the historical Word set across product edits.

The raw reader rehashes the complete bounded artifact inventory and parses
source and returned DOCX XML independently. It proves 35 ordered paragraphs
across three canonically bound scene files, one tracked replacement and
anchored comment in scene one, no change in scenes two and three, explicit
governed Apply, and a fresh process reopen. It requires the same Drive file
ID, changed revision, Office DOCX MIME, and raw returned bytes. The sole
U+2060 transport boundary at the end of scene one is excluded from canonical
text only at that exact position. Wrong profile, Native conversion, changed
file or revision, altered raw bytes, missing hop, changed scene identity,
structure merge, or duplicate cell must fail closed.
Unexpected body-level content such as a table is rejected before comparing
the paragraph vector, so a matching paragraph count cannot hide extra text.

The provider transcript describes UI observations; it is not an independent
oracle by itself. The Office route must also match provider metadata and
the raw DOCX. This admission makes no Google Native, full-fidelity, release,
or 100% portability claim. Official acceptance and a current total require
the normal PR/CI/merge chain followed by a clean exact merged-head verifier.
