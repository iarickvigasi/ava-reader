import type Dexie from "dexie";
import { migrateLegacyCovers } from "./buckets/book/covers/migrate";
import { migrateRetiredCollections } from "./migrations/retired-collections";

export function registerOfflineSchema(db: Dexie): void {
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
  db.version(1).stores({
    libraryItems:
      "libraryItemId, slug, lastReadAt, savedOffline, savedAutomatically",
    collections: "id, slug, kind",
    collectionMembership:
      "[collectionId+libraryItemId], collectionId, libraryItemId, order",

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
  db.version(2).stores({
    collectionMembershipMutations: "libraryItemId, queuedAt",
  });
  db.version(3).stores({
    finishDateMutations: "libraryItemId, queuedAt",
  });
  db.version(4).stores({
    translations: "[libraryItemId+chapterId+targetLang], libraryItemId",
  });
  db.version(5)
    .stores({ bookCovers: "libraryItemId" })
    .upgrade(migrateLegacyCovers);
  db.version(6).stores({}).upgrade(migrateRetiredCollections);
}
