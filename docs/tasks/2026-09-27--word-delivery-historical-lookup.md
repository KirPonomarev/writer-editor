# Preserve exact historical proof through transparent Git adapters

Task: WORD_DELIVERY_HISTORICAL_LOOKUP_20260927
Base: e02cd9dfedfa151ef80d30b61b11a1eb52b36cc9
Authority: owner Word correction and acceleration plan, bounded certification perf.

O: unchanged historical certification verdicts with fewer redundant Git queries.
T: existing certification CLI -> exact requested and historical commit identity ->
ancestry and admitted delta -> unchanged artifact and governance verification.
H: a transparent Git adapter can resolve the same pre-existing immutable hint as
real Git. Before using it, resolve BOTH requested and pinned commit identities.
A synthetic identity, unavailable pin, failed ancestry or divergent delta keeps
exhaustive lookup. No hint is an acceptance receipt or artifact verification.
B: no cell acceptance credit, new cache, dependency, product runtime change, gate
removal, fixture substitution, test skipping or authority expansion.
P: full-result equality on a fixed historical requested SHA; mutated artifact
failure; synthetic and unresolved identity fallback; existing unadmitted path
mutants and all post-audit tests; mandatory repository checks and exact merge.
I: exact base above and the existing immutable pinned candidates; old bindings
remain. Failed hint resolution never silently returns PASS.

Measured baseline on 0d5631e63c6af9fa45532a4145dfff7072eefb7e:
one DocxNotification check through a transparent adapter used 463 diff queries,
one rev-list and 5420.7005ms. The prior CI's two PR1888 reconciliation tests took
221865.099847ms and 227095.41749ms. These are baseline observations, not promised
future whole-pipeline timings. Benchmark receipts are external to product truth.

FEATURE_INTEGRATION_MANIFEST_V1: NOT_APPLICABLE_CERTIFICATION_CLI_ONLY.
Product Core, Command Kernel and Design OS remain unchanged. Existing read-only
Git effect and derived certification result only; no product state or UI write.
DESIGN_TOOL_ROUTER: NOT_APPLICABLE. No UI changes.
Rollback: revert helper, tests and exact admissions as one contour.
