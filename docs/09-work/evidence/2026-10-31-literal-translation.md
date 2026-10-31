# Literal selection translation — 31 October 2026

Shared task: [selection narration / G08](../items/2026-10-31-word-narration.md).
Executor: Codex. Status: implemented; scoped checks passed; local API refreshed.

Founder supplied a Translate result that called the selected word “kanji” a placeholder and asked
for actual Japanese text, despite selecting that word in an English introduction and targeting
English. The previous prompt prohibited echoing source text without allowing identity translation;
book metadata could also distract the model from the literal selection.

The translation prompt now treats every selection as complete literal reading material, including
one word, instruction-like text or literal placeholders. It uses sentence context rather than book
metadata to infer source usage, explicitly permits exact unchanged output for same-language text,
and forbids conversational requests/refusals. The selected text is encoded as one JSON string.
Existing full-prompt cache identity and Regenerate behavior ensure fresh requests use the new
prompt without deleting old saved annotations. No language classifier or speech settings changed.

Live Haiku4.5 verification: all nine cases return translation-only content. Six exact assertions
pass (kanji→kanji, text→text, {{text}}→{{text}}, instruction-like English unchanged, word→mot,
bonjour→hello); Ukrainian greeting and Japanese author/title translations also look correct.
The reported case used the English sentence plus Japanese title/author metadata. Evidence remains
under output/literal-translation/results.json, unstaged.

The actual generateAiComment→streamAiComment service path was also exercised with the live model
and a test persistence stub: streamed body and persisted body both equal kanji (1,026ms). No user
annotations were edited by the probe. Evidence: output/literal-translation/stream.json.

Root checks pass: web374 suites/1,602 tests; API166 suites/827 tests; catalog61 suites/198 tests.
Types, lint and API build pass. Independent review passes three affected suites/12 tests with no
concrete finding. Formatting and local document links are checked at handoff. The local API is
restarted; use Regenerate on the saved bad Translate result to replace it. No push or deployment.

The previous API session also contained book-translations AbortError logs on client disconnect.
Those belong to the separate bilingual-book generation route and were not investigated here;
this fix concerns a successfully generated but incorrect Toolbox Translate response.
