# Historical implementation evidence — 31 October 2026

Snapshot retained verbatim; current status: [shared task](../items/2026-10-31-word-narration.md).

# Selection narration

- Goal: G08; executor: Codex; status: complete for the requested local implementation and reported regressions; founder qualification passed. Broader device/release qualification remains outside this delivery.
- Base: origin/main `27d3a415`; branch: `codex/word-narration`.
- Outcome: selected-text narration; [Google Flash trial and complete-ending follow-up](../evidence/2026-10-31-google-flash-tts.md).
- Initial acceptance: server-funded ElevenLabs v4 (current Google Flash trial linked above); native language pronunciation with slow/clear natural
  delivery; waiting spinner, playing state, stop/end reset; cancellation on selection/panel changes;
  authentication/ownership, bounded input/time, recoverable failure; no reader billing.
- Owning behavior: [toolbox](../../specs/5-reader-panels/5.2-ai-toolbox.md).
- Requirements: NARRATE-01–05 in [selection narration](../../specs/5-reader-panels/5.6-selection-narration.md).
- Independent review: `review_narration` agent reviewed implementation and re-reviewed repaired
  findings; no further concrete findings. P1: autoplay rejection discarded generated audio, causing
  repeated generation on gesture-dependent browsers. Fixed by retaining audio on NotAllowedError;
  regression requires one generation across retry. P2: stalled Clerk token promise was unbounded.
  Fixed by racing cancellation/timeout; never-settling-token regressions pass.

## Verification — 31 October 2026

Candidate: base 27d3a415 plus staged task changes in this worktree; locked pnpm 10.34.9 dependencies.

- Root typecheck: all three packages pass; catalog reused cache. Root lint: all three pass;
  catalog reused cache. Task-owned files formatted with installed Prettier.
- Web: 361 suites / 1,567 tests pass with maxWorkers=2, including eight narration lifecycle/request
  tests. API: 151 suites / 761 tests pass in-band with local socket permission, including 13
  narration tests. Catalog: 61 suites / 198 tests pass (root test run, cached on later run).
- Real OpenRouter requests with existing server key: v4 generated English (38,077-byte MP3,
  2.32s) and Ukrainian (31,807-byte MP3, 1.92s); ffprobe confirmed playable durations.
- Actual Next reader fixture in headless Chromium: word selection opens toolbox; narration failure
  without a signed-in session is visible, retryable, and panel closes. Open panel resized to 390px:
  control and inline failure remain usable. Direct selection at phone width was not established by
  desktop double-click emulation; no touch-device claim is made.
- Actual SelectionPlayer with live-generated MP3 in Chromium: loading → playing → idle on end.
  This controlled playback check explicitly enabled autoplay; it does not prove Safari gestures.
- Live signed-in panel → API playback, physical Safari/touch media, native pronunciation, slower
  pacing, clarity and naturalness still require human/device evaluation. Delivery tags guide the
  model; no phoneme-level accuracy or subjective listening result is claimed.
- Local samples: output/word-narration/{en,uk}.mp3 (generated evidence, not staged).
