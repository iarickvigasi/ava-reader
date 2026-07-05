# Offline data isolation (per-user)

> Status: active · Updated: 2026-06-28 · ADRs: [[5-per-user-offline-database]],
> [[3-offline-first-dexie-buckets]] · Related: [[10-auth]], [[12-offline-save-sync]] · Code:
> apps/web/features/offline/{db.ts,lifecycle}

## Summary
Guarantee one account's offline data — Dexie, service-worker caches, and localStorage — never
surfaces to another account on the same browser profile.

## Scope
- In: a per-user Dexie DB; a root reconciler that clears on sign-out and on a different-user login;
  clearing all three client substrates; one-time legacy-DB cleanup.
- Non-goals: retaining multiple users' data for instant switch-back / offline multi-user (others are
  purged on login); removing `/api/me` PII from cached SSR shells (tracked separately).

## Behaviour
1. Each signed-in user reads/writes only `ava-reader-<userId>`. `getDb()` resolves the active user
   from Clerk, or the persisted last-active user for the pre-Clerk-boot read.
2. On sign-out (userId → null): `await` a full wipe — delete the current user's DB, the
   `ava-reader-sw-*` caches, and every user-scoped localStorage key + cookie. Then reset in-memory
   buckets.
3. On a different user resolving (account switch, or cold-start as B): `await` purge of all *other*
   `ava-reader-*` DBs + SW caches + the previous user's localStorage, then adopt B's DB.
4. Same-user reload is a no-op (no purge, no wipe).

## Data & sync
DB name = `ava-reader-${clerkUserId}`; last active user in localStorage key
`ava-reader:active-user`. Cleared substrates: the Dexie DB (deleted, not just cleared); Cache
Storage `ava-reader-sw-*`; localStorage `ava-reader:resume:*`, `ava.reader.*`, `ava.interfaceLang`
(+ `ava-locale` cookie), `ava-theme` (+ cookie), `ava-offline-modal:seen`. No server/schema change.

## Edge cases
Identity can't change offline (sign-in needs the network) → the pre-boot DB pick is always correct
offline. The reconciler is mounted at the root layout so it survives the `/app` unmount on sign-out.
Purge/clear is best-effort and retried on the next load (isolation holds even if it fails). A brief,
self-healing content flash is possible on an online cold-start-as-B.

## Acceptance criteria
- [ ] After sign-out, no `ava-reader-*` DB, no `ava-reader-sw-*` cache, and no user-scoped
  localStorage key/cookie remains.
- [ ] Signing in as B where A has data leaves only B's DB; B never reads A's rows.
- [ ] An account switch (A→B in one live tab) purges A and adopts B.
- [ ] A same-user reload preserves that user's offline data.
- [ ] The reader still reads cached content instantly offline (correct DB chosen before Clerk
  boots).

## Open questions
Keeping `/api/me` PII out of cached SSR shells (separate hardening, see
[[4-route-precaching-service-worker]]).
