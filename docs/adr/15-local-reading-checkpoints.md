# 15. Save reading time locally before synchronization

Status: accepted · Updated: 2026-11-03

## Context

Starting the local timer after a server response loses offline and slow-network reading. A single
synced flag cannot describe a session that continues after an upload. Shared online sessions also
count independent devices differently from offline replay.

## Decision

Each foreground reading run is a locally persisted session with a stable client ID, start timezone,
checkpoint timestamp, increasing revision, and optional final timestamp. Hidden or interrupted runs
close; a resumed run has a new ID. Each run is contiguous, so its checkpoint describes an exact
prefix of recorded seconds without an ever-growing list of heartbeat records.

Checkpoints persist before upload, independently of connectivity or authentication recovery.
Independent devices contribute additively, even when their timestamps overlap. Retries of the same
session contribute once. New sessions use version 2 accounting; historical server rows retain version 1.
Web Locks release ownership on document loss; browsers without them use a transactional 90-second
lease, so crash takeover can wait for expiry. Normal tab handoff observes lease release immediately.

The server accepts cumulative checkpoints by (user, client session ID), credits only the extension
of the accepted prefix, and never adds request-arrival time. Older revisions cannot shorten or
reopen a session. Only the checkpoint protocol is supported; old live/replay routes and the shared
active-session uniqueness constraint are removed.

Snapshots include exact per-session credited seconds from the same transaction as their totals.
Local composition adds only the uncovered prefix extension, including for open and acknowledged
sessions. Upload acknowledgment retires only the sent revision; snapshot coverage controls display.
Reading snapshot revisions prevent stale responses from replacing newer remote totals.

## Consequences

Network changes never create a new reading session. Local checkpoints bound ordinary crash loss;
unobserved suspension gaps are not credited. Hidden time is excluded. Historical zero-duration rows
cannot reveal missing reading time. Cache upgrades discard pre-checkpoint local sessions, including
unsynchronized legacy time, by product decision; existing checkpoint records survive the upgrade.
Deploy schema and server support before the client. Existing credited totals remain unchanged.
This supersedes shared-device accounting in spec 6 while retaining ADR 7 timezone allocation.
