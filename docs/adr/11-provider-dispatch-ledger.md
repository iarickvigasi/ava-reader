# ADR 11 · Durable AVA-funded provider dispatch

Status: implemented locally; live activation and qualification remain gated · 2026-09-29.

## Decision

Keep OpenRouter credentials and network in the trusted coordinator. A registered route fixes the
exact model/provider, prompt/schema hashes, source hash allowance, conservative tariff, maximum
context/output and privacy parameters. Native intake remains the default; test routes require
explicit test hooks. Creating a route record alone does not enable live worker claims.

Use integer USD nanodollars and four durable budgets: global, provider account, exact model and
operation. The model ceiling is at most $10 including the imported historical baseline. Baselines,
ceilings and accounting identities cannot reset; actual charges survive account/job deletion.
Full request/response payloads are private owned blob pins and disappear with account cleanup.

Reserve the entire context allowance (including image input), maximum output and configured
request/image fees before sending. Every call has one stable task ID, exact body hash, immutable
route grant and a committed dispatch intent. Sending uncertainty retains its reservation and pauses
the route. Recovery cannot resend it, even under a new worker generation. Only an authoritative
receipt settles it; proof of never dispatching releases a reservation. There is no timeout refund.

A known response settles actual charge exactly once even after stop or deletion. Overcharge is
recorded truthfully and pauses the route. The application cannot guarantee an external provider
honors its tariff; it sends pinned maximum prices and preserves any violation as evidence.

## Consequences

SQL guards retain the audit, bind budget allocations and validate current dispatch authority.
Cost locks never encompass network or large payload writes. Job authority locks precede cost locks;
settlement uses only the cost lock. There is no reader payment, retry or key interface.

Reconciliation is an operator CLI, not an HTTP reader endpoint. Terminal Failed remains immutable.
A route can resume after all unknown dispatches settle; an overcharge or revoked route cannot be
reactivated by that command. Remaining integration and live evidence are tracked separately.

See [[../specs/3-library/3.7-provider-ledger]] and [[../pdf-provider-checks]].
