# Classic import, review, and public storage

Contract: [reading assets](specs/12-explore-catalog/12.8-reading-assets.md).
Storage: [ADR 13](adr/13-catalog-public-book-storage.md). Finish authors → works → editions →
metadata --retry first for ordinary inventory. [EPUB-first bootstrap](catalog-bootstrap.md) is also
supported. Catalog preparation shares the metadata lock; network/processing waits do not.
Pending metadata blocks it; unresolved unrelated rows are reported/excluded.

Production commands and launch gates: [deployment runbook](catalog-import-deployment.md).
Batch publication: [reviewed plan](catalog-publication.md).

## Deployment

1. Apply pending catalog migrations after metadata finishes, including the concurrent provenance
   index, publication revisions, PublicBlob table, and editorial soft deletion. Allow index-build disk headroom.
2. Apply main migrations for import identity, review state, Catalog blob references, and private links.
   Generate both Prisma clients and deploy/restart both services plus the web app.
3. Set the same random READING_ASSET_SYNC_SECRET (at least 32 characters) on main and Catalog.
   Main needs CATALOG_API_BASE_URL (Compose supplies http://catalog:4001). Use HTTPS between hosts.
   These credentials stay server-side. Missing configuration fails closed; private uploads still work.
4. Configure CATALOG_DATABASE_URL for the importer, READING_IMPORT_MAIN_API_URL including /api,
   and READING_IMPORT_USER_AGENT identifying AVA/version/contact. Server runs use the shared secret
   automatically (ADR 14); no admin token is needed. Keep secrets outside manifests/Git/logs.

## Import unpublished books

- Inventory: `pnpm --filter catalog import:reading-assets --inventory --output /path/classics.json`.
  This is offline/read-only; --limit 20 reduces the default 100-candidate ceiling.
  Optional --language uk|en|de|fr|es|pl selects a seed language; default interleaves all six.
  Seed counts and original-text copyright screening: [rights audit](catalog-classics-rights.md).
- Inspect: `pnpm --filter catalog import:reading-assets --inspect --file /path/classics.json --output /path/inspected.json`.
  It verifies/downloads unrestricted EPUBs to /path/inspected.json.files/<sha256>.epub and records
  provider metadata. Select an exact candidate.filename if an item has several EPUB files.
- Upload/process: `pnpm --filter catalog import:reading-assets --apply --file /path/inspected.json`.
  No manifest approval is needed. Source, cover, raw IA snapshot, and processed reader-package bytes
  go to Catalog PostgreSQL. Main stores only descriptors/approval state, plus private uploads/user data.
  The importer publishes collection copies after processing, with review deferred; other copies stay drafts.
- Replay repairs interrupted uploads without duplicate books/runs. Pending processing exits 2;
  replay later. FAILED processing requires inspecting the diagnostic. Individual errors exit 2 after
  remaining items; startup errors exit 1. Metadata importer exit behavior stays unchanged.

## Admin review and publication

Open Explore with an admin account. Draft reading copies use the ordinary Read button; only
admins can acquire unpublished copies. Publish opens the rights/quality confirmation modal.
Edit book/edition/author and Delete book open modals in the same Explore screens.
The former /app/admin/reviews URL redirects to Explore. Review translation/illustrations, volume
completeness, beginning/middle/end text,
rights evidence, and distribution territories. Enter the review and explicitly confirm both checks.
Publish records the actor/time/hash and passes technical text/navigation checks before publication.

Publication synchronizes Catalog availability immediately. Failed delivery remains visibly pending
and retries automatically every 10 seconds, including after restart. Retry synchronization in the UI
is also safe. Signed monotonic revisions stop delayed publication from undoing newer withdrawals.
Imported-copy unpublish/archive actions queue withdrawal; acquired copies retain access.
Restore a processed withdrawn copy through Publish with fresh rights/quality confirmations.
Jurisdiction is recorded, not geo-enforced: review rights appropriate to the application's audience.

There are no production public books to migrate. New public uploads and derived files go directly
to Catalog; private uploads stay in Main. No legacy public-blob relocation command is shipped.
