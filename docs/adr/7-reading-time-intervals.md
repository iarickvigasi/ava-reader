# 7. Preserve credited intervals and the session timezone

Status: accepted · Updated: 2026-09-25

## Context

UTC daily totals cannot be regrouped exactly into local calendar days. Session start/end spans
may include idle gaps; assigning the whole span would invent reading time. Historical reading
belongs to the local dates where it happened, regardless of later travel.

## Decision

Capture the device IANA timezone once when a session starts, persist it locally and on the server,
and retain it unchanged through heartbeat, stop, retry and offline replay. A shared multi-device
session keeps the timezone of its first creator. A new session captures the new device timezone.

Keep UTC segments as authoritative total-time counters and credited UTC intervals in the same
transaction. Merge adjacent intervals. Group each interval using its session's saved timezone;
only the chart's current date/window follows the viewing device. Midnight splits respect DST.

Version 3 snapshots include interval timezones and uncovered legacy daily seconds. Subtract covered
UTC seconds before grouping. Version 2 caches retain their supplied daily allocation until refresh.
Existing sessions without a recorded timezone retain UTC allocation; never infer it from a viewer.
Backfilled intervals alone cannot establish a historical timezone. Deploy both additive migrations
before the API. No data reset, changed replay identity or new multi-device accounting is introduced.

## Consequences

Travel cannot change a past session's day assignment. Offline replay sends the original timezone.
Historical idle gaps and missing timezones cannot be recovered retrospectively. Total seconds stay
unchanged. Sessions crossing a timezone change retain their start zone until the next session.
