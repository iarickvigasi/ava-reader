# Importer batch tuning and monitoring

Bounded positive integer overrides fail before staging if invalid; Compose forwards environment/.env.

| Variable                         |         Default |  Maximum |
| -------------------------------- | --------------: | -------: |
| CATALOG_IMPORT_READ_SIZE         |         50 rows |      500 |
| CATALOG_IMPORT_TRANSACTION_SIZE  |         25 rows |      250 |
| CATALOG_IMPORT_READ_BYTES        | 8388608 (8 MiB) | 67108864 |
| CATALOG_IMPORT_TRANSACTION_BYTES | 4194304 (4 MiB) | 16777216 |

Payloads are fetched in chunks of eight and returned as an ordered prefix within the read byte budget.
Transactions obey both row and JSON payload byte limits. One oversized valid record runs alone; none
are skipped. These budgets estimate serialized payload size, not total Node/driver memory. Writes stay
sequential and retain rollback, individual fallback, and revision guards. No database migration is needed.
Stop the old worker and create a new one to change its image or environment; preserve original inputs.

## Data needed from the running server

Collect a continuous 10–15-minute window, with UTC timestamps and no container restarts in the middle:

- Worker image/commit, kind being processed, effective importSettings, resource limits, and elapsed uptime.
- `docker logs --timestamps --since 15m WORKER`: importBatch/importRead events and retry/error records.
  Preserve full JSON logs, including bulkRecords/fallbackRecords, per-phase timings, payloadBytes,
  rssBytes/heapUsedBytes, and progress. No raw provider JSON or credentials are needed.
- Sample worker and catalog-postgres CPU/memory/BLOCK I/O with `docker stats` every 10–30s.
  Include CPU quota/throttling counters (cgroup v2 cpu.stat or v1 cpu.stat) at both window boundaries.
- Host CPU idle/iowait, disk latency/throughput/utilization (`iostat -xz 10` if installed), memory/swap,
  and filesystem free space. Counters require differences over time, not a single snapshot.
- PostgreSQL buffer hits/reads, temp bytes, WAL bytes and checkpoint-counter deltas over the window.
- PostgreSQL active wait events, dead-row estimates, vacuum progress/counts, and API/catalog HTTP
  status/latency before/during/after vacuum: [measurement queries](catalog-import-maintenance.md).

## Local benchmark

Use a disposable local DB named ava_import_benchmark (required); set its CATALOG_DATABASE_URL.
Apply migrations and run:

```sh
pnpm --filter catalog db:migrate:deploy
pnpm --filter catalog exec ts-node test/benchmark-import-batches.ts
```

The benchmark stages fictional fixtures, then measures reads and writes for authors/works/editions at
25/50/100/250 transaction rows, in forward and reverse order. Filter JSON events by importBenchmark.
It removes its own mappings/entities/runs afterward; drop the disposable database when done. Results
exclude staging time and do not represent production disk, index sizes, contention, or raw payloads.

## Production rollout

The first local synthetic comparison did not consistently favor larger batches; defaults stay 50/25.
Start with the established settings and gather the window above. Compare one change at a time: try
read size 100 / transaction size 50, then 200 / 100; keep byte budgets at their defaults initially.
Use sustained records/sec, p95 page/read time, fallback/error rate, memory, vacuum backlog, and API
latency, including at least one vacuum cycle. Revert if errors/backlog/latency grow.
Production catalog PostgreSQL now allows 1 GiB (development: 512 MiB), retaining shared_buffers=128MB
and 0.5 CPU. Before rollout, check `free -h` and `docker stats --no-stream` for host RAM/swap headroom.
Stop the importer before recreating PostgreSQL; wait for DB health, then resume a fresh worker.
Compare another 10–15-minute window after warm-up, including a completed vacuum cycle; keep batches
unchanged while measuring memory reclaim, cache refaults, I/O stalls, throughput, and search latency.
