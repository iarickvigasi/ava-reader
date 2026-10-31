# Narration PR review — 31 October 2026

Shared task: [G08 / selection narration](../items/2026-10-31-word-narration.md).
Executor: Codex. Founder requested PR preparation, code review and a report in chat.
Status: independently reviewed; [draft PR #16](https://github.com/iarickvigasi/ava-reader/pull/16).
At creation GitHub reports mergeable; Security CI is running, not yet a completed check.

Independent reviewers: review_narration (API/audio/security), review_language (context/readings),
review_tool_languages (tool preference/durable data/cache/prompt). Root reviewed integration/playback.
Current candidate includes main c335bb3f7 and its glob/minimatch security overrides; merge was clean.

## Findings and disposition

Five P2 findings repaired and re-reviewed; no remaining actionable correctness finding in reviewed paths:

1. Repeated kanji/foreign words lost the selected occurrence. Validated UTF-16 contextOffset now
   survives source/bilingual capture, trimming, request, Jev state/cache and Japanese speech conversion.
2. Supplementary context corrupted dictionary token positions and could drop following kanji. Mask
   those context characters with equal-length BMP boundaries; preserve ranges. Legacy duplicate
   readings that disagree, and selected Han containing supplementary characters, explicitly return422.
3. Han/Cyrillic/Arabic/Latin translation hints could force the wrong language. Shared scripts now
   reach contextual Jev; shortcuts require exclusive-script matches.
4. Translation normalized away selected quotes. Raw literal text now drives prompt and cache identity;
   normalized source storage remains. Regressions include quoted and quote-only selections.
5. Column language incorrectly skipped translation of preserved foreign words. Every nonempty
   selection/target can generate/regenerate; the model handles already-target-language identity.

## Verification

- Frozen merged lockfile installed in isolated worktree; no original checkout dependencies changed.
- Root typecheck/lint pass; all three package production builds pass, including optimized Next build.
- Fresh application tests: API170 suites/865, web377 files/1,611, catalog61 suites/198: 2,674 total.
- Deploy/security tooling48 tests pass. Registry audit:2 findings,1 locally patched deepmerge,
  1 absent affected minimatch optimizer,0 unpatched; installed patch/absence regressions pass19 tests.
- Independent focused re-review:36 API and25 web tests pass for occurrence/shared-script/translation
  repairs; separate raw-literal generation13 and narration33 tests pass. No outstanding finding.
- Task files pass installed Prettier, diff checks and local-document link checks. Oversized existing
  sync/preferences modules were reduced/preserved; new header/tests are split to the code size limit.
- Retained review-run failures: sandbox listen EPERM in two HTTP suites, resolved by final socket-enabled
  run; initial optional-argument/state assertions and test typing needed updates. Early cleanup used
  the wrong cwd and found no file/formatter; no edit occurred, then corrected paths succeeded.

## Scope and limits

Existing user confirmations cover repeated Rashōmon playback and synchronized tool languages. Live
Google WAV samples and exact400ms silence are in the [trial evidence](2026-10-31-google-flash-tts.md).
Human confirmation of the revised ending, physical Safari/touch playback and broad multilingual
pronunciation remain release checks. Dictionary names/partial compounds and provider language
coverage are imperfect; selected supplementary Han is explicitly unsupported by the reading helper.
AVA pays usage; no new per-user request/concurrency/spending quota is introduced. No full-book
listening, billing, schema migration, production deployment or automatic model fallback.
