# Independent book catalog

Status: accepted · Date: 2026-10-23 · Scope: catalog foundation; later phases remain drafts.

## Context

Explore needs worldwide book and author metadata, including books AVA cannot supply for reading.
Today Book mixes metadata with readable content; CatalogEntry requires a source file and lives
inside the main API/database. Search and ingestion need independent scaling; shared hardware is acceptable initially.

## Decision

- Start on one server: main and catalog PostgreSQL run as separate instances/containers, each
  with its own database, credentials, persistent volume, backups, and connection limits.
  They share host CPU, RAM, disk I/O, and failure risk; this is not physical resource isolation.
- Add an independently deployed NestJS Catalog API with its own Prisma schema and migrations.
  Reuse monorepo tooling, but do not import its Prisma client into the main API.
- Browser/mobile Explore reads go directly to Catalog API through its own gateway/CDN route.
  Main API owns personal shelves, uploads, files, reader packages, annotations, and progress.
- Catalog owns stable AVA work, edition, and author IDs plus source mappings and provenance.
  Main DB stores opaque catalog IDs and small metadata snapshots; no cross-database foreign keys.
- Start search with indexed PostgreSQL projections. Benchmark global-scale representative data;
  add a rebuildable dedicated index if latency, relevance, or operating cost requires it.
- Run ingestion in independent workers with bounded concurrency and database resource budgets.
  Metadata transactions write an outbox for projections and consumers; avoid distributed commits.
- Store new raw imports and shared catalog assets in object storage; serve public covers via CDN.
  Private uploads remain under main-system ownership; blob migration is a separate rollout.

## Alternatives and consequences

| Option                           | Assessment                                                              |
| -------------------------------- | ----------------------------------------------------------------------- |
| Main DB plus catalog tables      | Mixes ownership and deployment; prefer separate instances.              |
| Separate PostgreSQL              | Recommended: relational integrity, existing team stack, flexible JSONB. |
| MongoDB as canonical store       | Flexible raw records; joins and identity constraints still needed.      |
| Search engine as canonical store | Ranking-friendly; unsuitable as authority for merges/provenance.        |
| Graph database                   | Author/work links fit relational joins; no demonstrated need yet.       |

This introduces an extra service and eventual consistency. Catalog outages can stop new discovery,
but saved metadata and existing reading continue. Search scalability is independent of main API;
all services initially share host resources. Limit workers and monitor contention; move catalog DB,
API, or workers to other hosts when needed, retaining API contracts and stable IDs. Use configurable
network endpoints, independent volumes, and off-host backups; avoid shared-file or localhost coupling.
Do not select sharding, Kubernetes, Kafka, or a search vendor before measured need.

## Follow-through

Accepted for the separate service/database foundation. Search, ingestion, and personal links remain
future phases; provider and search vendor choices are not committed by this milestone.
The [Explore spec](../specs/12-explore-catalog/_overview.md) describes the proposed contract,
model, boundaries, ingestion, and rollout. Existing shipped specs and schema remain authoritative.
Budget and traffic assumptions must be resolved before production capacity planning.

## Evidence

- [PostgreSQL text search indexes](https://www.postgresql.org/docs/current/textsearch-indexes.html)
  recommends GIN for text search; [pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html)
  provides indexed similarity search. Neither establishes AVA's achievable latency or scale.
- [Open Library dumps](https://openlibrary.org/developers/dumps) supply works, editions, authors,
  redirects, and deletes; their model supports separating discovery from content availability.
