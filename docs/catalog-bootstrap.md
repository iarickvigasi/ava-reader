# Publish classics before the full Open Library import

Bootstrap prepares shortlist descriptions from exact provider IDs before Open Library.
It does not approve rights. [Setup](catalog-reading-import.md); [digital sources](catalog-digital-sources.md).

## Collection input

Save a JSON file containing at most 100 entries per batch:

```json
{
  "version": 1,
  "books": [
    {
      "title": "Pride and Prejudice",
      "author": "Jane Austen",
      "language": "en",
      "iaIdentifier": "REPLACE_WITH_VERIFIED_IA_ITEM_ID",
      "filename": "REPLACE_WITH_EXACT_EPUB_FILENAME.epub",
      "localFile": "./downloaded-book.epub"
    }
  ]
}
```

Use a title/author or alias from the [shortlist](../apps/catalog/src/reading-import/classics.ts).
`filename` is optional only when the IA item has exactly one eligible EPUB. `localFile` is optional;
its path is relative to the collection JSON. Inspection reuses it only if its digests match IA. A
mismatched local file is not uploaded; inspection downloads the verified source instead.

1. `pnpm --filter catalog import:reading-assets --bootstrap --file /path/collection.json --output
/path/candidates.json`
2. `pnpm --filter catalog import:reading-assets --inspect --file /path/candidates.json --output
/path/inspected.json`
3. `pnpm --filter catalog import:reading-assets --apply --file /path/inspected.json`
4. Open Explore as admin, Read the draft, review its exact edition, and explicitly Publish.

Bootstrap creates local author/work/edition descriptions plus an IA source record; files remain in
Catalog storage. Replaying the same item/language reuses the edition; conflicting work identity
fails. Bootstrap, inventory, and binding hold the metadata lock only for Catalog operations.
Inspection downloads and Main upload/processing waits do not hold it; source identities are rechecked.
Curated inspection/application does not require completed Open Library runs. Ordinary inventory
still does. A completed collection may contain fewer readable books than targets: unavailable files
fail individually.

## Attach later Open Library metadata

For verified source IDs **before their dump records have been applied**, save a JSON array of
objects with `kind`, `id` (AVA UUID), `externalId` (for example `/works/OL123W`), and `confirmed:
true`. Kinds: WORK, EDITION, AUTHOR; external IDs use `/works/OL…W`, `/books/OL…M`, `/authors/OL…A`.
Use the actual IDs, not these placeholders. Verify the exact publication for an edition binding. Run
`pnpm --filter catalog import:reading-assets --bind --file /path/bindings.json`, then import the
normal metadata dumps. Provider mappings make those records reuse the existing AVA IDs. Corrections
made after bootstrap are protected by revision checks; conflicting dump rows need manual review. If
the provider ID is already attached elsewhere, the whole binding batch fails without moving it.

If the full metadata collection is already loaded, use **Change work** on an edition or **Attach
edition** on a work in Explore. Select the correct match and confirm. Main review references follow
the edition. A failed second-service update reports an error; retry the same action to finish it.
No duplicate merges, rights transfer to another file, or content replacement occurs.
