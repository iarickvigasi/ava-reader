# Import queue maintenance and read diagnostics

Migration `20261026110000_import_record_autovacuum` changes only public.ImportRecord:
vacuum threshold = 25000 + 0.005 × estimated live rows; analyze threshold = 25000 + 0.01 × rows.
At 15.45M rows these are about 102250 dead tuples and 179500 changed tuples, respectively.
These are eligibility thresholds, not an exact schedule or proof vacuum can keep up. Resources stay
unchanged. The metadata-only migration waits at most 5s for its table lock; it does not run VACUUM.
Existing dead tuples may make the table eligible as soon as the settings are deployed.

## Read diagnostics

Each attempt emits JSON `importRead` events for `pendingIds`, `unresolvedIds`, and `payloads`.
`state` is started/completed/failed; completion includes elapsedMs and records, failure includes
elapsedMs and databaseCode when available. All phases share readId, runId, kind, and the optional after cursor.
A started event precedes the database call, so a stuck first page is visible without importBatch.
The enclosing retry diagnostic retains the failed phase/readId and adds attempt/retry information;
a new attempt gets a new readId. Empty candidates omit payload fetching. No payload contents are logged.

## Verify after deployment

Keep the importer stopped until any existing maintenance backlog and the exact first-page query
have been checked. Ordinary VACUUM with index cleanup can repair the backlog; do not place it in
an API startup or migration transaction. Retest with EXPLAIN (ANALYZE, BUFFERS) and a bounded timeout.
Inspect settings in a catalog psql session:

```sql
SHOW autovacuum; SHOW track_counts;
SELECT reloptions FROM pg_class WHERE oid = 'public."ImportRecord"'::regclass;
SELECT clock_timestamp(), n_live_tup, n_dead_tup, n_mod_since_analyze,
       last_autovacuum, autovacuum_count, last_autoanalyze
FROM pg_stat_all_tables WHERE relid = 'public."ImportRecord"'::regclass;
```

During a vacuum, sample its progress every 10–30s (psql `\watch 10`); elapsed includes cost throttling:

```sql
SELECT p.pid, clock_timestamp() - a.query_start AS elapsed, p.phase,
       p.heap_blks_total, p.heap_blks_scanned, p.heap_blks_vacuumed,
       p.index_vacuum_count
FROM pg_stat_progress_vacuum p JOIN pg_stat_activity a USING (pid)
WHERE p.datname = current_database() AND p.relid = 'public."ImportRecord"'::regclass;
```

Record the first/last samples and autovacuum_count before/after. No progress row means no currently
visible vacuum, not failure; very short vacuums may finish between samples. Dead-row counts are estimates.
Resume one updated worker and compare first-page read phases and sustained importBatch throughput.
Capture API/catalog HTTP status and time_total before, during, and after vacuum, every 10–30s:

```sh
for path in api/health catalog/api/health; do
  date -u +%FT%TZ
  curl --silent --show-error --output /dev/null --max-time 15 \
    --write-out "$path status=%{http_code} seconds=%{time_total}\n" "https://avareader.space/$path"
done
```

Compare median/p95 latency against the pre-vacuum baseline; investigate errors or sustained regression.
Cleanup must finish and dead tuples decline without a growing backlog across successive cycles. If it
cannot keep up, measure storage waits/CPU before changing vacuum cost or container limits. Do not infer
success from an earlier trigger alone, or resume from the highest applied UUID (it can skip eligible rows).
