# Toolbox screenshot regressions — 31 October 2026

Shared task: [selection narration / G08](../items/2026-10-31-word-narration.md).
Executor: Codex. Status: implemented; scoped verification passed; local runtime refreshed.

Founder supplied an incorrect Ukrainian explanation of 羅生門 (invented Kyiv connection and
character-derived history) and confirmed that the translation speaker did nothing.
Acceptance: TOOL-FACT-01 and completed-translation narration. Follow-ups:
[timeouts](2026-10-31-narration-timeout.md), [literal translation](2026-10-31-literal-translation.md).

## Changes

- Explanation/etymology prompts preserve the source setting and treat named references as whole
  expressions; uncertain historical/origin claims must stay uncertain. Output-language instruction
  repeats after the selection; deterministic generation reduces output variance.
- Regenerate is available for completed answers. Fresh request IDs bypass old answers, survive the
  durable queue, and remain idempotent on reconnect. Full prompt content participates in server
  cache identity; existing saved annotations are preserved.
- Translation speaker uses the displayed completed text, its own context and target-language hint.
  Known output language is reused only for agreeing non-Latin script; Latin/preserved names still
  use contextual detection with original selection/book metadata. It shares the existing lifecycle. Only one
  clip plays; collapsed tools/account/selection/language changes dispose their player. Incomplete or
  failed translations cannot start speech. Output over 2,048 characters has explicit feedback.
- Feedback spans the full result width; narration/regeneration labels cover all six interface locales.

## Verification and retained failures

Broad suite passes: web373 suites/1,598 tests; API160 suites/797 tests; catalog61 suites/198 tests.
Later Latin-name/alias/transport regressions pass in focused checks; final source review is clean.
Root types/lint and API build pass. Independent reviewer found regeneration dedupe initially omitted
the new identity and feedback initially squeezed the speaker column. Both repaired; independent
re-review passes (web20/API27 affected tests, web types), no remaining concrete finding.
The offline test initially widened a discriminated union; corrected to its actual Explain kind.

Live configured Haiku 4.5 baseline produced misleading Ukrainian text. Initial strengthened prompt
kept Kyoto but unexpectedly answered one Ukrainian request in Indonesian; final language instruction
and temperature0 returned Ukrainian Rashōmon and Bastille notes and an English Rashōmon note, with
the Japanese/French settings preserved. Raw outputs remain under output/toolbox-fixes, unstaged.
These examples qualify the reported regression, not universal factual accuracy.

[Kyoto city history](https://www2.city.kyoto.lg.jp/somu/rekishi/fm/nenpyou/htmlsheet/toshi05.html)
confirms the gate at the southern end of Suzaku Avenue, the entrance to Heian-kyō. Tavily failed twice
with an expired OAuth grant; official-source web fallback was used. No app web-retrieval pipeline or
hardcoded Rashōmon answer was added.

Actual Next fixture: clicking the previously inert translation speaker now gives expected sign-in
feedback in this signed-out browser; 384px card has 344px feedback/304px text and no page overflow.
Screenshot: /tmp/ava-translation-speaker-verified.png. Temporary fixture removed after testing.
Exact provider probes initially timed out or rejected ambiguous standalone names. Source context
resolved the romanized name to Japanese (30,136-byte MP3); known Ukrainian output resolved the
Cyrillic transliteration (27,210-byte MP3). Intermittent detector timeouts remain visibly retryable.
Reviewer caught Latin-script forcing and deprecated code aliases; repaired and regression-tested.
The final paired probe generated both clips (uk 27,210 bytes/1.63s; ja 30,136 bytes/1.81s),
validated by ffprobe. Final API language/controller31 tests and web transport test pass.
No authenticated end-to-end translation audio claim is made here. The same player/request/provider
path was previously accepted for selection narration; this follow-up adds translated-text wiring.
Local API rebuilt/restarted using the existing isolated database; web uses HMR. Refresh and use
Regenerate beneath the saved incorrect Explain answer to replace it. No publication or deployment.
