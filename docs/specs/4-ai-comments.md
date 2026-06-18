# AI Comments

> Status: shipped · Updated: 2026-06-06 · ADRs: [[3-offline-first-dexie-buckets]], [[2-openrouter-and-byo-key]] · Code: apps/web/components/app/reader/reader-screen/overlays/ai-comments, apps/web/features/offline/buckets/ai-comments

## Summary
Persisted AI annotations (translate, explain, etymology) anchored to passages, listed in a panel and marked in-text. The durable record of toolbox investigations.

## Scope
- In: store/list/delete AI comments, paint underline marks on annotated phrases, filter by kind, jump-to-location, offline queue + sync.
- Non-goals: generating the content (see ai-toolbox), chat threads.

## Behaviour
1. A toolbox run creates an AI comment (kind, source text, body, target lang, locator).
2. Panel lists comments per book; filter by kind; click jumps to the locator; annotated phrases are underlined in-text.
3. Delete removes the comment instantly.

## Data & sync
ai-comments bucket; AiCommentRecord status queued→ready. Dedup by (user, sourceHash). Mutations: generate.*, delete — flushed idempotently to /library/:itemId/ai-comments.

## Edge cases
Offline generate stays queued (empty body) until sync; a repeated identical request (same kind + source text + target lang) coalesces into the single queued comment at enqueue — re-mounting the toolbox while offline can't pile up duplicate placeholders, even though each carries a fresh client id; locator unresolved after re-import; permanent failure → DropEvent toast.

## Acceptance criteria
- [ ] A generated comment appears in the panel and underlines its phrase.
- [ ] Identical requests dedupe by sourceHash.
- [ ] Re-requesting the same generate offline (e.g. reopening the toolbox) adds no duplicate queued comments.
- [ ] Delete persists; queued generation completes on reconnect.

## Open questions
Editing/regenerating a comment; surfacing model + cost per comment.
