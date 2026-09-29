# Durable PDF jobs and isolated execution

Status: selected implementation boundary · 2026-09-28 · PDF-06.

## Decision

PostgreSQL remains the only authority for import state, execution attempts and artifact ownership.
Durable acceptance creates a queued job in the source/LibraryItem transaction. Existing accepted
QUEUED imports receive jobs through an additive migration. Capacity refusal happens before durable
acceptance; replay of an existing operation does not consume another queue slot.

A separate operator-run Node process authenticates a registered, revocable worker principal and
claims work through shared database helpers. The request-serving API does not run conversion or
hold execution leases. Upload inspection uses the same isolated parser boundary. Two process-local
intake slots precede multipart buffering; global backlog checks remain in PostgreSQL. There is no
public worker endpoint and no reader Retry/Cancel action.
A random attempt token, current fence, live lease and cancellation epoch authorize job-scoped source,
heartbeat and completion access. Tokens are stored only as hashes and never logged.

Queue serialization enforces global/per-owner concurrency and admission limits. Database time owns
lease/deadline comparisons. Recovery increments the fence and consumes the fixed internal attempt
budget; it cannot reopen terminal Failed. Source, request, profile and configuration are pinned at
acceptance. The first claim pins the registered worker implementation fingerprint; recovery cannot
silently change implementations. Revocation, administrative stop and deletion invalidate late work.

## Execution and output

The trusted orchestrator holds database access. Each Python child runs in a digest-pinned container
with a job-specific read-only input, no network or credentials, read-only root, nonroot user,
dropped capabilities, bounded CPU/memory/processes/scratch space, rendering and wall-clock limits.
The orchestrator removes the child on lost authority or timeout. No shared host output path or
worker-supplied URL is followed. A bounded output envelope carries descriptors and bytes; validators
check exact identity, hashes, sizes and source/configuration before an owned artifact transaction.

This initial runner uses deterministic native extraction only. The current worker's v1 output is a
candidate, including exit 2, and is retained as WAITING for later reconstruction/review integration.
It cannot pass the canonical-v2 reader/publication gates. Review waiting releases the extraction
lease while owned artifact pins retain the candidate. Paid execution remains denied until PDF-07
provides reservation, dispatch and uncertain-outcome reconciliation authority.

## Failure and verification

Nonrecoverable errors and exhausted recovery produce stable Failed with a safe failure identifier,
stage/reason, input/configuration/attempt references, investigation marker and one notification
intent. This persists intent; notification delivery and reader presentation remain PDF-10/15.
No raw document, credential or provider response is included in ordinary status or logs.

Development fault hooks require explicit nonproduction configuration and emit bounded, job-scoped
acknowledgements. Production refuses fault configuration. Real concurrent claims, process loss,
late results, terminal failure, deletion and resource exhaustion must be verified independently.
Unit checks and candidate packaging do not establish full reader or release readiness.

The import spec owns product state; worker checks and the PDF-06 execution report own commands,
limits and observed evidence. Publication, paid providers and full artifact lifecycle remain in
PDF-09, PDF-07 and PDF-12 respectively.
