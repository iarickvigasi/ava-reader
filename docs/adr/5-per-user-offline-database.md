# 5. Per-user offline database isolation

Status: accepted

## Context
Offline data (ADR [[3-offline-first-dexie-buckets]]) lived in one Dexie database `ava-reader` shared by every account on a browser profile, alongside service-worker caches and global localStorage keys. Sign-out cleared only Dexie, and only on the in-tab signed-in→signed-out edge — so a cold start as a different user (A never signs out, B signs in), an account switch, or a session that expired elsewhere left A's library, highlights, reading positions, cached SSR shells, and preferences readable by B. A reading app must guarantee one account's data never surfaces to another on a shared device ([[10-auth]] lists this edge; product.md: respect users).

## Decision
One Dexie database **per user: `ava-reader-<clerkUserId>`**. `getDb()` opens the active user's DB; the active user comes from Clerk, with the last active user persisted to localStorage so the offline-first instant read (before Clerk boots) opens the right DB — always correct offline, since identity can only change online. A different user structurally cannot read another's rows: isolation no longer depends on a wipe firing. A root-level reconciler clears across all three substrates — on identity mismatch (switch / cold-start-as-B) it purges every *other* `ava-reader-*` DB + the SW caches + the previous user's global localStorage; on sign-out it wipes the current user's DB + SW caches + localStorage. The legacy single `ava-reader` DB is deleted once.

## Consequences
- Cross-user leakage is closed by construction (separate IndexedDB per account), not by remembering to clear every table — defense-in-depth.
- We do not retain multiple users' data for instant switch-back (others are purged on login); coexistence / offline-multi-user is explicitly out of scope ([[10-auth]] non-goals).
- Cost: `getDb()` depends on an active-user marker; a stale marker on an online cold-start-as-B yields a brief, self-healing flash of cached content before the reconciler switches+purges (data stays isolated regardless).
- Not yet on prod: the schema collapses to a single version; no data-preserving migration is written.
- Does not by itself keep `/api/me` PII out of cached SSR shells — clearing the SW cache on switch/sign-out covers it for now; baking PII out of shells is separate hardening.
