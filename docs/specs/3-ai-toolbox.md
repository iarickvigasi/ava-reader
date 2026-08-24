# AI Toolbox

> Status: shipped · Updated: 2026-08-24 · ADRs: [[2-openrouter-and-byo-key]] · Code:
> apps/web/components/app/reader/overlays/ai-toolbox

## Summary
On-selection AI tools — translate, explain, etymology — that stream an answer about the selected
text without leaving the page. The product's core "investigate in flow" job.

## Scope
- In: translate (to user's target lang), explain, etymology; every tool's prompt is enriched with
  book context — the sentence(s) containing the selection plus the previous sentence, and the book
  title + author; streaming output with typewriter effect, abort/retry, expand saved results;
  copy-selection action in the panel's selection strip; click-to-expand of the truncated selection
  strip text.
- Non-goals: free-form chat (future ai-chats), narration, generating standalone highlights.

## Behaviour
1. Select text → toolbox panel offers the three tools.
2. Run a tool → request streams a structured result into the panel.
3. Results are saved as AI comments anchored to the selection; reopening expands tools that already
   have results.
4. Opened offline (or while a queued request is still pending) → the panel shows a "waiting for
   connection" placeholder instead of a blank body; the streamed result replaces it automatically
   when the queued request replays on reconnect.
5. Every generate request carries the selection's context when it can be derived: the sentence(s)
   of the start block overlapping the selection plus the sentence before (falling back to the last
   sentence of the nearest preceding text block; omitted at chapter start), whitespace-collapsed.
   Over the length cap it is cut from the beginning — the tail nearest the selection's own
   sentence survives, the previous sentence is sacrificed first. Book title and authors ride
   along. The model is instructed to use these for disambiguation only — it still
   translates/explains/analyzes just the selection.
6. The selection strip's Copy button writes the exact selection text to the clipboard. Success is
   confirmed inline — the copy icon swaps to a check for ~2s, announced to assistive tech — with
   no toast; re-copying restarts the confirmation. Client-only, nothing persisted.
7. The selection strip shows the selection on one line, truncated with an ellipsis. Clicking the
   text toggles the full fragment: it wraps (long unbroken words break) and the strip grows freely,
   overflow absorbed by the panel's scroll; clicking again collapses. A new selection resets the
   strip to collapsed. Client-only, no animation, `aria-expanded` reflects the state.

## Selection context derivation (web)
Pure function over (chapter window, range locator, selected text) — no DOM. Sentences come from
`Intl.Segmenter` (granularity "sentence") over the start block's flat `text`, using the locator's
block-relative offsets. All three panel entry paths (fresh selection, highlight click, AI-comment
underline click) share it, and the offline queue captures the result at enqueue time, so replays
send identical context. Locator offsets are measured against rendered DOM textContent, which can
drift from `block.text` by a few chars (inline-boundary whitespace collapsing; `\n` list-item
joins) — offsets are clamped, never trusted. Worst case the window is shifted by the drift:
usually it just gains the neighboring sentence; a selection shorter than the drift sitting at a
sentence start (short word at a late list item's start) can land wholly in the neighbor, so the
context then misses the containing sentence. The `text` field itself is always the exact
selection — drift only ever affects the helper context.

## Data & sync
Backed by the ai-comments bucket via generate.{translate|explain|etymology} mutations → POST
/library/:itemId/ai-comments/generate/:kind → streamed structured output stored as a ready Ai
Comment. All three payloads accept optional `context`, `bookTitle`, `author` (previously explain
only). Target language from UserPreferences. The comment's status (queued → streaming → ready, or
failed-with-reason) is the single source of truth the panel renders from.

Server cache key (sourceHash) is hash(kind | text | targetLang | model | context | bookTitle |
author) — context-bearing requests no longer collide across locations or books (previously the
same phrase served one cached answer everywhere, leaking book A's explanation into book B).
Changing the formula turns every pre-existing cache row into a miss; old rows survive as saved
comments, no migration.

## Edge cases
Offline open → queued placeholder; the queued request replays on reconnect and the streamed body
replaces it. Transient errors keep retrying in the background. A permanent rejection (4xx) marks the
comment failed and shows the server reason inline in the panel with a Try again button — no toast
(delete drops still toast). Abort mid-stream; missing API/credit key (see ADR 3). Context
derivation degrades to none (request behaves as before) when: no locator, locator's chapter is
outside the loaded window, the start block is missing or textless, or `Intl.Segmenter` is
unavailable. Requests without context/bookTitle hash like legacy ones, so cross-book cache sharing
can still occur only on that degraded path. Copy: clipboard API unavailable or the write rejects →
error toast, icon unchanged; empty selection no-ops.

## Acceptance criteria
- [ ] Each tool returns a streamed result for a selection and persists it.
- [ ] Translate respects the configured target language.
- [ ] A tool run offline is queued and completes on reconnect.
- [ ] A tool opened offline shows a localized "waiting for connection" placeholder, not a blank
  panel.
- [ ] A permanent failure shows the server reason inline with a Try again button (no toast); retry
  re-runs and succeeds once the cause is resolved.
- [ ] All three tools send context (containing + previous sentence), bookTitle, and author when
  derivable; the prompts include them with use-for-disambiguation-only instructions.
- [ ] A selection with no derivable context still generates exactly as before (fields omitted).
- [ ] The same phrase selected under different context or in a different book generates fresh
  instead of serving the other location's cached body.
- [ ] Copy places the exact selection text on the clipboard and shows the transient check
  confirmation (no toast on success).
- [ ] A failed clipboard write shows an error toast and no check confirmation.
- [ ] Clicking the truncated selection text expands it to the full wrapped fragment; clicking again
  collapses it, and a new selection reopens the strip collapsed.

## Open questions
Per-user key/credit enforcement; rate limiting; tool result versioning.
