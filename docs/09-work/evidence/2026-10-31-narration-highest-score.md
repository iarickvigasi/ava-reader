# Narration highest-score policy — 31 October 2026

Shared task: [selection narration / G08](../items/2026-10-31-word-narration.md).
Executor: Codex. Status: implemented; scoped verification passed; local API refreshed.

Founder explicitly requested proceeding with the highest score, removing the 0.80 minimum and 0.20
margin rejection. They also asked where languageHint originates: original selections use Book.language
(EPUB dc:language or catalog metadata); translated selections use their translation target language.
Neither is sentence detection or the Toolbox response-language preference for original selections.

The classifier now chooses among supported speech languages, without unknown/mixed choices. The
application computes the highest positive supported score, preferring the provider choice in a tie.
It proceeds even for low scores or near ties. No positive supported score is malformed/unusable
provider data and remains a provider failure. Native-script shortcuts and timeout recovery remain.

The reproduced kanji scores (ja0.63/en0.35) therefore proceed in Japanese. Removing the rejection
does not change the model ranking or implement an English-loanword preference. Founder was told
this distinction before implementation. Earlier threshold/uncertainty evidence is historical.

Root tests pass: web374 suites/1,602 tests; API165 suites/822 tests; catalog61 suites/198 tests.
Root types and API build pass. Independent review passes seven affected suites/37 tests with no
concrete finding. Tests cover low absolute scores, near ties, choice/score disagreement, ties,
unsupported keys and unusable provider data; controller regression reaches speech for the captured
kanji ja0.63/en0.35 result. Timeout recovery remains active around these decisions.

The captured 0.63 winner generated a real 15,089-byte MP3 in705ms; ffprobe confirms0.88s audio.
Evidence stays under output/kanji-diagnosis (unstaged). A chained-mock formatting issue was repaired
with a standalone typed mock and the API formatter. Final root lint passes; the local API was
restarted and health-checked with the existing database. LanguageHint derivation is unchanged.
