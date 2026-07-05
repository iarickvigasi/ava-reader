# 2. OpenRouter + bring-your-own-key for AI

Status: accepted

## Context
AI is core to the product (translate, explain, etymology, future chat/narration). We want model flexibility, cost control, and a path to make AI free for users who bring their own key — without per-provider integration.

## Decision
Route AI calls through OpenRouter via the Vercel `ai` SDK with streaming structured outputs (apps/api/src/ai-comments). The product model: users bring an OpenRouter or own model key (AI is then free to them), or spend prepaid app credits. No ads, no dark patterns.

## Consequences
- One integration spans many models; easy to swap or add models.
- Must support per-user keys and credit accounting in the billing/key layer (not yet built).
- Lock-in to OpenRouter's API shape and structured-output behavior; provider outages affect all AI features.
