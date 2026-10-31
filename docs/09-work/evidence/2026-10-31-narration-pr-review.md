# Narration PR review — 31 October 2026

Shared task: [G08 / selection narration](../items/2026-10-31-word-narration.md).
Executor: Codex. Founder requested PR preparation, code review and a report in chat.
Status: reviewing/repairing full branch against current origin/main.

Independent reviewers: review_narration (API/audio/security), review_language (context/readings),
review_tool_languages (tool preference/durable data/cache/prompt). Root reviews integration/playback.

## Findings and disposition

- P2: Japanese context.indexOf selected the first repeated kanji; exact-occurrence repair pending.
- P2: shared-script translation hints could force wrong language (Han/Cyrillic); shortcut restricted
  to exclusive script matches, with shared scripts returning to contextual Jev. Re-review pending.
- P2: literal translation normalized away selected quotation marks; raw input is now used for both
  prompt/cache identity, normalized source storage retained. Re-review pending.
- P2: translated-column language incorrectly skipped same-target translation of preserved foreign
  words; repair pending.

Latest main advanced to c335bb3f7 (glob/minimatch security overrides); reconcile it before final
verification. Local checks, final review, PR URL and remaining limits will be recorded at handoff.
