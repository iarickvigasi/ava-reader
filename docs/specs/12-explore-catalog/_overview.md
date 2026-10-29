# Explore catalog

> Status: active · Updated: 2026-10-23 · ADR: [10](../../adr/10-independent-book-catalog.md)
> Code: apps/catalog; existing readable-book curation remains in apps/api/src/catalog.

## Summary

Discover books and authors globally, save books before owning a file, and attach a purchased EPUB
to its catalog description. Supports the product's discovery, reading, and personal-library jobs.
Aim for broad global coverage, English strongest initially, with measured expansion of sources.
No source guarantees every book or a complete description; missing metadata stays explicit.

## Scope

- In: metadata-only discovery, authors, editions, personal reading/wish lists, upload linkage,
  and the database foundation for multi-source ingestion and public-domain reading.
- Deferred: scraper implementations, reviews/ratings/social feeds, store checkout, recommendations,
  dedicated search vendor, and general file-storage migration.
- First milestone: independent schema, sample metadata, health and ID lookup endpoints.
  Open Library file ingestion is implemented in [12.6](12.6-open-library-import.md).
  Explore browsing/search/details are implemented in [12.7](12.7-explore-ui.md); personal links remain.

## Proposed behavior

1. Explore searches local catalog data by title, author, identifier, and language; results group
   editions under a work. The book page allows edition selection and links to author pages.
2. Metadata-only books are visible and can be saved to reading/wish lists without a file.
   Read is available only when an accessible, successfully processed reading copy exists.
3. An EPUB uploaded from a book page becomes a private reading copy linked to that work and,
   when confirmed, edition. Users can also link an earlier upload from its library page, or choose
   one of their existing uploads from a catalog page. Both paths create the same private link;
   neither replaces public metadata nor exposes another user's file.
4. Author pages display available biography, aliases, and credited works; unknown data is omitted.
5. Free-reading availability refers to a specific asset and edition with recorded rights evidence;
   a work's age or appearance in a metadata provider never grants access to its files.
6. Discovery can be unavailable offline; saved book metadata, shelves, and downloaded reading
   copies remain usable through existing bucket patterns. Do not cache the entire catalog.
7. An absent result offers a missing-book request or private unmatched import; descriptions and
   author biographies are not fabricated to imply complete coverage.

## Foundation milestone

See [12.5](12.5-foundation.md) for the implemented subset and endpoint contract.

## Sub-specs

- [12.1](12.1-data-model.md): canonical entities, indexes, identity, and deduplication.
- [12.2](12.2-personal-library.md): ownership boundaries, lists, uploads, and offline behavior.
- [12.3](12.3-ingestion.md): source research, provenance, ingestion, and public assets.
- [12.4](12.4-rollout-and-search.md): deployment, search scaling, migration, and validation.
- [12.5](12.5-foundation.md): shipped independent catalog and lookup endpoints.
- [12.6](12.6-open-library-import.md): shipped Open Library file importer.
- [12.7](12.7-explore-ui.md): Explore browsing, shared book components, and author pages.
- [12.8](12.8-reading-assets.md): approved reading-asset ownership and reading behavior.
- [12.9](12.9-reader-categories.md): proposed reader categories and whole-corpus subject normalization.
- [12.10](12.10-editorial-controls.md): shared Explore admin controls and metadata correction.
- [12.11](12.11-import-order-and-linking.md): import-order options and two-way linking requirements.

## Shared model

Catalog: Work → Edition; Work ↔ Author through credits; Edition → optional public assets.
Main system: User → UserCatalogBook → linked LibraryItem reading copies → Book/File/progress.
Catalog IDs identify descriptions; LibraryItem and content revision identify reading state.
No merge or catalog update may re-anchor annotations or substitute an uploaded file.

## Acceptance criteria

- [ ] A metadata-only book can be found and saved without creating an empty reader package.
- [ ] An author with aliases is discoverable and linked to correctly credited books.
- [ ] Uploading onto a saved book preserves shelf identity and remains private.
- [ ] Shared-host catalog load is bounded; later host separation needs no domain-model rewrite.
- [ ] Both linking directions preserve file identity, progress, privacy, and list memberships.
- [ ] Replayed ingestion and catalog merges preserve stable links and curator decisions.
- [ ] Catalog data and all saved user state satisfy the validation cases in the sub-specs.

## Open questions

Hosting budget ceiling, expected traffic, launch corpus size, priority language test sets, and
whether launch needs multiple simultaneous reading copies per saved work remain to be resolved.
