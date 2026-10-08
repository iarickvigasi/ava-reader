# Connect

> Status: active · Updated: 2026-10-08 · Code: apps/web/components/app/connect,
> apps/web/app/app/connect

## Summary

Connect introduces a reading community: meet readers, share discoveries, and discuss books.

## Current scope

- Replace Insights in desktop/mobile navigation with localized Connect at `/app/connect`.
- Preserve `/app/insights` unchanged; Home's Daily mastery heading links there on all screens.
- Render only the introduction: serif hero, three feature cards, and a privacy note.
- Cards describe finding readers with similar interests, sharing lists/notes/insights/reviews/quotes,
  and discussing books/chatting/making friends. Mark these planned social features Coming soon.
- Localize English, Spanish, French, German, Brazilian Portuguese, and Ukrainian.
- Precache both Connect and Insights; no redirects, new API, or profile writes in this phase.

## Planned next sections (not implemented in this phase)

- Required introduction: 180 characters, three-line textarea, character counter, live card preview.
- Optional current-book sharing switch, off by default. Shared title follows the latest read
  unfinished, unarchived book dynamically when reading activity changes; omit if none exists.
- Publish my profile becomes Hide my profile; nearby small copy says You can always hide your profile.
- Published edits offer Save changes; hiding preserves the introduction for republishing.
- Explain that signed-in AVA readers see name, avatar, introduction, and optionally the current book.
- Meet other readers shows published avatar/name/introduction/current-book cards.
- Publishing immediately adds the own card; hiding removes it. Empty state invites the first reader.
- Own offline changes use buckets and pending sync feedback; visibility elsewhere changes after sync.

## Data & sync

Current phase has translated static content only. Route shells reuse the existing SW precache.
Future profile mutations extend the me bucket; directory responses expose only opted-in fields.

## Acceptance criteria

- [ ] Desktop and mobile Connect navigation opens `/app/connect` in all six locales.
- [ ] Introduction describes the community and future features with theme-token styling.
- [ ] Daily mastery headings open the preserved Insights page on desktop and mobile.
- [x] Both routes are included in offline precaching.
- [x] No profile form, publishing action, or reader directory is shipped in this phase.

## Open questions

Future discovery ordering and granular visibility; detailed social API and moderation scope.
