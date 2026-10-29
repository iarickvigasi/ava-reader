# Deploy and operate the public EPUB importer

Operations: [formats](catalog-bootstrap.md), [reviews](catalog-publication.md), [sources](catalog-digital-sources.md).

## Release gates

The implementation supports a supervised pilot; a 300-book unattended launch is not ready yet.
IA, Standard Ebooks and Wolne Lektury are supported; other providers still need explicit adapters.
Classics auto-publish after processing with review deferred; exact rights/quality review follows.
No territory enforcement exists; a restricted approval cannot safely serve an unrestricted audience.
The reader worker claims PENDING runs but has no crash lease: PROCESSING may remain stuck after a crash.
Short poems can fail the minimum-text gate. Resolve these cases explicitly; never disable the gate globally.
The 12 local scan-derived files are processing examples, not approved publication masters.

## Deploy the services

1. Back up both databases and test restoration. Measure Catalog volume, WAL and backup headroom;
   source EPUBs, covers and reader packages all live there. Main retains private bytes and user data.
2. Finish/stop any active metadata application before migrations. Deploy through the existing
   workflow: build runtime/migration images, start databases, migrate Main and Catalog, start services.
   Include source evidence and `20261029180000_deferred_publication_review`; regenerate the client.
3. Set identical server-only `READING_ASSET_SYNC_SECRET` (32+ random characters) on API and Catalog.
   API also needs `CATALOG_API_BASE_URL`; Compose supplies `http://catalog:4001` internally.
   Use HTTPS across hosts. Start/restart API, Catalog and web with the new code/clients together.
4. Check API/Catalog health, authenticated admin access, and public Explore. Production PostgreSQL
   must not expose host ports. No old public bytes exist to relocate.

## Run one supervised batch

Use an operator shell on the host. Compose supplies the internal API URL and existing shared
server secret; no admin token is required. Export identifying `READING_IMPORT_USER_AGENT`.
Set `READING_BATCH_DIRECTORY` to an existing dedicated absolute host directory on the data volume.
Keep the shared secret outside JSON/Git/logs. Internal importer routes are blocked at Caddy.
The normal importer mount `/imports` is read-only: use the explicit writable mount below.

```sh
reading_cli() {
  script="$1"; shift
  docker compose -f compose.yaml -f compose.prod.yaml run --rm --no-deps -T \
    -v "$READING_BATCH_DIRECTORY:/reading-import" \
    -e READING_IMPORT_USER_AGENT --entrypoint node catalog-importer \
    "/app/apps/catalog/dist/src/reading-import/$script" "$@"
}
reading_cli main.js --bootstrap --file /reading-import/collection.json --output /reading-import/candidates.json
reading_cli main.js --inspect --file /reading-import/candidates.json --output /reading-import/inspected.json
reading_cli main.js --apply --file /reading-import/inspected.json
reading_cli publication/main.js --file /reading-import/reviewed.json
# After reviewing the offline plan, publish the explicitly approved files:
reading_cli publication/main.js --file /reading-import/reviewed.json --apply
```

Keep collection batches at 10–20 initially, at most 100. A 300-title target requires multiple batches.
Inventory after the full metadata import is an alternative to bootstrap; see the existing import guide.
Replay exit 2 after checking per-file failures/pending processing; exit 1 means startup/plan failure.
Do not resubmit PROCESSING crashes indefinitely: inspect the run and repair with an operator first.
Verify Explore/Read as a normal account and a clean browser.
Check owner-only private links remain private and Catalog sync clears. Never print the shared secret.
To stop new acquisition, use the existing withdrawal controls; acquired copies and bytes remain.
Rollback app images only with schema compatibility verified; never undo data migrations blindly.
