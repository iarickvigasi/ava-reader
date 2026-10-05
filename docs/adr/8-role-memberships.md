# Independent role memberships

Status: accepted · Date: 2026-10-05

ADMIN and DEVELOPER are independent memberships in UserRoleMembership, uniquely keyed by
(userId, role). Every authenticated account has ordinary reader access without a USER membership.
Memberships cascade on user deletion. Grant is idempotent and revoke removes only its target role.
Only operator commands manage roles; profile requests cannot change memberships.

AVA display names may override Clerk names; Clerk remains the source of account identity and photos.
Store the override separately so background Clerk refresh cannot undo an AVA profile edit.
Telegram URLs belong to AVA profiles and are published only for DEVELOPER accounts.

The API returns roles arrays. Server permission checks always use current DB memberships.
Offline caches normalize legacy role values for UI display only; explicit roles arrays, including
empty arrays after revocation, override legacy values.

Production has no privileged users to preserve. The schema migration performs no data backfill.
Before applying it locally, snapshot localhost assignments and restore them locally afterward.
Deploy the new API and frontend together: the removed role column has no dual-write compatibility.
The old scalar must not remain a second source of permissions.
