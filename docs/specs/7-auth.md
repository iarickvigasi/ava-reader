# Authentication

> Status: active · Updated: 2026-09-24 · ADRs: [[1-clerk-authentication]],
> [[5-per-user-offline-database]], [[6-durable-offline-authentication]] · Code:
> apps/web/features/auth, apps/web/components/auth, apps/web/proxy.ts,
> apps/web/features/offline/lifecycle/offline-identity-reconciler.tsx

## Summary

Clerk authenticates server requests. A remembered device account independently owns downloaded
books and pending offline changes; losing an online session never removes local reading access.

## Behaviour

1. First-time visitors without a local account sign in before downloading data. Generic app shells
   require no session cookie; the API always requires a valid Clerk bearer token.
2. Returning readers open cached data immediately, even when offline, cookies expired, or Clerk
   failed to load. Authentication restoration runs separately from local reading.
3. Online states are restoring, authenticated, temporarily unavailable, and sign-in required.
   Provider/network failure is not proof of sign-out. Confirmed expiry or revocation pauses sync
   and shows a nonblocking sign-in action. It never redirects a remembered reader or wipes data.
4. Failed Clerk initialization retries with capped backoff, on reconnect and visible-tab resume.
   Token acquisition and history requests have deadlines; pending locks release on failure.
   Previously requested history retries after recovery without moving the viewed week.
5. Server tokens are short-lived and refreshed silently by Clerk. Intended production policy:
   365-day maximum session lifetime, inactivity timeout disabled. This is Clerk configuration,
   requires a suitable paid production plan, and cannot prevent cookie deletion/private-mode loss.
6. Same-account reauthentication resumes pending changes. Every token getter verifies the current
   session matches the local data owner before and after awaiting a token.
7. Explicit sign-out uses an app-owned action, warns if unsynced work would be lost, records a
   durable sign-out intent, clears local data, and blocks access in other tabs. Offline sign-out
   clears local access immediately and retries server revocation when connectivity returns.
8. Account switching keeps existing purge-on-switch isolation. Old account views unmount before
   adopting the new account. Pending writes must never be sent with another account's token.

## Data & sync

Per-user Dexie and the active-user marker are local ownership, never server authorization.
The API verifies Clerk JWTs and resolves provisioned users DB-first; profile refresh is best-effort.
Authentication failures retain mutation queues; permanent domain failures retain their existing policy.

## Acceptance criteria

- [ ] Cached books open on an offline cold start with expired credentials or failed Clerk scripts.
- [ ] Offline → online restores authentication/history and sync without a reload.
- [ ] Session expiry/revocation preserves downloaded books, progress, and pending annotations.
- [ ] Same-account reauthentication resumes syncing; cross-account token acquisition is rejected.
- [ ] Explicit sign-out wipes local data and blocks other tabs, including when offline.
- [ ] API access without valid authentication remains denied.

## Limits

Only downloaded content is available offline. First sign-in, new AI work, and uncached content
require connectivity. Browser storage eviction and manual clearing can remove offline content.
Production inspected 2026-09-24: Hobby plan, maximum lifetime 7 days (locked Pro control),
inactivity timeout disabled, multi-session disabled. The 365-day policy requires a plan upgrade;
no billing or production settings were changed.
