# Bilingual reading mode

> Status: active · Updated: 2026-09-24 · ADRs: [[2-openrouter-and-byo-key]],
> [[3-offline-first-dexie-buckets]], [[5-per-user-offline-database]]

## Summary

Read an original book beside its translation, with both languages paginated without scrolling.
Build a translated book incrementally, saving reusable sentence translations in the DB and cache.

## Behaviour

1. Desktop: the reader sidebar bilingual button toggles the mode with an accurate pressed state.
2. Phone: the header bilingual button uses the desktop icon and toggles session-only mode.
   Initial mode is original in either orientation. Rotation never changes the selected mode.
   Tablets also use the manual toggle; no synced account preference is written.
3. Phone: original above translation in equal-height panes in both orientations, separated by a
   small divider. Split the reading area after header/footer space. Desktop retains original left
   and translation right. Neither pane scrolls. Left/right swipes and arrow keys turn both together.
4. Sentences retain their paragraph flow and ordinary reader typography; no sentence rows or
   height matching between paragraphs. Both columns paginate the same range to fit both languages.
   A sentence taller than one page uses continuation pages; no text is truncated or font shrunk.
5. Use the existing translation target language. Preserve original locators across mode, language,
   font, and viewport changes. Source progress is authoritative.
6. Translate only enough sentences to fill the current and following bilingual page. At a page
   boundary, one sentence of lookahead may be needed to establish fit. A very long sentence can
   itself occupy several continuation pages; do not generate additional sentences in that case.
7. Save complete sentence results to a translated-book version in Postgres and to the user's
   IndexedDB cache. Font/viewport changes reuse the same sentence translations.
8. Read IndexedDB first, then GET all saved chapter translations from the database. Only after a
   successful GET may remaining misses request AI; merge the database response together.
9. Missing text and initial preparation use skeletons. Keep both columns mounted and commit
   translated text with its measured page layout around the source anchor. Page boundaries may
   change as translations arrive. Background prefetch must not move the current reading position.
10. Offline/failed translation shows localized status and allows source-page navigation.
    Reconnection considers the then-current pages only.

## Sub-specs

- [9.1 Layout](9.1-layout.md): paragraph flow, measurement, gestures, position preservation.
- [9.2 AI API](9.2-ai-api.md): stable IDs, translated-book storage, generation prompt.
- [9.3 Cache](9.3-cache.md): offline storage and bounded demand.
- [9.4 Alignment](9.4-alignment.md): phrase matching, tap/selection gestures, and AI language context.

## Scope

Mobile web/PWA; apps/mobile remains a native-app placeholder. Translated-book records are partial
until the reader visits all sentences. Reading a book does not trigger whole-book AI generation.
Exact line alignment between languages is not required. Phrase alignment is optional enrichment
generated for saved translations and described in 9.4.

## Acceptance criteria

Checked items reflect unit tests and desktop/phone-emulated checks; physical checks remain below.

- [ ] Desktop and phone buttons toggle mode; phone rotation preserves the chosen mode.
- [ ] Phone panes stack original above translation equally; desktop panes stay side by side.
- [x] Neither column scrolls, including long translations and oversized sentences.
- [x] Horizontal gestures navigate both columns together.
- [x] Font changes and rotation reuse sentence translations without repeating AI work.
- [x] Only current/next-page demand generates; navigation discards abandoned demand.
- [x] Completed translations survive reload in DB/cache and render offline.
- [x] Reading position survives mode and layout changes.
- [ ] Physical iPhone Safari passes rotation during gestures/requests and browser-bar changes.

## Validation

API tests cover canonical IDs, ownership, validation, cached generation, and atomic persistence.
Web tests cover demand bounds, continuations, source offsets, cache/account isolation, restore,
cache → database GET → AI ordering, and atomic measured-page updates.
Manual /dev/bilingual-fixture checks on 2026-09-21 verified desktop toggle, simulated phone rotation,
cached re-entry, and stable arrivals. Standalone Playwright rerun and iPhone checks remain pending.

2026-09-24: manual phone mode and stacked-pane geometry have unit coverage. Browser regression
checks cover toggling, rotation, paging, and header fit; execution is pending because the local
fixture server timed out before page load. Physical-device checks remain pending.
