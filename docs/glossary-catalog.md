# Catalog and infrastructure glossary

Part of the [AVA glossary](glossary.md).

## Book identities and sources

- **Work** — the intellectual book, grouping its publications and translations.
- **Edition** — a particular publication, language, format, and publisher; may have an ISBN.
- **Saved book** — a user's catalog-linked list entry; needs no uploaded file.
- **Reading copy** — an actual file/content record the user can read, linked to a LibraryItem.
- **Metadata** — information about a book, such as title, authors, description, and publication date.
- **Canonical record** — AVA's chosen authoritative record combining approved source information.
- **Source mapping** — connects a provider's identifier to AVA's work, edition, or author ID.
- **Provenance** — where a value/file came from, when it was obtained, and how it was changed.
- **Field assertion** — a source's claim about one field; kept to compare conflicting claims.
- **Opaque catalog ID** — a stable identifier stored as a reference; callers do not interpret it.
- **Metadata snapshot** — a small local copy of catalog details for offline use and outages.
- **Raw import** — original source data before normalization, such as a dump, CSV feed, or JSON.
- **Ingestion / normalization** — importing source data and converting it to AVA's common format.
- **Catalog asset / blob** — a file, such as a cover or approved EPUB; blob means binary data.
- **Tombstone / redirect** — retained deletion marker / mapping from an old ID to its replacement.

## Services and storage

- **Host / server** — the machine supplying CPU, memory, disk, and networking to running services.
- **PostgreSQL instance** — a running database server; separate instances can share one host.
- **Database / PostgreSQL schema** — a database holds tables; a schema groups tables inside it.
- **Prisma schema / client** — code describing the data model / generated code for querying it.
- **Migration** — a versioned change to database structure; distinct from moving data to a new host.
- **Container / deployment** — a packaged running service / releasing and starting that service.
- **Monorepo** — one repository containing several independently deployable applications.
- **Gateway / route** — a request entry point / rule selecting the backend that handles a request.
- **Object storage** — storage for files addressed by keys; databases retain references to them.
- **CDN** — servers caching public assets near users to reduce latency and backend traffic.
- **Foreign key** — a database-enforced reference to another row; catalog links cross DBs without one.
- **Connection pool / budget** — reusable database connections / the maximum assigned to a service.
- **Resource budget** — limits on CPU, memory, connections, or activity assigned to a service/job.
- **Bounded concurrency** — a limit on how many jobs or requests execute simultaneously.
- **Staging / quarantine** — holding imported records before publishing / keeping invalid records for review.
- **Advisory lock** — a database-held coordination lock allowing only one importer at a time.
- **Worker / consumer** — background program processing jobs / program receiving change messages.

## Search and reliable updates

- **Projection** — a derived view of canonical data, such as compact rows prepared for search.
- **Search index** — a lookup structure speeding search; rebuildable from authoritative records.
- **Outbox** — changes-to-deliver saved alongside metadata in one transaction; workers retry delivery.
- **Transaction / distributed commit** — an all-or-nothing DB operation / coordinating one across systems.
- **Eventual consistency** — derived data catches up after an update rather than changing instantly.
- **Idempotent** — retrying the same operation does not duplicate its effects.
- **Revision / checkpoint** — record version / saved position allowing an interrupted job to resume.
- **Benchmark / p95 latency** — measured workload test / response time met by 95% of requests.
- **Read replica / replication lag** — a database copy for reads / delay behind its primary's changes.
- **PITR / cutover** — point-in-time recovery from backups and logs / switching to a new deployment.
- **ETag** — response version tag allowing clients to check whether cached data is still current.

- **Taxonomy / facet** — a controlled category tree / a filter dimension such as language or genre.
- **Cursor** — a continuation marker for fetching the next bounded result batch.
- **Infinite scroll** — appending another batch when the reader reaches the list's bottom.
- **Rights jurisdiction** — the territory covered by a file's rights assessment; not its language.
