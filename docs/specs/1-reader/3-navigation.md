# Reader · navigation

> Status: shipped · Updated: 2026-06-07 · Parent: [[_overview]] · Code: apps/web/features/reader/navigation.ts, .../toc.ts

## Summary
Moves the reader between chapters and to specific positions: prev/next, table of contents, and jump-to-locator.

## Scope
- In: chapter traversal state, prev/next, TOC tree navigation, resolving a requested chapter and the visible chapter, producing a navigation target, creating restore intents for pagination.
- Non-goals: laying out pages (see pagination), restoring on reopen (see resume).

## Behaviour
1. readerTraversalReducer manages traversal state; actions move between chapters and request targets.
2. ReaderNavigationTarget {blockId?, edge?, textOffset?} expresses "go here"; createRestoreIntent turns it into a pinned intent for pagination.
3. TOC: collectTocChapterEntries flattens the tree (first occurrence wins); findActiveTocPathIds highlights the current path; resolveTocNavigationTarget maps a TOC node to a target.
4. resolveRequestedChapterId / resolveVisibleChapterId reconcile what's asked for vs what's loaded in the chapter window.

## Data & sync
Pure logic over ReaderStatusPayload + ReaderTocNode (api-types/reader.ts). Emits targets/intents consumed by pagination; no I/O.

## Edge cases
TOC node pointing to an unloaded chapter; duplicate chapter labels; first/last chapter edges; jump to a locator whose block no longer exists (→ locators fallback); rapid prev/next.

## Acceptance criteria
- [ ] Prev/next and TOC selection change the visible chapter and pin the right position.
- [ ] The active TOC path is highlighted for the current position.
- [ ] A jump target out of the loaded window triggers the correct chapter load.

## Open questions
Chapter-window prefetch size; cross-chapter search/jump.
