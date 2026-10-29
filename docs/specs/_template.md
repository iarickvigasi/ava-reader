# <Feature name>

> Status: draft | active | shipped · Updated: YYYY-MM-DD · ADRs: [[n-title]] · Code: path/

## Summary

One or two sentences: what it is and the job (product.md) it serves.

## Scope

- In: what this covers.
- Non-goals: what it deliberately does not do (prevents scope creep).

## Behaviour

The functional contract as short rules or numbered steps: actions, states, outcomes, and
permissions. Describe no UI placement or appearance; visual rules belong only in
[styles.md](../styles.md).

## Data & sync

Entities/endpoints touched, offline bucket used, ID/locator strategy. Codebase-specific.

## Edge cases

Offline, conflicts, empty/error states, large input, auth loss.

## Acceptance criteria

- [ ] Testable behavioral statements — one per line; no layout or styling requirements.

## Open questions

Unknowns, blocking or deferred.

<!-- Keep ≤30 lines. Link, don't restate: constraints live in ADRs, patterns in conventions.md. -->
