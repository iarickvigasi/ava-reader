# Selection narration

- Goal: G08; executor: Codex; status: implemented; scoped verification complete; human/device qualification pending.
- Base: origin/main `27d3a415`; branch: `codex/word-narration`.
- Outcome: pronounce selected words/phrases in the existing toolbox.
- Acceptance: server-funded ElevenLabs v4; native language pronunciation with slow/clear natural
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

## Retained failures and recovery

Initial shared dependencies were older than current main: missing packages and stale Prisma types.
Installed this worktree's frozen-lockfile dependencies independently; no original dependencies were
modified. Corepack cache access initially failed under the sandbox. Prisma required a placeholder
DATABASE_URL for generation, then generation without an engine download via
PRISMA_GENERATE_NO_ENGINE=1; no database connection/migration occurred.

Initial broad tests hit socket EPERM, worker resource failure and archive timeout under concurrency.
Reruns with API local sockets/in-band and web maxWorkers=2 all pass. One task test had an unbound
mock-method lint error, repaired by asserting its standalone mock. Browser setup initially lacked
Clerk's server key; reused existing local configuration without displaying/copying secrets. Next
regenerated apps/web/AGENTS.md at startup; restored its original content.

## Handoff

No commit, push, merge or deployment. Scope remains selected words/phrases, not full-book listening.
Reader billing is absent; AVA pays provider usage. Documentation owners, overview, product, ADR,
architecture, styles and README reconciled. Current main has no Atlas/qa commands from the alternate
uncommitted handbook, so those commands are inapplicable here. Next action: human/device listening
and signed-in end-to-end qualification before release.

- Documentation: main uses docs/specs rather than the uncommitted handbook in the original checkout;
  that checkout is preserved. No merge, push or deployment authorized/performed.
- Provider reference: https://openrouter.ai/blog/announcements/elevenlabs-on-openrouter/
  confirms model, endpoint, voice names, MP3 and lack of numeric speed control on v4.
- Research tooling: chub unavailable; Tavily returned no usable result; official web docs used.

## Local testing environment

At the founder's request, started this worktree on localhost:3000 (web) and localhost:4000 (API).
An isolated `ava-narration` PostgreSQL container uses port 15432 and a new persistent volume;
no existing AVA database container/volume was found. Applied all 31 migrations to that new database.
Library starts empty; sign in and upload an EPUB for testing. API/database health and web/sign-in
respond 200; unauthenticated narration responds 401. Existing local Clerk/OpenRouter configuration
is supplied only through process environment. Language hints were subsequently implemented in the contextual-language follow-up below.

## Preferences cleanup requested during testing

Founder requested hiding the Listening placeholders. Removed the section (voice, ambient, speed)
and its unused helpers; updated preferences spec, parent overview and product roadmap. Web typecheck,
lint, formatting and actual Chromium preferences checks at 1280px/390px pass. The first browser check
used a nonexistent label and timed out; corrected to the existing reading-goal accessible label.
No new tests were added for this reversible presentation removal. Selection narration is unchanged.

## Contextual language helper — implemented

Founder requested fragment-level language detection from sentence context, specifically Japanese
kanji misread as Chinese and French words in English books. Jev means TypeSafe AI’s decision model.
Implement NARRATE-06, benchmark live classification latency/accuracy/cost on authored examples,
review independently, test context transport and provider language hints, then refresh running API.
Use the existing goal G08 and worktree; no unrelated changes or deployment.

Results: [measured comparison and retained raw evidence](../../../research/2026-10-31-narration-language/README.md).
Jev 1.14 is the selected implementation default after the live comparison. Source and translated
selections carry containing sentence context and a weak language hint; same-account repeat decisions
are bounded/cached. Uncertain/mixed results fail explicitly instead of forcing a book-language guess.

Independent reviewer `review_language` found three P2 issues: kana shortcut accepted mixed Han
quotations; DOM whitespace drift could pick the neighboring sentence; translated context truncated
before late fragments. All repaired and independently re-reviewed, with dedicated regressions.
The cross-block context test initially expected a space rather than its preserved newline; corrected.
Additional test lint/type issues were fixed. The first benchmark launch used the wrong working
directory and made no provider requests; the corrected runner’s model override was verified.

Final root test run with maxWorkers=2 passes across all packages; API/socket tests were run outside
sandbox port restrictions. Build, typecheck, lint and browser/provider limits are recorded at handoff.
The local API was rebuilt/restarted without changing the database. Existing IAB library state is
signed out/unavailable, so signed-in real-book narration is not claimed. An earlier API log also
contained a User_clerkUserId_key upsert conflict, outside this change; no account-data edits were made.

Delivery evidence: root typecheck passes (catalog cached); root lint passes without warnings (API and
catalog cached on final repeat); root tests pass with two workers/package: web 366 suites/1,580 tests,
API 155 suites/777 tests, catalog 61 suites/198 tests. API build passes and restarted health returns
200 with database up. Formatting and changed-document local-link checks pass. Jev’s extended mixed
quotation label failure is retained in the research report; the application refused its 0.51 result.
No commit, push, merge or release. Physical-device listening and broader language calibration remain.
