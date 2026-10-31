# Google Flash TTS trial — 31 October 2026

Shared task: [selection narration / G08](../items/2026-10-31-word-narration.md).
Executor: Codex. Status: implemented, independently reviewed and active locally; listening pending.
Previous [Fish trial](2026-10-31-fish-drama-3.md) and staged fixes remain preserved.

Use `google/gemini-3.8-flash-tts` through the existing server-funded OpenRouter endpoint.
Use supported Kore voice, separate pacing/language instructions and PCM wrapped as WAV for
browser playback. Preserve Jev, local Japanese readings and lifecycle. No reader billing or fallback.

Sources: [speech catalog](https://openrouter.ai/api/v1/models?output_modalities=speech),
[OpenRouter TTS contract](https://openrouter.ai/docs/guides/overview/multimodal/tts),
[Google speech documentation](https://ai.google.dev/gemini-api/docs/speech-generation).
Catalog lists 3.8 Flash as successor to 3.1 Preview. OpenRouter requires PCM for Gemini; its
instructions map to speech_metadata.style. Google documents 24 kHz mono signed 16-bit LE raw PCM.
chub is unavailable; official documentation and REST catalog were fetched directly.

## Verification and retained failures

Direct provider probe returned 200, audio/pcm;rate=24000;channels=1. The compiled synthesis helper
generated Japanese title/author/opening, English, Ukrainian and French WAV samples in 2.42–4.29s.
ffprobe confirms all six as pcm_s16le, 24 kHz mono, durations 1.80–5.16s. Samples/timings remain
unstaged under output/google-flash-tts. This proves generation/encoding, not subjective quality.

Root typecheck, lint and tests pass: API 167 suites/836 tests; web 374/1,602 and catalog 61/198
cached (2,636 total). API build passes. Initial build/typecheck caught a Map tuple typing error in
the PCM helper; explicit readonly entries repaired it. Final types/build/lint pass. Tests exercise
RIFF metadata/sample preservation, incompatible MIME/rate/channels/alignment and private WAV transport.
Independent review_screenshot_fixes review found no concrete regression and passed 5 suites/30 tests;
the reviewer verified the provider contract and frontend audio/* compatibility independently.

Restarted localhost:4000 with the Google build; database unchanged. Refresh the reader to discard
previously prepared Fish audio before testing. Formatting, diff and changed-document local-link
checks pass. No browser/device listening acceptance, commit, push or deployment is claimed.
Restarted health returns 200/database up. The previous process logged a language-timeout retry and
the already-recorded BookTranslations disconnect AbortError; no unrelated fix was made here.

## Ending follow-up

Founder liked the Google trial but reported an abrupt ending and requested clear final sounds/space.
Existing six clips had only 109–295 ms below a simple amplitude threshold at the tail; this is not
proof of a missing phoneme. Player waits for ended; no early timer truncation was found.
Request complete final consonants/vowels and natural release. Preserve all generated samples and
append exactly 400 ms of digital silence; WAV sizes include that pause. No fade cuts quiet phonemes.
Revised compiled-helper Japanese/English WAVs generated in 2.49/3.37s, with 400/401 ms exact trailing
silence and valid ffprobe metadata. Evidence: output/google-flash-ending (unstaged). Human listening
must confirm the ending quality; silence cannot recover a sound the provider failed to generate.
Root types/lint/tests pass (2,636 tests; web/catalog cached), API build passes. Independent review
passes 3 suites/19 tests with no concrete finding. Running API refreshed; prior prepared clips require
a reader refresh. NARRATE-11 and its parent overview reconciled; formatting/diff/local links pass.
