# 2. OpenRouter + bring-your-own-key for AI

Status: accepted

## Context

AI is core to the product (translate, explain, etymology, future chat/narration). We want model
flexibility, cost control, and a path to make AI free for users who bring their own key — without
per-provider integration.

## Decision

Route AI calls through OpenRouter via the Vercel `ai` SDK with streaming structured outputs
(apps/api/src/ai-comments). The product model: users bring an OpenRouter or own model key (AI is
then free to them), or spend prepaid app credits. No ads, no dark patterns.

## Consequences

- One integration spans many models; easy to swap or add models.
- Must support per-user keys and credit accounting in the billing/key layer (not yet built).
- Lock-in to OpenRouter's API shape and structured-output behavior; provider outages affect all AI
  features.

## Selection narration exception — 31 October 2026

Founder decision: selected words/phrases use AVA’s server key with no reader billing or BYOK.
Initially used OpenRouter’s `audio/speech` endpoint and `elevenlabs/eleven-v4`; text SDK unchanged.
A multilingual premade voice adapts pronunciation to the selected language. V4 supports delivery
tags rather than numeric speed settings. This does not introduce billing for any user.

Contextual pronunciation uses pinned `typesafe/jev-1.14` through the Decisions REST endpoint,
not the chat SDK. [Measured evidence](../../research/2026-10-31-narration-language/README.md) compares
Jev with Liquid d1.1. Bounded account-scoped caching limits repeat work. The founder subsequently
removed score/margin rejection: use the highest supported score. The existing server key funds both.

Earlier pronunciation follow-up: Flash v2.5 became the default for its 32 supported languages (half the v4
per-character rate, synthesis speed 0.85, no direction tags); v4 preserves the other language coverage.
Kuromoji/IPADIC resolves Japanese kanji locally. The lazy dictionary ships in the API dependency;
there is no additional model call for Japanese readings. Proper-name ambiguity remains a quality limit.

## Fish Drama 3 local trial — 31 October 2026

Founder requested trying `fish-audio/drama-3` for narration. Keep the same OpenRouter speech endpoint
and server funding. Use Fish’s default voice, MP3, and the supported `instructions` field for detected
language, slower pacing and clear natural articulation. Keep Jev, Japanese readings and player/error
behavior. No ElevenLabs-only parameters or silent model fallback during this trial. Voice quality
requires listening; this is a reversible local model trial, not production release qualification.

## Google Flash TTS local trial — 31 October 2026

Founder next requested Google Flash TTS. The current speech catalog lists
`google/gemini-3.8-flash-tts`; use Kore and separate language/delivery instructions. OpenRouter
accepts PCM only for Gemini. Wrap its 24 kHz mono signed 16-bit LE samples in WAV for browser
playback, with matching response MIME. Preserve funding, detection, readings and lifecycle.
The preceding Fish trial remains historical evidence; no silent fallback or release claim.
