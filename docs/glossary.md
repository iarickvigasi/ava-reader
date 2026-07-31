# Glossary

## Offline & sync
- **Bucket** — per-(book/user) offline state container: in-memory snapshot + pending mutation
  queue + Dexie persistence + sync.
- **Snapshot** — authoritative server state held in a bucket.
- **Pending / Mutation** — queued local op (upsert, delete, generate.*) awaiting flush; coalesced to
  one per id.
- **Flush** — replay pending mutations to the API, idempotently (keyed by client ULID), then apply
  the server snapshot.
- **Drop / DropEvent** — permanent mutation failure (e.g. 4xx); surfaced to the user as a toast.
- **Hydration** — loading Dexie rows into a bucket's in-memory state at startup.

## Book content structure
- **Block** — structured content unit (paragraph, heading, list, image) within a chapter.
- **Chapter / Spine** — ordered content unit of a book; contains blocks. **TOC** — its
  table-of-contents tree.
- **Locator** — durable position fingerprint (chapterId, blockId, offsets, surrounding text) for a
  selection or reading position; survives re-import.

## Reader — pagination
- **Restore intent** — pending instruction to place the reader at a target (a block, or a chapter
  start/end) once the chapter is measured; consumed when applied. Edge intents are *sticky* — pinned
  to the edge until the reader pages away. Produced by navigation/resume, resolved by pagination.
- **Measurement / Measurement entry** — per-chapter map between locators and on-screen page indices
  for one layout (pending | ready | failed); built by measuring the chapter offscreen.
- **Layout key** — measurement cache key `libraryItemId:chapterId:width:height:fontScale`; a resize
  or font change mints a new key → re-measure → re-paginate.
- **Spread / Prefix / Spillover** — wide screens render two columns side-by-side (a *spread*); a
  single-page neighbour is surfaced as *prefix* (previous → column 1) or *spillover* (next → column
  2) so no half-screen is wasted.
- **Preloader** — offscreen render of the chapter window that measures each chapter's layout without
  displaying it.
- **Page box** — the rectangle pages are laid into (viewport minus header); its size drives column
  count and page span.
- **Page span / Page gap** — horizontal distance between consecutive pages (page width + `PAGE_GAP`,
  48px).
- **Page resolution** — outcome of mapping a locator to a page: `exact`, `block-start`, or
  `missing-block`.
- **Restore phase** — `restoring → settled` state machine gating locator publishing and article
  masking until the reader has landed.
- **Visible locator** — locator of the page currently on screen, published as the reader pages;
  feeds progress and preserves position across reflows.

## Reader — text selection
- **Selection check** — a deferred read of `window.getSelection()`, gated to the reader; on success
  it opens the AI Toolbox pre-bound to the fragment. *Touch* checks drop the live selection; *mouse*
  checks keep it.
- **Settle scheduler** — single-slot debounce timer (`settle-scheduler.ts`): the storm of events one
  gesture emits (`touchend`, then a synthetic `mouseup`) collapses to one check.
- **Compatibility (synthetic) mouse events** — `mousedown` / `mouseup` / `click` the browser
  *fabricates* after a touch so legacy mouse-only code still works; may echo a real selection gesture
  and must not override its touch check.
- **Native callout** — the OS text menu (iOS Copy/Look-Up, Android Copy/Translate); touch checks drop
  the live selection to keep it from covering the panel.

## Reader — UI & annotations
- **Panel** — reader sidebar drawer (contents, preferences, highlights, ai-comments, ai-toolbox,
  ai-chats); toggled via ReaderUiContext.
- **Highlight** — user text selection with a color, anchored by a locator.
- **AI Comment** — AI annotation (translate, explain, etymology) anchored to a locator.
- **AI Toolbox** — on-selection AI tools (translate, explain, etymology) with streaming output.

## Domain & user data
- **Library Item** — a user's copy of a Book (User↔Book join); scope for progress, highlights,
  sessions.
- **Collection** — user reading list (CUSTOM or SMART).
- **Session** — a tracked reading interval (start/heartbeat/stop) feeding reading stats.
- **Progress** — current locator + completion % + minutes read, per library item.
