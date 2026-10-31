# Contextual language decisions — 31 October 2026

Historical benchmark: the founder subsequently requested highest-score narration with no probability
or margin gate; see [current policy](../../docs/specs/5-reader-panels/5.6-selection-narration.md).

Goal G08; [task](../../docs/09-work/items/2026-10-31-word-narration.md).
The founder requested quick fragment-language identification from sentence context, including
Japanese kanji versus Chinese and French embedded in English; Jev means TypeSafe AI’s model.

## Official integration evidence

- [OpenRouter Jev API and primitives](https://openrouter.ai/blog/insights/what-is-jev/):
  `POST /api/alpha/decisions`, choice criteria, per-option probabilities; separate from chat API.
- [Jev 1.14](https://openrouter.ai/typesafe/jev-1.14/): $0.042/M input tokens, output free.
- [Liquid d1.1](https://openrouter.ai/liquid/d1.1): alternative decision model, $0.02/M input tokens.
- [FastText](https://github.com/facebookresearch/fastText/blob/main/docs/language-identification.md):
  local sentence classifiers exist, including a 917 kB compressed 176-language model. We did not
  integrate it: sentence-majority classification does not itself locate foreign selected spans.
- [ElevenLabs language codes](https://elevenlabs.io/docs/overview/models#supported-languages) and
  [OpenRouter speech options](https://openrouter.ai/blog/announcements/elevenlabs-on-openrouter/):
  `provider.options.elevenlabs.language_code` carries the result into speech.

## Measured smoke comparison

Sequential requests from this Mac through the existing OpenRouter server key. Twelve authored
examples, same state/question/candidate set for both models; network time and cold call included.
These are observed samples, not a population benchmark, SLA or calibration study.

| Model       | Correct choices | Median   | Range        | Total provider cost |
| ----------- | --------------- | -------- | ------------ | ------------------- |
| Jev 1.14    | 12/12           | 280.5 ms | 248–678 ms   | $0.00080850         |
| Liquid d1.1 | 12/12           | 326 ms   | 293–1,537 ms | $0.00011918         |

Jev is the implementation default for its lower observed latency/tail. Liquid remains a viable
cheaper alternative, not an automatic fallback. At this prompt size Jev costs about $0.067 per
1,000 uncached decisions; reader billing remains absent. No separate TypeSafe account/key is needed.

An extended 18-case Jev run had median 307.5 ms (263–642 ms), cost $0.001212666, and 17/18 correct
choices. The failure was a Japanese sentence containing a Chinese quotation: it chose Chinese at
0.51 rather than mixed. The application’s ≥0.8 probability / ≥0.2 margin guard rejected it. Both
mixed cases were refused and all 16 single-language cases selected the expected language. This
small authored set does not prove coverage of 90+ languages or calibrated confidence thresholds.

## Reproduction and limits

[Cases](../../scripts/narration/language-cases.json),
[runner](../../scripts/narration/benchmark-language.cjs),
[initial raw results](initial-results.json), [extended results](extended-jev-results.json).
From apps/api, with OPENROUTER_API_KEY and optional OPENROUTER_BASE_URL in the environment:
`TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register ../../scripts/narration/benchmark-language.cjs`.
Append `typesafe/jev-1.14` to run only Jev. The initial 12 cases are the first 12 current cases.
The runner overwrites output/word-narration/language-benchmark.json; retained snapshots above remain.

Live classifier → ElevenLabs calls generated Japanese `生` (23,030-byte MP3) and French `bonsoir`
(26,792-byte MP3). This proves provider transport/generation, not perceived pronunciation quality.
Language code alone cannot resolve every Japanese reading, homograph stress or mixed-language span.
No library detector can reconstruct an author’s intent from genuinely insufficient evidence.
