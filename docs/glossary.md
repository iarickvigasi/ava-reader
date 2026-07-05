# Glossary

- **Bucket** — per-(book/user) offline state container: in-memory snapshot + pending mutation queue + Dexie persistence + sync.
- **Snapshot** — authoritative server state held in a bucket.
- **Pending / Mutation** — queued local op (upsert, delete, generate.*) awaiting flush; coalesced to one per id.
- **Flush** — replay pending mutations to the API, idempotently (keyed by client ULID), then apply the server snapshot.
- **Drop / DropEvent** — permanent mutation failure (e.g. 4xx); surfaced to the user as a toast.
- **Hydration** — loading Dexie rows into a bucket's in-memory state at startup.
- **Locator** — durable position fingerprint (chapterId, blockId, offsets, surrounding text) for a selection or reading position; survives re-import.
- **Block** — structured content unit (paragraph, heading, list, image) within a chapter.
- **Chapter / Spine** — ordered content unit of a book; contains blocks. **TOC** — its table-of-contents tree.
- **Panel** — reader sidebar drawer (contents, preferences, highlights, ai-comments, ai-toolbox, ai-chats); toggled via ReaderUiContext.
- **Highlight** — user text selection with a color, anchored by a locator.
- **AI Comment** — AI annotation (translate, explain, etymology) anchored to a locator.
- **AI Toolbox** — on-selection AI tools (translate, explain, etymology) with streaming output.
- **Library Item** — a user's copy of a Book (User↔Book join); scope for progress, highlights, sessions.
- **Collection** — user reading list (CUSTOM or SMART).
- **Session** — a tracked reading interval (start/heartbeat/stop) feeding reading stats.
- **Progress** — current locator + completion % + minutes read, per library item.
