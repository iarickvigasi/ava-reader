# Selection narration

- Goal: G08; executor: Codex; status: complete for the requested local implementation and reported regressions; founder qualification passed. Broader device/release qualification remains outside this delivery.
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

Initial handoff had no commit, push, merge or deployment; later authorized commits are recorded below. Scope remains selected words/phrases, not full-book listening.
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

## Reported failures and synchronized tool language — active goal

Founder reported repeated generic narration failures and wrong Rashōmon title/author pronunciation.
Acceptance: reproduce/diagnose failures; recover safely with truthful status feedback; verify the
Japanese readings 羅生門=ラショウモン, 芥川龍之介=アクタガワリュウノスケ and
或日の暮方の事である=アルヒノクレガタノコトデアル against actual generation. Compare cheaper/faster
speech models without losing supported languages. In a separate commit, make Translate To one shared
preference for Toolbox/Preferences and all three tool response languages, with language-scoped
queued/streaming/ready/failure results and regeneration after switching languages. Keep old results
and late completions distinct from the selected language. No production deployment is requested.

### Pronunciation/reliability fix evidence

The supplied three selections classify as Japanese in live Jev calls (0.99, 1.0, 1.0), so correct
language detection alone did not establish correct reading. Added lazy local Kuromoji/IPADIC
conversion. Actual speech inputs now read ラショーモン, アクタガワリューノスケ and
アルヒノクレガタノコトデアル. Three revised Flash generations returned playable MP3; warm calls
were 520/365ms after a 1,223ms first call including dictionary load. Founder listened to the revised
author-name sample and explicitly confirmed it correct. Flash raw/reading comparison and final
samples remain under output/word-narration/rashomon; no book/user content or credentials is staged.

Flash v2.5 costs $40/M characters versus v4’s $80/M at the checked provider rates and removes the
19-character direction prefix for supported languages. V4 fallback preserves broader coverage.
Safe stage/status diagnostics were added because the old generic catch hid auth, provider, timeout
and gesture failures; the exact historical cause of each user-reported failure cannot be recovered.
The detector’s overly tight 2s deadline is now 5s. A gesture-blocked prepared clip prompts a direct
play tap rather than a false connection error. Empty base URL configuration now uses the default.

Independent review found partial-token 生 readings initially fell back to ナマ regardless of
okurigana: repaired to イ in 生きる and ウ in 生まれた; unresolved partial compounds return422.
Review also found server timeout codes were being collapsed to generic provider failure; repaired.
Review’s exact narration tests pass 18/18. The dependency resolver stalled on unrelated optional
metadata; pinned cached-metadata install completed and lock formatting kept the diff to six added
packages. Early test call-argument expectations and a benchmark working-directory error were fixed.
No unrelated dependencies were upgraded. Physical/native-device behavior remains a release limit.

### Shared response-language fix evidence

One `TranslateTargetField` and `useTranslateTargetLang` value now serves Toolbox/Preferences.
Explain/Etymology payloads, durable pending records, DTOs, prompts and cache identity include target
language. Open tools remain open on switching; old-language chunks stay in their own records.
Independent review identified full-payload dedupe and tied-timestamp retry selection as necessary;
those are repaired. Real bucket-stream regressions exercise English in-flight → Ukrainian queued →
streaming → ready for Translate, Explain and Etymology. Offline hydration retains both languages and
separate contexts. No schema migration was needed. Legacy language-null results regenerate.

Initial stream tests incorrectly installed auth after enqueue and reused persistent fake-DB book
IDs; corrected setup and unique scopes. The fixture split briefly lost an import; corrected. Final
independent exact-path checks pass (API18/18, web7/7). Root suite passes: web370 suites/1,591 tests,
API158 suites/788 tests, catalog61 suites/198 tests. Root types/lint and API build pass. Browser
connector initially reported browser.user unavailable through both AX/DOM APIs; resetting its
binding recovered access. Actual reader fixture UI confirms Preferences Ukrainian → Toolbox
Ukrainian, then Toolbox French → Preferences French. Restored the original English preference and
closed the temporary test tab. Screenshot: /tmp/ava-language-preferences.png. An initial DOM range
probe assumed a direct text node, failed without mutation, then visible word selection succeeded.
No agent-operated signed-in UI walkthrough is claimed. Founder confirmation was requested for
repeated refreshed real-book playback and generated tool results in that session; the confirmation
below subsequently resolved this qualification gate.

Live model output verification: Explain returned Ukrainian. The first Etymology response included
unrelated Chinese/French fragments despite its target-language instruction; strengthened both tool
prompts to require all prose in the selected language, quote only source lexemes, and avoid invented
etymological relationships. This remains model-generated content, not fact-checked etymology.

Local delivery commits: `9b424d0a2` initial narration/context detection, `b4aed169b` Japanese
pronunciation/playback recovery, and a separate shared-tool-language commit containing this final
evidence update. No push, merge or deployment. Founder explicitly confirmed the revised
Akutagawa Ryūnosuke author-name audio is correct; this does not substitute for repeated real-book
playback qualification.

Historical qualification blocker: three consecutive goal turns observed the same absent authenticated
reader session. At those checks, the IAB library showed “Sign in to resume syncing” and unavailable data;
the normal sign-in page is reachable. The local API's configured /api/health returns 200 with database
up (an initial probe mistakenly used /health and returned404). No authentication bypass or account
changes were made. Work was blocked pending founder sign-in/opening Rashōmon, or direct confirmation
of the requested repeated playback and language-regeneration checks. Implementation, independent
review, automated checks and the two-way shared-preference browser check remain complete; the
full goal was not claimed achieved at that point.

### Founder acceptance — 31 October 2026

Founder answered “Yes, all synchronize correctly” to the refreshed-reader check covering Toolbox
Ukrainian → Preferences synchronization, open Explain/Etymology regeneration in Ukrainian, and no
old English output reappearing. Founder also answered “Yes, narration works now” to repeated
narration of the Rashōmon title, author and opening sentence without the earlier playback error.
Together with the earlier author-pronunciation confirmation, independent review, passing 2,577
tests, types/lint/build and actual two-way preference UI check, this resolves the outstanding gate
for the requested local fixes. No product code changed after those checks. Goal complete; no push,
merge or deployment. Broader language accuracy and physical-device release qualification remain
explicit limits rather than claims of this local acceptance.
