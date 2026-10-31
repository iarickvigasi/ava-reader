# Historical implementation evidence — 31 October 2026

Snapshot retained verbatim; current status: [shared task](../items/2026-10-31-word-narration.md).

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
