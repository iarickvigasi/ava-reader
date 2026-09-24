# 6. Durable offline access, renewable online authentication

Status: accepted · Supersedes ADR 5 automatic sign-out cleanup on session expiry.

## Context

A Clerk script failure can strand token acquisition indefinitely. Treating every missing Clerk
user as explicit sign-out also deletes downloaded books and unsynced work on session expiry.
Readers need cached content independent of authentication availability.

## Decision

- Remember the last authenticated account locally. Expiry, revocation, and provider/network
  failures pause server access; they never wipe that account's downloaded data or pending work.
- Require a valid, same-account Clerk session for all API access. Keep short-lived bearer tokens.
- Serve generic app shells without requiring session cookies. API authorization remains mandatory.
  New visitors without a remembered account are directed to sign-in by the client.
- Retry failed Clerk initialization in place, with backoff, on reconnect and tab activation.
  Isolate the installed SDK's internal getEntryChunks recovery seam in one tested adapter; review
  it on Clerk upgrades. Do not rebuild the provider or reload the page to recover authentication.
- Explicit sign-out records a durable local intent, stops local access across tabs, and wipes
  user data. When offline, server sign-out is retried on reconnect. Warn before losing pending work.
- A different authenticated account cannot render or sync the previous account's state. Preserve
  per-user database isolation and existing purge-on-switch policy.

## Consequences

Downloaded content remains accessible to anyone using this browser profile until explicit sign-out
or removal of local data. Remote session revocation stops server access, not local reading.
Browser storage eviction and user-cleared data remain limits on offline availability.
Custom session lifetimes require a suitable Clerk production plan; configuration is separate from
code deployment. No new long-lived application bearer token is stored.
