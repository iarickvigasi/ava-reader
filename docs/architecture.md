# Architecture — source of truth for HOW

See product.md for what & why; conventions.md for idioms; adr/ for hard decisions. Keep ≤150 lines.

## Principles

- **Offline-first.** Every user action works offline and reconciles later. User data flows through a
  bucket, never a raw fetch.
- **Local-first UX.** Mutations apply in-memory instantly, persist to Dexie fire-and-forget, then
  flush idempotently on reconnect. The UI never blocks on the network.
- **Spec-driven.** Behaviour is defined in docs/specs before code; decisions in adr/. A drifted spec
  is a bug.
- **Durable anchoring.** Positions and annotations are stored as locators (text fingerprints), so
  they survive book re-imports and format changes.
- **One way to do a thing.** New domains reuse the bucket file set; new screens reuse panels +
  selection context. No parallel mechanisms.

## Stack & repo

Monorepo: pnpm workspaces + Turbo (lint/typecheck/test/build), Node ≥22.

- **apps/web** — Next.js 16 (App Router), React 19, Tailwind v4, Dexie (IndexedDB), Clerk (auth),
  next-intl (i18n). SSR shell + offline-first client.
- **apps/api** — NestJS 11, Prisma 7, Postgres. EPUB processing, blobs, AI proxying, dashboards.
- **apps/mobile** — placeholder for future cross-platform.
- **AI** — OpenRouter via the Vercel `ai` SDK, structured output. See adr/2.

## Web app (apps/web)

- **Routes (app/):** `/` landing · `/sign-in` `/sign-up` `/auth/sso-callback` · `/app` home ·
  `/app/read/[slug]` reader · `/app/library` + `/books/[slug]` + `/collections/[slug]` ·
  `/app/explore` · `/app/insights` · `/app/admin/catalog`.
- **components/** — ui (primitives), auth, theme, brand, and app/ (reader, home, library, admin,
  core contexts, preferences, shared).
- **Reader modes:** `components/app/reader/view/reader-mode-router.tsx` selects ordinary
  `ReadyReader` or `BilingualReader`, restores position between modes, and hosts shared overlays.
  Future listening mode belongs in this router.
- **components/app/reader/bilingual/** — root reader and coordinator compose `content/` for book
  flow, `layout/` for columns/footer, `loading/` for placeholders/status, `measurement/` for hidden
  measurement and next-chapter preparation, and `interactions/` for gestures/selection/marks.
  Tests stay beside their components; measurement and pagination algorithms remain in features.
- **features/reader/** — reader logic and hooks: pagination, navigation, toc, resume, locators,
  and shared measurement. `modes/` owns device detection and position restoration between modes.
- **features/reader/bilingual/** — `content/` assembles paragraph fragments; `measurement/` owns
  DOM geometry and stable measured snapshots; `pagination/` packs sentence ranges; `position/`
  maps source anchors; `demand/` schedules requested translations through the offline bucket.
  Root `types.ts` holds shared contracts and `use-bilingual-pages.ts` coordinates page state.
  Tests and fixtures live beside their consumers. Translation storage stays in the offline layer.
- **lib/api-types/** — typed API contracts (reader, home, library, user, admin, shared);
  lib/server-api.ts fetches initial payloads, lib/api.ts is the browser client.

## Offline layer (apps/web/features/offline)

- **db.ts** — one Dexie instance **per user** (`ava-reader-<userId>`; adr/5), versioned schema.
  Tables: libraryItems, collections, collectionMembership, books, bookChapters, highlights,
  aiComments, translations, sessions, progress, statsSnapshot, preferences, me, home, meta + per-domain mutation
  queues (highlightMutations, aiCommentMutations, sessionMutations, preferenceMutations,
  collectionMembershipMutations). Bump
  `.version(n)` for any structural change.
- **buckets/** — one folder per domain (fixed file set: types, storage, bucket, selectors,
  mutations, sync, id, index — see conventions.md). Writeable: highlights, ai-comments, progress,
  sessions, library custom memberships. Cached read payloads: book, library, home, me.
  shared/bucket-core.ts holds listeners,
  persist, and retry backoff (1s→30s, capped, reset on success).
- **bucket sync** — each writeable bucket's `sync.ts` drains its own queue, triggered on `online`
  (its own listener) and via the page hydrators; one in-flight flush per bucket, FIFO queue,
  idempotent upserts keyed by client ULID; permanent 4xx → DropEvent toast.
- **stats/** — composes server baseline + unsynced local session/progress deltas (no double-count on
  sync).
- **sw/** — service worker caches the app shell; a root identity reconciler (lifecycle/) wipes all
  offline substrates on sign-out / account-switch (adr/5); net-state tracks connectivity;
  missing-book-bus signals uncached content.

## API (apps/api/src)

Modules: reader (EPUB→chapters/blocks, progress), library (import, items, blobs, collections),
ai-comments (translate/explain/etymology generation + cache), book-translations (sentence catalog,
incremental translated-book versions), book-analysis (book-scoped AI
analyses; chapter purpose → body-only reading time), home (dashboard aggregation), catalog
(published books + curation), annotations (highlights; legacy path → buckets), users (profile,
preferences, Clerk sync), feedback, auth (Clerk token verification), shared (slug/zip/blob/metadata
utils, OpenRouter client).
Key routes: `/home`, `/library`, `/library/:libraryItemId/reader`,
`/library/:libraryItemId/annotations`, `/library/:libraryItemId/ai-comments`, `/feedback`.

Book translations keep their controller, service, DTOs, types, and version identity at the root.
`source/` loads owned content and builds/selects sentences; `generation/` owns AI calls, prompts,
output validation, and request locking; `storage/` reads and persists results. Tests live beside
their implementations, with shared fixtures in `testing/`.

## Domain model (apps/api/prisma/schema.prisma)

- **User** → UserPreferences, LibraryItem[], ReadingProgress[], ReadingSession[], Annotation[],
  AiComment[], Collection[]. UserRole gates admin/curator.
- **Book** → BookFile[] (EPUB | PDF | READER_PACKAGE | UNKNOWN), StoredBlob (cover/content via
  BlobPurpose), BookProcessingRun (ProcessingStatus). CatalogEntry (DRAFT | PUBLISHED | ARCHIVED)
  publishes a Book.
- **LibraryItem** — User↔Book join (source IMPORTED | CATALOG); the scope for ReadingProgress
  (unique, locator + completion % + minutes), ReadingSession (clientSessionId ULID, Participant +
  per-day Segment), Annotation (highlight: excerpt, color, locator), AiComment (kind TRANSLATE |
  ETYMOLOGY | EXPLAIN; dedup by (user, sourceHash)).
- **Collection** (SMART | CUSTOM) → CollectionItem[]. **FeedbackSubmission** captures user feedback.
- **BookTranslation** → SentenceTranslation[]: per-user/item/source/language/prompt version;
  populated as pages are read. Sentence IDs and source offsets are independent of page geometry.
- Client-generated ULIDs make offline replay and idempotent upserts safe.

## Core flows

- **Read:** `/app/read/[slug]` → book bucket serves cached chapters (else API + auto-save first
  chapter) → reader renders blocks → progress bucket tracks locator → resume on reopen.
- **Annotate:** select text → selection context → highlights/ai-comments bucket → instant paint →
  flush on reconnect.
- **AI tool:** select → ai-comments `generate.*` mutation → POST → streamed structured output →
  stored as a ready AiComment, deduped by sourceHash.
- **Track:** session start/heartbeat/stop + progress writes (offline) → home shows baseline + local
  deltas.

## Engineering discipline

Strict TypeScript everywhere. Vitest + fake-indexeddb (web), Jest + Supertest (api), Playwright
(e2e). ESLint + Prettier. Turbo orchestrates tasks; Prisma migrations + seed; Docker Compose for
Postgres. CI: .github/workflows/deploy.yml.

## Invariants (don't break)

- User-mutable data goes through a bucket; reads merge snapshot + pending via selectors.
- Mutations are idempotent and coalesced (one pending per id); never assume network success.
- Locators are the only stable reference into content — don't anchor to DOM indices.
- Stats = server baseline + local deltas; never sum raw sessions client-side.
