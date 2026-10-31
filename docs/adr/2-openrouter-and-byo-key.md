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
Use OpenRouter’s `audio/speech` REST endpoint and `elevenlabs/eleven-v4`; the text SDK is unchanged.
A multilingual premade voice adapts pronunciation to the selected language. V4 supports delivery
tags rather than numeric speed settings. This does not introduce billing for any user.

Contextual pronunciation uses pinned `typesafe/jev-1.14` through the Decisions REST endpoint,
not the chat SDK. [Measured evidence](../../research/2026-10-31-narration-language/README.md) compares
Jev with Liquid d1.1. Bounded account-scoped caching and uncertainty refusal limit repeat work and
unsafe guesses; probability guardrails need broader calibration. The existing server key funds both.
