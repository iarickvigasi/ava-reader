import type {
  LibraryCardBook,
  LibraryBookInfoDetails,
} from "@/lib/api-types/library";

export type LibraryItemRow = LibraryCardBook & {
  // Engagement timestamp from the originating list (max of progress.lastReadAt,
  // lastOpenedAt, addedAt). `null` for items that have never been engaged.
  lastReadAt: string | null;
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
  // What the last server payload said `offlineRequested` was. Compared against
  // the live value to find toggles the server hasn't counted yet, so the
  // Offline Books shelf can report the server's whole-collection count plus
  // those (see buckets/library/offline-intent/offline-books-view.ts). Deliberately tracks the
  // payload, not the PATCH: clearing it on a flush ack would drop the toggle
  // out of the count while the cached collection row still held the old total.
  // Undefined on rows cached before this field existed — those contribute
  // nothing, so no schema version bump is needed.
  offlineRequestedBaseline?: boolean;
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
