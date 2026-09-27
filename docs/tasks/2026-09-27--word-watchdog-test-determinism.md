# Monotonic watchdog fixture reliability

Task: WORD_WATCHDOG_TEST_DETERMINISM_20260927
Base: 7c3de8ddd34824bc476515cf7045a651a1705628
Authority: owner's standing instruction to repair the Word implementation process
without reducing quality, personally and through normal delivery.

## Observed issue

ORCH_TEST_14O's stalled child exited itself after 1200ms while the test expected
the real progress watchdog to terminate it. Full local RTK observed a process
identity mismatch after 2746ms; an earlier run observed a process inspection
timeout followed by the competing stage timeout. Isolated 14O and remote CI passed.
The test mixed wall-clock-skew verification with a short natural-exit race.

O: retain the actual forward/backward wall-clock tests, with an owned stalled
child that stays alive until the watchdog acts.
T: real fixture child -> unchanged process inspection and ownership checks ->
unchanged monotonic watchdog -> verified termination. No product mutation.
H: removing the competing natural exit and separating the 400ms progress timeout
from a 10s stage safety ceiling eliminates that fixture race. This is not evidence
that every possible host process-inspection failure has been removed.
B: preserve exact progress-timeout assertion, real PID/PGID checks, hostile process
tests and cleanup. Add explicit nonzero-exit/dead-child assertions. No mocks,
skips, production deadline changes, new dependencies or product runtime changes.
P: focused repeated 14O execution, complete RTK and required CI, exact merged-head
verification. Native Word proof is not applicable to this test-only correction.
I: exact base above; candidate and merged SHA recorded in execution evidence.

Product/interface planes: unchanged. Commands and effects are the existing
leased test-process invocation. State is temporary test state. Design router:
NOT_APPLICABLE. Normal revert of this test and companion admission is rollback.
Companion policy preserves historical bindings and adds no accepted-cell credit.
