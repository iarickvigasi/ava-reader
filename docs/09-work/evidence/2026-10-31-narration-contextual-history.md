# Historical implementation evidence — 31 October 2026

Snapshot retained verbatim; current status: [shared task](../items/2026-10-31-word-narration.md).

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
