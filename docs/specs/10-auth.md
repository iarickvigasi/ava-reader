# Authentication

> Status: shipped · Updated: 2026-07-05 · ADRs: [[1-clerk-authentication]], [[5-per-user-offline-database]] · Code: apps/web/app/{sign-in,sign-up}, apps/web/app/layout.tsx, apps/web/proxy.ts, apps/api/src/{auth,users}, apps/web/features/offline/lifecycle/clear-on-sign-out.tsx, apps/web/components/app/core/signed-out-redirect-runner.tsx

## Summary
Clerk-backed sign-in/sign-up that establishes the user identity scoping all reading data. Gate for every authenticated feature.

## Scope
- In: email-code + SSO sign-in/sign-up, session tokens, API token verification, clearing offline data on sign-out.
- Non-goals: roles/permissions beyond basic role field, offline-only accounts, social profiles.

## Behaviour
1. Unauthenticated users hit /sign-in or /sign-up (Clerk flows).
2. On success, a session token authorizes API calls; the User row links to clerkUserId.
3. Sign-out and account-switch clear every offline substrate (per-user Dexie DB, SW caches, localStorage) so no data leaks between accounts — see [[16-offline-data-isolation]].
4. **Client-side signed-out guard** (signed-out-redirect-runner, an AppShell island): when the network is online **and** clerk-js has loaded **and** reports signed-out, redirect to the local /sign-in. This is the *only* stale-session redirect — the middleware can't distinguish "stale token, user online" from "stale token, can't refresh offline", but the client can: offline, clerk-js never confirms signed-out (no false positives), so the cached shell keeps rendering from Dexie. A session that is merely expired-but-refreshable is refreshed by clerk-js itself and never triggers the guard.

## Data & sync
Clerk session → bearer token verified by apps/api/src/auth (networkless JWT verify; set CLERK_JWT_KEY to avoid a JWKS fetch per request). User.clerkUserId is the identity link. The API resolves the local user **DB-first** (`UsersService.getCurrentUserRecord`): a provisioned user is served from Postgres with no Clerk User-API call, so authenticated reads (home, library, …) succeed offline instead of 500ing; only a first-seen user hits Clerk, and a stale profile is refreshed opportunistically in the background (≤1×/user/hr, best-effort). No bucket; auth state required before any bucket sync.

## Edge cases
Token expiry mid-session; offline with a valid prior session (data accessible); sign-out while mutations pending; account switch on shared device. **Stale session, Clerk unreachable** (wifi drop with the web server still reachable, or a Clerk outage): the middleware (apps/web/proxy.ts) must never handshake/portal-redirect — a `__session*` cookie passes the shell through (Dexie renders, the API still verifies every bearer token); only a cookie-less visitor goes to the **local** /sign-in (`NEXT_PUBLIC_CLERK_SIGN_IN_URL` — the Account Portal fallback brick-loops offline tabs). **Stale session, online**: the cookie pass-through means SSR renders the degraded null-data shell (it looked like the offline fallback while online — the prod mobile bug); the client guard (Behaviour 4) redirects to /sign-in, and the SW must let auth redirects through and never cache degraded/redirected shells ([[14-route-precaching]]).

## Acceptance criteria
- [ ] Authenticated users reach /app; unauthenticated are redirected to sign-in.
- [ ] A signed-out (expired) session on an online device redirects to /sign-in instead of rendering the offline-route fallback; the same expired session offline still renders the cached shell from Dexie.
- [ ] API rejects requests without a valid Clerk token.
- [ ] Sign-out and account-switch leave no prior user's offline data ([[16-offline-data-isolation]]).

## Open questions
Pending-mutation handling on sign-out; future roles for authors/curators.
