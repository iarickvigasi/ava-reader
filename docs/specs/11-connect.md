# Connect

> Status: active · Updated: 2026-10-09 · Code: apps/web/app/app/connect,
> apps/web/components/app/connect, apps/web/features/offline/buckets/readers,
> apps/api/src/users/discovery/read-published-readers.ts

## Purpose

Connect helps signed-in AVA readers meet people with similar reading interests. Today it offers a profile editor and reader discovery. Lists, posts, notes, reviews, quotes, chat, and richer privacy controls are introduced as Coming soon, not as working features.

## Page and navigation

- Desktop and mobile navigation open `/app/connect` in all six supported languages.
- Home's Daily mastery heading opens the preserved `/app/insights` page.
- Both routes are precached for offline navigation.
- The introduction explains the community and shows three Coming soon cards. Their icon circles are lighter than the cards in the day theme; the night theme keeps its existing colors.

## Your profile

- An introduction is required to publish: 50–180 trimmed Unicode characters. Show the limit and a live card preview. On mobile the input grows to show all entered text; on wider screens it stays three lines tall.
- The preview starts with avatar and name. It grows as an introduction or shared book is added. About-you and preview labels align; the introduction field, book switch, and actions have consistent spacing.
- Sharing the current book is optional and off by default. When enabled, show the title and known authors on one flowing line separated by a middle dot. Use the latest read, unfinished, unarchived book; update it as reading changes. Show no book when none qualifies.
- Publish my profile changes to Hide my profile after publishing. Hiding keeps the introduction for later. A small hint says the profile can always be hidden; published edits offer Save changes.
- On mobile, center the buttons and status copy and reserve room for the two-button state so the preview does not jump. On wider screens keep the actions left aligned and place the published confirmation beside the button.

## Reader discovery

- The visible section is called “Meet other readers.” Show each published reader's avatar,
  name, introduction, and shared current-book title and authors. Do not mark the current
  user's card with “You.”
- Reader cards use the Hide my profile button's fill in each theme. On wide screens they are about 20% wider than the original three-column cards; mobile width is unchanged.
- When no profiles are available, center the icon and invitation copy at every screen size. The English heading is “Every reading circle starts with someone.”

## Privacy and offline behavior

- `GET /readers` requires sign-in and returns only published profiles. Its response explicitly contains an internal card ID, display name, avatar URL, introduction, and optional book title and authors. Include book details only when the reader chose to share them. Never return email, Clerk ID, roles, annotations, library-item IDs, or reading timestamps.
- Cache the server list in the signed-in user's offline readers bucket. Refresh it when Connect opens, connectivity returns, or the tab becomes visible. Keep the existing `connect:readers` cache key.
- Overlay the current user's local profile and reading changes on that cache. Publishing adds their card and hiding removes it immediately on this device, even offline. Other readers see the change after it syncs and their list refreshes; this is not live push delivery.
- `PATCH /me/profile` uses the existing mutation queue for introduction, published status, and book-sharing preference. Drafts survive offline reloads and retry on reconnect. The server requires a valid introduction when publishing or editing a published one; hiding preserves the draft. The book title is derived from reading progress, never stored as a profile setting.

## Acceptance criteria

- [x] Connect and Insights routes remain available in the right places, including offline navigation.
- [x] The profile editor validates, previews, publishes, hides, and saves changes as described.
- [x] Book sharing is optional and follows reading progress locally and on the server.
- [x] Reader discovery shows only published profiles and explicitly shared fields.
- [x] Own changes appear immediately on this device; an empty list shows the invitation.

## Future decisions

Discovery ordering, search, granular visibility, moderation, and social interaction APIs remain open.
