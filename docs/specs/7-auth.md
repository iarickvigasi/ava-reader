# Authentication

> Status: active · Updated: 2026-10-22 · ADRs: [[1-clerk-authentication]],
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
   The reconnecting notice auto-hides after six seconds and has a keyboard-accessible close button.
   Dismissal lasts through the same outage, including navigation and temporary offline/restoring
   states; authenticated recovery or a device-account change resets it. Sign-in-required status
   remains visible with its sign-in action, even after reconnecting was dismissed.
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

9. Starting Google sign-in online resets an expired or abandoned identifier-only attempt first.
   Only an explicit click starts Google; reconnecting never opens it automatically.
10. Offline sign-in opens the cached app for a remembered account unless explicitly signed out.
    New visitors see a connection message. Login work never runs offline or clears reading data.
11. Login failures appear in every phase as translated, plain-language messages with a next step.
    Raw provider errors are not shown. Duplicate submissions are blocked; slow requests release
    their busy state after a deadline. Email resend can restart an expired attempt.

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
- [ ] Reconnecting auto-hides after six seconds or manual dismissal without stopping recovery.
- [ ] Dismissal survives rerenders/navigation; recovery allows a new notice and expiry shows sign-in.
- [ ] API access without valid authentication remains denied.

- [ ] Expired Google attempts restart online; reconnecting alone never launches Google.
- [ ] Offline sign-in opens cached reading, respects explicit sign-out, and makes no auth requests.
- [ ] Google, email, resend, and finishing failures show friendly messages in every phase.

## Limits

Only downloaded content is available offline. First sign-in, new AI work, and uncached content
require connectivity. Browser storage eviction and manual clearing can remove offline content.
Production inspected 2026-09-24: Hobby plan, maximum lifetime 7 days (locked Pro control),
inactivity timeout disabled, multi-session disabled. The 365-day policy requires a plan upgrade;
no billing or production settings were changed.
