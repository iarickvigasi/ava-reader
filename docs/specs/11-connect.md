# Connect

> Status: active · Updated: 2026-10-08 · Code: apps/web/components/app/connect,
> apps/web/app/app/connect

## Summary

Connect introduces a reading community: meet readers, share discoveries, and discuss books.

## Current scope

- Replace Insights in desktop/mobile navigation with localized Connect at `/app/connect`.
- Preserve `/app/insights` unchanged; Home's Daily mastery heading links there on all screens.
- Render the introduction and a reader profile editor with a live card preview.
- Cards describe finding readers with similar interests, sharing lists/notes/insights/reviews/quotes,
  and discussing books/chatting/making friends. Mark these planned social features Coming soon.
- Give the three feature-icon circles a lighter day-theme fill than their cards; keep their night fill.
- Localize English, Spanish, French, German, Brazilian Portuguese, and Ukrainian.
- Precache both Connect and Insights; keep the existing Insights route.

## Reader profile

- Required introduction: 50–180 trimmed characters, three-line textarea, counter, live card preview.
- About-you and preview labels align, with matching line heights and label-to-field spacing.
- Use 48px vertical spacing between the About-you field, book-sharing row, and profile actions.
- Empty previews show only avatar/name; the card grows with description or shared book content.
- Display the optional current-book title and authors in the preview, with a middle dot
  separator on the same flowing line;
- Optional current-book sharing switch, off by default. Shared title follows the latest read
  unfinished, unarchived book dynamically when reading activity changes; omit if none exists.
  Omit the separator and author when the book has no known authors.
- Publish my profile becomes Hide my profile; nearby small copy says You can always hide your profile.
- Published edits offer Save changes; hiding preserves the introduction for republishing.

## Planned reader directory (not implemented in this phase)

- Meet other readers shows published avatar/name/introduction/current-book cards.
- Publishing immediately adds the own card; hiding removes it. Empty state invites the first reader.
- Own offline changes use buckets and pending sync feedback; visibility elsewhere changes after sync.

## Data & sync

PATCH /me/profile accepts independent introduction, profilePublished, and shareCurrentBook edits.
The existing me mutation queue merges partial edits, preserves them on refresh, and retries online.
Missing cache fields default to an empty introduction and false flags. Persist no book title as a
profile setting: /me derives currentReadingBook from actual reading progress when sharing is enabled;
local progress overlays it offline. Draft text persists locally; publishing saves the introduction
and sharing choice together. Published edits offer Save changes. Server validation requires a
50–180-character introduction when publishing or editing a published description; hiding does not require one and preserves the draft.
Three lines describe the textarea height; actual wrapping varies by screen and language.
The 180-character limit counts Unicode code points consistently on client and server.
Directory responses will expose only opted-in fields. Route shells reuse the existing SW precache.

## Acceptance criteria

- [ ] Desktop and mobile Connect navigation opens `/app/connect` in all six locales.
- [ ] Introduction describes the community and future features with theme-token styling.
- [ ] Daily mastery headings open the preserved Insights page on desktop and mobile.
- [x] Both routes are included in offline precaching.
- [x] Publishing requires at least 50 trimmed characters; hiding preserves it and switches the action label.
- [x] Profile fields and drafts survive offline reload, reconnect, and server refresh.
- [x] Current-book title follows reading activity only when opted in; no directory is shipped.

## Open questions

Future discovery ordering and granular visibility; detailed social API and moderation scope.
