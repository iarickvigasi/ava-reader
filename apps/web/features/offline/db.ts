// Per-user Dexie database (`ava-reader-<userId>`; adr/5) for everything that
// needs to work offline:
// library/collection summaries, full book content for saved books, highlights,
// AI comments, reading sessions, reading progress + stats, and user preferences.
// Each domain gets its own table so
// flushing one queue doesn't have to deserialize unrelated rows.
//
// Schema versioning rules:
// - Bump the `.version(n)` number for ANY structural change (new table, new
//   index, renamed primary key). Add an `.upgrade(tx => …)` if existing rows
//   need transforming.
// - Never silently drop user-intent rows (anything in a *Mutations table).
//   keep what we recognize, drop only unparseable entries.
// - The `meta` table records the schema version we last saw, which lets us
//   detect a downgrade (older app version reading a newer DB) and refuse
//   instead of corrupting data.

import Dexie, { type Table } from "dexie";

import type { HomePayload } from "@/lib/api-types/home";
import type {
  LibraryBookInfoDetails,
  LibraryCardBook,
  LibraryCollection,
} from "@/lib/api-types/library";
import type {
  ReaderBlock,
  ReaderLocator,
  ReaderRangeLocator,
} from "@/lib/api-types/reader";
import type { CurrentUserPayload } from "@/lib/api-types/user";

// ----- Library / collections (phase 1) ---------------------------------------

// Summary fields only — exactly what library + collection cards render. Full
// book content lives in `books` + `bookChapters` and is only present when the
// book has been saved for offline (either explicitly or because the user
// engaged with it).
export type LibraryItemRow = LibraryCardBook & {
  // Engagement timestamp from the originating list (max of progress.lastReadAt,
  // lastOpenedAt, addedAt). `null` for items that have never been engaged.
  lastReadAt: string | null;
  // Cached cover blob — populated only when the book is saved offline.
  coverBlob: Blob | null;
  // Set to true when the user explicitly taps "Save for offline" OR the moment
  // they start reading the book (auto-save policy: when the user opens a
  // book that isn't downloaded yet, it gets cached). Distinct from the
  // explicit flag because explicit saves are sticky under quota pressure.
  savedOffline: boolean;
  savedAutomatically: boolean;
  savedAt: string | null;
  // Offline-capable mutation bookkeeping for the server-synced "keep this book
  // offline" intent. `offlineRequestedDirty` marks a local toggle not yet
  // PATCHed to the server; the sync flush drains it and a revalidation
  // preserves the local value while it's still dirty.
  offlineRequestedDirty?: boolean;
  // Server-side updatedAt of the LibraryItem row, used to short-circuit
  // unchanged revalidations.
  serverUpdatedAt: string | null;
  // Book-info detail fields. Optional — populated when the user has visited
  // the book-info page at least once (online), so reopening the page later
  // works offline. Stored flat on the row so a Dexie query for one
  // libraryItemId returns everything the screen needs without a join.
  // `details` is intentionally optional rather than nullable so an undefined
  // value cleanly signals "we don't know yet" vs. "server said null".
  details?: LibraryBookInfoDetails;
  detailsFetchedAt?: string;
};

export type CollectionRow = Omit<LibraryCollection, "books"> & {
  // We split the books out into `collectionMembership` so a single book row
  // can appear in multiple collections without duplicating the LibraryItemRow.
  // Order is preserved via membership.order.
  bookCount: number;
  serverUpdatedAt: string | null;
};

export type CollectionMembershipRow = {
  collectionId: string;
  libraryItemId: string;
  order: number;
};

// ----- App shell: current user + home (offline route loading) ----------------
// Cached so the app layout + home screen can render when the user opens or
// reloads the app offline (the service worker serves the HTML shell; these
// rows feed the data). Both are single-row tables keyed by the literal "me"
// — one signed-in user per browser profile.

export type CurrentUserRow = {
  id: "me";
  user: CurrentUserPayload;
  fetchedAt: string;
};

export type HomeRow = {
  id: "me";
  payload: HomePayload;
  fetchedAt: string;
};

// ----- Book content (phase 2) ------------------------------------------------
// Schema is declared here in phase 0 so the migration path is one upgrade,
// not two. Tables stay empty until phase 2 starts populating them.

export type BookRow = {
  libraryItemId: string;
  // Full table of contents — needed offline so the contents panel works.
  toc: unknown;
  // Ordered chapter ids; pair with bookChapters rows by [libraryItemId, chapterId].
  chapterIds: string[];
  // Anything the reader needs that isn't per-chapter (book-level metadata,
  // language, primary format, etc.). Kept as `unknown` here to avoid coupling
  // the offline layer to the still-evolving ReaderPayload shape.
  metadata: unknown;
  fetchedAt: string;
};

export type ChapterRow = {
  libraryItemId: string;
  chapterId: string;
  index: number;
  blocks: ReaderBlock[];
  // Anchor map / aux data we want offline. Untyped at the offline layer.
  aux: unknown;
  fetchedAt: string;
};

// ----- Highlights (phase 3) --------------------------------------------------

export type HighlightRow = {
  libraryItemId: string;
  id: string;
  excerpt: string;
  // Mirrors HighlightColor in features/offline/buckets/highlights/types.ts.
  // Kept as string
  // here so the offline DB doesn't depend on the highlights module's enum;
  // the bucket coerces back to the union on read.
  color: string;
  locator: ReaderRangeLocator | null;
  createdAt: string;
  updatedAt: string;
};

// ----- AI comments (phase 5) -------------------------------------------------

export type AiCommentRow = {
  libraryItemId: string;
  id: string;
  // Matches the AiCommentKind enum the API returns from GET — uppercase
  // so callers don't have to convert at every boundary. Endpoint *paths*
  // are still lowercase (/translate, /explain, /etymology) and are
  // handled by the mutation envelope's "generate.translate" /
  // "generate.explain" / "generate.etymology" kind tags.
  kind: "TRANSLATE" | "EXPLAIN" | "ETYMOLOGY";
  sourceText: string;
  body: string;
  targetLang: string | null;
  locator: ReaderRangeLocator | null;
  createdAt: string;
  // `queued`: user requested while offline; body may be empty until the
  // generation intent replays successfully.
  // `streaming`: generation in flight (transient — only while the tab is open).
  // `ready`: terminal success.
  // `failed`: permanent failure; the reason is shown inline in the panel.
  status: "queued" | "streaming" | "ready" | "failed";
  // Server rejection reason, set only when status is "failed". Not indexed,
  // so adding it needs no schema version bump.
  error: string | null;
};

// ----- Reading sessions + progress + stats (phase 4) -------------------------

export type SessionRow = {
  // Client-generated ULID. Stays stable across retries so the server can
  // upsert by it (API change in phase 4).
  clientSessionId: string;
  serverSessionId: string | null;
  libraryItemId: string;
  startedAt: string;
  endedAt: string | null;
  lastHeartbeatAt: string;
  state: "open" | "closed";
  syncedAt: string | null;
};

export type ProgressRow = {
  libraryItemId: string;
  locator: ReaderLocator | null;
  completionPercent: number;
  // `dirty` when we have local progress that hasn't synced; clears once the
  // server acks it. Used to pick the winner during merge.
  lastLocalUpdateAt: string;
  lastServerUpdateAt: string | null;
  dirty: boolean;
};

// Roll-up shown on the stats / insights page. We keep it as a single row keyed
// by user id ("me") to make the offline read cheap; the server stays the
// source of truth and overwrites this snapshot on every successful sync.
export type StatsSnapshotRow = {
  id: "me";
  // Untyped at the offline layer — the stats UI consumes this shape directly.
  payload: unknown;
  fetchedAt: string;
};

// ----- Preferences (phase 6) -------------------------------------------------

export type PreferencesRow = {
  id: "me";
  // Mirrors the server's UserPreferences payload. Untyped here to avoid
  // coupling the offline layer to the preferences module.
  values: Record<string, unknown>;
  // Field names that have local edits not yet flushed. The runner sends a
  // PATCH with just these fields; we never overwrite them from a server
  // snapshot until the PATCH succeeds.
  dirtyFields: string[];
  serverUpdatedAt: string | null;
};

// ----- Generic mutation envelope --------------------------------------------
// Each domain's queue uses a domain-specific payload, but the envelope shape
// is shared so the sync runner can treat them uniformly.

export type MutationRow<TKind extends string, TPayload> = {
  mutationId: string;        // ULID — also the idempotency key the server sees
  kind: TKind;
  scopeId: string;           // libraryItemId, "me", etc. — used for sharding
  payload: TPayload;
  queuedAt: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  lastError: string | null;
};

export type HighlightMutationKind = "upsert" | "delete";
export type HighlightMutationPayload =
  | { excerpt: string; highlightColor: string; locator: ReaderRangeLocator | null }
  | null; // null for deletes — id is on the envelope

export type HighlightMutationRow = MutationRow<
  HighlightMutationKind,
  HighlightMutationPayload
> & {
  // Highlight id this mutation targets. Distinct from `mutationId` so retries
  // collapse to the same row.
  highlightId: string;
};

export type AiCommentMutationKind =
  | "delete"
  | "generate.translate"
  | "generate.explain"
  | "generate.etymology";
export type AiCommentMutationRow = MutationRow<
  AiCommentMutationKind,
  Record<string, unknown>
> & {
  commentId: string;
};

export type SessionMutationKind = "start" | "heartbeat" | "stop";
export type SessionMutationRow = MutationRow<
  SessionMutationKind,
  Record<string, unknown>
> & {
  clientSessionId: string;
};

export type PreferenceMutationRow = MutationRow<
  "patch",
  Record<string, unknown>
>;

// ----- Bookkeeping -----------------------------------------------------------

export type MetaRow = {
  key: string;
  value: unknown;
  updatedAt: string;
};

// Bumped only for structural changes WITHIN one user's database. The database
// NAME is per-user (`ava-reader-<userId>`), so different accounts on one browser
// profile never share an object store — see adr/5.
export const SCHEMA_VERSION = 1;
export const DB_NAME_PREFIX = "ava-reader-";
// The pre-per-user single database; swept once by purgeOtherUserDbs (adr/5).
export const LEGACY_DB_NAME = "ava-reader";
// Stand-in user id for the window before any identity is known on a fresh
// device (no persisted active user yet); its DB is purged on first login.
export const ANONYMOUS_DB_USER = "anonymous";
// localStorage marker: who getDb() opens before Clerk boots (instant offline
// read). Always correct offline — identity can only change online.
export const ACTIVE_USER_STORAGE_KEY = "ava-reader:active-user";

export function dbNameForUser(userId: string): string {
  return `${DB_NAME_PREFIX}${userId}`;
}

// The database getDb() opens before any user is active: the anonymous pre-login
// window, and tests (which run without setActiveUser).
export const DB_NAME = dbNameForUser(ANONYMOUS_DB_USER);

export class AvaReaderDB extends Dexie {
  libraryItems!: Table<LibraryItemRow, string>;
  collections!: Table<CollectionRow, string>;
  collectionMembership!: Table<CollectionMembershipRow, [string, string]>;

  me!: Table<CurrentUserRow, "me">;
  home!: Table<HomeRow, "me">;

  books!: Table<BookRow, string>;
  bookChapters!: Table<ChapterRow, [string, string]>;

  highlights!: Table<HighlightRow, [string, string]>;
  aiComments!: Table<AiCommentRow, [string, string]>;

  sessions!: Table<SessionRow, string>;
  progress!: Table<ProgressRow, string>;
  statsSnapshot!: Table<StatsSnapshotRow, "me">;
  preferences!: Table<PreferencesRow, "me">;

  highlightMutations!: Table<HighlightMutationRow, string>;
  aiCommentMutations!: Table<AiCommentMutationRow, string>;
  sessionMutations!: Table<SessionMutationRow, string>;
  preferenceMutations!: Table<PreferenceMutationRow, string>;

  meta!: Table<MetaRow, string>;

  constructor(name: string) {
    super(name);

    // v1 — initial schema. Indexes:
    // - libraryItems: primary `libraryItemId`, secondary `slug` for slug
    //   lookups from the reader URL, and `lastReadAt` for sorting recents.
    // - collectionMembership: compound PK [collectionId+libraryItemId] so a
    //   single book can live in multiple collections; index libraryItemId
    //   alone for the reverse lookup ("what collections is this book in").
    // - bookChapters: compound PK [libraryItemId+chapterId]; index
    //   libraryItemId for batch reads of a single book.
    // - highlights / aiComments: same compound shape.
    // - sessions: primary `clientSessionId`; index `libraryItemId+state` so
    //   the runner can find any unsynced open session quickly.
    // - *Mutations: primary `mutationId`; index `queuedAt` for FIFO drain;
    //   `scopeId` for per-bucket queues.
    this.version(1).stores({
      libraryItems:
        "libraryItemId, slug, lastReadAt, savedOffline, savedAutomatically",
      collections: "id, slug, kind",
      collectionMembership: "[collectionId+libraryItemId], collectionId, libraryItemId, order",

      books: "libraryItemId",
      bookChapters: "[libraryItemId+chapterId], libraryItemId, index",

      highlights: "[libraryItemId+id], libraryItemId, updatedAt",
      aiComments: "[libraryItemId+id], libraryItemId, status, createdAt",

      sessions: "clientSessionId, libraryItemId, state, syncedAt",
      progress: "libraryItemId, dirty",
      statsSnapshot: "id",
      preferences: "id",
      me: "id",
      home: "id",

      highlightMutations: "mutationId, scopeId, queuedAt, highlightId",
      aiCommentMutations: "mutationId, scopeId, queuedAt, commentId",
      sessionMutations: "mutationId, scopeId, queuedAt, clientSessionId",
      preferenceMutations: "mutationId, queuedAt",

      meta: "key",
    });
  }
}

// ----- Active user + per-user database resolution (adr/5) --------------------

// Module-level singleton. Dexie holds an open IDB connection so we want exactly
// one per page; it's reopened under a new name when the active user changes.
let dbInstance: AvaReaderDB | null = null;
let activeUserId: string | null = null;

// Sets whose database getDb() opens, and persists the choice so the next cold
// start reopens the same DB before Clerk boots. Closes the previous instance so
// the next getDb() reopens under the new name.
export function setActiveUser(userId: string): void {
  if (activeUserId === userId) {
    return;
  }
  activeUserId = userId;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ACTIVE_USER_STORAGE_KEY, userId);
    } catch {
      // Private mode / storage disabled — fall back to the in-memory value.
    }
  }
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// The active user: the in-memory value, else the persisted marker (instant
// offline read before Clerk resolves). Null only on a fresh device.
export function getActiveUserId(): string | null {
  if (activeUserId) {
    return activeUserId;
  }
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
      if (stored) {
        activeUserId = stored;
        return stored;
      }
    } catch {
      // ignore — treat as no active user
    }
  }
  return null;
}

// Forgets the active user (sign-out). The next getDb() falls back to the
// anonymous database until a new user is set.
export function clearActiveUser(): void {
  activeUserId = null;
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export function getDb(): AvaReaderDB {
  const name = dbNameForUser(getActiveUserId() ?? ANONYMOUS_DB_USER);
  if (!dbInstance || dbInstance.name !== name) {
    dbInstance = new AvaReaderDB(name);
  }
  return dbInstance;
}

// Deletes one user's database (sign-out wipe). Closes the cached instance first
// if it points at that DB so the delete isn't blocked by an open connection.
export async function deleteUserDb(userId: string): Promise<void> {
  const name = dbNameForUser(userId);
  if (dbInstance && dbInstance.name === name) {
    dbInstance.close();
    dbInstance = null;
  }
  await Dexie.delete(name);
}

// Deletes every offline database that isn't `keepUserId`'s — other accounts'
// DBs plus the legacy single DB. Best effort: one failed delete doesn't reject
// the rest. Engines without indexedDB.databases() (Firefox) can't enumerate, so
// purge is incomplete there, but isolation (separate DB per user) still holds.
export async function purgeOtherUserDbs(keepUserId: string): Promise<void> {
  const keepName = dbNameForUser(keepUserId);
  const names = (await listOfflineDbNames()).filter(
    (name) =>
      name !== keepName &&
      (name === LEGACY_DB_NAME || name.startsWith(DB_NAME_PREFIX)),
  );
  // If the cached connection points at a DB we're about to delete, close it
  // first so the delete isn't blocked and we don't keep a stale instance.
  if (dbInstance && names.includes(dbInstance.name)) {
    dbInstance.close();
    dbInstance = null;
  }
  await Promise.all(
    names.map((name) => Dexie.delete(name).catch(() => undefined)),
  );
}

async function listOfflineDbNames(): Promise<string[]> {
  const names = new Set<string>([LEGACY_DB_NAME]);
  if (typeof indexedDB !== "undefined" && "databases" in indexedDB) {
    try {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) {
          names.add(db.name);
        }
      }
    } catch {
      // ignore — return what we know
    }
  }
  return [...names];
}

// Test-only: lets a vitest suite drop the singleton between cases so each
// fake-indexeddb instance starts clean. NOT exported via the package barrel.
export function __resetDbForTests() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  activeUserId = null;
}
