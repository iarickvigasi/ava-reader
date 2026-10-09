# AVA profile and developer contacts

> Status: shipped · Updated: 2026-10-05 · ADRs: [[8-role-memberships]] · Code:
> apps/api/src/users, apps/web/components/auth/profile, apps/web/features/offline/buckets/me

## Summary

Every user can edit their AVA display name and reader introduction/publication settings.
Developers may publish a Telegram contact link. Connect behaviour lives in [[11-connect]].

## Behaviour

- Avatar menu opens Edit profile; Manage account continues to edit Clerk account details/photos.
- Name is required (1–100 trimmed characters), overrides Clerk name, and is editable by every user.
- Only DEVELOPER users see or may update Telegram. Empty input removes the link.
- Accept only HTTPS t.me username links; reject other hosts, invite links, paths, queries and fragments.
- Explain that the link is displayed on the home page so readers can contact the developer.
- Roles cannot be self-edited. ADMIN and DEVELOPER are independent memberships (ADR 8).
  Every authenticated user has reader access; no memberships means no elevated permissions.
  A user with both roles retains admin tools and developer contact editing/listing.
  Revoking DEVELOPER hides the contact and disables Telegram editing but preserves the stored link.
  Revoking ADMIN leaves developer membership intact; repeated grants/revokes are harmless.
- Home stacks developers before feedback below `lg`; at `lg` (1024px) and wider, they share
  equal columns with developers left and feedback right. With no developers, feedback spans the row.
- Contacts contain only ID, display name, avatar URL and Telegram URL, ordered by creation then ID.
- Show all configured developers; omit missing names/links and hide an empty section.
- Chips open Telegram separately; unavailable avatars show initials. Names are not translated.

## Data & sync

PATCH /me/profile accepts partial edits, merging queued changes across name and Connect forms.
Existing caches without social fields default to hidden with book sharing disabled.
PATCH /me/profile edits the authenticated user's profile. The me bucket persists pending edits,
merges them over server refreshes, retries on reconnect, and displays permanent rejection inline.
The home bucket caches contacts; old payloads safely omit the section. Telegram itself needs network.
/me and /home return roles arrays. Cached scalar roles normalize on read; explicit empty arrays
win over old roles. Cached permissions never authorize server writes. Roles are refreshed on reconnect.

## Acceptance criteria

- [x] Name edits survive reload/offline and Clerk refresh; developers can add/remove Telegram links.
- [x] Non-developers cannot set Telegram or roles; invalid links fail validation.
- [x] Contacts render before feedback on mobile and beside it on desktop in all six UI languages.
- [x] Missing photos, old caches, rejected edits and account switches are handled safely.
