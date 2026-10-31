# Narration timeout recovery — 31 October 2026

Shared task: [selection narration / G08](../items/2026-10-31-word-narration.md).
Executor: Codex. Status: implemented; scoped verification complete; local API refreshed.

Founder supplied a 16:27:08 screenshot showing “Narration took too long”. The retained API session
logged a language-stage TimeoutError at 16:27:04. Public-domain live probes also reproduced detector
timeouts. That evidence points to the five-second decision deadline, before speech generation;
without request IDs it cannot conclusively tie an individual screenshot to a log entry.

One timed-out decision now receives one automatic retry inside the shared/cacheable lookup.
Each attempt retains its five-second bound; successful recovery is cached. The button remains
loading until the same request returns. Two failures expose the existing explicit retry feedback.
Uncertain decisions and other errors do not retry automatically; no speech generation is repeated.
No language guess, provider/model swap, new billing or delayed offline replay was introduced.

Verification: broad root suite passes (web374/1,602; API163/812; catalog61/198). Root types,
lint and API build pass. Independent review passes four affected suites /
21 tests with no remaining concrete finding. Tests cover shared recovery/cache reuse, two-attempt
exhaustion then explicit retry, no retry for cancellation/other failures, unchanged uncertainty
thresholds, one speech call after recovery and no speech after exhausted detection.

Fault-injected real-provider probe: the first decision connection deliberately hung until its five-
second deadline; its socket was aborted. One retry returned Japanese and one speech request produced
17,597-byte MP3 in 6,291ms total; ffprobe confirms 1.02s audio. Raw local evidence:
output/timeout-recovery/{result.json,recovered.mp3}. No credentials are stored there.

Initial new tests failed because native DOMException crossed the Jest VM realm and failed
instanceof Error. Production Node normally recognizes it, but the fix now safely extracts only
allowlisted type names across realms for retries and diagnostics. Tests also verify private or
arbitrary thrown data is never logged. A test formatting failure was repaired using the API formatter.
Final disconnect guard and deterministic regression prevent speech starting for a closed response
after recovery; independent controller/recovery review passes 11 tests. Shared detection can finish
for other callers. Final targeted lint/types/build and three controller tests pass; API/database
health is checked after restart. Earlier screenshot-fix changes stay staged and preserved.
No provider/model change or confidence relaxation; no speech auto-retry. External provider outages
can still exhaust both attempts and remain explicit, retryable failures.

Subsequent founder instruction [removed score/margin rejection](2026-10-31-narration-highest-score.md).
