# AI Toolbox

> Status: shipped · Updated: 2026-06-06 · ADRs: [[2-openrouter-and-byo-key]] · Code:
> apps/web/components/app/reader/overlays/ai-toolbox

## Summary
On-selection AI tools — translate, explain, etymology — that stream an answer about the selected
text without leaving the page. The product's core "investigate in flow" job.

## Scope
- In: translate (to user's target lang), explain (book/author as context), etymology; streaming
  output with typewriter effect, abort/retry, expand saved results.
- Non-goals: free-form chat (future ai-chats), narration, generating standalone highlights.

## Behaviour
1. Select text → toolbox panel offers the three tools.
2. Run a tool → request streams a structured result into the panel.
3. Results are saved as AI comments anchored to the selection; reopening expands tools that already
   have results.
4. Opened offline (or while a queued request is still pending) → the panel shows a "waiting for
   connection" placeholder instead of a blank body; the streamed result replaces it automatically
   when the queued request replays on reconnect.

## Data & sync
Backed by the ai-comments bucket via generate.{translate|explain|etymology} mutations → POST
/library/:itemId/ai-comments/generate/:kind → streamed structured output stored as a ready Ai
Comment. Target language from UserPreferences. The comment's status (queued → streaming → ready, or
failed-with-reason) is the single source of truth the panel renders from.

## Edge cases
Offline open → queued placeholder; the queued request replays on reconnect and the streamed body
replaces it. Transient errors keep retrying in the background. A permanent rejection (4xx) marks the
comment failed and shows the server reason inline in the panel with a Try again button — no toast
(delete drops still toast). Abort mid-stream; missing API/credit key (see ADR 3).

## Acceptance criteria
- [ ] Each tool returns a streamed result for a selection and persists it.
- [ ] Translate respects the configured target language.
- [ ] A tool run offline is queued and completes on reconnect.
- [ ] A tool opened offline shows a localized "waiting for connection" placeholder, not a blank
  panel.
- [ ] A permanent failure shows the server reason inline with a Try again button (no toast); retry
  re-runs and succeeds once the cause is resolved.

## Open questions
Per-user key/credit enforcement; rate limiting; tool result versioning.
