# Selection narration

- Goal: G08; executor: Codex; branch: `codex/word-narration`.
- Status: local implementation and reported fixes delivered; PR preparation/review in progress.
- Initial base: `27d3a415`; latest-main reconciliation tracked in PR review evidence below.
- Current model: Google Gemini 3.8 Flash TTS through AVA’s existing server OpenRouter key.
- Acceptance: native pronunciation, slow/clear natural delivery, complete endings with 400 ms pause;
  waiting/playing/stop states, cancellation, authentication/ownership and no reader billing.
- Tool acceptance: one response-language preference, durable language-specific results, regeneration
  and literal selected-text translation. Full-book listening is outside scope.
- Behavior: [narration](../../specs/5-reader-panels/5.6-selection-narration.md),
  [toolbox](../../specs/5-reader-panels/5.2-ai-toolbox.md); NARRATE-01–11.

## Current verification and review

- [PR review and final verification](../evidence/2026-10-31-narration-pr-review.md).
- [Google trial and ending follow-up](../evidence/2026-10-31-google-flash-tts.md);
  [earlier Fish trial](../evidence/2026-10-31-fish-drama-3.md).
- [Toolbox screenshot fixes](../evidence/2026-10-31-toolbox-screenshot-fixes.md),
  [timeout recovery](../evidence/2026-10-31-narration-timeout.md),
  [highest-score policy](../evidence/2026-10-31-narration-highest-score.md),
  [literal translation](../evidence/2026-10-31-literal-translation.md).

## Historical implementation and founder acceptance

The following snapshots preserve original conditions, failures, reviews and qualification history.
Their provider choices and pending gates describe that stage, not the current implementation.

- [Initial implementation](../evidence/2026-10-31-narration-initial.md).
- [Local setup and preferences cleanup](../evidence/2026-10-31-narration-local-setup.md).
- [Context helper](../evidence/2026-10-31-narration-contextual-history.md).
- [Japanese reading/playback recovery](../evidence/2026-10-31-narration-pronunciation-history.md).
- [Shared language and founder acceptance](../evidence/2026-10-31-narration-language-acceptance.md).

Original checkout and unrelated work are preserved. Local environment is web :3000, API :4000,
isolated PostgreSQL :15432. No production deployment. Broader native-device pronunciation, Safari
media behavior and language accuracy remain release qualification limits.
