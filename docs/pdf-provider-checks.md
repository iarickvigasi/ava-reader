# Provider ledger operator checks

Use an explicit task/deployment DATABASE_URL. These commands do not load a project environment
file and never print provider credentials. No command dispatches a provider request by itself.

From apps/api run `pnpm exec ts-node src/scripts/pdf-provider-admin.ts` with one command:

- `metrics`: read budget/reservation/state aggregates (not a transactional snapshot).
- `register-budget <json>`: create or exactly verify an immutable historical baseline and cap.
- `register-route <json>`: record a verified route, exact source hashes and prompt/schema allowance.
- `settle <callId> <receipt.json>`: attach an authoritative known receipt; never invent costs.
- `release-undispatched <callId>`: release only a call with no committed dispatch intent.
- `reactivate-reconciled <routeId>`: only after every unknown receipt is accounted for.
- `resume-reconciled <operationId>`: resume only a reconciled nonterminal provider wait; never Failed.
- `revoke-route <routeId>`: permanently deny future dispatch under that route.

A route JSON uses the strict `RouteConfiguration` and `RouteTariff` source types. Rates are USD per
million tokens plus explicit request/image fees. Reservation includes maximum context, maximum
output and maximum image count. Pin endpoint evidence SHA, verification time and expiry (≤24h).
Live registration additionally requires a finite pilot inventory: exact owner/operation/source IDs,
image fingerprint and task/request/render hashes, with bounded per-operation/global/model reserves.
[Authored pilot checks](pdf-pilot-checks.md) describe the separate, dormant diagnostic entry.
Ordinary API imports and worker loops still do not activate live dispatch.

Never release DISPATCHING or UNCERTAIN because a process stopped or a timeout elapsed. Preserve
the reservation, obtain the exact provider generation receipt if possible, and leave unknown cases
blocked otherwise. Settlement must survive account deletion; private source/response must not.

Verification: provider unit tests; concurrent reservations and late receipts in a dedicated disposable
PostgreSQL database; injected authoritative counters with external fetch blocked. A stub PASS is not
live provider billing evidence. Historical $10/model limits are not renewed by another task/job.

Current detailed evidence is retained in the task workspace under output/pdf-epub-integration-07.
Full import/recognition/Ready and deployment verification are tracked in the epic, not inferred here.
