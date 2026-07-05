# 1. Clerk for authentication

Status: accepted

## Context
We need email + SSO sign-in, session management, and a stable user identity to scope all library/reading data — without building and securing auth ourselves.

## Decision
Use Clerk on the web app for sign-in/sign-up and session tokens. The API verifies Clerk bearer tokens (apps/api/src/auth). Our User row links to clerkUserId; Clerk is the identity source of truth.

## Consequences
- Fast, secure auth with managed flows; offline data is cleared on sign-out.
- Vendor lock-in: user identity, token format, and session UX depend on Clerk. Migrating means re-mapping identities and replacing client/server integration.
- Offline requires a prior authenticated session; no offline-only accounts.
