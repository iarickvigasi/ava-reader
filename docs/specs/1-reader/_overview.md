# Reader (overview)

> Status: shipped · Updated: 2026-06-07 · ADRs: [[3-offline-first-dexie-buckets]] · Code: apps/web/components/app/reader, apps/web/features/reader

## Summary
The reading surface: renders a book's chapters as paginated blocks, lets the reader navigate and resume, and bridges text selection to the AI/annotation overlays. Serves the core "read across devices, online or offline" job. Reader is large enough to split — each subsystem has its own spec below.

## Sub-specs
1. content-rendering — blocks, inlines, images, typography, font scale/theme application.
2. pagination — column/page layout, measurement, page splitting, reflow.
3. navigation — chapter traversal, TOC, jump-to-locator.
4. locators — durable position/selection anchoring (shared foundation).
5. resume — restore the last reading position on reopen.
6. selection-bridge — DOM selection → overlay-anchored intent.

## Shared data model (apps/web/lib/api-types/reader.ts)
- **ReaderStatusPayload** — book + chapter window + progress + session, the reader's input.
- **ReaderBlock** (union: paragraph, heading, list, image, …) of **ReaderInline** (text | image); **ReaderListItem**; align left|center|right|justify.
- **ReaderChapterPayload** / **ReaderTocNode** — chapter content and TOC tree.
- **ReaderLocator** {chapterId, blockId, textOffset} — a point position. **ReaderRangeLocator** — a selection range with contextBefore/After fallback. Defined once in spec 4; other specs reference it.
- **ReaderProgressPayload** {locator, completionPercent, …}.

## Scope (whole feature)
- In: everything in the six sub-specs.
- Non-goals: annotation logic (see 2-highlights, 3-ai-toolbox, 4-ai-comments), content download (see 6-offline-reading), audio narration (roadmap).

## Cross-cutting acceptance
- [ ] A cached book opens, renders, paginates, and is navigable fully offline.
- [ ] Position survives reload, font/theme change, and reconnect via locators + resume.
- [ ] Selection reliably anchors highlight and AI overlays to the right text.

## Open questions
Reflowable layout on small/mobile screens; PDF / non-EPUB formats; RTL and vertical scripts.
